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

/** The kind of a command, for example, `def` or `section`. */
export type CommandKind = Command['kind']

/**
 * The set of command kinds that are recognized by the parser.  An HTML comment is only
 * treated as a command if it uses one of these names; any other comment is left alone,
 * which allows the Markdown source to include normal comments as well as directives
 * that are intended for other tools (for example, `<!-- cSpell:disable -->`).
 */
const knownCommandKinds: readonly string[] = ['def', 'begin-def', 'end-def', 'section']

/**
 * Return true if the given name is the name of a command that is recognized by the
 * parser.
 *
 * @param name The command name, as it appears in an HTML comment.
 * @returns true if the name refers to a known command, false otherwise.
 */
export function isKnownCommandKind(name: string): name is CommandKind {
  return knownCommandKinds.includes(name)
}
