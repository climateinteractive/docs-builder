// Copyright (c) 2022 Climate Interactive / New Venture Fund

import { dirname, join as joinPath, resolve as resolvePath } from 'node:path'
import { fileURLToPath } from 'node:url'

import postcss from 'postcss'
import postcssRtlCss from 'postcss-rtlcss'

import { findUp, pathExists } from 'find-up'
import glob from 'glob'
import semverCompare from 'semver-compare'

import { Assets } from './assets'
import type { BuildMode, LangConfig } from './config'
import { readConfigFromFile } from './config'
import { Context } from './context'
import { prepareOutDir, readTextFile, writeOutputFile } from './fs'
import { generateHtml, writeCompleteHtmlFile, writeErrorHtmlFile, writeHtmlFile } from './gen-html'
import { writePdfFile } from './gen-pdf'
import { parseMarkdownPage } from './parse'
import { readPoFile, writeBasePoFile } from './translation'
import type { HtmlPage, MarkdownPage } from './types'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export interface BuildOptions {
  /** The build mode, either 'production' or 'development'. */
  mode: BuildMode

  /** The absolute path to the directory containing the documentation project files. */
  projDir: string

  /** The absolute path to the directory containing source/template files for the project. */
  sourceDir: string
}

/**
 * Generate HTML documentation for the given project.
 *
 * @param options The build options.
 */
export async function buildDocs(options: BuildOptions): Promise<void> {
  // Read the config from a file
  const configFile = resolvePath(options.projDir, '.config.json')
  // TODO: Include a `sourceDir` property in the config that is relative to
  // the project directory
  const config = readConfigFromFile(configFile, options.sourceDir, options.mode)

  // Create the context that holds scopes and blocks
  const enContext = new Context(config, 'en')

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
  // Process the CSS files to automatically generate RTL styles
  const config = enContext.config
  const cssFiles: Map<string, string> = new Map()
  function processCss(sourceDir: string, fileName: string): void {
    const cssPath = resolvePath(sourceDir, fileName)
    const srcCssContent = readTextFile(cssPath)
    const outCssContent = postcss([postcssRtlCss()]).process(srcCssContent).css
    cssFiles.set(fileName, outCssContent)
  }
  processCss(config.sourceDir, 'base.css')
  processCss(config.baseProjDir, 'project.css')

  // Process all pages for each supported language
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
      await buildLang(context, langConfig, cssFiles)

      // Generate `en/docs.po`, which contains the base English strings.
      // We only need to generate this if this project is translated (has
      // one or more languages besides English).
      if (lang === 'en' && context.config.langs.length > 0) {
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
 * @param cssFiles The map of CSS files to be copied to the output directory.
 */
async function buildLang(
  context: Context,
  langConfig: LangConfig,
  cssFiles: Map<string, string>
): Promise<void> {
  // Check the version of the translation for this language
  const baseVersion = context.config.version
  let useSavedVersion: boolean
  if (semverCompare(langConfig.version, baseVersion) < 0) {
    // The version of the translation is older than the base (English) version.
    // We will use the "saved" translated content for each page (saved in the repo
    // in the `localization/<lang>/saved.md` file).  This avoids having the
    // generated HTML docs contain a mixture of translated and English strings
    // when the translation lags behind the English version.
    useSavedVersion = true
  } else {
    // The translation is up to date with the base (English) version.  In this
    // mode, we will use the latest base (English) Markdown files for translation
    // purposes, and will overwrite the `saved.md` file for this language so
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
  const copySharedAssets = async () => {
    const moduleDir = async (pkgName: string, ...subpaths: string[]) => {
      // Walk up the directory structure to find the package installed in the nearest
      // `node_modules` directory
      const nodeModulesParentDir = await findUp(
        async dir => {
          const hasPkg = await pathExists(joinPath(dir, 'node_modules', pkgName))
          return hasPkg && dir
        },
        { cwd: __dirname, type: 'directory' }
      )
      const pkgDir = joinPath(nodeModulesParentDir, 'node_modules', pkgName)
      return resolvePath(pkgDir, ...subpaths)
    }

    const copyToBase = (srcDir: string, srcName: string) => {
      assets.copyWithHash(srcDir, srcName, context.outDir)
    }

    // Copy from `node_modules`
    copyToBase(await moduleDir('lunr'), 'lunr.min.js')
    copyToBase(await moduleDir('lunr-languages'), 'lunr.stemmer.support.js')
    copyToBase(await moduleDir('mark.js', 'dist'), 'mark.min.js')

    // Write the preprocessed CSS files
    function writeCssFile(fileName: string): void {
      const cssContent = cssFiles.get(fileName)
      assets.writeWithHash(cssContent, fileName, context.outDir)
    }
    writeCssFile('base.css')
    writeCssFile('project.css')

    // Copy all other assets from the "shared src" directory.  Note that glob paths
    // have forward slashes only, so convert backslashes here.
    const sharedSrcPath = context.config.sourceDir.replaceAll('\\', '/')
    const sharedSrcFiles = glob.sync(`${sharedSrcPath}/*`, { nodir: true })
    for (const f of sharedSrcFiles) {
      const relPath = f.replace(`${sharedSrcPath}/`, '')
      if (!relPath.endsWith('.html') && !relPath.endsWith('base.css')) {
        copyToBase(context.config.sourceDir, relPath)
      }
    }
  }
  await copySharedAssets()

  // Copy the project-specific images.  First copy the base (English) images to
  // the language-specific output directory, then overwrite any language-specific
  // image files that are provided.
  const copyProjectImages = (lang: string) => {
    // Note that glob paths have forward slashes only, so convert backslashes here
    const localizationDir = resolvePath(context.config.baseProjDir, 'localization').replaceAll(
      '\\',
      '/'
    )
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

  // Write HTML pages
  for (const htmlPage of htmlPages) {
    writeHtmlFile(context, assets, htmlPage, context.config.template)
  }

  // Write the HTML file that contains all pages (used for generating the PDF)
  writeCompleteHtmlFile(context, assets, htmlPages)

  // Write PDF if included in configuration, and only for production builds (not in
  // local dev mode)
  if (context.config.mode === 'production' && context.config.formats.includes('pdf')) {
    // Write the PDF file
    await writePdfFile(context)
  }

  // Overwrite the `saved.md` file so that it contains the latest translated Markdown
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
  const savedMdPath = resolvePath(localizationDir, context.lang, 'saved.md')
  const savedMdContent = readTextFile(savedMdPath)
  const matches = savedMdContent.matchAll(
    /<!-- BEGIN-PAGE\[([A-Za-z\-_./]+?)\] -->([\s\S]*?)<!-- END-PAGE -->/gm
  )
  const mdPages: Map<string, MarkdownPage> = new Map()
  for (const match of matches) {
    const mdPagePath = match[1]
    const mdPageContent = match[2]
    mdPages.set(mdPagePath, { raw: mdPageContent as string })
  }
  return mdPages
}

/**
 * Write the translated Markdown content to a single Markdown file so that it can be restored
 * later as needed.
 *
 * @param context The language-specific context.
 * @param mdPages The map containing Markdown content for each page path key.
 */
function writeSavedMarkdownContent(context: Context, mdPages: Map<string, MarkdownPage>): void {
  const localizationDir = resolvePath(context.config.baseProjDir, 'localization')
  const savedMdPath = resolvePath(localizationDir, context.lang, 'saved.md')
  let savedMdContent = ''
  for (const [mdPagePath, mdPage] of mdPages.entries()) {
    if (context.config.untranslated.includes(mdPagePath)) {
      // Exclude content for untranslated pages in `saved.md`; for those pages, we
      // will use the latest English content
      continue
    }
    savedMdContent += `<!-- BEGIN-PAGE[${mdPagePath}] -->\n\n`
    savedMdContent += mdPage.raw.trim()
    savedMdContent += '\n\n<!-- END-PAGE -->\n\n'
  }
  writeOutputFile(savedMdPath, savedMdContent)
}

/**
 * This is used in local development mode to write the given error information to
 * all destination HTML files as a way to make build errors more obvious.
 *
 * @param enContext The English context.
 * @param error The error that occurred.
 */
function handleError(enContext: Context, error: Error): void {
  if (enContext.config.mode === 'development') {
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
          writeErrorHtmlFile(context, mdPagePath, error)
        }
      }
    }
  } else {
    // For production builds, rethrow the error so that the build fails immediately
    throw error
  }
}
