import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'

const require = createRequire(import.meta.url)
const { chromium } = require('D:/zwh/ProSoftware/python/Lib/site-packages/playwright/driver/package')
const origin = process.env.AUTH_TEST_ORIGIN ?? 'http://127.0.0.1:5195'
const output = process.env.AUTH_TEST_OUTPUT ?? 'output/verification/auth-browser'
const extension=resolve('output/verification/reviewer/native-zoom-extension')
const browser=await chromium.launchPersistentContext('',{channel:'chromium',headless:true,args:['--disable-extensions-except='+extension,'--load-extension='+extension]})
const worker=browser.serviceWorkers()[0] ?? await browser.waitForEvent('serviceworker')
const version = browser.browser().version()
async function zoom(){return worker.evaluate(async origin=>{const tabs=await chrome.tabs.query({});const tab=tabs.find(t=>t.url?.startsWith(origin));if(!tab)throw new Error('Acceptance tab missing');await chrome.tabs.setZoom(tab.id,2);return chrome.tabs.getZoom(tab.id)},origin)}
const manifest = []
const requestId = 'a'.repeat(32)
const error = (code) => ({ error: { code, message: '合'.repeat(256), fields: [], details: null }, request_id: requestId })
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const sourceDirty = !!execFileSync('git', ['status', '--porcelain', '--', 'frontend/src'], { encoding: 'utf8' }).trim()

try {
  await mkdir(output, { recursive: true })
  for (const width of [360, 1440]) {
    const height = width === 1440 ? 900 : 800
    const page = await browser.newPage()
    await page.setViewportSize({width,height})
    const calls = []
    let loggedIn = false
    let classId = '2'
    let role = 'teacher'
    let failLogin = true
    let delayMe=false, unavailable=false, releaseMe
    const readGate=new Promise(resolve=>{releaseMe=resolve})
    const current = () => ({ user_id: '9223372036854775807', role, class_id: classId, session_id: 'b'.repeat(32),
      session_version: 1, expires_at: new Date(Date.now() + 900000).toISOString() })
    const session = () => ({ access_token: 'mock-access', token_type: 'Bearer', expires_in: 900, principal: current() })
    await page.route('**/api/**', async route => {
      const req = route.request()
      const name = new URL(req.url()).pathname.split('/').at(-1)
      calls.push(req.method() + ' ' + name)
      if (name === 'login') {
        if (failLogin) { failLogin = false; return route.fulfill({ status: 401, json: error('UNAUTHENTICATED') }) }
        loggedIn = true
        return route.fulfill({ json: session() })
      }
      if (!loggedIn) return route.fulfill({ status: 401, json: error('UNAUTHENTICATED') })
      if (name === 'csrf') return route.fulfill({ json: { csrf_token: 'c'.repeat(32) } })
      if (name === 'refresh') return route.fulfill({ json: session() })
      if (name === 'me') {
        if(delayMe) await readGate
        if(unavailable) return route.fulfill({status:503,json:error('DEPENDENCY_UNAVAILABLE')})
        return route.fulfill({json:current()})
      }
      if (name === 'switch-class') {
        const id = req.postDataJSON().class_id
        if (id === '3') return route.fulfill({ status: 403, json: error('FORBIDDEN') })
        classId = id
        return route.fulfill({ json: session() })
      }
      if (name === 'logout') { loggedIn = false; return route.fulfill({ status: 204 }) }
      throw new Error('Unexpected API route: ' + name)
    })
    async function capture(name, title) {
      await page.getByRole('heading', { name: title, exact: true }).waitFor()
      assert.equal(await zoom(),2)
      await page.waitForFunction(width=>innerWidth===width/2 && devicePixelRatio===2,width)
      const geometry=await page.evaluate(()=>({layoutWidth:innerWidth,scrollWidth:document.documentElement.scrollWidth,dpr:devicePixelRatio,visualScale:visualViewport.scale}))
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
      const filename = name + '-' + width + '.png'
      if (width === 360 || width === 1440) await page.screenshot({ path: output + '/' + filename, fullPage: false })
      manifest.push({ width, height, name, nativeZoom:2, ...geometry, path: width === 360 || width === 1440 ? filename : undefined })
    }

    await page.goto(origin + '/')
    await capture('home', 'CampusClawPlus')
    assert.deepEqual(calls, [])
    await page.goto(origin + '/missing')
    await capture('not-found', '页面不存在')
    assert.deepEqual(calls, [])
    await page.goto(origin + '/app')
    await capture('login', '登录你的账号')
    const username = page.getByLabel('用户名')
    const password = page.getByLabel('密码')
    await username.fill('teacher')
    await username.press('Tab')
    assert.equal(await password.evaluate(el => el === document.activeElement), true)
    await password.fill('fixture-only')
    await password.press('Enter')
    await page.getByRole('alert').waitFor()
    assert.match(await page.getByRole('alert').innerText(), /账号或密码不正确/)
    assert.equal(await username.inputValue(), 'teacher')
    assert.equal(await password.inputValue(), '')
    assert.equal(await page.getByRole('alert').evaluate(el => el === document.activeElement), true)
    await capture('login-error', '登录你的账号')
    await password.fill('fixture-only')
    await password.press('Enter')
    await capture('workbench', '工作台')
    await page.getByRole('link', { name: '账号与班级', exact: true }).click()
    await capture('teacher-account', '账号与班级')
    await page.getByRole('button', { name: '切换班级', exact: true }).press('Enter')
    const target = page.getByLabel('目标班级ID')
    await target.waitFor()
    await page.waitForFunction(() => document.activeElement?.id === 'class-id')
    await target.fill('3')
    await target.press('Enter')
    await page.getByRole('alert').waitFor()
    assert.match(await page.getByRole('alert').innerText(), /无法切换/)
    assert.equal(await target.inputValue(), '3')
    await capture('switch-error', '账号与班级')
    await target.fill('9223372036854775807')
    await target.press('Enter')
    await capture('switched', '工作台')
    assert.match(await page.locator('header').innerText(), /9223372036854775807/)
    await page.reload()
    await capture('recovered', '工作台')
    await page.getByRole('link', { name: '账号与班级', exact: true }).click()
    await page.getByRole('button', { name: '退出登录' }).click()
    await capture('logged-out', '登录你的账号')
    await page.goBack()
    await page.getByRole('heading', { name: '登录你的账号' }).waitFor()
    assert.equal(await page.locator('header').count(), 0)
    role = 'student'
    await username.fill('student')
    await password.fill('fixture-only')
    await password.press('Enter')
    await capture('student-workbench', '工作台')
    await page.getByRole('link', { name: '账号与班级', exact: true }).click()
    await capture('student-account', '账号与班级')
    assert.equal(await page.getByRole('button', { name: '切换班级' }).count(), 0)
    assert.deepEqual(await page.evaluate(() => [localStorage.length, sessionStorage.length]), [0, 0])
    assert.equal(calls.filter(call => call === 'POST switch-class').length, 2)
    assert.equal(calls.filter(call => call === 'POST logout').length, 1)
    delayMe=true
    await page.getByRole('link',{name:'工作台',exact:true}).click()
    await capture('loading','请稍候')
    assert.equal(await page.locator('header').count(),0)
    delayMe=false;releaseMe()
    await capture('empty-workbench','工作台')
    unavailable=true
    await page.getByRole('link',{name:'账号与班级',exact:true}).click()
    await capture('dependency-error','暂时无法确认会话')
    assert.equal(await page.locator('header').count(),0)
    assert.equal((await page.locator('body').innerText()).includes('合'.repeat(256)),false)
    unavailable=false
    await page.getByRole('button',{name:'重试恢复',exact:true}).click()
    await capture('recovered-after-error','账号与班级')
    await page.close()
  }
  await writeFile(output + '/manifest.json', JSON.stringify({ source: commit, sourceDirty, origin, version, mode: 'independent native browser 200% via extension tabs.setZoom/getZoom; mock responses only', cases: manifest }, null, 2))
  console.log('FEF-SC-01/02/03/06/08/10: native 200% browser flow passed at 360 and 1440px (' + manifest.length + ' page states)')
} finally {
  await browser.close()
}
