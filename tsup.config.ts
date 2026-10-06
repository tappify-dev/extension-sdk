import { defineConfig } from 'tsup';

const shared = {
  format: ['cjs', 'esm'] as const,
  dts: true,
  sourcemap: true,
  outExtension({ format }: { format: string }) {
    return { js: format === 'esm' ? '.mjs' : '.cjs' };
  },
};

export default defineConfig([
  {
    ...shared,
    entry: {
      index: 'src/index.ts',
      manifest: 'src/manifest.ts',
      host: 'src/host.ts',
      'vite-preview': 'src/vite-preview.tsx',
      server: 'src/server.ts',
      'testing/index': 'src/testing/index.ts',
      'testing/vitest': 'src/testing/vitest.ts',
      'testing/jest': 'src/testing/jest.ts',
    },
    splitting: true,
    external: [
      'react',
      'react-dom',
      'react/jsx-runtime',
      '@tanstack/react-query',
      '@testing-library/react',
      '@module-federation/runtime',
      'jose',
      'vitest',
    ],
  },
  {
    ...shared,
    entry: { codegen: 'src/codegen.ts' },
    external: ['json-schema-to-typescript'],
  },
  {
    ...shared,
    entry: { vite: 'src/vite.ts' },
    external: ['@module-federation/vite', 'vite'],
  },
]);
