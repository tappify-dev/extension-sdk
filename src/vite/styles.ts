import { existsSync, readFileSync } from 'node:fs';
import { dirname, extname, resolve, sep } from 'node:path';

const IMPORT_PATTERN =
  /(?:^|\n)\s*(?:import|export)(?:[^'"]*?from\s*)?\s*['"]([^'"]+)['"]/g;
const IMPORT_SPECIFIER_PATTERN =
  /((?:^|\n)\s*(?:import|export)(?:[^'"]*?from\s*)?\s*['"])([^'"]+)(['"])/g;
const BLOCK_COMMENT_PATTERN = /\/\*[\s\S]*?\*\//g;
const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs'];
const MAX_FILES = 300;

function withoutBlockComments(source: string): string {
  return source.replace(BLOCK_COMMENT_PATTERN, '');
}

function isPlainStylesheet(specifier: string): boolean {
  return specifier.endsWith('.css') && !specifier.endsWith('.module.css');
}

function resolveSource(specifier: string, importer: string): string | null {
  const base = resolve(dirname(importer), specifier);

  if (extname(base) !== '' && existsSync(base)) return base;

  for (const extension of SOURCE_EXTENSIONS) {
    const candidate = `${base}${extension}`;
    if (existsSync(candidate)) return candidate;
  }

  for (const extension of SOURCE_EXTENSIONS) {
    const candidate = resolve(base, `index${extension}`);
    if (existsSync(candidate)) return candidate;
  }

  return null;
}

export function collectEntryStyles(
  entryAbsolutePath: string,
  root: string,
): string[] {
  const boundary = root.endsWith(sep) ? root : `${root}${sep}`;
  const styles: string[] = [];
  const seenStyles = new Set<string>();
  const seenFiles = new Set<string>();
  const queue = [entryAbsolutePath];

  while (queue.length > 0 && seenFiles.size < MAX_FILES) {
    const file = queue.shift();
    if (file === undefined || seenFiles.has(file) || !existsSync(file))
      continue;
    seenFiles.add(file);

    const source = withoutBlockComments(readFileSync(file, 'utf8'));
    IMPORT_PATTERN.lastIndex = 0;

    let match = IMPORT_PATTERN.exec(source);
    while (match !== null) {
      const specifier = match[1];

      if (specifier.endsWith('.css')) {
        const value = specifier.startsWith('.')
          ? resolve(dirname(file), specifier)
          : specifier;
        if (!seenStyles.has(value)) {
          seenStyles.add(value);
          styles.push(value);
        }
      } else if (specifier.startsWith('.')) {
        const next = resolveSource(specifier, file);
        if (next !== null && next.startsWith(boundary)) queue.push(next);
      }

      match = IMPORT_PATTERN.exec(source);
    }
  }

  return styles;
}

export function inlineCssImports(code: string): string | null {
  let changed = false;

  const next = code.replace(
    IMPORT_SPECIFIER_PATTERN,
    (match: string, head: string, specifier: string, tail: string) => {
      if (!isPlainStylesheet(specifier)) return match;
      changed = true;
      return `${head}${specifier}?inline${tail}`;
    },
  );

  return changed ? next : null;
}
