// /status/map — shared data model types for the CampsiteScene client and its
// server-side projectors (lib/status-map-model.ts, lib/map-delivery.ts) and
// overlay components (campsite-overlays.tsx, delivery-gift.tsx).
//
// CAM-372 (S1a): extracted verbatim from campsite-scene.tsx so a future
// renderer seam (S1b/S1c) can depend on the data shape without importing the
// scene component itself. Pure types only — no React import, no "use client".

export interface MapAgent {
  role: string;         // canonical role key, e.g. "frontend-engineer"
  name: string;         // display name (Thai-friendly short name)
  active: boolean;      // rmap[role].active > 0
  done: number;
  activeCount: number;
  queued: number;       // total - done - active (stories not yet started)
  /** Active task for this agent (null when idle). epicKey + feature power Map↔Board/Filter sync (SMUX-3). */
  task: { id: string; title: string; startedAt: string | null; epicKey: string; feature: string } | null;
}

// Gate item for the You → Gates panel.
export interface MapGate {
  id: string;
  title: string;       // raw title (caller uses cleanTitle on it)
  url: string;
  epicKey: string;     // first "·" segment of the title, or ""
  priority: string;    // e.g. "High", "Urgent"
}

// Backlog story item for the Backlog overlay.
export interface MapBacklogItem {
  id: string;
  title: string;       // cleaned (no epic prefix, no [role] tag)
  role: string;        // canonical role for grouping
  epicKey: string;
}

// Environment lane item for the Environments overlay.
export interface MapEnvItem {
  id: string;
  title: string;       // cleaned display title
  role: string;        // display role label
}

/** Minimal serialisable story shape for per-epic Trail/Board/Up-next (client-side derive). */
export interface MapEpicStory {
  id: string;
  title: string;        // cleaned (no epic prefix, no [role] tag)
  status: string;       // e.g. "In Progress", "Done", "Backlog"
  statusType: string;   // backlog | unstarted | started | completed | canceled
  labels: string[];     // needed for hasAwait / epicBucket / rolesOf
  role: string;         // canonical role from [role] tag (may be "")
  url: string;
  startedAt: string | null;
  completedAt: string | null;
  // CAM-342 (additive, optional -- backward-compatible with existing MapEpicStory[] fixtures
  // elsewhere in the test suite): model-tier trial instrumentation, pass-through of
  // Ticket.agentModel. Absent/"" (not stamped) renders no chip on the active card
  // (BR-2/EC-1) -- never a placeholder.
  agentModel?: string;
}

/** One epic as projected for the map client. */
export interface MapEpicItem {
  key: string;          // epic key used as ?epic= value
  label: string;        // display name
  feature: string;      // Linear project / feature name
  persona: string;      // persona label ("" = none)
  bucket: "prog" | "done" | "todo";  // from epicBucket()
  stories: MapEpicStory[];
}

export interface MapModel {
  projectPct: number;
  gates: MapGate[];
  agents: MapAgent[];     // the 7 build-roles, always present
  epicNames: string[];
  // S4 overlay data — all derived server-side from Model
  epicsActive: number;
  totalEpics: number;
  backlogItems: MapBacklogItem[];
  envLanes: {
    dev: MapEnvItem[];
    staging: MapEnvItem[];
    prod: MapEnvItem[];
  };
  // S5 addition — per-epic story data for Trail/Board/Up-next client-side derive
  epics: MapEpicItem[];
}

/** S1b/S1c seam: the imperative handle a future renderer implementation (Canvas/WebGL/etc.)
 *  exposes to CampsiteScene, mirroring the subset of SceneHandle/EngineHandle it needs. */
export interface RendererHandle {
  setActivity: (activeByRole: Record<string, boolean>) => void;
  setScope: (scope: "all" | "epic", epicRoles: string[]) => void;
  triggerWalk?: (role: string, toNode?: string) => void;
}
