import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { createRequire } from 'node:module'
import {spawnSync} from 'node:child_process'
import https from 'node:https'
const require = createRequire(import.meta.url)
const { firefox } = require('D:/zwh/ProSoftware/python/Lib/site-packages/playwright/driver/package')

export async function browserProof({ directory, port }) {
  const origin = 'https://campus.test:' + port
  const seed = JSON.parse(readFileSync(resolve(directory, 'seed.json')))
  const proof = { time: new Date().toISOString(), mode: 'real HTTPS + MySQL; native browser trust; no mocked responses',
    platform: process.platform, cases: [], certificate_removed: false, os_trust_modified: false }
  const browserDirectory = resolve('output/verification/reviewer/firefox-profile-' + Date.now())
  const runtimeSource = firefox.executablePath()
  if (!existsSync(runtimeSource)) throw new Error('Independent Firefox runtime is not ready')
  mkdirSync(browserDirectory, { recursive: true })
  cpSync(resolve(runtimeSource, '..'), browserDirectory, { recursive: true })
  const profile = resolve(browserDirectory,'profile')
  const imported = spawnSync('python',['output/verification/reviewer/import-profile-ca.py', browserDirectory,profile,resolve(directory,'ca.pem')],{encoding:'utf8',timeout:30000})
  if(imported.status!==0) {
    writeFileSync('output/verification/reviewer/profile-ca-error.txt',(imported.stdout??'')+(imported.stderr??''))
    throw new Error('Disposable profile CA preparation failed')
  }
  proof.trust_scope = 'Disposable Firefox NSS profile only; no Windows trust store changes'
  proof.trust_reference = 'https://raw.githubusercontent.com/nss-dev/nss/master/lib/certdb/cert.h'
  let browser
  try {
    const context = await firefox.launchPersistentContext(profile,{ executablePath: resolve(browserDirectory,'firefox.exe'),headless:true,
      viewport:{width:1440,height:900},firefoxUserPrefs:{'network.dns.forceResolve':'127.0.0.1','network.proxy.type':0,'security.enterprise_roots.enabled':false} })
    browser = context.browser()
    proof.browser = browser.version()
    const mark = label => proof.cases.push({label,passed:true})
    const page = await context.newPage()
    page.setDefaultTimeout(15000)
    let lastSession
    page.on('response', async response => {
      if (response.url().endsWith('/auth/login') && response.status() === 200) lastSession = await response.json()
    })
    async function login(user, target = page) {
      await target.goto(origin + '/login')
      await target.getByRole('heading', { name: '登录你的账号', exact: true }).waitFor()
      await target.getByLabel('用户名').fill(user.username)
      await target.getByLabel('密码').fill(user.password)
      await target.getByRole('button', { name: '登录', exact: true }).click()
      await target.getByRole('heading', { name: '工作台', exact: true }).waitFor()
    }
    await page.goto(origin + '/')
    await page.getByRole('heading', { name: 'CampusClawPlus', exact: true }).waitFor()
    mark('Default published host HTTPS loads with ordinary browser certificate validation')
    const wrongHost = await context.newPage()
    await assert.rejects(wrongHost.goto('https://127.0.0.1:' + port + '/'))
    await wrongHost.close()
    mark('Browser rejects valid-chain certificate with wrong hostname')
    await page.goto(origin + '/login')
    await page.getByLabel('用户名').fill(seed.users[0].username)
    await page.getByLabel('密码').fill('synthetic-wrong-password')
    await page.getByRole('button', { name: '登录', exact: true }).click()
    await page.getByRole('alert').waitFor()
    assert.match(await page.getByRole('alert').innerText(), /账号或密码不正确/)
    assert.equal(await page.getByLabel('密码').inputValue(), '')
    mark('Wrong real password rejected and password input cleared')
    await page.getByLabel('密码').fill(seed.users[0].password)
    await page.getByRole('button', { name: '登录', exact: true }).click()
    await page.getByRole('heading', { name: '工作台', exact: true }).waitFor()
    assert.match(await page.locator('header').innerText(), /教师/)
    const firstClass = lastSession.principal.class_id
    const oldAccess = lastSession.access_token
    mark('Real teacher login and trusted identity display')
    const cookie = (await context.cookies()).find(c => c.name === 'campus_refresh')
    assert.ok(cookie?.httpOnly && cookie.secure && cookie.sameSite === 'Strict')
    assert.equal(await page.evaluate(() => document.cookie.includes('campus_refresh')), false)
    assert.deepEqual(await page.evaluate(() => [localStorage.length, sessionStorage.length]), [0, 0])
    mark('Secure HttpOnly Strict cookie and no persistent client credentials')
    await page.reload()
    await page.getByRole('heading', { name: '工作台', exact: true }).waitFor()
    assert.match(await page.locator('header').innerText(), new RegExp('班级ID ' + firstClass))
    mark('Page reload restores real session')
    await page.screenshot({ path: 'output/verification/reviewer/real-workbench-1440.png', fullPage: true })
    // Discover the other class through a separately authenticated real account.
    const studentContext = await browser.newContext({ viewport: { width: 360, height: 800 } })
    const student = await studentContext.newPage()
    let secondClass
    student.on('response', async response => {
      if (response.url().endsWith('/auth/login') && response.status() === 200) secondClass = (await response.json()).principal.class_id
    })
    await login(seed.users[3], student)
    await student.getByRole('link', { name: '账号与班级', exact: true }).click()
    await student.getByRole('heading', { name: '账号与班级', exact: true }).waitFor()
    assert.equal(await student.getByRole('button', { name: '切换班级', exact: true }).count(), 0)
    assert.equal(await student.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await student.screenshot({ path: 'output/verification/reviewer/real-student-360.png', fullPage: true })
    mark('Other-class student real login and no teacher switch action at 360px')
    assert.ok(secondClass && secondClass !== firstClass)
    await page.getByRole('link', { name: '账号与班级', exact: true }).click()
    await page.getByRole('button', { name: '切换班级', exact: true }).click()
    await page.getByLabel('目标班级ID').fill(secondClass)
    await page.getByRole('button', { name: '确认切换', exact: true }).click()
    await page.getByRole('heading', { name: '工作台', exact: true }).waitFor()
    assert.match(await page.locator('header').innerText(), new RegExp('班级ID ' + secondClass))
    const oldStatus = await page.evaluate(async token => (await fetch('/api/v1/me', {
      headers: { Authorization: 'Bearer ' + token }, cache: 'no-store' })).status, oldAccess)
    assert.equal(oldStatus, 401)
    mark('Teacher switches to real second class; original access token is rejected')
    const tab = await context.newPage()
    await tab.goto(origin + '/app')
    await tab.getByRole('heading', { name: '工作台', exact: true }).waitFor()
    let releaseOld, serverReadReady
    const oldGate = new Promise(resolve => { releaseOld = resolve })
    const ready = new Promise(resolve => { serverReadReady = resolve })
    let held = false, relayFailed = false
    const realMe = authorization => new Promise((resolveRequest,rejectRequest) => {
      const request=https.get({host:'127.0.0.1',port,path:'/api/v1/me',servername:'campus.test',
        ca:readFileSync(resolve(directory,'ca.pem')),rejectUnauthorized:true,agent:false,
        headers:{Authorization:authorization,Accept:'application/json'},signal:AbortSignal.timeout(7000)},response=>{
        const data=[]
        response.on('data',chunk=>data.push(chunk))
        response.on('error',()=>rejectRequest(new Error('Real me relay response failed')))
        response.on('end',()=>resolveRequest({status:response.statusCode,headers:response.headers,body:Buffer.concat(data).toString('utf8')}))
      })
      request.on('error',()=>rejectRequest(new Error('Real me relay transport failed')))
    })
    const holdRealRead = async route => {
      if (held) return route.continue()
      held = true
      try {
        const authorization = (await route.request().allHeaders()).authorization
        proof.relay = {authorization_present:!!authorization}
        const actual = await realMe(authorization)
        proof.relay.http_status=actual.status
        proof.relay.class_matches=JSON.parse(actual.body).class_id===secondClass
        assert.equal(actual.status,200)
        assert.equal(JSON.parse(actual.body).class_id,secondClass)
        serverReadReady()
        await oldGate
        // Preserve the real server body exactly. Cancellation is expected after
        // the other tab invalidates this request's context.
        try { await route.fulfill(actual) } catch { /* obsolete request cancelled */ }
      } catch {
        relayFailed=true
        serverReadReady()
      }
    }
    await page.route('**/api/v1/me',holdRealRead)
    await page.getByRole('link', { name: '账号与班级', exact: true }).click()
    await ready
    assert.equal(relayFailed,false,'Real server delay relay must succeed')
    await tab.getByRole('link', { name: '账号与班级', exact: true }).click()
    await tab.getByRole('button', { name: '切换班级', exact: true }).click()
    await tab.getByLabel('目标班级ID').fill(firstClass)
    await tab.getByRole('button', { name: '确认切换', exact: true }).click()
    await tab.getByRole('heading', { name: '工作台', exact: true }).waitFor()
    await page.getByRole('heading', { name: '账号与班级', exact: true }).waitFor()
    assert.match(await page.locator('header').innerText(),new RegExp('班级ID ' + firstClass))
    releaseOld()
    await page.waitForTimeout(200)
    assert.match(await page.locator('header').innerText(),new RegExp('班级ID ' + firstClass))
    await page.unroute('**/api/v1/me',holdRealRead)
    mark('Another tab switches class while actual old server me response is held; old identity never reappears')
    await tab.getByRole('link', { name: '账号与班级', exact: true }).click()
    await tab.getByRole('button', { name: '退出登录', exact: true }).click()
    await tab.getByRole('heading', { name: '登录你的账号', exact: true }).waitFor()
    await page.getByRole('heading', { name: '登录你的账号', exact: true }).waitFor()
    assert.equal(await page.locator('header').count(), 0)
    await page.goto(origin + '/app/account')
    await page.getByRole('heading', { name: '登录你的账号', exact: true }).waitFor()
    mark('Real logout invalidates both tabs and refuses protected route re-entry')
    for (const index of [1,2,4]) {
      const another = await browser.newContext({viewport:{width:360,height:800}})
      const member = await another.newPage()
      await login(seed.users[index],member)
      assert.match(await member.locator('header').innerText(),new RegExp(seed.users[index].role === 'teacher' ? '教师':'学生'))
      await another.close()
    }
    mark('All five real accounts across two classes display the server-approved role')
    await login(seed.users[0])
    await tab.goto(origin + '/app')
    await tab.getByRole('heading',{name:'工作台',exact:true}).waitFor()
    let releaseRefresh
    const refreshGate = new Promise(resolve=>{releaseRefresh=resolve})
    let refreshRequests = 0, barrierFailed = false
    const refreshStatuses = []
    const observed = response => {
      if(response.url().endsWith('/auth/refresh')) refreshStatuses.push(response.status())
    }
    page.on('response',observed); tab.on('response',observed)
    const barrier = async route => {
      ++refreshRequests
      if(refreshRequests===2) releaseRefresh()
      await refreshGate
      try { await route.continue() } catch { barrierFailed=true }
    }
    await context.route('**/api/v1/auth/refresh',barrier)
    await Promise.all([page.reload(),tab.reload()])
    for(const candidate of [page,tab]) {
      await candidate.getByRole('heading',{level:1}).filter({hasText:/^(工作台|账号与班级|登录你的账号|暂时无法确认会话)$/}).waitFor()
    }
    await context.unroute('**/api/v1/auth/refresh',barrier)
    assert.equal(barrierFailed,false)
    assert.equal(refreshRequests,2)
    assert.deepEqual([...refreshStatuses].sort(),[200,401])
    const authenticated=[]
    for(const candidate of [page,tab]) if(await candidate.locator('header').count()) authenticated.push(candidate)
    assert.equal(authenticated.length,1)
    proof.cases.push({label:'Two real browser tabs compete to refresh: one 200, one 401; losing tab clears identity',passed:true,statuses:refreshStatuses})
    const winner=authenticated[0]
    await winner.getByRole('link',{name:'账号与班级',exact:true}).click()
    await winner.getByRole('button',{name:'退出登录',exact:true}).click()
    await winner.getByRole('heading',{name:'登录你的账号',exact:true}).waitFor()
    await studentContext.close()
    await context.close()
    proof.exit_code = 0
    return proof
  } catch (error) {
    proof.exit_code = 1
    // Never persist assertion values that could contain credentials.
    proof.error = { name: error.name, location:error.stack?.split('\n').find(line=>line.includes('browser-real.mjs:')), stage: proof.cases.length, ...(proof.cases.length === 0 ? {initial_error:error.message.split('\n')[0]} : {}) }
    throw new Error('Real browser verification failed at stage ' + proof.cases.length + ': ' + error.name)
  } finally {
    await browser?.close()
    const boundary = resolve('output/verification/reviewer') + '/'
    assert.ok(browserDirectory.replaceAll('\\','/').startsWith(boundary.replaceAll('\\','/')))
    rmSync(browserDirectory,{recursive:true,force:true})
    proof.certificate_removed = true
    writeFileSync('output/verification/reviewer/real-browser.json', JSON.stringify(proof, null, 2) + '\n')
  }
}
