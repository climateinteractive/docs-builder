// Copyright (c) 2022 Climate Interactive / New Venture Fund

export type LangCode = string

export type Frontmatter = {
  fragments?: {
    head?: string[]
  }
}

export interface MarkdownPage {
  raw: string
  frontmatter?: Frontmatter
}

export interface HtmlPage {
  baseName: string
  relPath: string
  body: string
  headFragments?: string[]
}
