import fs from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer-core'
import { PNG } from 'pngjs'

const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const baseUrl = process.env.QA_BASE_URL ?? 'http://localhost:8082'
const root = process.cwd()
const outDir = path.join(root, 'tests/visual-qa')
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const cases = [
  { name: 'home', route: '/', figma: 'home.png', viewport: { width: 393, height: 852 } },
  { name: 'ward', route: '/patients', figma: 'ward.png', viewport: { width: 393, height: 852 } },
  { name: 'ward-detail', route: '/ward/ward-a', figma: 'ward-detail.png', viewport: { width: 393, height: 852 } },
  { name: 'patient-detail', route: '/patient/p1', figma: 'patient-detail.png', viewport: { width: 393, height: 852 } },
  { name: 'profile', route: '/settings', figma: 'profile.png', viewport: { width: 393, height: 852 } },
]

function readPng(file) {
  return PNG.sync.read(fs.readFileSync(file))
}

function pixelAt(img, x, y) {
  const index = (y * img.width + x) * 4
  return [
    img.data[index],
    img.data[index + 1],
    img.data[index + 2],
    img.data[index + 3],
  ]
}

function compareImages(figma, app) {
  const width = Math.min(figma.width, app.width)
  const height = Math.min(figma.height, app.height)
  let total = 0
  let count = 0
  let severe = 0

  for (let y = 0; y < height; y += 2) {
    const fy = Math.floor((y / height) * figma.height)
    const ay = Math.floor((y / height) * app.height)
    for (let x = 0; x < width; x += 2) {
      const fx = Math.floor((x / width) * figma.width)
      const ax = Math.floor((x / width) * app.width)
      const f = pixelAt(figma, fx, fy)
      const a = pixelAt(app, ax, ay)
      const diff = (Math.abs(f[0] - a[0]) + Math.abs(f[1] - a[1]) + Math.abs(f[2] - a[2])) / 3
      total += diff
      count += 1
      if (diff > 64) severe += 1
    }
  }

  return {
    comparedSize: `${width}x${height}`,
    meanRgbDelta: Number((total / count).toFixed(2)),
    severePixelRate: Number(((severe / count) * 100).toFixed(2)),
  }
}

function summarizeText(text) {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 80)
    .join(' ')
}

fs.mkdirSync(path.join(outDir, 'app'), { recursive: true })
fs.mkdirSync(path.join(outDir, 'report'), { recursive: true })

const browser = await puppeteer.launch({
  executablePath: chromePath,
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
})

const rows = []

try {
  for (const testCase of cases) {
    const page = await browser.newPage()
    await page.setViewport({ ...testCase.viewport, deviceScaleFactor: 1, isMobile: true })
    const url = new URL(testCase.route, baseUrl).toString()
    const response = await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 })
    await delay(1500)

    const appPath = path.join(outDir, 'app', `${testCase.name}.png`)
    await page.screenshot({ path: appPath, fullPage: true })

    const bodyText = await page.evaluate(() => document.body.innerText || '')
    const figmaPath = path.join(outDir, 'figma', testCase.figma)
    const appImage = readPng(appPath)
    const figmaImage = readPng(figmaPath)
    const metrics = compareImages(figmaImage, appImage)

    rows.push({
      ...testCase,
      url,
      status: response?.status() ?? 'n/a',
      appSize: `${appImage.width}x${appImage.height}`,
      figmaSize: `${figmaImage.width}x${figmaImage.height}`,
      text: summarizeText(bodyText),
      ...metrics,
    })

    await page.close()
  }
} finally {
  await browser.close()
}

const report = [
  '# Figma Visual QA',
  '',
  `Base URL: ${baseUrl}`,
  '',
  '| Screen | Route | Figma | App | Mean RGB Delta | Severe Pixel Rate |',
  '| --- | --- | --- | --- | ---: | ---: |',
  ...rows.map((row) => (
    `| ${row.name} | ${row.route} | ${row.figmaSize} | ${row.appSize} | ${row.meanRgbDelta} | ${row.severePixelRate}% |`
  )),
  '',
  '## Captured Text',
  '',
  ...rows.flatMap((row) => [
    `### ${row.name}`,
    '',
    row.text || '(no visible text captured)',
    '',
  ]),
].join('\n')

fs.writeFileSync(path.join(outDir, 'report', 'figma-compare.md'), report)
console.table(rows.map(({ name, route, figmaSize, appSize, meanRgbDelta, severePixelRate }) => ({
  name,
  route,
  figmaSize,
  appSize,
  meanRgbDelta,
  severePixelRate,
})))
