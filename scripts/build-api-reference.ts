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
  entryPoint: string;
  directory: string;
  label: string;
}

const ENTRIES: Entry[] = [
  {
    entryPoint: 'src/index.ts',
    directory: 'frontend-api',
    label: 'Frontend API',
  },
  { entryPoint: 'src/server.ts', directory: 'server-api', label: 'Server API' },
  {
    entryPoint: 'src/testing/index.ts',
    directory: 'testing-api',
    label: 'Testing API',
  },
];

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
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

/** Typedoc escapes markdown punctuation; a frontmatter description is plain text. */
const unescapeMarkdown = (value: string): string =>
  value.replace(/\\([\\`*_{}[\]()#+\-.!<>|~])/g, '$1');

/**
 * The symbol's own summary, which typedoc writes into the preamble above the first
 * section heading. Fenced blocks are skipped whole, because with `useCodeBlocks` the
 * preamble opens with the signature and a signature fragment is not a description; the
 * scan stops at the first heading, because everything below it describes a member rather
 * than the symbol.
 */
const firstSentence = (lines: string[]): string => {
  let fenced = false;
  const paragraph: string[] = [];

  for (const line of lines) {
    const text = line.trim();
    if (/^(```|~~~)/.test(text)) {
      fenced = !fenced;
      continue;
    }
    if (fenced) continue;
    if (/^#{1,6}\s/.test(text)) break;

    const stripped = unescapeMarkdown(text)
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/[*`_]/g, '')
      .trim();

    if (stripped === '') {
      if (paragraph.length > 0) break;
      continue;
    }
    paragraph.push(stripped);
  }

  if (paragraph.length === 0) return '';

  const prose = paragraph.join(' ');
  const stop = /[.!?](\s|$)/.exec(prose);
  const sentence = stop === null ? prose : prose.slice(0, stop.index + 1);
  return sentence.length > 160 ? `${sentence.slice(0, 157)}…` : sentence;
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
    'pnpm',
    ['exec', 'typedoc', '--entryPoints', entry.entryPoint, '--out', target],
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

    const summary = firstSentence(rest);
    const description =
      summary === '' ? `${title} in the Tappify extension SDK.` : summary;

    const page = [
      '---',
      `title: "${quote(title)}"`,
      `description: "${quote(description)}"`,
      '---',
      '',
      rewriteLinks(rest.join('\n'), entry.directory).trim(),
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
