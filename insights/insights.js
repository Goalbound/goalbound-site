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

// ---- Known geocoding errors ---------------------------------------------------------
// Hometown strings the pipeline geocoded to the wrong country, found 2026-09-24 while
// checking the Canada article: 478 player-season rows of US towns labelled Canadian,
// 409 of them Chatham, New Jersey placed in Ontario. The real fix belongs in the
// pipeline's geocoder (and then the explorer pages pick it up); until then, article
// figures route their data through fixedTables() so they don't repeat the error.
// Remove an entry here once the export gets it right.
export const GEO_FIXES = [
  ["chatham, new jersey", "New Jersey"], ["westlake, ohio", "Ohio"],
  ["milton, de", "Delaware"], ["milton, delaware", "Delaware"], ["glengary, w.va", "West Virginia"],
  ["vista, ca", "California"], ["whitewood, s.d", "South Dakota"],
];
const FIXES = `(values ${GEO_FIXES.map(([h, s]) => `('${h}', '${s}')`).join(", ")}) f(hs, st)`;

// Builds corrected tables `homes` (from a hometowns view) and, if given, `u` (from an
// under_recruited view, with a country_is_canada flag — that export has no country).
export async function fixedTables(q, { hometowns = "homes_raw", underRecruited } = {}) {
  await q(`create or replace table homes as
    select h.* replace (coalesce(f.st, h.state) as state, case when f.st is null then h.country else 'United States' end as country)
    from ${hometowns} h left join ${FIXES} on f.hs = lower(h.hometown_str)`);
  if (underRecruited) await q(`create or replace table u as
    select ur.* replace (coalesce(f.st, ur.state) as state),
           coalesce(coalesce(f.st, ur.state) in (select distinct state from homes where country = 'Canada'), false) country_is_canada
    from ${underRecruited} ur left join ${FIXES} on f.hs = lower(ur.hometown)`);
}
