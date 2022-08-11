#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

import liveServer from 'live-server'

import { buildDocs, prepareOutDir, writeOutputFile } from '../dist/index.js'

async function build(initial) {
  // TODO: For now assume the current directory is the root; make this configurable
  const rootDir = process.cwd()
  const projectsDir = path.resolve(rootDir, 'projects')
  const baseOutDir = path.resolve(rootDir, 'public')

  if (initial) {
    // Create the base output directory (this will remove the directory first if it
    // already exists)
    prepareOutDir(baseOutDir)
  }

  // Find each project that contains a `.config.json` file
  const projDirs = fs
    .readdirSync(projectsDir, { withFileTypes: true })
    .filter(dirent => {
      if (dirent.isDirectory()) {
        const configFile = path.resolve(projectsDir, dirent.name, '.config.json')
        return fs.existsSync(configFile)
      } else {
        return false
      }
    })
    .map(dirent => path.resolve(projectsDir, dirent.name))

  // TODO: Make this configurable
  const sourceDir = path.resolve(projectsDir, '_shared', 'src')

  // Generate docs for each project
  for (const projDir of projDirs) {
    await buildDocs({
      projDir,
      sourceDir
    })
  }

  // Write a timestamp file.  This will be used to trigger a reload of the local
  // dev server only after all files have been written.  (This is better than
  // having the dev server watch all output files, since that may cause it to
  // reload midway through the build process, and this approach doesn't require
  // an artificial wait.)
  writeOutputFile(path.resolve('timestamp'), new Date().toISOString())
}

async function main() {
  const args = process.argv.slice(2)
  if (args.length === 1 && args[0] === 'dev') {
    // Enable development mode; build once before starting the local server
    await build(true)

    // Set up a file watcher so that we rebuild any time a source file is changed
    // TODO

    // Start local server
    liveServer.start({
      port: 8100,
      // TODO: Make this configurable
      open: '/public/en/latest/index.html',
      watch: 'timestamp'
    })
  } else {
    // Build once
    await build(true)
  }
}

main()
