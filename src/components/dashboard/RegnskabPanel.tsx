"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useToast, errorMessage } from "@/components/shared/ToastProvider";

type MonthlyPoint = { month: string; revenue: number; expenses: number };
type Summary = {
  cashPosition: { balance: number | null; asOf: string | null };
  monthlyBurn: number;
  runwayFundsAvailable: number | null;
  runwayMonths: number | null;
  runwayDate: string | null;
  revenue: number;
  openPipelineValue: number;
  rollingForecast: number;
  expenses: number;
  net: number;
  monthlySeries: MonthlyPoint[];
  lastSheetSync: string | null;
};

function formatKr(n: number | null | undefined): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("da-DK", { maximumFractionDigits: 0 }).format(n) + " kr.";
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("da-DK", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}

// Small self-contained SVG bar chart — the app's own .bd-row horizontal-bar
// pattern doesn't fit a two-series-over-time chart, so this is new, styled
// with the same CSS custom properties as the rest of the app.
function RevenueExpensesChart({ data }: { data: MonthlyPoint[] }) {
  if (data.length === 0) {
    return <div className="dash-empty">Ingen månedsdata endnu — klik &ldquo;Opdater fra ark&rdquo; for at hente tal.</div>;
  }
  const width = 600;
  const height = 180;
  const padding = 24;
  const max = Math.max(1, ...data.map((d) => Math.max(d.revenue, d.expenses)));
  const groupWidth = (width - padding * 2) / data.length;
  const barWidth = Math.min(18, groupWidth / 3);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none">
      {data.map((d, i) => {
        const x = padding + i * groupWidth + groupWidth / 2;
        const revH = (d.revenue / max) * (height - padding * 2);
        const expH = (d.expenses / max) * (height - padding * 2);
        return (
          <g key={d.month}>
            <rect x={x - barWidth - 2} y={height - padding - revH} width={barWidth} height={revH} fill="var(--accent)" rx={2} />
            <rect x={x + 2} y={height - padding - expH} width={barWidth} height={expH} fill="var(--hot)" rx={2} />
            <text x={x} y={height - padding + 14} textAnchor="middle" fontSize="9" fill="var(--text-faint)">
              {d.month.slice(5)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function RegnskabPanel() {
  const { showToast } = useToast();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [editingCash, setEditingCash] = useState(false);
  const [cashInput, setCashInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/finance/summary");
      if (!res.ok) throw new Error("Kunne ikke hente regnskabsdata.");
      setSummary(await res.json());
    } catch (err) {
      showToast(errorMessage(err, "Kunne ikke hente regnskabsdata."));
    }
  }, [showToast]);

  useEffect(() => {
    // Fetching data on mount is the sanctioned use of an effect per
    // react.dev's own "Fetching data" example — this panel is the only
    // part of Dashboard backed by its own API route instead of
    // server-rendered props (see CvrBrowser.tsx for the same pattern).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function refreshSheets() {
    setLoading(true);
    try {
      const res = await fetch("/api/finance/refresh-sheets", { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error || "Kunne ikke opdatere fra ark.");
      await load();
      showToast("Regnskabsdata opdateret fra Google Sheet.");
    } catch (err) {
      showToast(errorMessage(err, "Kunne ikke opdatere fra ark."));
    } finally {
      setLoading(false);
    }
  }

  async function importFile(file: File) {
    setLoading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/finance/import", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import fejlede.");
      await load();
      showToast(`Importeret: ${data.added} nye, ${data.skipped} allerede kendte.`);
    } catch (err) {
      showToast(errorMessage(err, "Import fejlede."));
    } finally {
      setLoading(false);
    }
  }

  async function saveCash() {
    const value = parseFloat(cashInput.replace(",", "."));
    if (!Number.isFinite(value)) {
      showToast("Indtast et gyldigt beløb.");
      return;
    }
    try {
      const res = await fetch("/api/finance/cash-position", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ balance: value }),
      });
      if (!res.ok) throw new Error("Kunne ikke gemme saldo.");
      await load();
      setEditingCash(false);
    } catch (err) {
      showToast(errorMessage(err, "Kunne ikke gemme saldo."));
    }
  }

  return (
    <div className="panel-card" style={{ marginTop: 16 }}>
      <div className="drawer-head-actions" style={{ justifyContent: "space-between", marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>Regnskab</h3>
        <div style={{ display: "flex", gap: 8 }}>
          <span className="distance-note" style={{ alignSelf: "center" }}>
            {summary?.lastSheetSync ? `Synkroniseret ${formatDate(summary.lastSheetSync)}` : "Ikke synkroniseret endnu"}
          </span>
          <button type="button" className="btn" disabled={loading} onClick={refreshSheets}>
            Opdater fra ark
          </button>
          <button type="button" className="btn" disabled={loading} onClick={() => fileInputRef.current?.click()}>
            Importér kontoudtog
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) importFile(file);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          {editingCash ? (
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                type="text"
                className="field"
                autoFocus
                value={cashInput}
                onChange={(e) => setCashInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveCash()}
                style={{ width: 100 }}
              />
              <button type="button" className="btn primary" onClick={saveCash}>
                Gem
              </button>
            </div>
          ) : (
            <b
              onClick={() => {
                setCashInput(String(summary?.cashPosition.balance ?? ""));
                setEditingCash(true);
              }}
              style={{ cursor: "pointer" }}
              title="Klik for at redigere"
            >
              {formatKr(summary?.cashPosition.balance)}
            </b>
          )}
          <span>Banksaldo{summary?.cashPosition.asOf ? ` (${formatDate(summary.cashPosition.asOf)})` : ""}</span>
        </div>
        <div className="stat-card">
          <b>{formatKr(summary?.revenue)}</b>
          <span>Omsætning (år-til-dato, ekskl. moms)</span>
        </div>
        <div className="stat-card">
          <b>{formatKr(summary?.openPipelineValue)}</b>
          <span>Åben pipeline</span>
        </div>
        <div className="stat-card">
          <b>{summary?.runwayMonths != null ? `${summary.runwayMonths.toFixed(1)} mdr.` : "—"}</b>
          <span>Runway{summary?.runwayDate ? ` (til ${formatDate(summary.runwayDate)})` : ""}</span>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <div className="section-label">Omsætning vs. udgifter pr. måned</div>
        <RevenueExpensesChart data={summary?.monthlySeries ?? []} />
      </div>
    </div>
  );
}
