// DI-SC-13: synthetic UI only. External Playwright is an evidence tool, never an app dependency.
// node this-file --playwright ABS_MODULE --browser ABS_CHROME --origin http://127.0.0.1:5198 --output output/document-samples
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'

const args = Object.fromEntries(Array.from({ length: (process.argv.length - 2) / 2 }, (_, i) => [process.argv[2 + 2 * i], process.argv[3 + 2 * i]]))
const require = createRequire(import.meta.url)
const { chromium } = require(args['--playwright'] ?? 'playwright')
const origin = args['--origin'] ?? 'http://127.0.0.1:5198'
assert.match(origin, /^http:\/\/127\.0\.0\.1:\d+$/)
const output = resolve(args['--output'] ?? 'output/document-samples')
await mkdir(output, { recursive: true })
await mkdir('output/document-sample-tool', { recursive: true })
const extension = resolve('output/document-sample-tool/extension')
await mkdir(extension, { recursive: true })
await writeFile(resolve(extension, 'manifest.json'), JSON.stringify({ manifest_version: 3, name: 'Local document sample zoom', version: '1.0', permissions: ['tabs'], host_permissions: ['http://127.0.0.1/*'], background: { service_worker: 'worker.js' } }))
await writeFile(resolve(extension, 'worker.js'), 'chrome.runtime.onInstalled.addListener(() => {});')
const profile = await mkdtemp(resolve('output/document-sample-tool/profile-'))
const context = await chromium.launchPersistentContext(profile, { executablePath: args['--browser'], channel: args['--browser'] ? undefined : 'chromium', headless: true, args: ['--disable-extensions-except=' + extension, '--load-extension=' + extension] })
const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker')
const git = a => execFileSync('git', a, { encoding: 'utf8' }).trim()
const sources = ['frontend/src/samples/DocumentSamples.tsx', 'frontend/src/samples/document-samples.css', 'frontend/src/samples/MaterialSamples.tsx', 'frontend/src/samples/material-samples.css', 'frontend/src/samples/main.tsx', 'frontend/src/sample-theme.css', 'frontend/vite.config.ts', 'scripts/check-sample-isolation.mjs', 'reports/changes/04E/document-sample-browser-check.mjs']
const fingerprint = async () => Object.fromEntries(await Promise.all(sources.map(async name => [name, createHash('sha256').update(await readFile(name)).digest('hex')])))
const inputs = await fingerprint()
const manifest = { time: new Date().toISOString(), source: git(['rev-parse', 'HEAD']), dirty: !!git(['status', '--porcelain', '--', ...sources]), inputs, browser: context.browser().version(), playwright: require((args['--playwright'] ?? 'playwright') + '/package.json').version, platform: process.platform, node: process.version, scope: 'DI-SC-13 visual and synthetic interaction evidence; no real auth/upload/parsing or server authorization claim', cases: [], actionCases: [], interactions: [], contrast: [], apiRequests: [], pageErrors: [] }
function ratio(fg, bg) {
  const lum = color => color.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4 }).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0)
  const values = [lum(fg), lum(bg)].sort((a, b) => b - a)
  return (values[0] + .05) / (values[1] + .05)
}
const seen = new Set()
const makeUrl = (page, role = 'teacher', state = 'normal', extra = '') => `${origin}/samples.html?page=${page}&role=${role}&state=${state}${extra}`
const page = await context.newPage()
const cdp = await context.newCDPSession(page)
page.on('pageerror', error => manifest.pageErrors.push(error.message))
// Fail any non-static network: samples must not call current or frozen APIs, health or external services.
await page.route('**/*', route => {
  const request = route.request(), target = new URL(request.url())
  const staticPath = ['/samples.html', '/@vite/client', '/@react-refresh', '/favicon.ico'].includes(target.pathname) || ['/src/', '/node_modules/', '/@id/'].some(prefix => target.pathname.startsWith(prefix))
  if (target.origin !== origin || !['GET', 'HEAD'].includes(request.method()) || !staticPath) {
    manifest.apiRequests.push(request.method() + ' ' + target.origin + target.pathname)
    return route.abort()
  }
  return route.continue()
})
async function open(url) { await page.goto(url); await page.locator('main h1').waitFor() }
try {
  for (const [width, zoom] of [[360, 1], [1440, 1], [767, 1], [768, 1], [360, 2], [1440, 2]]) {
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 800 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await open(makeUrl('documents'))
    await page.bringToFront()
    const nativeZoom = await worker.evaluate(async ({ origin, zoom }) => {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
      const tab = tabs.find(item => item.url?.startsWith(origin))
      if (!tab) throw new Error('Local sample tab missing')
      await chrome.tabs.setZoom(tab.id, zoom)
      return chrome.tabs.getZoom(tab.id)
    }, { origin, zoom })
    assert.equal(nativeZoom, zoom)
    const breakpoint = width === 767 || width === 768
    for (const view of ['documents', 'document-upload', 'document-detail']) {
      for (const role of breakpoint || zoom === 2 ? ['teacher'] : ['teacher', 'student']) {
        for (const state of breakpoint ? ['normal'] : ['normal', 'loading', 'empty', 'error']) {
          const extra = zoom === 2 || state === 'error' ? '&long=1' : ''
          const url = makeUrl(view, role, state, extra)
          await open(url)
          await page.waitForFunction(({ width, zoom }) => Math.abs(document.documentElement.clientWidth - width / zoom) <= 1 && Math.abs(devicePixelRatio - zoom) < .01, { width, zoom })
          assert.equal(await page.locator('h1').count(), 1)
          const metrics = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, dpr: devicePixelRatio, workspace: getComputedStyle(document.querySelector('.workspace')).display }))
          assert.ok(metrics.scrollWidth <= metrics.width, `Horizontal overflow: ${view}/${role}/${state}/${width}/${zoom}`)
          assert.equal(metrics.workspace, width / zoom < 768 ? 'block' : 'grid')
          if (state === 'normal' && view === 'documents') {
            assert.equal(await page.locator('.document-list>li').count(), role === 'teacher' ? 8 : 2, 'Students see only ready records in sample')
            assert.equal(await page.getByRole('link', { name: '上传资料', exact: true }).count(), role === 'teacher' ? 1 : 0)
            if (zoom === 2) assert.equal(await page.locator('.document-record-title').first().evaluate(el => [...el.textContent].length), 200)
          }
          if (state === 'normal' && view === 'document-detail') {
            assert.equal(await page.locator('.document-source').count(), 3)
            assert.equal(await page.locator('.document-body script,.document-body img').count(), 0)
            assert.match(await page.locator('.document-body').innerText(), /𠮷与📚/)
            if (zoom === 2) assert.equal(await page.locator('h1').evaluate(el => [...el.textContent].length), 200)
          }
          if (view === 'document-upload' && role === 'student') assert.equal(await page.locator('form').count(), 0)
          if (state === 'loading' && !(view === 'document-upload' && role === 'student')) {
            assert.match(await page.locator('main').innerText(), /正在加载|正在提交/)
            if (view === 'document-upload') assert.equal(await page.locator('input:disabled').count(), 2)
          }
          if (state === 'error' && !(view === 'document-upload' && role === 'student')) assert.match(await page.locator('.error-message').last().innerText(), /资料暂时无法加载/)
          const colors = await page.locator('main p,main a,main h1,main h2,main h3,main button,main input,main label,.document-status,.document-format,.document-meta>span,.topbar span,.workspace>nav a,.workspace>nav button').evaluateAll(elements => {
            const background = el => { for (let n = el; n; n = n.parentElement) { const c = getComputedStyle(n).backgroundColor; if (c !== 'transparent' && c !== 'rgba(0, 0, 0, 0)') return c } return 'rgb(255, 255, 255)' }
            return elements.filter(el => el.getClientRects().length && (el.textContent.trim() || el.tagName === 'INPUT')).map(el => ({ foreground: getComputedStyle(el).color, background: background(el) }))
          })
          for (const color of colors) { const value = ratio(color.foreground, color.background); assert.ok(value >= 4.5, JSON.stringify({ ...color, value })); const key = JSON.stringify(color); if (!seen.has(key)) { seen.add(key); manifest.contrast.push({ ...color, ratio: value }) } }
          const name = `${view}-${role}-${state}-${width}-zoom${zoom}.png`
          // Native zoom + Playwright fullPage clips physical pixels; retain the
          // actual browser viewport at 200%, as in the accepted 06 harness.
          if (zoom === 2) {
            const shot = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true })
            await writeFile(resolve(output, name), Buffer.from(shot.data, 'base64'))
          } else await page.screenshot({ path: resolve(output, name), fullPage: true })
          manifest.cases.push({ view, role, state, url, viewportWidth: width, nativeZoom, ...metrics, screenshot: name })
          if (zoom === 2 && state === 'normal') {
            const control = view === 'documents' ? page.getByLabel('关键词', { exact: true }) : view === 'document-upload' ? page.getByRole('button', { name: '上传资料', exact: true }) : page.getByRole('button', { name: '下载原文件', exact: true })
            await control.focus()
            // Center explicitly: nearest scrolling can leave a fractional CSS
            // pixel outside a natively zoomed viewport after device rounding.
            await control.evaluate(el => new Promise(done => { el.scrollIntoView({ block: 'center', inline: 'nearest' }); requestAnimationFrame(() => requestAnimationFrame(done)) }))
            const rect = await control.evaluate(el => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, height: r.height, layoutWidth: document.documentElement.clientWidth, layoutHeight: document.documentElement.clientHeight } })
            assert.ok(rect.left >= 0 && rect.right <= rect.layoutWidth && rect.top >= 0 && rect.bottom <= rect.layoutHeight && rect.height >= 44, JSON.stringify(rect))
            const shot = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true })
            const screenshot = name.replace('.png', '-action.png')
            await writeFile(resolve(output, screenshot), Buffer.from(shot.data, 'base64'))
            manifest.actionCases.push({ view, url, viewportWidth: width, nativeZoom, rect, screenshot })
          }
        }
      }
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 })
  await worker.evaluate(async () => { const tabs = await chrome.tabs.query({ active: true, currentWindow: true }); await chrome.tabs.setZoom(tabs[0].id, 1) })
  await open(makeUrl('documents'))
  const field = page.getByLabel('关键词', { exact: true })
  const boundary = await field.evaluate(el => { const css = getComputedStyle(el); return { border: css.borderTopColor, background: css.backgroundColor, placeholder: getComputedStyle(el, '::placeholder').color } })
  assert.ok(ratio(boundary.border, boundary.background) >= 3)
  assert.ok(ratio(boundary.placeholder, boundary.background) >= 4.5)
  await field.fill('导数'); await field.focus(); await page.keyboard.press('Tab')
  assert.equal(await page.evaluate(() => document.activeElement.textContent), '搜索')
  await page.keyboard.press('Shift+Tab')
  assert.equal(await page.evaluate(() => document.activeElement.id), 'document-query')
  const focus = await field.evaluate(el => { const css = getComputedStyle(el); return { color: css.outlineColor, width: css.outlineWidth, style: css.outlineStyle, background: css.backgroundColor } })
  assert.equal(focus.width, '2px'); assert.equal(focus.style, 'solid'); assert.ok(ratio(focus.color, focus.background) >= 3)
  manifest.contrast.push({ control: 'keyword', ...boundary, focus })
  await field.fill('')
  await field.focus(); await page.keyboard.press('Enter')
  await page.waitForFunction(() => document.activeElement?.id === 'document-query-error')
  assert.match(await page.locator('[role=alert]').innerText(), /1–2000/)
  await field.fill('𠮷'.repeat(2001)); await page.keyboard.press('Enter')
  assert.match(await page.locator('[role=alert]').innerText(), /1–2000/)
  await field.fill('𠮷'.repeat(2000)); await page.keyboard.press('Enter')
  await page.waitForFunction(() => document.activeElement?.tagName === 'H2')
  assert.equal(await page.locator('[role=alert]').innerText(), '')
  assert.match(await page.locator('.material-results').innerText(), /没有找到匹配资料/)
  await page.getByRole('button', { name: '清除', exact: true }).click()
  await field.fill('瞬时变化率'); await page.keyboard.press('Enter')
  assert.equal(await page.locator('.document-hit').count(), 2)
  await page.getByRole('link', { name: '查看原文页', exact: true }).click()
  await page.locator('#source-2').waitFor()
  assert.ok(page.url().endsWith('#source-2'))
  assert.match(await page.locator('#source-2').innerText(), /瞬时变化率/)
  await open(makeUrl('document-detail', 'student', 'normal', '&document=9223372036854775802'))
  assert.match(await page.locator('h1').innerText(), /找不到这份资料/)
  assert.equal(await page.locator('.document-process,.document-body').count(), 0)
  manifest.interactions.push('keyboard search, empty/+2001 rejection/+2000 Unicode boundary, source2 fragment navigation, student nonready refusal')
  for (const [id, expected, retry] of [['9223372036854775804', '等待解析', false], ['9223372036854775803', '正在解析', false], ['9223372036854775802', '文字识别功能尚未接入', false], ['9223372036854775801', '解析未能在时限内完成', true], ['9223372036854775800', '文件受密码保护', false], ['9223372036854775799', '已达到 3 次解析上限', false]]) {
    await open(makeUrl('document-detail', 'teacher', 'normal', '&document=' + id))
    assert.match(await page.locator('.document-process').innerText(), new RegExp(expected))
    assert.equal(await page.getByRole('button', { name: '重试解析', exact: true }).count(), retry ? 1 : 0)
    if (retry) { await page.getByRole('button', { name: '重试解析', exact: true }).focus(); await page.keyboard.press('Enter'); assert.match(await page.locator('.material-notice').innerText(), /未提交解析任务/) }
    await page.screenshot({ path: resolve(output, `status-${id}.png`), fullPage: true })
    manifest.interactions.push('status ' + id + ': retry=' + retry)
  }
  await open(makeUrl('document-detail', 'teacher', 'normal', '&document=9223372036854775805'))
  assert.match(await page.locator('.document-body').innerText(), /逻辑块 1/)
  assert.doesNotMatch(await page.locator('.document-body').innerText(), /第 [123] 页/)
  await page.screenshot({ path: resolve(output, 'word-logical-blocks.png'), fullPage: true })
  manifest.interactions.push('DOCX logical blocks without fabricated page numbers')
  await open(makeUrl('document-upload', 'teacher', 'error'))
  const title = page.getByLabel('资料标题（必填）', { exact: true }), file = page.getByLabel('资料文件（必填）', { exact: true }), upload = page.getByRole('button', { name: '上传资料', exact: true })
  await upload.click(); await page.waitForFunction(() => document.activeElement?.id === 'document-form-error')
  assert.match(await page.locator('#document-form-error').innerText(), /资料标题/)
  await title.fill('𠮷'.repeat(201)); await upload.click(); assert.match(await page.locator('#document-form-error').innerText(), /资料标题/)
  await title.fill('𠮷'.repeat(200)); await upload.click(); assert.match(await page.locator('#document-form-error').innerText(), /请选择/)
  await title.focus(); await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => document.activeElement.id), 'document-file')
  await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => document.activeElement.textContent), '上传资料')
  await file.setInputFiles({ name: 'macro.docm', mimeType: 'application/octet-stream', buffer: Buffer.from('fixture') }); await upload.click(); assert.match(await page.locator('#document-form-error').innerText(), /不支持/)
  await file.setInputFiles({ name: 'empty.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(0) }); await upload.click(); assert.match(await page.locator('#document-form-error').innerText(), /1 字节至 10 MiB/)
  await file.setInputFiles({ name: 'oversize.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(10485761) }); await upload.click(); assert.match(await page.locator('#document-form-error').innerText(), /1 字节至 10 MiB/)
  await file.setInputFiles({ name: 'boundary.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(10485760) }); await upload.click()
  assert.equal(await page.locator('.document-preview').count(), 1)
  assert.equal(await page.locator('form .error-message').count(), 0)
  assert.match(await page.locator('.material-notice').innerText(), /未读取或上传文件/)
  assert.equal(await title.inputValue(), '𠮷'.repeat(200))
  await page.screenshot({ path: resolve(output, 'upload-preview-boundary.png'), fullPage: true })
  manifest.interactions.push('upload title 200/201 Unicode, absent/unsupported/zero/10MiB+1/10MiB file metadata, retained input, no fake success or network')
  assert.deepEqual(manifest.apiRequests, [])
  assert.deepEqual(manifest.pageErrors, [])
  assert.deepEqual(await fingerprint(), inputs, 'UI sources changed during browser check')
  manifest.exit_code = 0
} catch (error) {
  manifest.exit_code = 1
  manifest.error = error.message
  try { await page.screenshot({ path: resolve(output, 'failure.png'), fullPage: true }) } catch {}
  throw error
} finally {
  await context.close()
  manifest.finished_at = new Date().toISOString()
  await writeFile(resolve(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
}
console.log(`DI-SC-13: ${manifest.cases.length} visual cases, ${manifest.actionCases.length} native-200% reachable-action cases, ${manifest.interactions.length} interaction groups, no API requests.`)
