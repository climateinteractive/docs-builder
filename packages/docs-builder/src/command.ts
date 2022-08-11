// Copyright (c) 2022 Climate Interactive / New Venture Fund

import type { BlockId } from './block'

export interface CommandDef {
  kind: 'def'
  id: BlockId
  hidden: boolean
}

export interface CommandBeginDef {
  kind: 'begin-def'
  id: BlockId
  hidden: boolean
}

export interface CommandEndDef {
  kind: 'end-def'
}

export interface CommandSection {
  kind: 'section'
  id: BlockId
}

export type Command = CommandDef | CommandBeginDef | CommandEndDef | CommandSection
