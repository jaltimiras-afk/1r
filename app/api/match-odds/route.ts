// app/api/match-odds/route.ts
export const dynamic = "force-dynamic";

// --- Aliases (només els més típics; el matching tolerant ja fa la resta) ---
const TEAM_ALIASES: Record<string, string> = {
  // Spain
  "real madrid cf": "real madrid",
  "real madrid club de futbol": "real madrid",
  "fc barcelona": "barcelona",
  "athletic club": "athletic bilbao",
  "rc celta": "celta vigo",
  "real club celta de vigo": "celta de vigo",
  "atletico de madrid": "atletico madrid",
  "club atletico de madrid": "atletico madrid",
  "real betis balompie": "real betis",
  "deportivo alaves": "alaves",
  "rcd espanyol de barcelona": "espanyol",
  "rcd mallorca": "mallorca",
  "ud las palmas": "las palmas",
  "real sociedad de futbol": "real sociedad",

  // England
  "manchester united fc": "manchester united",
  "manchester city fc": "manchester city",
  "tottenham hotspur fc": "tottenham",
  "wolverhampton wanderers fc": "wolves",
  "newcastle united fc": "newcastle",

  // Italy
  "fc internazionale milano": "inter",
  "internazionale": "inter",
  "juventus fc": "juventus",
  "ac milan": "milan",

  // Germany
  "fc bayern munchen": "bayern munich",
  "borussia dortmund": "dortmund",

  // France
  "paris saint germain fc": "psg",
  "paris saint germain": "psg",
};

// --- Normalització robusta ---
function norm(s: string) {
  let t = (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // treu accents
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

// --- Odds utils ---
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

const OUTLIER_THRESHOLD_PCT_POINTS = 7;

type OddsRow = { bookmaker: string; home?: number; draw?: number; away?: number };

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

// --- Fetch The Odds API ---
async function oddsApi(path: string, key: string) {
  const r = await fetch(
    `https://api.the-odds-api.com/v4${path}${path.includes("?") ? "&" : "?"}apiKey=${key}`,
    { cache: "no-store" }
  );
  const json = await r.json();
  return { ok: r.ok, status: r.status, json };
}

async function resolveSportKey(oddsKey: string, keywords: string[], fallbackKey: string) {
  // keywords: ["la liga","spain"] etc.
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

export async function GET(req: Request) {
  const oddsKey = process.env.ODDS_API_KEY;
  if (!oddsKey) return Response.json({ error: "Falta ODDS_API_KEY" }, { status: 500 });

  const { searchParams } = new URL(req.url);

  const home = searchParams.get("home") || "";
  const away = searchParams.get("away") || "";
  const utcDate = searchParams.get("utcDate") || "";

  const keywords = (searchParams.get("keywords") || "")
    .split("|")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const fallbackKey = searchParams.get("fallbackKey") || "";

  if (!home || !away || !utcDate || keywords.length === 0 || !fallbackKey) {
    return Response.json(
      { error: "Falten paràmetres (home, away, utcDate, keywords, fallbackKey)" },
      { status: 400 }
    );
  }

  const sportKey = await resolveSportKey(oddsKey, keywords, fallbackKey);

  // Agafem odds per la lliga sencera, i després matxem el partit (per nom + temps)
  const odds = await oddsApi(`/sports/${sportKey}/odds?regions=eu,uk&markets=h2h&oddsFormat=decimal`, oddsKey);

  if (!odds.ok || !Array.isArray(odds.json)) {
    return Response.json(
      { error: "Error odds api", status: odds.status, body: odds.json },
      { status: 500 }
    );
  }

  const events = odds.json as any[];

  // ----- MATCHING TOLERANT -----
  const targetTime = new Date(utcDate).getTime();

  const homeTokens = tokenSet(home);
  const awayTokens = tokenSet(away);

  let bestEvent: any = null;
  let bestScore = -Infinity;

  for (const e of events) {
    const diffMs = Math.abs(new Date(e.commence_time).getTime() - targetTime);

    // descartem massa lluny (48h)
    if (diffMs > 48 * 60 * 60 * 1000) continue;

    const ehTokens = tokenSet(e.home_team);
    const eaTokens = tokenSet(e.away_team);

    // direct home->home, away->away
    const sHome = jaccard(homeTokens, ehTokens);
    const sAway = jaccard(awayTokens, eaTokens);
    const direct = (sHome + sAway) / 2;

    // inverted (si l’API ve invertida)
    const sHomeInv = jaccard(homeTokens, eaTokens);
    const sAwayInv = jaccard(awayTokens, ehTokens);
    const inverted = (sHomeInv + sAwayInv) / 2;

    const nameScore = Math.max(direct, inverted);

    // penalitza una mica si la data s’allunya (0..1)
    const timePenalty = diffMs / (48 * 60 * 60 * 1000);
    const score = nameScore - 0.15 * timePenalty;

    if (score > bestScore) {
      bestScore = score;
      bestEvent = e;
    }
  }

  // llindar perquè no “inventi” un match
  if (!bestEvent || bestScore < 0.55) {
    return Response.json({ found: false, rows: [], reason: "No match confident", bestScore });
  }

  // ----- EXTREURE 1X2 -----
  const rows: OddsRow[] = [];

  for (const bm of bestEvent.bookmakers || []) {
    const market = (bm.markets || []).find((m: any) => m.key === "h2h");
    if (!market) continue;

    const row: OddsRow = { bookmaker: bm.title };

    for (const o of market.outcomes || []) {
      const price = Number(o.price);
      if (!Number.isFinite(price)) continue;

      // outcomes: equip local, equip visitant, Draw
      if (norm(o.name) === norm(bestEvent.home_team)) row.home = price;
      else if (norm(o.name) === norm(bestEvent.away_team)) row.away = price;
      else if (String(o.name || "").toLowerCase() === "draw") row.draw = price;
    }

    rows.push(row);
  }

  // dedup bookmaker
  const uniq = new Map<string, OddsRow>();
  for (const r of rows) if (!uniq.has(r.bookmaker)) uniq.set(r.bookmaker, r);
  const cleanRows = Array.from(uniq.values());

  if (cleanRows.length === 0) {
    return Response.json({ found: false, rows: [], reason: "No bookmakers/markets" });
  }

  const best = bestByOutcome(cleanRows);
  const arbitrage = calcArb(best);

  // consens i outliers amb % implícit
  const homeP = cleanRows.map((r) => impliedPct(r.home)).filter((x): x is number => x != null);
  const drawP = cleanRows.map((r) => impliedPct(r.draw)).filter((x): x is number => x != null);
  const awayP = cleanRows.map((r) => impliedPct(r.away)).filter((x): x is number => x != null);

  const medHome = median(homeP);
  const medDraw = median(drawP);
  const medAway = median(awayP);

  const annotated = cleanRows.map((r) => {
    const ph = impliedPct(r.home);
    const pd = impliedPct(r.draw);
    const pa = impliedPct(r.away);

    return {
      ...r,
      implied: { home: ph, draw: pd, away: pa },
      outlier: {
        home: ph != null && medHome != null && Math.abs(ph - medHome) >= OUTLIER_THRESHOLD_PCT_POINTS,
        draw: pd != null && medDraw != null && Math.abs(pd - medDraw) >= OUTLIER_THRESHOLD_PCT_POINTS,
        away: pa != null && medAway != null && Math.abs(pa - medAway) >= OUTLIER_THRESHOLD_PCT_POINTS,
      },
    };
  });

  return Response.json({
    found: true,
    bestScore,
    best,
    arbitrage,
    consensus: { medHome, medDraw, medAway, threshold: OUTLIER_THRESHOLD_PCT_POINTS },
    rows: annotated,
  });
}