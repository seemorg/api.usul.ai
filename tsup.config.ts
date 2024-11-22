import type { Options } from 'tsup';
import { defineConfig } from 'tsup';

export default defineConfig((options: Options) => ({
  entryPoints: ['src/index.ts'],
  clean: true,
  format: 'esm',
  platform: 'node',
  target: 'node18',
  sourcemap: true,
  ...options,
}));
