import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

interface Block {
  source: string;
  symbol: string;
  lines: string[];
}

interface NamedImport {
  name: string;
  typeOnly: boolean;
}

interface ModuleImport {
  specifier: string;
  defaultName: string | undefined;
  namespaceName: string | undefined;
  named: Map<string, NamedImport>;
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = join(root, 'src');
const outputPath = join(root, 'test/tsdoc-examples.generated.tsx');

const sourceFiles = (directory: string): string[] => {
  const out: string[] = [];
  for (const entry of readdirSync(directory).sort()) {
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__') continue;
      out.push(...sourceFiles(full));
      continue;
    }
    if (!/\.tsx?$/.test(entry)) continue;
    if (/\.(test|spec)\./.test(entry)) continue;
    out.push(full);
  }
  return out;
};

/** The declaration a doc comment belongs to, named for the example's label. */
const symbolAfter = (lines: string[], index: number): string => {
  for (let cursor = index; cursor < lines.length; cursor += 1) {
    const line = lines[cursor];
    const match =
      /^\s*(?:export\s+)?(?:declare\s+)?(?:abstract\s+)?(?:async\s+)?(?:function|class|interface|type|const|let|var|enum)\s+([A-Za-z_$][\w$]*)/.exec(
        line,
      ) ?? /^\s*([A-Za-z_$][\w$]*)[<(]/.exec(line);
    if (match !== null) return match[1];
  }
  return 'unknown';
};

const blocksIn = (file: string): Block[] => {
  const source = relative(root, file);
  const lines = readFileSync(file, 'utf8').split('\n');
  const blocks: Block[] = [];

  let inComment = false;
  let inExample = false;
  let fence: string | null = null;
  let current: string[] | null = null;
  let commentStart = 0;

  for (const [index, raw] of lines.entries()) {
    const trimmed = raw.trim();

    if (!inComment) {
      if (!trimmed.startsWith('/**')) continue;
      inComment = true;
      inExample = false;
      commentStart = index;
      if (trimmed.endsWith('*/')) inComment = false;
      continue;
    }

    if (trimmed === '*/' || trimmed.endsWith('*/')) {
      inComment = false;
      inExample = false;
      fence = null;
      current = null;
      continue;
    }

    const body = raw.replace(/^\s*\*[ ]?/, '');
    const tag = /^@([a-zA-Z]+)/.exec(body.trim());

    if (fence === null && tag !== null) {
      inExample = tag[1] === 'example';
      continue;
    }

    if (!inExample) continue;

    const opening = /^(```|~~~)([A-Za-z]*)\s*$/.exec(body.trim());
    if (fence === null) {
      if (opening === null) continue;
      const language = opening[2].toLowerCase();
      if (language !== 'ts' && language !== 'tsx') {
        throw new Error(
          `${source}:${String(index + 1)} an @example fence has language "${opening[2]}"; use ts or tsx.`,
        );
      }
      fence = opening[1];
      current = [];
      continue;
    }

    if (body.trim() === fence) {
      if (current !== null) {
        blocks.push({
          source,
          symbol: symbolAfter(lines, commentStart),
          lines: current,
        });
      }
      fence = null;
      current = null;
      continue;
    }

    current?.push(body);
  }

  return blocks;
};

const parseNamed = (clause: string, typeOnly: boolean): NamedImport[] =>
  clause
    .split(',')
    .map(part => part.trim())
    .filter(part => part !== '')
    .map(part => {
      const withType = /^type\s+(.+)$/.exec(part);
      const specifier = withType === null ? part : withType[1].trim();
      const alias = /\sas\s+([A-Za-z_$][\w$]*)$/.exec(specifier);
      const name = alias === null ? specifier : specifier;
      return { name: name.trim(), typeOnly: typeOnly || withType !== null };
    });

const modules = new Map<string, ModuleImport>();
const sideEffects = new Set<string>();
const ownerOf = new Map<string, { specifier: string; source: string }>();

const moduleFor = (specifier: string): ModuleImport => {
  const existing = modules.get(specifier);
  if (existing) return existing;
  const created: ModuleImport = {
    specifier,
    defaultName: undefined,
    namespaceName: undefined,
    named: new Map(),
  };
  modules.set(specifier, created);
  return created;
};

const claim = (name: string, specifier: string, source: string): void => {
  const owner = ownerOf.get(name);
  if (owner !== undefined && owner.specifier !== specifier) {
    throw new Error(
      `Two @example blocks import "${name}" from different modules: "${owner.specifier}" in ${owner.source} and "${specifier}" in ${source}.`,
    );
  }
  ownerOf.set(name, { specifier, source });
};

/** Folds a multi-line import back onto one line, so the parser sees one statement. */
const joinImports = (lines: string[]): string[] => {
  const out: string[] = [];
  let pending: string[] | null = null;

  for (const line of lines) {
    if (pending !== null) {
      pending.push(line.trim());
      if (line.trim().endsWith(';')) {
        out.push(pending.join(' '));
        pending = null;
      }
      continue;
    }

    const trimmed = line.trim();
    if (trimmed.startsWith('import ') && !trimmed.endsWith(';')) {
      pending = [trimmed];
      continue;
    }
    out.push(line);
  }

  if (pending !== null) {
    throw new Error(`An @example import statement never closed: ${pending[0]}`);
  }

  return out;
};

/** Returns the line when it is not an import, so the block keeps its own body. */
const takeImport = (line: string, source: string): string | null => {
  const trimmed = line.trim();
  if (!trimmed.startsWith('import ')) return line;

  const bare = /^import\s+'([^']+)';?$/.exec(trimmed);
  if (bare !== null) {
    sideEffects.add(bare[1]);
    return null;
  }

  const statement = /^import\s+(type\s+)?(.+?)\s+from\s+'([^']+)';?$/.exec(
    trimmed,
  );
  if (statement === null) {
    throw new Error(
      `${source}: an @example import is not a single-line import statement: ${trimmed}`,
    );
  }

  const typeOnly = statement[1] !== undefined;
  const clause = statement[2].trim();
  const specifier = statement[3];
  const entry = moduleFor(specifier);

  const namespace = /^\*\s+as\s+([A-Za-z_$][\w$]*)$/.exec(clause);
  if (namespace !== null) {
    claim(namespace[1], specifier, source);
    entry.namespaceName = namespace[1];
    return null;
  }

  const braced = /^(?:([A-Za-z_$][\w$]*)\s*,\s*)?\{(.*)\}$/.exec(clause);
  if (braced === null) {
    claim(clause, specifier, source);
    entry.defaultName = clause;
    return null;
  }

  if (braced[1] !== undefined) {
    claim(braced[1], specifier, source);
    entry.defaultName = braced[1];
  }

  for (const named of parseNamed(braced[2], typeOnly)) {
    claim(named.name, specifier, source);
    const already = entry.named.get(named.name);
    entry.named.set(named.name, {
      name: named.name,
      typeOnly: (already?.typeOnly ?? true) && named.typeOnly,
    });
  }

  return null;
};

const renderImport = (entry: ModuleImport): string[] => {
  const out: string[] = [];
  if (entry.namespaceName !== undefined) {
    out.push(
      `import * as ${entry.namespaceName} from '${entry.specifier}';`,
    );
  }

  const names = [...entry.named.values()]
    .sort((left, right) => left.name.localeCompare(right.name))
    .map(named => (named.typeOnly ? `type ${named.name}` : named.name));

  if (entry.defaultName !== undefined && names.length === 0) {
    out.push(`import ${entry.defaultName} from '${entry.specifier}';`);
  } else if (names.length > 0) {
    const head =
      entry.defaultName === undefined ? '' : `${entry.defaultName}, `;
    out.push(
      `import ${head}{ ${names.join(', ')} } from '${entry.specifier}';`,
    );
  }

  return out;
};

const blocks = sourceFiles(sourceRoot).flatMap(blocksIn);
const bodies: string[] = [];

for (const [index, block] of blocks.entries()) {
  const body = joinImports(block.lines)
    .map(line => takeImport(line, `${block.source}:${block.symbol}`))
    .filter((line): line is string => line !== null);

  while (body.length > 0 && body[0].trim() === '') body.shift();
  while (body.length > 0 && body[body.length - 1].trim() === '') body.pop();

  bodies.push(
    [
      `// Example ${String(index + 1)} — ${block.source}:${block.symbol}`,
      '{',
      ...body.map(line => (line.trim() === '' ? '' : `  ${line}`)),
      '}',
      '',
    ].join('\n'),
  );
}

const imports = [
  ...[...sideEffects].sort().map(specifier => `import '${specifier}';`),
  ...[...modules.keys()].sort().flatMap(specifier => {
    const entry = modules.get(specifier);
    return entry === undefined ? [] : renderImport(entry);
  }),
];

const file = [
  '/* eslint-disable */',
  '// Generated by scripts/check-tsdoc-examples.ts from the @example blocks in src/.',
  '// Do not edit by hand and do not commit: `pnpm docs:examples` rewrites it.',
  '// The SDK tree carries no tappify.d.ts, so a declared storage document, a',
  '// procedure output and an action input are `unknown` here, the way they are for',
  '// a vendor who has not run `tappify extension types` yet.',
  '',
  ...imports,
  '',
  ...bodies,
  'export {};',
  '',
].join('\n');

writeFileSync(outputPath, file, 'utf8');
process.stdout.write(`examples ${String(blocks.length)} written\n`);
