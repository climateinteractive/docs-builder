// Copyright (c) 2026 Climate Interactive / New Venture Fund

import type { Server, ServerResponse } from 'http'
import { createServer } from 'http'
import { connect } from 'net'
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

/** The default number of ports that are tried before giving up. */
const defaultMaxPortAttempts = 10

/** The addresses that are checked when looking for a server on a port. */
const loopbackAddresses = ['127.0.0.1', '::1']

/** The number of milliseconds to wait for a connection when checking a port. */
const portProbeTimeout = 500

/**
 * Return whether a server accepts a connection on the given address and port.
 *
 * @param host The address to connect to.
 * @param port The port to connect to.
 * @returns A promise that is resolved with true if the connection was accepted.
 */
function canConnect(host: string, port: number): Promise<boolean> {
  return new Promise(resolve => {
    const socket = connect({ host, port })
    function finish(connected: boolean): void {
      socket.destroy()
      resolve(connected)
    }
    socket.setTimeout(portProbeTimeout)
    socket.on('connect', () => finish(true))
    // A connection that neither succeeds nor is refused means the port is not usable
    // for a local dev server either way
    socket.on('timeout', () => finish(true))
    socket.on('error', () => finish(false))
  })
}

/**
 * Return whether a server is already listening on the given port.
 *
 * Attempting to listen is not enough on its own.  On macOS, a server that is bound to a
 * single address (for example, another dev server on `0.0.0.0`) does not prevent this
 * server from binding the same port on a different address, so both end up running and
 * the browser reaches whichever one `localhost` happens to resolve to.  Connecting to
 * the loopback addresses catches that case.
 *
 * @param port The port to check.
 * @returns A promise that is resolved with true if the port is already being used.
 */
async function isPortInUse(port: number): Promise<boolean> {
  const results = await Promise.all(loopbackAddresses.map(host => canConnect(host, port)))
  return results.some(inUse => inUse)
}

/** The options for starting the local development server. */
export interface DevServerOptions {
  /** The absolute path of the directory that is served. */
  rootDir: string
  /**
   * The preferred port to listen on.  If the port is already in use, the following
   * ports are tried in turn.  Use zero to listen on an arbitrary free port.
   */
  port: number
  /** The path (relative to `rootDir`) of the file that triggers a reload when changed. */
  watchPath: string
  /**
   * The number of ports that are tried, starting at `port`, before giving up.  Defaults
   * to 10.  This is ignored when `port` is zero.
   */
  maxPortAttempts?: number
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
 * If the preferred port is already in use (for example, when a dev server is already
 * running for a different project), the following ports are tried in turn, so use the
 * `port` property of the returned server when reporting or opening the URL.
 *
 * @param options The dev server options.
 * @returns A promise that is resolved with the running server once it is listening
 * and watching for changes.
 * @throws An error if no free port is found within the allowed number of attempts.
 */
export async function startDevServer(options: DevServerOptions): Promise<DevServer> {
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

  /**
   * Wait for the watcher to see the existing files, so that a build that finishes
   * immediately after startup is not missed.
   */
  function watcherReady(): Promise<void> {
    return new Promise((resolve, reject) => {
      watcher.once('error', reject)
      watcher.once('ready', resolve)
    })
  }

  /**
   * Listen on the given port.
   *
   * @param port The port to listen on.
   * @returns A promise that is resolved with the port that the server is listening on,
   * or rejected if the server could not be started.
   */
  function listen(port: number): Promise<number> {
    return new Promise((resolve, reject) => {
      function onError(error: Error): void {
        server.off('listening', onListening)
        reject(error)
      }
      function onListening(): void {
        server.off('error', onError)
        // Errors that arrive after startup were never reported, and stopping the dev
        // session for one would be worse than carrying on
        server.on('error', () => {})
        const address = server.address()
        resolve(typeof address === 'object' && address !== null ? address.port : port)
      }
      server.once('error', onError)
      server.once('listening', onListening)
      server.listen(port)
    })
  }

  /**
   * Listen on the preferred port, falling back on the ports that follow it if it is
   * already being used by another server.
   *
   * @returns A promise that is resolved with the port that the server is listening on.
   */
  async function listenOnAvailablePort(): Promise<number> {
    // When port zero is requested, the operating system chooses a port that is free,
    // so there is nothing to fall back on
    if (options.port === 0) {
      return listen(0)
    }

    const maxAttempts = options.maxPortAttempts ?? defaultMaxPortAttempts
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const port = options.port + attempt
      if (await isPortInUse(port)) {
        continue
      }
      try {
        return await listen(port)
      } catch (error) {
        // Another server may have claimed the port between the check and the attempt
        if ((error as NodeJS.ErrnoException).code !== 'EADDRINUSE') {
          throw error
        }
      }
    }

    const lastPort = options.port + maxAttempts - 1
    throw new Error(
      `Failed to find an available port (tried ports ${options.port} through ${lastPort})`
    )
  }

  try {
    await watcherReady()
    const port = await listenOnAvailablePort()
    return { port, close }
  } catch (error) {
    // The watcher is already running at this point, so close it before reporting the
    // failure, otherwise it would keep the process alive
    await watcher.close()
    throw error
  }
}
