// Copyright (c) 2026 Climate Interactive / New Venture Fund

/** A queue that runs one build at a time. */
export interface BuildQueue {
  /**
   * Request a build.
   *
   * If a build is already in progress, the requested build starts once that one has
   * finished.  Any number of requests that arrive during a build are covered by the
   * single build that follows it.
   *
   * @returns A promise that is resolved once the build that covers this request has
   * finished.  The promise is resolved whether the build succeeded or failed.
   */
  request(): Promise<void>
}

/**
 * Create a queue that runs one build at a time.
 *
 * A build removes and recreates its output directories, so two builds cannot safely run
 * at the same time; the one that starts second deletes the files that the first one is
 * still writing.  The queue makes each build wait for the one before it.
 *
 * @param build The function that performs a build.
 * @param onError The function called with the error when a build fails.  A failed build
 * does not stop the queue, so that a later build can succeed once the error is fixed.
 * @returns The build queue.
 */
export function createBuildQueue(
  build: () => Promise<void>,
  onError?: (error: unknown) => void
): BuildQueue {
  // The requests that are waiting on the next build to start
  let waiting: (() => void)[] = []
  let running = false

  async function runBuilds(): Promise<void> {
    running = true
    try {
      while (waiting.length > 0) {
        // Take the requests that this build covers; a request that arrives while the
        // build is running is covered by the build that follows it
        const covered = waiting
        waiting = []
        try {
          await build()
        } catch (error) {
          onError?.(error)
        }
        for (const resolve of covered) {
          resolve()
        }
      }
    } finally {
      running = false
    }
  }

  return {
    request(): Promise<void> {
      return new Promise<void>(resolve => {
        waiting.push(resolve)
        if (!running) {
          void runBuilds()
        }
      })
    }
  }
}
