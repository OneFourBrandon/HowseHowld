import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const svg = await readFile(new URL('../public/favicon.svg', import.meta.url), 'utf8')
const browser = await chromium.launch()
const page = await browser.newPage()

await page.setContent(`
  <style>
    * { box-sizing: border-box }
    html, body { margin: 0; width: 100%; height: 100%; overflow: hidden }
    svg { display: block; width: 100%; height: 100% }
  </style>
  ${svg}
`)

for (const [size, name] of [
  [192, 'icon-192.png'],
  [512, 'icon-512.png'],
  [180, 'apple-touch-icon.png'],
]) {
  await page.setViewportSize({ width: size, height: size })
  await page.screenshot({
    path: fileURLToPath(new URL(`../public/${name}`, import.meta.url)),
    omitBackground: false,
  })
}

await browser.close()
