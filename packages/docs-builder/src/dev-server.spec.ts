// Copyright (c) 2026 Climate Interactive / New Venture Fund. All rights reserved.

import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import type { Server } from 'http'
import { createServer, get as httpGet } from 'http'
import type { AddressInfo } from 'net'
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
let otherServers: Server[]

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

/**
 * Start a plain server that listens on the given port.
 *
 * @param port The port to listen on, or zero to listen on an arbitrary free port.
 * @param host The address to listen on, or undefined to listen on all addresses.
 * @returns A promise that is resolved with the server once it is listening, or rejected
 * if the port is not available.
 */
function listenOnPort(port: number, host?: string): Promise<Server> {
  return new Promise((resolve, reject) => {
    const other = createServer()
    other.on('error', reject)
    const listening = () => resolve(other)
    if (host !== undefined) {
      other.listen(port, host, listening)
    } else {
      other.listen(port, listening)
    }
  })
}

/**
 * Close the given server.
 *
 * @param other The server to close.
 * @returns A promise that is resolved once the server has been closed.
 */
function closeServer(other: Server): Promise<void> {
  return new Promise(resolve => other.close(() => resolve()))
}

/**
 * Return the port that the given server is listening on.
 *
 * @param other The server.
 * @returns The port.
 */
function portOf(other: Server): number {
  return (other.address() as AddressInfo).port
}

/**
 * Find a range of consecutive ports that are currently unused.
 *
 * The operating system only hands out one arbitrary free port at a time, so the ports
 * that follow it are claimed as well to confirm that the whole range is available.
 *
 * @param count The number of consecutive ports needed.
 * @returns A promise that is resolved with the first port in the range.
 */
async function findFreePortRange(count: number): Promise<number> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const servers: Server[] = []
    let firstPort = 0
    try {
      const first = await listenOnPort(0)
      servers.push(first)
      firstPort = portOf(first)
      for (let offset = 1; offset < count; offset++) {
        servers.push(await listenOnPort(firstPort + offset))
      }
    } catch {
      // One of the ports that follows is in use, so try a different range
      firstPort = 0
    }
    await Promise.all(servers.map(closeServer))
    if (firstPort > 0) {
      return firstPort
    }
  }
  throw new Error(`Failed to find ${count} consecutive free ports`)
}

/**
 * Start a plain server that holds the given port open, so that the dev server sees the
 * port as unavailable.
 *
 * @param port The port to hold open.
 * @param host The address to hold open, or undefined to hold open all addresses.
 * @returns A promise that is resolved once the server is listening.
 */
async function occupyPort(port: number, host?: string): Promise<void> {
  otherServers.push(await listenOnPort(port, host))
}

beforeEach(() => {
  rootDir = mkdtempSync(joinPath(tmpdir(), 'docs-builder-dev-server-'))
  writeFileSync(joinPath(rootDir, 'timestamp'), 'initial')
  otherServers = []
})

afterEach(async () => {
  await server?.close()
  server = undefined
  await Promise.all(otherServers.map(closeServer))
  otherServers = []
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

  it('should use the next port if the requested port is already in use', async () => {
    const port = await findFreePortRange(2)
    await occupyPort(port)

    writeFileSync(joinPath(rootDir, 'index.html'), '<html><body>hello</body></html>')
    server = await startDevServer({ rootDir, port, watchPath: 'timestamp' })
    expect(server.port).toBe(port + 1)

    const response = await fetch(`http://localhost:${server.port}/index.html`)
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('<html><body>hello</body></html>')
  })

  it('should use the next port if the requested port is in use by a server that is bound to a single address', async () => {
    const port = await findFreePortRange(2)
    // On macOS, a server that binds a specific address does not prevent another server
    // from binding the same port on a different address, so the port has to be probed
    // rather than relying on the bind to fail
    await occupyPort(port, '127.0.0.1')

    server = await startDevServer({ rootDir, port, watchPath: 'timestamp' })
    expect(server.port).toBe(port + 1)
  })

  it('should skip over each port that is already in use', async () => {
    const port = await findFreePortRange(3)
    await occupyPort(port)
    await occupyPort(port + 1)

    server = await startDevServer({ rootDir, port, watchPath: 'timestamp' })
    expect(server.port).toBe(port + 2)
  })

  it('should fail if no free port is found within the allowed number of attempts', async () => {
    const port = await findFreePortRange(2)
    await occupyPort(port)
    await occupyPort(port + 1)

    await expect(
      startDevServer({ rootDir, port, watchPath: 'timestamp', maxPortAttempts: 2 })
    ).rejects.toThrow(`Failed to find an available port (tried ports ${port} through ${port + 1})`)
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
