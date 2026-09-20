import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

interface Schema {
  $ref?: string;
  $defs?: Record<string, Schema>;
  type?: string | string[];
  title?: string;
  description?: string;
  enum?: unknown[];
  const?: unknown;
  format?: string;
  pattern?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  items?: Schema;
  properties?: Record<string, Schema>;
  propertyNames?: Schema;
  required?: string[];
  additionalProperties?: boolean | Schema;
  anyOf?: Schema[];
  oneOf?: Schema[];
  not?: Schema;
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const schemaPath = resolve(root, 'schema/extension-v2.json');
const docsRoot = resolve(
  root,
  process.argv[2] ?? process.env.TAPPIFY_DOCS_ROOT ?? '../documentation',
);
const pagePath = resolve(docsRoot, 'extensions/reference/manifest.mdx');
const hostedSchemaPath = resolve(docsRoot, 'schema/extension/v2.json');

const document = JSON.parse(readFileSync(schemaPath, 'utf8')) as Schema;
const defs = document.$defs ?? {};

/** Pre-escaped for a table cell, because most type names are rendered in one. */
const UNION = ' \\| ';

/**
 * `z.toJSONSchema` writes every shape inline, so the manifest schema carries no `$ref`,
 * no `$defs` and no `oneOf`. This and the `oneOf` branch of `typeName` exist so a
 * future Zod version that starts hoisting shared shapes does not silently emit a
 * page full of `unknown`.
 */
const deref = (schema: Schema): Schema => {
  if (schema.$ref === undefined) return schema;
  const name = schema.$ref.replace('#/$defs/', '');
  const target = defs[name];
  if (target === undefined) return schema;
  return deref({ ...target, ...schema, $ref: undefined });
};

const typeName = (input: Schema): string => {
  const schema = deref(input);

  if (schema.not !== undefined) return 'never';
  if (schema.const !== undefined) return `\`${JSON.stringify(schema.const)}\``;
  if (Array.isArray(schema.enum)) {
    return schema.enum.map(value => `\`${JSON.stringify(value)}\``).join(UNION);
  }
  const branches = schema.anyOf ?? schema.oneOf;
  if (Array.isArray(branches)) {
    return [...new Set(branches.map(typeName))].join(UNION);
  }
  if (schema.type === 'array') {
    if (schema.items === undefined) return 'unknown[]';
    const item = typeName(schema.items);
    return item.includes(UNION) ? `(${item})[]` : `${item}[]`;
  }
  if (schema.type === 'object' || schema.properties !== undefined) {
    if (typeof schema.additionalProperties === 'object') {
      return `record of ${typeName(schema.additionalProperties)}`;
    }
    return 'object';
  }
  if (Array.isArray(schema.type)) return schema.type.join(UNION);
  return schema.type ?? 'unknown';
};

const count = (value: number, one: string, many: string): string =>
  `${value} ${value === 1 ? one : many}`;

const constraints = (input: Schema): string[] => {
  const schema = deref(input);
  const out: string[] = [];

  if (schema.pattern !== undefined) out.push(`pattern \`${schema.pattern}\``);
  if (schema.format !== undefined) out.push(`format \`${schema.format}\``);
  if (schema.propertyNames?.pattern !== undefined) {
    out.push(`keys match \`${schema.propertyNames.pattern}\``);
  }
  if (schema.minLength !== undefined && schema.maxLength !== undefined) {
    out.push(`${schema.minLength}–${schema.maxLength} characters`);
  } else if (schema.minLength !== undefined) {
    out.push(`at least ${count(schema.minLength, 'character', 'characters')}`);
  } else if (schema.maxLength !== undefined) {
    out.push(`at most ${count(schema.maxLength, 'character', 'characters')}`);
  }
  if (schema.minItems !== undefined && schema.maxItems !== undefined) {
    out.push(`${schema.minItems}–${schema.maxItems} entries`);
  } else if (schema.minItems !== undefined) {
    out.push(`at least ${count(schema.minItems, 'entry', 'entries')}`);
  } else if (schema.maxItems !== undefined) {
    out.push(`at most ${count(schema.maxItems, 'entry', 'entries')}`);
  }
  if (schema.minimum !== undefined) out.push(`minimum ${schema.minimum}`);
  if (schema.maximum !== undefined) out.push(`maximum ${schema.maximum}`);

  return out;
};

/**
 * An array of primitives hides its item rules behind `string[]`, and those rules
 * are what a publish actually rejects, so they are folded into the array's facts.
 */
const itemConstraints = (input: Schema): string[] => {
  const schema = deref(input);
  if (schema.type !== 'array' || schema.items === undefined) return [];
  const items = deref(schema.items);
  if (items.properties !== undefined || items.type === 'object') return [];
  return constraints(items).map(rule => `each ${rule}`);
};

/** Facts a field carries wherever it is rendered: a section heading or a table row. */
const facts = (input: Schema): string[] => [
  typeName(input),
  ...constraints(input),
  ...itemConstraints(input),
];

/** typeName already escapes the pipes inside a union, so escaping is idempotent. */
const escapeCell = (value: string): string => value.replace(/\\?\|/g, '\\|');

/** One row per property of an object schema, used for nested shapes. */
const propertyTable = (input: Schema): string[] => {
  const schema = deref(input);
  const properties = schema.properties ?? {};
  const required = new Set(schema.required ?? []);
  const names = Object.keys(properties);
  if (names.length === 0) return [];

  const rows = names.map(name => {
    const child = properties[name];
    const note = deref(child).description ?? '';
    return `| \`${name}\` | ${escapeCell(facts(child).join(', '))} | ${required.has(name) ? 'yes' : 'no'} | ${escapeCell(note)} |`;
  });

  return [
    '| Field | Type | Required | Means |',
    '| --- | --- | --- | --- |',
    ...rows,
  ];
};

/** The object a field's table describes: an array's item, a record's value, or the field. */
const shapeOf = (input: Schema): Schema => {
  const schema = deref(input);
  if (schema.type === 'array' && schema.items !== undefined) {
    return deref(schema.items);
  }
  if (typeof schema.additionalProperties === 'object') {
    return deref(schema.additionalProperties);
  }
  return schema;
};

const hasShape = (input: Schema): boolean =>
  Object.keys(shapeOf(input).properties ?? {}).length > 0;

/**
 * The `$ref` a child stands on, read through an array's items and a record's
 * values as well, so an array of self is on the chain the cycle guard walks.
 */
const refOf = (input: Schema): string | undefined => {
  if (input.$ref !== undefined) return input.$ref;
  const schema = deref(input);
  if (schema.type === 'array') return schema.items?.$ref;
  if (typeof schema.additionalProperties === 'object') {
    return schema.additionalProperties.$ref;
  }
  return undefined;
};

/**
 * Sections run to depth 3, so a table at depth 3 still names its own fields and
 * every path in the schema is either a heading or a row under one.
 */
const MAX_DEPTH = 3;

const section = (
  path: string,
  input: Schema,
  required: boolean,
  depth: number,
  seen: ReadonlySet<string>,
): string[] => {
  const schema = deref(input);
  const heading = '#'.repeat(Math.min(depth + 2, 4));
  const lead = [
    typeName(schema),
    required ? 'required' : 'optional',
    ...constraints(schema),
    ...itemConstraints(schema),
  ];

  const lines = [`${heading} \`${path}\``, '', lead.join(' · '), ''];

  if (schema.description !== undefined) lines.push(schema.description, '');

  const nested = shapeOf(schema);
  const table = propertyTable(nested);
  if (table.length > 0) lines.push(...table, '');

  if (depth >= MAX_DEPTH) return lines;

  const children = nested.properties ?? {};
  const childRequired = new Set(nested.required ?? []);

  for (const name of Object.keys(children)) {
    const child = children[name];
    if (!hasShape(child)) continue;
    const pointer = refOf(child);
    if (pointer !== undefined && seen.has(pointer)) continue;
    lines.push(
      ...section(
        `${path}.${name}`,
        child,
        childRequired.has(name),
        depth + 1,
        pointer === undefined ? seen : new Set([...seen, pointer]),
      ),
    );
  }

  return lines;
};

const properties = document.properties ?? {};
const required = new Set(document.required ?? []);

const body = Object.keys(properties).flatMap(name =>
  section(name, properties[name], required.has(name), 0, new Set<string>()),
);

const page = [
  '---',
  'title: "Manifest schema"',
  'description: "Every field of tappify.extension.json, generated from the published JSON Schema."',
  'icon: "file-code"',
  '---',
  '',
  'Every field `tappify.extension.json` accepts. This page is generated from the JSON Schema',
  'the SDK, the CLI and Tappify all validate against, so it cannot drift from what a publish',
  'enforces. Do not edit it by hand; the next SDK release overwrites it.',
  '',
  'Point your editor at it and get completion and validation while you edit:',
  '',
  '```json',
  '{ "$schema": "https://schema.tappify.ai/extension/v2.json" }',
  '```',
  '',
  '`tappify extension init` writes that line, and',
  '[`tappify extension doctor`](/extensions/test/doctor-checks) adds it when it is missing.',
  '',
  ...body,
].join('\n');

mkdirSync(dirname(pagePath), { recursive: true });
writeFileSync(pagePath, `${page.trimEnd()}\n`);

mkdirSync(dirname(hostedSchemaPath), { recursive: true });
copyFileSync(schemaPath, hostedSchemaPath);

process.stdout.write(`${pagePath}\n${hostedSchemaPath}\n`);
