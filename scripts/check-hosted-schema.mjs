import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const argv = process.argv.slice(2);
const [sourcePath, hostedPath] = argv[0] === '--' ? argv.slice(1) : argv;

if (!sourcePath || !hostedPath) {
  throw new Error('usage: check-hosted-schema <source> <hosted>');
}

const source = readFileSync(resolve(sourcePath), 'utf8');
const hosted = readFileSync(resolve(hostedPath), 'utf8');
const parsed = JSON.parse(hosted);

if (parsed.$id !== 'https://schema.tappify.ai/extension/v2.json') {
  throw new Error(`unexpected schema $id: ${String(parsed.$id)}`);
}

if (source !== hosted) {
  throw new Error('hosted schema differs from SDK schema');
}
