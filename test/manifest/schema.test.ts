import { describe, expect, expectTypeOf, it } from 'vitest';
import { z } from 'zod';
import {
  AI_INPUT_SCHEMA_MAX_BYTES,
  AI_SCHEMA_TEXT_MAX,
  manifestJsonSchema,
  manifestSchema,
  sdkMajors,
  validateManifest,
} from '../../src/manifest/schema';
import type { ExtensionManifest } from '../../src/manifest/types';

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
