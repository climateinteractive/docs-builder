// Copyright (c) 2022 Climate Interactive / New Venture Fund. All rights reserved.

import { describe, expect, it } from 'vitest'

import { convertMarkdownToHtml, subscriptify } from './gen-html'

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
