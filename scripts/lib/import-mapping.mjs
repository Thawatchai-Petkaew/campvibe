/**
 * scripts/lib/import-mapping.mjs — pure, dependency-free mapping functions for
 * scripts/import-linear.mjs (CAM-280 / T-4, ADR-010 "Import risk (T-4)").
 *
 * Extracted into its own module (matching the T-3 precedent — scripts/lib/ticket-sync-mapping.mjs)
 * specifically so vitest can unit-test the Linear -> ADR-010-column decision tables without a
 * live LINEAR_API_KEY or a live DELIVERY_DATABASE_URL. Zero deps, zero side effects, zero I/O —
 * every function here is pure input -> output.
 *
 * This is the REVERSE of lib/delivery/status-adapter.ts's toStatusIssue() (the read path that
 * synthesizes a Ticket row back into the legacy StatusIssue shape) — see
 * docs/adr/ADR-010-self-hosted-delivery-tickets.md "StatusIssue coverage" table. It also
 * reverses the legacy title/epic conventions read by scripts/linear-sync.mjs (epicOf/roleOf/
 * cleanTitle/storyName) and lib/status-derive.ts (roleOf/canonRole/regressionRound) — each
 * function below cites the exact legacy source it mirrors.
 *
 * All real-data claims in the comments below (label names, title patterns, edge cases) were
 * verified by querying the live Linear API (team CAM, includeArchived:true, 282 issues) during
 * T-4 research — not assumed.
 */

// ── role tag <-> DeliveryRole enum ─────────────────────────────────────────────────────────

export const DELIVERY_ROLES = [
  "PRODUCT_OWNER",
  "ANALYST",
  "ARCHITECT",
  "UX_DESIGNER",
  "FRONTEND_ENGINEER",
  "BACKEND_ENGINEER",
  "QA_ENGINEER",
  "SECURITY_REVIEWER",
  "DEVOPS_RELEASE",
];
const ROLE_SLUGS = DELIVERY_ROLES.map((r) => r.toLowerCase().replace(/_/g, "-"));

// Short-hand aliases some legacy [role] title tags used — mirrors lib/status-derive.ts's
// ROLE_ALIASES table exactly (kept in lockstep intentionally, duplicated rather than imported —
// the same zero-dependency reasoning scripts/lib/ticket-sync-mapping.mjs already documents).
// Confirmed present in real title tags: "backend" (x6), "devops" (x1).
const ROLE_ALIASES = {
  backend: "backend-engineer",
  frontend: "frontend-engineer",
  devops: "devops-release",
  designer: "ux-designer",
  design: "ux-designer",
  ux: "ux-designer",
  qa: "qa-engineer",
  security: "security-reviewer",
  pm: "product-owner",
  po: "product-owner",
};

/**
 * roleSlugToEnum — a raw [role] slug (canonical OR alias, e.g. "backend") -> the matching
 * DeliveryRole enum member, or null when the slug is unknown OR is one of the two roles
 * ADR-010 deliberately excludes from the enum: "orchestrator"/"human" (the human's turn is
 * represented by TicketState.AWAITING_GATE + gateRaisedAt, never a currentRole — see
 * prisma/delivery/schema.prisma's DeliveryRole comment). Confirmed real data has both:
 * CAM-11 "[human]" and CAM-172 "[test]" (a demo ticket title, not a role at all) — both
 * correctly fall through to null here.
 */
export function roleSlugToEnum(rawSlug) {
  if (!rawSlug) return null;
  const s = String(rawSlug).toLowerCase();
  const canonical = ROLE_SLUGS.includes(s) ? s : ROLE_ALIASES[s];
  if (!canonical) return null;
  const i = ROLE_SLUGS.indexOf(canonical);
  return i === -1 ? null : DELIVERY_ROLES[i];
}

const ROLE_TAG_RE = /\[([a-z-]+)\]/; // first tag only — mirrors lib/status-derive.ts roleOf()
const ROLE_TAG_STRIP_RE = /\[[a-z-]+\]\s*/g; // ALL tags, global — mirrors scripts/linear-sync.mjs cleanTitle()

/**
 * stripRoleTag — reverses the "[role] title" convention (scripts/linear-sync.mjs roleOf() +
 * cleanTitle(); lib/status-derive.ts roleOf()). Returns the FIRST bracket tag's DeliveryRole (or
 * null if absent/unmappable) + the title with EVERY bracket tag removed. Real data has exactly
 * one title with more than one bracket ("CAM-61 ... /bookings/[id]") — cleanTitle() already
 * strips both today, so stripping all of them here loses nothing new versus the legacy display
 * path; it also means "id" is never mistaken for a role since only the *first* tag is inspected
 * for currentRole.
 */
export function stripRoleTag(title) {
  const raw = String(title ?? "");
  const m = raw.match(ROLE_TAG_RE);
  const role = m ? roleSlugToEnum(m[1]) : null;
  const cleaned = raw.replace(ROLE_TAG_STRIP_RE, "").trim();
  return { role, title: cleaned || raw.trim() };
}

// ── legacy "Epic · Story" title prefix ──────────────────────────────────────────────────────

const EPIC_PREFIX_STRIP_RE = /^[^·]*·\s*/; // mirrors scripts/linear-sync.mjs storyName()

/**
 * splitEpicTitlePrefix — reverses the legacy "Epic · Story" title convention
 * (scripts/linear-sync.mjs epicOf()/storyName()). Callers MUST only treat the returned
 * epicPrefix as meaningful when the issue has NO Linear parent — verified against real team CAM
 * data for T-4: once an issue has a real parent, a "·" inside its title is ordinary punctuation,
 * not the grouping tag (e.g. CAM-239's title contains a "·" mid-sentence with a real parent set;
 * blindly stripping "up to the first ·" there would truncate real content). This function itself
 * is pure text-splitting only — the no-parent gate is enforced by the caller
 * (mapIssueToTicketInput below).
 */
export function splitEpicTitlePrefix(title) {
  const raw = String(title ?? "");
  if (!raw.includes("·")) return { epicPrefix: null, rest: raw };
  const epicPrefix = raw.split("·")[0].trim() || null;
  const rest = raw.replace(EPIC_PREFIX_STRIP_RE, "").trim();
  return { epicPrefix, rest: rest || raw };
}

// ── state + type ────────────────────────────────────────────────────────────────────────────

const STATE_TYPE_MAP = {
  backlog: "BACKLOG",
  unstarted: "TODO",
  started: "IN_PROGRESS", // overridden to AWAITING_GATE below when the awaiting-you label is present
  completed: "DONE",
  canceled: "CANCELED",
};

/**
 * mapState — Linear state.type (+ the awaiting-you label) -> ADR-010 TicketState. Per ADR-010's
 * "StatusIssue coverage" table, AWAITING_GATE synthesizes back to the SAME "started" statusType
 * as IN_PROGRESS (the gate signal rides on the label, not the state name) — so on import the
 * only way to recover AWAITING_GATE from raw Linear data is: state.type === "started" AND the
 * awaiting-you label is present. An unknown/missing state.type defaults to BACKLOG (the safest,
 * least-destructive default — never silently DONE/CANCELED a ticket from a mapping gap).
 */
export function mapState(stateType, hasAwaitingYouLabel) {
  if (stateType === "started" && hasAwaitingYouLabel) return "AWAITING_GATE";
  return STATE_TYPE_MAP[stateType] ?? "BACKLOG";
}

/**
 * mapType — this story's given, literal rule: parentless + has a Linear project => EPIC,
 * everything else => STORY.
 *
 * KNOWN EDGE CASE (flagged, not silently special-cased — see the T-4 handoff report): 11 legacy
 * "Epic · Story"-titled tickets with no parent (CAM-12..18, CAM-128..131) also carry a Linear
 * project (inherited from the team's project-per-feature convention, unrelated to whether the
 * ticket is itself an epic) and are real STORY-level work, not epics — this rule, applied
 * literally, classifies them as EPIC. Confirmed against live team CAM data during T-4 research
 * (all 11 are parentless + project-bearing). Not corrected here because the rule is this story's
 * explicit, given instruction; flagged to the architect/owner to confirm before the real import
 * is ever run against a live DELIVERY_DATABASE_URL.
 */
export function mapType(hasParent, hasProject) {
  if (hasParent) return "STORY";
  return hasProject ? "EPIC" : "STORY";
}

// ── labels -> atomic columns ─────────────────────────────────────────────────────────────────

// Specific -> generic precedence for the rare (1 confirmed: CAM-47 "admin"+"platform") case of
// more than one persona label on the same issue — Persona is a single nullable column.
const PERSONA_PRECEDENCE = ["HOST", "CAMPER", "ADMIN", "PLATFORM"];

/**
 * mapLabels — this story's given "Convention -> columns mapping" for labels, reversed. Every
 * raw label is ALSO preserved verbatim in legacyLabels (the ADR-010 safety net) regardless of
 * whether it was also recognized as a specific column — no information is discarded, including
 * the non-chosen persona label on a multi-persona issue and labels with no known meaning at all
 * (real examples: "Bug", "Feature", "phase-1", "phase-2", "p0", "cancel" — the last one is a
 * real, confirmed data quirk: 11 real tickets carry a "cancel" label while their Linear
 * state.type is still backlog/unstarted, i.e. they were label-tagged for cancellation but never
 * actually moved to Linear's Canceled workflow state — since "cancel" is not one of this story's
 * named label conventions, it lands in legacyLabels only, and mapState() is state.type-driven
 * only, per this story's given rule).
 */
export function mapLabels(labelNames) {
  const names = Array.isArray(labelNames) ? labelNames.map((n) => String(n)) : [];
  const lower = names.map((n) => n.toLowerCase());

  const roleHistory = [];
  for (const n of names) {
    if (!n.toLowerCase().startsWith("role:")) continue;
    const enumRole = roleSlugToEnum(n.slice(5));
    if (enumRole && !roleHistory.includes(enumRole)) roleHistory.push(enumRole);
  }

  // regression:<role>:<n> -> regressionRound = max(n) across every matching label (this story's
  // given rule, verbatim). Real data never has more than one regression:* label on the same
  // ticket, so max(n) and sum(n) (the semantics lib/status-derive.ts's own regressionRound()
  // helper uses for display reconstruction) agree in every real case verified during T-4
  // research — flagged here only so a future multi-label ticket's behavior is documented, not
  // silently ambiguous.
  let regressionRound = 0;
  for (const n of names) {
    const m = n.match(/^regression:[^:]+:(\d+)$/);
    if (m) regressionRound = Math.max(regressionRound, parseInt(m[1], 10));
  }

  let persona = null;
  for (const p of PERSONA_PRECEDENCE) {
    if (lower.includes(p.toLowerCase())) {
      persona = p;
      break;
    }
  }

  return {
    persona,
    roleHistory,
    regressionRound,
    blocked: lower.includes("blocked"),
    gateFlag: lower.includes("awaiting-you"),
    changesRequested: lower.includes("changes-requested"),
    releasedFlag: lower.includes("released"),
    legacyLabels: [...names],
  };
}

// ── epic resolution (pass 2 — pure decision over already-built lookup maps) ────────────────

/**
 * resolveEpicId — pass-2 pure decision: given an issue's raw parent identifier (if any) and its
 * legacy epic-title prefix (if any — only meaningful when there is no parent, see
 * splitEpicTitlePrefix's doc comment and mapIssueToTicketInput below), plus two lookup Maps
 * built from the already-imported ticket set, decide the epicId to wire.
 *
 *   byIdentifier: Map<identifier, { id }>   — every imported ticket, keyed by its CAM-N identifier.
 *   epicTitleIndex: Map<title, { id }>       — EPIC-type tickets only, keyed by their own
 *                                              (role-tag-stripped) title.
 *
 * Pure (no DB access) so the decision table is unit-testable without a live database.
 */
export function resolveEpicId({ parentIdentifier, epicPrefix }, byIdentifier, epicTitleIndex) {
  if (parentIdentifier) {
    const parent = byIdentifier.get(parentIdentifier);
    return parent ? parent.id : null;
  }
  if (epicPrefix) {
    const epic = epicTitleIndex.get(epicPrefix);
    return epic ? epic.id : null;
  }
  return null;
}

// ── the full per-issue composer ─────────────────────────────────────────────────────────────

/**
 * mapIssueToTicketInput — the full per-issue mapping, everything except epicId (wired in pass 2
 * by the caller via resolveEpicId, once every ticket row exists so a parent lookup can never
 * miss purely due to fetch/insert order). `issueNode` is the raw Linear GraphQL issue node shape
 * scripts/import-linear.mjs's query returns (see that file for the exact query).
 *
 * Returns the Prisma `Ticket` create/update payload (identifier/number/title/... — everything
 * in prisma/delivery/schema.prisma's Ticket model except id/epicId/createdAt-by-Prisma-default)
 * PLUS two pass-2-only fields prefixed `_` (not real columns, stripped by the caller before the
 * Prisma call): `_parentIdentifier` and `_epicPrefix`.
 */
export function mapIssueToTicketInput(issueNode) {
  const hasParent = !!issueNode.parent;
  const hasProject = !!issueNode.project;
  const labelNames = (issueNode.labels?.nodes ?? []).map((l) => l.name);
  const labelInfo = mapLabels(labelNames);

  const { role: currentRole, title: titleNoRoleTag } = stripRoleTag(issueNode.title ?? "");

  // The legacy "Epic · Story" prefix is only a real grouping convention when the issue has no
  // Linear parent (splitEpicTitlePrefix's doc comment) — for a parented issue, keep the
  // role-tag-stripped title as-is; a mid-title "·" there is ordinary punctuation, not a tag.
  let epicPrefix = null;
  let title = titleNoRoleTag;
  if (!hasParent) {
    const split = splitEpicTitlePrefix(titleNoRoleTag);
    epicPrefix = split.epicPrefix;
    title = split.rest || titleNoRoleTag;
  }

  const stateType = issueNode.state?.type ?? "backlog";
  const state = mapState(stateType, labelInfo.gateFlag);
  const type = mapType(hasParent, hasProject);

  const priorityRaw = Number.isInteger(issueNode.priority) ? issueNode.priority : 0;
  const priority = Math.min(4, Math.max(0, priorityRaw));

  return {
    identifier: issueNode.identifier,
    number: issueNode.number,
    title,
    description: issueNode.description ?? null,
    type,
    state,
    priority,
    currentRole,
    roleHistory: labelInfo.roleHistory,
    persona: labelInfo.persona,
    featureName: issueNode.project?.name ?? null,
    // Not explicitly named in this story's label/column bullet list, but Linear's `assignee`
    // field was explicitly requested in the fetch — the only Ticket column it can mean is
    // assigneeName (see prisma/delivery/schema.prisma: "[PII] free-text human name"). Every
    // real issue in team CAM is currently assigned to the same one owner (solo-owner pipeline).
    assigneeName: issueNode.assignee?.displayName || issueNode.assignee?.name || null,
    legacyUrl: issueNode.url ?? null,
    legacyLabels: labelInfo.legacyLabels,
    blocked: labelInfo.blocked,
    changesRequested: labelInfo.changesRequested,
    regressionRound: labelInfo.regressionRound,
    // awaiting-you -> gateRaisedAt = updatedAt (this story's given rule, verbatim).
    gateRaisedAt: state === "AWAITING_GATE" ? (issueNode.updatedAt ?? null) : null,
    // released -> releasedAt, using completedAt as the timestamp (this story's given rule,
    // verbatim); completedAt falls back to updatedAt only in the theoretical case of a
    // released-but-not-completedAt row, which has not been observed in real data.
    releasedAt: labelInfo.releasedFlag ? (issueNode.completedAt ?? issueNode.updatedAt ?? null) : null,
    startedAt: issueNode.startedAt ?? null,
    completedAt: issueNode.completedAt ?? null,
    archivedAt: issueNode.archivedAt ?? null,
    createdAt: issueNode.createdAt ?? null,
    updatedAt: issueNode.updatedAt ?? null,
    // pass-2 inputs, not real Ticket columns — stripped by the caller before the Prisma call.
    _parentIdentifier: hasParent ? issueNode.parent.identifier : null,
    _epicPrefix: epicPrefix,
  };
}

/** Comment mapping — TicketComment{ body, authorName, createdAt } per Linear comment node. */
export function mapComment(commentNode) {
  return {
    body: commentNode.body ?? "",
    authorName: commentNode.user?.displayName || commentNode.user?.name || "unknown",
    createdAt: commentNode.createdAt ?? null,
  };
}
