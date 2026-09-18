"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useToast, errorMessage } from "@/components/shared/ToastProvider";

type MonthlyPoint = { month: string; revenue: number; expenses: number };
type CategoryTotal = { category: string; total: number };
type VatHalf = { half: string; vatOwed: number };
type PipelineRow = {
  date: string;
  client: string;
  status: string;
  segment: string;
  type: string;
  vat: boolean;
  revenue: number;
  vatAmount: number;
  inclVat: number;
};
type RecurringCategoryTotal = { category: string; monthlyAmount: number; count: number };
type TransactionRow = {
  id: string;
  source: string;
  date: string;
  description: string;
  counterparty?: string | null;
  amount: number;
  category: string;
};
type SalaryEntry = { name: string; monthlyAmount: number };

type Summary = {
  cashPosition: { balance: number | null; asOf: string | null };
  salaries: SalaryEntry[];
  recurringMonthlyTotal: number;
  salariesMonthlyTotal: number;
  monthlyBurn: number;
  runwayFundsAvailable: number | null;
  runwayMonths: number | null;
  runwayDate: string | null;
  revenue: number;
  openPipelineValue: number;
  rollingForecast: number;
  expenses: number;
  net: number;
  vatByHalf: VatHalf[];
  monthlySeries: MonthlyPoint[];
  categoryBreakdown: CategoryTotal[];
  recurringByCategory: RecurringCategoryTotal[];
  openPipeline: PipelineRow[];
  recentTransactions: TransactionRow[];
  lastSheetSync: string | null;
  transactionCount: number;
};

const TABS = [
  { key: "oversigt", label: "Oversigt" },
  { key: "pipeline", label: "Pipeline" },
  { key: "kategorier", label: "Kategorier & moms" },
  { key: "faste", label: "Faste udgifter" },
  { key: "transaktioner", label: "Transaktioner" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

function formatKr(n: number | null | undefined): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("da-DK", { maximumFractionDigits: 0 }).format(n) + " kr.";
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("da-DK", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}

function formatDateShort(iso: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}.${m}.${y}`;
}

function monthLabel(iso: string): string {
  const [y, m] = iso.split("-");
  if (!y || !m) return iso;
  return new Intl.DateTimeFormat("da-DK", { month: "short" }).format(new Date(Number(y), Number(m) - 1, 1));
}

// HTML/CSS bars (not SVG) so the height change from 0 on mount can use a
// plain CSS transition — SVG geometry-attribute transitions are flaky across
// browsers, div heights are not.
function RevenueExpensesChart({ data }: { data: MonthlyPoint[] }) {
  const [grown, setGrown] = useState(false);

  useEffect(() => {
    // Reset-then-grow on every data change is what makes the bars animate
    // in (mount, and after a refresh) instead of only on first render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGrown(false);
    const frame = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(frame);
  }, [data]);

  if (data.length === 0) {
    return <div className="dash-empty">Ingen månedsdata endnu — klik &ldquo;Opdater fra ark&rdquo; for at hente tal.</div>;
  }
  const max = Math.max(1, ...data.flatMap((d) => [d.revenue, d.expenses]));

  return (
    <div className="fin-chart">
      <div className="fin-chart-legend">
        <span>
          <i className="fin-legend-dot" style={{ background: "var(--accent)" }} /> Omsætning
        </span>
        <span>
          <i className="fin-legend-dot" style={{ background: "var(--hot)" }} /> Udgifter
        </span>
      </div>
      <div className="fin-chart-bars">
        {data.map((d) => (
          <div className="fin-chart-col" key={d.month}>
            <div className="fin-chart-bar-pair">
              <div
                className="fin-bar"
                style={{ height: grown ? Math.max(2, (d.revenue / max) * 140) : 0, background: "var(--accent)" }}
                title={`Omsætning: ${formatKr(d.revenue)}`}
              />
              <div
                className="fin-bar"
                style={{ height: grown ? Math.max(2, (d.expenses / max) * 140) : 0, background: "var(--hot)" }}
                title={`Udgifter: ${formatKr(d.expenses)}`}
              />
            </div>
            <div className="fin-chart-month">{monthLabel(d.month)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MoneyBreakdown({ rows, barColor }: { rows: { label: string; value: number }[]; barColor: string }) {
  if (rows.length === 0) return <div className="dash-empty">Ingen data endnu.</div>;
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="breakdown">
      {rows.map((r) => (
        <div className="money-bd-row" key={r.label}>
          <span title={r.label}>{r.label}</span>
          <div className="bd-track">
            <div className="bd-fill" style={{ width: `${Math.round((r.value / max) * 100)}%`, background: barColor }} />
          </div>
          <b>{formatKr(r.value)}</b>
        </div>
      ))}
    </div>
  );
}

function PipelineTable({ rows }: { rows: PipelineRow[] }) {
  if (rows.length === 0) return <div className="dash-empty">Intet åbent i pipelinen.</div>;
  return (
    <div className="list-table-wrap">
      <table className="list-table">
        <thead>
          <tr>
            <th>Dato</th>
            <th>Klient</th>
            <th>Segment</th>
            <th>Type</th>
            <th>Status</th>
            <th style={{ textAlign: "right" }}>Beløb</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={`${p.client}-${p.date}`}>
              <td>{formatDateShort(p.date)}</td>
              <td>{p.client}</td>
              <td>{p.segment}</td>
              <td>{p.type}</td>
              <td>
                <span className={p.status === "Invoiced" || p.status === "Send invoice" ? "new-badge" : "tag"}>{p.status}</span>
              </td>
              <td style={{ textAlign: "right", fontFamily: "var(--font-mono)" }}>{formatKr(p.revenue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TransactionsTable({ rows }: { rows: TransactionRow[] }) {
  if (rows.length === 0) return <div className="dash-empty">Ingen transaktioner endnu — importér et kontoudtog.</div>;
  return (
    <div className="list-table-wrap">
      <table className="list-table">
        <thead>
          <tr>
            <th>Dato</th>
            <th>Beskrivelse</th>
            <th>Modpart</th>
            <th>Kategori</th>
            <th style={{ textAlign: "right" }}>Beløb</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((tx) => (
            <tr key={tx.id}>
              <td>{formatDateShort(tx.date)}</td>
              <td>{tx.description}</td>
              <td>{tx.counterparty || "—"}</td>
              <td>{tx.category}</td>
              <td
                style={{
                  textAlign: "right",
                  fontFamily: "var(--font-mono)",
                  color: tx.amount < 0 ? "var(--bad)" : "var(--good)",
                }}
              >
                {formatKr(tx.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SalariesEditor({ salaries, onSave }: { salaries: SalaryEntry[]; onSave: (entries: SalaryEntry[]) => Promise<void> }) {
  const [inputs, setInputs] = useState(salaries);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInputs(salaries);
  }, [salaries]);

  function updateAmount(name: string, raw: string) {
    const amount = parseFloat(raw.replace(",", "."));
    setInputs((prev) => prev.map((s) => (s.name === name ? { ...s, monthlyAmount: Number.isFinite(amount) ? amount : 0 } : s)));
  }

  async function save() {
    setSaving(true);
    try {
      await onSave(inputs);
    } finally {
      setSaving(false);
    }
  }

  if (inputs.length === 0) return <div className="dash-empty">Ingen lønposter konfigureret.</div>;

  return (
    <div>
      {inputs.map((s) => (
        <div className="salary-row" key={s.name}>
          <span>{s.name}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="text"
              inputMode="decimal"
              className="field"
              value={s.monthlyAmount || ""}
              placeholder="0"
              onChange={(e) => updateAmount(s.name, e.target.value)}
              onBlur={save}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            />
            <span className="distance-note" style={{ marginTop: 0 }}>
              kr./md
            </span>
          </div>
        </div>
      ))}
      {saving ? <div className="distance-note">Gemmer…</div> : null}
    </div>
  );
}

export function RegnskabPanel() {
  const { showToast } = useToast();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [editingCash, setEditingCash] = useState(false);
  const [cashInput, setCashInput] = useState("");
  const [tab, setTab] = useState<TabKey>("oversigt");
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

  async function saveSalaries(entries: SalaryEntry[]) {
    try {
      const res = await fetch("/api/finance/salaries", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ salaries: entries }),
      });
      if (!res.ok) throw new Error("Kunne ikke gemme løn.");
      await load();
    } catch (err) {
      showToast(errorMessage(err, "Kunne ikke gemme løn."));
    }
  }

  return (
    <div className="panel-card" style={{ marginTop: 16 }}>
      <div className="drawer-head-actions" style={{ justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
        <h3 style={{ margin: 0 }}>Regnskab</h3>
        <div className="fin-header-actions">
          <span className="distance-note" style={{ alignSelf: "center", marginTop: 0 }}>
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
          <span>Omsætning (år-til-dato)</span>
        </div>
        <div className="stat-card">
          <b>{formatKr(summary?.openPipelineValue)}</b>
          <span>Åben pipeline</span>
        </div>
        <div className="stat-card">
          <b>{formatKr(summary?.rollingForecast)}</b>
          <span>Rullende prognose</span>
        </div>
        <div className="stat-card">
          <b>{formatKr(summary?.expenses)}</b>
          <span>Udgifter (år-til-dato)</span>
        </div>
      </div>

      <div className="segmented fin-tabs">
        {TABS.map((t) => (
          <button key={t.key} type="button" className={tab === t.key ? "active" : ""} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="fin-tab-content" key={tab}>
        {tab === "oversigt" ? (
          <div className="fin-grid">
            <div>
              <div className="section-label" style={{ marginTop: 0 }}>
                Omsætning vs. udgifter pr. måned
              </div>
              <RevenueExpensesChart data={summary?.monthlySeries ?? []} />
            </div>
            <div>
              <div className="section-label" style={{ marginTop: 0 }}>
                Rådighedsbeløb
              </div>
              <div className="kv-row">
                <span>Banksaldo</span>
                <b>{formatKr(summary?.cashPosition.balance)}</b>
              </div>
              <div className="kv-row">
                <span>+ Åben pipeline</span>
                <b>{formatKr(summary?.openPipelineValue)}</b>
              </div>
              <div className="kv-row kv-total">
                <span>= Rådighedsbeløb</span>
                <b>{formatKr(summary?.runwayFundsAvailable)}</b>
              </div>

              <div className="section-label">Månedligt forbrug</div>
              <div className="kv-row">
                <span>Faste udgifter</span>
                <b>{formatKr(summary?.recurringMonthlyTotal)}/md</b>
              </div>
              <div className="kv-row">
                <span>Løn</span>
                <b>{formatKr(summary?.salariesMonthlyTotal)}/md</b>
              </div>
              <div className="kv-row kv-total">
                <span>= Samlet forbrug</span>
                <b>{formatKr(summary?.monthlyBurn)}/md</b>
              </div>

              <div className="idea-box" style={{ marginTop: 14 }}>
                {summary && summary.cashPosition.balance === null ? (
                  <span>Indtast bankbeholdningen i statkortet ovenfor for at se runway.</span>
                ) : summary && summary.runwayMonths == null ? (
                  <span>Tilføj løn/faste udgifter under &ldquo;Faste udgifter&rdquo; for at beregne runway.</span>
                ) : summary ? (
                  <span>
                    <b>{summary.runwayMonths!.toFixed(1)} måneder</b> tilbage — løber tør omkring {formatDate(summary.runwayDate)}
                  </span>
                ) : (
                  <span>Indlæser…</span>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {tab === "pipeline" ? <PipelineTable rows={summary?.openPipeline ?? []} /> : null}

        {tab === "kategorier" ? (
          <div className="fin-grid">
            <div>
              <div className="section-label" style={{ marginTop: 0 }}>
                Forbrug efter kategori
              </div>
              <MoneyBreakdown
                rows={(summary?.categoryBreakdown ?? []).map((c) => ({ label: c.category, value: c.total }))}
                barColor="var(--hot)"
              />
            </div>
            <div>
              <div className="section-label" style={{ marginTop: 0 }}>
                Moms pr. halvår
              </div>
              {summary && summary.vatByHalf.length > 0 ? (
                <div className="vat-tiles">
                  {summary.vatByHalf.map((h) => {
                    const [year, half] = h.half.split("-");
                    const isRefund = h.vatOwed < 0;
                    return (
                      <div className="vat-tile" key={h.half}>
                        <div className="vat-tile-label">
                          {half} {year}
                        </div>
                        <div className={`vat-tile-amount${isRefund ? " vat-tile-refund" : ""}`}>
                          {formatKr(Math.abs(h.vatOwed))}
                        </div>
                        <div className="vat-tile-caption">{isRefund ? "til gode" : "skyldig"}</div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="dash-empty">Ingen momsdata endnu — importér et kontoudtog.</div>
              )}
            </div>
          </div>
        ) : null}

        {tab === "faste" ? (
          <div className="fin-grid">
            <div>
              <div className="section-label" style={{ marginTop: 0 }}>
                Gentagende udgifter
              </div>
              <MoneyBreakdown
                rows={(summary?.recurringByCategory ?? []).map((r) => ({
                  label: `${r.category} (${r.count})`,
                  value: r.monthlyAmount,
                }))}
                barColor="var(--warm)"
              />
            </div>
            <div>
              <div className="section-label" style={{ marginTop: 0 }}>
                Projekteret løn
              </div>
              <SalariesEditor salaries={summary?.salaries ?? []} onSave={saveSalaries} />
              <div className="kv-row" style={{ marginTop: 10 }}>
                <span>Faste udgifter i alt</span>
                <b>{formatKr(summary?.recurringMonthlyTotal)}/md</b>
              </div>
              <div className="kv-row">
                <span>Løn i alt</span>
                <b>{formatKr(summary?.salariesMonthlyTotal)}/md</b>
              </div>
              <div className="kv-row kv-total">
                <span>= Samlet forbrug</span>
                <b>{formatKr(summary?.monthlyBurn)}/md</b>
              </div>
            </div>
          </div>
        ) : null}

        {tab === "transaktioner" ? (
          <div>
            <div className="distance-note" style={{ marginBottom: 10 }}>
              {summary ? `${summary.transactionCount} transaktion${summary.transactionCount === 1 ? "" : "er"} i alt — seneste 8 vist` : "Indlæser…"}
            </div>
            <TransactionsTable rows={summary?.recentTransactions ?? []} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
