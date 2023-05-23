// Copyright (c) 2022 Climate Interactive / New Venture Fund

import { parse as parsePath, resolve as resolvePath } from 'path'

import { marked } from 'marked'

import type { Assets } from './assets'
import type { Context } from './context'
import { readTextFile, writeOutputFile } from './fs'
import { plainTextFromTokens } from './parse'
import type { TocPageItem, TocSection } from './toc'
import type { HtmlPage, MarkdownPage } from './types'

const langEndonyms: Map<string, string> = new Map([
  ['en', 'English'],
  ['de', 'Deutsch'],
  ['it', 'Italiano'],
  ['nb', 'Norsk&nbsp;Bokmål']
])

/**
 * Convert the given (translated) Markdown content into HTML format.
 *
 * This will:
 *   - convert `footnote` and `footnote-ref` commands into proper HTML links
 *   - extract section headers (for display in the table of contents)
 *   - add the page/sections to the table of contents
 *   - add the Markdown content to the search index
 *
 * @param context The language-specific context.
 * @param mdRelPath The path of the Markdown page relative to the project directory.
 * @param mdPage The Markdown page content.
 * @return The converted HTML content.
 */
export function generateHtml(context: Context, mdRelPath: string, mdPage: MarkdownPage): HtmlPage {
  const baseName = parsePath(mdRelPath).name

  // Set the current page (for error reporting)
  context.setCurrentPage(mdRelPath)

  // Handle footnotes and footnote references
  // TODO: Find all footnote-refs and footnotes first to determine which ones should be omitted
  // TODO: Number footnotes based on the order in which the reference is defined
  const footnoteRefKeys: Set<string> = new Set()
  const footnoteKeys: Set<string> = new Set()
  let footnoteRefNum = 1
  let footnoteNum = 1
  let md = mdPage.raw
  md = md.replaceAll(/(\s*)(footnote|footnote-ref):([a-z0-9_]+)/g, (_substring, ws, cmd, key) => {
    const fnName = `${baseName}__footnote_${key}`
    const fnRefName = `${baseName}__footnote_ref_${key}`
    if (cmd === 'footnote-ref') {
      // Convert the footnote reference tag into a superscripted number that links to the
      // footnote.  Note that we swallow any whitespace preceding the footnote reference
      // so that the footnote number is rendered directly after the sentence that precedes
      // it (without whitespace).  We add an extra space character after the number though
      // so that multiple refs for the same sentence are separated by spaces.
      // TODO: Allow multiple refs to the same footnote
      if (footnoteRefKeys.has(key)) {
        throw new Error(context.getScopedMessage(`Footnote ref already defined for ${key}`))
      }
      footnoteRefKeys.add(key)
      return `<a name="${fnRefName}"></a>[<sup>${footnoteRefNum++}</sup>](#${fnName}) `
    } else {
      // Convert the footnote tag into a number (in square brackets) that links back to
      // the footnote reference (at the end of the source sentence).  Note that we
      // preserve any whitespace that preceded the tag.
      if (footnoteKeys.has(key)) {
        throw new Error(context.getScopedMessage(`Footnote already defined for ${key}`))
      }
      footnoteKeys.add(key)

      return `${ws}<a name="${fnName}"></a>[[${footnoteNum++}](#${fnRefName})]:`
    }
  })

  // Detect mismatched footnotes / refs
  for (const key of footnoteRefKeys) {
    if (!footnoteKeys.has(key)) {
      throw new Error(
        context.getScopedMessage(`Footnote ref references unknown footnote: id=${key}`)
      )
    }
  }
  for (const key of footnoteKeys) {
    if (!footnoteRefKeys.has(key)) {
      throw new Error(
        context.getScopedMessage(`Footnote references unknown footnote ref: id=${key}`)
      )
    }
  }

  // Parse the translated Markdown back into tokens so that we can extract section headers
  const htmlRelPath = mdRelPath.replace(/\.md$/, '.html')
  const sections: TocSection[] = []
  const tokens = marked.lexer(md)
  for (const token of tokens) {
    switch (token.type) {
      case 'heading':
        // For now, only look at second-level headers
        if (token.depth === 2) {
          const headingText = plainTextFromTokens(context, token.tokens)
          let anchorPart = ''
          const m = token.text.match(/<a name="(\w+)">/)
          if (m) {
            anchorPart = `#${m[1]}`
          }
          sections.push({
            title: headingText,
            relPath: `${htmlRelPath}${anchorPart}`
          })
        }
        break
      default:
        break
    }
  }

  // Add the page to the table of contents
  const displayTitle = context.getBlockText(`${baseName}__title`)
  context.toc.addPage(htmlRelPath, baseName, displayTitle, sections)

  // Add the Markdown content to the search index
  context.searchIndex.addMarkdownPage(md, htmlRelPath)

  // Customize HTML generation
  marked.use({
    renderer: {
      // Transform special `glossary:` definition links to include a tooltip
      // and a link to the glossary page/definition
      link: (href, title, text) => {
        let classPart: string
        let textPart: string
        let hrefPart: string
        const m = href.match(/glossary:(\w+)/)
        if (m) {
          // This is a glossary link; insert a tooltip element
          const termKey = m[1]
          const tooltipText = context.getBlockText(`glossary__${termKey}__def`)
          if (tooltipText === undefined) {
            throw new Error(
              context.getScopedMessage(`No glossary definition found for key=${termKey}`)
            )
          }
          const tooltipHtml = marked.parseInline(tooltipText).replace(/\n/g, '<br/>')
          classPart = ' class="glossary-link"'
          textPart = `${text}<span class="tooltip"><span class="tooltip-arrow"> </span>${tooltipHtml}</span>`
          // TODO: This path assumes the page is in the `guide` directory; need to fix
          // this if we include glossary links on the index page
          hrefPart = ` href="./glossary.html#glossary__${termKey}"`
        } else {
          // This is a normal link
          classPart = ''
          textPart = text
          hrefPart = href ? ` href="${href}"` : ''
        }

        const titlePart = title ? ` title="${title}"` : ''
        return `<a${classPart}${hrefPart}${titlePart}>${subscriptify(textPart)}</a>`
      },

      // Wrap tables in a div to allow for responsive scrolling behavior
      table: (header, body) => {
        let classes = 'table-container'
        if (mdRelPath.includes('tech_removal')) {
          // XXX: Include a special class for the "CDR Methods" table on the Tech CDR page
          // in the En-ROADS User Guide so that we can target it in CSS.  Currently we
          // check the number of rows to differentiate it from the other slider settings
          // table on that page.
          const rowTags = [...body.matchAll(/<tr>/g)]
          if (rowTags.length > 1) {
            classes += ' removal_methods'
          }
        }
        return `<div class="${classes}"><table><thead>${header}</thead><tbody>${body}</tbody></table></div>`
      }
    }
  })

  // Parse the Markdown into HTML
  const body = marked.parse(md)

  // Clear the current page
  context.setCurrentPage(undefined)

  return {
    baseName,
    relPath: htmlRelPath,
    body
  }
}

export function writeHtmlFile(
  context: Context,
  assets: Assets,
  htmlPage: HtmlPage,
  templateName: string
): void {
  // TODO: This is a hacky way of computing the relative path; need to clean this up
  let basePath: string
  const slashCount = (htmlPage.relPath.match(/\//g) || []).length
  if (slashCount === 0) {
    basePath = '.'
  } else {
    basePath = Array(slashCount).fill('..').join('/')
  }
  const searchIndexName = `search_index_${context.lang}.js`

  // // If Lunr has an optimized stemmer for the configured language, include the
  // // support scripts
  // const optimizedLangs = ['de', 'it']
  // const hasOptimizedStemmer = optimizedLangs.includes(context.lang)
  // let lunrStemmerSupportScript = ''
  // let lunrStemmerLangScript = ''
  // if (hasOptimizedStemmer) {
  //   const stemmerSupportPath = `${basePath}/${assets.get('lunr.stemmer.support.js')}`
  //   lunrStemmerSupportScript = `<script src="${stemmerSupportPath}"></script>`
  //   const stemmerLangName = `lunr.${context.lang}.js`
  //   const moduleDir = resolvePath('..', 'node_modules', 'lunr-languages')
  //   assets.copyWithHash(moduleDir, stemmerLangName, context.outDir)
  //   const stemmerLangPath = `${basePath}/${assets.get(stemmerLangName)}`
  //   lunrStemmerLangScript = `<script src="${stemmerLangPath}"></script>`
  // }

  // Replace image references with the final path that includes the hash in the
  // file name (inside the output directory)
  const baseName = htmlPage.baseName
  let body = htmlPage.body.replaceAll(
    /"(?:\.\.\/)?(images\/[\w/]+\.(png|jpg|svg))"/g,
    (_substring, srcPath) => {
      return `"${basePath}/${assets.get(srcPath)}"`
    }
  )

  // Insert target and rel attributes into all external links so that they open
  // in a separate tab automatically
  body = body.replace(/(href="http.*")/g, 'target="_blank" rel="noopener noreferrer" $1')

  // Convert substrings like "CO2" to subscripted form ("CO<sub>2</sub>")
  body = subscriptify(body)

  // Get the path to the logo image
  let logoPath: string
  if (context.config.logoPath?.length > 0 && templateName !== 'simple') {
    logoPath = `${basePath}/${assets.get(context.config.logoPath)}`
  } else {
    logoPath = ''
  }

  // Get the translated top-level and page titles
  const topLevelTitle = context.getBlockText('index__title')
  const pageTitle = context.getBlockText(`${baseName}__title`)
  let fullPageTitle: string
  if (pageTitle !== topLevelTitle) {
    fullPageTitle = `${pageTitle} &mdash; ${topLevelTitle}`
  } else {
    fullPageTitle = pageTitle
  }

  // Add the next/previous page buttons
  const tocPageItems = context.toc.items.filter(tocItem => tocItem.kind === 'page') as TocPageItem[]
  const currentTocIndex = tocPageItems.findIndex(tocItem => tocItem.relPath === htmlPage.relPath)
  let prevTocIndex: number
  let nextTocIndex: number
  if (tocPageItems.length > 1) {
    if (currentTocIndex > 0) {
      prevTocIndex = currentTocIndex - 1
    }
    if (currentTocIndex < tocPageItems.length - 1) {
      nextTocIndex = currentTocIndex + 1
    }
  }
  if (prevTocIndex !== undefined || nextTocIndex !== undefined) {
    // Get the translated "Next" and "Previous" strings
    const prevStr = context.getBlockText('pagination_previous')
    const nextStr = context.getBlockText('pagination_next')
    const addLink = (kind: 'next' | 'prev', pageTocIndex: number | undefined) => {
      if (pageTocIndex !== undefined) {
        const tocItem = tocPageItems[pageTocIndex]
        const title = subscriptify(tocItem.title)
        const href = `${basePath}/${tocItem.relPath}`
        const sublabel = kind === 'next' ? nextStr : prevStr
        body += `<a class="pagination-link pagination-${kind}" href="${href}">`
        body += `<div class="pagination-sublabel">${sublabel}</div>`
        body += `<div class="pagination-label-row">`
        body += `<div class="pagination-label">${title}</div>`
        body += `</div>`
        body += `</a>`
      } else {
        body += `<div class="spacer-flex"></div>`
      }
    }
    body += `<div class="pagination-controls">`
    addLink('prev', prevTocIndex)
    body += `<div class="spacer-flex"></div>`
    addLink('next', nextTocIndex)
    body += `</div>`
  }

  // Build the sidebar page links
  const sidebarLinks: string[] = []
  for (const tocItem of context.toc.items) {
    if (tocItem.kind === 'page') {
      let classPart: string
      if (tocItem.relPath === htmlPage.relPath) {
        classPart = 'class="current" '
      } else {
        classPart = ''
      }
      const itemTitle = subscriptify(tocItem.title)
      sidebarLinks.push(`<a ${classPart}href="${basePath}/${tocItem.relPath}">${itemTitle}</a>`)
      if (tocItem.relPath === htmlPage.relPath) {
        for (const section of tocItem.sections) {
          const href = `href="${basePath}/${section.relPath}"`
          const click = `onclick="onSectionLinkClicked();"`
          const m = section.title.match(/^(\d+\.)\s+(.*)/)
          let bulletText: string
          let linkText: string
          if (m) {
            bulletText = m[1]
            linkText = m[2]
          } else {
            bulletText = '&bull;'
            linkText = section.title
          }
          const bulletSpan = `<span class="bullet">${bulletText}</span>`
          const textSpan = `<span class="link-text">${subscriptify(linkText)}</span>`
          sidebarLinks.push(`<a class="section" ${href} ${click}>${bulletSpan}${textSpan}</a>`)
        }
      }
    } else {
      sidebarLinks.push(`<hr class="separator"/>`)
    }
  }

  let sidebarFooterStyle = ''
  const langLinks: string[] = []
  if (context.config.langs.length > 0) {
    // Build the sidebar language links
    for (const lang of ['en', ...context.config.langs.map(l => l.code)]) {
      let classPart: string
      if (lang === context.lang) {
        classPart = 'class="current" '
      } else {
        classPart = ''
      }
      const href = `${basePath}/../../${lang}/latest/${htmlPage.relPath}`
      const endonym = langEndonyms.get(lang)
      langLinks.push(`<a ${classPart}href="${href}">${endonym}</a>`)
    }
  } else {
    // We only have English for this project, so hide the language selector in
    // the sidebar
    sidebarFooterStyle = 'style="display: none;"'
  }

  // Build the final HTML file by replacing fields in the template
  const templateFile = `template-${templateName}.html`
  const templatePath = resolvePath(context.config.sourceDir, templateFile)
  const htmlTemplate = readTextFile(templatePath)
  const html = htmlTemplate.replaceAll(/\${([a-zA-Z0-9._-]*)}/g, (_substring, id) => {
    if (id.startsWith('ASSET-')) {
      // Assets are specified like `${ASSET-my-image.png}`; remap to the full relative path to
      // the asset including the hash in the file name
      const assetFileName = id.replace('ASSET-', '')
      if (assetFileName === undefined) {
        throw new Error(`No mapping found for asset ${assetFileName}`)
      }
      return `${basePath}/${assets.get(assetFileName)}`
    }

    switch (id) {
      case 'LANG':
        return context.lang
      case 'BASE_NAME':
        return baseName
      case 'TOP_LEVEL_TITLE':
        return topLevelTitle
      case 'PAGE_TITLE':
        return fullPageTitle
      // case 'LUNR_STEMMER_SUPPORT':
      //   return lunrStemmerSupportScript
      // case 'LUNR_STEMMER_LANG':
      //   return lunrStemmerLangScript
      case 'SEARCH_INDEX_JS_PATH':
        return `${basePath}/${assets.get(searchIndexName)}`
      case 'BASE_PATH':
        return basePath
      case 'INDEX_PATH':
        return `${basePath}/index.html`
      case 'LOGO_PATH':
        return `${logoPath}`
      case 'SEARCH_PLACEHOLDER':
        return context.getBlockText('search_placeholder')
      case 'SEARCH_RESULTS_TITLE':
        return context.getBlockText('search_results_title')
      case 'SEARCH_RESULTS_EMPTY_MESSAGE':
        return context.getBlockText('search_results_empty_message')
      case 'SIDEBAR_LINKS':
        return sidebarLinks.join('\n')
      case 'SIDEBAR_FOOTER_STYLE':
        return sidebarFooterStyle
      case 'LANG_TITLE':
        return context.getBlockText('sidebar_language')
      case 'LANG_LINKS':
        return langLinks.join('\n')
      case 'DOWNLOAD_TITLE':
        return context.getBlockText('sidebar_download')
      case 'PDF_PATH':
        return `${basePath}/${context.getProjectShortName()}.pdf`
      case 'BODY':
        return body
      default:
        throw new Error(context.getScopedMessage(`Unexpected substitution id=${id}`))
    }
  })

  // Write the HTML file
  const htmlPath = resolvePath(context.outDir, htmlPage.relPath)
  writeOutputFile(htmlPath, html)
}

export function writeCompleteHtmlFile(
  context: Context,
  assets: Assets,
  htmlPages: HtmlPage[]
): void {
  let body = ''
  function addPage(baseName: string, pageContent: string): void {
    body += `<div class="page ${baseName}">\n`
    body += pageContent
    body += `</div>\n`
    body += '<div class="page-break"></div>'
    body += '\n'
  }

  // Exclude certain pages
  // TODO: For now, exclude the release notes from the print version;
  // should make this configurable on a per-project basis
  const excluded = ['changelog']

  // Build the title page
  const projTitle = context.getBlockText('index__title')
  let titlePage = ''
  titlePage += `<div style="width: 100%; margin: 420px 0 300px 0;">\n`
  titlePage += `<p style="text-align: center; font-weight: 700; font-size: 3em;">${projTitle}</p>\n`
  if (context.config.author) {
    titlePage += `<p style="text-align: center; font-size: 1.5em;">${context.config.author}</p>\n`
  }
  titlePage += '</div>'
  addPage('_title', titlePage)

  // Build the table of contents page
  const tocElems: string[] = []
  for (const tocItem of context.toc.items) {
    switch (tocItem.kind) {
      case 'page':
        if (!excluded.includes(tocItem.baseName)) {
          const isIndex = tocItem.baseName === 'index'
          const pageTitle = isIndex ? context.getBlockText('pdf_introduction') : tocItem.title
          if (pageTitle !== undefined) {
            tocElems.push(`<a href="#${tocItem.baseName}">${subscriptify(pageTitle)}</a>`)
          }
        }
        break
      case 'separator':
        tocElems.push('<div class="toc-spacer"></div>')
        break
      default:
        break
    }
  }
  let tocPage = ''
  const tocTitle = context.getBlockText('pdf_table_of_contents')
  tocPage += `<h1 style="margin-top: 80px;">${tocTitle}</h1>\n`
  tocPage += '<div style="margin-left: 20px;">\n'
  for (const tocElem of tocElems) {
    tocPage += `${tocElem}\n`
    tocPage += '<br/>\n'
  }
  tocPage += '</div>'
  addPage('_toc', tocPage)

  // Add each page to the body
  for (const htmlPage of htmlPages) {
    if (excluded.includes(htmlPage.baseName)) {
      continue
    }

    // Strip out iframe (e.g., video embed) elements
    let body = htmlPage.body
    body = body.replace(/<iframe.*\/iframe>/g, '')

    // Since all pages are combined into a single page, we need to replace
    // links to other pages in this project (e.g., `./page.html#anchor`)
    // with links to just the anchors (`#anchor`)
    body = body.replace(/href="((?!http).*\.html)(#\w+)"/g, 'href="$2"')

    addPage(htmlPage.baseName, body)
  }

  // Write the complete HTML file
  const completeHtmlPage: HtmlPage = {
    baseName: 'complete',
    relPath: 'complete.html',
    body
  }
  writeHtmlFile(context, assets, completeHtmlPage, 'complete')
}

/**
 * Write an HTML file that shows the given error.  This is only used for local development
 * builds to make it more obvious that an error occurred somewhere in the build process.
 *
 * @param context The language-specific context.
 * @param mdRelPath The relative path of the Markdown file for which HTML is being generated.
 * @param error The error to display.
 */
export function writeErrorHtmlFile(context: Context, mdRelPath: string, error: Error): void {
  const htmlRelPath = mdRelPath.replace(/\.md$/, '.html')

  // Build the final HTML file by replacing fields in the template
  const templateFile = 'template-error.html'
  const templatePath = resolvePath(context.config.sourceDir, templateFile)
  const htmlTemplate = readTextFile(templatePath)
  const html = htmlTemplate.replaceAll(/\${(\w*)}/g, (_substring, id) => {
    switch (id) {
      case 'ERROR_MESSAGE':
        return error.message
      case 'ERROR_STACK':
        return error.stack.replace(/\n/g, '<br/>')
      default:
        throw new Error(context.getScopedMessage(`Unexpected substitution id=${id}`))
    }
  })

  // Write the HTML file
  const htmlPath = resolvePath(context.outDir, htmlRelPath)
  writeOutputFile(htmlPath, html)
}

const subscriptMap = new Map([
  ['CO2', 'CO<sub>2</sub>'],
  ['CH4', 'CH<sub>4</sub>'],
  ['N2O', 'N<sub>2</sub>O'],
  ['NF3', 'NF<sub>3</sub>'],
  ['SF6', 'SF<sub>6</sub>']
])

/**
 * Replace non-subscript forms of common chemicals with their subscripted equivalent.
 * For example, "CO2" will be converted to "CO<sub>2</sub>".  This only handles
 * the following common forms:
 *   CO2
 *   CH4
 *   N2O
 *   NF3
 *   SF6
 *
 * @param s The input string.
 * @return A new string containing subscripted chemical names.
 */
function subscriptify(s: string): string {
  // XXX: Some historical graph images in the En-ROADS User Guide have
  // {CO2,CH4,N2O} in the file name, so this regex is set up to avoid
  // converting those filenames
  return s.replace(/(Hist_)?(CO2|CH4|N2O|NF3|SF6)/g, (m, m1, m2) => {
    if (m1) {
      return m
    } else {
      return subscriptMap.get(m2)
    }
  })
}
