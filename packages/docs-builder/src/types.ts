// Copyright (c) 2022 Climate Interactive / New Venture Fund

export type LangCode = string

export interface MarkdownPage {
  raw: string
}

export interface HtmlPage {
  baseName: string
  relPath: string
  body: string
}
