import { defineConfig } from 'tsdown'

export default defineConfig({
  tsconfig: 'tsconfig.json',
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'node',
  // Note that the declaration file source maps must be enabled explicitly; the top-level
  // `sourcemap` option below causes tsdown to add a `sourceMappingURL` comment to the
  // declaration files, but the map files themselves are only emitted when this is set
  dts: { sourcemap: true },
  sourcemap: true,
  clean: true,
  // Keep the plain `.js` and `.d.ts` extensions for the ESM output (tsdown defaults to
  // `.mjs` and `.d.mts`); this package is already `"type": "module"`, so the explicit
  // extensions are redundant, and this avoids changing the published file names
  outExtensions: () => ({ js: '.js', dts: '.d.ts' })
})
