"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useToast, errorMessage } from "@/components/shared/ToastProvider";
import { CvrDrawer } from "./CvrDrawer";

export const STAGE_LABELS: Record<string, string> = {
  kontaktet: "Kontaktet",
  svar: "Svar",
  mode: "Møde",
  pipeline: "Pipeline",
};

export type CvrCompanyRow = {
  cvrNummer: string;
  navn: string | null;
  virksomhedsformTekst: string | null;
  brancheKode: string | null;
  brancheTekst: string | null;
  brancheLabel: string | null;
  email: string | null;
  telefon: string | null;
  vejnavn: string | null;
  husnummer: string | null;
  postnummer: string | null;
  postdistrikt: string | null;
  kommunenavn: string | null;
  region: string | null;
  employees: number | null;
  produktionsenhederAntal: number;
  egenkapital: number | null;
  driftsresultat: number | null;
  nettoresultat: number | null;
  likvideBeholdninger: number | null;
  regnskabAar: number | null;
  koebekraftScore: number | null;
  lead: { stage: string | null; notes: string | null; lastContacted: string | null; starred: boolean } | null;
};

type BrancheFacet = { label: string; kodes: string[]; n: number };
type RegionFacet = { region: string; n: number };
type Meta = { brancher: BrancheFacet[]; regioner: RegionFacet[]; total: number; withEmployees: number };

const PAGE_SIZE = 50;
const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "navn", label: "Navn (A–Å)" },
  { value: "koebekraftScore", label: "Købekraft (høj → lav)" },
  { value: "employees", label: "Medarbejdere (flest)" },
  { value: "brancheTekst", label: "Branche" },
];

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export function CvrBrowser() {
  const { showToast } = useToast();
  const [search, setSearch] = useState("");
  const [branche, setBranche] = useState("");
  const [region, setRegion] = useState("");
  const [size, setSize] = useState("");
  const [koebekraft, setKoebekraft] = useState("");
  const [starredOnly, setStarredOnly] = useState(false);
  const [sort, setSort] = useState("koebekraftScore");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [rows, setRows] = useState<CvrCompanyRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<CvrCompanyRow | null>(null);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const activeFilterCount = (branche ? 1 : 0) + (region ? 1 : 0) + (size ? 1 : 0) + (koebekraft ? 1 : 0);
  const debouncedSearch = useDebounced(search, 350);
  const requestId = useRef(0);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("q", debouncedSearch);
    if (branche) params.set("branche", branche);
    if (region) params.set("region", region);
    if (size) params.set("size", size);
    if (koebekraft) params.set("koebekraft", koebekraft);
    if (starredOnly) params.set("starred", "1");
    params.set("sort", sort);
    params.set("dir", dir);
    params.set("page", String(page));
    params.set("pageSize", String(PAGE_SIZE));
    return params.toString();
  }, [debouncedSearch, branche, region, size, koebekraft, starredOnly, sort, dir, page]);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    try {
      const [metaRes, companiesRes] = await Promise.all([
        fetch(`/api/cvr/meta?${queryString}`),
        fetch(`/api/cvr/companies?${queryString}`),
      ]);
      if (!metaRes.ok || !companiesRes.ok) throw new Error("Kunne ikke hente CVR-data.");
      const metaJson = await metaRes.json();
      const companiesJson = await companiesRes.json();
      if (id !== requestId.current) return; // a newer request has since started
      setMeta(metaJson);
      setRows(companiesJson.rows);
      setTotal(companiesJson.total);
    } catch (err) {
      showToast(errorMessage(err, "Kunne ikke hente CVR-data."));
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [queryString, showToast]);

  useEffect(() => {
    // Fetching data on mount/filter-change (not subscribing to an external
    // system) is the sanctioned use of this pattern per react.dev's own
    // "Fetching data" example — CvrBrowser is server-side-paginated (420k
    // rows), unlike the rest of this app's client components, which all
    // receive their data as server-rendered props instead.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  function resetPaging() {
    setPage(1);
  }

  function toggleSort(key: string) {
    if (sort === key) {
      setDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSort(key);
      setDir(key === "navn" || key === "brancheTekst" ? "asc" : "desc");
    }
    resetPaging();
  }

  async function patchLead(cvr: string, body: Record<string, unknown>) {
    try {
      const res = await fetch(`/api/cvr/leads/${cvr}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Kunne ikke opdatere lead.");
      const updated = await res.json();
      setRows((prev) => prev.map((r) => (r.cvrNummer === cvr ? { ...r, lead: updated } : r)));
      setSelected((prev) => (prev && prev.cvrNummer === cvr ? { ...prev, lead: updated } : prev));
    } catch (err) {
      showToast(errorMessage(err, "Kunne ikke opdatere lead."));
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <section>
      <div className="toolbar">
        <div className="search-wrap">
          <svg viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="M21 21l-4.3-4.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            className="field"
            placeholder="Søg på navn eller CVR-nummer…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              resetPaging();
            }}
          />
        </div>
        <button type="button" className="filter-btn" onClick={() => setFilterPanelOpen((v) => !v)}>
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          Filtrér
          {activeFilterCount > 0 ? <span className="filter-count">{activeFilterCount}</span> : null}
        </button>
        <select className="sort-select" value={sort} onChange={(e) => toggleSort(e.target.value)}>
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              Sortér: {o.label}
            </option>
          ))}
        </select>
        <button type="button" className={`chip${starredOnly ? " star-active" : ""}`} onClick={() => { setStarredOnly((v) => !v); resetPaging(); }}>
          ★ Stjernemarkerede
        </button>
      </div>

      {filterPanelOpen ? (
      <div className="filter-panel open">
        <div className="filter-section">
          <div className="filter-section-label">Branche</div>
          <div className="filter-row">
            <select className="field" value={branche} onChange={(e) => { setBranche(e.target.value); resetPaging(); }}>
              <option value="">Alle brancher {meta ? `(${meta.total})` : ""}</option>
              {meta?.brancher.map((b) => (
                <option key={b.label} value={b.kodes.join(",")}>
                  {b.label} ({b.n})
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="filter-section">
          <div className="filter-section-label">Region</div>
          <div className="filter-row">
            <select className="field" value={region} onChange={(e) => { setRegion(e.target.value); resetPaging(); }}>
              <option value="">Alle regioner</option>
              {meta?.regioner.map((r) => (
                <option key={r.region} value={r.region}>
                  {r.region} ({r.n})
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="filter-section">
          <div className="filter-section-label">Størrelse</div>
          <div className="filter-row">
            <select className="field" value={size} onChange={(e) => { setSize(e.target.value); resetPaging(); }}>
              <option value="">Alle størrelser</option>
              <option value="small">10-49 ansatte</option>
              <option value="medium">50-249 ansatte</option>
              <option value="big">250+ ansatte</option>
              <option value="unknown">Ukendt antal ansatte</option>
            </select>
          </div>
        </div>
        <div className="filter-section">
          <div className="filter-section-label">Købekraft</div>
          <div className="filter-row">
            <select className="field" value={koebekraft} onChange={(e) => { setKoebekraft(e.target.value); resetPaging(); }}>
              <option value="">Alle</option>
              <option value="high">Høj (90+)</option>
              <option value="solid">Solid (60-89)</option>
              <option value="agil">Agil (30-59)</option>
              <option value="nogo">Lav (under 30)</option>
              <option value="unknown">Ukendt</option>
            </select>
          </div>
        </div>
      </div>
      ) : null}

      <div className="list-table-wrap">
        <table className="list-table">
          <thead>
            <tr>
              <th />
              <th onClick={() => toggleSort("navn")} style={{ cursor: "pointer" }}>Navn</th>
              <th onClick={() => toggleSort("brancheTekst")} style={{ cursor: "pointer" }}>Branche</th>
              <th>Region</th>
              <th onClick={() => toggleSort("employees")} style={{ cursor: "pointer" }}>Ansatte</th>
              <th onClick={() => toggleSort("koebekraftScore")} style={{ cursor: "pointer" }}>Købekraft</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !loading ? (
              <tr>
                <td colSpan={7} className="empty">Ingen virksomheder matcher filtrene.</td>
              </tr>
            ) : (
              rows.map((c) => (
                <tr key={c.cvrNummer} className="list-table-row" onClick={() => setSelected(c)}>
                  <td onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className={`star-btn${c.lead?.starred ? " starred" : ""}`}
                      onClick={() => patchLead(c.cvrNummer, { starred: !c.lead?.starred })}
                    >
                      {c.lead?.starred ? "★" : "☆"}
                    </button>
                  </td>
                  <td>{c.navn || "Ukendt navn"}</td>
                  <td>{c.brancheLabel ?? "—"}</td>
                  <td>{c.region ?? "—"}</td>
                  <td>{c.employees ?? "—"}</td>
                  <td>{c.koebekraftScore ?? "—"}</td>
                  <td>{c.lead?.stage ? <span className="status-pill" data-status={c.lead.stage}>{STAGE_LABELS[c.lead.stage] ?? c.lead.stage}</span> : "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="load-more-row">
        <button type="button" className="btn" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
          Forrige
        </button>
        <span className="distance-note">
          Side {page} af {totalPages} · {total.toLocaleString("da-DK")} virksomheder
        </span>
        <button type="button" className="btn" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
          Næste
        </button>
      </div>

      {selected ? (
        <CvrDrawer
          company={selected}
          onClose={() => setSelected(null)}
          onToggleStar={() => patchLead(selected.cvrNummer, { starred: !selected.lead?.starred })}
          onSetStage={(stage) => patchLead(selected.cvrNummer, stage === null ? { clearStage: true } : { stage })}
        />
      ) : null}
    </section>
  );
}
