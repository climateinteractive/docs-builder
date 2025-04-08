// Copyright (c) 2022 Climate Interactive / New Venture Fund. All rights reserved.

import { describe, expect, it } from 'vitest'

import type { Config } from './config'
import { Context } from './context'
import { convertMarkdownToHtml, generateHtml, subscriptify } from './gen-html'
import { parseMarkdownPageContent } from './parse'

const config: Config = {
  mode: 'development',
  baseProjDir: 'xxx',
  sourceDir: 'xxx',
  outDir: 'xxx',
  version: '25.1.0',
  langs: [{ code: 'de', version: '25.1.0' }],
  formats: [],
  template: 'default',
  author: 'Climate Interactive',
  logoPath: 'xxx',
  defs: [],
  pages: ['page_1.md'],
  untranslated: [],
  options: {}
}

describe('generateHtml', () => {
  it('should convert valid Markdown', () => {
    const md = `\
This is a valid normal link: [page](https://climateinteractive.org)

This is a valid reference-style link: [page][ref]

This is a valid normal link: [page](https://climateinteractive.org) (with parentheses after) and more text

This is a valid reference-style link: [page][ref] (with parentheses after) and more text

[ref]: https://climateinteractive.org
`

    const html = generateHtml(new Context(config, 'en'), 'page_1.md', { raw: md })
    expect(html.baseName).toBe('page_1')
    expect(html.relPath).toBe('page_1.html')
    expect(html.body).toBe(`\
<p>This is a valid normal link: <a href="https://climateinteractive.org">page</a></p>
<p>This is a valid reference-style link: <a href="https://climateinteractive.org">page</a></p>
<p>This is a valid normal link: <a href="https://climateinteractive.org">page</a> (with parentheses after) and more text</p>
<p>This is a valid reference-style link: <a href="https://climateinteractive.org">page</a> (with parentheses after) and more text</p>
`)
  })

  it.only('should throw an error if invalid link syntax is detected', () => {
    const links = `\
This is a valid normal link: [page](https://climateinteractive.org)

This is a valid reference-style link: [page][ref]

This is a valid normal link: [page](https://climateinteractive.org) (with parentheses after) and more text

This is a valid reference-style link: [page][ref] (with parentheses after) and more text

This is an invalid normal link: [page] (https://climateinteractive.org) (with parentheses after) and more text

This is an invalid reference-style link: [page] [ref] (with parentheses after) and more text
`

    const md = `\
# <!-- section:section_1 -->Section 1

<!-- begin-def:block_1 -->

${links}

<!-- end-def -->

[ref]: https://climateinteractive.org
`

    // Verify that an error is thrown if the English content contains invalid link syntax.
    // Note that in the English case, the invalid ref link will be converted to an HTML link.
    const enContext = new Context(config, 'en')
    const enMd = parseMarkdownPageContent(enContext, 'page_1.md', md)
    expect(() => generateHtml(enContext, 'page_1.md', { raw: enMd.raw })).toThrow(`\
Detected invalid Markdown link syntax in the generated HTML:
[page] (&lt;a href
[page] &lt;a href
To fix, ensure there are no spaces between link text and link url/reference, for example: [text](url) or [text][ref] (page=page_1.md)`)

    // Verify that an error is thrown if the translated content contains invalid link syntax.
    // Note that in the non-English case, the invalid ref link target will not be converted
    // to an HTML link (unlike the English case above), so the error message will be different.
    const deContext = enContext.derive(
      'de',
      new Map([
        ['section_1__title', 'Section 1'],
        ['section_1__block_1', links]
      ])
    )
    const deMd = parseMarkdownPageContent(deContext, 'page_1.md', md)
    expect(() => generateHtml(deContext, 'page_1.md', { raw: deMd.raw })).toThrow(`\
Detected invalid Markdown link syntax in the generated HTML:
[page] (&lt;a href
[page] [ref]
To fix, ensure there are no spaces between link text and link url/reference, for example: [text](url) or [text][ref] (lang=de page=page_1.md)`)
  })
})

describe('subscriptify', () => {
  it('should convert chemical formulas', () => {
    expect(subscriptify('This is -CO2-')).toBe('This is -CO<sub>2</sub>-')
    expect(subscriptify('This is -CF4-')).toBe('This is -CF<sub>4</sub>-')
    expect(subscriptify('This is -CH4-')).toBe('This is -CH<sub>4</sub>-')
    expect(subscriptify('This is -H2O-')).toBe('This is -H<sub>2</sub>O-')
    expect(subscriptify('This is -N2O-')).toBe('This is -N<sub>2</sub>O-')
    expect(subscriptify('This is -NF3-')).toBe('This is -NF<sub>3</sub>-')
    expect(subscriptify('This is -O2-')).toBe('This is -O<sub>2</sub>-')
    expect(subscriptify('This is -O3-')).toBe('This is -O<sub>3</sub>-')
    expect(subscriptify('This is -SF6-')).toBe('This is -SF<sub>6</sub>-')
    expect(subscriptify('This is CO2 and CH4 and C12H22O11')).toBe(
      'This is CO<sub>2</sub> and CH<sub>4</sub> and C12H22O11'
    )
  })
})

describe('convertMarkdownToHtml', () => {
  it('should convert chemical formulas inside text elements only', () => {
    // Verify that transformations are applied when text appears in different
    // kinds of elements
    expect(convertMarkdownToHtml(undefined, 'This is -CO2-')).toBe(
      '<p>This is -CO<sub>2</sub>-</p>\n'
    )
    expect(convertMarkdownToHtml(undefined, '# This is CO2')).toBe(
      '<h1 id="this-is-co2">This is CO<sub>2</sub></h1>\n'
    )
    expect(convertMarkdownToHtml(undefined, '> This is _CO2_')).toBe(
      '<blockquote>\n<p>This is <em>CO<sub>2</sub></em></p>\n</blockquote>\n'
    )

    // Verify that attributes are not transformed
    expect(convertMarkdownToHtml(undefined, '[This is CO2](https://google.com/CO2)')).toBe(
      '<p><a href="https://google.com/CO2">This is CO<sub>2</sub></a></p>\n'
    )
    expect(convertMarkdownToHtml(undefined, '<img src="Hist_CO2.jpg"/>')).toBe(
      '<img src="Hist_CO2.jpg"/>'
    )
  })
})
