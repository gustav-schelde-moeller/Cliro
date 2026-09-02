"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { haversineKm, type Company } from "@/lib/companies";
import { LeadCard, type LeadState, type TeamListOption } from "./LeadCard";
import { LeadDrawer } from "./LeadDrawer";
import { useLeadMutations } from "./useLeadMutations";
import { useToast } from "@/components/shared/ToastProvider";

const PAGE_SIZE = 6;
const TIER_DEFS = [
  { key: "all", label: "Alle virksomheder" },
  { key: "hot", label: "Varm lead" },
  { key: "warm", label: "God mulighed" },
  { key: "cool", label: "Kan overvejes" },
] as const;
const TODAY_FORMATTER = new Intl.DateTimeFormat("da-DK", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Copenhagen",
});

type Tier = (typeof TIER_DEFS)[number]["key"];
type SortKey = "score" | "recent" | "added" | "name" | "distance";

function isNewCompany(c: Company, todayDa: string): boolean {
  return c.hook.date === todayDa;
}

export function VirksomhederView({
  companies,
  teamId,
  myName,
  initialLeads,
  initialStars,
  initialTeamLists,
  initialListMemberships,
}: {
  companies: Company[];
  teamId: string;
  myName: string;
  initialLeads: Record<number, LeadState>;
  initialStars: number[];
  initialTeamLists: TeamListOption[];
  initialListMemberships: Record<number, string[]>;
}) {
  const { showToast } = useToast();
  const {
    starred,
    teamLists,
    listMemberships,
    leadOf,
    handleToggleStar,
    handleSetStatus,
    handleAssign,
    handleRelease,
    handleToggleList,
    handleCreateList,
  } = useLeadMutations({ teamId, myName, initialLeads, initialStars, initialTeamLists, initialListMemberships });

  const [search, setSearch] = useState("");
  const [tier, setTier] = useState<Tier>("all");
  const [industries, setIndustries] = useState<Set<string>>(new Set());
  const [named, setNamed] = useState(false);
  const [directEmail, setDirectEmail] = useState(false);
  const [starOnly, setStarOnly] = useState(false);
  const [newOnly, setNewOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>("score");
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [maxDistance, setMaxDistance] = useState<number | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);

  const todayDa = TODAY_FORMATTER.format(new Date());

  const INDUSTRIES = useMemo(
    () => Array.from(new Set(companies.map((c) => c.industry))).sort((a, b) => a.localeCompare(b, "da")),
    [companies]
  );
  const newCount = useMemo(() => companies.filter((c) => isNewCompany(c, todayDa)).length, [companies, todayDa]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const list = companies.filter((c) => {
      if (tier !== "all" && c.tier.key !== tier) return false;
      if (industries.size && !industries.has(c.industry)) return false;
      if (named && !c.contact.found) return false;
      if (directEmail && !c.contact.email) return false;
      if (starOnly && !starred.has(c.id)) return false;
      if (newOnly && !isNewCompany(c, todayDa)) return false;
      if (myLocation && maxDistance != null) {
        const d = haversineKm(myLocation.lat, myLocation.lng, c.lat, c.lng);
        if (d > maxDistance) return false;
      }
      if (q) {
        const hay = `${c.name} ${c.industry} ${c.hook.title} ${c.hook.summary}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const copy = list.slice();
    if (sort === "score") copy.sort((a, b) => b.score - a.score);
    else if (sort === "recent") copy.sort((a, b) => b.dateRank - a.dateRank);
    else if (sort === "added") copy.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    else if (sort === "name") copy.sort((a, b) => a.name.localeCompare(b.name, "da"));
    else if (sort === "distance" && myLocation) {
      copy.sort(
        (a, b) =>
          haversineKm(myLocation.lat, myLocation.lng, a.lat, a.lng) - haversineKm(myLocation.lat, myLocation.lng, b.lat, b.lng)
      );
    }
    return copy;
  }, [companies, search, tier, industries, named, directEmail, starOnly, newOnly, todayDa, myLocation, maxDistance, sort, starred]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = filtered.length > visible.length;
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasMore) return;
    const el = loadMoreRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) setVisibleCount((v) => v + PAGE_SIZE);
      },
      { rootMargin: "600px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore]);

  const activeFilterCount =
    (tier !== "all" ? 1 : 0) +
    industries.size +
    (named ? 1 : 0) +
    (directEmail ? 1 : 0) +
    (starOnly ? 1 : 0) +
    (newOnly ? 1 : 0) +
    (myLocation && maxDistance != null ? 1 : 0);

  function resetPaging() {
    setVisibleCount(PAGE_SIZE);
  }

  function toggleIndustry(ind: string) {
    setIndustries((prev) => {
      const next = new Set(prev);
      if (next.has(ind)) next.delete(ind);
      else next.add(ind);
      return next;
    });
    resetPaging();
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
      { timeout: 10000 }
    );
  }

  const selectedCompany = selectedId != null ? companies.find((c) => c.id === selectedId) ?? null : null;

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
            placeholder="Søg på virksomhed, branche eller nyhed…"
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
        <select
          className="sort-select"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
        >
          <option value="score">Sortér: Score (høj → lav)</option>
          <option value="recent">Sortér: Nyeste vinkel</option>
          <option value="added">Sortér: Nyeste tilføjet</option>
          <option value="name">Sortér: Navn (A–Å)</option>
          <option value="distance" disabled={!myLocation}>
            Sortér: Afstand (nærmest)
          </option>
        </select>
        <div className={`info-btn${infoOpen ? " open" : ""}`} onClick={(e) => { e.stopPropagation(); setInfoOpen((v) => !v); }}>
          i
          <div className="info-pop">
            <strong>Om dette udtræk.</strong> <span>{companies.length}</span> rigtige, dybt researchede virksomheder — kun dem, hvor der er en ægte grund til at skrive. Vi udelukker bevidst nyheder, der selv ER en færdig reklamekampagne.
          </div>
        </div>
      </div>

      {filterPanelOpen ? (
        <div className="filter-panel open">
          <div className="filter-section">
            <div className="filter-section-label">Temperatur</div>
            <div className="filter-row">
              {TIER_DEFS.map((t) => (
                <button
                  key={t.key}
                  className={`chip${tier === t.key && t.key === "all" ? " active" : ""}${tier === t.key && t.key !== "all" ? " tier-active" : ""}`}
                  data-tier={t.key}
                  onClick={() => {
                    setTier(t.key);
                    resetPaging();
                  }}
                >
                  {t.label} ({t.key === "all" ? companies.length : companies.filter((c) => c.tier.key === t.key).length})
                </button>
              ))}
            </div>
          </div>
          <div className="filter-section">
            <div className="filter-section-label">Branche</div>
            <div className="filter-row">
              {INDUSTRIES.map((ind) => (
                <button key={ind} className={`chip${industries.has(ind) ? " active" : ""}`} onClick={() => toggleIndustry(ind)}>
                  {ind}
                </button>
              ))}
            </div>
          </div>
          <div className="filter-section">
            <div className="filter-section-label">Andet</div>
            <div className="filter-row">
              <button className={`chip${named ? " active" : ""}`} onClick={() => { setNamed((v) => !v); resetPaging(); }}>
                Navngivet kontakt
              </button>
              <button className={`chip${directEmail ? " active" : ""}`} onClick={() => { setDirectEmail((v) => !v); resetPaging(); }}>
                Har direkte mail
              </button>
              <button className={`chip${starOnly ? " star-active" : ""}`} onClick={() => { setStarOnly((v) => !v); resetPaging(); }}>
                ★ Stjernemarkerede
              </button>
              <button className={`chip${newOnly ? " active" : ""}`} onClick={() => { setNewOnly((v) => !v); resetPaging(); }}>
                Nye i dag ({newCount})
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
                <div className="distance-note">Afstande er omtrentlige (by-niveau for virksomhedens hovedkontor), ikke præcise adresser.</div>
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
                <div className="distance-note">Afstande er omtrentlige (by-niveau for virksomhedens hovedkontor), ikke præcise adresser.</div>
              </div>
            )}
          </div>
          <div className="filter-footer">
            <button
              type="button"
              className="btn"
              onClick={() => {
                setTier("all");
                setIndustries(new Set());
                setNamed(false);
                setDirectEmail(false);
                setStarOnly(false);
                setNewOnly(false);
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

      <div className="list">
        {visible.length === 0 ? (
          <div className="empty">Ingen virksomheder matcher filtrene. Prøv at fjerne et filter.</div>
        ) : (
          visible.map((c, idx) => (
            <LeadCard
              key={c.id}
              company={c}
              lead={leadOf(c.id)}
              starred={starred.has(c.id)}
              isNew={isNewCompany(c, todayDa)}
              teamLists={teamLists}
              listIds={new Set(listMemberships[c.id] ?? [])}
              distanceKm={myLocation ? haversineKm(myLocation.lat, myLocation.lng, c.lat, c.lng) : null}
              index={idx}
              onOpen={() => setSelectedId(c.id)}
              onToggleStar={() => handleToggleStar(c.id)}
              onAssign={() => handleAssign(c.id)}
              onToggleList={(listId) => handleToggleList(c.id, listId)}
              onCreateList={(name) => handleCreateList(c.id, name)}
            />
          ))
        )}
      </div>
      {hasMore ? (
        <div className="load-more-row">
          <div ref={loadMoreRef} className="load-more-sentinel" />
          <button type="button" className="btn" onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}>
            Indlæs flere
          </button>
        </div>
      ) : null}
      <div className="footer-note">Cliro · mails er udkast — læs dem igennem før afsendelse · stjerner er personlige og deles ikke med teamet</div>

      {selectedCompany ? (
        <LeadDrawer
          company={selectedCompany}
          lead={leadOf(selectedCompany.id)}
          starred={starred.has(selectedCompany.id)}
          teamLists={teamLists}
          listIds={new Set(listMemberships[selectedCompany.id] ?? [])}
          myName={myName}
          onClose={() => setSelectedId(null)}
          onToggleStar={() => handleToggleStar(selectedCompany.id)}
          onSetStatus={(status) => handleSetStatus(selectedCompany.id, status)}
          onAssign={() => handleAssign(selectedCompany.id)}
          onRelease={() => handleRelease(selectedCompany.id)}
          onToggleList={(listId) => handleToggleList(selectedCompany.id, listId)}
          onCreateList={(name) => handleCreateList(selectedCompany.id, name)}
        />
      ) : null}
    </section>
  );
}
