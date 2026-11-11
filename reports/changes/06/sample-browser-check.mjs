// MF-SC-10/11. External Playwright is an evidence tool, not an app dependency.
// node this-file --playwright /absolute/path/to/playwright --origin http://127.0.0.1:5196 --output output/material-samples
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, writeFile, readFile } from 'node:fs/promises'
import { resolve, relative } from 'node:path'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'

const args = Object.fromEntries(Array.from({ length: (process.argv.length - 2) / 2 }, (_, i) => [process.argv[2 + 2 * i], process.argv[3 + 2 * i]]))
const { chromium } = createRequire(import.meta.url)(args['--playwright'] ?? 'playwright')
const origin = args['--origin'] ?? 'http://127.0.0.1:5196'
assert.match(origin, /^http:\/\/127\.0\.0\.1:\d+$/)
const output = resolve(args['--output'] ?? 'output/material-samples')
await mkdir(output, { recursive: true })
await mkdir('output/material-samples-tool', { recursive: true })
const extension = resolve('output/material-samples-tool/extension')
await mkdir(extension, { recursive: true })
await writeFile(resolve(extension, 'manifest.json'), JSON.stringify({ manifest_version: 3, name: 'Local sample zoom evidence', version: '1.0', permissions: ['tabs'], host_permissions: ['http://127.0.0.1/*'], background: { service_worker: 'worker.js' } }))
await writeFile(resolve(extension, 'worker.js'), 'chrome.runtime.onInstalled.addListener(() => {});')
const profile = await mkdtemp(resolve('output/material-samples-tool/profile-'))
const context = await chromium.launchPersistentContext(profile, { channel: 'chromium', headless: true, args: ['--disable-extensions-except=' + extension, '--load-extension=' + extension] })
const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker')
const source = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const sourceFiles = ['frontend/src/samples/MaterialSamples.tsx', 'frontend/src/samples/material-samples.css', 'frontend/src/samples/main.tsx', 'frontend/src/sample-theme.css', 'frontend/vite.config.ts', 'scripts/check-sample-isolation.mjs', 'reports/changes/06/sample-browser-check.mjs']
const sourceDirty = !!execFileSync('git', ['status', '--porcelain', '--', ...sourceFiles], { encoding: 'utf8' }).trim()
const manifest = { source, sourceDirty, browser: context.browser().version(), executedAt: new Date().toISOString(), executor: 'gjj6666（小葛），AI 辅助', sourceType: 'isolated synthetic samples; no authentication/material API', files: {}, cases: [], interactions: [], contrast: [], apiRequests: [], pageErrors: [] }
for (const file of sourceFiles) manifest.files[file] = { algorithm: 'sha256', digest: createHash('sha256').update(await readFile(file)).digest('hex') }
const contrastSeen = new Set()
try {
  for (const [width, zoom] of [[360, 1], [1440, 1], [767, 1], [768, 1], [360, 2], [1440, 2]]) {
    const height = width === 1440 ? 900 : 800
    const page = await context.newPage()
    await page.setViewportSize({ width, height })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    page.on('pageerror', error => manifest.pageErrors.push(error.message))
    await page.route('**/api/**', route => { manifest.apiRequests.push(route.request().method() + ' ' + new URL(route.request().url()).pathname); return route.abort() })
    await page.goto(origin + '/samples.html?page=materials')
    await page.bringToFront()
    const actualZoom = await worker.evaluate(async ({ origin, zoom }) => {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
      const tab = tabs.find(item => item.url?.startsWith(origin))
      if (!tab) throw new Error('Local sample tab missing')
      await chrome.tabs.setZoom(tab.id, zoom)
      return chrome.tabs.getZoom(tab.id)
    }, { origin, zoom })
    assert.equal(actualZoom, zoom)
    const cdp = await context.newCDPSession(page)
    const views = width === 767 || width === 768 ? ['teacher-list', 'teacher-detail', 'student-list'] : zoom === 2 ? ['teacher-list', 'teacher-detail', 'student-list'] : ['teacher-list', 'teacher-detail', 'student-list', 'student-detail']
    for (const view of views) {
      for (const variant of width === 767 || width === 768 ? ['normal'] : ['normal', 'loading', 'empty', 'error', 'short']) {
        const state = variant === 'short' ? 'normal' : variant
        const role = view.startsWith('teacher') ? 'teacher' : 'student'
        const detail = view.endsWith('detail')
        const long = variant === 'normal' || state === 'error'
        const url = `${origin}/samples.html?page=${detail ? 'material-detail' : 'materials'}&role=${role}&state=${state}${long ? '&long=1' : ''}`
        await page.goto(url)
        await page.locator('main h1').waitFor()
        // Wait for native zoom reflow; setZoom completion alone is insufficient.
        await page.waitForFunction(({ width, zoom }) => Math.abs(document.documentElement.clientWidth - width / zoom) <= 1 && Math.abs(devicePixelRatio - zoom) < .01, { width, zoom })
        assert.equal(await page.locator('h1').count(), 1)
        assert.equal(await page.locator('nav [aria-current="page"]').innerText(), '资料')
        const metrics = await page.evaluate(() => ({ layoutWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, dpr: devicePixelRatio, visualScale: visualViewport.scale }))
        assert.ok(metrics.scrollWidth <= metrics.layoutWidth, `Horizontal overflow: ${view}/${state}/${width}/${zoom}`)
        if (state === 'normal' && !detail) {
          assert.equal(await page.locator('.material-list li').count(), role === 'teacher' ? 3 : 1)
          assert.equal(await page.getByRole('button', { name: '上传资料', exact: true }).count(), role === 'teacher' ? 1 : 0)
          if (long) assert.equal(await page.locator('.material-record-title>a').first().evaluate(el => [...el.textContent].length), 200)
        }
        if (state === 'normal' && detail) {
          if (long) assert.equal(await page.locator('h1').evaluate(el => [...el.textContent].length), 200)
          assert.ok((await page.locator('.material-body').innerText()).includes('𠮷、📚'))
          assert.equal(await page.locator('.material-body script,.material-body img').count(), 0)
          assert.equal(await page.getByRole('button', { name: '重新处理', exact: true }).count(), role === 'teacher' ? 1 : 0)
        }
        if (state === 'error') assert.equal(await page.locator('.error-message').evaluate(el => [...el.textContent].length), 256)
        if (state === 'empty' && detail) assert.match(await page.locator('[role=alert]').innerText(), /空正文/)
        if (state === 'empty' && !detail) assert.match(await page.locator('.material-state').innerText(), role === 'teacher' ? /上传资料/ : /等待任课教师/)
        if (state === 'loading') assert.match(await page.locator('.material-state').innerText(), /正在加载资料/)
        const colors = await page.locator('main p, main a, main h1, main h2, main label, main button, main input, .material-status, .topbar span, nav a').evaluateAll(elements => {
          const background = el => { for (let node = el; node; node = node.parentElement) { const color = getComputedStyle(node).backgroundColor; if (color !== 'transparent' && color !== 'rgba(0, 0, 0, 0)') return color } return 'rgb(255, 255, 255)' }
          const luminance = color => color.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => { value /= 255; return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4 }).reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0)
          return elements.filter(el => el.getClientRects().length && (el.textContent.trim() || el.tagName === 'INPUT')).map(el => {
            const css = getComputedStyle(el), bg = background(el), fg = css.color
            const lum = [luminance(fg), luminance(bg)].sort((a, b) => b - a)
            return { foreground: fg, background: bg, ratio: (lum[0] + .05) / (lum[1] + .05) }
          })
        })
        for (const color of colors) { assert.ok(color.ratio >= 4.5, JSON.stringify(color)); const key = JSON.stringify(color); if (!contrastSeen.has(key)) { contrastSeen.add(key); manifest.contrast.push(color) } }
        const name = `${view}-${variant}-${width}-zoom${zoom}.png`
        if (zoom === 2) { const shot = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true }); await writeFile(resolve(output, name), Buffer.from(shot.data, 'base64')) }
        else await page.screenshot({ path: resolve(output, name), fullPage: true })
        manifest.cases.push({ view, role, state, long, url, width, height, nativeZoom: actualZoom, ...metrics, screenshot: name })
        if (state === 'normal' && detail && role === 'teacher') {
          await page.getByRole('button', { name: '重新处理', exact: true }).scrollIntoViewIfNeeded()
          const actionName = name.replace('.png', '-action.png')
          const shot = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true })
          await writeFile(resolve(output, actionName), Buffer.from(shot.data, 'base64'))
          manifest.cases.push({ view, role, state, url, width, height, nativeZoom: actualZoom, ...metrics, screenshot: actionName, scrolledTo: '重新处理' })
          await page.getByRole('button', { name: '重新处理', exact: true }).click()
          assert.match(await page.locator('.material-notice').innerText(), /未发送服务端请求/)
        }
      }
    }
    // Keyboard search, validation focus, empty result, clear, role-aware detail navigation.
    await page.goto(`${origin}/samples.html?page=materials&role=teacher`)
    const boundary = await page.getByLabel('关键词', { exact: true }).evaluate(el => {
      const css = getComputedStyle(el), placeholder = getComputedStyle(el, '::placeholder')
      return { border: css.borderTopColor, background: css.backgroundColor, borderWidth: css.borderTopWidth, placeholder: placeholder.color }
    })
    function contrastRatio(foreground, background) {
      const luminance = color => color.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => { value /= 255; return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4 }).reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0)
      const lum = [luminance(foreground), luminance(background)].sort((a, b) => b - a)
      return (lum[0] + .05) / (lum[1] + .05)
    }
    assert.ok(contrastRatio(boundary.border, boundary.background) >= 3)
    assert.ok(contrastRatio(boundary.placeholder, boundary.background) >= 4.5)
    for (const interaction of ['default', 'hover', 'pressed', 'focus', 'disabled']) {
      const primary = page.getByRole('button', { name: '上传资料', exact: true })
      if (interaction === 'hover' || interaction === 'pressed') await primary.hover()
      if (interaction === 'pressed') await page.mouse.down()
      if (interaction === 'focus') { await page.mouse.up(); await primary.focus() }
      if (interaction === 'disabled') await primary.evaluate(el => { el.disabled = true })
      const colors = await primary.evaluate(el => { const css = getComputedStyle(el); return { foreground: css.color, background: css.backgroundColor } })
      const ratio = contrastRatio(colors.foreground, colors.background)
      assert.ok(ratio >= 4.5)
      manifest.contrast.push({ interaction, width, zoom, ...colors, ratio })
    }
    await page.getByLabel('关键词', { exact: true }).focus()
    await page.keyboard.press('Enter')
    await page.waitForFunction(() => document.activeElement?.id === 'material-query-error')
    await page.getByLabel('关键词', { exact: true }).fill('不存在的合成资料')
    await page.keyboard.press('Enter')
    await page.waitForFunction(() => document.activeElement?.tagName === 'H2')
    assert.match(await page.locator('.material-state').innerText(), /没有找到匹配资料/)
    assert.equal(new URL(page.url()).searchParams.has('q'), false)
    await page.getByRole('button', { name: '清除', exact: true }).click()
    assert.equal(await page.locator('.material-list li').count(), 3)
    await page.locator('.material-record-title>a').last().focus()
    await page.keyboard.press('Enter')
    await page.getByRole('button', { name: '重新处理', exact: true }).waitFor()
    assert.equal(await page.locator('h1').innerText(), '实验步骤与记录方法')
    await page.getByRole('button', { name: '下载原文件', exact: true }).focus()
    await page.keyboard.press('Shift+Tab')
    await page.keyboard.press('Tab')
    const focus = await page.evaluate(() => {
      const el = document.activeElement, css = getComputedStyle(el)
      let background = 'rgb(255, 255, 255)'
      for (let node = el.parentElement; node; node = node.parentElement) { const color = getComputedStyle(node).backgroundColor; if (color !== 'transparent' && color !== 'rgba(0, 0, 0, 0)') { background = color; break } }
      return { text: el.textContent, color: css.outlineColor, width: css.outlineWidth, style: css.outlineStyle, background }
    })
    assert.equal(focus.text, '下载原文件'); assert.equal(focus.width, '2px'); assert.equal(focus.style, 'solid')
    await page.keyboard.press('Enter')
    assert.match(await page.locator('.material-notice').innerText(), /未发送服务端请求/)
    const focusRatio = contrastRatio(focus.color, focus.background)
    assert.ok(focusRatio >= 3)
    manifest.interactions.push({ width, height, zoom, checks: ['invalid query focuses summary', 'Enter submits query', 'empty differs from error', 'clear returns first page', 'query absent from route', 'Enter follows selected detail', 'Shift+Tab/Tab visible focus', 'Enter activates sample-only download'], focus: { ...focus, ratio: focusRatio }, boundary: { ...boundary, borderRatio: contrastRatio(boundary.border, boundary.background), placeholderRatio: contrastRatio(boundary.placeholder, boundary.background) } })
    await page.close()
  }
  assert.deepEqual(manifest.apiRequests, [])
  assert.deepEqual(manifest.pageErrors, [])
  manifest.result = 'pass'
} catch (error) {
  manifest.result = 'fail'; manifest.error = error.stack; throw error
} finally {
  await writeFile(resolve(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
  await context.close()
  console.log(JSON.stringify({ result: manifest.result, source, sourceDirty, cases: manifest.cases.length, output: relative(process.cwd(), output), apiRequests: manifest.apiRequests.length, browser: manifest.browser }))
}
