import type { AdsLevel } from '../manifest/constants';
import type { WorkMutationInput } from './work';

/** An amount as a decimal string such as `"12.50"`, with its ISO 4217 currency. */
export interface AdsMoney {
  amount: string;
  currency: string;
}

/** A budget and the period it is spent over. */
export interface AdsBudget extends AdsMoney {
  period: 'daily' | 'lifetime';
}

/** The normalized state of an item; a deleted item is answered as `removed`. */
export type AdsItemStatus = 'active' | 'paused' | 'removed';

/** An ad account this install's credentials can reach. */
export interface AdsAccount {
  id: string;
  name: string;
  /** The account's ISO 4217 currency. */
  currency: string;
  /** The account's IANA time zone, which every date in a sync is read in. */
  timeZone: string;
}

/** Pagination for account discovery. */
export interface AdsListAccountsInput {
  /** Opaque pagination token; pass through unchanged. */
  cursor?: string;
}

/** One page of the accounts available to this install. */
export interface AdsListAccountsResult {
  accounts: AdsAccount[];
  /** Omitted or null on the last page. */
  cursor?: string | null;
}

/** One campaign, ad group, keyword or other item at a declared level. */
export interface AdsItem {
  level: AdsLevel;
  id: string;
  /** Required on every level except `campaign`. */
  parentId?: string;
  name: string;
  status: AdsItemStatus;
  /** The network's own status label, shown beside the normalized one. */
  networkStatus?: string;
  budget?: AdsBudget;
  bid?: AdsMoney;
  /** The store's own app id, set on campaigns. */
  storeAppId?: string;
  platform?: 'ios' | 'android';
  url?: string;
}

/** One item's numbers for one day. */
export interface AdsDailyRow {
  level: AdsLevel;
  itemId: string;
  /** `YYYY-MM-DD` in the account's time zone. */
  date: string;
  impressions?: number;
  clicks?: number;
  installs?: number;
  /** A decimal string such as `"12.50"`, in the account's currency. */
  spend?: string;
  /** The extra metrics the manifest declares, keyed by metric key. */
  extra?: Record<string, number>;
}

/** The account and the days to answer items and daily rows for. */
export interface AdsSyncInput {
  accountId: string;
  /** `YYYY-MM-DD` in the account's time zone, both ends included. */
  window: { start: string; end: string };
  /** Opaque pagination token; pass through unchanged. */
  cursor?: string;
}

/** One page of an account's items and their daily rows. */
export interface AdsSyncResult {
  items: AdsItem[];
  rows: AdsDailyRow[];
  /** Omitted or null on the last page. */
  cursor?: string | null;
}

/** One change to one item, of a kind the manifest declares for its level. */
export type AdsChange =
  | { type: 'status'; status: 'active' | 'paused' }
  | { type: 'name'; name: string }
  | { type: 'budget'; budget: AdsBudget }
  | { type: 'bid'; bid: AdsMoney }
  | { type: 'delete' };

/** Apply one change to one item on the network. */
export interface AdsApplyChangeInput extends WorkMutationInput {
  accountId: string;
  level: AdsLevel;
  itemId: string;
  change: AdsChange;
}

/** The item as the network holds it after the change; a deleted item is `removed`. */
export interface AdsApplyChangeResult {
  item: AdsItem;
}

/** Host-to-extension ads operations. */
export interface AdsOperationMap {
  list_accounts: { input: AdsListAccountsInput; output: AdsListAccountsResult };
  sync: { input: AdsSyncInput; output: AdsSyncResult };
  apply_change: { input: AdsApplyChangeInput; output: AdsApplyChangeResult };
}
