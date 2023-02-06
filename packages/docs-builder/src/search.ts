// Copyright (c) 2022 Climate Interactive / New Venture Fund

import lunr from 'lunr'

import { marked } from 'marked'

import { plainTextFromTokens } from './parse'
import type { LangCode } from './types'

type SectionId = number

interface Section {
  title: string
  anchor: string
}

type PageId = number

interface Page {
  title: string
  path: string
  sections: Map<SectionId, Section>
  boost?: number
}

type ChunkId = string

interface ChunkOptions {
  isHeading?: boolean
  boost?: number
}

interface Chunk {
  id: ChunkId
  page: number
  section?: number
  t: string
  options?: ChunkOptions
}

export class SearchIndex {
  private readonly pages: Map<PageId, Page> = new Map()
  private readonly chunks: Chunk[] = []
  private currentPageId: PageId = 0
  private currentSectionId: SectionId
  private currentChunkId = 0

  constructor(private readonly lang: LangCode) {}

  addMarkdownPage(mdContent: string, path: string): void {
    // Strip subscripts so that things like CO2 are indexed correctly.  Ideally we would convert
    // them back to subscripted form prior to rendering, but marked.js doesn't seem to match the
    // subscripted forms too well, so we will leave them non-subscripted in the search results.
    mdContent = mdContent.replaceAll(/<\/?sub>/g, '')

    // Replace superscript tags with `^`
    mdContent = mdContent.replaceAll(/<sup>(.*)<\/sup>/g, (_, num) => {
      return `^${num}`
    })

    // Parse the translated Markdown back into tokens so that we can extract searchable text
    const tokens = marked.lexer(mdContent)
    for (const token of tokens) {
      switch (token.type) {
        case 'heading': {
          // TODO: This is specific to the structure of the En-ROADS/C-ROADS User Guides; need to generalize
          let pageBoost: number
          if (path.includes('changelog')) {
            // Make matches in the changelog less prominent than other pages
            pageBoost = 0.5
          } else {
            // Use the default boost value
            pageBoost = 1
          }
          const headingText = plainTextFromTokens(undefined, token.tokens)
          if (token.depth === 1) {
            this.setCurrentPage(headingText, path, pageBoost)
          } else {
            let anchorName = ''
            const m = token.text.match(/<a name="(\w+)">/)
            if (m) {
              anchorName = `#${m[1]}`
            }
            this.setCurrentSection(headingText, anchorName)
          }
          // Make matches on section headers more prominent
          this.addSearchableContent(headingText, {
            isHeading: true,
            boost: 2
          })
          break
        }
        case 'list':
          for (const item of token.items) {
            this.addSearchableContent(plainTextFromTokens(undefined, item.tokens))
          }
          break
        default:
          this.addSearchableContent(plainTextFromTokens(undefined, [token]))
          break
      }
    }
  }

  private setCurrentPage(title: string, path: string, boost = 1): void {
    this.currentSectionId = undefined
    this.currentPageId++
    this.pages.set(this.currentPageId, {
      title,
      path,
      sections: new Map(),
      boost
    })
  }

  private setCurrentSection(title: string, anchor: string): void {
    const page = this.pages.get(this.currentPageId)
    if (page) {
      if (this.currentSectionId === undefined) {
        this.currentSectionId = 1
      } else {
        this.currentSectionId++
      }
      page.sections.set(this.currentSectionId, {
        title,
        anchor
      })
    }
  }

  private addSearchableContent(content: string, options?: ChunkOptions): void {
    if (content.length === 0) {
      return
    }

    let pageBoost = 1
    const page = this.pages.get(this.currentPageId)
    if (page) {
      if (page.boost !== undefined) {
        pageBoost = page.boost
      }
    }

    let chunkBoost = 1
    if (options?.boost !== undefined) {
      chunkBoost = options.boost
    }

    const boost = pageBoost * chunkBoost

    this.currentChunkId++
    const chunkId = this.currentChunkId.toString()
    this.chunks.push({
      id: chunkId,
      page: this.currentPageId,
      section: this.currentSectionId,
      t: content,
      options: {
        isHeading: options?.isHeading,
        boost
      }
    })
  }

  getIndexJsContent(): string {
    // Pre-build the Lunr index
    const chunks = this.chunks
    const rawIndex = lunr(function () {
      // Disable the default stemmer (and don't configure a language-optimized
      // stemmer).  This is recommended by the Lunr.js author to improve
      // behavior for type-ahead searches:
      //   https://github.com/olivernn/lunr.js/issues/256#issuecomment-339893530
      // The downside is that we may not provide the best results for things
      // like plurals.  With a stemmer, "policies" would match either "policy"
      // or "policies".  Without a stemmer, "policies" would not match "policy",
      // but as the user types, they should get both with just "polic".
      this.pipeline.remove(lunr.stemmer)
      this.searchPipeline.remove(lunr.stemmer)

      // Tell Lunr to use the chunk's `id` field as the "ref"
      this.ref('id')

      // Tell Lunr to get the chunk's text from the `t` field
      this.field('t')

      // Add each chunk to the Lunr index
      for (const chunk of chunks) {
        this.add(chunk, {
          boost: chunk.options?.boost
        })
      }
    })

    // Add the page/section metadata
    const rawPages = {}
    for (const [pageId, page] of this.pages.entries()) {
      const rawSections = {}
      for (const [sectionId, section] of page.sections) {
        const rawSection = {
          t: section.title,
          a: section.anchor
        }
        rawSections[sectionId.toString()] = rawSection
      }
      const rawPage = {
        t: page.title,
        p: page.path,
        s: rawSections
      }
      rawPages[pageId.toString()] = rawPage
    }

    // Add the plain text chunks
    const rawChunks = {}
    for (const chunk of this.chunks) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawChunk: any = {
        p: chunk.page,
        s: chunk.section,
        t: chunk.t
      }
      if (chunk.options?.isHeading === true) {
        rawChunk.h = true
      }
      rawChunks[chunk.id] = rawChunk
    }

    // Write the chunks and index to a JS file
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const decl = (name: string, obj: any) => {
      // Remove unnecessary quotes around keys; based on:
      //   https://stackoverflow.com/a/11233515
      const s = JSON.stringify(obj).replace(/"([^"]+)":/g, '$1:')
      return `var ${name} = ${s};`
    }
    const pageData = decl('searchPageData', rawPages)
    const chunkData = decl('searchChunkData', rawChunks)
    const serializedData = decl('searchIndexSerializedData', rawIndex)
    return `${pageData}\n${chunkData}\n${serializedData}`
  }
}
