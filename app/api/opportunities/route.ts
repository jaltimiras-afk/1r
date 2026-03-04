// app/api/opportunities/route.ts
export const dynamic = "force-dynamic";

// --- Normalització + aliases (mateix estil que match-odds) ---
const TEAM_ALIASES: Record<string, string> = {
  "real madrid cf": "real madrid",
  "real madrid club de futbol": "real madrid",
  "fc barcelona": "barcelona",
  "athletic club": "athletic bilbao",
  "rc celta": "celta vigo",
  "real club celta de vigo": "celta vigo",
  "atletico de madrid": "atletico madrid",
  "club atletico de madrid": "atletico madrid",
  "real betis balompie": "real betis",
  "deportivo alaves": "alaves",
  "rcd espanyol de barcelona": "espanyol",
  "rcd mallorca": "mallorca",
  "ud las palmas": "las palmas",
  "real sociedad de futbol": "real sociedad",
  "manchester united fc": "manchester united",
  "manchester city fc": "manchester city",
  "tottenham hotspur fc": "tottenham",
  "wolverhampton wanderers fc": "wolves",
  "newcastle united fc": "newcastle",
  "fc internazionale milano": "inter",
  "internazionale": "inter",
  "juventus fc": "juventus",
  "ac milan": "milan",
  "fc bayern munchen": "bayern munich",
  "borussia dortmund": "dortmund",
  "paris saint germain fc": "psg",
  "paris saint germain": "psg",
};

function norm(s: string) {
  let t = (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(fc|cf|ud|cd|rcd|rc|ac|ssc|calcio|club|deportivo)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (TEAM_ALIASES[t]) t = TEAM_ALIASES[t];
  return t;
}

function tokenSet(s: string) {
  return new Set(norm(s).split(" ").filter(Boolean));
}

function jaccard(a: Set<string>, b: Set<string>) {
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function ymd(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// --- Odds math ---
type OddsRow = { bookmaker: string; home?: number; draw?: number; away?: number };

function impliedPct(odd?: number) {
  if (!odd || !Number.isFinite(odd) || odd <= 0) return null;
  return 100 / odd;
}

function median(nums: number[]) {
  if (nums.length === 0) return null;
  const a = [...nums].sort((x, y) => x - y);
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
}

function bestByOutcome(rows: OddsRow[]) {
  let home: number | null = null;
  let draw: number | null = null;
  let away: number | null = null;

  for (const r of rows) {
    if (typeof r.home === "number") home = home == null ? r.home : Math.max(home, r.home);
    if (typeof r.draw === "number") draw = draw == null ? r.draw : Math.max(draw, r.draw);
    if (typeof r.away === "number") away = away == null ? r.away : Math.max(away, r.away);
  }
  return { home, draw, away };
}

function calcArb(best: { home: number | null; draw: number | null; away: number | null }) {
  if (!best.home || !best.draw || !best.away) return null;
  const s = 1 / best.home + 1 / best.draw + 1 / best.away;
  if (!Number.isFinite(s)) return null;
  if (s < 1) return { sumInv: s, edgePct: (1 - s) * 100 };
  return null;
}

const OUTLIER_THRESHOLD_PCT_POINTS = 7;

function outlierCount(rows: OddsRow[]) {
  const homeP = rows.map((r) => impliedPct(r.home)).filter((x): x is number => x != null);
  const drawP = rows.map((r) => impliedPct(r.draw)).filter((x): x is number => x != null);
  const awayP = rows.map((r) => impliedPct(r.away)).filter((x): x is number => x != null);

  const medHome = median(homeP);
  const medDraw = median(drawP);
  const medAway = median(awayP);

  let count = 0;
  for (const r of rows) {
    const ph = impliedPct(r.home);
    const pd = impliedPct(r.draw);
    const pa = impliedPct(r.away);

    if (ph != null && medHome != null && Math.abs(ph - medHome) >= OUTLIER_THRESHOLD_PCT_POINTS) count++;
    if (pd != null && medDraw != null && Math.abs(pd - medDraw) >= OUTLIER_THRESHOLD_PCT_POINTS) count++;
    if (pa != null && medAway != null && Math.abs(pa - medAway) >= OUTLIER_THRESHOLD_PCT_POINTS) count++;
  }
  return count;
}

// --- Fetch helpers ---
async function oddsApi(path: string, key: string) {
  const r = await fetch(
    `https://api.the-odds-api.com/v4${path}${path.includes("?") ? "&" : "?"}apiKey=${key}`,
    { cache: "no-store" }
  );
  const json = await r.json();
  return { ok: r.ok, status: r.status, json };
}

async function resolveSportKey(oddsKey: string, keywords: string[], fallbackKey: string) {
  const sports = await oddsApi("/sports", oddsKey);
  if (sports.ok && Array.isArray(sports.json)) {
    const wanted = (sports.json as any[]).find((s) => {
      const title = String(s?.title || "").toLowerCase();
      return keywords.every((k) => title.includes(k));
    });
    if (wanted?.key) return String(wanted.key);
  }
  return fallbackKey;
}

function extractRowsFromEvent(bestEvent: any): OddsRow[] {
  const rows: OddsRow[] = [];
  for (const bm of bestEvent.bookmakers || []) {
    const market = (bm.markets || []).find((m: any) => m.key === "h2h");
    if (!market) continue;

    const row: OddsRow = { bookmaker: bm.title };
    for (const o of market.outcomes || []) {
      const price = Number(o.price);
      if (!Number.isFinite(price)) continue;

      if (norm(o.name) === norm(bestEvent.home_team)) row.home = price;
      else if (norm(o.name) === norm(bestEvent.away_team)) row.away = price;
      else if (String(o.name || "").toLowerCase() === "draw") row.draw = price;
    }
    rows.push(row);
  }

  const uniq = new Map<string, OddsRow>();
  for (const r of rows) if (!uniq.has(r.bookmaker)) uniq.set(r.bookmaker, r);
  return Array.from(uniq.values());
}

function matchEventForFixture(fx: any, events: any[]) {
  const targetTime = new Date(fx.utcDate).getTime();

  const homeTokens = tokenSet(fx.home.name);
  const awayTokens = tokenSet(fx.away.name);

  let bestEvent: any = null;
  let bestScore = -Infinity;

  for (const e of events) {
    const diffMs = Math.abs(new Date(e.commence_time).getTime() - targetTime);
    if (diffMs > 48 * 60 * 60 * 1000) continue;

    const ehTokens = tokenSet(e.home_team);
    const eaTokens = tokenSet(e.away_team);

    const direct = (jaccard(homeTokens, ehTokens) + jaccard(awayTokens, eaTokens)) / 2;
    const inverted = (jaccard(homeTokens, eaTokens) + jaccard(awayTokens, ehTokens)) / 2;

    const nameScore = Math.max(direct, inverted);
    const timePenalty = diffMs / (48 * 60 * 60 * 1000);
    const score = nameScore - 0.15 * timePenalty;

    if (score > bestScore) {
      bestScore = score;
      bestEvent = e;
    }
  }

  if (!bestEvent || bestScore < 0.55) return null;
  return bestEvent;
}

export async function GET(req: Request) {
  const footballToken = process.env.FOOTBALL_DATA_KEY;
  const oddsKey = process.env.ODDS_API_KEY;

  if (!footballToken) return Response.json({ error: "Falta FOOTBALL_DATA_KEY" }, { status: 500 });
  if (!oddsKey) return Response.json({ error: "Falta ODDS_API_KEY" }, { status: 500 });

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code") || "";
  const days = Math.max(1, Math.min(14, Number(searchParams.get("days") ?? "7")));
  const keywords = (searchParams.get("keywords") || "")
    .split("|")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const fallbackKey = searchParams.get("fallbackKey") || "";

  if (!code || keywords.length === 0 || !fallbackKey) {
    return Response.json({ error: "Falten paràmetres (code, keywords, fallbackKey)" }, { status: 400 });
  }

  // 1) Fixtures (football-data) pels pròxims dies
  const from = new Date();
  const to = new Date();
  to.setDate(to.getDate() + days);

  const fixturesUrl = `https://api.football-data.org/v4/competitions/${code}/matches?dateFrom=${ymd(from)}&dateTo=${ymd(to)}`;
  const fxRes = await fetch(fixturesUrl, {
    headers: { "X-Auth-Token": footballToken },
    cache: "no-store",
  });
  const fxJson = await fxRes.json();
  if (!fxRes.ok) {
    return Response.json({ error: "Error football-data", status: fxRes.status, body: fxJson }, { status: 500 });
  }

  const fixtures = (fxJson.matches || [])
    .filter((m: any) => m.status === "SCHEDULED" || m.status === "TIMED")
    .map((m: any) => ({
      id: m.id,
      utcDate: m.utcDate,
      home: { name: m.homeTeam?.name || "" },
      away: { name: m.awayTeam?.name || "" },
    }));

  // 2) Odds (The Odds API) de la lliga sencera (1 sola crida)
  const sportKey = await resolveSportKey(oddsKey, keywords, fallbackKey);
  const oddsRes = await oddsApi(`/sports/${sportKey}/odds?regions=eu,uk&markets=h2h&oddsFormat=decimal`, oddsKey);
  if (!oddsRes.ok || !Array.isArray(oddsRes.json)) {
    return Response.json({ error: "Error odds api", status: oddsRes.status, body: oddsRes.json }, { status: 500 });
  }
  const events = oddsRes.json as any[];

  // 3) Calcul d’oportunitats
  const opps: any[] = [];

  for (const fx of fixtures) {
    const ev = matchEventForFixture(fx, events);
    if (!ev) continue;

    const rows = extractRowsFromEvent(ev);
    if (!rows.length) continue;

    const best = bestByOutcome(rows);
    const arb = calcArb(best);
    const outs = outlierCount(rows);

    // només considerem oportunitat si hi ha arbitratge o outliers
    if (!arb && outs === 0) continue;

    opps.push({
      matchId: fx.id,
      utcDate: fx.utcDate,
      home: fx.home.name,
      away: fx.away.name,
      arbitrage: arb ? { edgePct: arb.edgePct } : null,
      outliers: outs,
      best,
    });
  }

  // Ordena: primer arbitratges (més edge), després outliers
  opps.sort((a, b) => {
    const aEdge = a.arbitrage?.edgePct ?? -1;
    const bEdge = b.arbitrage?.edgePct ?? -1;
    if (bEdge !== aEdge) return bEdge - aEdge;
    return (b.outliers ?? 0) - (a.outliers ?? 0);
  });

  return Response.json({
    code,
    days,
    count: opps.length,
    opportunities: opps.slice(0, 30),
  });
}