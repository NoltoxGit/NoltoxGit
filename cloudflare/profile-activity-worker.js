// Public contribution graph for NoltoxGit. No GitHub token is required.
const NS = "http://www.w3.org/2000/svg";
const cacheKey = new Request("https://profile-cards.invalid/activity-v1");
const DAY = 86400000;

async function generate() {
  const response = await fetch("https://github.com/users/NoltoxGit/contributions", {
    headers: { "User-Agent": "NoltoxGit-profile-graph", "Accept": "text/html" },
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error("GitHub returned HTTP " + response.status);
  const dates = new Map(), counts = new Map();
  const tooltips = new Map();
  const rewrite = new HTMLRewriter()
    .on("td[data-date][id]", { element(e) { dates.set(e.getAttribute("id"), e.getAttribute("data-date")); } })
    .on("tool-tip[for]", {
      element(e) { this.id = e.getAttribute("for"); this.value = ""; },
      text(t) {
        this.value += t.text;
        if (t.lastInTextNode) {
          const m = this.value.trim().match(/^(No|[0-9,]+) contributions? on /i);
          if (m) tooltips.set(this.id, m[1].toLowerCase() === "no" ? 0 : Number(m[1].replaceAll(",", "")));
        }
      }
    });
  await rewrite.transform(response).text();
  const today = new Date().toISOString().slice(0, 10);
  const days = [...dates].filter(([id, date]) => date <= today && tooltips.has(id))
    .map(([id, date]) => ({ date, count: tooltips.get(id) }))
    .sort((a,b) => a.date.localeCompare(b.date)).slice(-31);
  if (days.length !== 31 || Date.parse(today) - Date.parse(days[30].date) > DAY ||
      days.some((d, i) => i && Date.parse(d.date) - Date.parse(days[i-1].date) !== DAY)) {
    throw new Error("Incomplete contribution calendar");
  }
  const max = Math.max(1, ...days.map(d => d.count));
  const points = days.map((d,i) => ({...d, x: 55 + i * 820 / 30, y: 245 - d.count / max * 180}));
  const coords = points.map(p => p.x.toFixed(1)+","+p.y.toFixed(1)).join(" ");
  const circles = points.map(p => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.5" fill="#7aa2f7"><title>${p.date}: ${p.count} contributions</title></circle>`).join("");
  const labels = [0,10,20,30].map(i => `<text x="${points[i].x.toFixed(1)}" y="273" text-anchor="middle" fill="#a9b1d6" font-size="12">${points[i].date.slice(5)}</text>`).join("");
  return `<svg xmlns="${NS}" width="900" height="300" viewBox="0 0 900 300" role="img" aria-labelledby="title desc"><title id="title">GitHub contribution activity</title><desc id="desc">Daily GitHub contributions for NoltoxGit over the last 31 days.</desc><rect width="900" height="300" rx="8" fill="#1a1b27"/><g font-family="sans-serif"><text x="35" y="37" fill="#70a5fd" font-weight="bold" font-size="21">Contribution activity · last 31 days</text><path d="M 55 245 H 875" stroke="#414868" fill="none"/><text x="45" y="69" text-anchor="end" fill="#a9b1d6" font-size="12">${max}</text><text x="45" y="249" text-anchor="end" fill="#a9b1d6" font-size="12">0</text><polyline points="${coords}" fill="none" stroke="#7aa2f7" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>${circles}${labels}</g></svg>`;
}
export default {
  async fetch(request, env, ctx) {
    if (new URL(request.url).pathname !== "/activity.svg") return new Response("Not found", { status: 404 });
    const cache = caches.default;
    const saved = await cache.match(cacheKey);
    if (saved && Date.now() - Number(saved.headers.get("X-Generated-At")) < 3600000) { const out = new Response(saved.body, saved); out.headers.set("Cache-Control", "public, max-age=3600"); return out; }
    try {
      const svg = await generate();
      const result = new Response(svg, {headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "public, max-age=604800",
        "X-Content-Type-Options": "nosniff",
        "X-Generated-At": String(Date.now())
      }});
      ctx.waitUntil(cache.put(cacheKey, result.clone()));
      const out = new Response(result.body, result);
      out.headers.set("Cache-Control", "public, max-age=3600");
      return out;
    } catch (error) {
      console.error(JSON.stringify({event:"activity_generation_failed", message:String(error)}));
      if (saved) { const out = new Response(saved.body, saved); out.headers.set("Cache-Control", "public, max-age=300"); return out; }
      return new Response("Contribution graph temporarily unavailable", {status:503, headers:{"Cache-Control":"no-store"}});
    }
  }
};
