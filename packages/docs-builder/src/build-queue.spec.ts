// Copyright (c) 2026 Climate Interactive / New Venture Fund

import { describe, expect, it } from 'vitest'

import { createBuildQueue } from './build-queue'

/** A build that only finishes when the test says so. */
interface ControlledBuild {
  /** The number of times the build has been started. */
  startCount: number
  /** The build function that is given to the queue. */
  run: () => Promise<void>
  /** Finish the build that is currently running. */
  finish: () => void
  /** Fail the build that is currently running. */
  fail: (error: Error) => void
}

/**
 * Create a build that does not finish until the test finishes it, so that requests can
 * be made while a build is in progress.
 *
 * @returns The controlled build.
 */
function controlledBuild(): ControlledBuild {
  let resolveCurrent: (() => void) | undefined
  let rejectCurrent: ((error: Error) => void) | undefined

  return {
    startCount: 0,
    run(this: ControlledBuild) {
      this.startCount++
      return new Promise<void>((resolve, reject) => {
        resolveCurrent = resolve
        rejectCurrent = reject
      })
    },
    finish: () => resolveCurrent?.(),
    fail: (error: Error) => rejectCurrent?.(error)
  }
}

describe('createBuildQueue', () => {
  it('should start a build when one is requested', async () => {
    const build = controlledBuild()
    const queue = createBuildQueue(() => build.run())

    const requested = queue.request()
    expect(build.startCount).toBe(1)

    build.finish()
    await requested
  })

  it('should not start a build while one is already in progress', async () => {
    const build = controlledBuild()
    const queue = createBuildQueue(() => build.run())

    const first = queue.request()
    const second = queue.request()
    expect(build.startCount).toBe(1)

    // The first build finishes, which allows the requested build to start
    build.finish()
    await first
    expect(build.startCount).toBe(2)

    build.finish()
    await second
  })

  it('should coalesce the requests that arrive while a build is in progress', async () => {
    const build = controlledBuild()
    const queue = createBuildQueue(() => build.run())

    const first = queue.request()
    const pending = [queue.request(), queue.request(), queue.request()]

    build.finish()
    await first
    expect(build.startCount).toBe(2)

    // All of the requests that arrived during the first build are covered by the
    // single build that follows it
    build.finish()
    await Promise.all(pending)
    expect(build.startCount).toBe(2)
  })

  it('should report a failed build without rejecting', async () => {
    const build = controlledBuild()
    const errors: unknown[] = []
    const queue = createBuildQueue(
      () => build.run(),
      error => errors.push(error)
    )

    const requested = queue.request()
    build.fail(new Error('build failed'))
    await expect(requested).resolves.toBeUndefined()
    expect(errors).toEqual([new Error('build failed')])
  })

  it('should continue to accept requests after a build fails', async () => {
    const build = controlledBuild()
    const queue = createBuildQueue(
      () => build.run(),
      () => undefined
    )

    const first = queue.request()
    build.fail(new Error('build failed'))
    await first

    const second = queue.request()
    expect(build.startCount).toBe(2)

    build.finish()
    await second
  })

  it('should run the build that follows a failed build', async () => {
    const build = controlledBuild()
    const queue = createBuildQueue(
      () => build.run(),
      () => undefined
    )

    const first = queue.request()
    const second = queue.request()
    build.fail(new Error('build failed'))
    await first
    expect(build.startCount).toBe(2)

    build.finish()
    await second
  })
})
