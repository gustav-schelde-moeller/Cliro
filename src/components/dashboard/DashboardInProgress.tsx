"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Company } from "@/lib/companies";
import { LeadDrawer } from "@/components/leads/LeadDrawer";
import type { LeadState } from "@/components/leads/LeadCard";
import { statusLabel } from "@/lib/status";
import { useToast, errorMessage } from "@/components/shared/ToastProvider";
import { setLeadStatusAction, assignToMeAction, releaseAssignmentAction, toggleStarAction } from "@/lib/actions/lead-actions";

export function DashboardInProgress({
  companies,
  teamId,
  myName,
  initialLeads,
  initialStars,
}: {
  companies: Company[];
  teamId: string;
  myName: string;
  initialLeads: Record<number, LeadState>;
  initialStars: number[];
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [leads, setLeads] = useState<Record<number, LeadState>>(initialLeads);
  const [starred, setStarred] = useState<Set<number>>(new Set(initialStars));
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const leadOf = (id: number): LeadState => leads[id] ?? { status: "new", assigneeId: null, assigneeName: null };

  async function handleToggleStar(id: number) {
    const wasStarred = starred.has(id);
    setStarred((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    try {
      await toggleStarAction(id);
    } catch (err) {
      setStarred((prev) => {
        const next = new Set(prev);
        if (wasStarred) next.add(id);
        else next.delete(id);
        return next;
      });
      showToast(errorMessage(err, "Kunne ikke gemme stjernemarkeringen."));
    }
  }

  async function handleSetStatus(id: number, status: string) {
    const prevLead = leadOf(id);
    setLeads((prev) => ({ ...prev, [id]: { ...prevLead, status } }));
    try {
      await setLeadStatusAction(teamId, id, status);
      router.refresh();
    } catch (err) {
      setLeads((prev) => ({ ...prev, [id]: prevLead }));
      showToast(errorMessage(err, "Kunne ikke opdatere status."));
    }
  }

  async function handleAssign(id: number) {
    const prevLead = leadOf(id);
    setLeads((prev) => ({ ...prev, [id]: { ...prevLead, assigneeId: "me", assigneeName: myName } }));
    try {
      await assignToMeAction(teamId, id);
      router.refresh();
    } catch (err) {
      setLeads((prev) => ({ ...prev, [id]: prevLead }));
      showToast(errorMessage(err, "Kunne ikke tildele virksomheden."));
    }
  }

  async function handleRelease(id: number) {
    const prevLead = leadOf(id);
    setLeads((prev) => ({ ...prev, [id]: { ...prevLead, assigneeId: null, assigneeName: null } }));
    try {
      await releaseAssignmentAction(teamId, id);
      router.refresh();
    } catch (err) {
      setLeads((prev) => ({ ...prev, [id]: prevLead }));
      showToast(errorMessage(err, "Kunne ikke frigive tildelingen."));
    }
  }

  const selectedCompany = selectedId != null ? companies.find((c) => c.id === selectedId) ?? null : null;

  if (companies.length === 0) {
    return <div className="dash-empty">Ingen virksomheder i gang endnu. Tildel en virksomhed eller sæt en status for at komme i gang.</div>;
  }

  return (
    <>
      {companies.map((c) => {
        const lead = leadOf(c.id);
        return (
          <button type="button" className="inprogress-row inprogress-row-clickable" key={c.id} onClick={() => setSelectedId(c.id)}>
            <span className="status-pill" data-status={lead.status}>
              {statusLabel(lead.status)}
            </span>
            <b>{c.name}</b>
            <span className="tag">{c.industry}</span>
            {lead.assigneeName ? <span className="assignee-chip">👤 {lead.assigneeName}</span> : null}
          </button>
        );
      })}

      {selectedCompany ? (
        <LeadDrawer
          company={selectedCompany}
          lead={leadOf(selectedCompany.id)}
          starred={starred.has(selectedCompany.id)}
          myName={myName}
          onClose={() => setSelectedId(null)}
          onToggleStar={() => handleToggleStar(selectedCompany.id)}
          onSetStatus={(status) => handleSetStatus(selectedCompany.id, status)}
          onAssign={() => handleAssign(selectedCompany.id)}
          onRelease={() => handleRelease(selectedCompany.id)}
        />
      ) : null}
    </>
  );
}
