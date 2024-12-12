// Copyright (c) 2022 Climate Interactive / New Venture Fund

import { basename, resolve as resolvePath } from 'path'

import type { Block, BlockId } from './block'
import type { Config } from './config'
import { SearchIndex } from './search'
import { Toc } from './toc'
import type { LangCode } from './types'

export class Context {
  /** The absolute path to the output directory for this context (includes the configured language code). */
  public readonly outDir: string

  /** The table of contents for this language. */
  public readonly toc: Toc

  /** The search index for this language. */
  public readonly searchIndex: SearchIndex

  /** The relative path of the current page being parsed. */
  private currentPage: string

  /** The stack of scope strings for the current page. */
  private readonly scopes: string[] = []

  constructor(
    public readonly config: Config,
    public readonly lang: LangCode,
    public readonly blocks: Map<BlockId, Block> = new Map(),
    public readonly translatedBlocks: Map<BlockId, string> = new Map()
  ) {
    // Note: This path structure (e.g., `projects/en-roads/en/latest`) is the same as the structure
    // used by ReadTheDocs.  It isn't the most ideal structure, but we are leaving it as is for now
    // to avoid breaking links to the previous docs hosted on ReadTheDocs.
    this.outDir = resolvePath(config.outDir, lang, 'latest')
    this.toc = new Toc()
    this.searchIndex = new SearchIndex(lang)
  }

  /**
   * Create a new context that uses the English strings from this context but adds
   * the given translated strings for another language.
   */
  derive(lang: LangCode, translatedBlocks: Map<BlockId, string>): Context {
    return new Context(this.config, lang, this.blocks, translatedBlocks)
  }

  /**
   * Set (or clear) the name of the page being parsed (used for error reporting)
   * and reset the scope for this page.
   *
   * @param pagePath The relative path of the page being parsed, or undefined to
   * clear the current page.
   */
  setCurrentPage(pagePath: string | undefined): void {
    this.currentPage = pagePath
    this.scopes.length = 0
  }

  /**
   * Return the path of the page being parsed.
   */
  getCurrentPage(): string {
    return this.currentPage
  }

  /**
   * Return true if the current page is expected to be translated.  This
   * can be used to determine whether to warn if a string/block on a
   * translated page is not included in a `def`.
   */
  isCurrentPageTranslated(): boolean {
    if (this.config.langs.length > 0 && this.currentPage) {
      return !this.config.untranslated.includes(this.currentPage)
    } else {
      return false
    }
  }

  /**
   * Append page and scope information to the given error message to make it
   * easier to diagnose parsing issues.
   *
   * @param baseMessage The original error message.
   */
  getScopedMessage(baseMessage: string): string {
    if (this.currentPage) {
      const parts: string[] = []
      if (this.lang !== 'en') {
        parts.push(`lang=${this.lang}`)
      }
      parts.push(`page=${this.currentPage}`)
      const scope = this.getScopeString()
      if (scope) {
        parts.push(`scope=${scope}`)
      }
      return `${baseMessage} (${parts.join(' ')})`
    } else {
      return baseMessage
    }
  }

  getScopeString(): string {
    return this.scopes.filter(s => s.length > 0).join('__')
  }

  setScope(scope: string, level: number): void {
    if (level > this.scopes.length) {
      // Push scope.  If skipping a level, insert empty scope strings, which will
      // be filtered out when building the full scope string.
      const empties = level - this.scopes.length - 1
      for (let i = 0; i < empties; i++) {
        this.scopes.push('')
      }
      this.scopes.push(scope)
    } else if (level < this.scopes.length) {
      // Pop scope
      this.scopes.length = level
      this.scopes[level - 1] = scope
    } else {
      // Replace scope
      this.scopes[this.scopes.length - 1] = scope
    }
  }

  getFullBlockId(localId: BlockId): BlockId {
    return [...this.scopes.filter(s => s.length > 0), localId].join('__')
  }

  addBlock(localId: BlockId, text: string, context?: string): void {
    const fullId = this.getFullBlockId(localId)
    if (this.blocks.has(fullId)) {
      if (fullId.startsWith('glossary')) {
        // XXX: The glossary page is parsed after other pages (because it is
        // near the bottom of the table of contents), but earlier pages refer
        // to its definitions.  We currently have the glossary page listed in
        // both the `defs` and the `pages` sections of the config file.  We
        // should fix things so that if the page is already in `defs`, then
        // don't call `addBlock`.  For now, handle the glossary page as a
        // special case and ignore `addBlock` calls when the page is parsed
        // for the second time.
        return
      } else {
        throw new Error(this.getScopedMessage(`Block already defined for '${fullId}'`))
      }
    }

    // Fail the build if a block contains an HTML comment; usually when a comment appears
    // it is the result of a misconfigured command block (like for a `section` or `def`),
    // and those should never appear in the translation files, so we trap them here
    if (text.includes('<!--')) {
      throw new Error(
        this.getScopedMessage(
          `Block for '${fullId}' contains an unexpected HTML comment, which should not be included in translation files`
        )
      )
    }

    this.blocks.set(fullId, {
      id: fullId,
      text,
      context
    })
  }

  /**
   * Return the base (English) text in plain Markdown format for the given block ID.
   */
  getBaseBlockText(blockId: BlockId): string | undefined {
    return this.blocks.get(blockId)?.text
  }

  /**
   * Return the translated text in plain Markdown format for the given block ID,
   * or undefined if there is no translation for the ID.
   */
  getTranslatedBlockText(blockId: BlockId): string | undefined {
    return this.translatedBlocks.get(blockId)
  }

  /**
   * Return the translated text for the given block ID if available, otherwise fall
   * back on the base (English) text.
   */
  getBlockText(blockId: BlockId): string | undefined {
    return this.getTranslatedBlockText(blockId) || this.getBaseBlockText(blockId)
  }

  /**
   * Return the short name of the project, which is the same as the directory name
   * under `projects`.
   */
  getProjectShortName(): string {
    return basename(this.config.baseProjDir)
  }
}
