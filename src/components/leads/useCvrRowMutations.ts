"use client";

import { useState } from "react";
import { useToast, errorMessage } from "@/components/shared/ToastProvider";
import { setCvrLeadStatusAction, assignCvrToMeAction, releaseCvrAssignmentAction, toggleCvrStarAction } from "@/lib/actions/cvr-lead-actions";
import { toggleCvrCompanyInListAction, createCvrListAndAddAction } from "@/lib/actions/list-actions";
import type { TeamListOption } from "./ListMenu";
import type { CvrCompanyRow } from "./CvrBrowser";

type RowsSetter = (updater: (prev: CvrCompanyRow[]) => CvrCompanyRow[]) => void;
type SelectedSetter = (updater: (prev: CvrCompanyRow | null) => CvrCompanyRow | null) => void;

// CVR's rows are server-paginated/accumulating (unlike the AI-lead side's
// static in-memory array, see useLeadMutations.ts), so mutation state lives
// directly on the row objects (rows/selected, owned by CvrBrowser) rather
// than in a separate keyed map — the caller always has the row in hand when
// invoking a handler, so there's no need to re-derive "previous state" here.
export function useCvrRowMutations({
  teamId,
  myName,
  initialTeamLists,
  setRows,
  setSelected,
}: {
  teamId: string;
  myName: string;
  initialTeamLists: TeamListOption[];
  setRows: RowsSetter;
  setSelected: SelectedSetter;
}) {
  const { showToast } = useToast();
  const [teamLists, setTeamLists] = useState<TeamListOption[]>(initialTeamLists);
  const [analyzingFor, setAnalyzingFor] = useState<string | null>(null);

  function patch(cvrNummer: string, next: Partial<CvrCompanyRow>) {
    setRows((prev) => prev.map((r) => (r.cvrNummer === cvrNummer ? { ...r, ...next } : r)));
    setSelected((prev) => (prev && prev.cvrNummer === cvrNummer ? { ...prev, ...next } : prev));
  }

  async function handleSetStatus(row: CvrCompanyRow, status: string) {
    const prevPipeline = row.pipeline;
    patch(row.cvrNummer, {
      pipeline: { status, assigneeId: prevPipeline?.assigneeId ?? null, assigneeName: prevPipeline?.assigneeName ?? null },
    });
    try {
      await setCvrLeadStatusAction(teamId, row.cvrNummer, status);
    } catch (err) {
      patch(row.cvrNummer, { pipeline: prevPipeline });
      showToast(errorMessage(err, "Kunne ikke opdatere status."));
    }
  }

  async function handleAssign(row: CvrCompanyRow) {
    const prevPipeline = row.pipeline;
    patch(row.cvrNummer, { pipeline: { status: prevPipeline?.status ?? "new", assigneeId: "me", assigneeName: myName } });
    try {
      await assignCvrToMeAction(teamId, row.cvrNummer);
    } catch (err) {
      patch(row.cvrNummer, { pipeline: prevPipeline });
      showToast(errorMessage(err, "Kunne ikke tildele virksomheden."));
    }
  }

  async function handleRelease(row: CvrCompanyRow) {
    const prevPipeline = row.pipeline;
    patch(row.cvrNummer, { pipeline: prevPipeline ? { ...prevPipeline, assigneeId: null, assigneeName: null } : null });
    try {
      await releaseCvrAssignmentAction(teamId, row.cvrNummer);
    } catch (err) {
      patch(row.cvrNummer, { pipeline: prevPipeline });
      showToast(errorMessage(err, "Kunne ikke frigive tildelingen."));
    }
  }

  async function handleToggleStar(row: CvrCompanyRow) {
    const prevStarred = row.starred;
    patch(row.cvrNummer, { starred: !prevStarred });
    try {
      await toggleCvrStarAction(row.cvrNummer);
    } catch (err) {
      patch(row.cvrNummer, { starred: prevStarred });
      showToast(errorMessage(err, "Kunne ikke gemme stjernemarkeringen."));
    }
  }

  async function handleToggleList(row: CvrCompanyRow, listId: string) {
    const prevListIds = row.listIds;
    const nextListIds = prevListIds.includes(listId) ? prevListIds.filter((id) => id !== listId) : [...prevListIds, listId];
    patch(row.cvrNummer, { listIds: nextListIds });
    try {
      await toggleCvrCompanyInListAction(teamId, listId, row.cvrNummer);
    } catch (err) {
      patch(row.cvrNummer, { listIds: prevListIds });
      showToast(errorMessage(err, "Kunne ikke opdatere listen."));
    }
  }

  async function handleCreateList(row: CvrCompanyRow, name: string) {
    try {
      const newList = await createCvrListAndAddAction(teamId, name, row.cvrNummer);
      setTeamLists((prev) => [...prev, newList]);
      patch(row.cvrNummer, { listIds: [...row.listIds, newList.id] });
    } catch (err) {
      showToast(errorMessage(err, "Kunne ikke oprette listen."));
    }
  }

  // No optimistic update here — there's nothing sensible to show before the
  // real research result arrives, just a loading state (analyzingFor) the
  // drawer reads to disable its button and show progress copy.
  async function handleAnalyze(row: CvrCompanyRow) {
    setAnalyzingFor(row.cvrNummer);
    try {
      const res = await fetch(`/api/cvr/analyze/${row.cvrNummer}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Kunne ikke analysere virksomheden.");
      patch(row.cvrNummer, { analysis: data });
    } catch (err) {
      showToast(errorMessage(err, "Kunne ikke analysere virksomheden."));
    } finally {
      setAnalyzingFor(null);
    }
  }

  return {
    teamLists,
    analyzingFor,
    handleSetStatus,
    handleAssign,
    handleRelease,
    handleToggleStar,
    handleToggleList,
    handleCreateList,
    handleAnalyze,
  };
}
