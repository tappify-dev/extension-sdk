import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

interface Entry {
  entryPoints: string[];
  directory: string;
  label: string;
}

const ENTRIES: Entry[] = [
  {
    entryPoints: ['src/index.ts', 'src/ui.ts'],
    directory: 'frontend-api',
    label: 'Frontend API',
  },
  {
    entryPoints: ['src/server.ts'],
    directory: 'server-api',
    label: 'Server API',
  },
  {
    entryPoints: ['src/testing/index.ts'],
    directory: 'testing-api',
    label: 'Testing API',
  },
];

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const typedocCli = resolve(
  dirname(fileURLToPath(import.meta.resolve('typedoc/package.json'))),
  'bin/typedoc',
);
const docsRoot = resolve(
  root,
  process.argv[2] ?? process.env.TAPPIFY_DOCS_ROOT ?? '../documentation',
);
const referenceRoot = resolve(docsRoot, 'extensions/reference');

// The generator removes and rewrites directories under this root, so it
// refuses a path that is not the documentation repository.
if (!existsSync(join(docsRoot, 'docs.json'))) {
  throw new Error(
    `${docsRoot} has no docs.json; pass the documentation checkout as the first argument or TAPPIFY_DOCS_ROOT.`,
  );
}

const quote = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

const plainText = (value: string): string =>
  value
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[*_]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const extractSummary = (
  lines: string[],
): { description: string | null; body: string[] } => {
  const start = lines.findIndex(line => line.trim() !== '');
  if (start === -1 || /^(#|```|~~~)/.test(lines[start].trim())) {
    return { description: null, body: lines };
  }

  let end = start;
  while (end < lines.length && lines[end].trim() !== '') end += 1;
  const description = plainText(lines.slice(start, end).join(' '));
  while (end < lines.length && lines[end].trim() === '') end += 1;
  return {
    description: description === '' ? null : description,
    body: lines.slice(end),
  };
};

const rewriteLinks = (text: string, directory: string): string =>
  text.replace(
    /\]\((?!https?:|\/)([A-Za-z0-9._-]+)\.mdx(#[A-Za-z0-9._-]+)?\)/g,
    (_match, file: string, hash: string | undefined) =>
      `](/extensions/reference/${directory}/${file}${hash ?? ''})`,
  );

const symbolName = (fileName: string): string => {
  const withoutExtension = fileName.replace(/\.mdx$/, '');
  const parts = withoutExtension.split('.');
  return parts[parts.length - 1];
};

const generated: Record<string, string[]> = {};

for (const entry of ENTRIES) {
  const target = join(referenceRoot, entry.directory);
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });

  execFileSync(
    process.execPath,
    [typedocCli, '--entryPoints', ...entry.entryPoints, '--out', target],
    { cwd: root, stdio: 'inherit' },
  );

  rmSync(join(target, 'index.mdx'), { force: true });

  const pages: string[] = [];

  for (const fileName of readdirSync(target).sort()) {
    if (!fileName.endsWith('.mdx')) continue;

    const filePath = join(target, fileName);
    const lines = readFileSync(filePath, 'utf8').split('\n');

    const headingIndex = lines.findIndex(line => /^#\s+/.test(line));
    const title =
      headingIndex === -1
        ? symbolName(fileName)
        : lines[headingIndex].replace(/^#\s+/, '').trim();
    const rest = headingIndex === -1 ? lines : lines.slice(headingIndex + 1);
    const summary = extractSummary(rest);
    const description =
      summary.description ?? `${title} in the Tappify extension SDK.`;

    const body = rewriteLinks(summary.body.join('\n'), entry.directory)
      .trim()
      .replace(/[ \t]+$/gm, '');
    const page = [
      '---',
      `title: "${quote(title)}"`,
      `description: "${quote(description)}"`,
      '---',
      ...(body === '' ? [] : ['', body]),
      '',
    ].join('\n');

    writeFileSync(filePath, page);
    pages.push(
      `extensions/reference/${entry.directory}/${fileName.replace(/\.mdx$/, '')}`,
    );
  }

  generated[entry.label] = pages;
  process.stdout.write(`${entry.label}: ${pages.length} pages\n`);
}

writeFileSync(
  join(referenceRoot, '_generated.json'),
  `${JSON.stringify(generated, null, 2)}\n`,
);
