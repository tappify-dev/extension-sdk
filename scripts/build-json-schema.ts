import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { manifestJsonSchema } from '../src/manifest/schema';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = resolve(root, 'schema/extension-v2.json');

mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, `${JSON.stringify(manifestJsonSchema(), null, 2)}\n`);
process.stdout.write(`${target}\n`);
