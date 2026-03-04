// app/api/fixtures/route.ts
export const dynamic = "force-dynamic";

function ymd(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export async function GET(req: Request) {
  const token = process.env.FOOTBALL_DATA_KEY;
  if (!token) return Response.json({ error: "Falta FOOTBALL_DATA_KEY" }, { status: 500 });

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code"); // PL, PD, SA, BL1, FL1
  const days = Number(searchParams.get("days") ?? "7");

  if (!code) return Response.json({ error: "Falta code" }, { status: 400 });

  const from = new Date();
  const to = new Date();
  to.setDate(to.getDate() + Math.max(1, Math.min(30, days)));

  const url = `https://api.football-data.org/v4/competitions/${code}/matches?dateFrom=${ymd(from)}&dateTo=${ymd(to)}`;

  const r = await fetch(url, {
    headers: { "X-Auth-Token": token },
    cache: "no-store",
  });

  const json = await r.json();
  if (!r.ok) return Response.json({ error: "Error football-data", status: r.status, body: json }, { status: 500 });

  const matches = (json.matches || [])
    .filter((m: any) => m.status === "SCHEDULED" || m.status === "TIMED") // només no començats
    .sort((a: any, b: any) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime())
    .map((m: any) => ({
      id: m.id,
      utcDate: m.utcDate,
      status: m.status,
      home: { id: m.homeTeam?.id, name: m.homeTeam?.name },
      away: { id: m.awayTeam?.id, name: m.awayTeam?.name },
      matchday: m.matchday,
    }));

  return Response.json({ code, from: ymd(from), to: ymd(to), matches });
}