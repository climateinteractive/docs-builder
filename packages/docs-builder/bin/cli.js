#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

import liveServer from '@compodoc/live-server'
import chokidar from 'chokidar'

import { buildDocs, prepareOutDir, writeOutputFile } from '../dist/index.js'

// TODO: For now assume the current directory is the root; need to make this configurable
const rootDir = process.cwd()

// TODO: For now use `projects` if it exists, otherwise use the current directory
// as the projects directory; need to make this configurable
let projectsDir = path.resolve(rootDir, 'projects')
if (!fs.existsSync(projectsDir)) {
  projectsDir = rootDir
}

async function build(opts) {
  // TODO: For now, output to `public` under the root directory; need to make this configurable
  const baseOutDir = path.resolve(rootDir, 'public')

  if (opts.initial) {
    // Create the base output directory (this will remove the directory first if it
    // already exists)
    prepareOutDir(baseOutDir)
  }

  // TODO: For now, if root directory contains `.config.js[on]`, use that as the single project;
  // need to make this configurable
  const rootConfigJsonFile = path.resolve(rootDir, '.config.json')
  const rootConfigJsFile = path.resolve(rootDir, '.config.js')
  let projDirs
  if (fs.existsSync(rootConfigJsonFile) || fs.existsSync(rootConfigJsFile)) {
    // Use the root directory as the single project
    projDirs = [rootDir]
  } else {
    // Find each project that contains a `.config.js[on]` file
    projDirs = fs
      .readdirSync(projectsDir, { withFileTypes: true })
      .filter(dirent => {
        if (dirent.isDirectory()) {
          const configJsonFile = path.resolve(projectsDir, dirent.name, '.config.json')
          const configJsFile = path.resolve(projectsDir, dirent.name, '.config.js')
          return fs.existsSync(configJsonFile) || fs.existsSync(configJsFile)
        } else {
          return false
        }
      })
      .map(dirent => path.resolve(projectsDir, dirent.name))
  }

  // TODO: For now use `_shared/src` if it is found, otherwise fall back on `src`; need
  // to make this configurable
  let sourceDir = path.resolve(projectsDir, '_shared', 'src')
  if (!fs.existsSync(sourceDir)) {
    sourceDir = path.resolve(projectsDir, 'src')
    if (!fs.existsSync(sourceDir)) {
      console.error('ERROR: Must provide a `<projects>/_shared/src` or `<projects>/src` directory')
      process.exit(1)
    }
  }

  // Generate docs for each project
  for (const projDir of projDirs) {
    await buildDocs({
      mode: opts.mode,
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

function watch() {
  // Add a small delay so that if multiple files are changed at once (as is
  // often the case when switching branches), we batch them up and start the
  // the build after things settle down
  const delay = 100
  const changedPaths = new Set()

  function performRebuild() {
    console.log('')
    for (const path of changedPaths) {
      console.log(`File ${path} has been changed`)
    }
    console.log(`Changes detected in ${changedPaths.size} sources, rebuilding...`)

    // Clear the set of pending files
    changedPaths.clear()

    // Restart the build processes
    console.log('Starting builder processes')
    build({
      mode: 'development',
      initial: false
    })
  }

  function scheduleRebuild(changedPath) {
    // Only schedule the build if the set is currently empty
    const schedule = changedPaths.size === 0

    // Add the path to the set of changed files
    changedPaths.add(changedPath)

    if (schedule) {
      // Schedule the build to start after a delay
      setTimeout(() => {
        performRebuild()
      }, delay)
    }
  }

  // Watch project directories and if any changes are detected, restart the
  // build processes
  const glob = p => p.replace(/\\/g, '/')
  const filesToWatch = [glob(projectsDir)]
  const watcher = chokidar.watch(filesToWatch, {
    ignoreInitial: true,
    ignored: [/en\/docs\.po/, /saved\.json/, /timestamp/, /public/],
    // XXX: Include a delay, otherwise on macOS we sometimes get multiple
    // change events when a file is saved just once
    awaitWriteFinish: {
      stabilityThreshold: 100
    }
  })
  watcher.on('add', scheduleRebuild)
  watcher.on('change', scheduleRebuild)
  watcher.on('unlink', scheduleRebuild)
  watcher.on('ready', () => {
    console.log('\nWaiting for changes...')
  })
  watcher.on('error', error => {
    console.error('Watcher encountered an error:')
    console.error(error)
  })
}

async function main() {
  const args = process.argv.slice(2)
  if (args.length === 1 && args[0] === 'dev') {
    // Enable development mode; build once before starting the local server
    console.log('\nPerforming initial build...')
    await build({
      mode: 'development',
      initial: true
    })
    console.log('Done with initial build!')

    // Set up a file watcher so that we rebuild any time a source file is changed
    watch()

    // Start local server
    liveServer.start({
      port: 8100,
      // TODO: Make this configurable
      open: '/public/en/latest/index.html',
      watch: 'timestamp',
      logLevel: 0
    })
  } else {
    // Build once
    await build({
      mode: 'production',
      initial: true
    })
  }
}

main()
