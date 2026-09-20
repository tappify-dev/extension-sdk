import { describe, expect, it } from 'vitest';
import * as codegen from '../src/codegen';
import * as host from '../src/host';
import * as client from '../src/index';
import * as manifest from '../src/manifest';
import * as server from '../src/server';
import * as testing from '../src/testing';
import * as vite from '../src/vite';

describe('public entries', () => {
  it('exports every vendor UI symbol spec §12.1 lists', () => {
    expect(Object.keys(client).sort()).toEqual(
      [
        'TAP_ERROR_CODES',
        'TapButton',
        'TapCard',
        'TapDialog',
        'TapEmptyState',
        'TapError',
        'TapErrorState',
        'TapForm',
        'TapInput',
        'TapPageHeader',
        'TapSelect',
        'TapServerError',
        'TapSkeleton',
        'TapStat',
        'TapTable',
        'cn',
        'dataQueryKey',
        'formFields',
        'installPrefix',
        'procedurePrefix',
        'procedureQueryKey',
        'storageQueryKey',
        'useTap',
        'useTapAuth',
        'useTapContext',
        'useTapFilters',
        'useTapParams',
        'useTapProject',
        'useTapQuery',
        'useTapServer',
        'useTapSize',
        'useTapState',
        'useTapStorage',
        'useTapTheme',
      ].sort(),
    );
  });

  it('exports every vendor server symbol spec §12.1 lists and nothing else', () => {
    expect(Object.keys(server).sort()).toEqual(
      [
        'DEFAULT_JWKS_URL',
        'SERVER_ERROR_CODES',
        'TapServerError',
        'createTappifyHandler',
        'sendEvent',
        'signWebhook',
        'toExpress',
        'toNode',
        'verifyTappifyToken',
      ].sort(),
    );
  });

  it('exports the four host symbols and nothing else', () => {
    expect(Object.keys(host).sort()).toEqual([
      'TapContext',
      'TapHostProvider',
      'collectStyles',
      'createHostQueryClient',
    ]);
  });

  it('exports the build-time surface the CLI and vite config use', () => {
    expect(Object.keys(vite).sort()).toEqual([
      'VIRTUAL_PREFIX',
      'collectEntryStyles',
      'inlineCssImports',
      'tappifyExtension',
    ]);
    expect(Object.keys(codegen).sort()).toEqual([
      'GENERATED_HEADER',
      'generateTypes',
    ]);
  });

  it('exports the testing surface spec §12.3 lists and nothing else', () => {
    expect(Object.keys(testing).sort()).toEqual(
      [
        'answerFixtureQuery',
        'createTapMock',
        'createTestClient',
        'fixtureApps',
        'fixtureCrashes',
        'fixtureKeywords',
        'fixtureListings',
        'fixtureProject',
        'fixtureReleases',
        'fixtureRevenue',
        'fixtureReviews',
        'fixtureSeries',
        'fixtures',
        'installHostTheme',
        'registerTapMatchers',
        'renderWithTap',
        'signTestToken',
        'tapMatchers',
        'testJwks',
        'validateMetricsResponse',
        'validateToolResponse',
      ].sort(),
    );
  });

  it('exports the manifest surface every repo shares', () => {
    for (const name of [
      'CARD_KEYS',
      'CATEGORIES',
      'CHARTS',
      'EVENTS',
      'KINDS',
      'PAGES',
      'PAGE_KEYS',
      'QUERY_SCOPES',
      'SCOPES',
      'SCOPE_KEYS',
      'SERVED_SDK_MAJORS',
      'SLOTS',
      'TABLES',
      'TABLE_KEYS',
      'defineManifest',
      'exposeName',
      'findPage',
      'findScope',
      'findTable',
      'manifestJsonSchema',
      'manifestSchema',
      'remoteName',
      'sdkMajors',
      'slotsForPage',
      'uiContributions',
      'validateManifest',
    ]) {
      expect(manifest).toHaveProperty(name);
    }
  });
});
