import { z } from 'zod';
import {
  CATEGORIES,
  CHARTS,
  EVENTS,
  PAGE_KEYS,
  SCOPE_KEYS,
  SERVED_SDK_MAJORS,
  SLOTS,
  TABLE_KEYS,
  findScope,
  slotsForPage,
} from './constants';
import type {
  ExtensionManifest,
  ManifestIssue,
  ManifestValidation,
} from './types';

const SLUG = /^[a-z][a-z0-9-]{2,39}$/;
const CONTRIBUTION_ID = /^[a-z][a-z0-9-]{1,39}$/;
const SNAKE_CASE = /^[a-z][a-z0-9_]*$/;
const PROCEDURE_NAME = /^[a-zA-Z][a-zA-Z0-9_-]{1,59}$/;
const DOMAIN_EVENT = /^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/;

const jsonSchema = z
  .record(z.string(), z.unknown())
  .describe(
    'A JSON Schema object. `tappify extension types` turns it into a TypeScript type.',
  );

/** The serialised size Tappify accepts for a tool or action input schema. */
export const AI_INPUT_SCHEMA_MAX_BYTES = 16_384;

/** The length Tappify accepts for one `title` or `description` inside it. */
export const AI_SCHEMA_TEXT_MAX = 500;

const AI_SCHEMA_TEXT_KEYS = new Set(['title', 'description']);
const AI_SCHEMA_MAX_DEPTH = 12;

function overlongSchemaText(value: unknown, depth = 0): string | null {
  if (depth > AI_SCHEMA_MAX_DEPTH) return null;

  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = overlongSchemaText(entry, depth + 1);
      if (found !== null) return found;
    }
    return null;
  }

  if (typeof value !== 'object' || value === null) return null;

  for (const [key, entry] of Object.entries(value)) {
    if (
      AI_SCHEMA_TEXT_KEYS.has(key) &&
      typeof entry === 'string' &&
      entry.length > AI_SCHEMA_TEXT_MAX
    ) {
      return key;
    }
    const found = overlongSchemaText(entry, depth + 1);
    if (found !== null) return found;
  }

  return null;
}

/**
 * The assistant reads the `title` and `description` strings inside a tool or
 * action input schema the same way it reads the tool description, so Tappify
 * bounds them the same way. A schema past either bound is refused at publish,
 * and the CLI refuses it here rather than letting you find out on upload.
 */
const aiInputSchema = jsonSchema.superRefine((value, ctx) => {
  const size = new TextEncoder().encode(JSON.stringify(value)).length;
  if (size > AI_INPUT_SCHEMA_MAX_BYTES) {
    ctx.addIssue({
      code: 'custom',
      message: `This input schema serialises to ${size} bytes; Tappify accepts at most ${AI_INPUT_SCHEMA_MAX_BYTES}. Describe the arguments in fewer words, or take fewer of them.`,
    });
  }

  const overlong = overlongSchemaText(value);
  if (overlong !== null) {
    ctx.addIssue({
      code: 'custom',
      message: `A "${overlong}" inside this input schema is longer than ${AI_SCHEMA_TEXT_MAX} characters. The assistant reads it like the tool description, which is bounded the same way.`,
    });
  }
});

const httpsUrl = z.url().startsWith('https://');
const entryPath = z
  .string()
  .min(1)
  .max(200)
  .describe(
    'The source file that renders this contribution, as a path relative to the manifest. It has to be present as an expose in the built bundle.',
  );
const contributionId = z
  .string()
  .regex(CONTRIBUTION_ID)
  .describe(
    'The id for this contribution, and the handle the host and your generated types refer to it by.',
  );
const title = z
  .string()
  .min(1)
  .max(60)
  .describe('The label owners read on this contribution.');

const scopeEntry = z
  .object({
    key: z
      .enum(SCOPE_KEYS, {
        error: 'Unknown scope key; see the Scopes reference.',
      })
      .describe('The scope key, from the scopes reference.'),
    justification: z
      .string()
      .min(20)
      .max(500)
      .describe(
        'Why this extension asks for the scope, in your own words. Shown on the consent screen, and required for the scopes that ask for one.',
      )
      .optional(),
  })
  .strict();

const mobile = z
  .boolean()
  .describe(
    'Whether this surface is drawn on phone layouts. Defaults to true; set false to hide it there.',
  )
  .optional();

const hostPage = (what: string) => z.enum(PAGE_KEYS).describe(what);

const pageContribution = z
  .object({
    id: contributionId,
    title,
    entry: entryPath,
    nav: z
      .boolean()
      .describe(
        'Whether this page also gets an entry in the project navigation. The route `/projects/:projectId/ext/:extensionId/:pageId` exists either way.',
      )
      .optional(),
    mobile,
  })
  .strict();

const tabContribution = z
  .object({
    id: contributionId,
    title,
    entry: entryPath,
    page: hostPage('The host page this tab sits on.'),
    mobile,
  })
  .strict();

const widgetContribution = z
  .object({
    id: contributionId,
    title,
    entry: entryPath,
    page: hostPage('The host page this widget renders on.'),
    slot: z
      .enum(SLOTS)
      .describe(
        'The named anchor on that page. A slot that is not on the page fails validation.',
      ),
    size: z
      .enum(['1x1', '2x1', '2x2'])
      .describe(
        "The widget's footprint in the slot grid, as columns by rows. Every slot takes all three.",
      ),
    expandable: z
      .boolean()
      .describe(
        'Whether owners can open the same component in the expand panel.',
      )
      .optional(),
  })
  .strict();

const seriesContribution = z
  .object({
    id: contributionId,
    label: title,
    chart: z.enum(CHARTS).describe('The host chart this line is drawn on.'),
    metric: z
      .string()
      .min(1)
      .max(60)
      .describe(
        'The connector metric this line plots. It has to be one the connector declares.',
      ),
  })
  .strict();

const bannerContribution = z
  .object({
    id: contributionId,
    page: hostPage('The host page this banner appears on.'),
    event: z
      .string()
      .regex(DOMAIN_EVENT)
      .describe(
        'The event that raises it. Declare the same name under `contributes.webhooks` with `as: "banner"`.',
      ),
  })
  .strict();

const rowActionContribution = z
  .object({
    id: contributionId,
    title,
    table: z
      .enum(TABLE_KEYS)
      .describe('The host table whose row menu gains this entry.'),
    entry: entryPath,
  })
  .strict();

const markerContribution = z
  .object({
    id: contributionId,
    label: title,
    chart: z
      .union([z.enum(CHARTS), z.literal('*')])
      .describe(
        'The host chart this marker is drawn on, or `*` for every chart.',
      ),
    event: z
      .string()
      .regex(DOMAIN_EVENT)
      .describe(
        'The event that places it on the time axis. Declare the same name under `contributes.webhooks` with `as: "event"`.',
      ),
    glyph: z
      .string()
      .min(1)
      .max(2)
      .describe('The one or two characters drawn at the marker.'),
  })
  .strict();

const settingsContribution = z
  .object({
    entry: entryPath,
    schema: jsonSchema.describe(
      'The JSON Schema for the values owners fill in. It becomes `TapSettingsProps["values"]` and the reserved `settings` singleton.',
    ),
  })
  .strict();

const storageCollection = z
  .object({
    scope: z
      .enum(['user', 'install', 'organization'])
      .describe(
        'Who the documents belong to: one `user`, the whole `install`, or the `organization`.',
      ),
    singleton: z
      .boolean()
      .describe(
        'Whether the collection holds exactly one document rather than many.',
      )
      .optional(),
    schema: jsonSchema.describe(
      'The JSON Schema for one document in this collection.',
    ),
  })
  .strict();

const credentialField = z
  .object({
    name: z
      .string()
      .regex(SNAKE_CASE)
      .describe('The key your server reads this value back as.'),
    label: z
      .string()
      .min(1)
      .max(60)
      .describe('The label owners read above the input.'),
    type: z
      .enum(['text', 'password', 'textarea', 'file', 'select'])
      .describe('How the input is drawn to the owner.'),
    required: z
      .boolean()
      .describe('Whether owners have to fill it in before the install works.'),
    options: z
      .array(z.string())
      .describe('The choices offered, for a `select` field.')
      .optional(),
    help: z
      .string()
      .max(200)
      .describe('The hint drawn under the input.')
      .optional(),
  })
  .strict();

const connectorContribution = z
  .object({
    auth: z
      .object({
        method: z
          .enum(['none', 'api_key', 'oauth'])
          .describe('The credential flow owners go through at install.'),
        fields: z
          .array(credentialField)
          .max(20)
          .describe(
            'The credentials owners enter. They reach your server as `credentials` on every call.',
          )
          .optional(),
        oauth: z
          .object({
            authorizationUrl: httpsUrl.describe(
              'Where owners are sent to approve access.',
            ),
            tokenUrl: httpsUrl.describe(
              'Where the authorization code is exchanged for a token.',
            ),
            scopes: z
              .array(z.string())
              .describe(
                "The scopes asked of the outside service. These are that service's scopes, not Tappify's.",
              ),
          })
          .strict()
          .describe('The endpoints, for `method: "oauth"`.')
          .optional(),
      })
      .strict()
      .describe('How owners authenticate this connector.')
      .optional(),
    sync: z
      .enum(['5m', '15m', '1h', '6h', '24h'])
      .describe('How often Tappify asks your server to sync.')
      .optional(),
    metrics: z
      .array(
        z
          .object({
            key: z
              .string()
              .regex(SNAKE_CASE)
              .describe('The metric key. A series names it to draw its line.'),
            label: z
              .string()
              .min(1)
              .max(60)
              .describe('The label owners read on the metric.'),
            unit: z
              .enum(['count', 'ratio', 'currency', 'seconds', 'bytes'])
              .describe('How the value is formatted.'),
            kind: z
              .enum(['gauge', 'counter'])
              .describe(
                'Whether the value is a level at a point in time (`gauge`) or accumulates (`counter`).',
              ),
            dimensions: z
              .array(
                z
                  .object({
                    key: z
                      .string()
                      .regex(SNAKE_CASE)
                      .describe('The dimension key.'),
                    label: z
                      .string()
                      .min(1)
                      .max(60)
                      .describe('The label owners read on the dimension.'),
                  })
                  .strict(),
              )
              .max(10)
              .describe('The breakdowns this metric can be split by.')
              .optional(),
            backfillDays: z
              .number()
              .int()
              .min(1)
              .max(90)
              .describe('How many days of history to fetch on the first sync.')
              .optional(),
          })
          .strict(),
      )
      .max(50)
      .describe(
        'The metrics this connector writes into the metrics store. Needs the `metrics:write` scope.',
      )
      .optional(),
  })
  .strict();

const webhookContribution = z
  .object({
    event: z
      .string()
      .regex(DOMAIN_EVENT)
      .describe('The event name your server posts, as `domain.thing`.'),
    as: z
      .enum(['alert', 'banner', 'event'])
      .describe(
        'What Tappify turns it into: an inbox `alert`, a page `banner`, or an `event` a chart marker and `tap.data.subscribe` can read.',
      ),
    payload: jsonSchema.describe(
      'The JSON Schema for the body your server posts. An alert or a banner has to carry `why`.',
    ),
  })
  .strict();

const aiContribution = z
  .object({
    tools: z
      .array(
        z
          .object({
            id: contributionId,
            description: z
              .string()
              .min(10)
              .max(500)
              .describe(
                'What this tool does, in the words the assistant reads when it decides whether to call it.',
              ),
            input: aiInputSchema.describe(
              'The JSON Schema for the arguments the assistant passes. The assistant reads the `title` and `description` strings inside it, so they are scanned at publish and the whole schema is bounded at 16 KB.',
            ),
            returns: z
              .enum(['comparison', 'table', 'series', 'list', 'value'])
              .describe('The card the host draws from the result.'),
            cost: z
              .enum(['low', 'medium', 'high'])
              .describe(
                'Roughly what one call costs to serve, so the assistant can prefer a cheaper tool.',
              ),
            cache: z
              .enum(['1m', '5m', '1h'])
              .describe(
                'How long an identical call may be served from cache instead of reaching your server.',
              )
              .optional(),
          })
          .strict(),
      )
      .max(15, 'An extension declares at most 15 assistant tools.')
      .describe(
        'The tools the assistant may call on your server. Needs the `ai:tools` scope.',
      )
      .optional(),
    mentions: z
      .array(
        z
          .object({
            id: contributionId,
            label: title,
            list: z
              .string()
              .min(1)
              .max(200)
              .describe(
                'The path that answers the picker with `{ items: [{ id, label }] }`. The host always calls `/tappify/mentions/<id>` under `server.baseUrl` — the route `createTappifyHandler` serves — so write that path here; it records the route, it does not choose it.',
              ),
          })
          .strict(),
      )
      .max(10)
      .describe(
        'The things owners can name with @ in chat, and where to list them. Needs the `ai:tools` scope.',
      )
      .optional(),
    actions: z
      .array(
        z
          .object({
            id: contributionId,
            description: z
              .string()
              .min(10)
              .max(500)
              .describe(
                'What this action does, in the words the owner will read on the approval card.',
              ),
            input: aiInputSchema.describe(
              'The JSON Schema for the arguments the assistant passes. The assistant reads the `title` and `description` strings inside it, so they are scanned at publish and the whole schema is bounded at 16 KB.',
            ),
            approval: z
              .literal(true)
              .describe(
                'Always true. An action goes through an owner approval; there is no way to opt out.',
              ),
            reversible: z
              .boolean()
              .describe('Whether the owner can undo it after it runs.'),
            scope: z
              .enum(SCOPE_KEYS)
              .describe(
                'The scope this action needs. Declare it under `scopes` as well.',
              ),
            estimatesCost: z
              .boolean()
              .describe(
                'Whether the approval card will show what the action costs.',
              )
              .optional(),
          })
          .strict(),
      )
      .max(10, 'An extension declares at most 10 assistant actions.')
      .describe(
        "The actions the assistant may run, each behind an owner approval. Needs the `ai:actions` scope, and each action's own scope. `tap.actions.run` creates the run and resolves with it; the host draws the approval card and calls your server only once the owner approves.",
      )
      .optional(),
    knowledge: z
      .array(
        z
          .object({
            id: contributionId,
            category: z
              .enum(['metric_definitions', 'gotchas', 'setup'])
              .describe('What kind of knowledge the file carries.'),
            file: z
              .string()
              .min(1)
              .max(200)
              .describe(
                'The markdown file in the bundle, as a path relative to the manifest.',
              ),
          })
          .strict(),
      )
      .max(20)
      .describe(
        'Markdown the assistant indexes and cites when it answers about this extension.',
      )
      .optional(),
    skills: z
      .array(
        z
          .object({
            id: contributionId,
            name: z
              .string()
              .min(1)
              .max(60)
              .describe('The skill name the assistant matches on.'),
            description: z
              .string()
              .min(10)
              .max(300)
              .describe('When the assistant should reach for this skill.'),
            file: z
              .string()
              .min(1)
              .max(200)
              .describe(
                'The markdown file in the bundle, as a path relative to the manifest.',
              ),
            tools: z
              .array(z.string())
              .max(15)
              .describe('The tool ids this skill is allowed to use.')
              .optional(),
          })
          .strict(),
      )
      .max(5, 'An extension declares at most 5 skills.')
      .describe(
        'Markdown procedures that shape how the assistant works. Needs the `ai:skills` scope.',
      )
      .optional(),
    prompts: z
      .array(
        z
          .object({
            id: contributionId,
            title,
            template: z
              .string()
              .min(1)
              .max(2000)
              .describe(
                'The prompt text, with `{{project.*}}`, `{{context.*}}` and `{{input.*}}` placeholders. The owner sees it resolved before it is sent.',
              ),
            surfaces: z
              .array(
                z.enum(['chat_suggestion', 'widget', 'page', 'result_card']),
              )
              .min(1)
              .describe('Where the host draws this prompt as a chip.'),
            after: z
              .array(z.string())
              .max(15)
              .describe(
                "The tool ids whose results this prompt follows up on. They have to be this extension's own.",
              )
              .optional(),
            input: jsonSchema
              .describe(
                'The JSON Schema for a short form the owner fills in before the prompt is sent.',
              )
              .optional(),
          })
          .strict(),
      )
      .max(20, 'An extension declares at most 20 prompt templates.')
      .describe(
        'Prompt templates the host offers owners as chips. Needs the `ai:skills` scope.',
      )
      .optional(),
    context: z
      .array(
        z
          .object({
            id: contributionId,
            description: z
              .string()
              .min(10)
              .max(300)
              .describe('What context this provider adds to the turn.'),
            when: z
              .array(z.enum(['turn_start', 'mention']))
              .min(1)
              .describe('When the host calls your server for it.'),
            cache: z
              .enum(['1m', '5m', '1h'])
              .describe('How long the context may be reused before refetching.')
              .optional(),
          })
          .strict(),
      )
      .max(3, 'An extension declares at most 3 context providers.')
      .describe(
        'Providers the host calls to put your data in front of the assistant. Needs the `ai:skills` scope.',
      )
      .optional(),
  })
  .strict();

const statusNames = (stage: string) =>
  z.array(z.string()).describe(`Your own status names that mean ${stage}.`);

const workContribution = z
  .object({
    kind: z
      .enum(['tracker', 'docs', 'chat'])
      .describe('What kind of destination this is.'),
    container: z
      .object({
        label: z
          .string()
          .min(1)
          .max(60)
          .describe(
            'What you call a container, such as "Project", "Space" or "Channel". Owners read it when they pick one.',
          ),
        list: z
          .string()
          .min(1)
          .describe(
            'The path under `server.baseUrl` that lists the containers an owner can choose from.',
          ),
      })
      .strict()
      .describe('Where items land, and how owners pick one.'),
    creates: z
      .array(z.enum(['issue', 'page', 'message']))
      .min(1)
      .describe('What this destination can create.'),
    fields: z
      .object({
        priority: z
          .array(z.string())
          .describe('Your own priority names, highest first.')
          .optional(),
        labels: z.boolean().describe('Whether items carry labels.').optional(),
        assignee: z
          .boolean()
          .describe('Whether items carry an assignee.')
          .optional(),
        required: z
          .array(z.string())
          .describe(
            'The fields an owner has to fill in before you can create.',
          ),
      })
      .strict()
      .describe('What a created item carries.'),
    attachments: z
      .array(z.enum(['image', 'link']))
      .describe('What can be attached to a created item.'),
    comments: z
      .enum(['two-way', 'none'])
      .describe('Whether comments sync back and forth or not at all.'),
    status: z
      .object({
        webhook: z
          .string()
          .regex(DOMAIN_EVENT)
          .describe('The event your server posts when an item changes status.'),
        map: z
          .object({
            open: statusNames('not started'),
            in_progress: statusNames('under way'),
            done: statusNames('finished'),
          })
          .strict()
          .describe(
            'Your status names, grouped into the three stages Tappify draws.',
          ),
      })
      .strict()
      .describe('How status travels back from your system.')
      .optional(),
    identity: z
      .enum(['user', 'install'])
      .describe(
        'Whether items are created as the owner who asked (`user`) or as the install itself.',
      ),
  })
  .strict();

// Every field is optional so a vendor can fill the listing one value at a time;
// the public-visibility refinement below requires all five before publishing.
const listing = z
  .object({
    longDescription: z
      .string()
      .min(1)
      .max(5000)
      .describe('The body of your listing page, in markdown.')
      .optional(),
    screenshots: z
      .array(z.string().min(1))
      .min(1, 'A listing shows 1 to 6 screenshots.')
      .max(6, 'A listing shows 1 to 6 screenshots.')
      .describe(
        'Screenshot files carried in the bundle, as paths relative to the manifest. png at 1600 by 1000.',
      )
      .optional(),
    website: httpsUrl
      .describe('Where owners go to learn more about this extension.')
      .optional(),
    supportUrl: httpsUrl
      .describe('Where owners go when something breaks.')
      .optional(),
    privacyUrl: httpsUrl
      .describe(
        'Your privacy policy, linked from the consent screen before anyone installs.',
      )
      .optional(),
  })
  .strict();

const LISTING_FIELDS = [
  'longDescription',
  'screenshots',
  'website',
  'supportUrl',
  'privacyUrl',
] as const;

const procedureDeclaration = z
  .object({
    input: jsonSchema.describe(
      'The JSON Schema for the argument your handler receives. The host validates against it before calling.',
    ),
    output: jsonSchema.describe(
      'The JSON Schema for what your handler returns.',
    ),
    cache: z
      .enum(['1m', '5m', '1h'])
      .describe(
        'How long an identical call may be served from cache instead of reaching your server.',
      )
      .optional(),
    kind: z
      .enum(['read', 'write'])
      .describe('Whether this procedure only reads or also changes something.')
      .optional(),
  })
  .strict();

const manifestObject = z
  .object({
    $schema: z
      .string()
      .describe(
        'The URL of this JSON Schema. Editors read it for completion and inline validation.',
      )
      .optional(),
    id: z
      .string()
      .regex(SLUG)
      .describe(
        'The identifier for this extension, unique across the Tap Store and fixed after the first publish.',
      ),
    name: z
      .string()
      .min(2)
      .max(40)
      .describe(
        'The name owners see in the Tap Store and on every surface this extension renders.',
      ),
    description: z
      .string()
      .min(10)
      .max(200)
      .describe(
        'The one line owners read on the Tap Store card and on the install screen.',
      ),
    icon: z
      .string()
      .min(1)
      .max(200)
      .describe(
        'The icon file carried in the bundle, as a path relative to the manifest. Square png or svg, at most 512 KB.',
      ),
    category: z
      .enum(CATEGORIES, {
        error:
          'Choose a category from the Tap Store list (see the Categories reference).',
      })
      .describe('The Tap Store section owners browse and filter by.'),
    sdk: z
      .string()
      .min(1)
      .max(60)
      .describe(
        'The SDK range this build targets, such as "^2.0.0". The host serves one major at a time and rejects a range that excludes it.',
      ),
    visibility: z
      .enum(['public', 'unlisted', 'private'])
      .describe(
        'Who can find and install this extension. "public" lists it in the Tap Store and needs all five listing fields; "unlisted" installs by link; "private" installs only in your own workspace.',
      ),
    installScope: z
      .enum(['project', 'organization'])
      .describe(
        'Whether one install belongs to a single project or to a whole organization. An organization install contributes no pages, tabs, widgets or series, because those render on a project.',
      ),
    scopes: z
      .array(scopeEntry)
      .min(1)
      .max(SCOPE_KEYS.length)
      .describe(
        'The permissions an owner grants at install. Declare only what your contributions use.',
      ),
    contributes: z
      .object({
        pages: z
          .array(pageContribution)
          .max(20)
          .describe(
            "Pages of this extension's own, each on its own route under the project. `nav: true` also puts one in the project navigation.",
          )
          .optional(),
        tabs: z
          .array(tabContribution)
          .max(20)
          .describe("Tabs beside the host's own on a named host page.")
          .optional(),
        widgets: z
          .array(widgetContribution)
          .max(20)
          .describe('Cards drawn into a named slot on a host page.')
          .optional(),
        series: z
          .array(seriesContribution)
          .max(20)
          .describe(
            'Lines drawn onto a host chart from a metric the connector writes. The host draws the line on the chart this names and puts the vendor in the chart legend; a stale metric is drawn dashed with the time of its last sync.',
          )
          .optional(),
        banners: z
          .array(bannerContribution)
          .max(20)
          .describe(
            'Banners raised on a host page by a webhook declared with as: "banner". The host draws one at the top of that page, carrying the `why` sentence from the delivery, until the owner dismisses it.',
          )
          .optional(),
        rowActions: z
          .array(rowActionContribution)
          .max(20)
          .describe('Actions offered on a row of a host table.')
          .optional(),
        markers: z
          .array(markerContribution)
          .max(20)
          .describe(
            'Markers drawn on a host chart by a webhook declared with as: "event". Needs the `ui:render` and `alerts:write` scopes. The host draws the glyph on the chart time axis at the moment the delivery arrived, with the vendor named on hover.',
          )
          .optional(),
        settings: settingsContribution
          .describe('The settings panel owners open for this install.')
          .optional(),
        storage: z
          .record(z.string().regex(SNAKE_CASE), storageCollection)
          .describe(
            'The hosted storage collections this extension reads and writes. At most 10, and the name "settings" is reserved. Needs the `storage:write` scope.',
          )
          .optional(),
        connector: connectorContribution
          .describe(
            'How this extension authenticates against an outside service, how often it syncs, and the metrics it writes.',
          )
          .optional(),
        webhooks: z
          .array(webhookContribution)
          .max(20)
          .describe(
            "The events this extension's server posts to Tappify, and what each one becomes. An `alert` or a `banner` needs the `alerts:write` scope.",
          )
          .optional(),
        ai: aiContribution
          .describe(
            'What this extension offers the assistant: tools, mentions, actions, knowledge, skills, prompts and context providers.',
          )
          .optional(),
        work: workContribution
          .describe(
            'The work destination this extension creates issues, pages or messages in. Needs the `work:create` and `work:sync` scopes.',
          )
          .optional(),
      })
      .strict()
      .describe(
        'What this extension adds to the host. At most 20 UI contributions in total, and a page, tab, widget, row action, marker or settings panel needs the `ui:render` scope.',
      ),
    server: z
      .object({
        baseUrl: httpsUrl.describe(
          'Where the host calls your server. `<baseUrl>/tappify/health` answers 200 within three seconds at publish.',
        ),
        sandboxBaseUrl: httpsUrl
          .describe(
            'Where dev installs and sandbox projects call instead. Defaults to `baseUrl`.',
          )
          .optional(),
        procedures: z
          .record(
            z
              .string()
              .regex(
                PROCEDURE_NAME,
                'Procedure names are identifiers such as "getSummary" or "get-summary": letters, digits, _ and -, starting with a letter, at most 60 characters. They become URL segments and generated type names.',
              ),
            procedureDeclaration,
          )
          .describe(
            'The procedures the host may call on your server, by name, each with its input and output schema. At most 30.',
          )
          .optional(),
        events: z
          .array(
            z.enum(EVENTS, {
              error: issue =>
                `"${String(issue.input)}" is not a Tappify event. Subscribe to a name from the event catalogue.`,
            }),
          )
          .describe(
            'The Tappify events your server subscribes to. Each is delivered to `POST /tappify/events` as it happens, with the same body every host-to-vendor call carries.',
          )
          .optional(),
      })
      .strict()
      .describe(
        'Your own server: where the host calls it, and what it answers. Required once you declare a connector, a webhook, an assistant contribution, a work destination or a procedure.',
      )
      .optional(),
    telemetry: z
      .array(
        z
          .string()
          .regex(
            SNAKE_CASE,
            'Telemetry names are snake_case, such as "funnel_viewed".',
          )
          .max(60),
      )
      .max(20)
      .describe(
        'The telemetry names this extension may report. `tap.telemetry.event` rejects a name that is not declared here.',
      )
      .optional(),
    listing: listing
      .describe(
        'What owners read on your Tap Store listing page. A public extension needs all five fields.',
      )
      .optional(),
    pricing: z
      .never()
      .describe(
        'Reserved. Tappify sets pricing outside the manifest, so a manifest that carries this field fails validation.',
      )
      .optional(),
    score: z
      .never()
      .describe(
        'Reserved. Tappify computes the quality score, so a manifest that carries this field fails validation.',
      )
      .optional(),
  })
  .strict();

export function sdkMajors(range: string): number[] {
  const majors = new Set<number>();
  for (const alternative of range.split('||')) {
    for (const token of alternative.trim().split(/\s+/)) {
      if (token.startsWith('<')) continue;
      const match = /^(?:\^|~|>=|>|=)?\s*(\d+)/.exec(token);
      if (match) majors.add(Number(match[1]));
    }
  }
  return [...majors].sort((left, right) => left - right);
}

function uiCount(contributes: ExtensionManifest['contributes']): number {
  return (
    (contributes.pages?.length ?? 0) +
    (contributes.tabs?.length ?? 0) +
    (contributes.widgets?.length ?? 0) +
    (contributes.series?.length ?? 0) +
    (contributes.banners?.length ?? 0) +
    (contributes.rowActions?.length ?? 0) +
    (contributes.markers?.length ?? 0) +
    (contributes.settings ? 1 : 0)
  );
}

function hasRenderedSurface(
  contributes: ExtensionManifest['contributes'],
): boolean {
  return (
    (contributes.pages?.length ?? 0) > 0 ||
    (contributes.tabs?.length ?? 0) > 0 ||
    (contributes.widgets?.length ?? 0) > 0 ||
    (contributes.rowActions?.length ?? 0) > 0 ||
    (contributes.markers?.length ?? 0) > 0 ||
    contributes.settings !== undefined
  );
}

export const manifestSchema = manifestObject.superRefine((manifest, ctx) => {
  const granted = new Set<string>(manifest.scopes.map(scope => scope.key));
  const contributes = manifest.contributes;

  const requireScope = (
    key: string,
    path: (string | number)[],
    because: string,
  ): void => {
    if (granted.has(key)) return;
    ctx.addIssue({
      code: 'custom',
      path,
      message: `Add the ${key} scope: ${because}`,
    });
  };

  for (const [index, widget] of (contributes.widgets ?? []).entries()) {
    const slots = slotsForPage(widget.page);
    if (!slots.includes(widget.slot)) {
      ctx.addIssue({
        code: 'custom',
        path: ['contributes', 'widgets', index, 'slot'],
        message: `Slot "${widget.slot}" is not on the ${widget.page} page. Pick one of: ${slots.join(', ')}.`,
      });
    }
  }

  if (hasRenderedSurface(contributes)) {
    requireScope(
      'ui:render',
      ['scopes'],
      'this extension renders UI in the host.',
    );
  }

  if (uiCount(contributes) > 20) {
    ctx.addIssue({
      code: 'custom',
      path: ['contributes'],
      message:
        'An extension declares at most 20 UI contributions. Remove some, or split the extension in two.',
    });
  }

  if (contributes.storage) {
    requireScope(
      'storage:write',
      ['scopes'],
      'this extension declares hosted storage collections.',
    );
    if (Object.keys(contributes.storage).length > 10) {
      ctx.addIssue({
        code: 'custom',
        path: ['contributes', 'storage'],
        message: 'An extension declares at most 10 storage collections.',
      });
    }
    if ('settings' in contributes.storage) {
      ctx.addIssue({
        code: 'custom',
        path: ['contributes', 'storage', 'settings'],
        message:
          'The collection name "settings" is reserved for the settings contribution. Rename this collection.',
      });
    }
  }

  if (contributes.connector?.metrics?.length) {
    requireScope(
      'metrics:write',
      ['scopes'],
      'the connector writes metrics into the metrics store.',
    );
  }

  const webhookEventsAs = (as: 'alert' | 'banner' | 'event'): Set<string> =>
    new Set(
      (contributes.webhooks ?? [])
        .filter(webhook => webhook.as === as)
        .map(webhook => webhook.event),
    );

  const bannerEvents = webhookEventsAs('banner');
  const markerEvents = webhookEventsAs('event');

  if (
    (contributes.webhooks ?? []).some(
      webhook => webhook.as === 'alert' || webhook.as === 'banner',
    )
  ) {
    requireScope(
      'alerts:write',
      ['scopes'],
      'a declared webhook becomes an alert or a banner.',
    );
  }

  for (const [index, banner] of (contributes.banners ?? []).entries()) {
    if (!bannerEvents.has(banner.event)) {
      ctx.addIssue({
        code: 'custom',
        path: ['contributes', 'banners', index, 'event'],
        message: `Event "${banner.event}" is not declared under webhooks. Declare it with as: "banner".`,
      });
    }
  }

  for (const [index, marker] of (contributes.markers ?? []).entries()) {
    if (!markerEvents.has(marker.event)) {
      ctx.addIssue({
        code: 'custom',
        path: ['contributes', 'markers', index, 'event'],
        message: `Event "${marker.event}" is not declared under webhooks. Declare it with as: "event".`,
      });
    }
  }

  if ((contributes.markers?.length ?? 0) > 0) {
    requireScope('ui:render', ['scopes'], 'markers draw on a host chart.');
    requireScope(
      'alerts:write',
      ['scopes'],
      'markers come from declared webhooks.',
    );
  }

  const metricKeys = new Set(
    (contributes.connector?.metrics ?? []).map(metric => metric.key),
  );

  for (const [index, series] of (contributes.series ?? []).entries()) {
    if (!metricKeys.has(series.metric)) {
      ctx.addIssue({
        code: 'custom',
        path: ['contributes', 'series', index, 'metric'],
        message: `Metric "${series.metric}" is not declared by the connector. Add it under contributes.connector.metrics.`,
      });
    }
  }

  const ai = contributes.ai;
  if (ai?.tools?.length || ai?.mentions?.length) {
    requireScope('ai:tools', ['scopes'], 'the assistant calls declared tools.');
  }
  if (ai?.actions?.length) {
    requireScope(
      'ai:actions',
      ['scopes'],
      'declared actions run behind approval.',
    );
    for (const [index, action] of ai.actions.entries()) {
      if (!granted.has(action.scope)) {
        ctx.addIssue({
          code: 'custom',
          path: ['contributes', 'ai', 'actions', index, 'scope'],
          message: `Add the ${action.scope} scope: the action "${action.id}" declares it.`,
        });
      }
    }
  }
  if (ai?.skills?.length || ai?.prompts?.length || ai?.context?.length) {
    requireScope(
      'ai:skills',
      ['scopes'],
      'skills, prompts and context providers shape the assistant.',
    );
  }

  const toolIds = new Set((ai?.tools ?? []).map(tool => tool.id));
  for (const [index, prompt] of (ai?.prompts ?? []).entries()) {
    for (const [afterIndex, toolId] of (prompt.after ?? []).entries()) {
      if (!toolIds.has(toolId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['contributes', 'ai', 'prompts', index, 'after', afterIndex],
          message: `Tool "${toolId}" is not declared by this extension. Use one of your own tool ids.`,
        });
      }
    }
  }

  if (contributes.work) {
    requireScope(
      'work:create',
      ['scopes'],
      'the work destination creates items.',
    );
    requireScope(
      'work:sync',
      ['scopes'],
      'the work destination syncs comments and status.',
    );
  }

  const needsServer =
    contributes.connector !== undefined ||
    (contributes.webhooks?.length ?? 0) > 0 ||
    ai !== undefined ||
    contributes.work !== undefined ||
    manifest.server?.procedures !== undefined;

  if (needsServer && !manifest.server?.baseUrl) {
    ctx.addIssue({
      code: 'custom',
      path: ['server', 'baseUrl'],
      message:
        'Set server.baseUrl: connectors, webhooks, assistant contributions, work destinations and procedures all call your server.',
    });
  }

  const procedures = manifest.server?.procedures ?? {};
  if (Object.keys(procedures).length > 30) {
    ctx.addIssue({
      code: 'custom',
      path: ['server', 'procedures'],
      message: 'An extension declares at most 30 procedures.',
    });
  }

  for (const scope of manifest.scopes) {
    const definition = findScope(scope.key);
    if (definition?.requiresJustification && !scope.justification) {
      ctx.addIssue({
        code: 'custom',
        path: ['scopes'],
        message: `${scope.key} needs a justification of 20 to 500 characters that tells the owner why you ask for it.`,
      });
    }
  }

  if (manifest.visibility === 'public') {
    const missing = LISTING_FIELDS.filter(
      field => manifest.listing?.[field] === undefined,
    );
    if (missing.length > 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['listing'],
        message: `A public extension needs a complete listing: add ${missing.join(', ')}. Set them with \`tappify extension set listing.<field> <value>\`, or keep visibility "unlisted" or "private" until the listing is ready.`,
      });
    }
  }

  if (manifest.installScope === 'organization') {
    const forbidden = (['pages', 'tabs', 'widgets', 'series'] as const).filter(
      key => (contributes[key]?.length ?? 0) > 0,
    );
    if (forbidden.length > 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['installScope'],
        message: `Organization-scoped extensions cannot contribute widgets, tabs, pages or series, because those render on a project. Remove ${forbidden.join(', ')}, or set installScope to "project".`,
      });
    }
  }

  if (
    !sdkMajors(manifest.sdk).some(major => SERVED_SDK_MAJORS.includes(major))
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['sdk'],
      message: `The host serves SDK major ${SERVED_SDK_MAJORS.join(', ')}. Set sdk to a range that includes it, such as "^2.0.0".`,
    });
  }
});

export function manifestJsonSchema(): Record<string, unknown> {
  const { $schema, ...generated } = z.toJSONSchema(manifestObject, {
    target: 'draft-2020-12',
  });
  return {
    $schema,
    $id: 'https://schema.tappify.ai/extension/v2.json',
    title: 'Tappify extension manifest',
    description:
      'The tappify.extension.json file at the root of an extension repository.',
    ...generated,
  };
}

/**
 * A record whose key schema rejects reports only "Invalid key in record", so the
 * key schema's own message is lifted out of the nested issue.
 */
function issueMessage(issue: z.core.$ZodIssue): string {
  if (issue.code !== 'invalid_key') return issue.message;
  return issue.issues[0]?.message ?? issue.message;
}

export function validateManifest(value: unknown): ManifestValidation {
  const result = manifestSchema.safeParse(value);
  if (result.success) {
    return { ok: true, manifest: result.data };
  }

  const issues: ManifestIssue[] = result.error.issues.map(issue => ({
    path: issue.path.length > 0 ? issue.path.join('.') : '(root)',
    message: issueMessage(issue),
  }));

  return { ok: false, issues };
}
