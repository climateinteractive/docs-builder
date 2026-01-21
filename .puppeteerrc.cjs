const { join } = require('path')

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Use a local cache directory to make it easier to persist the cache in GitHub Actions
  cacheDirectory: join(__dirname, '.cache', 'puppeteer')
}
