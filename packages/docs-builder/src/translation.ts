// Copyright (c) 2022 Climate Interactive / New Venture Fund

import gettextParser from 'gettext-parser'
import type { Block, BlockId } from './block'
import { readTextFile, writeOutputFile } from './fs'

/**
 * Read translated strings from the given gettext `.po` file.
 *
 * @param poPath The absolute path to the po file.
 */
export function readPoFile(poPath: string): Map<BlockId, string> {
  const poData = readTextFile(poPath)
  const po = gettextParser.po.parse(poData)

  // Note: `po.translations` is grouped by `msgctxt`, so we need to iterate
  // over all available contexts
  const stringMap: Map<BlockId, string> = new Map()
  for (const context of Object.keys(po.translations)) {
    const translations = po.translations[context]
    for (const msgid of Object.keys(translations)) {
      if (msgid === '') {
        // Skip the header
        continue
      }
      const msgstr = translations[msgid].msgstr[0]
      stringMap.set(msgid, msgstr)
    }
  }

  return stringMap
}

/**
 * Write a gettext `.po` file containing base (English) strings.
 *
 * @param poPath The absolute path to the po file to be written.
 * @param blocks The base blocks/strings to be written.
 */
export function writeBasePoFile(poPath: string, blocks: Block[]): void {
  let poText = ''
  const emitLine = (s: string) => {
    poText += `${s}\n`
  }

  // Emit header
  emitLine('#')
  emitLine(`msgid ""`)
  emitLine(`msgstr ""`)

  const allIds = []
  for (const block of blocks) {
    // // Skip strings that are not to be translated
    // if (block.layout === 'not-translated') {
    //   continue
    // }

    // // Skip strings that are purposely omitted (specified in the list above)
    // let shouldSkip = false
    // for (const prefix of omittedPrefixes) {
    //   if (block.id.startsWith(prefix)) {
    //     shouldSkip = true
    //     break
    //   }
    // }
    // if (shouldSkip) {
    //   continue
    // }

    const id = block.id
    if (allIds.includes(id)) {
      // Fail if we detect a duplicate key
      throw new Error(`More than one string with id=${id}`)
    } else {
      allIds.push(id)
    }

    // Use the base English string
    let str = block.text

    // Escape double quotes so that the string can be used in a msgstr line
    if (str.includes('"')) {
      str = str.replace(/"/g, '\\"')
    }

    // // Also insert line breaks between paragraphs to make longer descriptions
    // // easier to read in Weblate
    // str = str.replace(/<\/p><p>/g, '</p>\\n\\n<p>')

    const context = block.context
    emitLine('')
    if (context) {
      emitLine(`#. ${context}`)
    }
    emitLine(`msgid "${id}"`)
    if (str.includes('\n')) {
      // The string includes a line break between items; use multi-line `msgstr`.
      const lines = str.split('\n')
      emitLine(`msgstr ""`)
      lines.forEach((line, index) => {
        // Remove trailing whitespace that may have been left before the newline
        // (either accidentally, or e.g., as a result of parsing nested lists)
        line = line.replace(/\s+$/, '')
        if (index < lines.length - 1) {
          emitLine(`"${line}\\n"`)
        } else {
          emitLine(`"${line}"`)
        }
      })
    } else {
      // Emit the string on a single line
      emitLine(`msgstr "${str}"`)
    }
  }

  // Write the `.po` file
  writeOutputFile(poPath, poText)
}
