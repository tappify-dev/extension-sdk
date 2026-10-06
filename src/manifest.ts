export {
  CARD_KEYS,
  CATEGORIES,
  CHARTS,
  EVENTS,
  KINDS,
  PAGES,
  PAGE_KEYS,
  QUERY_SCOPES,
  SCOPES,
  SCOPE_KEYS,
  SERVED_SDK_MAJORS,
  SLOTS,
  TABLES,
  TABLE_KEYS,
  findPage,
  findScope,
  findTable,
  slotsForPage,
} from './manifest/constants';
export type {
  ContributionKind,
  DataQueryKind,
  ExtensionCategory,
  HostChart,
  HostEventName,
  HostPage,
  HostTable,
  PageDefinition,
  ScopeDefinition,
  ScopeKey,
  SlotId,
  TableDefinition,
} from './manifest/constants';
export {
  defineManifest,
  exposeName,
  remoteName,
  uiContributions,
} from './manifest/define';
export {
  manifestJsonSchema,
  manifestSchema,
  sdkMajors,
  validateManifest,
} from './manifest/schema';
export type * from './manifest/types';
