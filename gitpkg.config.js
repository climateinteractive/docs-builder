/*
 * This file contains the configuration for gitpkg:
 *   https://github.com/ramasilveyra/gitpkg
 *
 * We use gitpkg as a way to publish prerelease/dev versions of various
 * private (internal) packages.  Both npm and yarn only support simple
 * https dependencies (like `https://.../some-repo#1234abc`) where
 * the repository contains a single npm package; they do not support
 * cases where a monorepo contains multiple npm packages, so we use
 * gitpkg as an alternative, which is more lightweight than publishing
 * lots of prerelease versions to the GitHub Packages repository.
 *
 * To publish a package (for example, `docs-builder`):
 *   $ cd packages/docs-builder
 *   $ pnpm build
 *   $ gitpkg publish
 *
 * To consume a package (in a different repository), use an https
 * dependency like this in `package.json`:
 *   "@climateinteractive/docs-builder": "climateinteractive/gitpkg-registry#docs-builder-1234abc"
 */
module.exports = () => ({
  registry: 'git@github.com:climateinteractive/gitpkg-registry.git',
  getTagName: pkg => {
    // Exclude the org ("@climateinteractive") part of the package name
    // when building the gitpkg tag name
    const pkgName = pkg.name.includes('/') ? pkg.name.split('/')[1] : pkg.name

    // Use the git commit hash in place of the version; this makes it
    // possible to correlate a gitpkg package with its source commit
    // and is easier than bumping package versions
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const commitHash = require('child_process')
      .execSync('git rev-parse --short HEAD')
      .toString()
      .trim()
      .slice(0, 7)

    return `${pkgName}-${commitHash}`
  }
})
