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

async function contributionYear(year, today) {
  const from = year + "-01-01", end = year + "-12-31";
  const to = end < today ? end : today;
  const res = await fetch("https://github.com/users/NoltoxGit/contributions?from=" + from + "&to=" + to, {
    headers: { "User-Agent": "NoltoxGit-profile-streak", "Accept": "text/html" },
    signal: AbortSignal.timeout(15000)
  });
  if (!res.ok) throw new Error("GitHub calendar HTTP " + res.status + " for " + year);
  const dates = new Map(), values = new Map();
  const rewrite = new HTMLRewriter()
    .on("td[data-date][id]", {element(e) { dates.set(e.getAttribute("id"), e.getAttribute("data-date")); }})
    .on("tool-tip[for]", {
      element(e) { this.id = e.getAttribute("for"); this.value = ""; },
      text(t) {
        this.value += t.text;
        if (t.lastInTextNode) {
          const m = this.value.trim().match(/^(No|[0-9,]+) contributions? on /i);
          if (m) values.set(this.id, m[1].toLowerCase() === "no" ? 0 : Number(m[1].replaceAll(",", "")));
        }
      }
    });
  await rewrite.transform(res).text();
  const days = [...dates].filter(([id, date]) => date >= from && date <= to && values.has(id))
    .map(([id, date]) => ({date, count: values.get(id)}))
    .sort((a,b) => a.date.localeCompare(b.date));
  const expected = Math.round((Date.parse(to) - Date.parse(from)) / DAY) + 1;
  if (days.length !== expected || days[0]?.date !== from || days.at(-1)?.date !== to ||
      days.some((d,i) => i && Date.parse(d.date) - Date.parse(days[i-1].date) !== DAY)) {
    throw new Error("Incomplete contribution calendar for " + year);
  }
  return days;
}

function streakStats(days, today) {
  let total = 0, run = 0, start = null, best = {count: 0}, last = null, first = null;
  for (const d of days) {
    total += d.count;
    if (d.count > 0) {
      if (run === 0) start = d.date;
      run++;
      first ??= d.date;
      last = {count:run, start, end:d.date};
      if (run > best.count) best = last;
    } else { run = 0; }
  }
  const current = last && Date.parse(today) - Date.parse(last.end) <= DAY ? last : {count:0};
  return {total, current, best, first};
}

function renderStreak(stats) {
  const date = s => s ? s.slice(0,10) : "—";
  const period = run => run.count ? date(run.start) + " – " + date(run.end) : "—";
  const total = stats.total.toLocaleString("en-US");
  const current = stats.current.count, longest = stats.best.count;
  return `<svg xmlns="${NS}" width="495" height="195" viewBox="0 0 495 195" role="img" aria-labelledby="title desc">
<title id="title">GitHub contribution streak</title><desc id="desc">${total} total contributions; current streak ${current} days; longest streak ${longest} days. Data from GitHub's public contribution calendar.</desc>
<rect width="495" height="195" rx="5" fill="#1a1b27"/>
<g text-anchor="middle" font-family="Arial, sans-serif">
<path d="M165 40v115 M330 40v115" stroke="#414868"/>
<text x="82" y="75" font-size="27" font-weight="bold" fill="#c0caf5">${total}</text>
<text x="82" y="105" font-size="13" fill="#70a5fd">Total Contributions</text>
<text x="82" y="131" font-size="11" fill="#a9b1d6">${date(stats.first)} – Present</text>
<circle cx="247" cy="70" r="38" stroke="#7aa2f7" stroke-width="4" fill="none"/>
<text x="247" y="79" font-size="27" font-weight="bold" fill="#c0caf5">${current}</text>
<text x="247" y="132" font-size="13" fill="#70a5fd">Current Streak</text>
<text x="247" y="153" font-size="11" fill="#a9b1d6">${period(stats.current)}</text>
<text x="412" y="75" font-size="27" font-weight="bold" fill="#c0caf5">${longest}</text>
<text x="412" y="105" font-size="13" fill="#70a5fd">Longest Streak</text>
<text x="412" y="131" font-size="11" fill="#a9b1d6">${period(stats.best)}</text>
</g></svg>`;
}

async function generateStreak() {
  const today = new Date().toISOString().slice(0,10);
  const currentYear = Number(today.slice(0,4));
  const years = Array.from({length:currentYear - 2020 + 1}, (_,i) => 2020 + i);
  const all = (await Promise.all(years.map(year => contributionYear(year, today)))).flat();
  return renderStreak(streakStats(all, today));
}

export default {
  async fetch(request, env, ctx) {
    const path = new URL(request.url).pathname;
    if (path !== "/activity.svg" && path !== "/streak.svg") return new Response("Not found", { status: 404 });
    const key = path === "/activity.svg" ? cacheKey : new Request("https://profile-cards.invalid/streak-v1");
    const cache = caches.default;
    const saved = await cache.match(key);
    if (saved && Date.now() - Number(saved.headers.get("X-Generated-At")) < 3600000) { const out = new Response(saved.body, saved); out.headers.set("Cache-Control", "public, max-age=3600"); return out; }
    try {
      const svg = path === "/activity.svg" ? await generate() : await generateStreak();
      const result = new Response(svg, {headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "public, max-age=604800",
        "X-Content-Type-Options": "nosniff",
        "X-Generated-At": String(Date.now())
      }});
      ctx.waitUntil(cache.put(key, result.clone()));
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
