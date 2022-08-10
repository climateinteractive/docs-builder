// Copyright (c) 2022 Climate Interactive / New Venture Fund

import * as fs from 'fs'
import { dirname, resolve as resolvePath } from 'path'
import revHash from 'rev-hash'
import { writeOutputFile } from './fs'

export class Assets {
  private readonly map: Map<string, string> = new Map()

  /**
   * Copy the source file to the destination directory and change the
   * destination file name to include the hash.
   *
   * @param srcDir The absolute path to the directory containing the source file.
   * @param srcPath The path to the source file (relative to `srcDir`).
   * @param dstDir The absolute path to the destination directory.
   */
  copyWithHash(srcDir: string, srcPath: string, dstDir: string): void {
    // Copy the file
    const dstPath = copyWithHash(srcDir, srcPath, dstDir)

    // Add the mapping
    this.map.set(srcPath, dstPath)
  }

  /**
   * Write the given content to a file in the destination directory and
   * include the hash in the destination file name.
   *
   * @param content The text to be written.
   * @param srcPath The path to the source file (as used with the `get` function).
   * @param dstDir The absolute path to the destination directory.
   */
  writeWithHash(content: string, srcPath: string, dstDir: string): void {
    // Write the file
    const dstPath = writeWithHash(content, srcPath, dstDir)

    // Add the mapping
    this.map.set(srcPath, dstPath)
  }

  /**
   * Return the full path to the asset.
   */
  get(name: string): string | undefined {
    const p = this.map.get(name)
    if (!p) {
      throw new Error(`No asset found for ${name}`)
    }
    return p
  }
}

function copyWithHash(srcDir: string, srcPath: string, dstDir: string): string {
  // Compute the destination file path that includes the hash in the file name
  const fullSrcPath = resolvePath(srcDir, srcPath)
  const hash = revHash(fs.readFileSync(fullSrcPath))
  const m = srcPath.match(/(.*)\.(.*)$/)
  const dstPath = `${m[1]}.${hash}.${m[2]}`

  // Copy the file with the new name to the destination directory
  const fullDstPath = resolvePath(dstDir, dstPath)
  const dir = dirname(fullDstPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.copyFileSync(fullSrcPath, fullDstPath)

  return dstPath
}

function writeWithHash(content: string, srcPath: string, dstDir: string): string {
  // Compute the destination file path that includes the hash in the file name
  const hash = revHash(content)
  const m = srcPath.match(/(.*)\.(.*)$/)
  const dstPath = `${m[1]}.${hash}.${m[2]}`

  // Write the file with the new name to the destination directory
  const fullDstPath = resolvePath(dstDir, dstPath)
  writeOutputFile(fullDstPath, content)

  return dstPath
}
