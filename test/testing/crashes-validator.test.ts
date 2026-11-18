import { describe, expect, it } from 'vitest';
import type { CrashDetails, CrashGroup } from '../../src/server';
import {
  validateCrashDetails,
  validateCrashGroupsResult,
} from '../../src/testing';

const group: CrashGroup = {
  externalId: 'SENTRY-1',
  signature: 'EXC_BAD_ACCESS in renderFrame',
  platform: 'ios',
  affectedUsers: 12,
  affectedSessions: 30,
  trend: 'up',
  firstSeen: '2026-11-01T09:30:00Z',
  lastSeen: '2026-11-17T22:04:11.512+01:00',
  versionFirstSeen: '2.4.0',
};

const other: CrashGroup = {
  externalId: 'SENTRY-2',
  signature: 'NullPointerException in CheckoutActivity.onResume',
  platform: null,
  affectedUsers: 0,
  affectedSessions: 0,
  trend: 'stable',
  firstSeen: null,
  lastSeen: null,
  versionFirstSeen: null,
};

const details: CrashDetails = {
  externalId: 'SENTRY-1',
  stackTrace: '0 App 0x1 renderFrame + 12',
  breadcrumbs: [
    { category: 'navigation', message: 'Opened Checkout', level: 'info' },
  ],
  release: '2.4.0 (310)',
  environment: null,
};

function checkGroups(...groups: unknown[]): string[] {
  return validateCrashGroupsResult({ groups });
}

describe('validateCrashGroupsResult', () => {
  it('accepts a sound answer', () => {
    expect(checkGroups(group, other)).toEqual([]);
    expect(validateCrashGroupsResult({ groups: [] })).toEqual([]);
  });

  it('names the body shape', () => {
    for (const body of [null, [], {}, { groups: {} }]) {
      expect(validateCrashGroupsResult(body)).toEqual([
        'A crash groups answer is { "groups": [...] }. Return the array, empty when there are no crash groups.',
      ]);
    }
  });

  it('refuses a group that is not an object', () => {
    expect(checkGroups('SENTRY-1')).toEqual([
      'groups[0] is not an object. A crash group is { "externalId": "...", "signature": "...", ... }.',
    ]);
  });

  it('refuses a group without a non-empty string externalId', () => {
    const { externalId: _externalId, ...missing } = group;
    expect(
      checkGroups(
        missing,
        { ...other, externalId: '' },
        { ...other, externalId: 7 },
      ),
    ).toEqual([
      "groups[0].externalId is missing. Use your crash reporter's own id for the group, a non-empty string.",
      'groups[1].externalId is "". Use your crash reporter\'s own id for the group, a non-empty string.',
      "groups[2].externalId is 7. Use your crash reporter's own id for the group, a non-empty string.",
    ]);
  });

  it('refuses a group without a non-empty string signature', () => {
    const { signature: _signature, ...missing } = group;
    expect(checkGroups(missing, { ...other, signature: '' })).toEqual([
      'groups[0].signature is missing. A signature is a non-empty string such as "EXC_BAD_ACCESS in renderFrame".',
      'groups[1].signature is "". A signature is a non-empty string such as "EXC_BAD_ACCESS in renderFrame".',
    ]);
  });

  it('refuses a platform other than ios, android or null', () => {
    const { platform: _platform, ...missing } = other;
    expect(checkGroups({ ...group, platform: 'web' }, missing)).toEqual([
      'groups[0].platform is "web". Use ios, android or null.',
      'groups[1].platform is missing. Use ios, android or null.',
    ]);
  });

  it('refuses affectedUsers that is not a non-negative integer', () => {
    expect(
      checkGroups(
        { ...group, affectedUsers: -1 },
        { ...other, affectedUsers: 1.5 },
        { ...group, externalId: 'SENTRY-3', affectedUsers: '12' },
      ),
    ).toEqual([
      'groups[0].affectedUsers is -1. Counts are whole numbers from 0, such as 120.',
      'groups[1].affectedUsers is 1.5. Counts are whole numbers from 0, such as 120.',
      'groups[2].affectedUsers is "12". Counts are whole numbers from 0, such as 120.',
    ]);
  });

  it('refuses affectedSessions that is not a non-negative integer', () => {
    const { affectedSessions: _sessions, ...missing } = group;
    expect(checkGroups(missing, { ...other, affectedSessions: -3 })).toEqual([
      'groups[0].affectedSessions is missing. Counts are whole numbers from 0, such as 120.',
      'groups[1].affectedSessions is -3. Counts are whole numbers from 0, such as 120.',
    ]);
  });

  it('refuses a trend other than up, down or stable', () => {
    expect(checkGroups({ ...group, trend: 'rising' })).toEqual([
      'groups[0].trend is "rising". Use up, down or stable.',
    ]);
  });

  it('refuses a timestamp that is neither null nor an ISO instant', () => {
    expect(
      checkGroups(
        { ...group, firstSeen: '2026-11-01' },
        { ...other, lastSeen: 'yesterday' },
        { ...group, externalId: 'SENTRY-3', lastSeen: 1763000000 },
      ),
    ).toEqual([
      'groups[0].firstSeen is "2026-11-01". Use null or an ISO 8601 instant such as "2026-11-01T09:30:00Z".',
      'groups[1].lastSeen is "yesterday". Use null or an ISO 8601 instant such as "2026-11-01T09:30:00Z".',
      'groups[2].lastSeen is 1763000000. Use null or an ISO 8601 instant such as "2026-11-01T09:30:00Z".',
    ]);
  });

  it('refuses a versionFirstSeen that is neither a string nor null', () => {
    expect(checkGroups({ ...group, versionFirstSeen: 3 })).toEqual([
      'groups[0].versionFirstSeen is 3. Use the app version as a string, such as "2.4.0", or null.',
    ]);
    expect(checkGroups({ ...group, versionFirstSeen: null })).toEqual([]);
    expect(checkGroups({ ...group, versionFirstSeen: '2.4.0' })).toEqual([]);
  });

  it('refuses two groups with the same externalId', () => {
    expect(
      checkGroups(group, other, { ...other, externalId: 'SENTRY-1' }),
    ).toEqual(['groups[2] repeats "SENTRY-1". Return each group once.']);
  });
});

describe('validateCrashDetails', () => {
  it('accepts a sound answer', () => {
    expect(validateCrashDetails(details)).toEqual([]);
    expect(
      validateCrashDetails({
        externalId: 'SENTRY-2',
        stackTrace: null,
        breadcrumbs: [],
        release: null,
        environment: 'production',
      }),
    ).toEqual([]);
  });

  it('names the body shape', () => {
    expect(validateCrashDetails([])).toEqual([
      'A crash details answer is { "externalId": "...", "stackTrace": ..., "breadcrumbs": [...], "release": ..., "environment": ... }.',
    ]);
  });

  it('refuses a missing externalId', () => {
    const { externalId: _externalId, ...missing } = details;
    expect(validateCrashDetails(missing)).toEqual([
      'externalId is missing. Answer with the externalId the call asked for.',
    ]);
    expect(validateCrashDetails({ ...details, externalId: '' })).toEqual([
      'externalId is "". Answer with the externalId the call asked for.',
    ]);
  });

  it('refuses a stackTrace, release or environment that is neither a string nor null', () => {
    const { release: _release, ...missing } = details;
    expect(
      validateCrashDetails({
        ...missing,
        stackTrace: ['frame'],
        environment: 3,
      }),
    ).toEqual([
      'stackTrace is ["frame"]. Use a string or null.',
      'release is missing. Use a string or null.',
      'environment is 3. Use a string or null.',
    ]);
  });

  it('refuses breadcrumbs that are not an array', () => {
    expect(validateCrashDetails({ ...details, breadcrumbs: null })).toEqual([
      'breadcrumbs is null. Return the array, empty when the crash has no breadcrumbs.',
    ]);
  });

  it('refuses a breadcrumb missing a string category, message or level', () => {
    expect(
      validateCrashDetails({
        ...details,
        breadcrumbs: [
          { message: 'Opened Checkout', level: 'info' },
          { category: 'http', message: 404, level: 'error' },
          { category: 'ui', message: 'Tapped Pay' },
          'Opened Checkout',
        ],
      }),
    ).toEqual([
      'breadcrumbs[0].category is missing. Each breadcrumb has a string category, message and level.',
      'breadcrumbs[1].message is 404. Each breadcrumb has a string category, message and level.',
      'breadcrumbs[2].level is missing. Each breadcrumb has a string category, message and level.',
      'breadcrumbs[3] is not an object. A breadcrumb is { "category": "...", "message": "...", "level": "..." }.',
    ]);
  });
});
