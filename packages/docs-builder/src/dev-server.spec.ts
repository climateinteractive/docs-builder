// Copyright (c) 2026 Climate Interactive / New Venture Fund. All rights reserved.

import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { get as httpGet } from 'http'
import { tmpdir } from 'os'
import { join as joinPath } from 'path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { DevServer } from './dev-server'
import {
  devReloadScriptTag,
  injectDevReloadScript,
  reloadEventPath,
  startDevServer
} from './dev-server'

let rootDir: string
let server: DevServer | undefined

/** An open connection to the server-sent event stream. */
interface EventStream {
  /** The value of the `Content-Type` response header. */
  contentType: string | undefined
  /** Read the next chunk of text sent by the server. */
  next(): Promise<string>
  /** Close the connection. */
  close(): void
}

/**
 * Open a connection to the given server-sent event stream.
 *
 * This uses the `http` module rather than `fetch` so that each stream is given its
 * own connection; the pool used by `fetch` can otherwise make a second request wait
 * on the first, which never completes.
 *
 * @param url The URL of the event stream.
 * @returns A promise that is resolved with the open stream once the response headers
 * have been received.
 */
function openEventStream(url: string): Promise<EventStream> {
  // Hold on to any chunks that arrive before they are requested, so that no event
  // is missed between calls to `next`
  const chunks: string[] = []
  const pending: ((chunk: string) => void)[] = []

  return new Promise((resolve, reject) => {
    const request = httpGet(url, response => {
      response.setEncoding('utf8')
      response.on('data', (chunk: string) => {
        const waiting = pending.shift()
        if (waiting) {
          waiting(chunk)
        } else {
          chunks.push(chunk)
        }
      })
      resolve({
        contentType: response.headers['content-type'],
        next: () => {
          const chunk = chunks.shift()
          if (chunk !== undefined) {
            return Promise.resolve(chunk)
          }
          return new Promise<string>(resolveChunk => pending.push(resolveChunk))
        },
        close: () => request.destroy()
      })
    })
    request.on('error', reject)
  })
}

beforeEach(() => {
  rootDir = mkdtempSync(joinPath(tmpdir(), 'docs-builder-dev-server-'))
  writeFileSync(joinPath(rootDir, 'timestamp'), 'initial')
})

afterEach(async () => {
  await server?.close()
  server = undefined
  rmSync(rootDir, { recursive: true, force: true })
})

describe('startDevServer', () => {
  it('should serve a static file from the root directory', async () => {
    writeFileSync(joinPath(rootDir, 'index.html'), '<html><body>hello</body></html>')
    server = await startDevServer({ rootDir, port: 0, watchPath: 'timestamp' })

    const response = await fetch(`http://localhost:${server.port}/index.html`)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/html')
    expect(await response.text()).toBe('<html><body>hello</body></html>')
  })

  it('should return a 404 status for a file that does not exist', async () => {
    server = await startDevServer({ rootDir, port: 0, watchPath: 'timestamp' })

    const response = await fetch(`http://localhost:${server.port}/nope.html`)
    expect(response.status).toBe(404)
  })

  it('should send a reload event when the watched file is changed', async () => {
    server = await startDevServer({ rootDir, port: 0, watchPath: 'timestamp' })

    const stream = await openEventStream(`http://localhost:${server.port}${reloadEventPath}`)
    expect(stream.contentType).toContain('text/event-stream')

    // The server sends a comment as soon as the stream is opened, so that the
    // browser treats the connection as established
    expect(await stream.next()).toContain(': connected')

    // Simulate the builder finishing a build
    writeFileSync(joinPath(rootDir, 'timestamp'), 'updated')
    expect(await stream.next()).toContain('data: reload')

    stream.close()
  })

  it('should send a reload event to each connected client', async () => {
    server = await startDevServer({ rootDir, port: 0, watchPath: 'timestamp' })

    const url = `http://localhost:${server.port}${reloadEventPath}`
    const streams = [await openEventStream(url), await openEventStream(url)]
    for (const stream of streams) {
      expect(await stream.next()).toContain(': connected')
    }

    writeFileSync(joinPath(rootDir, 'timestamp'), 'updated')
    for (const stream of streams) {
      expect(await stream.next()).toContain('data: reload')
      stream.close()
    }
  })

  it('should stop accepting connections after being closed', async () => {
    server = await startDevServer({ rootDir, port: 0, watchPath: 'timestamp' })
    const port = server.port

    await server.close()
    server = undefined

    await expect(fetch(`http://localhost:${port}/index.html`)).rejects.toThrow()
  })
})

describe('devReloadScriptTag', () => {
  it('should connect to the path that the server listens on', () => {
    expect(devReloadScriptTag).toContain(`new EventSource('${reloadEventPath}')`)
    expect(devReloadScriptTag).toContain('location.reload()')
  })
})

describe('injectDevReloadScript', () => {
  it('should insert the script before the closing body tag', () => {
    const html = '<html>\n<body>\n<p>hello</p>\n</body>\n</html>\n'
    const result = injectDevReloadScript(html)
    expect(result).toBe(`<html>\n<body>\n<p>hello</p>\n${devReloadScriptTag}\n</body>\n</html>\n`)
  })

  it('should insert the script before the last closing body tag', () => {
    const html = '<html><body><pre>&lt;/body&gt;</pre></body></html>'
    const result = injectDevReloadScript(html)
    expect(result.indexOf(devReloadScriptTag)).toBeGreaterThan(result.indexOf('<pre>'))
    expect(result.lastIndexOf('</body>')).toBeGreaterThan(result.indexOf(devReloadScriptTag))
  })

  it('should append the script if there is no closing body tag', () => {
    const html = '<p>fragment</p>'
    expect(injectDevReloadScript(html)).toBe(`<p>fragment</p>\n${devReloadScriptTag}\n`)
  })
})
