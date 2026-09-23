"use client";

import { useState } from "react";
import { useToast, errorMessage } from "@/components/shared/ToastProvider";
import {
  setLeadStatusAction,
  setLeadFollowUpAction,
  assignToMeAction,
  releaseAssignmentAction,
  toggleStarAction,
} from "@/lib/actions/lead-actions";
import { requestNotificationsRefresh } from "@/components/shared/notificationEvents";
import { toggleCompanyInListAction, createListAndAddAction } from "@/lib/actions/list-actions";
import type { LeadState } from "./LeadCard";
import type { TeamListOption } from "./ListMenu";

export function useLeadMutations({
  teamId,
  myName,
  initialLeads,
  initialStars,
  initialTeamLists,
  initialListMemberships,
}: {
  teamId: string;
  myName: string;
  initialLeads: Record<number, LeadState>;
  initialStars: number[];
  initialTeamLists: TeamListOption[];
  initialListMemberships: Record<number, string[]>;
}) {
  const { showToast } = useToast();

  const [leads, setLeads] = useState<Record<number, LeadState>>(initialLeads);
  const [starred, setStarred] = useState<Set<number>>(new Set(initialStars));
  const [teamLists, setTeamLists] = useState<TeamListOption[]>(initialTeamLists);
  const [listMemberships, setListMemberships] = useState<Record<number, string[]>>(initialListMemberships);

  const leadOf = (id: number): LeadState => leads[id] ?? { status: "new", assigneeId: null, assigneeName: null, followUpAt: null };
  const listIdsOf = (id: number): Set<string> => new Set(listMemberships[id] ?? []);

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

  async function handleSetStatus(id: number, status: string, options: { claim?: boolean } = {}) {
    const prevLead = leadOf(id);
    // Mirrors the server: a non-"Ny" status claims an unassigned company
    // (unless the caller opts out), and a won/lost deal drops its follow-up.
    const claim = status !== "new" && options.claim !== false && !prevLead.assigneeId;
    const closed = status === "won" || status === "lost";
    setLeads((prev) => ({
      ...prev,
      [id]: {
        ...prevLead,
        status,
        ...(claim ? { assigneeId: "me", assigneeName: myName } : {}),
        ...(closed ? { followUpAt: null } : {}),
      },
    }));
    try {
      await setLeadStatusAction(teamId, id, status, options);
      if (closed && prevLead.followUpAt) requestNotificationsRefresh();
    } catch (err) {
      setLeads((prev) => ({ ...prev, [id]: prevLead }));
      showToast(errorMessage(err, "Kunne ikke opdatere status."));
    }
  }

  async function handleSetFollowUp(id: number, date: string | null) {
    const prevLead = leadOf(id);
    const claim = date !== null && !prevLead.assigneeId;
    setLeads((prev) => ({
      ...prev,
      [id]: { ...prevLead, followUpAt: date, ...(claim ? { assigneeId: "me", assigneeName: myName } : {}) },
    }));
    try {
      await setLeadFollowUpAction(teamId, id, date);
      requestNotificationsRefresh();
    } catch (err) {
      setLeads((prev) => ({ ...prev, [id]: prevLead }));
      showToast(errorMessage(err, "Kunne ikke gemme opfølgningen."));
    }
  }

  async function handleAssign(id: number) {
    const prevLead = leadOf(id);
    setLeads((prev) => ({ ...prev, [id]: { ...prevLead, assigneeId: "me", assigneeName: myName } }));
    try {
      await assignToMeAction(teamId, id);
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
    } catch (err) {
      setLeads((prev) => ({ ...prev, [id]: prevLead }));
      showToast(errorMessage(err, "Kunne ikke frigive tildelingen."));
    }
  }

  async function handleToggleList(companyId: number, listId: string) {
    const current = listMemberships[companyId] ?? [];
    const next = current.includes(listId) ? current.filter((id) => id !== listId) : [...current, listId];
    setListMemberships((prev) => ({ ...prev, [companyId]: next }));
    try {
      await toggleCompanyInListAction(teamId, listId, companyId);
    } catch (err) {
      setListMemberships((prev) => ({ ...prev, [companyId]: current }));
      showToast(errorMessage(err, "Kunne ikke opdatere listen."));
    }
  }

  async function handleCreateList(companyId: number, name: string) {
    try {
      const newList = await createListAndAddAction(teamId, name, companyId);
      setTeamLists((prev) => [...prev, newList]);
      setListMemberships((prev) => ({ ...prev, [companyId]: [...(prev[companyId] ?? []), newList.id] }));
    } catch (err) {
      showToast(errorMessage(err, "Kunne ikke oprette listen."));
    }
  }

  return {
    leads,
    starred,
    teamLists,
    listMemberships,
    leadOf,
    listIdsOf,
    handleToggleStar,
    handleSetStatus,
    handleSetFollowUp,
    handleAssign,
    handleRelease,
    handleToggleList,
    handleCreateList,
  };
}
