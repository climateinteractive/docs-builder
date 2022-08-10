// Copyright (c) 2022 Climate Interactive / New Venture Fund

export type BlockId = string

export interface Block {
  /** The full block ID (including ID parts from the context/scope). */
  id: BlockId
  /** The raw text of the block. */
  text: string
  /** The optional context string to be included in the po file. */
  context?: string
}
