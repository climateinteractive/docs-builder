// Copyright (c) 2022 Climate Interactive / New Venture Fund

import * as fs from 'fs'
import * as path from 'path'

export function readTextFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8')
}

export function prepareOutDir(outDir: string): void {
  // Remove the existing directory
  if (fs.existsSync(outDir)) {
    fs.rmSync(outDir, { recursive: true, force: true })
  }

  // Create the directories
  fs.mkdirSync(outDir, { recursive: true })
}

/**
 * Synchronously write a file with the given content.  If the parent directories do not
 * already exist, they will be created.
 *
 * @param outPath The absolute path of the file to be written.
 * @param content The text content.
 */
export function writeOutputFile(outPath: string, content: string): void {
  // Create the parent directories as needed
  const fullOutDir = path.dirname(outPath)
  if (!fs.existsSync(fullOutDir)) {
    fs.mkdirSync(fullOutDir, { recursive: true })
  }

  // Write the file
  fs.writeFileSync(outPath, content)
}
