// Copyright (c) 2026 Climate Interactive / New Venture Fund

import type { Server, ServerResponse } from 'http'
import { createServer } from 'http'
import { resolve as resolvePath } from 'path'

import chokidar from 'chokidar'
import sirv from 'sirv'

/**
 * The path that the injected client script connects to in order to listen for
 * reload events.
 */
export const reloadEventPath = '/__docs_builder_reload'

/**
 * The script that is added to the `<head>` of each generated page when building in
 * development mode.
 *
 * The browser reconnects to an `EventSource` automatically if the connection is
 * dropped, so the page will reattach on its own if the dev server is restarted.
 */
export const devReloadScriptTag = `<script>
  (function () {
    var source = new EventSource('${reloadEventPath}')
    source.onmessage = function () {
      location.reload()
    }
  })()
</script>`

/**
 * Add the reload script to the given HTML page.
 *
 * The script is inserted just before the closing `body` tag, which is where a page
 * expects trailing scripts to appear.  If the content does not contain a closing
 * `body` tag, the script is appended instead.
 *
 * @param html The HTML content of the page.
 * @returns The HTML content with the reload script included.
 */
export function injectDevReloadScript(html: string): string {
  const closingTag = '</body>'
  const index = html.lastIndexOf(closingTag)
  if (index < 0) {
    return `${html}\n${devReloadScriptTag}\n`
  }
  return `${html.slice(0, index)}${devReloadScriptTag}\n${html.slice(index)}`
}

/** The options for starting the local development server. */
export interface DevServerOptions {
  /** The absolute path of the directory that is served. */
  rootDir: string
  /** The port to listen on.  Use zero to listen on an arbitrary free port. */
  port: number
  /** The path (relative to `rootDir`) of the file that triggers a reload when changed. */
  watchPath: string
}

/** A running local development server. */
export interface DevServer {
  /** The port that the server is listening on. */
  port: number

  /**
   * Stop watching for changes and close the server.
   *
   * @returns A promise that is resolved once the server has been closed.
   */
  close(): Promise<void>
}

/**
 * Start a local development server that serves the given directory and reloads
 * connected browser tabs whenever the watched file is changed.
 *
 * The builder writes the watched file once all output files are in place, so a
 * reload is never triggered midway through a build.
 *
 * Reload notifications are delivered using server-sent events, which are supported
 * natively by the browser, so no WebSocket library is needed.
 *
 * @param options The dev server options.
 * @returns A promise that is resolved with the running server once it is listening
 * and watching for changes.
 */
export function startDevServer(options: DevServerOptions): Promise<DevServer> {
  // Keep track of the connected browser tabs so that each one can be notified
  // when a build finishes
  const clients: Set<ServerResponse> = new Set()

  const serve = sirv(options.rootDir, { dev: true, etag: true })

  const server: Server = createServer((req, res) => {
    if (req.url === reloadEventPath) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive'
      })
      // Send a comment as soon as the stream is opened so that the browser
      // treats the connection as established
      res.write(': connected\n\n')
      clients.add(res)
      req.on('close', () => {
        clients.delete(res)
      })
      return
    }
    serve(req, res)
  })

  // Watch the single file that the builder writes at the end of each build
  const watcher = chokidar.watch(resolvePath(options.rootDir, options.watchPath), {
    ignoreInitial: true
  })
  watcher.on('change', () => {
    for (const client of clients) {
      client.write('data: reload\n\n')
    }
  })

  async function close(): Promise<void> {
    await watcher.close()
    // End the open event streams, otherwise the server will not finish closing
    for (const client of clients) {
      client.end()
    }
    clients.clear()
    const closed = new Promise<void>((resolve, reject) => {
      server.close(err => (err ? reject(err) : resolve()))
    })
    // Drop any idle keep-alive connections, which would otherwise hold the
    // server open until the browser times them out
    server.closeAllConnections()
    await closed
  }

  // Wait for the server and the watcher to be ready before resolving, so that a
  // build that finishes immediately after startup is not missed
  return new Promise((resolve, reject) => {
    server.on('error', reject)
    watcher.on('error', reject)
    watcher.on('ready', () => {
      server.listen(options.port, () => {
        const address = server.address()
        const port = typeof address === 'object' && address !== null ? address.port : options.port
        resolve({ port, close })
      })
    })
  })
}
