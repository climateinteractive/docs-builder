// Copyright (c) 2022 Climate Interactive / New Venture Fund

import { resolve } from 'path'
import matter from 'gray-matter'
import { marked } from 'marked'

import type { BlockId } from './block'
import type { Command } from './command'
import type { Context } from './context'
import { readTextFile } from './fs'
import type { LangCode, MarkdownPage } from './types'

class ProcessState {
  /** The current heading level (0 == none, 1 == '#', 2 == '##', etc). */
  public currentLevel: number
  /** The identifier of the current section, if one is defined. */
  public currentSectionId?: BlockId
  /** The current command that is in effect when parsing tokens. */
  public currentCommand?: Command
  /** The array of tokens that have been captured inside a `begin/end-def` pair. */
  public defTokens: marked.Token[] = []
  /** Whether `processTokens` is currently parsing a table definition. */
  public parsingTable = false
  constructor(public readonly mode: 'add' | 'translate') {}
}

// The type for the special `links` section of a marked.js token list
type Links = {
  [key: string]: { href: string | null; title: string | null }
}

/**
 * Parse the given base (English) Markdown page and translate it into the language
 * associated with the context.
 *
 * @param context The language-specific context.
 * @param relPath The path to the Markdown file, relative to the base project directory.
 * @return The translated Markdown content.
 */
export function parseMarkdownPage(context: Context, relPath: string): MarkdownPage {
  // Configure marked.js
  marked.setOptions({
    headerIds: false
  })

  // Set the current page (for error reporting)
  context.setCurrentPage(relPath)

  // Read the Markdown file
  const filePath = resolve(context.config.baseProjDir, relPath)
  const origMarkdownWithFrontmatter = readTextFile(filePath)

  // Separate frontmatter from the content
  const origMarkdownSeparated = matter(origMarkdownWithFrontmatter)
  const origMarkdown = origMarkdownSeparated.content
  const frontmatter = origMarkdownSeparated.data

  // Append synthesized link info for glossary references so that source files can
  // use `[link text][glossary_term]` without manually defining a reference for
  // "glossary_term"; it will be converted to `[...](glossary:term)` automatically
  const glossaryRegEx = /glossary__(\w+)__def/
  const glossaryRefs = [...context.blocks.keys()]
    .filter(k => k.match(glossaryRegEx))
    .map(k => {
      const id = k.match(glossaryRegEx)[1]
      return `[glossary_${id}]: glossary:${id}`
    })
  const inMarkdown = `${origMarkdown}\n\n${glossaryRefs.join('\n')}`

  // Extract the Markdown tokens
  const tokens = marked.lexer(inMarkdown)

  // Process the token tree recursively
  const mode = context.lang === 'en' ? 'add' : 'translate'
  const state: ProcessState = new ProcessState(mode)
  processTokens(context, state, tokens)

  // Convert the tokens back into plain Markdown
  let outMarkdown = markdownFromTokens(context, tokens)

  // Replace `:use:` directives with the translated text
  outMarkdown = translateTextReplacements(context, outMarkdown)

  // Resolve (and check) any remaining reference-style links
  outMarkdown = resolveReferenceStyleLinks(context, outMarkdown, tokens['links'])

  // Clear the current page
  context.setCurrentPage(undefined)

  return {
    raw: outMarkdown,
    frontmatter
  }
}

/**
 * Process the tokens in the given array and recursively process children.
 * This will potentially mutate the given tokens array in place.
 *
 * In `add` mode, `def` commands will cause the defined strings/blocks to be
 * added to the context (i.e., it will define the base English strings).
 *
 * In `translate` mode, `def` commands will replace the referenced strings/blocks
 * with their translated equivalents.
 */
function processTokens(context: Context, state: ProcessState, tokens: marked.Token[]): void {
  // Build up an array of tokens that we want to keep at this level
  const outTokens: marked.Token[] = []

  // Process each token at this level
  for (const token of tokens) {
    // See if this is a command token
    const command = parseCommand(context, token)
    let resultTokens: marked.Token[]
    if (command) {
      // Process the command.  Commands are swallowed (not included in the output)
      // so we don't need to add the command to the set of output tokens, but we
      // do add any tokens that replace the command.
      resultTokens = processCommand(context, state, command)
    } else {
      // This is a normal token; process it
      resultTokens = processToken(context, state, token)
    }
    outTokens.push(...resultTokens)
  }

  // Handle unresolved commands
  if (state.currentCommand) {
    throw new Error(
      context.getScopedMessage(`Command '${state.currentCommand.kind}' was not resolved or closed`)
    )
  }

  // Replace the array of input tokens with the new array
  tokens.splice(0, tokens.length, ...outTokens)
}

/**
 * Parse the given `html` token and if it contains a command, return it, otherwise
 * return undefined.
 */
function parseCommand(context: Context, token: marked.Token): Command | undefined {
  // def:<id>
  //   add single text/block that follows (and include text in the output)
  // def[hidden]:<id>
  //   add single text/block that follows (but exclude text from the output)
  // begin-def:<id> / end-def
  //   add all blocks between the begin/end pair (and include text in the output)
  // begin-def[hidden]:<id> / end-def
  //   add all blocks between the begin/end pair (but exclude text from the output)
  // section:<id>
  //   set scope using current level (based on heading level)

  if (token.type !== 'html') {
    return undefined
  }

  const raw = token.raw.trim()
  if (!raw.startsWith('<!--')) {
    return undefined
  }

  const m = raw.match(/<!--\s*([a-z-]+)(\[hidden\])?:?(\w+)?\s*-->/)
  if (!m) {
    return undefined
  }

  if (m[3]) {
    if (!m[3].match(/^[a-z0-9]+(?:_+[a-z0-9]+)*$/)) {
      throw new Error(
        context.getScopedMessage(
          `Identifier (${m[3]}) must contain only lowercase letters, digits, and underscores`
        )
      )
    }
  }

  const rawKind = m[1]
  switch (rawKind) {
    case 'def':
    case 'begin-def': {
      const idPart = m[3]
      const id = idPart
      return {
        kind: rawKind,
        id,
        hidden: m[2] === '[hidden]'
      }
    }
    case 'end-def':
      return {
        kind: rawKind
      }
    case 'section': {
      const idPart = m[3]
      const id = idPart
      return {
        kind: rawKind,
        id
      }
    }
    default:
      throw new Error(context.getScopedMessage(`Unknown command '${rawKind}'`))
  }
}

/**
 * Process the given command.  If the command is an `end-def`, this will return the tokens
 * that were included between the begin/end pair.
 */
function processCommand(context: Context, state: ProcessState, command: Command): marked.Token[] {
  // Check for unbalanced commands
  if (state.currentCommand) {
    switch (state.currentCommand.kind) {
      case 'def':
      case 'begin-def':
        if (command.kind !== 'end-def') {
          let msg = `Unexpected command '${command.kind}' `
          msg += `while current command '${state.currentCommand.kind}' `
          msg += `(id=${state.currentCommand.id}) is in effect`
          throw new Error(context.getScopedMessage(msg))
        }
        break
      default:
        break
    }
  } else {
    if (command.kind === 'end-def') {
      throw new Error(context.getScopedMessage(`Saw 'end-def' without corresponding 'begin-def'`))
    }
  }

  // Perform the action for the given command
  const outTokens: marked.Token[] = []
  switch (command.kind) {
    case 'section':
      // Handle the section command by updating the scope based on the
      // current heading level
      context.setScope(command.id, state.currentLevel)
      break
    case 'def':
    case 'begin-def':
      // Make this the current command and process the next token(s)
      state.currentCommand = command
      break
    case 'end-def':
      if (state.defTokens.length === 0) {
        throw new Error(context.getScopedMessage(`Saw 'end-def' but no tokens were included`))
      }
      if (state.currentCommand.kind !== 'begin-def') {
        throw new Error(context.getScopedMessage(`Saw 'end-def' without corresponding 'begin-def'`))
      }
      if (state.currentCommand.hidden) {
        // Add the block of text but exclude the translated tokens from the output
        // (don't add them to `outTokens`)
        addBlockForTokens(context, state.mode, state.currentCommand.id, state.defTokens)
      } else {
        // Add the block of text and include the translated tokens in the output
        outTokens.push(
          ...addBlockForTokens(context, state.mode, state.currentCommand.id, state.defTokens)
        )
      }
      state.defTokens = []
      state.currentCommand = undefined
      break
    // default:
    //   throw new Error(`Unhandled command '${command.kind}'`)
  }

  return outTokens
}

/**
 * Extract just the plain text from the given tokens.
 */
export function plainTextFromTokens(context: Context | undefined, tokens: marked.Token[]): string {
  const textParts: string[] = []

  for (const token of tokens) {
    switch (token.type) {
      case 'text': {
        // If the text token contains child tokens, look at those, otherwise just look
        // at the plain text
        // XXX: Token.Text type has conflict with Token.Tag, so we need to cast
        const textToken = token as marked.Tokens.Text
        if (textToken.tokens) {
          textParts.push(plainTextFromTokens(context, textToken.tokens))
        } else {
          // XXX: Ignore the link emoji in the auto-generated anchor links
          if (!token.raw.startsWith('&')) {
            textParts.push(token.text)
          }
        }
        break
      }
      case 'codespan':
        textParts.push(token.text)
        break
      case 'paragraph':
      case 'heading':
      case 'link':
      case 'strong':
      case 'em':
      case 'blockquote':
        textParts.push(plainTextFromTokens(context, token.tokens))
        break
      case 'list':
        for (const item of token.items) {
          textParts.push(plainTextFromTokens(context, item.tokens))
        }
        break
      case 'table':
        // TODO: Ignore the table cell text for now
        // for (const cell of token.header) {
        //   textParts.push(plainTextFromTokens(cell.tokens))
        // }
        // for (const row of token.rows) {
        //   for (const cell of row) {
        //     textParts.push(plainTextFromTokens(cell.tokens))
        //   }
        // }
        break
      case 'html':
      case 'space':
      case 'hr':
      case 'escape':
      case 'code':
        break
      default: {
        const baseMsg = `Unhandled token type ${token.type}`
        const msg = context ? context.getScopedMessage(baseMsg) : baseMsg
        throw new Error(msg)
      }
    }
  }

  return textParts.filter(s => s.length > 0).join(' ')
}

/**
 * Process the given token.  This will take the current command into account, if any.
 *
 * @return An array of tokens that should be included in the set of output tokens.
 */
function processToken(context: Context, state: ProcessState, token: marked.Token): marked.Token[] {
  const outTokens: marked.Token[] = []

  // This is a normal token; process it
  if (state.currentCommand) {
    // There is a command in effect, so process the token at this level (without recursing)
    switch (state.currentCommand.kind) {
      case 'def':
        if (state.currentCommand.hidden) {
          // Add the block of text but exclude the translated tokens from the output
          // (don't add them to `outTokens`)
          addBlockForTokens(context, state.mode, state.currentCommand.id, [token])
        } else {
          // Add the block of text and include the translated tokens in the output
          outTokens.push(
            ...addBlockForTokens(context, state.mode, state.currentCommand.id, [token])
          )
        }
        // A `def` only applies to the single token that follows it, so clear
        // the current command
        state.currentCommand = undefined
        break
      case 'begin-def':
        // Remove this token from the array and add it to the stack; we leave the
        // index unchanged so that it points to the next unprocessed token
        state.defTokens.push(token)
        break
      default:
        throw new Error(
          context.getScopedMessage(`Unhandled command '${state.currentCommand.kind}'`)
        )
    }
  } else {
    // No command in effect, so process the token recursively
    switch (token.type) {
      case 'text': {
        // If the text token contains child tokens, look at those, otherwise just look
        // at the plain text
        // XXX: Token.Text type has conflict with Token.Tag, so we need to cast
        const textToken = token as marked.Tokens.Text
        if (textToken.tokens) {
          // Recurse into the child tokens
          processTokens(context, state, textToken.tokens)
        } else {
          // Check for text blocks that have been left out of a `def` or `begin/end-def`
          // pair (only on pages that are intended to be translated)
          checkForMissingDef(context, state, textToken)
        }
        break
      }
      case 'escape':
        break
      case 'heading':
        state.currentLevel = token.depth
        processTokens(context, state, token.tokens)
        if (markdownFromTokens(context, token.tokens).trim().length === 0) {
          // If the heading has no content (i.e., it only contained commands like
          // `section`), then replace it with a simple anchor
          token = anchorToken(context)
        } else {
          // Insert an anchor and link element in each heading after processing
          // the child tokens
          insertHeadingAnchor(context, token)
        }
        break
      case 'paragraph':
      case 'link':
      case 'strong':
      case 'em':
      case 'blockquote':
        processTokens(context, state, token.tokens)
        break
      case 'list':
        for (const item of token.items) {
          processTokens(context, state, item.tokens)
        }
        break
      case 'table':
        state.parsingTable = true
        for (const cell of token.header) {
          processTokens(context, state, cell.tokens)
        }
        for (const row of token.rows) {
          for (const cell of row) {
            processTokens(context, state, cell.tokens)
          }
        }
        state.parsingTable = false
        break
      case 'html':
      case 'image':
      case 'space':
      case 'hr':
      case 'code':
        // No text or child tokens to process
        break
      case 'codespan':
        // TODO: Any special handling here?
        break
      case 'br': {
        let msg = 'Detected two or more spaces at the end of a text line.'
        msg += ' Markdown interprets this as a line break, which can be surprising.'
        msg += ' If the spaces were added unintentionally, remove the extra spaces.'
        msg += ' If you do want a line break, use an explicit HTML `<br/>` tag instead.'
        throw new Error(context.getScopedMessage(msg))
      }
      default:
        throw new Error(context.getScopedMessage(`Unhandled token type ${token.type}`))
    }

    // Include the token in the output
    outTokens.push(token)
  }

  return outTokens
}

/**
 * Add a block for the given tokens that were captured by a `def` command or a
 * `begin/end-def` pair.
 *
 * In `add` mode, the text block will be added to the context so that it can be
 * made available for translation (i.e., it will define the base English string),
 * and the original (English) tokens will be returned.
 *
 * In `translate` mode, the text block will be replaced by the translated equivalent
 * and the translated tokens will be returned.
 */
function addBlockForTokens(
  context: Context,
  mode: 'add' | 'translate',
  localBlockId: BlockId,
  tokens: marked.Token[]
): marked.Token[] {
  if (mode === 'add') {
    // Combine the tokens into a single block of text
    const blockParts: string[] = []
    let basicTextOnly = true
    for (const token of tokens) {
      const text = extractEnglishString(context, token)
      if (text) {
        blockParts.push(text)
        if (token.type !== 'text' && token.type !== 'html') {
          basicTextOnly = false
        }
      }
    }
    let sep: string
    if (basicTextOnly) {
      // For basic text definitions (that may contain HTML like sub tags),
      // don't include newlines
      sep = ''
    } else {
      // Separate each part by newlines if they are paragraphs, lists, or similar
      sep = '\n\n'
    }
    const blockText = blockParts.join(sep)
    context.addBlock(localBlockId, blockText)
    return tokens
  } else {
    // Replace the English tokens with translated ones
    const fullBlockId = context.getFullBlockId(localBlockId)
    const blockText = context.getTranslatedBlockText(fullBlockId)
    if (blockText) {
      // Parse the translated tokens and insert them
      // XXX: If there is more than one token (even if some are whitespace only), we
      // need to include extra newlines after the last block, otherwise marked will
      // not parse the text correctly
      const newlines = tokens.length > 1 ? '\n\n' : ''
      const translatedTokens = marked.lexer(blockText + newlines)
      return translatedTokens
    } else {
      // Keep the English tokens
      console.warn(`WARNING: No translation found for lang=${context.lang} id=${fullBlockId}`)
      return tokens
    }
  }
}

/**
 * Log a warning if the given text token is on a translatable page but is
 * not included in a `def` or `begin/end-def` pair.
 */
function checkForMissingDef(context: Context, state: ProcessState, token: marked.Token): void {
  if (
    context.config.options.warnOnMissingDef === true &&
    context.isCurrentPageTranslated() &&
    state.mode === 'add' &&
    state.currentCommand === undefined
  ) {
    // Don't warn for certain known cases:
    //   - whitespace
    //   - "use" commands (for example, `:visit_support:`)
    //   - explicit section numbers (these are not translated)
    //   - footnotes section (these are not translated)
    //   - tables (specific to the En-ROADS User Guide; the table cells include
    //     ranges like "+$6 to -$6" that are handled specially by the builder)
    const scope = context.getScopeString()
    const text = token.raw.trim()
    const ignored =
      text.length === 0 ||
      text.startsWith(':') ||
      text.match(/^\d+\./) ||
      scope.endsWith('footnotes') ||
      state.parsingTable
    if (!ignored) {
      const page = context.getCurrentPage()
      console.warn(
        `WARNING: Found text on translated page that is not part of 'def': page=${page} text=${text}`
      )
    }
  }
}

/**
 * Join all lines into a single string. Insert a single space between sentences if needed.
 */
function joinLines(raw: string): string {
  const rawLines = raw.split('\n')
  const lines: string[] = []
  for (let rawLine of rawLines) {
    rawLine = rawLine.trim()
    if (rawLine) {
      lines.push(rawLine)
    }
  }

  return lines.join(' ')
}

/**
 * Parse the token parts and extract the full English string that can be used
 * in the base strings file.  This will remove/adjust line breaks as needed.
 */
function extractEnglishString(context: Context, token: marked.Token, level = 0): string {
  // Remove extra line breaks.  In the source Markdown files, we typically put
  // each sentence on a separate line, which makes them easier to diff.  But
  // when generating the `en/docs.po` file, we want the base string to contain
  // the minimal amount of line breaks to make them easier for translators to
  // understand.
  switch (token.type) {
    case 'paragraph':
    case 'text':
      return joinLines(token.raw).trim()
    case 'list': {
      // If "loose", include a blank line between items so that they are spaced out
      // in the generated HTML
      const newlines = token.loose ? '\n\n' : '\n'
      // Use 4 spaces per indent level for nested list items
      const indent = '    '.repeat(level)
      // Configure the prefix depending on whether this is an ordered or unordered list
      const marker = token.ordered ? '1.' : '-'
      const items: string[] = []
      let index = 0
      for (const item of token.items) {
        const itemTextParts: string[] = []
        for (const t of item.tokens) {
          const tokenText = extractEnglishString(context, t, level + 1)
          itemTextParts.push(tokenText)
        }
        const itemText = itemTextParts.join(' ')
        // Begin all items with newline(s) except for the very first one
        const prefix = index > 0 || level > 0 ? newlines : ''
        items.push(`${prefix}${indent}${marker} ${itemText}`)
        index++
      }
      return items.join('')
    }
    case 'space':
      return ''
    case 'html':
      return token.raw
    default:
      throw new Error(
        context.getScopedMessage(`Unhandled token type '${token.type}': ${token.raw}`)
      )
  }
}

/**
 * Return a new anchor token that derives its name from the current context scope.
 */
function anchorToken(context: Context): marked.Token {
  const anchorName = context.getScopeString()
  const anchorElem = `<a name="${anchorName}"></a>`
  return {
    type: 'html',
    raw: anchorElem,
    pre: false,
    text: anchorElem
  }
}

/**
 * Modify the given `heading` token by prepending an anchor element and appending
 * a link element that can be revealed when the user hovers over the heading.
 */
function insertHeadingAnchor(context: Context, token: marked.Token): void {
  if (token.type !== 'heading') {
    return
  }

  if (context.config.options?.sectionLinks === false) {
    return
  }

  const anchor = anchorToken(context)
  token.tokens.splice(0, 0, anchor)

  const anchorName = context.getScopeString()
  const linkElem = `<a class="heading-link" href="#${anchorName}">&#128279;</a>`
  const link: marked.Token = {
    type: 'html',
    raw: linkElem,
    pre: false,
    text: linkElem
  }
  token.tokens.push(link)
}

/**
 * Replace `:use:` directives in the given Markdown content with the actual translated
 * string for the language associated with the context.
 *
 * @param context The language-specific context.
 * @param md The Markdown text that contains `:use:` directives.
 * @return The translated Markdown content.
 */
function translateTextReplacements(context: Context, md: string): string {
  // Find all text replacements.  This matches any "use" directive (for example, ":some_key:"),
  // but ignores other commands like "def:some_key" or "section:some_name".
  return md.replaceAll(/:([a-z0-9_]+):/g, (_substring, blockId) => {
    let blockText: string
    if (context.lang === 'en') {
      blockText = context.getBaseBlockText(blockId)
    } else {
      blockText = context.getTranslatedBlockText(blockId)
      if (blockText === undefined) {
        console.warn(`WARNING: No translation found for lang=${context.lang} id=${blockId}`)
        blockText = context.getBaseBlockText(blockId)
      }
    }
    if (blockText === undefined) {
      // TODO: Highlight replacement errors in generated HTML
      throw new Error(context.getScopedMessage(`Unknown replacement for id=${blockId}`))
    }

    return blockText
  })
}

// XXX: marked.js doesn't provide a way to easily convert tokens back into plain Markdown
// syntax, so we have to do that ourselves
function markdownFromTokens(context: Context, tokens: marked.Token[], level = 0): string {
  let md = ''

  for (const token of tokens) {
    switch (token.type) {
      case 'text': {
        // If the text token contains child tokens, look at those, otherwise just look
        // at the plain text
        // XXX: Token.Text type has conflict with Token.Tag, so we need to cast
        const textToken = token as marked.Tokens.Text
        if (textToken.tokens) {
          md += markdownFromTokens(context, textToken.tokens)
        } else {
          md += token.text
        }
        break
      }
      case 'heading':
        md += `${'#'.repeat(token.depth)} ${markdownFromTokens(context, token.tokens)}\n\n`
        break
      case 'paragraph':
        md += markdownFromTokens(context, token.tokens)
        break
      case 'link':
        md += `[${markdownFromTokens(context, token.tokens)}](${token.href})`
        break
      case 'strong':
        md += `**${markdownFromTokens(context, token.tokens)}**`
        break
      case 'em':
        md += `_${markdownFromTokens(context, token.tokens)}_`
        break
      case 'blockquote':
        md += `> ${markdownFromTokens(context, token.tokens)}`
        break
      case 'codespan':
        md += `\`${token.text}\``
        break
      case 'list':
        for (const item of token.items) {
          // If "loose", include a blank line between items so that they are spaced out
          // in the generated HTML
          const newlines = token.loose ? '\n\n' : '\n'
          // Use 4 spaces per indent level for nested list items
          const indent = '    '.repeat(level)
          // Configure the prefix depending on whether this is an ordered or unordered list
          const marker = token.ordered ? '1.' : '-'
          md += `${newlines}${indent}${marker} ${markdownFromTokens(
            context,
            item.tokens,
            level + 1
          )}`
        }
        break
      case 'table':
        for (const cell of token.header) {
          md += `| ${markdownFromTokens(context, cell.tokens)} `
        }
        md += '|\n'
        // TODO: Preserve alignment
        for (let i = 0; i < token.header.length; i++) {
          md += '|--'
        }
        md += '|\n'
        for (const row of token.rows) {
          for (const cell of row) {
            // XXX: Convert cell text used in the slider settings tables to the
            // language-specific format.  This is very specific to the En-ROADS
            // User Guide and should be made pluggable.
            const rawCellText = markdownFromTokens(context, cell.tokens)
            const cellText = convertSliderRange(rawCellText, context.lang)
            md += `| ${cellText} `
          }
          md += '|\n'
        }
        md += '\n'
        break
      case 'image':
      case 'space':
      case 'hr':
      case 'escape':
      case 'code':
        md += token.raw
        break
      case 'html': {
        // Handle special `img` tags that have `class="clickable"` by wrapping it in
        // a link so that the image can be clicked and expanded
        const m = token.raw.match(/^<img class="clickable"(.*)src="(.*)"(.*)>(\s*)$/)
        if (m) {
          const url = m[2]
          const img = `<img${m[1]}src="${url}"${m[3]}>`
          const linkOpen = `<a href="${url}">`
          const linkClose = '</a>'
          const trailing = m[4]
          md += `${linkOpen}${img}${linkClose}${trailing}`
        } else {
          md += token.raw
        }
        break
      }
      default:
        throw new Error(context.getScopedMessage(`Unhandled token type ${token.type}`))
    }
  }

  return md
}

/**
 * Check for reference-style links in the given Markdown text.  If any unresolved
 * reference-style links are detected, this will throw an error.
 *
 * @param context The language-specific context.
 * @param mdText The Markdown text to check.
 * @param links The links that were originally parsed.
 * @return The updated Markdown text.
 */
function resolveReferenceStyleLinks(context: Context, mdText: string, links: Links): string {
  // The following regex matches reference-style link syntax (e.g., `[text][id]`).
  // The marked.js parser will automatically convert and resolve reference-style
  // links when parsing the original (English) Markdown page, so there are two
  // situations in which we will see reference-style links at this point:
  //   1. The original English text has an error (refers to a non-existent link);
  //      in this case marked.js leaves the original `[text][badid]` in place.
  //   2. The translated text has a link that refers to an identifier that is
  //      no longer present in the English source file.
  // If we detect either case, treat it as an error.  Otherwise, convert the
  // reference-style link to a normal link (`[text](url)`).
  return mdText.replaceAll(/\[([^[]+)\]\[(\w+)\]/gm, (s, text, id) => {
    const link = links[id]
    if (link === undefined) {
      let msg = 'Unresolved reference-style link found for'
      msg += ` lang=${context.lang}`
      msg += ` link=${s}`
      throw new Error(context.getScopedMessage(msg))
    }
    return `[${text}](${link.href})`
  })
}

/**
 * Convert cell text used in the slider settings tables to the language-specific format.
 * For example,
 *   English input:
 *     **+$0.01 to -$0.01**
 *   German output:
 *     **+0,01 $ bis -0,01 $**
 *
 * XXX: This is very specific to the En-ROADS User Guide and should be made pluggable.
 */
function convertSliderRange(cellText: string, lang: LangCode): string {
  function num(s: string): string {
    switch (lang) {
      case 'cs':
      case 'de':
      case 'it':
      case 'nb':
      case 'pt':
        return s.replace('.', ',')
      default:
        return s
    }
  }

  // Try matching dollar ranges, e.g., **+$0.01 to -$0.01**
  // TODO: Inject values into template string like `$${sign1}${value1} to $${sign2}${value2}`
  let m = cellText.match(/(\*?\*?)([+-]?)\$(\d+\.?\d{0,2})\s+to\s+([+-]?)\$(\d+\.?\d{0,2})(\*?\*?)/)
  if (m) {
    switch (lang) {
      case 'cs':
        return `${m[1]}${m[2]}${num(m[3])}&nbsp;$ až ${m[4]}${num(m[5])}&nbsp;$${m[6]}`
      case 'de':
        return `${m[1]}${m[2]}${num(m[3])}&nbsp;$ bis ${m[4]}${num(m[5])}&nbsp;$${m[6]}`
      case 'es':
        return `${m[1]}del ${m[2]}$${num(m[3])} al ${m[4]}$${num(m[5])}${m[6]}`
      case 'it':
        return `${m[1]}da ${m[2]}$${num(m[3])} a ${m[4]}$${num(m[5])}${m[6]}`
      case 'nb':
        return `${m[1]}${m[2]}$&nbsp;${num(m[3])} til ${m[4]}$&nbsp;${num(m[5])}${m[6]}`
      case 'pt':
        return `${m[1]}${m[2]}$&nbsp;${num(m[3])} a ${m[4]}$&nbsp;${num(m[5])}${m[6]}`
      case 'en':
      default:
        return cellText
    }
  }

  // Try matching percent ranges, e.g., **+10% to -20%**
  // TODO: Inject values into template string like `${sign1}${value1}% to ${sign2}${value2}%`
  m = cellText.match(/(\*?\*?)([+-]?)(\d+\.?\d{0,2})%\s+to\s+([+-]?)(\d+\.?\d{0,2})%(\*?\*?)/)
  if (m) {
    switch (lang) {
      case 'cs':
        return `${m[1]}${m[2]}${num(m[3])}&nbsp;% až ${m[4]}${num(m[5])}&nbsp;%${m[6]}`
      case 'de':
        return `${m[1]}${m[2]}${num(m[3])}&nbsp;% bis ${m[4]}${num(m[5])}&nbsp;%${m[6]}`
      case 'es':
        return `${m[1]}del ${m[2]}${num(m[3])}% al ${m[4]}${num(m[5])}%${m[6]}`
      case 'it':
        return `${m[1]}da ${m[2]}${num(m[3])}% a ${m[4]}${num(m[5])}%${m[6]}`
      case 'nb':
        return `${m[1]}${m[2]}${num(m[3])}&nbsp;% til ${m[4]}${num(m[5])}&nbsp;%${m[6]}`
      case 'pt':
        return `${m[1]}${m[2]}${num(m[3])}% a ${m[4]}${num(m[5])}%${m[6]}`
      case 'en':
      default:
        return cellText
    }
  }

  // Try matching population ranges, e.g., **10.5 to 11.4 billion**
  // TODO: Inject values into template string like `${value1} to ${value2} billion`
  m = cellText.match(/(\*?\*?)(\d+\.?\d{0,2})\s+to\s+(\d+\.?\d{0,2}) billion(\*?\*?)/)
  if (m) {
    switch (lang) {
      case 'cs':
        return `${m[1]}${num(m[2])} až ${num(m[3])} miliardy${m[4]}`
      case 'de':
        return `${m[1]}${num(m[2])} bis ${num(m[3])} Milliarden${m[4]}`
      case 'es':
        return `${m[1]}${num(m[2])} a ${num(m[3])} mil millones${m[4]}`
      case 'it':
        return `${m[1]}da ${num(m[2])} a ${num(m[3])} miliardi${m[4]}`
      case 'nb':
        return `${m[1]}${num(m[2])} til ${num(m[3])} milliarder${m[4]}`
      case 'pt':
        return `${m[1]}${num(m[2])} a ${num(m[3])} bilhões${m[4]}`
      case 'en':
      default:
        return cellText
    }
  }

  // Try matching plain percentage, e.g. 2.6%
  // TODO: Inject values into template string like `${value}%`
  m = cellText.match(/(\*?\*?)([+-]?)(\d+\.?\d{0,2})%(\*?\*?)/)
  if (m) {
    switch (lang) {
      case 'de':
      case 'nb':
        return `${m[1]}${m[2]}${num(m[3])}&nbsp;%${m[4]}`
      case 'cs':
      case 'es':
      case 'it':
      case 'pt':
        return `${m[1]}${m[2]}${num(m[3])}%${m[4]}`
      case 'en':
      default:
        return cellText
    }
  }

  return cellText
}
