import { describe, expect, expectTypeOf, it } from 'vitest';
import { z } from 'zod';
import { workManifestWarnings } from '../../src/manifest';
import {
  AI_INPUT_SCHEMA_MAX_BYTES,
  AI_SCHEMA_TEXT_MAX,
  manifestJsonSchema,
  manifestSchema,
  sdkMajors,
  validateManifest,
} from '../../src/manifest/schema';
import type {
  AdsContribution,
  ConnectorAuth,
  CrashesContribution,
  ExtensionManifest,
  KeywordDataContribution,
  MetricDeclaration,
  OAuthTokenRequestEncoding,
  WorkContribution,
} from '../../src/manifest/types';

function base(): ExtensionManifest {
  return {
    id: 'funnel-lab',
    name: 'Funnel Lab',
    description: 'Shows where installs drop out of the store funnel.',
    icon: 'icon.svg',
    category: 'product_analytics',
    sdk: '^2.0.0',
    visibility: 'private',
    installScope: 'project',
    scopes: [{ key: 'ui:render' }, { key: 'analytics:read' }],
    contributes: {
      widgets: [
        {
          id: 'funnel',
          title: 'Funnel',
          entry: 'src/widgets/funnel.tsx',
          page: 'analytics',
          slot: 'kpi-row',
          size: '1x1',
        },
      ],
    },
  };
}

function withTool(input: Record<string, unknown>): ExtensionManifest {
  const manifest = base();
  manifest.scopes.push({ key: 'ai:tools' });
  manifest.server = { baseUrl: 'https://api.funnel-lab.dev' };
  manifest.contributes.ai = {
    tools: [
      {
        id: 'compare',
        description: 'Compare two releases of this app.',
        input,
        returns: 'comparison',
        cost: 'low',
      },
    ],
  };
  return manifest;
}

function issues(manifest: unknown): string[] {
  const result = validateManifest(manifest);
  return result.ok
    ? []
    : result.issues.map(issue => `${issue.path}: ${issue.message}`);
}

function withWork() {
  const manifest = base();
  manifest.scopes.push(
    { key: 'review.threads:read' },
    {
      key: 'work:create',
      justification:
        'Create issues from Review threads in the selected project.',
    },
  );
  manifest.server = { baseUrl: 'https://api.funnel-lab.dev' };
  const work: WorkContribution = {
    kind: 'tracker',
    creates: ['issue'],
    identity: 'install',
    comments: {
      direction: 'none',
      supportsEdits: false,
      supportsDeletes: false,
    },
    attachments: ['image', 'link'],
    auth: { method: 'oauth', provider: 'clickup', scopes: [] },
  };
  return { ...manifest, contributes: { ...manifest.contributes, work } };
}

function legacyWork(): ExtensionManifest {
  const manifest: ExtensionManifest = withWork();
  manifest.scopes = manifest.scopes.filter(
    scope => scope.key !== 'review.threads:read',
  );
  manifest.scopes.push(
    { key: 'reviews:read' },
    {
      key: 'work:sync',
      justification: 'Sync comments and status with the linked work item.',
    },
  );
  manifest.contributes.work = {
    kind: 'tracker',
    creates: ['issue'],
    identity: 'install',
    container: { label: 'Project', list: '/projects' },
    fields: { priority: ['High', 'Low'], labels: true, required: ['title'] },
    comments: 'two-way',
    status: {
      webhook: 'issue.updated',
      map: { open: ['Open'], in_progress: ['Working'], done: ['Done'] },
    },
    attachments: ['image', 'link'],
  };
  return manifest;
}

describe('connector OAuth token request encoding', () => {
  function withOAuth(encoding: Record<string, unknown> = {}) {
    const manifest = base();
    manifest.server = { baseUrl: 'https://extension.example' };
    manifest.contributes.connector = {
      auth: {
        method: 'oauth',
        oauth: {
          authorizationUrl: 'https://provider.example/authorize',
          tokenUrl: 'https://provider.example/token',
          scopes: ['metrics:read'],
          ...encoding,
        },
      },
    };
    return manifest;
  }

  it('keeps omitted encoding valid without adding a parsed default', () => {
    const parsed = manifestSchema.parse(withOAuth());

    expect(parsed.contributes.connector?.auth?.oauth).not.toHaveProperty(
      'tokenRequestEncoding',
    );
  });

  it.each(['form', 'json'] as const)(
    'accepts and preserves %s encoding',
    tokenRequestEncoding => {
      const parsed = manifestSchema.parse(withOAuth({ tokenRequestEncoding }));

      expect(
        parsed.contributes.connector?.auth?.oauth?.tokenRequestEncoding,
      ).toBe(tokenRequestEncoding);
    },
  );

  it.each(['xml', 'FORM', '', null, true, 1, [], {}])(
    'rejects unsupported encoding %j',
    tokenRequestEncoding => {
      expect(issues(withOAuth({ tokenRequestEncoding })).join()).toContain(
        'contributes.connector.auth.oauth.tokenRequestEncoding',
      );
    },
  );

  it('uses the shared optional encoding type in connector OAuth', () => {
    expectTypeOf<OAuthTokenRequestEncoding>().toEqualTypeOf<'form' | 'json'>();
    expectTypeOf<
      NonNullable<ConnectorAuth['oauth']>['tokenRequestEncoding']
    >().toEqualTypeOf<OAuthTokenRequestEncoding | undefined>();
  });
});

describe('work capabilities', () => {
  it('accepts current comments and status capabilities with OAuth', () => {
    const manifest = withWork();
    manifest.contributes.work!.status = { direction: 'none' };

    expect(issues(manifest)).toEqual([]);
    expect(workManifestWarnings(manifest)).toEqual([]);
  });

  it('accepts work API-key credential fields', () => {
    const manifest = withWork();
    manifest.contributes.work!.auth = {
      method: 'api_key',
      fields: [
        { name: 'token', label: 'Token', type: 'password', required: true },
      ],
    };

    expect(issues(manifest)).toEqual([]);
  });

  it('requires work:create even when no capability syncs', () => {
    const manifest = withWork();
    manifest.scopes = manifest.scopes.filter(
      scope => scope.key !== 'work:create',
    );

    expect(issues(manifest).join()).toContain('Add the work:create scope');
  });

  it('requires Review-thread access for the current shape even with store reviews', () => {
    const manifest = withWork();
    manifest.scopes = manifest.scopes.filter(
      scope => scope.key !== 'review.threads:read',
    );
    manifest.scopes.push({ key: 'reviews:read' });

    expect(issues(manifest).join()).toContain(
      'Add the review.threads:read scope',
    );
  });

  it.each(['to_provider', 'from_provider', 'two-way'] as const)(
    'requires work:sync for %s comments',
    direction => {
      const manifest = withWork();
      manifest.contributes.work!.comments = {
        direction,
        supportsEdits: false,
        supportsDeletes: false,
      };

      expect(issues(manifest).join()).toContain('Add the work:sync scope');

      manifest.scopes.push({
        key: 'work:sync',
        justification:
          'Sync comments with the linked work item in this project.',
      });
      expect(issues(manifest)).toEqual([]);
    },
  );

  it.each(['to_provider', 'from_provider', 'two-way'] as const)(
    'requires work:sync for %s status',
    direction => {
      const manifest = withWork();
      manifest.contributes.work!.status = { direction };

      expect(issues(manifest).join()).toContain('Add the work:sync scope');

      manifest.scopes.push({
        key: 'work:sync',
        justification: 'Sync status with the linked work item in this project.',
      });
      expect(issues(manifest)).toEqual([]);
    },
  );

  it('rejects current work without auth, including mixed legacy fields', () => {
    const manifest = withWork();
    const { auth: _auth, ...work } = manifest.contributes.work!;

    expect(validateManifest({ ...manifest, contributes: { work } }).ok).toBe(
      false,
    );
    expect(
      validateManifest({
        ...manifest,
        contributes: {
          work: {
            ...work,
            container: { label: 'Project', list: '/projects' },
            fields: { required: [] },
          },
        },
      }).ok,
    ).toBe(false);
  });

  it.each(['current', 'legacy'] as const)(
    'explains unsupported per-user identity for %s work',
    shape => {
      const manifest = shape === 'current' ? withWork() : legacyWork();
      manifest.contributes.work!.identity = 'user';

      expect(issues(manifest).join()).toContain(
        'Per-user work identity is not supported',
      );
    },
  );

  it.each(['supportsEdits', 'supportsDeletes'] as const)(
    'rejects unsupported comment capability %s',
    capability => {
      const manifest = withWork();
      expect(
        validateManifest({
          ...manifest,
          contributes: {
            work: {
              ...manifest.contributes.work,
              comments: {
                direction: 'none',
                supportsEdits: false,
                supportsDeletes: false,
                [capability]: true,
              },
            },
          },
        }).ok,
      ).toBe(false);
    },
  );

  it('preserves complete legacy work and reports each migration separately', () => {
    const result = validateManifest(legacyWork());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const warnings = workManifestWarnings(result.manifest);
    expect(warnings.map(warning => warning.path)).toEqual([
      'contributes.work.container',
      'contributes.work.fields',
      'contributes.work.comments',
      'contributes.work.status.map',
      'scopes',
    ]);
    expect(warnings.map(warning => warning.message).join()).toContain(
      'describe_container',
    );
    expect(warnings.map(warning => warning.message).join()).toContain(
      'review.threads:read',
    );
  });

  it('normalizes a legacy status map as inbound status sync', () => {
    const manifest = legacyWork();
    manifest.contributes.work!.comments = 'none';
    manifest.scopes = manifest.scopes.filter(
      scope => scope.key !== 'work:sync',
    );

    expect(issues(manifest).join()).toContain('Add the work:sync scope');
    delete manifest.contributes.work!.status;
    expect(issues(manifest)).toEqual([]);
  });

  it('requires work:create for legacy work', () => {
    const manifest = legacyWork();
    manifest.scopes = manifest.scopes.filter(
      scope => scope.key !== 'work:create',
    );

    expect(issues(manifest).join()).toContain('Add the work:create scope');
  });

  it('allows legacy work to migrate to the Review-thread scope', () => {
    const manifest = legacyWork();
    manifest.scopes = manifest.scopes.filter(
      scope => scope.key !== 'reviews:read',
    );
    manifest.scopes.push({ key: 'review.threads:read' });

    expect(issues(manifest)).toEqual([]);
    expect(
      workManifestWarnings(manifest).map(warning => warning.path),
    ).not.toContain('scopes');
  });

  it('warns on deprecated fields in an authenticated work manifest', () => {
    const manifest = withWork();
    manifest.contributes.work = {
      ...manifest.contributes.work,
      comments: 'none',
      container: { label: 'Project', list: '/projects' },
      fields: { required: [] },
    };

    expect(issues(manifest)).toEqual([]);
    expect(workManifestWarnings(manifest).map(warning => warning.path)).toEqual(
      [
        'contributes.work.container',
        'contributes.work.fields',
        'contributes.work.comments',
      ],
    );
  });

  it('does not deprecate store-review access for manifests without work', () => {
    const manifest = base();
    manifest.scopes.push({ key: 'reviews:read' });

    expect(workManifestWarnings(manifest)).toEqual([]);
  });
});

describe('manifestSchema', () => {
  it('accepts a minimal widget-only manifest', () => {
    expect(manifestSchema.safeParse(base()).success).toBe(true);
  });

  it('rejects an id that is not a lowercase slug', () => {
    expect(issues({ ...base(), id: 'Funnel Lab' }).join()).toContain('id');
  });

  it('rejects unknown top-level keys', () => {
    expect(issues({ ...base(), placements: [] }).join()).toContain(
      'placements',
    );
  });

  it('rejects a slot that does not belong to its page', () => {
    const manifest = base();
    manifest.contributes.widgets![0].slot = 'below-list';

    expect(issues(manifest).join()).toContain(
      'Slot "below-list" is not on the analytics page',
    );
  });

  it('requires ui:render when a UI contribution exists', () => {
    const manifest = base();
    manifest.scopes = [{ key: 'analytics:read' }];

    expect(issues(manifest).join()).toContain('Add the ui:render scope');
  });

  it('requires storage:write when storage is declared', () => {
    const manifest = base();
    manifest.contributes.storage = {
      preferences: {
        scope: 'user',
        singleton: true,
        schema: { type: 'object' },
      },
    };

    expect(issues(manifest).join()).toContain('Add the storage:write scope');
  });

  it('reserves the settings collection name', () => {
    const manifest = base();
    manifest.scopes.push({ key: 'storage:write' });
    manifest.contributes.storage = {
      settings: {
        scope: 'install',
        singleton: true,
        schema: { type: 'object' },
      },
    };

    expect(issues(manifest).join()).toContain('reserved');
  });

  it('requires a justification on scopes that ask for one', () => {
    const manifest = base();
    manifest.scopes.push({ key: 'revenue:read' });

    expect(issues(manifest).join()).toContain(
      'revenue:read needs a justification',
    );
  });

  it('requires server.baseUrl when procedures or ai exist', () => {
    const manifest = base();
    manifest.contributes.ai = {
      tools: [
        {
          id: 'compare',
          description: 'Compare two releases',
          input: { type: 'object' },
          returns: 'comparison',
          cost: 'low',
        },
      ],
    };
    manifest.scopes.push({ key: 'ai:tools' });

    expect(issues(manifest).join()).toContain('Set server.baseUrl');
  });

  it('refuses a tool input schema past the size Tappify accepts', () => {
    const manifest = withTool({
      type: 'object',
      properties: {
        note: { type: 'string', description: 'n'.repeat(AI_SCHEMA_TEXT_MAX) },
      },
      examples: Array.from({ length: 200 }, () => 'x'.repeat(100)),
    });

    expect(issues(manifest).join()).toContain(
      `Tappify accepts at most ${AI_INPUT_SCHEMA_MAX_BYTES}`,
    );
  });

  it('refuses prose inside an input schema longer than a description', () => {
    const manifest = withTool({
      type: 'object',
      properties: {
        stage: {
          type: 'string',
          description: 'd'.repeat(AI_SCHEMA_TEXT_MAX + 1),
        },
      },
    });

    expect(issues(manifest).join()).toContain(
      `A "description" inside this input schema is longer than ${AI_SCHEMA_TEXT_MAX}`,
    );
  });

  it('accepts an input schema inside both bounds', () => {
    const manifest = withTool({
      type: 'object',
      properties: {
        stage: { type: 'string', title: 'Stage', description: 'Which step.' },
      },
    });

    expect(issues(manifest)).toEqual([]);
  });

  it('requires a complete listing when visibility is public', () => {
    const manifest = base();
    manifest.visibility = 'public';
    manifest.listing = { website: 'https://funnel-lab.dev' };

    const joined = issues(manifest).join();
    expect(joined).toContain('longDescription, screenshots, supportUrl');
    expect(joined).not.toContain('website');
  });

  it('accepts a partial listing while the extension is not public', () => {
    const manifest = base();
    manifest.listing = { website: 'https://funnel-lab.dev' };

    expect(issues(manifest)).toEqual([]);
  });

  it('forbids project surfaces on an organization install', () => {
    const manifest = base();
    manifest.installScope = 'organization';

    expect(issues(manifest).join()).toContain(
      'Organization-scoped extensions cannot contribute widgets',
    );
  });

  it('rejects an sdk range the host does not serve', () => {
    expect(issues({ ...base(), sdk: '^1.0.0' }).join()).toContain(
      'SDK major 2',
    );
  });

  it('rejects the reserved pricing and score blocks', () => {
    expect(issues({ ...base(), pricing: { plan: 'free' } }).join()).toContain(
      'pricing',
    );
    expect(issues({ ...base(), score: {} }).join()).toContain('score');
  });

  it('rejects telemetry names that are not snake_case', () => {
    expect(
      issues({ ...base(), telemetry: ['summaryViewed'] }).join(),
    ).toContain('snake_case');
  });

  it('caps UI contributions at twenty', () => {
    const manifest = base();
    manifest.contributes.widgets = Array.from({ length: 21 }, (_, index) => ({
      id: `w${index}`,
      title: 'W',
      entry: 'src/w.tsx',
      page: 'analytics' as const,
      slot: 'kpi-row' as const,
      size: '1x1' as const,
    }));

    expect(issues(manifest).join()).toContain('20 UI contributions');
  });

  it('binds a series to a declared connector metric', () => {
    const manifest = base();
    manifest.scopes.push({ key: 'metrics:write' });
    manifest.server = { baseUrl: 'https://api.funnel-lab.dev' };
    manifest.contributes.connector = {
      metrics: [
        {
          key: 'active_users',
          label: 'Active users',
          unit: 'count',
          kind: 'gauge',
        },
      ],
    };
    manifest.contributes.series = [
      { id: 'active', label: 'Active', chart: 'conversion', metric: 'ghost' },
    ];

    expect(issues(manifest).join()).toContain(
      'Metric "ghost" is not declared by the connector',
    );
  });

  it('binds a banner to a webhook declared as a banner', () => {
    const manifest = base();
    manifest.scopes.push({
      key: 'alerts:write',
      justification:
        'The banner tells the owner when the store funnel drops sharply.',
    });
    manifest.server = { baseUrl: 'https://api.funnel-lab.dev' };
    manifest.contributes.banners = [
      { id: 'drop', page: 'analytics', event: 'anomaly.detected' },
    ];

    expect(issues(manifest).join()).toContain(
      'Event "anomaly.detected" is not declared under webhooks',
    );

    manifest.contributes.webhooks = [
      { event: 'anomaly.detected', as: 'event', payload: { type: 'object' } },
    ];

    expect(issues(manifest).join()).toContain('Declare it with as: "banner"');

    manifest.contributes.webhooks = [
      { event: 'anomaly.detected', as: 'banner', payload: { type: 'object' } },
    ];

    expect(validateManifest(manifest).ok).toBe(true);
  });

  it('binds a marker to a webhook declared as an event', () => {
    const manifest = base();
    manifest.scopes.push({
      key: 'alerts:write',
      justification:
        'Markers show the owner when a rollout started on the chart.',
    });
    manifest.server = { baseUrl: 'https://api.funnel-lab.dev' };
    manifest.contributes.markers = [
      {
        id: 'rollout',
        label: 'Rollout',
        chart: '*',
        event: 'rollout.started',
        glyph: '⚑',
      },
    ];
    manifest.contributes.webhooks = [
      { event: 'rollout.started', as: 'banner', payload: { type: 'object' } },
    ];

    expect(issues(manifest).join()).toContain(
      'Event "rollout.started" is not declared under webhooks. Declare it with as: "event".',
    );

    manifest.contributes.webhooks = [
      { event: 'rollout.started', as: 'event', payload: { type: 'object' } },
    ];

    expect(validateManifest(manifest).ok).toBe(true);
  });

  it('requires ui:render and alerts:write when markers are declared', () => {
    const manifest = base();
    manifest.scopes = [{ key: 'analytics:read' }];
    manifest.server = { baseUrl: 'https://api.funnel-lab.dev' };
    manifest.contributes.markers = [
      {
        id: 'rollout',
        label: 'Rollout',
        chart: 'conversion',
        event: 'rollout.started',
        glyph: '⚑',
      },
    ];
    manifest.contributes.webhooks = [
      { event: 'rollout.started', as: 'event', payload: { type: 'object' } },
    ];

    const found = issues(manifest).join();

    expect(found).toContain(
      'Add the ui:render scope: markers draw on a host chart.',
    );
    expect(found).toContain(
      'Add the alerts:write scope: markers come from declared webhooks.',
    );
  });

  it('caps procedures at thirty and requires input and output schemas', () => {
    const manifest = base();
    manifest.server = {
      baseUrl: 'https://api.funnel-lab.dev',
      procedures: {
        getFunnel: { input: { type: 'object' }, output: { type: 'object' } },
      },
    };

    expect(validateManifest(manifest).ok).toBe(true);

    manifest.server.procedures = Object.fromEntries(
      Array.from({ length: 31 }, (_, index) => [
        `getFunnel${index}`,
        { input: { type: 'object' }, output: { type: 'object' } },
      ]),
    );

    expect(issues(manifest).join()).toContain(
      'An extension declares at most 30 procedures.',
    );

    expect(
      issues({
        ...base(),
        server: {
          baseUrl: 'https://api.funnel-lab.dev',
          procedures: { getFunnel: { input: { type: 'object' } } },
        },
      }).join(),
    ).toContain('server.procedures.getFunnel.output');
  });

  it('rejects a procedure name that is not an identifier', () => {
    const manifest = base();
    manifest.server = {
      baseUrl: 'https://api.funnel-lab.dev',
      procedures: {
        'get summary': {
          input: { type: 'object' },
          output: { type: 'object' },
        },
      },
    };

    expect(issues(manifest).join()).toContain(
      'Procedure names are identifiers such as "getSummary" or "get-summary"',
    );
  });

  it('accepts a dashed procedure name', () => {
    const manifest = base();
    manifest.server = {
      baseUrl: 'https://api.funnel-lab.dev',
      procedures: {
        'get-summary': {
          input: { type: 'object' },
          output: { type: 'object' },
        },
      },
    };

    expect(validateManifest(manifest).ok).toBe(true);
  });

  it('accepts catalogue events the vendor server subscribes to', () => {
    const manifest = base();
    manifest.server = {
      baseUrl: 'https://api.funnel-lab.dev',
      events: ['install.created', 'release.shipped'],
    };

    expect(validateManifest(manifest).ok).toBe(true);
  });

  it('rejects a server event the catalogue does not publish', () => {
    const manifest = {
      ...base(),
      server: {
        baseUrl: 'https://api.funnel-lab.dev',
        events: ['anomaly.detected'],
      },
    };

    expect(issues(manifest).join()).toContain(
      'server.events.0: "anomaly.detected" is not a Tappify event',
    );
  });
});

describe('manifestSchema types', () => {
  it('parses to exactly the ExtensionManifest interface', () => {
    expectTypeOf<
      z.infer<typeof manifestSchema>
    >().toEqualTypeOf<ExtensionManifest>();
    expectTypeOf<ExtensionManifest>().toEqualTypeOf<
      z.infer<typeof manifestSchema>
    >();
  });
});

function adsManifest(): ExtensionManifest & {
  contributes: { ads: AdsContribution };
} {
  const manifest = base();
  const ads: AdsContribution = {
    auth: { method: 'oauth', provider: 'example-ads', scopes: ['ads.read'] },
    sync: '1h',
    backfillDays: 30,
    acquisition: {
      levels: [
        { level: 'campaign', label: 'Campaign', changes: ['status', 'budget'] },
        { level: 'ad_group', label: 'Ad set', changes: ['status', 'bid'] },
      ],
      metrics: [
        { key: 'impressions', definition: 'Times an ad was shown.' },
        { key: 'spend', definition: 'Amount billed, in the account currency.' },
      ],
      extraMetrics: [
        {
          key: 'video_views',
          label: 'Video views',
          unit: 'count',
          definition: 'Plays of three seconds or more.',
        },
      ],
    },
  };
  return {
    ...manifest,
    scopes: [
      ...manifest.scopes,
      {
        key: 'ads:sync',
        justification: 'Bring campaign data into the Ads section.',
      },
      {
        key: 'ads:manage',
        justification: 'Apply the changes an owner approves.',
      },
    ],
    contributes: { ...manifest.contributes, ads },
    server: { baseUrl: 'https://ads.example.com' },
  };
}

function withoutScope(
  manifest: ExtensionManifest,
  key: ExtensionManifest['scopes'][number]['key'],
): ExtensionManifest {
  return {
    ...manifest,
    scopes: manifest.scopes.filter(scope => scope.key !== key),
  };
}

describe('ads network', () => {
  it('accepts an acquisition network', () => {
    expect(issues(adsManifest())).toEqual([]);
  });

  it('keeps manifests without an ad network valid', () => {
    expect(issues(base())).toEqual([]);
  });

  it('needs a campaign level', () => {
    const manifest = adsManifest();
    manifest.contributes.ads.acquisition.levels = [
      { level: 'ad_group', label: 'Ad set' },
    ];

    expect(issues(manifest).join()).toContain(
      'An ad network declares a campaign level. Add { "level": "campaign" } to acquisition.levels.',
    );
  });

  it('refuses a level declared twice', () => {
    const manifest = adsManifest();
    manifest.contributes.ads.acquisition.levels.push({
      level: 'ad_group',
      label: 'Ad group',
    });

    expect(issues(manifest).join()).toContain(
      'acquisition.levels lists ad_group twice. Declare each level once.',
    );
  });

  it('refuses a create panel that reuses a detail panel id', () => {
    const manifest = adsManifest();
    manifest.contributes.ads.acquisition.detailPanels = [
      { id: 'panel', level: 'campaign', entry: 'src/panels/detail.tsx' },
    ];
    manifest.contributes.ads.acquisition.createPanel = {
      id: 'panel',
      entry: 'src/panels/create.tsx',
    };

    expect(issues(manifest).join()).toContain(
      'Two panels are named "panel". Give each panel its own id.',
    );
  });

  it('refuses more than 20 extra numbers', () => {
    const manifest = adsManifest();
    manifest.contributes.ads.acquisition.extraMetrics = Array.from(
      { length: 21 },
      (_, index) => ({
        key: `extra_${index}`,
        label: `Extra ${index}`,
        unit: 'count' as const,
        definition: 'One more number from the network.',
      }),
    );

    expect(issues(manifest)).not.toEqual([]);
  });

  it('refuses an extra number that reuses a shared key', () => {
    const manifest = adsManifest();
    manifest.contributes.ads.acquisition.extraMetrics = [
      {
        key: 'clicks',
        label: 'Clicks',
        unit: 'count',
        definition: 'Taps on an ad that open the store.',
      },
    ];

    expect(issues(manifest).join()).toContain(
      '"clicks" is a shared number. Declare it under acquisition.metrics instead.',
    );
  });

  it.each(['attribution', 'monetization'])(
    'refuses the %s role until it is built',
    role => {
      const manifest = adsManifest();
      const withRole = {
        ...manifest,
        contributes: {
          ...manifest.contributes,
          ads: { ...manifest.contributes.ads, [role]: {} },
        },
      };

      expect(issues(withRole).join()).toContain(
        `The ${role} role is not available yet. Declare acquisition only.`,
      );
    },
  );

  it('caps backfill at 90 days', () => {
    const manifest = adsManifest();
    manifest.contributes.ads.backfillDays = 91;

    expect(issues(manifest)).not.toEqual([]);
  });

  it('asks for ads:sync', () => {
    expect(issues(withoutScope(adsManifest(), 'ads:sync')).join()).toContain(
      'Add the ads:sync scope: this extension brings ads data into Tappify.',
    );
  });

  it('asks for ads:manage when a level can be changed', () => {
    expect(issues(withoutScope(adsManifest(), 'ads:manage')).join()).toContain(
      'Add the ads:manage scope: a declared level can be changed from Tappify.',
    );
  });

  it('does not ask for ads:manage on a read-only network', () => {
    const manifest = adsManifest();
    manifest.contributes.ads.acquisition.levels = [
      { level: 'campaign', label: 'Campaign' },
      { level: 'ad_group', label: 'Ad set' },
    ];

    expect(issues(withoutScope(manifest, 'ads:manage'))).toEqual([]);
  });

  it('refuses a change a level cannot carry', () => {
    const manifest = adsManifest();
    manifest.contributes.ads.acquisition.levels[0] = {
      level: 'campaign',
      label: 'Campaign',
      changes: ['bid'],
    };

    expect(issues(manifest).join()).toContain(
      'A campaign cannot change bid. It can change: status, name, budget, delete.',
    );
  });

  it('refuses a keyword budget', () => {
    const manifest = adsManifest();
    manifest.contributes.ads.acquisition.levels.push({
      level: 'keyword',
      label: 'Keyword',
      changes: ['budget'],
    });

    expect(issues(manifest).join()).toContain(
      'A keyword cannot change budget. It can change: status, bid, delete.',
    );
  });

  it('needs a server', () => {
    const { server: _server, ...manifest } = adsManifest();

    expect(issues(manifest).join()).toContain(
      'work destinations, ad networks and procedures all call your server.',
    );
  });

  it('asks for ui:render when it draws a panel', () => {
    const manifest = adsManifest();
    manifest.contributes = { ads: manifest.contributes.ads };
    manifest.contributes.ads.acquisition.detailPanels = [
      { id: 'targeting', level: 'campaign', entry: 'src/ads/targeting.tsx' },
    ];

    expect(issues(withoutScope(manifest, 'ui:render')).join()).toContain(
      'Add the ui:render scope: this extension renders UI in the host.',
    );
  });
});

function keywordDataManifest(
  keywordData: unknown = { supports: ['metrics'], platforms: ['ios'] },
) {
  const manifest = base();
  return {
    ...manifest,
    scopes: [
      ...manifest.scopes,
      {
        key: 'keywords:write',
        justification: 'Supply keyword volume and difficulty to Keywords.',
      },
    ],
    contributes: { ...manifest.contributes, keywordData },
    server: { baseUrl: 'https://keywords.example.com' },
  };
}

describe('keyword data', () => {
  it('accepts a keywordData contribution', () => {
    expect(issues(keywordDataManifest())).toEqual([]);
  });

  it('types the keywordData contribution', () => {
    const keywordData: KeywordDataContribution = {
      supports: ['metrics', 'suggestions'],
      platforms: ['ios', 'android'],
    };
    const manifest: ExtensionManifest = {
      ...base(),
      contributes: { keywordData },
    };

    expect(manifest.contributes.keywordData).toEqual(keywordData);
    expect(issues(keywordDataManifest(keywordData))).toEqual([]);
  });

  it('rejects keywordData without the keywords:write scope', () => {
    const manifest = keywordDataManifest();
    const withoutKeywordsWrite = {
      ...manifest,
      scopes: manifest.scopes.filter(scope => scope.key !== 'keywords:write'),
    };

    expect(issues(withoutKeywordsWrite).join()).toContain(
      'Add the keywords:write scope: this extension supplies keyword data to Tappify.',
    );
  });

  it('rejects keywordData without server.baseUrl', () => {
    const { server: _server, ...manifest } = keywordDataManifest();

    expect(issues(manifest).join()).toContain(
      'server.baseUrl: Set server.baseUrl: connectors, webhooks, assistant contributions, keyword data,',
    );
  });

  it('rejects an empty supports list', () => {
    const manifest = keywordDataManifest({ supports: [], platforms: ['ios'] });

    expect(issues(manifest).join()).toContain(
      'contributes.keywordData.supports',
    );
  });

  it('rejects an empty platforms list', () => {
    const manifest = keywordDataManifest({
      supports: ['metrics'],
      platforms: [],
    });

    expect(issues(manifest).join()).toContain(
      'contributes.keywordData.platforms',
    );
  });

  it('rejects an unknown operation', () => {
    const manifest = keywordDataManifest({
      supports: ['competitorKeywords'],
      platforms: ['ios'],
    });

    expect(issues(manifest).join()).toContain(
      'contributes.keywordData.supports.0',
    );
  });

  it('rejects a duplicate operation', () => {
    const manifest = keywordDataManifest({
      supports: ['metrics', 'metrics'],
      platforms: ['ios'],
    });

    expect(issues(manifest).join()).toContain(
      'supports lists metrics twice. Declare each operation once.',
    );
  });

  it('rejects a duplicate platform', () => {
    const manifest = keywordDataManifest({
      supports: ['metrics'],
      platforms: ['ios', 'ios'],
    });

    expect(issues(manifest).join()).toContain(
      'platforms lists ios twice. Declare each platform once.',
    );
  });
});

function crashesManifest(crashes: unknown = { supports: ['groups'] }) {
  const manifest = base();
  return {
    ...manifest,
    scopes: [
      ...manifest.scopes,
      {
        key: 'crashes:write',
        justification: 'Write the crash groups Sentry reports into Crashes.',
      },
    ],
    contributes: { ...manifest.contributes, crashes },
    server: { baseUrl: 'https://crashes.example.com' },
  };
}

describe('crashes', () => {
  it('accepts a crashes contribution with groups and details', () => {
    expect(
      issues(crashesManifest({ supports: ['groups', 'details'] })),
    ).toEqual([]);
  });

  it('types the crashes contribution', () => {
    const crashes: CrashesContribution = { supports: ['groups', 'details'] };
    const manifest: ExtensionManifest = {
      ...base(),
      contributes: { crashes },
    };

    expect(manifest.contributes.crashes).toEqual(crashes);
    expect(issues(crashesManifest(crashes))).toEqual([]);
  });

  it('rejects crashes without the crashes:write scope', () => {
    const manifest = crashesManifest();
    const withoutCrashesWrite = {
      ...manifest,
      scopes: manifest.scopes.filter(scope => scope.key !== 'crashes:write'),
    };

    expect(issues(withoutCrashesWrite).join()).toContain(
      'Add the crashes:write scope: the extension writes crash groups into the project.',
    );
  });

  it('rejects crashes without server.baseUrl', () => {
    const { server: _server, ...manifest } = crashesManifest();

    expect(issues(manifest)).toContain(
      'server.baseUrl: Set server.baseUrl: connectors, webhooks, assistant contributions, keyword data, crash reporters, work destinations, ad networks and procedures all call your server.',
    );
  });

  it('rejects an empty supports list', () => {
    expect(issues(crashesManifest({ supports: [] })).join()).toContain(
      'contributes.crashes.supports',
    );
  });

  it('rejects supports without groups', () => {
    expect(issues(crashesManifest({ supports: ['details'] }))).toEqual([
      'contributes.crashes.supports: A crash reporter supports groups. Add "groups" to supports.',
    ]);
  });

  it('rejects a duplicate entry', () => {
    const manifest = crashesManifest({ supports: ['groups', 'groups'] });

    expect(issues(manifest)).toEqual([
      'contributes.crashes.supports.1: supports lists groups twice. Declare each operation once.',
    ]);
  });
});

function connectorManifest(...metrics: MetricDeclaration[]): ExtensionManifest {
  const manifest = base();
  manifest.scopes.push({ key: 'metrics:write' });
  manifest.server = { baseUrl: 'https://api.funnel-lab.dev' };
  manifest.contributes.connector = { metrics };
  return manifest;
}

describe('standard metrics', () => {
  const plainMrr: MetricDeclaration = {
    key: 'mrr',
    label: 'MRR',
    unit: 'currency',
    kind: 'gauge',
    standard: 'subscriptions.mrr',
  };
  const mrr: MetricDeclaration = {
    ...plainMrr,
    restateDays: 7,
    backfillDays: 90,
  };

  it('accepts a metric that reports a standard metric and restates days', () => {
    expect(issues(connectorManifest(mrr))).toEqual([]);
  });

  it('still accepts a metric with neither field', () => {
    expect(
      issues(
        connectorManifest({
          key: 'active_users',
          label: 'Active users',
          unit: 'count',
          kind: 'gauge',
        }),
      ),
    ).toEqual([]);
  });

  it('rejects a standard key outside the catalogue', () => {
    const manifest = connectorManifest(mrr);
    const result = validateManifest({
      ...manifest,
      contributes: {
        ...manifest.contributes,
        connector: { metrics: [{ ...mrr, standard: 'subscriptions.arpu' }] },
      },
    });

    expect(result.ok).toBe(false);
    expect(result.ok ? [] : result.issues.map(issue => issue.path)).toEqual([
      'contributes.connector.metrics.0.standard',
    ]);
  });

  it('rejects a unit that differs from the standard metric', () => {
    expect(issues(connectorManifest({ ...mrr, unit: 'count' }))).toEqual([
      'contributes.connector.metrics.0.unit: Metric "mrr" reports subscriptions.mrr as "count", but that standard metric is "currency". Change the unit or remove "standard".',
    ]);
  });

  it('rejects a kind that differs from the standard metric', () => {
    expect(issues(connectorManifest({ ...mrr, kind: 'counter' }))).toEqual([
      'contributes.connector.metrics.0.kind: Metric "mrr" reports subscriptions.mrr as a counter, but that standard metric is a gauge. Change the kind or remove "standard".',
    ]);
  });

  it('rejects two metrics that report the same standard metric', () => {
    expect(
      issues(connectorManifest(mrr, { ...mrr, key: 'mrr_net', label: 'Net' })),
    ).toEqual([
      'contributes.connector.metrics.1.standard: Metrics "mrr" and "mrr_net" both report subscriptions.mrr. Only one metric in an extension can report a standard metric.',
    ]);
  });

  it('rejects restateDays outside 0 to 90 or not a whole number', () => {
    for (const restateDays of [-1, 91, 1.5]) {
      const result = validateManifest(
        connectorManifest({ ...mrr, restateDays }),
      );

      const paths = result.ok ? [] : result.issues.map(issue => issue.path);
      expect(new Set(paths)).toEqual(
        new Set(['contributes.connector.metrics.0.restateDays']),
      );
    }
    expect(issues(connectorManifest({ ...mrr, restateDays: 0 }))).toEqual([]);
  });

  it('rejects restateDays beyond the declared backfill', () => {
    expect(
      issues(connectorManifest({ ...mrr, restateDays: 45, backfillDays: 40 })),
    ).toEqual([
      'contributes.connector.metrics.0.restateDays: Metric "mrr" restates 45 days but only backfills 40. Lower restateDays or raise backfillDays.',
    ]);
  });

  it('measures restateDays against a 30-day backfill when backfillDays is left out', () => {
    expect(issues(connectorManifest({ ...plainMrr, restateDays: 31 }))).toEqual(
      [
        'contributes.connector.metrics.0.restateDays: Metric "mrr" restates 31 days but only backfills 30. Lower restateDays or raise backfillDays.',
      ],
    );
    expect(issues(connectorManifest({ ...plainMrr, restateDays: 30 }))).toEqual(
      [],
    );
  });
});

describe('sdkMajors', () => {
  it('reads the majors a range can match', () => {
    expect(sdkMajors('^2.0.0')).toEqual([2]);
    expect(sdkMajors('~2.1.3')).toEqual([2]);
    expect(sdkMajors('2.x')).toEqual([2]);
    expect(sdkMajors('>=2.0.0 <3.0.0')).toEqual([2]);
    expect(sdkMajors('^1.0.0 || ^2.0.0')).toEqual([1, 2]);
  });
});

describe('manifestJsonSchema', () => {
  it('publishes under the documented $id', () => {
    const document = manifestJsonSchema();

    expect(document.$id).toBe('https://schema.tappify.ai/extension/v2.json');
    expect(document.$schema).toBe(
      'https://json-schema.org/draft/2020-12/schema',
    );
    expect(document.type).toBe('object');
  });
});
