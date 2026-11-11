// MF-SC-01..12: browser mocks exercise production routes, not /samples.html.
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, writeFile, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'

const args = Object.fromEntries(Array.from({ length: (process.argv.length - 2) / 2 }, (_, i) => [process.argv[2 + 2 * i], process.argv[3 + 2 * i]]))
const { chromium } = createRequire(import.meta.url)(args['--playwright'] ?? 'playwright')
const origin = args['--origin'] ?? 'http://127.0.0.1:5197'
const output = resolve(args['--output'] ?? 'output/material-browser')
await mkdir(output, { recursive: true }); await mkdir('output/material-browser-tool', { recursive: true })
const extension = resolve('output/material-browser-tool/extension'); await mkdir(extension, { recursive: true })
await writeFile(resolve(extension, 'manifest.json'), JSON.stringify({ manifest_version: 3, name: 'Local native zoom checks', version: '1.0', permissions: ['tabs'], host_permissions: ['http://127.0.0.1/*'], background: { service_worker: 'worker.js' } }))
await writeFile(resolve(extension, 'worker.js'), 'chrome.runtime.onInstalled.addListener(() => {});')
const profile = await mkdtemp(resolve('output/material-browser-tool/profile-'))
const browser = await chromium.launchPersistentContext(profile, { channel: 'chromium', headless: true, acceptDownloads: true, args: ['--disable-extensions-except=' + extension, '--load-extension=' + extension] })
const worker = browser.serviceWorkers()[0] ?? await browser.waitForEvent('serviceworker')
const source = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const sourceDirty = !!execFileSync('git', ['status', '--porcelain', '--', 'frontend', 'package.json'], { encoding: 'utf8' }).trim()
const report = { files: {}, source, sourceDirty, browser: browser.browser().version(), executedAt: new Date().toISOString(), executor: 'gjj6666，AI辅助', sourceType: 'mock HTTP responses on actual production app routes', cases: [], checks: [], errors: [], contrast: [] }
for (const file of ['frontend/src/auth/client.ts','frontend/src/components/ui.tsx','frontend/src/pages/App.tsx','frontend/src/materials/Pages.tsx','frontend/src/materials/contracts.ts','frontend/src/materials/materials.css','frontend/src/shared/values.ts','frontend/src/sample-theme.css']) report.files[file] = { algorithm: 'sha256', digest: createHash('sha256').update(await readFile(file)).digest('hex') }
const longTitle = '资料边界'.repeat(49) + '𠮷📚标题'
const raw = Buffer.from('\uFEFF甲𠮷📚乙\r\n<script>alert(1)</script>\r尾行' + ('\r\n学习笔记：𠮷与📚按码点定位，先核对已知条件，再说明推理依据。' + 'LongUnicodeWord'.repeat(12)).repeat(8), 'utf8')
const body = raw.toString('utf8').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
const id = '9223372036854775807'
const material = (extra = {}) => ({ id, title: longTitle, version: 1, index_status: 'ready', size_bytes: raw.length, created_at: '2026-11-11T00:00:00.000Z', ...extra })
const error = status => ({ error: { code: ({400:'VALIDATION_ERROR',401:'UNAUTHENTICATED',403:'FORBIDDEN',404:'NOT_FOUND',409:'CONFLICT',413:'PAYLOAD_TOO_LARGE',429:'RATE_LIMITED',503:'DEPENDENCY_UNAVAILABLE',504:'UPSTREAM_TIMEOUT'})[status], message: '远端合成故障', fields: [], details: null }, request_id: 'a'.repeat(32) })
const contrastSeen = new Set()
try {
  for (const [width, zoom] of [[360,1],[767,1],[768,1],[1440,1],[360,2],[1440,2]]) {
    const height = width === 1440 ? 900 : 800
    const page = await browser.newPage(); await page.setViewportSize({ width, height }); await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.addInitScript(() => {
      window.blobEvidence = { created: 0, revoked: 0 }
      const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL)
      URL.createObjectURL = value => { window.blobEvidence.created++; return create(value) }
      URL.revokeObjectURL = value => { window.blobEvidence.revoked++; return revoke(value) }
    })
    page.on('pageerror', e => report.errors.push(e.message))
    let loggedIn = false, role = 'teacher', classId = '2', mode = 'normal', searchMode = 'normal', detailMode = 'normal', uploadMode = 'normal', uploadCount = 0, retryCount = 0
    let stored = material(), savedTitle, savedKey, savedBytes, releaseList
    let delaySearch, delayedSearchSeen = false, delayedSearchRelease
    let delayDownload, downloadSeen = false, delayedDownloadRelease
    const calls = []
    const principal = () => ({ user_id: role === 'teacher' ? '1' : '2', class_id: classId, role, session_id: 'b'.repeat(32), session_version: 1, expires_at: '2030-01-01T00:00:00.000Z' })
    const session = () => ({ access_token: 'synthetic-browser-access', token_type: 'Bearer', expires_in: 900, principal: principal() })
    await page.route('**/api/**', async route => {
      const request = route.request(), url = new URL(request.url()), path = url.pathname
      calls.push({ method: request.method(), path })
      const json = (value, status = 200, headers = {}) => route.fulfill({ status, json: value, headers })
      if (path.endsWith('/login')) { loggedIn = true; return json(session()) }
      if (!loggedIn) return json(error(401),401)
      if (path.endsWith('/csrf')) return json({ csrf_token: 'c'.repeat(32) })
      if (path.endsWith('/refresh')) return json(session())
      if (path.endsWith('/me')) return json(principal())
      if (path.endsWith('/logout')) { loggedIn = false; return route.fulfill({status:204}) }
      if (path.endsWith('/switch-class')) { classId = request.postDataJSON().class_id; return json(session()) }
      assert.match(request.headers().authorization ?? '', /^Bearer /)
      if (path === '/api/v1/materials' && request.method() === 'POST') {
        uploadCount++
        const multipart = await new Request(origin, { method:'POST', headers:{'Content-Type':request.headers()['content-type']}, body:request.postDataBuffer() }).formData()
        const bytes = Buffer.from(await multipart.get('file').arrayBuffer()), title = multipart.get('title'), key = request.headers()['idempotency-key']
        assert.match(key,/^[A-Za-z0-9_-]{16,64}$/)
        const replay=savedKey === key
        if (replay) { assert.equal(title,savedTitle); assert.deepEqual(bytes,savedBytes) }
        else { savedKey=key; savedTitle=title; savedBytes=bytes }
        stored=material({title,index_status:'failed'})
        if (uploadMode === 'uncertain') { uploadMode='normal'; return json(error(503),503) }
        if (uploadMode === 'limited') { uploadMode='normal'; return json(error(429),429,{'Retry-After':'1'}) }
        return json(stored,replay?200:201)
      }
      if (path === '/api/v1/materials') {
        if (mode === 'loading') await new Promise(resolve => { releaseList=resolve })
        if (mode === 'error') return json(error(503),503)
        if (mode === 'paged') { const page=Number(url.searchParams.get('page'));return json({items:Array.from({length:page===1?20:1},(_,i)=>material({id:String(100+(page-1)*20+i),title:'分页资料 '+((page-1)*20+i+1)})),page,page_size:20,total:21}) }
        const result=mode==='empty'?[]:[stored]
        return json({items:result,page:Number(url.searchParams.get('page')),page_size:20,total:result.length})
      }
      if (path === '/api/v1/search') {
        assert.equal(url.searchParams.get('mode'),'keyword');assert.equal(url.searchParams.get('top_k'),'4')
        if (url.searchParams.get('q') === 'old' && delaySearch) { delayedSearchSeen=true; await new Promise(resolve=>{delayedSearchRelease=resolve}) }
        if (searchMode === 'error') return json(error(503),503)
        return json({mode:'keyword',items:searchMode==='empty'?[]:[{material_id:id,chunk_id:'3',material_version:1,title:url.searchParams.get('q')==='old'?'过期检索结果':stored.title,ordinal:0,char_start:1,char_end:3,quote:'𠮷📚',url:'/api/v1/materials/'+id}]})
      }
      if (path.endsWith('/retry-index')) { retryCount++; stored={...stored,index_status:'ready'};return json(stored) }
      if (path.endsWith('/download')) {
        if (delayDownload) { downloadSeen=true; await new Promise(resolve=>{delayedDownloadRelease=resolve}) }
        return route.fulfill({body:raw,headers:{'Content-Type':'text/plain; charset=utf-8','X-Content-Type-Options':'nosniff'}})
      }
      if (path === '/api/v1/materials/'+id) {
        if (detailMode==='404')return json(error(404),404)
        return json({material:stored,body:detailMode==='empty'?'':body})
      }
      throw new Error('Unexpected operation: '+path)
    })
    const goto = async path => { await page.goto(origin+path); await page.locator('h1').waitFor() }
    await goto('/'); await goto('/app/materials/0'); assert.equal(calls.length,0)
    await goto('/app/materials')
    await page.getByLabel('用户名').fill('teacher');await page.locator('#password').fill('synthetic-only');await page.getByRole('button',{name:'登录',exact:true}).click()
    await page.getByRole('heading',{name:'班级资料',exact:true}).waitFor();await page.locator('.material-list').waitFor()
    await page.bringToFront()
    const actualZoom=await worker.evaluate(async ({origin,zoom})=>{const tabs=await chrome.tabs.query({active:true,currentWindow:true});const tab=tabs.find(t=>t.url?.startsWith(origin));await chrome.tabs.setZoom(tab.id,zoom);return chrome.tabs.getZoom(tab.id)},{origin,zoom})
    assert.equal(actualZoom,zoom)
    const cdp=await browser.newCDPSession(page)
    async function capture(name, roleName=role) {
      await page.waitForFunction(({width,zoom})=>Math.abs(document.documentElement.clientWidth-width/zoom)<=1 && Math.abs(devicePixelRatio-zoom)<.01,{width,zoom})
      const metrics=await page.evaluate(()=>({layoutWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,dpr:devicePixelRatio}))
      assert.ok(metrics.scrollWidth<=metrics.layoutWidth,`${name}/${width}/${zoom}`)
      const colors=await page.locator('main p,main h1,main h2,main a,main button,main label,main input,.material-status').evaluateAll(elements=>{
        const bg=el=>{for(let n=el;n;n=n.parentElement){const c=getComputedStyle(n).backgroundColor;if(c!=='transparent'&&c!=='rgba(0, 0, 0, 0)')return c}return 'rgb(255, 255, 255)'}
        const lum=c=>c.match(/[\d.]+/g).slice(0,3).map(Number).map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4}).reduce((sum,x,i)=>sum+x*[.2126,.7152,.0722][i],0)
        return elements.filter(el=>el.getClientRects().length&&(el.textContent.trim()||el.tagName==='INPUT')).map(el=>{const foreground=getComputedStyle(el).color,background=bg(el),a=[lum(foreground),lum(background)].sort((a,b)=>b-a);return {foreground,background,ratio:(a[0]+.05)/(a[1]+.05)}})
      })
      for(const color of colors){assert.ok(color.ratio>=4.5,JSON.stringify(color));const key=JSON.stringify(color);if(!contrastSeen.has(key)){contrastSeen.add(key);report.contrast.push(color)}}
      const filename=`${name}-${width}-zoom${zoom}.png`
      if(zoom===2){const shot=await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:true});await writeFile(resolve(output,filename),Buffer.from(shot.data,'base64'))}
      else await page.screenshot({path:resolve(output,filename),fullPage:true})
      report.cases.push({name,role:roleName,url:page.url(),width,height,nativeZoom:actualZoom,...metrics,screenshot:filename})
    }
    await capture('teacher-list-long')
    await page.getByLabel('关键词',{exact:true}).press('Tab');await page.keyboard.press('Shift+Tab')
    const controls=await page.getByLabel('关键词',{exact:true}).evaluate(el=>{
      const css=getComputedStyle(el),placeholder=getComputedStyle(el,'::placeholder')
      const lum=c=>c.match(/[\d.]+/g).slice(0,3).map(Number).map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4}).reduce((sum,x,i)=>sum+x*[.2126,.7152,.0722][i],0)
      const ratio=(a,b)=>{const c=[lum(a),lum(b)].sort((a,b)=>b-a);return(c[0]+.05)/(c[1]+.05)}
      let background='rgb(247, 246, 243)';for(let p=el.parentElement;p;p=p.parentElement){const c=getComputedStyle(p).backgroundColor;if(c!=='transparent'&&c!=='rgba(0, 0, 0, 0)'){background=c;break}}
      return {border:{foreground:css.borderTopColor,background:css.backgroundColor,ratio:ratio(css.borderTopColor,css.backgroundColor)},placeholder:{foreground:placeholder.color,background:css.backgroundColor,ratio:ratio(placeholder.color,css.backgroundColor)},focus:{foreground:css.outlineColor,background,ratio:ratio(css.outlineColor,background),width:css.outlineWidth,style:css.outlineStyle}}
    })
    assert.ok(controls.border.ratio>=3);assert.ok(controls.placeholder.ratio>=4.5);assert.ok(controls.focus.ratio>=3);assert.equal(controls.focus.width,'2px');assert.equal(controls.focus.style,'solid')
    report.contrast.push({width,zoom,controls})
    mode='empty';await goto('/app/materials');await page.getByText('当前班级还没有资料',{exact:true}).waitFor();await capture('teacher-list-empty')
    mode='error';await goto('/app/materials');await page.locator('[role=alert]').waitFor();await capture('teacher-list-error')
    mode='loading';await goto('/app/materials');await page.getByText('正在加载资料…',{exact:true}).waitFor();await capture('teacher-list-loading');mode='normal';releaseList();await page.locator('.material-list').waitFor()
    mode='paged';await goto('/app/materials');await page.locator('.material-list li').nth(19).waitFor();await page.getByRole('button',{name:'下一页',exact:true}).click();await page.getByText('第 2 页',{exact:true}).waitFor();assert.equal(await page.locator('.material-list li').count(),1);await capture('list-page-two');mode='normal';await goto('/app/materials');await page.locator('.material-list').waitFor()
    await page.getByLabel('关键词',{exact:true}).focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>document.activeElement?.id==='material-list-error')
    searchMode='empty';await page.getByLabel('关键词',{exact:true}).fill('不存在');await page.keyboard.press('Enter');await page.getByText('没有找到匹配资料',{exact:true}).waitFor();await capture('search-empty')
    searchMode='error';await page.getByLabel('关键词',{exact:true}).press('Enter');await page.locator('[role=alert]').waitFor();await capture('search-error')
    searchMode='normal';await page.getByLabel('关键词',{exact:true}).fill('𠮷');await page.keyboard.press('Enter');await page.locator('.material-citations').waitFor();await capture('search-citation')
    assert.equal(new URL(page.url()).searchParams.has('q'),false)
    await page.locator('.material-citations a').press('Enter');await page.locator('.material-body mark').waitFor();assert.equal(await page.locator('mark').innerText(),'𠮷📚');assert.equal(await page.locator('.material-body script').count(),0);await capture('detail-citation')
    const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'下载原文件',exact:true}).click();const download=await downloaded;assert.equal(download.suggestedFilename(),`material-${id}.txt`);assert.deepEqual(await readFile(await download.path()),raw)
    await page.waitForFunction(()=>window.blobEvidence.created===window.blobEvidence.revoked)
    detailMode='empty';await goto('/app/materials/'+id);await page.locator('[role=alert]').waitFor();assert.equal(await page.locator('.material-body').count(),0);await capture('detail-empty-contract-error')
    detailMode='404';await goto('/app/materials/'+id);await page.getByRole('alert').waitFor();assert.match(await page.getByRole('alert').innerText(),/资料不存在或当前不可查看/);await capture('detail-not-viewable');detailMode='normal'
    await goto('/app/materials/upload');await page.getByRole('button',{name:'上传资料',exact:true}).click();await page.waitForFunction(()=>document.activeElement?.id==='upload-error');await capture('upload-invalid')
    await page.getByLabel('标题',{exact:false}).fill('上传𠮷📚资料');await page.getByLabel('文本文件',{exact:false}).setInputFiles({name:'notes.txt',mimeType:'text/plain',buffer:raw});uploadMode='uncertain'
    await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await page.waitForTimeout(100);assert.match(await page.getByLabel('文本文件',{exact:false}).inputValue(),/notes\.txt$/)
    await page.getByRole('button',{name:'上传资料',exact:true}).click();await page.getByRole('button',{name:'确认上传结果',exact:true}).waitFor();assert.equal(uploadCount,1);await capture('upload-uncertain')
    await page.getByRole('button',{name:'确认上传结果',exact:true}).click();await page.getByRole('button',{name:'重新处理',exact:true}).waitFor();assert.equal(uploadCount,2);assert.equal(stored.title,savedTitle);await capture('detail-failed-saved')
    await page.getByRole('button',{name:'重新处理',exact:true}).scrollIntoViewIfNeeded();await capture('detail-failed-action');await page.getByRole('button',{name:'重新处理',exact:true}).click();await page.getByText('可检索',{exact:true}).waitFor();assert.equal(retryCount,1)
    await goto('/app/materials/upload');await page.getByLabel('标题',{exact:false}).fill('新上传');await page.getByLabel('文本文件',{exact:false}).setInputFiles({name:'notes.txt',mimeType:'text/plain',buffer:raw});uploadMode='limited'
    await page.getByRole('button',{name:'上传资料',exact:true}).click();await page.getByRole('alert').waitFor();await capture('upload-429');const count=uploadCount;await page.waitForTimeout(1250);assert.equal(uploadCount,count)
    await page.getByRole('button',{name:'更换内容，发起新上传',exact:true}).click();await page.getByRole('button',{name:'确认新上传',exact:true}).click();assert.equal(await page.getByLabel('标题',{exact:false}).inputValue(),'');assert.equal(await page.getByLabel('文本文件',{exact:false}).inputValue(),'')
    const previousKey=savedKey;await page.getByLabel('标题',{exact:false}).fill('明确的新上传');await page.getByLabel('文本文件',{exact:false}).setInputFiles({name:'new.txt',mimeType:'text/plain',buffer:raw});await page.getByRole('button',{name:'上传资料',exact:true}).click();await page.getByRole('button',{name:'重新处理',exact:true}).waitFor();assert.notEqual(savedKey,previousKey)
    // Older search and download are cancelled by a navigation or identity change.
    await goto('/app/materials');delaySearch=true;await page.getByLabel('关键词',{exact:true}).fill('old');await page.getByLabel('关键词',{exact:true}).press('Enter');while(!delayedSearchSeen)await page.waitForTimeout(10)
    await page.getByLabel('关键词',{exact:true}).fill('new');await page.getByLabel('关键词',{exact:true}).press('Enter');await page.locator('.material-citations').waitFor();delayedSearchRelease();await page.waitForTimeout(50);assert.equal(await page.getByLabel('关键词',{exact:true}).inputValue(),'new');assert.equal(await page.locator('.material-citations a').innerText(),stored.title)
    await goto('/app/materials/'+id);await page.getByRole('button',{name:'下载原文件',exact:true}).waitFor();delayDownload=true;await page.getByRole('button',{name:'下载原文件',exact:true}).click();while(!downloadSeen)await page.waitForTimeout(10)
    const oldBlobCount=await page.evaluate(()=>window.blobEvidence.created)
    await page.getByRole('link',{name:'账号与班级',exact:true}).click();await page.getByRole('button',{name:'切换班级',exact:true}).click();await page.getByLabel('目标班级ID').fill('3');await page.getByRole('button',{name:'确认切换',exact:true}).click();await page.getByRole('heading',{name:'班级资料',exact:true}).waitFor();delayedDownloadRelease();await page.waitForTimeout(50);assert.equal(await page.evaluate(()=>window.blobEvidence.created),oldBlobCount)
    // Student routes use verified identity, with no teacher actions.
    await page.getByRole('link',{name:'账号与班级',exact:true}).click();await page.getByRole('button',{name:'退出登录',exact:true}).click();await page.getByRole('heading',{name:'登录你的账号',exact:true}).waitFor();role='student';stored=material()
    await page.getByLabel('用户名').fill('student');await page.locator('#password').fill('synthetic-only');await page.getByRole('button',{name:'登录',exact:true}).click();await goto('/app/materials');await page.locator('.material-list').waitFor();assert.equal(await page.getByRole('link',{name:'上传资料',exact:true}).count(),0);await capture('student-list')
    const writesBefore=calls.filter(c=>c.method==='POST'&&c.path==='/api/v1/materials').length
    await goto('/app/materials/upload');await page.getByRole('heading',{name:'无权上传资料',exact:true}).waitFor();assert.equal(calls.filter(c=>c.method==='POST'&&c.path==='/api/v1/materials').length,writesBefore);await capture('student-upload-denied')
    await goto('/app/materials/'+id);await page.locator('.material-body').waitFor();assert.equal(await page.getByRole('button',{name:'重新处理',exact:true}).count(),0);await capture('student-detail')
    assert.deepEqual(await page.evaluate(()=>[localStorage.length,sessionStorage.length]),[0,0])
    report.checks.push({width,zoom,passed:['public/invalid path zero requests','deep-link login resumes material route','teacher list four states','search validation/empty/error/citation','Unicode quote matches detail','escaped body','original download bytes and filename','Blob release','empty body contract failure','404 indistinguishable','uncertain upload manual same-key confirmation','saved failed state and manual retry','429 cooldown without automatic write','new upload explicit confirmation','late search ignored','old download cannot fire after class change','student read-only and direct upload denied','no persistent credentials'],uploads:uploadCount,indexRetries:retryCount,download:{bytes:raw.length,algorithm:'sha256',digest:createHash('sha256').update(raw).digest('hex')}})
    await page.close()
  }
  assert.deepEqual(report.errors,[]);report.result='pass'
} catch(error) { report.result='fail';report.error=error.stack;throw error }
finally {await writeFile(resolve(output,'manifest.json'),JSON.stringify(report,null,2)+'\n');await browser.close();console.log(JSON.stringify({result:report.result,source,sourceDirty,cases:report.cases.length,groups:report.checks.length,output}))}
