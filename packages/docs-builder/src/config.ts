// Copyright (c) 2022 Climate Interactive / New Venture Fund

import { readFileSync } from 'fs'
import { dirname, resolve as resolvePath } from 'path'

import type { LangCode } from './types'

export type BuildMode = 'production' | 'development'

export interface LangConfig {
  /** The two-character code for the language. */
  code: LangCode

  /** The date-based semantic version of the translation for the language. */
  version: string
}

export interface Renderer {
  /**
   * Return an HTML element for the given Markdown link attributes, or undefined to fall back
   * on the default link handler.
   *
   * @param href The link href attribute.
   * @param title The link title attribute.
   * @param text The link text content.
   */
  link?(href: string, title: string, text: string): string | undefined
}

export interface Config {
  /** The build mode, either 'production' or 'development'. */
  mode: BuildMode

  /** The absolute path to the base directory for the documentation project. */
  baseProjDir: string

  /** The absolute path to the directory containing source/template files for the project. */
  sourceDir: string

  /** The absolute path to the output directory for the project. */
  outDir: string

  /** The date-based semantic version of the base (English) translation. */
  version: string

  /** The list of languages with an active translation. */
  langs: LangConfig[]

  /** The list of formats available for download (e.g., 'pdf'). */
  formats: string[]

  /** The name of the HTML template to use. */
  template: string

  /** The author name (used on the title page of the generated PDF). */
  author?: string

  /** The path to the logo image displayed in the sidebar (relative to the project directory). */
  logoPath: string

  /** The set of Markdown files containing common string/block definitions. */
  defs: string[]

  /** The set of Markdown files containing pages to be included. */
  pages: string[]

  /** The set of Markdown files that are not expected to be translated. */
  untranslated: string[]

  /** Additional options to control how the pages are generated. */
  options: { [key: string]: string | boolean }

  /** Optional callbacks that can be used to customize Markdown to HTML conversion. */
  renderer?: Renderer
}

/**
 * Read a JSON config file from disk and return a `Config` instance.
 *
 * @param configPath The absolute path to the config file.
 * @param sourceDir The absolute path to the directory containing source/template files for the project.
 */
export function readConfigFromFile(configPath: string, sourceDir: string, mode: BuildMode): Config {
  // For now, assume that the base directory for the project is the same as the one
  // containing the config file
  const baseProjDir = dirname(configPath)

  // TODO: Error handling
  const raw = readFileSync(configPath, 'utf8')
  const obj = JSON.parse(raw)

  const publicDir = resolvePath(process.cwd(), 'public')
  let outDir: string
  if (obj.out) {
    outDir = resolvePath(publicDir, obj.out)
  } else {
    outDir = publicDir
  }

  const langs: LangConfig[] = []
  if (obj.langs) {
    for (const lang of obj.langs) {
      if (!Array.isArray(lang) || lang.length !== 2) {
        throw new Error('Each "langs" entry must have a lang code and version')
      }
      langs.push({
        code: lang[0],
        version: lang[1]
      })
    }
  }

  return {
    mode,
    baseProjDir,
    sourceDir,
    outDir,
    version: obj.version,
    langs,
    formats: obj.formats || [],
    template: obj.template || 'default',
    author: obj.author,
    logoPath: obj.logo,
    defs: obj.defs,
    pages: obj.pages,
    untranslated: obj.untranslated || [],
    options: obj.options || {}
  }
}
