"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useToast, errorMessage } from "@/components/shared/ToastProvider";
import { STATUS_DEFS, statusLabel } from "@/lib/status";
import { CvrDrawer } from "./CvrDrawer";
import { ListMenu, type TeamListOption } from "./ListMenu";
import { useCvrRowMutations } from "./useCvrRowMutations";

const STATUS_CLOSE_DELAY_MS = 350;

// Columns whose first-click direction is ascending (A–Å / lowest-first) —
// everything else defaults to descending (highest-first) on first click.
const ASC_DEFAULT_SORT_KEYS = new Set(["navn", "brancheTekst", "region", "status"]);

function SortArrow({ pointingDown }: { pointingDown: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      width={11}
      height={11}
      fill="none"
      style={{
        marginLeft: 5,
        verticalAlign: "middle",
        transition: "transform 0.15s ease",
        transform: pointingDown ? "none" : "rotate(180deg)",
      }}
    >
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export type CvrPipelineState = { status: string; assigneeId: string | null; assigneeName: string | null };

export type CvrAnalysisData = {
  score: number;
  breakdown: { contact: number; news: number; industry: number; creative: number };
  tier: { key: string; label: string };
  hook: { title: string; summary: string; date: string; url: string } | null;
  existing: string;
  social: string;
  idea: string;
  contact: {
    found: boolean;
    name: string | null;
    title: string | null;
    email: string | null;
    note: string | null;
    sourceUrl: string | null;
    profileUrl: string | null;
  };
  mail: { subject: string; body: string };
  analyzedAt: string;
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
  pipeline: CvrPipelineState | null;
  starred: boolean;
  listIds: string[];
  distanceKm: number | null;
  analysis: CvrAnalysisData | null;
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
  { value: "region", label: "Region" },
  { value: "status", label: "Status" },
];

// One-line recap of a row's secondary columns, shown in place of them when
// the table is too narrow to lay them out side by side.
function cvrRowSummary(c: CvrCompanyRow, showDistance: boolean): string {
  return [
    c.brancheLabel,
    c.region,
    c.employees != null ? `${c.employees} ${c.employees === 1 ? "ansat" : "ansatte"}` : null,
    c.koebekraftScore != null ? `Købekraft ${c.koebekraftScore}` : null,
    showDistance && c.distanceKm != null ? `${Math.round(c.distanceKm)} km` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export function CvrBrowser({
  teamId,
  myName,
  initialTeamLists,
}: {
  teamId: string;
  myName: string;
  initialTeamLists: TeamListOption[];
}) {
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
  const [loadingMore, setLoadingMore] = useState(false);
  const [selected, setSelected] = useState<CvrCompanyRow | null>(null);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [openStatusFor, setOpenStatusFor] = useState<string | null>(null);
  const [statusMenuPos, setStatusMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [maxDistance, setMaxDistance] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);
  const statusCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function cancelStatusClose() {
    if (statusCloseTimer.current) {
      clearTimeout(statusCloseTimer.current);
      statusCloseTimer.current = null;
    }
  }

  function scheduleStatusClose() {
    cancelStatusClose();
    statusCloseTimer.current = setTimeout(() => setOpenStatusFor(null), STATUS_CLOSE_DELAY_MS);
  }

  useEffect(() => {
    return () => {
      if (statusCloseTimer.current) clearTimeout(statusCloseTimer.current);
    };
  }, []);

  const {
    teamLists,
    analyzingFor,
    handleSetStatus,
    handleAssign,
    handleRelease,
    handleToggleStar,
    handleToggleList,
    handleCreateList,
    handleAnalyze,
  } = useCvrRowMutations({ teamId, myName, initialTeamLists, setRows, setSelected });

  const activeFilterCount =
    (branche ? 1 : 0) + (region ? 1 : 0) + (size ? 1 : 0) + (koebekraft ? 1 : 0) + (starredOnly ? 1 : 0) + (myLocation && maxDistance != null ? 1 : 0);
  const debouncedSearch = useDebounced(search, 350);
  const requestId = useRef(0);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Split so scrolling to the next page (which only changes `page`) doesn't
  // needlessly refetch facet counts on every increment — meta only depends
  // on the filter set, never on which page is currently loaded.
  const filterQueryString = useMemo(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("q", debouncedSearch);
    if (branche) params.set("branche", branche);
    if (region) params.set("region", region);
    if (size) params.set("size", size);
    if (koebekraft) params.set("koebekraft", koebekraft);
    if (starredOnly) params.set("starred", "1");
    if (myLocation && maxDistance != null) {
      params.set("lat", String(myLocation.lat));
      params.set("lng", String(myLocation.lng));
      params.set("maxDistanceKm", String(maxDistance));
    }
    params.set("sort", sort);
    params.set("dir", dir);
    return params.toString();
  }, [debouncedSearch, branche, region, size, koebekraft, starredOnly, myLocation, maxDistance, sort, dir]);

  const companiesQueryString = useMemo(() => {
    const params = new URLSearchParams(filterQueryString);
    params.set("page", String(page));
    params.set("pageSize", String(PAGE_SIZE));
    return params.toString();
  }, [filterQueryString, page]);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    const isFirstPage = page === 1;
    if (isFirstPage) setLoading(true);
    else setLoadingMore(true);
    try {
      const [metaRes, companiesRes] = await Promise.all([
        fetch(`/api/cvr/meta?${filterQueryString}`),
        fetch(`/api/cvr/companies?${companiesQueryString}`),
      ]);
      if (!metaRes.ok || !companiesRes.ok) throw new Error("Kunne ikke hente CVR-data.");
      const metaJson = await metaRes.json();
      const companiesJson = await companiesRes.json();
      if (id !== requestId.current) return; // a newer request has since started
      setMeta(metaJson);
      setRows((prev) => (isFirstPage ? companiesJson.rows : [...prev, ...companiesJson.rows]));
      setTotal(companiesJson.total);
    } catch (err) {
      showToast(errorMessage(err, "Kunne ikke hente CVR-data."));
    } finally {
      if (id === requestId.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterQueryString, companiesQueryString, showToast]);

  useEffect(() => {
    // Fetching data on mount/filter-change (not subscribing to an external
    // system) is the sanctioned use of this pattern per react.dev's own
    // "Fetching data" example — CvrBrowser is server-side-paginated (420k
    // rows), unlike the rest of this app's client components, which all
    // receive their data as server-rendered props instead.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loading && !loadingMore && rows.length < total) {
          setPage((p) => p + 1);
        }
      },
      { rootMargin: "400px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loading, loadingMore, rows.length, total]);

  function resetPaging() {
    setPage(1);
  }

  function toggleSort(key: string) {
    if (sort === key) {
      setDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSort(key);
      setDir(ASC_DEFAULT_SORT_KEYS.has(key) ? "asc" : "desc");
    }
    resetPaging();
  }

  // The arrow always points down on a column's first click (its natural
  // default direction — A–Å for text columns, highest-first for numeric
  // ones) and flips to point up once you click again to reverse it, rather
  // than literally mapping asc/desc to a fixed direction — that would make
  // Navn's first click point up while every numeric column's first click
  // points down, which reads as inconsistent.
  function sortIndicator(key: string) {
    if (sort !== key) return null;
    const isDefaultDir = dir === (ASC_DEFAULT_SORT_KEYS.has(key) ? "asc" : "desc");
    return <SortArrow pointingDown={isDefaultDir} />;
  }

  function requestLocation() {
    if (!navigator.geolocation) {
      showToast("Din browser understøtter ikke lokation.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setMyLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setMaxDistance(300);
        setLocating(false);
        resetPaging();
      },
      (err) => {
        showToast(`Kunne ikke hente din lokation (${err?.message || "afvist"}).`);
        setLocating(false);
      },
      { timeout: 10000 },
    );
  }

  const totalLoaded = rows.length;

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
      </div>

      {filterPanelOpen ? (
        <div className="filter-panel open">
          <div className="filter-section">
            <div className="filter-section-label">Branche</div>
            <div className="filter-row">
              <select
                className="field"
                value={branche}
                onChange={(e) => {
                  setBranche(e.target.value);
                  resetPaging();
                }}
              >
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
              <select
                className="field"
                value={region}
                onChange={(e) => {
                  setRegion(e.target.value);
                  resetPaging();
                }}
              >
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
              <select
                className="field"
                value={size}
                onChange={(e) => {
                  setSize(e.target.value);
                  resetPaging();
                }}
              >
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
              <select
                className="field"
                value={koebekraft}
                onChange={(e) => {
                  setKoebekraft(e.target.value);
                  resetPaging();
                }}
              >
                <option value="">Alle</option>
                <option value="high">Høj (90+)</option>
                <option value="solid">Solid (60-89)</option>
                <option value="agil">Agil (30-59)</option>
                <option value="nogo">Lav (under 30)</option>
                <option value="unknown">Ukendt</option>
              </select>
            </div>
          </div>
          <div className="filter-section">
            <div className="filter-section-label">Andet</div>
            <div className="filter-row">
              <button
                type="button"
                className={`chip${starredOnly ? " star-active" : ""}`}
                onClick={() => {
                  setStarredOnly((v) => !v);
                  resetPaging();
                }}
              >
                ★ Stjernemarkerede
              </button>
            </div>
          </div>
          <div className="filter-section">
            <div className="filter-section-label">Afstand fra dig</div>
            {!myLocation ? (
              <div>
                <button type="button" className="btn" onClick={requestLocation} disabled={locating}>
                  {locating ? "Henter lokation…" : "Brug min lokation"}
                </button>
                <div className="distance-note">Afstande er omtrentlige (postnummer-niveau), ikke præcise adresser.</div>
              </div>
            ) : (
              <div>
                <div className="distance-box">
                  <input
                    type="range"
                    min={5}
                    max={500}
                    step={5}
                    value={maxDistance ?? 300}
                    onChange={(e) => {
                      setMaxDistance(parseInt(e.target.value, 10));
                      resetPaging();
                    }}
                    style={{ "--range-pct": `${(((maxDistance ?? 300) - 5) / (500 - 5)) * 100}%` } as React.CSSProperties}
                  />
                  <span className="distance-pill">+{maxDistance} km</span>
                </div>
                <div className="distance-note">Afstande er omtrentlige (postnummer-niveau), ikke præcise adresser.</div>
              </div>
            )}
          </div>
          <div className="filter-footer">
            <button
              type="button"
              className="btn"
              onClick={() => {
                setBranche("");
                setRegion("");
                setSize("");
                setKoebekraft("");
                setStarredOnly(false);
                setMaxDistance(null);
                setSearch("");
                resetPaging();
              }}
            >
              Nulstil filtre
            </button>
          </div>
        </div>
      ) : null}

      <div className="list-table-wrap">
        <table className="list-table cvr-table">
          <thead>
            <tr>
              <th />
              <th onClick={() => toggleSort("navn")} style={{ cursor: "pointer" }}>
                Navn{sortIndicator("navn")}
              </th>
              <th onClick={() => toggleSort("brancheTekst")} style={{ cursor: "pointer" }}>
                Branche{sortIndicator("brancheTekst")}
              </th>
              <th onClick={() => toggleSort("region")} style={{ cursor: "pointer" }}>
                Region{sortIndicator("region")}
              </th>
              <th onClick={() => toggleSort("employees")} style={{ cursor: "pointer" }}>
                Ansatte{sortIndicator("employees")}
              </th>
              <th onClick={() => toggleSort("koebekraftScore")} style={{ cursor: "pointer" }}>
                Købekraft{sortIndicator("koebekraftScore")}
              </th>
              {myLocation ? <th>Afstand</th> : null}
              <th onClick={() => toggleSort("status")} style={{ cursor: "pointer" }}>
                Status{sortIndicator("status")}
              </th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !loading ? (
              <tr>
                <td colSpan={myLocation ? 9 : 8} className="empty">
                  Ingen virksomheder matcher filtrene.
                </td>
              </tr>
            ) : (
              rows.map((c) => (
                <tr key={c.cvrNummer} className="list-table-row row-in" onClick={() => setSelected(c)}>
                  <td className="cvr-c-star" onClick={(e) => e.stopPropagation()}>
                    <button type="button" className={`star-btn${c.starred ? " starred" : ""}`} onClick={() => handleToggleStar(c)}>
                      {c.starred ? "★" : "☆"}
                    </button>
                  </td>
                  <td className="cell-primary">{c.navn || "Ukendt navn"}</td>
                  <td className="cvr-c-summary">{cvrRowSummary(c, myLocation != null)}</td>
                  <td className="cvr-c-meta">{c.brancheLabel ?? "—"}</td>
                  <td className="cvr-c-meta">{c.region ?? "—"}</td>
                  <td className="cvr-c-meta">{c.employees ?? "—"}</td>
                  <td className="cvr-c-meta">{c.koebekraftScore ?? "—"}</td>
                  {myLocation ? <td className="cvr-c-meta">{c.distanceKm != null ? `${Math.round(c.distanceKm)} km` : "—"}</td> : null}
                  <td className="cvr-c-status" onClick={(e) => e.stopPropagation()}>
                    <div className="status-menu" onMouseEnter={cancelStatusClose} onMouseLeave={scheduleStatusClose}>
                      <button
                        type="button"
                        className="status-pill"
                        data-status={c.pipeline?.status ?? "new"}
                        onClick={(e) => {
                          if (openStatusFor === c.cvrNummer) {
                            setOpenStatusFor(null);
                            return;
                          }
                          const rect = e.currentTarget.getBoundingClientRect();
                          setStatusMenuPos({ top: rect.bottom + 6, left: rect.left });
                          setOpenStatusFor(c.cvrNummer);
                        }}
                      >
                        {statusLabel(c.pipeline?.status ?? "new")} ▾
                      </button>
                      {openStatusFor === c.cvrNummer && statusMenuPos
                        ? createPortal(
                            <div
                              className="status-dropdown"
                              style={{ position: "fixed", top: statusMenuPos.top, left: statusMenuPos.left, display: "flex" }}
                              onMouseEnter={cancelStatusClose}
                              onMouseLeave={scheduleStatusClose}
                            >
                              {STATUS_DEFS.map((s) => (
                                <button
                                  key={s.key}
                                  type="button"
                                  className="status-opt"
                                  onClick={() => {
                                    setOpenStatusFor(null);
                                    handleSetStatus(c, s.key);
                                  }}
                                >
                                  <span className={`status-dot ${s.key}`} />
                                  {s.label}
                                </button>
                              ))}
                            </div>,
                            document.body,
                          )
                        : null}
                    </div>
                  </td>
                  <td className="cvr-c-lists" onClick={(e) => e.stopPropagation()}>
                    <ListMenu
                      companyName={c.navn || `CVR ${c.cvrNummer}`}
                      teamLists={teamLists}
                      listIds={new Set(c.listIds)}
                      onToggleList={(listId) => handleToggleList(c, listId)}
                      onCreateList={(name) => handleCreateList(c, name)}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="load-more-row">
        <div ref={sentinelRef} className="load-more-sentinel" />
        <span className="distance-note">
          {loadingMore
            ? "Indlæser flere…"
            : `Viser ${totalLoaded.toLocaleString("da-DK")} af ${total.toLocaleString("da-DK")} virksomheder`}
        </span>
      </div>

      {selected ? (
        <CvrDrawer
          company={selected}
          myName={myName}
          teamLists={teamLists}
          analyzing={analyzingFor === selected.cvrNummer}
          onClose={() => setSelected(null)}
          onToggleStar={() => handleToggleStar(selected)}
          onSetStatus={(status) => handleSetStatus(selected, status)}
          onAssign={() => handleAssign(selected)}
          onRelease={() => handleRelease(selected)}
          onToggleList={(listId) => handleToggleList(selected, listId)}
          onCreateList={(name) => handleCreateList(selected, name)}
          onAnalyze={() => handleAnalyze(selected)}
        />
      ) : null}
    </section>
  );
}
