#!/usr/bin/env node

import fs from 'fs'
import { dirname, resolve as resolvePath } from 'path'
import { fileURLToPath } from 'url'

import { buildDocs, prepareOutDir, writeOutputFile } from '@climateinteractive/docs-builder'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

async function main() {
  // Create the base output directory (this will remove the directory first if it
  // already exists)
  const rootDir = resolvePath(__dirname, '..')
  const baseOutDir = resolvePath(rootDir, 'public')
  prepareOutDir(baseOutDir)

  const projDir = name => resolvePath(rootDir, 'projects', name)
  const outDir = name => resolvePath(baseOutDir, name)

  // Generate the "Sample Guide"
  await buildDocs(projDir('sample-guide'), outDir('sample-guide'))

  // Generate the top-level landing page
  await buildDocs(projDir('top-level'), baseOutDir)

  // Write a timestamp file.  This will be used to trigger a reload of the local
  // dev server only after all files have been written.  (This is better than
  // having the dev server watch all output files, since that may cause it to
  // reload midway through the build process, and this approach doesn't require
  // an artificial wait.)
  writeOutputFile(resolvePath(rootDir, 'timestamp'), new Date().toISOString())
}

main()
