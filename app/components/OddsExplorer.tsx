"use client";

import { useEffect, useMemo, useState } from "react";

type League = {
  id: string;
  name: string;
  footballDataCode: string;
  oddsKeywords: string[];
  oddsFallbackKey: string;
};

type Match = {
  id: number;
  utcDate: string;
  status: string;
  home: { id: number; name: string };
  away: { id: number; name: string };
  matchday: number;
};

function Badge({
  children,
  tone = "neutral",
  title,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "success" | "danger" | "warning";
  title?: string;
}) {
  const bg =
    tone === "success"
      ? "rgba(16,185,129,.14)"
      : tone === "danger"
      ? "rgba(239,68,68,.14)"
      : tone === "warning"
      ? "rgba(245,158,11,.16)"
      : "rgba(148,163,184,.18)";

  const border =
    tone === "success"
      ? "rgba(16,185,129,.35)"
      : tone === "danger"
      ? "rgba(239,68,68,.35)"
      : tone === "warning"
      ? "rgba(245,158,11,.35)"
      : "rgba(148,163,184,.30)";

  const color =
    tone === "success"
      ? "rgb(5,150,105)"
      : tone === "danger"
      ? "rgb(220,38,38)"
      : tone === "warning"
      ? "rgb(217,119,6)"
      : "rgb(71,85,105)";

  return (
    <span
      title={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 999,
        background: bg,
        border: `1px solid ${border}`,
        color,
        fontWeight: 800,
        fontSize: 12,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,.92)",
        border: "1px solid rgba(148,163,184,.35)",
        borderRadius: 16,
        boxShadow: "0 12px 30px rgba(2,6,23,.06)",
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  );
}

function CardHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div
      style={{
        padding: "16px 18px",
        borderBottom: "1px solid rgba(148,163,184,.25)",
        background:
          "linear-gradient(135deg, rgba(99,102,241,.08), rgba(16,185,129,.06))",
      }}
    >
      <div style={{ fontSize: 16, fontWeight: 950, color: "rgb(15,23,42)" }}>
        {title}
      </div>
      {subtitle ? (
        <div style={{ marginTop: 4, fontSize: 12.5, color: "rgb(71,85,105)" }}>
          {subtitle}
        </div>
      ) : null}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 900, color: "rgb(71,85,105)" }}>
      {children}
    </div>
  );
}

function Select({
  value,
  onChange,
  children,
  disabled,
  width,
}: {
  value: any;
  onChange: (v: string) => void;
  children: React.ReactNode;
  disabled?: boolean;
  width?: number | string;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: width ?? "auto",
        marginTop: 6,
        padding: "10px 12px",
        borderRadius: 12,
        border: "1px solid rgba(148,163,184,.45)",
        background: disabled ? "rgba(241,245,249,.8)" : "white",
        color: "rgb(15,23,42)",
        outline: "none",
        boxShadow: "0 1px 0 rgba(2,6,23,.04)",
      }}
    >
      {children}
    </select>
  );
}

function Button({
  children,
  onClick,
  disabled,
  kind = "primary",
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  kind?: "primary" | "secondary";
}) {
  const bg =
    kind === "primary"
      ? "linear-gradient(135deg, rgba(99,102,241,.18), rgba(16,185,129,.14))"
      : "rgba(241,245,249,.85)";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "10px 12px",
        borderRadius: 12,
        border: "1px solid rgba(148,163,184,.45)",
        background: disabled ? "rgba(241,245,249,.8)" : bg,
        cursor: disabled ? "not-allowed" : "pointer",
        fontWeight: 900,
        color: "rgb(15,23,42)",
      }}
    >
      {children}
    </button>
  );
}

function fmtDateLocal(utc: string) {
  try {
    return new Date(utc).toLocaleString();
  } catch {
    return utc;
  }
}

export default function OddsExplorer() {
  // carreguem llistat lligues (únic)
  const [leagues, setLeagues] = useState<League[]>([]);
  const leaguesById = useMemo(
    () => new Map(leagues.map((l) => [l.id, l] as const)),
    [leagues]
  );

  // ------- QUADRAT 1: QUOTES PER PARTIT -------
  const [qLeagueId, setQLeagueId] = useState<string>(""); // "" = "-"
  const [qDays, setQDays] = useState<string>(""); // "" = "-"
  const [matches, setMatches] = useState<Match[]>([]);
  const [qMatchId, setQMatchId] = useState<string>(""); // "" = "-"
  const qLeague = qLeagueId ? leaguesById.get(qLeagueId) ?? null : null;

  const [loadingMatches, setLoadingMatches] = useState(false);
  const [loadingOdds, setLoadingOdds] = useState(false);
  const [odds, setOdds] = useState<any>(null);

  // errors separats per no barrejar
  const [qErr, setQErr] = useState<string>("");

  const selectedMatch = useMemo(() => {
    if (!qMatchId) return null;
    const id = Number(qMatchId);
    return matches.find((m) => m.id === id) || null;
  }, [qMatchId, matches]);

  // ------- QUADRAT 2: OPORTUNITATS -------
  const [oLeagueId, setOLeagueId] = useState<string>("");
  const [oDays, setODays] = useState<string>("");
  const oLeague = oLeagueId ? leaguesById.get(oLeagueId) ?? null : null;

  const [loadingOpps, setLoadingOpps] = useState(false);
  const [opps, setOpps] = useState<any[]>([]);
  const [oErr, setOErr] = useState<string>("");

  // init: carregar lligues, però NO seleccionar res
  useEffect(() => {
    (async () => {
      const r = await fetch("/api/leagues", { cache: "no-store" });
      const j = await r.json();
      setLeagues(j.leagues || []);
    })();
  }, []);

  // Quan canvies seleccions del QUADRAT 1, reseteja dependències
  useEffect(() => {
    setMatches([]);
    setQMatchId("");
    setOdds(null);
    setQErr("");
  }, [qLeagueId, qDays]);

  // Quan canvies seleccions del QUADRAT 2, reseteja resultats
  useEffect(() => {
    setOpps([]);
    setOErr("");
  }, [oLeagueId, oDays]);

  async function loadMatchesForQuoteBox() {
    setQErr("");
    setOdds(null);
    setQMatchId("");
    setMatches([]);

    if (!qLeague || !qDays) {
      setQErr("Selecciona Lliga i Dies abans de carregar partits.");
      return;
    }

    setLoadingMatches(true);
    try {
      const r = await fetch(
        `/api/fixtures?code=${qLeague.footballDataCode}&days=${Number(qDays)}`,
        { cache: "no-store" }
      );
      const j = await r.json();
      if (!r.ok) throw new Error(JSON.stringify(j, null, 2));
      setMatches(j.matches || []);
    } catch (e: any) {
      setQErr(String(e?.message || e));
    } finally {
      setLoadingMatches(false);
    }
  }

  async function searchOddsForSelectedMatch() {
    setQErr("");
    setOdds(null);

    if (!qLeague || !qDays || !selectedMatch) {
      setQErr("Selecciona Lliga, Dies i Partit abans de buscar quotes.");
      return;
    }

    setLoadingOdds(true);
    try {
      const keywords = qLeague.oddsKeywords.join("|");
      const url =
        `/api/match-odds?home=${encodeURIComponent(selectedMatch.home.name)}` +
        `&away=${encodeURIComponent(selectedMatch.away.name)}` +
        `&utcDate=${encodeURIComponent(selectedMatch.utcDate)}` +
        `&keywords=${encodeURIComponent(keywords)}` +
        `&fallbackKey=${encodeURIComponent(qLeague.oddsFallbackKey)}`;

      const r = await fetch(url, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(JSON.stringify(j, null, 2));
      setOdds(j);
    } catch (e: any) {
      setQErr(String(e?.message || e));
    } finally {
      setLoadingOdds(false);
    }
  }

  async function searchOpportunities() {
    setOErr("");
    setOpps([]);

    if (!oLeague || !oDays) {
      setOErr("Selecciona Lliga i Dies abans de buscar oportunitats.");
      return;
    }

    setLoadingOpps(true);
    try {
      const keywords = oLeague.oddsKeywords.join("|");
      const url =
        `/api/opportunities?code=${encodeURIComponent(oLeague.footballDataCode)}` +
        `&days=${encodeURIComponent(String(Number(oDays)))}` +
        `&keywords=${encodeURIComponent(keywords)}` +
        `&fallbackKey=${encodeURIComponent(oLeague.oddsFallbackKey)}`;

      const r = await fetch(url, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(JSON.stringify(j, null, 2));
      setOpps(j.opportunities || []);
    } catch (e: any) {
      setOErr(String(e?.message || e));
    } finally {
      setLoadingOpps(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(1200px 600px at 20% 0%, rgba(99,102,241,.18), transparent 60%), radial-gradient(900px 500px at 80% 10%, rgba(16,185,129,.14), transparent 55%), linear-gradient(180deg, rgba(241,245,249,.9), rgba(248,250,252,1))",
        padding: "28px 18px",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 14,
            flexWrap: "wrap",
            marginBottom: 18,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 26,
                fontWeight: 950,
                color: "rgb(15,23,42)",
                letterSpacing: -0.3,
              }}
            >
              Odds Explorer
            </div>
            <div style={{ marginTop: 6, color: "rgb(71,85,105)" }}>
              Comparador de quotes · % implícit · Outliers · Arbitratge
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <Badge tone="success">🟢 millor quota</Badge>
            <Badge tone="danger">🚨 outlier</Badge>
            <Badge tone="warning">💰 arbitratge</Badge>
          </div>
        </div>

        {/* QUADRAT 1 */}
        <Card>
          <CardHeader
            title="📌 Buscar quotes d’un partit"
            subtitle="Selecciona lliga, rang de dies i partit. Res es busca fins que cliquis els botons."
          />
          <div style={{ padding: 18, display: "grid", gap: 14 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(12, 1fr)",
                gap: 14,
              }}
            >
              <div style={{ gridColumn: "span 12", maxWidth: 520 }}>
                <FieldLabel>Lliga</FieldLabel>
                <Select value={qLeagueId} onChange={setQLeagueId} width="100%">
                  <option value="">-</option>
                  {leagues.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div style={{ gridColumn: "span 12", maxWidth: 220 }}>
                <FieldLabel>Rang de dies</FieldLabel>
                <Select value={qDays} onChange={setQDays} width="100%">
                  <option value="">-</option>
                  <option value="3">3 dies</option>
                  <option value="7">7 dies</option>
                  <option value="14">14 dies</option>
                </Select>
              </div>

              <div style={{ gridColumn: "span 12", display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Button
                  kind="secondary"
                  onClick={loadMatchesForQuoteBox}
                  disabled={!qLeagueId || !qDays || loadingMatches}
                >
                  {loadingMatches ? "Carregant partits…" : "Carregar partits"}
                </Button>

                <div style={{ flex: "1 1 520px" }}>
                  <FieldLabel>Partit</FieldLabel>
                  <Select
                    value={qMatchId}
                    onChange={setQMatchId}
                    disabled={matches.length === 0}
                    width="100%"
                  >
                    <option value="">-</option>
                    {matches.map((m) => (
                      <option key={m.id} value={String(m.id)}>
                        {fmtDateLocal(m.utcDate)} — {m.home.name} vs {m.away.name}
                      </option>
                    ))}
                  </Select>
                  <div style={{ marginTop: 8, color: "rgb(100,116,139)", fontSize: 12.5 }}>
                    {matches.length ? `${matches.length} partits carregats` : "Encara no has carregat partits."}
                  </div>
                </div>

                <Button
                  onClick={searchOddsForSelectedMatch}
                  disabled={!qLeagueId || !qDays || !qMatchId || loadingOdds}
                >
                  {loadingOdds ? "Buscant…" : "Buscar quotes"}
                </Button>
              </div>

              {qErr ? (
                <div style={{ gridColumn: "span 12" }}>
                  <pre
                    style={{
                      marginTop: 6,
                      padding: 14,
                      borderRadius: 14,
                      background: "rgba(15,23,42,.06)",
                      border: "1px solid rgba(148,163,184,.30)",
                      overflowX: "auto",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {qErr}
                  </pre>
                </div>
              ) : null}
            </div>

            {/* Resultats Quotes */}
            {selectedMatch ? (
              <div style={{ marginTop: 6, color: "rgb(71,85,105)" }}>
                <b>Seleccionat:</b> {selectedMatch.home.name} vs {selectedMatch.away.name} ·{" "}
                {fmtDateLocal(selectedMatch.utcDate)}
              </div>
            ) : null}

            {odds && odds.found === false ? (
              <div style={{ color: "rgb(71,85,105)", fontWeight: 800 }}>
                No he trobat quotes per aquest partit encara.
              </div>
            ) : null}

            {odds?.found ? (
              <>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <Badge tone="success">1: {odds.best?.home?.toFixed?.(2) ?? "-"}</Badge>
                  <Badge tone="success">X: {odds.best?.draw?.toFixed?.(2) ?? "-"}</Badge>
                  <Badge tone="success">2: {odds.best?.away?.toFixed?.(2) ?? "-"}</Badge>
                  {odds?.arbitrage ? (
                    <Badge tone="warning">💰 ARBITRATGE +{Number(odds.arbitrage.edgePct).toFixed(2)}%</Badge>
                  ) : null}
                  {odds?.consensus?.threshold ? (
                    <Badge tone="neutral">Outlier ≥ {odds.consensus.threshold} punts %</Badge>
                  ) : null}
                </div>

                <div style={{ overflowX: "auto", marginTop: 10 }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "separate",
                      borderSpacing: 0,
                      border: "1px solid rgba(148,163,184,.28)",
                      borderRadius: 14,
                      overflow: "hidden",
                    }}
                  >
                    <thead>
                      <tr
                        style={{
                          background:
                            "linear-gradient(180deg, rgba(15,23,42,.06), rgba(15,23,42,.03))",
                          color: "rgb(51,65,85)",
                        }}
                      >
                        <th style={{ padding: "12px 14px", textAlign: "left" }}>Casa</th>
                        <th style={{ padding: "12px 14px" }}>1 (odd · %)</th>
                        <th style={{ padding: "12px 14px" }}>X (odd · %)</th>
                        <th style={{ padding: "12px 14px" }}>2 (odd · %)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(odds.rows || []).map((r: any, i: number) => {
                        const cellStyle = (isBest: boolean, isOut: boolean) => ({
                          padding: "12px 14px",
                          textAlign: "center" as const,
                          fontWeight: isBest ? 900 : 500,
                          color: isBest ? "rgb(5,150,105)" : "rgb(15,23,42)",
                          background: isOut ? "rgba(239,68,68,.07)" : "white",
                          borderLeft: "1px solid rgba(148,163,184,.18)",
                        });

                        const rowBg = i % 2 === 0 ? "white" : "rgba(241,245,249,.55)";
                        const pct = (x: number | null | undefined) =>
                          x == null ? "" : `${Number(x).toFixed(1)}%`;

                        return (
                          <tr key={`${r.bookmaker}-${i}`} style={{ background: rowBg }}>
                            <td style={{ padding: "12px 14px", fontWeight: 900, color: "rgb(30,41,59)" }}>
                              {r.bookmaker}
                            </td>

                            <td style={cellStyle(r.home === odds.best.home, r.outlier?.home)}>
                              {r.home?.toFixed(2) ?? "-"}{" "}
                              <span style={{ opacity: 0.7, fontSize: 12 }}>{pct(r.implied?.home)}</span>
                              {r.outlier?.home ? <span style={{ marginLeft: 6 }}>🚨</span> : null}
                            </td>

                            <td style={cellStyle(r.draw === odds.best.draw, r.outlier?.draw)}>
                              {r.draw?.toFixed(2) ?? "-"}{" "}
                              <span style={{ opacity: 0.7, fontSize: 12 }}>{pct(r.implied?.draw)}</span>
                              {r.outlier?.draw ? <span style={{ marginLeft: 6 }}>🚨</span> : null}
                            </td>

                            <td style={cellStyle(r.away === odds.best.away, r.outlier?.away)}>
                              {r.away?.toFixed(2) ?? "-"}{" "}
                              <span style={{ opacity: 0.7, fontSize: 12 }}>{pct(r.implied?.away)}</span>
                              {r.outlier?.away ? <span style={{ marginLeft: 6 }}>🚨</span> : null}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}
          </div>
        </Card>

        {/* QUADRAT 2 */}
        <div style={{ marginTop: 18 }}>
          <Card>
            <CardHeader
              title="🔥 Oportunitats"
              subtitle="Una oportunitat és quan el mercat dona una quota ‘massa alta’ o hi ha arbitratge entre cases. Això pot indicar valor."
            />
            <div style={{ padding: 18, display: "grid", gap: 14 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(12, 1fr)",
                  gap: 14,
                }}
              >
                <div style={{ gridColumn: "span 12", maxWidth: 520 }}>
                  <FieldLabel>Lliga</FieldLabel>
                  <Select value={oLeagueId} onChange={setOLeagueId} width="100%">
                    <option value="">-</option>
                    {leagues.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </Select>
                </div>

                <div style={{ gridColumn: "span 12", maxWidth: 220 }}>
                  <FieldLabel>Rang de dies</FieldLabel>
                  <Select value={oDays} onChange={setODays} width="100%">
                    <option value="">-</option>
                    <option value="3">3 dies</option>
                    <option value="7">7 dies</option>
                    <option value="14">14 dies</option>
                  </Select>
                </div>

                <div style={{ gridColumn: "span 12", display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <Button
                    onClick={searchOpportunities}
                    disabled={!oLeagueId || !oDays || loadingOpps}
                  >
                    {loadingOpps ? "Buscant…" : "Buscar oportunitats"}
                  </Button>
                </div>

                {oErr ? (
                  <div style={{ gridColumn: "span 12" }}>
                    <pre
                      style={{
                        marginTop: 6,
                        padding: 14,
                        borderRadius: 14,
                        background: "rgba(15,23,42,.06)",
                        border: "1px solid rgba(148,163,184,.30)",
                        overflowX: "auto",
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {oErr}
                    </pre>
                  </div>
                ) : null}
              </div>

              {/* Resultats oportunitats */}
              {opps.length ? (
                <div style={{ display: "grid", gap: 10 }}>
                  {opps.map((o) => (
                    <div
                      key={o.matchId}
                      style={{
                        padding: 14,
                        borderRadius: 14,
                        border: "1px solid rgba(148,163,184,.28)",
                        background: "rgba(255,255,255,.85)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                        flexWrap: "wrap",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 950, color: "rgb(15,23,42)" }}>
                          {o.home} vs {o.away}
                        </div>
                        <div style={{ marginTop: 4, color: "rgb(71,85,105)", fontSize: 12.5 }}>
                          ⏰ {fmtDateLocal(o.utcDate)}
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                        {o.arbitrage ? (
                          <Badge tone="warning">💰 +{Number(o.arbitrage.edgePct).toFixed(2)}%</Badge>
                        ) : null}
                        {o.outliers ? <Badge tone="danger">🚨 {o.outliers} outliers</Badge> : null}
                        <Badge tone="success">
                          1 {o.best?.home ? Number(o.best.home).toFixed(2) : "-"} · X{" "}
                          {o.best?.draw ? Number(o.best.draw).toFixed(2) : "-"} · 2{" "}
                          {o.best?.away ? Number(o.best.away).toFixed(2) : "-"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: "rgb(71,85,105)" }}>
                  Encara no has buscat oportunitats (o no n’hi ha amb aquests filtres).
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}