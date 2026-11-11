import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { resolve, sep, dirname } from 'node:path'
import { createRequire } from 'node:module'
import { spawnSync, execFileSync } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'

export async function browserProof({ directory, port, playwrightPath, markFailed }) {
  const { firefox } = createRequire(import.meta.url)(playwrightPath)
  const seed = JSON.parse(readFileSync(resolve(directory,'seed.json'),'utf8'))
  const output = resolve('output/material-real')
  mkdirSync(output,{recursive:true})
  const profile = resolve(output,'profile-'+randomBytes(6).toString('hex'))
  assert.ok(profile.startsWith(output+sep))
  const imported=spawnSync('python',['frontend/tests/import-profile-ca.py',dirname(firefox.executablePath()),profile,resolve(directory,'ca.pem')],{encoding:'utf8',timeout:30000})
  if(imported.status!==0) throw new Error('Disposable Firefox CA profile preparation failed')
  const origin='https://campus.test:'+port
  const privateValues=seed.users.map(user=>user.password)
  const proof={source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceDirty:!!execFileSync('git',['status','--porcelain','--','frontend','scripts/verify-materials-browser.mjs'],{encoding:'utf8'}).trim(),time:new Date().toISOString(),origin,mode:'real default HTTPS frontend/backend/MySQL; no mocked HTTP responses',trust:'disposable Firefox NSS profile; ordinary CA/SAN validation; no OS trust change or ignoreTLS options',cases:[],screenshots:[]}
  const mark=label=>proof.cases.push({label,passed:true})
  let context
  const raw=Buffer.from('\uFEFF课堂𠮷📚资料\r\n先核对条件，再说明依据。\r<script>alert(1)</script>\r\n','utf8')
  const title='真实浏览器𠮷📚资料'
  try {
    context=await firefox.launchPersistentContext(profile,{headless:true,acceptDownloads:true,viewport:{width:1440,height:900},firefoxUserPrefs:{'network.dns.forceResolve':'127.0.0.1','network.proxy.type':0,'security.enterprise_roots.enabled':false}})
    proof.browser=context.browser().version()
    const page=await context.newPage();page.setDefaultTimeout(20000)
    await page.goto(origin+'/');await page.getByRole('heading',{name:'CampusClawPlus',exact:true}).waitFor();mark('默认发布HTTPS入口在正常CA/SAN校验下可用')
    const wrong=await context.newPage();await assert.rejects(wrong.goto('https://127.0.0.1:'+port+'/'));await wrong.close();mark('浏览器拒绝错误SAN，没有跳过证书验证')
    async function login(user) {
      await page.goto(origin+'/login');await page.getByLabel('用户名').fill(user.username);await page.locator('#password').fill(user.password)
      const accepted=page.waitForResponse(response=>response.url().endsWith('/auth/login')&&response.status()===200)
      await page.getByRole('button',{name:'登录',exact:true}).click()
      const identity=await (await accepted).json();privateValues.push(identity.access_token)
      await page.getByRole('heading',{name:'工作台',exact:true}).waitFor()
      return identity
    }
    async function logout() {
      await page.getByRole('link',{name:'账号与班级',exact:true}).click();await page.getByRole('button',{name:'退出登录',exact:true}).click();await page.getByRole('heading',{name:'登录你的账号',exact:true}).waitFor()
    }
    async function screenshot(name,role,width=1440) {
      const height=width===360?800:900;await page.setViewportSize({width,height})
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth))
      await page.screenshot({path:resolve(output,name+'.png'),fullPage:true})
      proof.screenshots.push({file:name+'.png',role,url:page.url(),width,height,mock:false})
    }
    const teacher=await login(seed.users[0]);const firstClass=teacher.principal.class_id
    const boundary=await page.evaluate(async token=>{
      const headers={Authorization:'Bearer '+token}
      const valid=await fetch('/api/v1/search?'+new URLSearchParams({q:'𠮷'.repeat(2000),mode:'keyword',top_k:'4'}),{headers})
      const value=valid.status===200?await valid.json():null
      const invalid=await fetch('/api/v1/search?'+new URLSearchParams({q:'𠮷'.repeat(2001),mode:'keyword',top_k:'4'}),{headers})
      const large=await fetch('/api/v1/search?q='+'x'.repeat(40000),{headers})
      return {status:valid.status,mode:value?.mode,oversizedCodepoints:invalid.status,oversizedRequestLine:large.status}
    },teacher.access_token)
    proof.queryBoundary={codepoints:2000,...boundary}
    assert.equal(boundary.status,200,'2000-codepoint keyword contract through actual HTTPS gateway');assert.equal(boundary.mode,'keyword');assert.equal(boundary.oversizedCodepoints,400);assert.equal(boundary.oversizedRequestLine,414)
    mark('默认HTTPS合法2000非BMP码点成功，2001码点400，超过32KiB请求行仍414')
    await page.getByRole('link',{name:'查看班级资料',exact:true}).click();await page.getByRole('link',{name:'上传资料',exact:true}).click()
    await page.getByLabel('标题',{exact:false}).fill(title);await page.getByLabel('文本文件',{exact:false}).setInputFiles({name:'lesson.TXT',mimeType:'text/plain',buffer:raw})
    const uploaded=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/v1/materials'&&response.request().method()==='POST')
    await page.getByRole('button',{name:'上传资料',exact:true}).click()
    const uploadResponse=await uploaded;assert.equal(uploadResponse.status(),201);const item=await uploadResponse.json();assert.match(item.id,/^[1-9][0-9]*$/)
    await page.locator('.material-body').waitFor();assert.equal(await page.locator('.material-body script').count(),0);assert.match(await page.locator('.material-body').innerText(),/𠮷📚/)
    mark('教师通过浏览器上传真实UTF-8原始字节并显示ready，正文作为文本转义')
    await screenshot('real-teacher-detail','teacher')
    // Fault injection touches only this disposable MySQL object. Response data
    // remains unmodified; the subsequent retry comes from the real UI/API.
    markFailed(item.id)
    await page.reload();await page.getByRole('button',{name:'重新处理',exact:true}).waitFor();await screenshot('real-teacher-failed','teacher')
    await page.getByRole('button',{name:'重新处理',exact:true}).click();await page.getByText('可检索',{exact:true}).waitFor();mark('隔离库受控failed状态由真实教师重新处理恢复ready')
    await logout()
    for(const index of [1,2]) {
      const identity=await login(seed.users[index]);assert.equal(identity.principal.class_id,firstClass)
      await page.getByRole('link',{name:'查看班级资料',exact:true}).click();await page.getByLabel('关键词',{exact:true}).fill('𠮷📚');await page.getByLabel('关键词',{exact:true}).press('Enter')
      await page.locator('.material-citations a').first().click();await page.locator('.material-body mark').waitFor();assert.match(await page.locator('mark').innerText(),/𠮷📚/)
      assert.equal(await page.getByRole('button',{name:'重新处理',exact:true}).count(),0)
      const event=page.waitForEvent('download');await page.getByRole('button',{name:'下载原文件',exact:true}).click();const download=await event
      assert.equal(download.suggestedFilename(),`material-${item.id}.txt`);assert.deepEqual(await readFile(await download.path()),raw)
      mark(`同班学生${index}真实检索→出处与原文回查→原字节下载一致，无教师处理动作`)
      if(index===1)await screenshot('real-student-detail-360','student',360)
      await page.reload();await page.locator('.material-body').waitFor();mark(`同班学生${index}刷新恢复真实Cookie会话`)
      const denied=await page.evaluate(async ({token})=>{const data=new FormData();data.set('title','越权探针');data.set('file',new File(['test'],'test.txt'));const response=await fetch('/api/v1/materials',{method:'POST',headers:{Authorization:'Bearer '+token,'Idempotency-Key':'synthetic_student_denied_0001'},body:data});return response.status},{token:identity.access_token})
      assert.equal(denied,403);mark(`学生${index}真实写接口403`)
      await page.goto(origin+'/app/materials/upload');await page.getByRole('heading',{name:'无权上传资料',exact:true}).waitFor();mark(`学生${index}直访上传页明确拒绝`)
      await logout()
    }
    for(const index of [3,4]) {
      const identity=await login(seed.users[index]);assert.notEqual(identity.principal.class_id,firstClass)
      await page.goto(origin+'/app/materials/'+item.id);await page.getByRole('alert').waitFor();assert.match(await page.getByRole('alert').innerText(),/资料不存在或当前不可查看/)
      assert.equal(await page.locator('.material-body').count(),0)
      const statuses=await page.evaluate(async ({token,id})=>{const values=[];for(const path of ['/api/v1/materials/'+id,'/api/v1/materials/'+id+'/download','/api/v1/materials/9223372036854775807']){const response=await fetch(path,{headers:{Authorization:'Bearer '+token}});const value=await response.json();values.push({status:response.status,code:value.error.code,message:value.error.message})}return values},{token:identity.access_token,id:item.id})
      assert.deepEqual(statuses.map(value=>value.status),[404,404,404]);assert.equal(new Set(statuses.map(value=>value.code+'|'+value.message)).size,1)
      mark(`外班${identity.principal.role}详情/下载与不存在同构404，无正文缓存`)
      if(index===3)await screenshot('real-other-class-404','student',360)
      await logout()
    }
    await page.setViewportSize({width:1440,height:900});const again=await login(seed.users[0])
    const second=await context.newPage();await second.goto(origin+'/app/materials/'+item.id);await second.locator('.material-body').waitFor()
    await page.getByRole('link',{name:'账号与班级',exact:true}).click();await page.getByRole('button',{name:'切换班级',exact:true}).click();await page.getByLabel('目标班级ID').fill(readFileSync(resolve(directory,'class-target'),'utf8').trim());await page.getByRole('button',{name:'确认切换',exact:true}).click()
    await page.getByRole('heading',{name:'班级资料',exact:true}).waitFor();await second.getByRole('heading',{name:'班级资料',exact:true}).waitFor();assert.equal(await second.locator('.material-body').count(),0);mark('真实双标签切班均回到新班列表并清除旧正文')
    await logout();await second.getByRole('heading',{name:'登录你的账号',exact:true}).waitFor();assert.equal(await second.locator('.material-body').count(),0)
    const revoked=await page.evaluate(async token=>(await fetch('/api/v1/materials',{headers:{Authorization:'Bearer '+token}})).status,again.access_token);assert.equal(revoked,401)
    mark('真实退出跨标签清理，切班/退出前旧Bearer返回401')
    assert.deepEqual(await page.evaluate(()=>[localStorage.length,sessionStorage.length]),[0,0]);mark('浏览器不持久保存访问凭据或资料查询')
    proof.download={bytes:raw.length,algorithm:'sha256',digest:createHash('sha256').update(raw).digest('hex')};proof.result='pass'
  } catch(error) {
    proof.result='fail';proof.error=privateValues.reduce((text,value)=>text.split(value).join('<redacted>'),error.stack??String(error))
    throw new Error('Real materials browser verification failed; sanitized manifest saved')
  } finally {
    if(context)await context.close()
    assert.ok(profile.startsWith(output+sep));rmSync(profile,{recursive:true,force:true})
    proof.profileRemoved=true
    writeFileSync(resolve(output,'browser.json'),JSON.stringify(proof,null,2)+'\n')
  }
  return {result:proof.result,cases:proof.cases.length,browser:proof.browser,profileRemoved:proof.profileRemoved}
}
