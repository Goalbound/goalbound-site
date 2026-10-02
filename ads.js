// Goalbound banner slots (2026-09-26). One file serves every page that carries a slot.
//
// A page opts in with one element and one script tag:
//   <aside class="gb-ad" data-slot="article-end">…fallback…</aside>
//   <script src="/ads.js" defer></script>
// Whatever is inside the <aside> shows if this script never runs.
//
// Rules, from the ads decision of 2026-09-24 (README, "Banner slots"):
//   - at most one banner per page, below the content, never above it or inside a
//     figure, table or map;
//   - always labelled: "Sponsor" when sold, "Advertisement" for a network ad,
//     "From Goalbound" when the slot promotes the site itself;
//   - none on the coach tools (town-yield, yield, elite-footprint, explore) — coaches
//     are the paying customers;
//   - paid links carry rel="sponsored", which Google requires of paid links.
//
// What fills a slot, in order: a sold sponsor booked for that slot and today's date;
// else an AdSense unit, if ADSENSE.client and a unit id for the slot are both set;
// else a house banner. With the config as shipped, every slot shows a house banner.
(() => {
  // ---- Sold sponsors ----------------------------------------------------------
  // Copy the example, fill it in, remove the slashes. `slots` lists where it runs
  // ("article-end", "insights-index", "hometown", "all-americans"); dates are
  // inclusive, local time. With an `img` it shows as an image banner (728×90 for
  // wide slots; `imgSmall` 320×100 for phones and the sidebar), otherwise as a
  // text banner built from `head`, `text` and `cta`. Creative files go in /ads/.
  const SPONSORS = [
    // { id: "acme-oct-2026", name: "Acme Lacrosse", href: "https://example.com/?utm_source=goalbound",
    //   slots: ["article-end", "hometown"], start: "2026-10-01", end: "2026-10-31",
    //   img: "/ads/acme-728x90.png", imgSmall: "/ads/acme-320x100.png",
    //   alt: "Acme Lacrosse fall showcase — register now",
    //   head: "Acme Fall Showcase", text: "Two days, 40 college coaches, Baltimore.", cta: "Register" },
  ];

  // ---- Ad network (off) ---------------------------------------------------------
  // Leave `client` empty unless the AdSense account is approved, /ads.txt is live and
  // a consent banner is in place for EEA/UK visitors (README, "Turning on AdSense").
  const ADSENSE = { client: "", units: { /* "article-end": "1234567890" */ } };

  // ---- House banners ------------------------------------------------------------
  // Shown when nothing is sold. A banner is skipped on the page it links to.
  const HOUSE = [
    { id: "house-sponsor", head: "Put your program in front of lacrosse families.",
      text: "One sponsor per page, clearly labelled. Camps, club teams, showcases and gear.",
      cta: "Advertise on Goalbound", href: "/advertise.html" },
    { id: "house-canada", head: "Canada is the most under-recruited source in men's college lacrosse.",
      text: "Per roster spot, Ontario produces more All-Americans than any US state.",
      cta: "Read the finding", href: "/insights/canada.html" },
    { id: "house-towns", head: "Massapequa or Islip? A town's record is mostly luck.",
      text: "Shuffle every player's hometown at random and the same patterns appear.",
      cta: "Read the finding", href: "/insights/town-records.html" },
    { id: "house-ohga", head: "The top 10 skip Ohio and Georgia. Their players hold their own.",
      text: "The best women's programs rarely recruit there — even compared with their neighbours.",
      cta: "Read the finding", href: "/insights/ohio-georgia.html" },
    { id: "house-hometown", head: "Where do players from your town end up?",
      text: "Every college lacrosse player from your hometown since 2015, and the programs that took them.",
      cta: "Look up your town", href: "/hometown.html", notOn: ["hometown"] },
  ];

  const LABEL = { sponsor: "Sponsor", network: "Advertisement", house: "From Goalbound" };

  const css = `
.gb-ad{margin:34px 0 0;border:1px solid var(--line,#222427);border-radius:6px;background:var(--panel,#101113);padding:12px 16px 14px;font-family:var(--body,"IBM Plex Sans",Arial,sans-serif);color:var(--ink,#f4f4f2)}
.gb-ad .gb-lbl,.gb-ad .lbl{display:block;font:500 9.5px/1 var(--mono,Menlo,monospace);letter-spacing:.14em;text-transform:uppercase;color:var(--dim,#55595e);margin:0 0 9px}
.gb-ad a.gb-txt{display:flex;gap:10px 18px;align-items:center;justify-content:space-between;flex-wrap:wrap;text-decoration:none;color:inherit}
.gb-ad .gb-head{font:700 20px/1.1 var(--display,"Barlow Condensed","Arial Narrow",sans-serif);letter-spacing:-.005em;text-wrap:balance}
.gb-ad .gb-sub{margin-top:4px;font-size:13.5px;line-height:1.45;color:var(--muted,#8b8f94)}
.gb-ad .gb-cta{font:600 12.5px var(--body,Arial,sans-serif);white-space:nowrap;border:1px solid var(--dim,#55595e);border-radius:4px;padding:7px 12px}
.gb-ad a.gb-txt:hover .gb-cta{border-color:var(--ink,#f4f4f2)}
.gb-ad a.gb-img{display:block;line-height:0}
.gb-ad a.gb-img img{width:100%;height:auto;max-width:728px;border-radius:3px}
.gb-ad ins{display:block}
.gb-ad.gb-narrow{margin-top:6px;padding:11px 13px 12px}
.gb-ad.gb-narrow .gb-head{font-size:17px}
.gb-ad.gb-narrow .gb-sub{font-size:12.5px}
@media (max-width:560px){.gb-ad .gb-head{font-size:18px}}
`;

  const today = new Date().toLocaleDateString("en-CA");   // YYYY-MM-DD, local
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const here = location.pathname.replace(/\/index\.html$/, "/");
  const track = (name, p) => { if (typeof gtag === "function") gtag("event", name, p); };

  function choose(slot) {
    const sold = SPONSORS.filter(s => s.slots?.includes(slot) && (!s.start || s.start <= today) && (!s.end || today <= s.end));
    if (sold.length) return { kind: "sponsor", ad: pick(sold) };
    if (ADSENSE.client && ADSENSE.units[slot]) return { kind: "network" };
    const house = HOUSE.filter(h => h.href !== here && !(h.notOn || []).includes(slot));
    return { kind: "house", ad: pick(house) };
  }

  function render(el) {
    const slot = el.dataset.slot;
    const { kind, ad } = choose(slot);
    const narrow = el.classList.contains("gb-narrow");
    const label = `<span class="gb-lbl">${LABEL[kind]}</span>`;

    if (kind === "network") {
      el.innerHTML = `${label}<ins class="adsbygoogle" data-ad-client="${esc(ADSENSE.client)}" data-ad-slot="${esc(ADSENSE.units[slot])}" data-ad-format="horizontal" data-full-width-responsive="true"></ins>`;
      if (!document.querySelector("script[src*='adsbygoogle.js']")) {
        const s = document.createElement("script");
        s.async = true; s.crossOrigin = "anonymous";
        s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(ADSENSE.client)}`;
        document.head.append(s);
      }
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      return;
    }

    const rel = kind === "sponsor" ? ' rel="sponsored noopener" target="_blank"' : "";
    let body;
    if (ad.img) {
      const small = ad.imgSmall ? `<source media="(max-width: 600px)" srcset="${esc(ad.imgSmall)}">` : "";
      const src = narrow && ad.imgSmall ? ad.imgSmall : ad.img;
      body = `<a class="gb-img" href="${esc(ad.href)}"${rel}><picture>${narrow ? "" : small}<img src="${esc(src)}" alt="${esc(ad.alt || ad.name)}" loading="lazy"></picture></a>`;
    } else {
      body = `<a class="gb-txt" href="${esc(ad.href)}"${rel}><span><span class="gb-head">${esc(ad.head)}</span>` +
        (ad.text ? `<span class="gb-sub" style="display:block">${esc(ad.text)}</span>` : "") +
        `</span><span class="gb-cta">${esc(ad.cta || "Learn more")}</span></a>`;
    }
    el.innerHTML = label + body;
    el.setAttribute("aria-label", LABEL[kind]);

    const params = { slot, creative: ad.id, kind, page: here };
    el.querySelector("a").addEventListener("click", () => track("banner_click", params));
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver(es => {
        if (es.some(e => e.isIntersecting)) { track("banner_view", params); io.disconnect(); }
      }, { threshold: 0.5 });
      io.observe(el);
    }
  }

  function init() {
    const slots = [...document.querySelectorAll(".gb-ad[data-slot]")];
    if (!slots.length) return;
    document.head.append(Object.assign(document.createElement("style"), { textContent: css }));
    slots.slice(0, 1).forEach(render);   // one banner per page, whatever the markup says
    slots.slice(1).forEach(el => el.remove());
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
