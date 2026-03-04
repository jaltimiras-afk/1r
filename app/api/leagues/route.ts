// app/api/leagues/route.ts
export const dynamic = "force-dynamic";

export async function GET() {
  const leagues = [
    {
      id: "epl",
      name: "Premier League (Anglaterra)",
      footballDataCode: "PL",
      oddsKeywords: ["premier league", "england"],
      oddsFallbackKey: "soccer_epl",
    },
    {
      id: "laliga",
      name: "LaLiga (Espanya)",
      footballDataCode: "PD",
      oddsKeywords: ["la liga", "spain"],
      oddsFallbackKey: "soccer_spain_la_liga",
    },
    {
      id: "seriea",
      name: "Serie A (Itàlia)",
      footballDataCode: "SA",
      oddsKeywords: ["serie a", "italy"],
      oddsFallbackKey: "soccer_italy_serie_a",
    },
    {
      id: "bundesliga",
      name: "Bundesliga (Alemanya)",
      footballDataCode: "BL1",
      oddsKeywords: ["bundesliga", "germany"],
      oddsFallbackKey: "soccer_germany_bundesliga",
    },
    {
      id: "ligue1",
      name: "Ligue 1 (França)",
      footballDataCode: "FL1",
      oddsKeywords: ["ligue 1", "france"],
      oddsFallbackKey: "soccer_france_ligue_one",
    },
  ];

  return Response.json({ leagues });
}