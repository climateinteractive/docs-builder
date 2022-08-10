// Copyright (c) 2022 Climate Interactive / New Venture Fund

import { resolve as resolvePath } from 'path'
import glob from 'glob'
import semverCompare from 'semver-compare'

import { Assets } from './assets'
import type { LangConfig } from './config'
import { readConfigFromFile } from './config'
import { Context } from './context'
import { prepareOutDir, readTextFile, writeOutputFile } from './fs'
import { generateHtml, writeCompleteHtmlFile, writeErrorHtmlFile, writeHtmlFile } from './gen-html'
import { writePdfFile } from './gen-pdf'
import { parseMarkdownPage } from './parse'
import { readPoFile, writeBasePoFile } from './translation'
import type { HtmlPage, MarkdownPage } from './types'

/**
 * Generate HTML documentation for the given project.
 *
 * @param projDir The absolute path to the directory containing the documentation project files.
 * @param outDir The absolute path to the directory that will contain the generated files.
 */
export async function buildDocs(projDir: string, outDir: string): Promise<void> {
  // Read the config from a file
  const configFile = resolvePath(projDir, '.config.json')
  const config = readConfigFromFile(configFile)

  // Create the context that holds scopes and blocks
  const enContext = new Context(config, outDir, 'en')

  try {
    // Read common string definitions
    for (const defPath of config.defs) {
      parseMarkdownPage(enContext, defPath)
    }

    // Build each supported language
    await buildLangs(enContext)
  } catch (e) {
    handleError(enContext, e)
    return
  }
}

/**
 * Build the HTML files and copy assets for each configured language.
 *
 * @param enContext The base (English) context.
 */
async function buildLangs(enContext: Context): Promise<void> {
  // Process all pages for each supported language
  const config = enContext.config
  const localizationDir = resolvePath(config.baseProjDir, 'localization')
  const langConfigs: LangConfig[] = []
  langConfigs.push({ code: 'en', version: config.version })
  langConfigs.push(...config.langs)
  for (const langConfig of langConfigs) {
    // Prepare the language-specific context
    const lang = langConfig.code
    const langDir = resolvePath(localizationDir, lang)
    const poPath = resolvePath(langDir, 'docs.po')
    let context: Context
    if (lang === 'en') {
      context = enContext
    } else {
      const translatedBlocks = readPoFile(poPath)
      context = enContext.derive(lang, translatedBlocks)
    }

    // Build the docs for this language
    try {
      await buildLang(context, langConfig)

      if (lang === 'en') {
        // Generate `en/docs.po`, which contains the base (English) strings
        writeBasePoFile(poPath, [...context.blocks.values()])
      }
    } catch (e) {
      handleError(context, e)
      return
    }
  }
}

/**
 * Build the HTML files and copy assets for the language associated with the given context.
 *
 * @param context The language-specific context.
 * @param langConfig The version configuration for the language.
 */
async function buildLang(context: Context, langConfig: LangConfig): Promise<void> {
  // Check the version of the translation for this language
  const baseVersion = context.config.version
  let useSavedVersion: boolean
  if (semverCompare(langConfig.version, baseVersion) < 0) {
    // The version of the translation is older than the base (English) version.
    // We will use the "saved" translated content for each page (saved in the repo
    // in the `localization/<lang>/saved.json` file).  This avoids having the
    // generated HTML docs contain a mixture of translated and English strings
    // when the translation lags behind the English version.
    useSavedVersion = true
  } else {
    // The translation is up to date with the base (English) version.  In this
    // mode, we will use the latest base (English) Markdown files for translation
    // purposes, and will overwrite the `saved.json` file for this language so
    // that it can be used later if the translation begins to lag behind the
    // English version.
    useSavedVersion = false
  }

  // Create the output directory for this language
  prepareOutDir(context.outDir)

  // Copy the shared assets.  Note that we use a distinct set of files for each
  // language so that each language can be versioned and published independently
  // without risk of shared dependencies changing underneath.  This means we have a
  // fair amount of duplication (which increases the overall size of the output
  // directory), but that is a relatively small price to pay for being able to version
  // each language independently.  On the positive side, having an asset directory
  // structure for each language makes it easier to provide language-specific assets
  // that override the default (English) assets.
  const assets = new Assets()
  const copySharedAssets = () => {
    const sharedSrcDir = resolvePath('..', 'projects', '_shared', 'src')
    const nodeModulesDir = resolvePath('..', 'node_modules')
    const moduleDir = (...names: string[]) => resolvePath(nodeModulesDir, ...names)
    const copyToBase = (srcDir: string, srcName: string) => {
      assets.copyWithHash(srcDir, srcName, context.outDir)
    }
    copyToBase(sharedSrcDir, 'base.css')
    copyToBase(context.config.baseProjDir, 'project.css')
    copyToBase(sharedSrcDir, 'favicon.ico')
    copyToBase(sharedSrcDir, 'cc_cc.svg')
    copyToBase(sharedSrcDir, 'cc_by.svg')
    copyToBase(moduleDir('lunr'), 'lunr.min.js')
    copyToBase(moduleDir('lunr-languages'), 'lunr.stemmer.support.js')
    copyToBase(moduleDir('mark.js', 'dist'), 'mark.min.js')
    copyToBase(sharedSrcDir, 'search.js')
    copyToBase(sharedSrcDir, 'support.js')
  }
  copySharedAssets()

  // Copy the project-specific images.  First copy the base (English) images to
  // the language-specific output directory, then overwrite any language-specific
  // image files that are provided.
  const copyProjectImages = (lang: string) => {
    // Note that glob paths have forward slashes only, so don't use `resolvePath` here
    const localizationDir = resolvePath(context.config.baseProjDir, 'localization')
    const langPath = `${localizationDir}/${lang}`
    const files = glob.sync(`${langPath}/images/**/*`, { nodir: true })
    for (const f of files) {
      const relPath = f.replace(`${langPath}/`, '')
      assets.copyWithHash(resolvePath(langPath), relPath, context.outDir)
    }
  }
  copyProjectImages('en')
  if (context.lang !== 'en') {
    copyProjectImages(context.lang)
  }

  // Read all pages into memory first; this ensures that we process all strings
  // before generating HTML for each page, since we need things like page titles
  // available in order to prepare the table of contents on each page
  const savedMdPages = useSavedVersion ? readSavedMarkdownContent(context) : undefined
  const newMdPages: Map<string, MarkdownPage> = new Map()
  const htmlPages: HtmlPage[] = []
  for (const mdPagePath of context.config.pages) {
    if (mdPagePath === '-') {
      // Add a separator to the table of contents
      context.toc.addSeparator()
    } else {
      // Process the Markdown page at this path.  If a page is marked as
      // untranslated in the config file, we will use the latest English
      // version of the page.
      const isPageTranslated = !context.config.untranslated.includes(mdPagePath)
      let mdPage: MarkdownPage
      if (useSavedVersion && isPageTranslated) {
        // Read the translated Markdown that was saved with an earlier version
        mdPage = savedMdPages.get(mdPagePath)
        if (mdPage === undefined) {
          // This is a newer page that was not included in the saved version,
          // so exclude it for this language
          continue
        }
      } else {
        // Parse the current English Markdown and apply translation
        mdPage = parseMarkdownPage(context, mdPagePath)
      }

      // Add the Markdown page to the map so that it can be saved later if needed
      newMdPages.set(mdPagePath, mdPage)

      // Convert Markdown page to HTML and add to the table of contents
      const htmlPage = generateHtml(context, mdPagePath, mdPage)
      htmlPages.push(htmlPage)
    }
  }

  // Write the search index file for the language.  This needs to be done before
  // writing the HTML pages because those reference the hashed search index file.
  const indexJs = context.searchIndex.getIndexJsContent()
  const indexName = `search_index_${context.lang}.js`
  assets.writeWithHash(indexJs, indexName, context.outDir)

  // XXX: This is a temporary way of detecting the top-level landing page
  const templateName = context.config.pages.length === 1 ? 'simple' : 'default'

  // Write HTML pages
  for (const htmlPage of htmlPages) {
    writeHtmlFile(context, assets, htmlPage, templateName)
  }

  // Write PDF if included in configuration, and only for production builds (not in
  // local dev mode)
  const productionBuild = process.env.DEV_MODE !== '1'
  if (productionBuild && context.config.formats.includes('pdf')) {
    // Write the HTML file that contains all pages (used for generating the PDF)
    writeCompleteHtmlFile(context, assets, htmlPages)

    // Write the PDF file
    await writePdfFile(context)
  }

  // Overwrite the `saved.json` file so that it contains the latest translated Markdown
  // content for this language
  if (context.lang !== 'en' && !useSavedVersion) {
    writeSavedMarkdownContent(context, newMdPages)
  }
}

/**
 * Read the translated Markdown content that was saved with an earlier version.
 *
 * @param context The language-specific context.
 * @return The translated Markdown pages.
 */
function readSavedMarkdownContent(context: Context): Map<string, MarkdownPage> {
  const localizationDir = resolvePath(context.config.baseProjDir, 'localization')
  const jsonPath = resolvePath(localizationDir, context.lang, 'saved.json')
  const rawJson = readTextFile(jsonPath)
  const jsonObj = JSON.parse(rawJson)
  const mdPages: Map<string, MarkdownPage> = new Map()
  for (const [mdPagePath, mdPageContent] of Object.entries(jsonObj)) {
    mdPages.set(mdPagePath, { raw: mdPageContent as string })
  }
  return mdPages
}

/**
 * Write the translated Markdown content to a JSON file so that it can be restored
 * later as needed.
 *
 * @param context The language-specific context.
 * @param mdPages The map containing Markdown content for each page path key.
 */
function writeSavedMarkdownContent(context: Context, mdPages: Map<string, MarkdownPage>): void {
  const localizationDir = resolvePath(context.config.baseProjDir, 'localization')
  const jsonPath = resolvePath(localizationDir, context.lang, 'saved.json')
  const jsonObj: { [key: string]: string } = {}
  for (const [mdPagePath, mdPage] of mdPages.entries()) {
    if (context.config.untranslated.includes(mdPagePath)) {
      // Exclude content for untranslated pages in `saved.json`; for those pages, we
      // will use the latest English content
      continue
    }
    jsonObj[mdPagePath] = mdPage.raw
  }
  writeOutputFile(jsonPath, JSON.stringify(jsonObj, null, 2))
}

/**
 * This is used in local development mode to write the given error information to
 * all destination HTML files as a way to make build errors more obvious.
 *
 * @param enContext The English context.
 * @param error The error that occurred.
 */
function handleError(enContext: Context, error: Error): void {
  if (process.env.DEV_MODE === '1') {
    // In local development mode, log the error and also write the error to the
    // destination HTML files so that it appears in the browser
    console.error(error)
    const langs = enContext.config.langs.map(l => l.code)
    for (const lang of ['en', ...langs]) {
      let context: Context
      if (lang === 'en') {
        context = enContext
      } else {
        context = enContext.derive(lang, new Map())
      }
      prepareOutDir(context.outDir)
      for (const mdPagePath of context.config.pages) {
        if (mdPagePath !== '-') {
          writeErrorHtmlFile(context.outDir, mdPagePath, error)
        }
      }
    }
  } else {
    // For production builds, rethrow the error so that the build fails immediately
    throw error
  }
}
