import { describe, expect, it } from 'vitest';
import {
  CARD_KEYS,
  CATEGORIES,
  CHARTS,
  EVENTS,
  KINDS,
  PAGES,
  QUERY_SCOPES,
  SCOPES,
  SCOPE_KEYS,
  SERVED_SDK_MAJORS,
  SLOTS,
  TABLES,
  findPage,
  findScope,
  findTable,
  slotsForPage,
} from '../../src/manifest/constants';

describe('registry mirror', () => {
  it('mirrors the backend scope keys in order', () => {
    expect(SCOPE_KEYS).toEqual([
      'ui:render',
      'projects:read',
      'analytics:read',
      'store.metadata:read',
      'reviews:read',
      'crashes:read',
      'revenue:read',
      'metrics:write',
      'alerts:write',
      'insights:write',
      'ai:tools',
      'ai:actions',
      'store.metadata:write',
      'autopilot:trigger',
      'work:create',
      'work:sync',
      'storage:write',
      'messaging:send',
      'ai:skills',
    ]);
  });

  it('marks exactly the four scopes that need security review', () => {
    expect(
      SCOPES.filter(scope => scope.requiresSecurityReview).map(
        scope => scope.key,
      ),
    ).toEqual([
      'ai:actions',
      'store.metadata:write',
      'autopilot:trigger',
      'messaging:send',
    ]);
  });

  it('marks exactly the scopes that need a justification', () => {
    expect(
      SCOPES.filter(scope => scope.requiresJustification).map(
        scope => scope.key,
      ),
    ).toEqual([
      'revenue:read',
      'alerts:write',
      'insights:write',
      'ai:actions',
      'store.metadata:write',
      'autopilot:trigger',
      'work:create',
      'work:sync',
      'messaging:send',
      'ai:skills',
    ]);
  });

  it('mirrors the four host pages with their slots and charts', () => {
    expect(PAGES.map(page => page.key)).toEqual([
      'overview',
      'analytics',
      'deployments',
      'ai_chat',
    ]);
    expect(slotsForPage('analytics')).toEqual([
      'kpi-row',
      'below-chart',
      'sidebar',
    ]);
    expect(slotsForPage('ai_chat')).toEqual([]);
    expect(findPage('overview')?.charts).toEqual(['installs-activity']);
  });

  it('mirrors slots, charts, tables, kinds, categories and events', () => {
    expect(SLOTS).toEqual([
      'kpi-row',
      'insights',
      'sidebar',
      'below-chart',
      'below-list',
    ]);
    expect(CHARTS).toEqual([
      'installs-activity',
      'conversion',
      'release-cadence',
    ]);
    expect(TABLES.map(table => table.key)).toEqual([
      'analytics.keywords',
      'analytics.reviews',
      'deployments.releases',
      'deployments.builds',
    ]);
    expect(KINDS).toEqual([
      'page',
      'tab',
      'widget',
      'series',
      'banner',
      'rowAction',
      'marker',
      'settings',
      'storage',
      'connector',
      'webhook',
      'tool',
      'mention',
      'action',
      'knowledge',
      'skill',
      'prompt',
      'context',
      'work',
    ]);
    expect(CATEGORIES).toEqual([
      'market_data',
      'subscriptions',
      'product_analytics',
      'crashes',
      'attribution',
      'experiments',
      'messaging',
      'session_replay',
      'localization',
      'design',
      'ci_cd',
      'trackers',
      'support',
      'chat',
      'ad_monetization',
      'warehouse',
      'compliance',
      'additional_stores',
    ]);
    expect(EVENTS).toEqual([
      'release.shipped',
      'metadata.changed',
      'keyword.set_changed',
      'screenshots.updated',
      'price.changed',
      'featuring.started',
      'score.changed',
      'incident.opened',
      'incident.resolved',
      'playbook.step_approved',
      'review.thread_opened',
      'review.thread_resolved',
      'approval.requested',
      'digest.sent',
      'install.created',
      'install.paused',
      'install.resumed',
      'install.revoked',
      'install.token_rotated',
      'scopes.changed',
      'settings.changed',
    ]);
  });

  it('serves SDK major 2', () => {
    expect(SERVED_SDK_MAJORS).toEqual([2]);
  });

  it('maps every data query kind to the scope that unlocks it', () => {
    expect(QUERY_SCOPES).toEqual({
      project: 'projects:read',
      series: 'analytics:read',
      keywords: 'store.metadata:read',
      listing: 'store.metadata:read',
      reviews: 'reviews:read',
      crashes: 'crashes:read',
      revenue: 'revenue:read',
    });
  });

  it('looks definitions up by key', () => {
    expect(findScope('storage:write')?.label).toBe('Use hosted storage');
    expect(findScope('nope')).toBeUndefined();
    expect(findTable('analytics.reviews')?.label).toBe('Reviews');
  });

  it('names the keys every card kind carries', () => {
    expect(CARD_KEYS).toEqual({
      value: ['label', 'value'],
      series: ['label', 'points'],
      table: ['columns', 'rows'],
      list: ['items'],
      comparison: ['label', 'left', 'right'],
    });
  });
});
