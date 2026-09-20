import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { generateTypes } from '../../src/codegen/generate';
import type { ExtensionManifest, JsonSchema } from '../../src/manifest/types';

const repoRoot = resolve(__dirname, '../..');
const generatedDir = resolve(repoRoot, 'test/.generated');

const schemas: Record<string, JsonSchema> = {
  './schemas/preferences.json': {
    type: 'object',
    properties: {
      compact: { type: 'boolean' },
      pinned: { type: 'array', items: { type: 'string' } },
    },
    required: ['compact'],
    additionalProperties: false,
  },
};

function manifest(): ExtensionManifest {
  return {
    id: 'funnel-lab',
    name: 'Funnel Lab',
    description: 'Shows where installs drop out of the store funnel.',
    icon: 'icon.svg',
    category: 'product_analytics',
    sdk: '^2.0.0',
    visibility: 'private',
    installScope: 'project',
    scopes: [
      { key: 'ui:render' },
      { key: 'storage:write' },
      { key: 'ai:tools' },
      {
        key: 'ai:actions',
        justification: 'Sends the push the owner approved on the card.',
      },
      {
        key: 'messaging:send',
        justification: 'Delivers the approved push through the owner keys.',
      },
      { key: 'alerts:write', justification: 'Raises the anomaly alert only.' },
      { key: 'metrics:write' },
    ],
    telemetry: ['summary_viewed', 'funnel_expanded'],
    contributes: {
      storage: {
        preferences: {
          scope: 'user',
          singleton: true,
          schema: { $ref: './schemas/preferences.json' },
        },
        notes: {
          scope: 'install',
          schema: {
            type: 'object',
            properties: { body: { type: 'string' } },
            required: ['body'],
          },
        },
      },
      settings: {
        entry: 'src/settings.tsx',
        schema: {
          type: 'object',
          properties: { refreshMinutes: { type: 'number' } },
          required: ['refreshMinutes'],
        },
      },
      connector: {
        auth: {
          method: 'api_key',
          fields: [
            {
              name: 'api_key',
              label: 'API key',
              type: 'password',
              required: true,
            },
            {
              name: 'region',
              label: 'Region',
              type: 'select',
              required: false,
              options: ['us', 'eu'],
            },
          ],
        },
        metrics: [
          {
            key: 'active_users',
            label: 'Active users',
            unit: 'count',
            kind: 'gauge',
          },
        ],
      },
      webhooks: [
        {
          event: 'anomaly.detected',
          as: 'alert',
          payload: {
            type: 'object',
            properties: { why: { type: 'string' }, metric: { type: 'string' } },
            required: ['why'],
          },
        },
      ],
      ai: {
        tools: [
          {
            id: 'compare_releases',
            description: 'Compare two releases on conversion',
            input: {
              type: 'object',
              properties: {
                left: { type: 'string' },
                right: { type: 'string' },
              },
              required: ['left', 'right'],
            },
            returns: 'comparison',
            cost: 'low',
          },
        ],
        actions: [
          {
            id: 'send_push',
            description: 'Send a push to a saved audience',
            input: {
              type: 'object',
              properties: { audience: { type: 'string' } },
              required: ['audience'],
            },
            approval: true,
            reversible: false,
            scope: 'messaging:send',
          },
        ],
        prompts: [
          {
            id: 'weekly_digest',
            title: 'Weekly digest',
            template: 'Summarise {{project.name}} for {{input.days}} days',
            surfaces: ['chat_suggestion'],
            input: {
              type: 'object',
              properties: { days: { type: 'number' } },
              required: ['days'],
            },
          },
        ],
      },
    },
    server: {
      baseUrl: 'https://api.funnel-lab.dev',
      procedures: {
        getSummary: {
          input: {
            type: 'object',
            properties: { days: { type: 'number' } },
            required: ['days'],
          },
          output: {
            type: 'object',
            properties: { installs: { type: 'number' } },
            required: ['installs'],
          },
          kind: 'read',
        },
      },
    },
  };
}

async function generate(): Promise<string> {
  return generateTypes({
    manifest: manifest(),
    registrySnapshot: {
      events: [
        {
          name: 'release.shipped',
          payload: {
            type: 'object',
            properties: {
              version: { type: 'string' },
              build: { type: 'string' },
            },
            required: ['version'],
          },
        },
      ],
    },
    readSchemaFile: path => {
      const schema = schemas[path];
      if (!schema) throw new Error(`unknown schema ${path}`);
      return schema;
    },
  });
}

const PROBE = `import type {
  ActionInput,
  PromptInput,
  TapCredentialValues,
  TapHostEvents,
  TapProcedureInput,
  TapProcedureOutput,
  TapSettingsValues,
  TapStorage,
  TelemetryEvent,
  ToolInput,
  WebhookPayload,
} from '@tappify/extension-sdk';

export async function readPreferences(storage: TapStorage): Promise<boolean> {
  const preferences = await storage.preferences.get();
  await storage.notes.put('note-1', { body: 'written' });
  return preferences?.compact ?? false;
}

export function callProcedure(
  input: TapProcedureInput<'getSummary'>,
  output: TapProcedureOutput<'getSummary'>,
): number {
  return input.days + output.installs;
}

export function describeAction(input: ActionInput<'send_push'>): string {
  return input.audience;
}

export function describeTool(input: ToolInput<'compare_releases'>): string {
  return \`\${input.left} vs \${input.right}\`;
}

export function describePrompt(input: PromptInput<'weekly_digest'>): number {
  return input.days;
}

export function describeWebhook(
  payload: WebhookPayload<'anomaly.detected'>,
): string {
  return payload.why;
}

export function describeShipped(
  payload: TapHostEvents['release.shipped'],
): string {
  return payload.version;
}

export function describeCatalogueEvent(
  payload: TapHostEvents['metadata.changed'],
): unknown {
  return payload.anything;
}

export const telemetry: TelemetryEvent = 'summary_viewed';
export const settings: TapSettingsValues = { refreshMinutes: 5 };
export const credentials: TapCredentialValues = {
  api_key: 'secret',
  region: 'eu',
};

// @ts-expect-error the manifest declares no telemetry event called "nope"
export const unknownTelemetry: TelemetryEvent = 'nope';

// @ts-expect-error refreshMinutes is required by the generated settings type
export const missingSetting: TapSettingsValues = {};

export const unknownCredential: TapCredentialValues = {
  api_key: 'secret',
  // @ts-expect-error the connector declares no credential field called "token"
  token: 'nope',
};
`;

const DASHED_PROBE = `import type {
  ActionInput,
  PromptInput,
  TapProcedureInput,
  TapProcedureOutput,
  ToolInput,
} from '@tappify/extension-sdk';

export function callProcedure(
  input: TapProcedureInput<'get-summary'>,
  output: TapProcedureOutput<'get-summary'>,
): number {
  return input.days + output.installs;
}

export function describeAction(input: ActionInput<'send-push'>): string {
  return input.audience;
}

export function describeTool(input: ToolInput<'compare-releases'>): string {
  return input.left;
}

export function describePrompt(input: PromptInput<'weekly-digest'>): number {
  return input.days;
}
`;

function compileGenerated(output: string, probeSource = PROBE): string[] {
  rmSync(generatedDir, { recursive: true, force: true });
  mkdirSync(generatedDir, { recursive: true });

  const declaration = resolve(generatedDir, 'tappify.d.ts');
  const probe = resolve(generatedDir, 'probe.ts');
  writeFileSync(declaration, output, 'utf8');
  writeFileSync(probe, probeSource, 'utf8');

  const program = ts.createProgram({
    rootNames: [declaration, probe],
    options: {
      strict: true,
      noEmit: true,
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      lib: ['lib.es2020.d.ts', 'lib.dom.d.ts'],
      skipLibCheck: true,
      baseUrl: generatedDir,
      paths: {
        '@tappify/extension-sdk': [resolve(repoRoot, 'src/client/types.ts')],
      },
    },
  });

  return ts
    .getPreEmitDiagnostics(program)
    .map(diagnostic =>
      ts.flattenDiagnosticMessageText(diagnostic.messageText, ' '),
    );
}

describe('generateTypes', () => {
  it('starts with the do-not-edit header and augments the SDK module', async () => {
    const output = await generate();

    expect(output.startsWith('/* eslint-disable */')).toBe(true);
    expect(output).toContain(
      'Generated by `tappify extension types`. Do not edit by hand.',
    );
    expect(output).toContain("declare module '@tappify/extension-sdk' {");
    expect(output.trimEnd().endsWith('export {};')).toBe(true);
  });

  it('types storage collections, resolving $ref through readSchemaFile', async () => {
    const output = await generate();

    expect(output).toContain('export interface Preferences {');
    expect(output).toContain('compact: boolean;');
    expect(output).toContain(
      "'preferences': { kind: 'singleton'; scope: 'user'; document: Preferences };",
    );
    expect(output).toContain(
      "'notes': { kind: 'collection'; scope: 'install'; document: Notes };",
    );
  });

  it('types procedures, actions, tools and prompts', async () => {
    const output = await generate();

    expect(output).toContain(
      "'getSummary': { input: GetSummaryInput; output: GetSummaryOutput };",
    );
    expect(output).toContain("'send_push': { input: SendPushInput };");
    expect(output).toContain(
      "'compare_releases': { input: CompareReleasesInput };",
    );
    expect(output).toContain(
      "'weekly_digest': { input: WeeklyDigestPromptInput };",
    );
  });

  it('quotes dashed ids so they survive as map keys', async () => {
    const dashed = manifest();
    const ai = dashed.contributes.ai;
    if (!ai?.actions || !ai.tools || !ai.prompts || !dashed.server) {
      throw new Error('fixture manifest lost its assistant contributions');
    }
    ai.actions[0].id = 'send-push';
    ai.tools[0].id = 'compare-releases';
    ai.prompts[0].id = 'weekly-digest';
    const [getSummary] = Object.values(dashed.server.procedures ?? {});
    dashed.server.procedures = { 'get-summary': getSummary };

    const output = await generateTypes({
      manifest: dashed,
      readSchemaFile: path => schemas[path],
    });

    expect(output).toContain(
      "'get-summary': { input: GetSummaryInput; output: GetSummaryOutput };",
    );
    expect(output).toContain("'send-push': { input: SendPushInput };");
    expect(output).toContain(
      "'compare-releases': { input: CompareReleasesInput };",
    );
    expect(output).toContain(
      "'weekly-digest': { input: WeeklyDigestPromptInput };",
    );
    expect(compileGenerated(output, DASHED_PROBE)).toEqual([]);
  });

  it('types settings, credentials, telemetry, webhooks and host events', async () => {
    const output = await generate();

    expect(output).toContain('interface TapSettings extends Settings {}');
    expect(output).toContain('interface TapCredentials extends Credentials {}');
    expect(output).toContain('api_key: string;');
    expect(output).toContain("region?: 'us' | 'eu';");
    expect(output).toContain("'summary_viewed': true;");
    expect(output).toContain("'funnel_expanded': true;");
    expect(output).toContain("'anomaly.detected': AnomalyDetectedPayload;");
    expect(output).toContain("'release.shipped': ReleaseShippedEvent;");
  });

  it('omits TapHostEventMap when no registry snapshot is supplied', async () => {
    const output = await generateTypes({
      manifest: manifest(),
      readSchemaFile: path => schemas[path],
    });

    expect(output).not.toContain('TapHostEventMap');
    expect(output).toContain('TapProcedureMap');
  });

  it('produces an empty but valid module for a manifest with no schemas', async () => {
    const output = await generateTypes({
      manifest: {
        id: 'plain',
        name: 'Plain',
        description: 'A widget with nothing generated.',
        icon: 'icon.svg',
        category: 'design',
        sdk: '^2.0.0',
        visibility: 'private',
        installScope: 'project',
        scopes: [{ key: 'ui:render' }],
        contributes: {
          widgets: [
            {
              id: 'plain',
              title: 'Plain',
              entry: 'src/widgets/plain.tsx',
              page: 'overview',
              slot: 'sidebar',
              size: '1x1',
            },
          ],
        },
      },
    });

    expect(output).toContain("declare module '@tappify/extension-sdk' {}");
    expect(output.trimEnd().endsWith('export {};')).toBe(true);
  });

  /**
   * The dereferencer reads a relative $ref from disk only when it sees no
   * `window`, and `tappify extension types` runs in Node; the suite itself runs
   * in a DOM, where every path would be fetched as a URL instead.
   */
  async function inNode<T>(run: () => Promise<T>): Promise<T> {
    const dom = globalThis.window;
    Reflect.deleteProperty(globalThis, 'window');
    try {
      return await run();
    } finally {
      globalThis.window = dom;
    }
  }

  it('resolves a nested $ref against the file that holds it, under cwd', async () => {
    const extensionRoot = mkdtempSync(join(tmpdir(), 'tappify-codegen-'));
    mkdirSync(join(extensionRoot, 'schemas'));
    writeFileSync(
      join(extensionRoot, 'schemas', 'body.json'),
      JSON.stringify({
        type: 'object',
        properties: { note: { type: 'string' } },
        required: ['note'],
        additionalProperties: false,
      }),
    );

    const nested: ExtensionManifest = {
      ...manifest(),
      contributes: {
        storage: {
          notes: {
            scope: 'install',
            schema: { $ref: './schemas/notes.json' },
          },
        },
      },
      telemetry: undefined,
      server: undefined,
    };
    const readSchemaFile = (): JsonSchema => ({
      type: 'object',
      properties: { body: { $ref: './body.json' } },
      required: ['body'],
      additionalProperties: false,
    });

    try {
      const output = await inNode(() =>
        generateTypes({
          manifest: nested,
          readSchemaFile,
          cwd: extensionRoot,
        }),
      );

      expect(output).toContain('note: string;');
      await expect(
        inNode(() => generateTypes({ manifest: nested, readSchemaFile })),
      ).rejects.toThrow();
    } finally {
      rmSync(extensionRoot, { recursive: true, force: true });
    }
  });

  it('emits a declaration file that type-checks against the SDK types', async () => {
    const diagnostics = compileGenerated(await generate());

    expect(diagnostics).toEqual([]);
  });
});
