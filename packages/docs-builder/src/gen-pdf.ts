// Copyright (c) 2022 Climate Interactive / New Venture Fund

import { promises as fsPromises } from 'fs'
import { resolve as resolvePath } from 'path'

import puppeteer from 'puppeteer'

import type { Context } from './context'

export async function writePdfFile(context: Context): Promise<void> {
  // Launch a headless browser instance
  const browser = await puppeteer.launch({ headless: true })

  // Open the complete HTML page in the headless browser
  const page = await browser.newPage()
  const htmlPath = resolvePath(context.outDir, 'complete.html')
  await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0' })

  // Export the page to PDF
  const pdf = await page.pdf({
    format: 'letter',
    margin: {
      left: 60,
      right: 60,
      top: 80,
      bottom: 80
    }
  })

  // Close the headless browser instance
  await browser.close()

  // Write the PDF file
  const projName = context.getProjectShortName()
  await fsPromises.writeFile(resolvePath(context.outDir, `${projName}.pdf`), pdf)
}
