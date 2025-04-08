// Copyright (c) 2025 Climate Interactive / New Venture Fund. All rights reserved.

import { describe, expect, it } from 'vitest'

import type { Config } from './config'
import { Context } from './context'
import { parseMarkdownPageContent } from './parse'

const config: Config = {
  mode: 'development',
  baseProjDir: 'xxx',
  sourceDir: 'xxx',
  outDir: 'xxx',
  version: '25.1.0',
  langs: [],
  formats: [],
  template: 'default',
  author: 'Climate Interactive',
  logoPath: 'xxx',
  defs: [],
  pages: ['page_1.md'],
  untranslated: [],
  options: {}
}

describe('parseMarkdownPageContent', () => {
  it('should parse valid Markdown content', () => {
    const mdCommon = `\
<!-- Common strings -->

<!-- def:content_placeholder -->
This text was defined in \`common.md\`.

<!-- def:github_project -->
This page was generated by [\`docs-builder\`](https://github.com/climateinteractive/docs-builder).

<!-- Titles for untranslated pages -->

<!-- def:appendix__title -->
Appendix

<!-- Common section headers -->

<!-- def:section_examples -->
Examples

<!-- def:section_footnotes -->
Footnotes
`

    const mdGlossary = `\
# <!-- section:glossary --><!-- def:title -->Glossary

## <!-- section:page -->
<!-- def:def -->
**page**: one side of a sheet of paper in a collection of sheets bound together
`

    const mdPage = `\
---
fragments:
  head: ['example']
---

# <!-- section:page_1 --><!-- def:title -->Page 1

<!-- def:intro -->
This is the first [page][glossary_page].

## <!-- section:examples -->:section_examples:

<!-- begin-def:example_1 -->

This is a sentence with __bold__ and _italic_ text.

This block has two paragraphs that are captured using a \`begin-def\` / \`end-def\` pair.

<!-- end-def -->

<!-- def[hidden]:hidden_text -->
this text was defined using "hidden" flag

<!-- def:example_2 -->
Use \`def[hidden]\` to define some text without making it appear, then "use" it later on the page (like this: _:page_1__examples__hidden_text:_).

:content_placeholder:

<!-- def:example_3 -->
This sentence refers to a footnote. footnote-ref:fn_example

| <!-- def:header_person-->person | <!-- def:header_age -->age |
|--|--|
| Alice | 42 |
| Bob | 99 |


\`\`\`js
// This is a code block
const one = 1
const two = 2
const answer = one + two
\`\`\`

## <!-- section:footnotes -->:section_footnotes:

footnote:fn_example This is a footnote (only in English for now).

_:github_project:_
`

    // Parse the common and glossary strings so that the strings are part of the context
    const enContext = new Context(config, 'en')
    parseMarkdownPageContent(enContext, 'common.md', mdCommon)
    parseMarkdownPageContent(enContext, 'glossary.md', mdGlossary)

    // Verify that an error is thrown if the English content contains invalid link syntax
    const parsed = parseMarkdownPageContent(enContext, 'page_1.md', mdPage)
    expect(parsed.frontmatter).toEqual({
      fragments: {
        head: ['example']
      }
    })
    expect(parsed.raw).toEqual(`
# <a name="page_1"></a>Page 1<a class="heading-link" href="#page_1">&#128279;</a>

This is the first [page](glossary:page).

## <a name="page_1__examples"></a>Examples<a class="heading-link" href="#page_1__examples">&#128279;</a>

This is a sentence with **bold** and _italic_ text.

This block has two paragraphs that are captured using a \`begin-def\` / \`end-def\` pair.



Use \`def[hidden]\` to define some text without making it appear, then &quot;use&quot; it later on the page (like this: _this text was defined using "hidden" flag_).

This text was defined in \`common.md\`.

This sentence refers to a footnote. footnote-ref:fn_example

| person | age |
|--|--|
| Alice | 42 |
| Bob | 99 |

\`\`\`js
// This is a code block
const one = 1
const two = 2
const answer = one + two
\`\`\`

## <a name="page_1__footnotes"></a>Footnotes<a class="heading-link" href="#page_1__footnotes">&#128279;</a>

footnote:fn_example This is a footnote (only in English for now).

_This page was generated by [\`docs-builder\`](https://github.com/climateinteractive/docs-builder)._


`)
  })

  it('should throw an error if an unknown command is used', () => {
    const md = `\
<!-- somecommand:key -->
`
    const enContext = new Context(config, 'en')
    expect(() => parseMarkdownPageContent(enContext, 'page_1.md', md)).toThrow(
      `Unknown command 'somecommand' (page=page_1.md)`
    )
  })

  it('should throw an error if a command is used with an invalid identifier', () => {
    const md = `\
<!-- def:key_with_INVALID_chars -->
Hello
`
    const enContext = new Context(config, 'en')
    expect(() => parseMarkdownPageContent(enContext, 'page_1.md', md)).toThrow(
      `Identifier (key_with_INVALID_chars) must contain only lowercase letters, digits, and underscores (page=page_1.md)`
    )
  })

  it('should throw an error if a begin-def command is not closed', () => {
    const md = `\
<!-- begin-def:example_1 -->

Hello
`
    const enContext = new Context(config, 'en')
    expect(() => parseMarkdownPageContent(enContext, 'page_1.md', md)).toThrow(
      `Command 'begin-def' was not resolved or closed (page=page_1.md)`
    )
  })

  it('should throw an error if an unexpected command is used before a begin-def is closed', () => {
    const md = `\
<!-- begin-def:example_1 -->

Hello

<!-- def:example_2 -->
`
    const enContext = new Context(config, 'en')
    expect(() => parseMarkdownPageContent(enContext, 'page_1.md', md)).toThrow(
      `Unexpected command 'def' while current command 'begin-def' (id=example_1) is in effect (page=page_1.md)`
    )
  })

  it('should throw an error if a begin-def / end-def pair does not contain any text', () => {
    const md = `\
<!-- begin-def:example_1 -->

<!-- end-def -->
`

    const enContext = new Context(config, 'en')
    expect(() => parseMarkdownPageContent(enContext, 'page_1.md', md)).toThrow(
      `Saw 'end-def' but no tokens were included (page=page_1.md)`
    )
  })

  it('should throw an error if an end-def command is used without a corresponding begin-def command', () => {
    const md = `\
Hello

<!-- end-def -->
`

    const enContext = new Context(config, 'en')
    expect(() => parseMarkdownPageContent(enContext, 'page_1.md', md)).toThrow(
      `Saw 'end-def' without corresponding 'begin-def' (page=page_1.md)`
    )
  })

  it('should throw an error if text replacement syntax is used with an unknown string identifier', () => {
    const md = `\
Hello

:some_id:
`
    const enContext = new Context(config, 'en')
    expect(() => parseMarkdownPageContent(enContext, 'page_1.md', md)).toThrow(
      'Unknown replacement for id=some_id (page=page_1.md)'
    )
  })

  it('should throw an error if two spaces are detected at the end of a line', () => {
    const spaces = ' '.repeat(2)
    const md = `\
# <!-- section:section_1 -->Section 1

Hello${spaces}
there
`

    let expectedMsg = ''
    expectedMsg += 'Detected two or more spaces at the end of a text line. '
    expectedMsg += 'Markdown interprets this as a line break, which can be surprising. '
    expectedMsg += 'If the spaces were added unintentionally, remove the extra spaces. '
    expectedMsg += `If you do want a line break, use an explicit HTML 'br' tag instead. `
    expectedMsg += '(page=page_1.md scope=section_1)'

    const enContext = new Context(config, 'en')
    expect(() => parseMarkdownPageContent(enContext, 'page_1.md', md)).toThrow(expectedMsg)
  })

  it('should throw an error if a reference-style link cannot be resolved', () => {
    const md = `\
[This is a link][unknown_ref]
`
    const enContext = new Context(config, 'en')
    expect(() => parseMarkdownPageContent(enContext, 'page_1.md', md)).toThrow(
      'Unresolved reference-style link found for lang=en link=[This is a link][unknown_ref]'
    )
  })

  it('should throw an error if invalid link syntax is detected', () => {
    const links = `\
This is a valid normal link: [page](https://climateinteractive.org)

This is a valid reference-style link: [page][ref]

This is an invalid normal link: [page] (https://climateinteractive.org)

This is an invalid reference-style link: [page] [ref]
`

    const md = `\
# <!-- section:section_1 -->Section 1

<!-- begin-def:block_1 -->

${links}

<!-- end-def -->

[ref]: https://climateinteractive.org
`

    function expectedMsg(lang: string) {
      const langPart = lang === 'en' ? '' : `lang=${lang} `
      return `\
Detected invalid link syntax:
[page] (https://climateinteractive.org)
[page] [ref]
To fix, ensure there are no spaces between link text and link url/reference, for example: [text](url) or [text][ref] (${langPart}page=page_1.md scope=section_1)`
    }

    // Verify that an error is thrown if the English content contains invalid link syntax
    const enContext = new Context(config, 'en')
    expect(() => parseMarkdownPageContent(enContext, 'page_1.md', md)).toThrow(expectedMsg('en'))

    // Verify that an error is thrown if the translated content contains invalid link syntax
    const deBlocks = new Map([
      ['section_1__title', 'Section 1'],
      ['section_1__block_1', links]
    ])
    const deContext = new Context(config, 'de', undefined, deBlocks)
    expect(() => parseMarkdownPageContent(deContext, 'page_1.md', md)).toThrow(expectedMsg('de'))
  })
})
