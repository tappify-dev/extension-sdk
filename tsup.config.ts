import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: {
      index: 'src/index.ts',
      config: 'src/config.ts',
    },
    format: ['cjs', 'esm'],
    dts: true,
    sourcemap: true,
    clean: true,
    external: ['react'],
    outExtension({ format }) {
      return { js: format === 'esm' ? '.mjs' : '.cjs' };
    },
  },
  {
    entry: {
      server: 'src/server.ts',
    },
    format: ['cjs', 'esm'],
    dts: true,
    sourcemap: true,
    external: ['react'],
    outExtension({ format }) {
      return { js: format === 'esm' ? '.mjs' : '.cjs' };
    },
  },
  {
    entry: {
      'vite-plugin': 'src/vite-plugin.ts',
    },
    format: ['cjs', 'esm'],
    dts: true,
    sourcemap: true,
    external: ['@module-federation/vite', 'vite'],
    outExtension({ format }) {
      return { js: format === 'esm' ? '.mjs' : '.cjs' };
    },
  },
]);
