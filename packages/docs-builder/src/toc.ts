// Copyright (c) 2022 Climate Interactive / New Venture Fund

export interface TocSection {
  /** The translated title of the section. */
  title: string

  /** The link path/anchor for the section. */
  relPath: string

  /** The heading level of the section. */
  level: number
}

export interface TocPageItem {
  kind: 'page'

  /** The path of the linked HTML file, relative to the base project directory. */
  relPath: string

  /** The base name of the page file. */
  baseName: string

  /** The translated title of the page. */
  title: string

  /** The sections for the page. */
  sections: TocSection[]
}

export interface TocSeparatorItem {
  kind: 'separator'
}

export type TocItem = TocPageItem | TocSeparatorItem

export class Toc {
  /** The items in the table of contents, in the order that they will appear. */
  public readonly items: TocItem[] = []

  addPage(relPath: string, baseName: string, title: string, sections: TocSection[]): void {
    this.items.push({
      kind: 'page',
      relPath,
      baseName,
      title,
      sections
    })
  }

  addSeparator(): void {
    // In the case where a newer page is excluded because it was not part
    // of an earlier translation, we may end up with empty sections in the
    // table of contents (and redundant separators), so if the previous
    // item was a separator, don't include a redundant one
    if (this.items[this.items.length - 1].kind === 'separator') {
      return
    }

    this.items.push({
      kind: 'separator'
    })
  }
}
