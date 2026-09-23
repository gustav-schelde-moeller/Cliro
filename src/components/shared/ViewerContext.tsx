"use client";

import { createContext, useContext } from "react";

export type Viewer = { userId: string; isAdmin: boolean };

const ViewerContext = createContext<Viewer>({ userId: "", isAdmin: false });

export function ViewerProvider({ viewer, children }: { viewer: Viewer; children: React.ReactNode }) {
  return <ViewerContext.Provider value={viewer}>{children}</ViewerContext.Provider>;
}

export function useViewer(): Viewer {
  return useContext(ViewerContext);
}

// "me" is the optimistic stand-in for the viewer's own id until the server
// round-trip replaces it.
export function isViewer(viewer: Viewer, assigneeId: string | null): boolean {
  return assigneeId !== null && (assigneeId === viewer.userId || assigneeId === "me");
}

// Mirrors the server rule in the lead actions: you can change a company's
// status/follow-up when it's yours or unassigned — admins, anyone's.
export function canEditPipeline(viewer: Viewer, assigneeId: string | null): boolean {
  return viewer.isAdmin || assigneeId === null || isViewer(viewer, assigneeId);
}
