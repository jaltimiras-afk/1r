export default function Page() {
  return (
    <div style={{ padding: 40 }}>
      <h1>Test Vercel</h1>
      <p>FOOTBALL_DATA_KEY: {process.env.FOOTBALL_DATA_KEY ? "OK" : "NO"}</p>
      <p>ODDS_API_KEY: {process.env.ODDS_API_KEY ? "OK" : "NO"}</p>
    </div>
  );
}