// Goalbound Insights (2026-09-24) — shared behaviour for every article page:
// the query engine the figures run on, the hover tooltip, and the email signup.

// ---- Email signup -------------------------------------------------------------
// No mailing-list service is wired up yet. Until one is, the form opens the reader's
// mail app addressed to tom@goalbound.co, which works today and loses nobody.
// To switch to a real list (MailerLite, Buttondown, a Google Form…), paste that
// service's form-post URL here and set the field name it expects. Nothing else changes.
const SIGNUP_ENDPOINT = "";
const SIGNUP_FIELD = "email";

export function signup() {
  const form = document.querySelector(".signup form");
  if (!form) return;
  const msg = form.parentElement.querySelector(".msg");
  form.addEventListener("submit", async e => {
    e.preventDefault();
    const email = form.email.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { msg.textContent = "That doesn't look like an email address."; return; }
    if (typeof gtag === "function") gtag("event", "sign_up", { method: SIGNUP_ENDPOINT ? "list" : "mailto", page: location.pathname });
    if (SIGNUP_ENDPOINT) {
      const body = new FormData(); body.append(SIGNUP_FIELD, email);
      try { await fetch(SIGNUP_ENDPOINT, { method: "POST", mode: "no-cors", body }); msg.textContent = "You're on the list. One email per new insight, nothing else."; form.reset(); }
      catch { msg.textContent = "Couldn't reach the list just now — try again, or email tom@goalbound.co."; }
      return;
    }
    location.href = `mailto:tom@goalbound.co?subject=${encodeURIComponent("Subscribe me to Goalbound Insights")}&body=${encodeURIComponent(`Please add ${email} to the Goalbound Insights list.`)}`;
    msg.textContent = "Your mail app should open with the request filled in — just press send.";
  });
}

// ---- Query engine ---------------------------------------------------------------
// Same DuckDB-WASM build and data location as the explorer pages, so an article's
// numbers are always the site's current numbers. ?data=<url> points it elsewhere.
export const DATA_BASE = new URL((new URLSearchParams(location.search).get("data") || "/data"), location.origin).href.replace(/\/$/, "");
let conn;
export async function engine(views) {
  if (!conn) {
    // Loaded on demand so pages without figures (the index) never fetch it.
    const duckdb = await import("https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.29.0/+esm");
    const bundle = await duckdb.selectBundle(duckdb.getJsDelivrBundles());
    const worker = new Worker(URL.createObjectURL(new Blob([`importScripts("${bundle.mainWorker}");`], { type: "text/javascript" })));
    const db = new duckdb.AsyncDuckDB(new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING), worker);
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
    conn = await db.connect();
  }
  for (const [name, file] of Object.entries(views))
    await conn.query(`create or replace view ${name} as select * from read_parquet('${DATA_BASE}/${file}.parquet')`);
  return async sql => (await conn.query(sql)).toArray()
    .map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === "bigint" ? Number(v) : v])));
}

export async function dataDate() {
  try { return (await (await fetch(`${DATA_BASE}/_manifest.json`)).json()).generated_at.slice(0, 10); } catch { return null; }
}

// ---- Hover tooltip ----------------------------------------------------------------
// Rows carry their tooltip in data-tip; one floating element serves the page.
const tip = Object.assign(document.createElement("div"), { className: "tip", hidden: true });
document.body.append(tip);
export function tooltips(root) {
  root.addEventListener("pointermove", e => {
    const tr = e.target.closest("[data-tip]");
    if (!tr) { tip.hidden = true; return; }
    tip.innerHTML = tr.dataset.tip; tip.hidden = false;
    const w = tip.offsetWidth, h = tip.offsetHeight;
    tip.style.left = Math.min(e.clientX + 14, innerWidth - w - 8) + "px";
    tip.style.top = (e.clientY + 16 + h > innerHeight ? e.clientY - h - 12 : e.clientY + 16) + "px";
  });
  root.addEventListener("pointerleave", () => tip.hidden = true);
}

export const fmt = n => Number(n).toLocaleString("en-US");
export const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// ---- Shared tables -------------------------------------------------------------------
// `homes` from the hometowns export, and optionally `u` from under_recruited with a
// country_is_canada flag (that export has no country column). Until 2026-09-24 this
// also patched US towns the geocoder had put in Canada (Chatham, NJ in Ontario and
// others); the export now fixes those at source (publish/export.py, fix_geocodes).
export async function baseTables(q, { hometowns = "homes_raw", underRecruited } = {}) {
  await q(`create or replace table homes as select * from ${hometowns}`);
  if (underRecruited) await q(`create or replace table u as
    select ur.*, coalesce(ur.state in (select distinct state from homes where country = 'Canada'), false) country_is_canada
    from ${underRecruited} ur`);
}
