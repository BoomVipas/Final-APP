/**
 * Handover feature QA — drives the new pending-card, picker, notes,
 * defer toggle, and history routes via Puppeteer and writes a Markdown
 * report into tests/visual-qa/report/handover-qa.md.
 *
 * Run with:  EXPO_PUBLIC_USE_MOCK=true npx expo start --web --port 8082
 *            (in another terminal)  node tests/visual-qa/handover-qa.mjs
 */

import fs from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer-core'

const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const baseUrl = process.env.QA_BASE_URL ?? 'http://localhost:8082'
const root = process.cwd()
const outDir = path.join(root, 'tests/visual-qa')
const screenshotsDir = path.join(outDir, 'app')
const reportDir = path.join(outDir, 'report')

const delay = (ms) => new Promise((r) => setTimeout(r, ms))

fs.mkdirSync(screenshotsDir, { recursive: true })
fs.mkdirSync(reportDir, { recursive: true })

const findings = []
function record(scope, ok, detail) {
  findings.push({ scope, ok, detail })
  const tag = ok ? 'PASS' : 'FAIL'
  console.log(`[${tag}] ${scope} :: ${detail}`)
}

const browser = await puppeteer.launch({
  executablePath: chromePath,
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
})

const consoleErrors = []
function attachConsole(page, scope) {
  page.on('pageerror', (err) => consoleErrors.push({ scope, type: 'pageerror', text: String(err) }))
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push({ scope, type: 'console', text: msg.text() })
  })
}

async function gotoCase(page, route, scope) {
  attachConsole(page, scope)
  const url = new URL(route, baseUrl).toString()
  const resp = await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 })
  await delay(1500)
  return { url, status: resp?.status() ?? null }
}

try {
  // 1. HOME — pending handover card should be present
  {
    const scope = 'home'
    const page = await browser.newPage()
    await page.setViewport({ width: 393, height: 852, deviceScaleFactor: 1, isMobile: true })
    const { url, status } = await gotoCase(page, '/', scope)
    const text = await page.evaluate(() => document.body.innerText || '')
    await page.screenshot({ path: path.join(screenshotsDir, 'home.png'), fullPage: true })
    record(scope, status === 200, `GET ${url} → ${status}`)
    record(scope, /Acknowledge handover/i.test(text), `pending handover CTA ${/Acknowledge handover/i.test(text) ? 'visible' : 'MISSING'}`)
    record(scope, /Morning shift|Afternoon shift|Night shift/i.test(text), `shift period label ${/Morning shift|Afternoon shift|Night shift/i.test(text) ? 'visible' : 'MISSING'}`)
    await page.close()
  }

  // 2. SETTINGS — Start Handover + Handover History menu items
  {
    const scope = 'settings'
    const page = await browser.newPage()
    await page.setViewport({ width: 393, height: 852, deviceScaleFactor: 1, isMobile: true })
    const { url, status } = await gotoCase(page, '/settings', scope)
    const text = await page.evaluate(() => document.body.innerText || '')
    await page.screenshot({ path: path.join(screenshotsDir, 'settings.png'), fullPage: true })
    record(scope, status === 200, `GET ${url} → ${status}`)
    record(scope, /Start Handover/.test(text), `"Start Handover" menu ${/Start Handover/.test(text) ? 'present' : 'MISSING'}`)
    record(scope, /Handover History/.test(text), `"Handover History" menu ${/Handover History/.test(text) ? 'present' : 'MISSING'}`)
    await page.close()
  }

  // 3. HANDOVER ACK — picker, notes, defer, acknowledge button states
  {
    const scope = 'handover'
    const page = await browser.newPage()
    await page.setViewport({ width: 393, height: 852, deviceScaleFactor: 1, isMobile: true })
    const { url, status } = await gotoCase(page, '/handover', scope)
    let text = await page.evaluate(() => document.body.innerText || '')
    await page.screenshot({ path: path.join(screenshotsDir, 'handover-initial.png'), fullPage: true })
    record(scope, status === 200, `GET ${url} → ${status}`)
    record(scope, /Handing over to|ส่งต่อให้/.test(text), `caregiver picker section ${/Handing over to|ส่งต่อให้/.test(text) ? 'present' : 'MISSING'}`)
    record(scope, /Shift notes|บันทึกการส่งเวร/.test(text), `shift notes section ${/Shift notes|บันทึกการส่งเวร/.test(text) ? 'present' : 'MISSING'}`)
    record(scope, /Defer/.test(text), `defer control ${/Defer/.test(text) ? 'visible on pending items' : 'MISSING'}`)

    // Helper: find smallest tabindex=0 element whose textContent matches a regex
    async function clickTouchable(testRegex) {
      return page.evaluate((src) => {
        const re = new RegExp(src)
        const candidates = [...document.querySelectorAll('[tabindex="0"]')]
          .filter((el) => re.test(el.textContent || ''))
          .sort((a, b) => (a.textContent?.length ?? 0) - (b.textContent?.length ?? 0))
        const target = candidates[0]
        if (!target) return false
        target.scrollIntoView({ block: 'center' })
        const opts = { bubbles: true, cancelable: true, pointerType: 'mouse' }
        target.dispatchEvent(new PointerEvent('pointerdown', opts))
        target.dispatchEvent(new PointerEvent('pointerup', opts))
        target.dispatchEvent(new MouseEvent('click', opts))
        return true
      }, testRegex.source)
    }

    // Caregiver picker — click first ward caregiver row
    const careOk = await clickTouchable(/สมหญิง ใจดี/)
    await delay(500)
    await page.screenshot({ path: path.join(screenshotsDir, 'handover-after-pick.png'), fullPage: true })
    record(scope, careOk, careOk ? 'caregiver row click dispatched' : 'no caregiver button found')

    // Acknowledge enabled? RN Web disabled state surfaces as aria-disabled or pointer-events:none style
    const ackState = await page.evaluate(() => {
      const ackBtn = [...document.querySelectorAll('[tabindex="0"]')].find((b) => /^รับทราบ$/.test((b.textContent || '').trim()))
      if (!ackBtn) return { found: false }
      const aria = ackBtn.getAttribute('aria-disabled')
      const cs = window.getComputedStyle(ackBtn)
      return { found: true, ariaDisabled: aria, opacity: cs.opacity, pointerEvents: cs.pointerEvents }
    })
    const ackEnabled = ackState.found && ackState.ariaDisabled !== 'true' && parseFloat(ackState.opacity ?? '1') > 0.6
    record(scope, ackEnabled, ackEnabled ? `acknowledge enabled (opacity ${ackState.opacity})` : `acknowledge still disabled (opacity ${ackState.opacity ?? '?'}, aria-disabled ${ackState.ariaDisabled ?? '?'})`)

    // Type into notes textarea
    const textareaSelector = 'textarea, [contenteditable="true"]'
    const taHandle = await page.$(textareaSelector)
    if (taHandle) {
      await taHandle.click()
      await page.keyboard.type('QA test note: defer enalapril to evening', { delay: 8 })
      await delay(300)
      const taText = await page.evaluate((el) => el.value ?? el.textContent ?? '', taHandle)
      await page.screenshot({ path: path.join(screenshotsDir, 'handover-after-notes.png'), fullPage: true })
      record(scope, /defer enalapril/.test(taText), `notes input persisted ${/defer enalapril/.test(taText) ? 'OK' : 'BAD'}: "${taText.slice(0, 60)}"`)
    } else {
      record(scope, false, 'notes textarea not found')
    }

    // Quick-tap chips: verify presets are present, tap one, verify it appended
    const presetText = await page.evaluate(() => document.body.innerText || '')
    record(scope, /ทุกอย่างเรียบร้อย/.test(presetText), `preset chip "All clear" rendered: ${/ทุกอย่างเรียบร้อย/.test(presetText)}`)
    record(scope, /ปฏิเสธยา/.test(presetText), `preset chip "Refused" rendered: ${/ปฏิเสธยา/.test(presetText)}`)
    record(scope, /เสี่ยงล้ม/.test(presetText), `preset chip "Fall risk" rendered: ${/เสี่ยงล้ม/.test(presetText)}`)

    const presetClickOk = await page.evaluate(() => {
      const buttons = [...document.querySelectorAll('[tabindex="0"]')]
        .filter((b) => /ปฏิเสธยา/.test(b.textContent || ''))
        .sort((a, b) => (a.textContent?.length ?? 0) - (b.textContent?.length ?? 0))
      const target = buttons[0]
      if (!target) return false
      target.scrollIntoView({ block: 'center' })
      const opts = { bubbles: true, cancelable: true, pointerType: 'mouse' }
      target.dispatchEvent(new PointerEvent('pointerdown', opts))
      target.dispatchEvent(new PointerEvent('pointerup', opts))
      target.dispatchEvent(new MouseEvent('click', opts))
      return true
    })
    await delay(300)
    const taAfterPreset = taHandle ? await page.evaluate((el) => el.value ?? el.textContent ?? '', taHandle) : ''
    await page.screenshot({ path: path.join(screenshotsDir, 'handover-after-chip.png'), fullPage: true })
    record(scope, presetClickOk, presetClickOk ? 'preset chip click dispatched' : 'preset chip not clickable')
    record(scope, /ปฏิเสธยา/.test(taAfterPreset), `chip text appended into notes: ${/ปฏิเสธยา/.test(taAfterPreset)}`)
    record(scope, /defer enalapril.*\n.*ปฏิเสธยา/s.test(taAfterPreset), `appended on new line (preserved existing text): ${/defer enalapril.*\n.*ปฏิเสธยา/s.test(taAfterPreset)}`)

    // Clear button — should now be visible since notes has content
    const clearOk = await page.evaluate(() => {
      const buttons = [...document.querySelectorAll('[tabindex="0"]')]
        .filter((b) => /ล้าง.*Clear|Clear.*ล้าง/.test(b.textContent || ''))
      const target = buttons[0]
      if (!target) return false
      target.scrollIntoView({ block: 'center' })
      const opts = { bubbles: true, cancelable: true, pointerType: 'mouse' }
      target.dispatchEvent(new PointerEvent('pointerdown', opts))
      target.dispatchEvent(new PointerEvent('pointerup', opts))
      target.dispatchEvent(new MouseEvent('click', opts))
      return true
    })
    await delay(300)
    const taAfterClear = taHandle ? await page.evaluate((el) => el.value ?? el.textContent ?? '', taHandle) : 'NOTAVAIL'
    record(scope, clearOk, clearOk ? 'Clear button click dispatched' : 'Clear button not found (expected when notes empty)')
    record(scope, taAfterClear === '', `notes cleared to empty after Clear: ${JSON.stringify(taAfterClear).slice(0, 40)}`)

    // Click first Defer button — pick the touchable with shortest textContent containing "Defer"
    const deferOk = await page.evaluate(() => {
      const buttons = [...document.querySelectorAll('[tabindex="0"]')]
        .filter((b) => /Defer/.test(b.textContent || ''))
        .sort((a, b) => (a.textContent?.length ?? 0) - (b.textContent?.length ?? 0))
      const target = buttons[0]
      if (!target) return false
      target.scrollIntoView({ block: 'center' })
      const opts = { bubbles: true, cancelable: true, pointerType: 'mouse' }
      target.dispatchEvent(new PointerEvent('pointerdown', opts))
      target.dispatchEvent(new PointerEvent('pointerup', opts))
      target.dispatchEvent(new MouseEvent('click', opts))
      return true
    })
    await delay(600)
    const afterText = await page.evaluate(() => document.body.innerText || '')
    await page.screenshot({ path: path.join(screenshotsDir, 'handover-after-defer.png'), fullPage: true })
    record(scope, deferOk, deferOk ? 'defer button click dispatched' : 'no Defer button found')
    record(scope, /Deferred/.test(afterText), `defer toggle flipped to "Deferred" ${/Deferred/.test(afterText) ? 'OK' : 'NOT REFLECTED'}`)
    record(scope, /Will carry over to next shift/i.test(afterText), `defer side-message visible: ${/Will carry over to next shift/i.test(afterText)}`)

    await page.close()
  }

  // 4. ADD MEDICATION FORM
  {
    const scope = 'add-medication'
    const page = await browser.newPage()
    await page.setViewport({ width: 393, height: 852, deviceScaleFactor: 1, isMobile: true })
    const route = '/add-medication?patientId=pt-001&patientName=' + encodeURIComponent('สมชาย รักไทย')
    const { url, status } = await gotoCase(page, route, scope)
    const text = await page.evaluate(() => document.body.innerText || '')
    await page.screenshot({ path: path.join(screenshotsDir, 'add-medication-initial.png'), fullPage: true })
    record(scope, status === 200, `GET ${url} → ${status}`)
    record(scope, /Add Medication|เพิ่มยา/i.test(text), `header rendered`)
    record(scope, /สมชาย รักไทย/.test(text), `patient name chip "สมชาย รักไทย" visible`)
    record(scope, /morning|noon|evening|bedtime|เช้า|กลางวัน|เย็น|ก่อนนอน/i.test(text), `meal time options present`)

    // Save button — search ALL elements (disabled Pressable drops tabindex="0" in RN-Web)
    const saveStateInitial = await page.evaluate(() => {
      const all = [...document.querySelectorAll('*')]
      const candidates = all.filter((el) => /บันทึก/.test(el.textContent || '') && (el.textContent || '').length < 40)
        .sort((a, b) => (a.textContent?.length ?? 0) - (b.textContent?.length ?? 0))
      const labelEl = candidates[0]
      if (!labelEl) return { found: false }
      // Walk up to find the Pressable wrapper
      let wrap = labelEl
      while (wrap && wrap.parentElement) {
        if (wrap.getAttribute && (wrap.getAttribute('tabindex') !== null || wrap.getAttribute('aria-disabled') !== null)) break
        wrap = wrap.parentElement
      }
      const cs = wrap ? window.getComputedStyle(wrap) : null
      return {
        found: true,
        text: labelEl.textContent,
        tabindex: wrap?.getAttribute('tabindex') ?? null,
        ariaDisabled: wrap?.getAttribute('aria-disabled') ?? null,
        opacity: cs?.opacity ?? '1',
      }
    })
    record(scope, saveStateInitial.found, `Save CTA label found: "${saveStateInitial.text ?? '?'}"`)
    const initiallyNonInteractive = saveStateInitial.found && (
      saveStateInitial.tabindex !== '0' ||
      saveStateInitial.ariaDisabled === 'true' ||
      parseFloat(saveStateInitial.opacity) < 0.7
    )
    record(scope, initiallyNonInteractive, `Save NOT interactive before input: tabindex=${saveStateInitial.tabindex}, aria-disabled=${saveStateInitial.ariaDisabled}, opacity=${saveStateInitial.opacity}`)

    // Search for a medicine
    const searchInput = await page.$('input[type="text"], input:not([type])')
    if (searchInput) {
      await searchInput.click()
      await page.keyboard.type('แอมโลดิปีน', { delay: 8 })
      await delay(500)
      const searchResultText = await page.evaluate(() => document.body.innerText || '')
      record(scope, /แอมโลดิปีน/.test(searchResultText), `medicine search returned matching results`)

      // Pick the first medicine result
      const pickedOk = await page.evaluate(() => {
        const candidates = [...document.querySelectorAll('[tabindex="0"]')]
          .filter((b) => /แอมโลดิปีน/.test(b.textContent || ''))
          .sort((a, b) => (a.textContent?.length ?? 0) - (b.textContent?.length ?? 0))
        const target = candidates[0]
        if (!target) return false
        target.scrollIntoView({ block: 'center' })
        const opts = { bubbles: true, cancelable: true, pointerType: 'mouse' }
        target.dispatchEvent(new PointerEvent('pointerdown', opts))
        target.dispatchEvent(new PointerEvent('pointerup', opts))
        target.dispatchEvent(new MouseEvent('click', opts))
        return true
      })
      await delay(400)
      record(scope, pickedOk, pickedOk ? 'medicine selected' : 'could not click medicine result')
    } else {
      record(scope, false, 'medicine search input not found')
    }

    // Pick a meal time chip (morning)
    const mealOk = await page.evaluate(() => {
      const candidates = [...document.querySelectorAll('[tabindex="0"]')]
        .filter((b) => /^(morning|เช้า|🌅 เช้า|เช้า \/ Morning|Morning)$/i.test((b.textContent || '').trim()) || /\bMorning\b/i.test(b.textContent || '') && (b.textContent || '').length < 25)
        .sort((a, b) => (a.textContent?.length ?? 0) - (b.textContent?.length ?? 0))
      const target = candidates[0]
      if (!target) return false
      target.scrollIntoView({ block: 'center' })
      const opts = { bubbles: true, cancelable: true, pointerType: 'mouse' }
      target.dispatchEvent(new PointerEvent('pointerdown', opts))
      target.dispatchEvent(new PointerEvent('pointerup', opts))
      target.dispatchEvent(new MouseEvent('click', opts))
      return true
    })
    await delay(400)
    record(scope, mealOk, mealOk ? 'meal time chip clicked' : 'meal time chip not found')

    await page.screenshot({ path: path.join(screenshotsDir, 'add-medication-filled.png'), fullPage: true })

    // Save should now be enabled
    const saveStateAfter = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('[tabindex="0"]')].find((b) => /^(บันทึก|Save)( \/.*)?$/.test((b.textContent || '').trim()))
      if (!btn) return { found: false }
      const cs = window.getComputedStyle(btn)
      return { found: true, ariaDisabled: btn.getAttribute('aria-disabled'), opacity: cs.opacity }
    })
    const saveEnabledAfter = saveStateAfter.found && saveStateAfter.ariaDisabled !== 'true' && parseFloat(saveStateAfter.opacity ?? '1') > 0.7
    record(scope, saveEnabledAfter, `Save enabled after medicine + meal time: ${saveEnabledAfter} (opacity ${saveStateAfter.opacity})`)

    await page.close()
  }

  // 5. HANDOVER HISTORY
  {
    const scope = 'handover-history'
    const page = await browser.newPage()
    await page.setViewport({ width: 393, height: 852, deviceScaleFactor: 1, isMobile: true })
    const { url, status } = await gotoCase(page, '/handover-history', scope)
    const text = await page.evaluate(() => document.body.innerText || '')
    await page.screenshot({ path: path.join(screenshotsDir, 'handover-history.png'), fullPage: true })
    record(scope, status === 200, `GET ${url} → ${status}`)
    record(scope, /Handover History/.test(text), `header rendered ${/Handover History/.test(text) ? 'OK' : 'MISSING'}`)
    record(scope, /Acknowledged/.test(text), `acknowledged-badge present ${/Acknowledged/.test(text) ? 'OK' : 'MISSING'}`)
    record(scope, /pending dose|ค้าง/i.test(text) || /Notes/i.test(text), `at least one row shows pending count or notes`)
    record(scope, (text.match(/Acknowledged/g) ?? []).length >= 2, `expected ≥2 history rows, found ${(text.match(/Acknowledged/g) ?? []).length}`)
    await page.close()
  }
} finally {
  await browser.close()
}

const passed = findings.filter((f) => f.ok).length
const failed = findings.length - passed
const lines = [
  '# Handover Feature QA',
  '',
  `Run: ${new Date().toISOString()}`,
  `Base URL: ${baseUrl}`,
  '',
  `**Result:** ${passed} pass / ${failed} fail (${findings.length} total)`,
  '',
  '## Checks',
  '',
  '| Scope | Result | Detail |',
  '| --- | --- | --- |',
  ...findings.map((f) => `| ${f.scope} | ${f.ok ? '✅ PASS' : '❌ FAIL'} | ${f.detail} |`),
  '',
  '## Console errors',
  '',
  consoleErrors.length === 0
    ? '_None._'
    : consoleErrors.map((e) => `- (${e.scope}/${e.type}) ${e.text}`).join('\n'),
  '',
  '## Screenshots',
  '',
  '- tests/visual-qa/app/home.png',
  '- tests/visual-qa/app/settings.png',
  '- tests/visual-qa/app/handover-initial.png',
  '- tests/visual-qa/app/handover-after-pick.png',
  '- tests/visual-qa/app/handover-after-notes.png',
  '- tests/visual-qa/app/handover-after-defer.png',
  '- tests/visual-qa/app/handover-history.png',
  '',
]
fs.writeFileSync(path.join(reportDir, 'handover-qa.md'), lines.join('\n'))

console.log(`\n${passed}/${findings.length} checks passed; ${failed} failed.`)
console.log(`Report: tests/visual-qa/report/handover-qa.md`)

if (failed > 0) process.exit(1)
