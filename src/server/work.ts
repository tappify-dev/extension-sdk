import type { WorkContribution } from '../manifest/types';

/** The provider stage used by the manifest's legacy status mapping. */
export type WorkStage = keyof NonNullable<
  NonNullable<WorkContribution['status']>['map']
>;

/** JSON-safe values supplied for provider create fields. */
export type WorkCreateFieldValues = Record<
  string,
  string | number | boolean | string[] | null
>;

/** Logical mutation identity, stable across transport retries. */
export interface WorkMutationInput {
  idempotencyKey: string;
  /** The source occurrence time as an ISO 8601 string. */
  occurredAt: string;
}

/** A provider destination available to this install's credentials. */
export interface WorkContainer {
  id: string;
  label: string;
  url?: string;
  parentId?: string;
}

/** An exact provider status and its normalized Review stage. */
export interface WorkStatus {
  id: string;
  label: string;
  /** Both open and in_progress represent an open Review thread. */
  stage: WorkStage;
}

/** Provision or rotate the install's dedicated work-event callback. */
export interface WorkConfigureInput extends WorkMutationInput {
  callbackUrl: string;
  /** Store encrypted with the install's provider webhook routing record. */
  secret: string;
  generation: number;
  configurationRevision: number;
  containerId: string;
  itemTypeId: string;
  fields: WorkCreateFieldValues;
  openStatusId: string;
  resolvedStatusId: string;
  commentsEnabled: boolean;
}

/** Callback generation acknowledged by the provider and its webhook registrations. */
export interface WorkConfigureResult {
  generation: number;
  configurationRevision: number;
  registeredWebhookIds: string[];
}

/** Optional filters and pagination for destination discovery. */
export interface WorkListContainersInput {
  /** Opaque provider pagination token; pass through unchanged. */
  cursor?: string;
  query?: string;
  parentId?: string;
}

/** One page of available provider destinations. */
export interface WorkListContainersResult {
  containers: WorkContainer[];
  /** Omitted or null when no further page exists. */
  cursor?: string | null;
}

/** The destination whose current workflow metadata the host needs. */
export interface WorkDescribeContainerInput {
  containerId: string;
}

/** A selectable provider item type within a destination. */
export interface WorkItemType {
  id: string;
  label: string;
}

/** A create form field, including whether it is required and supported choices. */
export interface WorkCreateField {
  id: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'string[]';
  required: boolean;
  options?: { value: string; label: string }[];
  /** Restrict a field to these item types, when workflows differ. */
  itemTypeIds?: string[];
}

/** Current create requirements and exact statuses for one destination. */
export interface WorkDescribeContainerResult {
  container: WorkContainer;
  itemTypes: WorkItemType[];
  createFields: WorkCreateField[];
  statuses: WorkStatus[];
}

/** A short-lived screenshot URL; refreshed by the host for each retry. */
export interface ReviewImageAttachmentDescriptor {
  kind: 'image';
  attachmentId: string;
  url: string;
  mediaType: string;
  fileName: string;
}

/** A Tappify deep link that can be attached independently of a screenshot. */
export interface ReviewLinkAttachmentDescriptor {
  kind: 'link';
  attachmentId: string;
  url: string;
  title?: string;
}

/** An image or link attached after the external item has been linked. */
export type ReviewAttachmentDescriptor =
  | ReviewImageAttachmentDescriptor
  | ReviewLinkAttachmentDescriptor;

/** Scope-approved snapshot used to create an item for a Review thread. */
export interface ReviewThreadSource {
  threadId: string;
  projectId: string;
  appId: string;
  buildVersion: string | null;
  buildNumber: string | null;
  screenId: string;
  screenName?: string;
  /** Coordinates normalized to the screen's width and height. */
  pin: { x: number; y: number };
  firstComment: {
    id: string;
    body: string;
    authorDisplayName: string;
    createdAt: string;
  };
  device: Record<string, string | number | boolean | null>;
  deepLink: string;
  screenshot?: ReviewImageAttachmentDescriptor;
}

/** Create one provider item from the Review snapshot and owner-selected fields. */
export interface WorkCreateInput extends WorkMutationInput {
  containerId: string;
  itemTypeId: string;
  fields: WorkCreateFieldValues;
  source: ReviewThreadSource;
}

/** Stable provider identity and display metadata persisted with the Review link. */
export interface WorkItemLinkResult {
  externalItemId: string;
  displayKey: string;
  url: string;
  title: string;
  status: WorkStatus;
  providerVersion?: string;
  updatedAt?: string;
}

/** Identity carried on operations for an existing Review-to-provider link. */
export interface WorkLinkedItemInput {
  linkId: string;
  externalItemId: string;
  threadId: string;
}

/** Attach one image or link without recreating the provider item. */
export interface WorkAttachInput
  extends WorkMutationInput, WorkLinkedItemInput {
  attachment: ReviewAttachmentDescriptor;
}

/** The attachment identity when the provider exposes one. */
export interface WorkAttachResult {
  externalAttachmentId?: string;
}

/** Append one Review comment to an existing provider item. */
export interface WorkCommentInput
  extends WorkMutationInput, WorkLinkedItemInput {
  commentId: string;
  body: string;
  authorDisplayName: string;
  createdAt: string;
}

/** Provider comment identity and time used to suppress webhook echoes. */
export interface WorkCommentResult {
  externalCommentId: string;
  createdAt: string;
  providerVersion?: string;
}

/** Apply the owner's exact provider status for an open or resolved Review thread. */
export interface WorkSetStatusInput
  extends WorkMutationInput, WorkLinkedItemInput {
  tappifyStatus: 'open' | 'resolved';
  /** The exact provider target selected in destination configuration. */
  providerStatusId: string;
}

/** Resulting provider status and optional version used to suppress webhook echoes. */
export interface WorkSetStatusResult {
  status: WorkStatus;
  providerVersion?: string;
  updatedAt?: string;
}

/** Common identity for a fully hydrated provider signal. */
export interface WorkHydratedEventBase {
  externalItemId: string;
  providerEventId: string;
  dedupeKey: string;
  occurredAt: string;
  providerVersion?: string;
}

/** A complete append-only provider comment signal. */
export interface WorkHydratedCommentCreatedEvent extends WorkHydratedEventBase {
  type: 'comment.created';
  comment: {
    externalCommentId: string;
    body: string;
    author: { id: string; displayName: string };
    createdAt: string;
  };
}

/** A complete provider status-change signal. */
export interface WorkHydratedStatusChangedEvent extends WorkHydratedEventBase {
  type: 'status.changed';
  status: WorkStatus;
}

/** A provider item deletion signal. */
export interface WorkHydratedItemDeletedEvent extends WorkHydratedEventBase {
  type: 'item.deleted';
}

/** Complete event content, with no opaque hydration reference remaining. */
export type WorkHydratedEvent =
  | WorkHydratedCommentCreatedEvent
  | WorkHydratedStatusChangedEvent
  | WorkHydratedItemDeletedEvent;

/** Resolve an opaque provider webhook reference using current install credentials. */
export interface WorkHydrateEventInput extends WorkLinkedItemInput {
  hydrateRef: string;
}

/** Fully normalized content fetched for an opaque provider webhook reference. */
export interface WorkHydrateEventResult {
  event: WorkHydratedEvent;
}

/** Clean up install-wide webhooks while provider credentials remain available. */
export interface WorkDisconnectInput extends WorkMutationInput {
  generation: number;
  registeredWebhookIds: string[];
}

/** Provider webhook registrations successfully removed during cleanup. */
export interface WorkDisconnectResult {
  removedWebhookIds: string[];
}

/** Current host-to-extension work protocol. Legacy routes are excluded. */
export interface WorkOperationMap {
  configure: { input: WorkConfigureInput; output: WorkConfigureResult };
  list_containers: {
    input: WorkListContainersInput;
    output: WorkListContainersResult;
  };
  describe_container: {
    input: WorkDescribeContainerInput;
    output: WorkDescribeContainerResult;
  };
  create: { input: WorkCreateInput; output: WorkItemLinkResult };
  attach: { input: WorkAttachInput; output: WorkAttachResult };
  comment: { input: WorkCommentInput; output: WorkCommentResult };
  set_status: { input: WorkSetStatusInput; output: WorkSetStatusResult };
  hydrate_event: {
    input: WorkHydrateEventInput;
    output: WorkHydrateEventResult;
  };
  disconnect: { input: WorkDisconnectInput; output: WorkDisconnectResult };
}
