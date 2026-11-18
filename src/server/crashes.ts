/** One crash group as the crash reporter holds it. */
export interface CrashGroup {
  /** The crash reporter's own id for the group, unique in one answer. */
  externalId: string;
  /** What identifies the crash, such as the exception and the frame it was thrown in. */
  signature: string;
  /** `null` when the reporter does not say which store app crashed. */
  platform: 'ios' | 'android' | null;
  /** Distinct users who hit this crash, a whole number from 0. */
  affectedUsers: number;
  /** Sessions that hit this crash, a whole number from 0. */
  affectedSessions: number;
  /** Whether the crash is happening more, less or as often as before. */
  trend: 'up' | 'down' | 'stable';
  /** An ISO 8601 instant, or `null` when the reporter has none. */
  firstSeen: string | null;
  /** An ISO 8601 instant, or `null` when the reporter has none. */
  lastSeen: string | null;
  /** The app version the crash first appeared in, or `null` when unknown. */
  versionFirstSeen: string | null;
}

/** Where to start reading crash groups from. */
export interface CrashGroupsInput {
  /** An ISO 8601 instant; `null` on the first sync, which answers every group. */
  since: string | null;
}

/** The crash groups seen since the instant the call asked for. */
export interface CrashGroupsResult {
  /** Each group once, empty when the reporter has no crash groups since then. */
  groups: CrashGroup[];
}

/** The crash group to answer details for. */
export interface CrashDetailsInput {
  /** A group's `externalId`, as a groups answer returned it. */
  externalId: string;
}

/** One crash group's stack trace and the events leading up to it. */
export interface CrashDetails {
  /** The `externalId` the call asked for. */
  externalId: string;
  /** The stack trace as text, or `null` when the reporter has none. */
  stackTrace: string | null;
  /** The events the reporter recorded before the crash, oldest first. */
  breadcrumbs: { category: string; message: string; level: string }[];
  /** The release the crash was reported from, or `null` when unknown. */
  release: string | null;
  /** The environment the crash was reported from, or `null` when unknown. */
  environment: string | null;
}

/** Host-to-extension crashes operations. */
export interface CrashesOperationMap {
  /** `POST /tappify/crashes/groups`: the crash groups seen since an instant. */
  groups: { input: CrashGroupsInput; output: CrashGroupsResult };
  /** `POST /tappify/crashes/details`: one group's stack trace and breadcrumbs. */
  details: { input: CrashDetailsInput; output: CrashDetails };
}
