#!/usr/bin/env python3
"""Render the last 31 contribution days as a Tokyo Night SVG."""
import datetime as dt
import json
import os
import pathlib
import urllib.request
import xml.etree.ElementTree as ET

query = """query($login: String!) {
  user(login: $login) {
    contributionsCollection {
      contributionCalendar { weeks { contributionDays { date contributionCount } } }
    }
  }
}"""
req = urllib.request.Request(
    "https://api.github.com/graphql",
    data=json.dumps({"query": query, "variables": {"login": "NoltoxGit"}}).encode(),
    headers={"Authorization": "Bearer " + os.environ["GITHUB_TOKEN"],
             "Content-Type": "application/json", "User-Agent": "NoltoxGit-profile"},
)
with urllib.request.urlopen(req, timeout=30) as response:
    result = json.load(response)
if result.get("errors"):
    raise RuntimeError("GraphQL errors: " + json.dumps(result["errors"]))
weeks = result["data"]["user"]["contributionsCollection"]["contributionCalendar"]["weeks"]
today = dt.datetime.now(dt.timezone.utc).date()
days = sorted((dt.date.fromisoformat(d["date"]), d["contributionCount"])
              for week in weeks for d in week["contributionDays"]
              if dt.date.fromisoformat(d["date"]) <= today)[-31:]
if len(days) != 31 or any(days[i][0] - days[i-1][0] != dt.timedelta(days=1) for i in range(1, 31)):
    raise RuntimeError("Incomplete contribution calendar")
width, height = 900, 300
left, right, top, bottom = 55, 875, 65, 245
maximum = max(1, max(count for _, count in days))
points = [(left + i * (right-left) / 30, bottom - count / maximum * (bottom-top))
          for i, (_, count) in enumerate(days)]
coords = " ".join(f"{x:.1f},{y:.1f}" for x, y in points)
circles = "".join(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="3.5" fill="#7aa2f7"><title>{date.isoformat()}: {count} contributions</title></circle>'
                  for (x, y), (date, count) in zip(points, days))
labels = "".join(f'<text x="{points[i][0]:.1f}" y="273" text-anchor="middle" fill="#a9b1d6" font-size="12">{days[i][0].strftime("%d %b")}</text>'
                 for i in (0, 10, 20, 30))
svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img" aria-labelledby="title desc">
<title id="title">Contribution activity</title><desc id="desc">Daily GitHub contributions over the last 31 days.</desc>
<rect width="900" height="300" rx="8" fill="#1a1b27"/>
<text x="35" y="37" fill="#70a5fd" font-family="sans-serif" font-weight="bold" font-size="21">Contribution activity · last 31 days</text>
<g font-family="sans-serif"><path d="M {left} {bottom} H {right}" stroke="#414868" fill="none"/>
<text x="45" y="{top+4}" text-anchor="end" fill="#a9b1d6" font-size="12">{maximum}</text>
<text x="45" y="{bottom+4}" text-anchor="end" fill="#a9b1d6" font-size="12">0</text>
<polyline points="{coords}" fill="none" stroke="#7aa2f7" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>{circles}{labels}</g></svg>"""
ET.fromstring(svg)
path = pathlib.Path(os.environ["OUTPUT_PATH"])
path.parent.mkdir(parents=True, exist_ok=True)
path.write_text(svg, encoding="utf-8")
