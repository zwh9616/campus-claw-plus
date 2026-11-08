const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');
// Manual FEF-SC-11/17/18 evidence. Install pinned Playwright separately; see handoff.
(async () => {
 const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
 const sourceDirty=execFileSync('git',['status','--porcelain','--','frontend','scripts','package.json'],{encoding:'utf8'}).trim().length>0;
 const dir='reports/changes/02/samples';fs.mkdirSync(dir,{recursive:true});
 const browser=await chromium.launch({headless:true,...(process.env.BROWSER_PATH ? {executablePath:process.env.BROWSER_PATH}: {})});
 const page=await browser.newPage(); const errors=[]; const api=[];const rows=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))api.push(r.url())});
 const cases=[['login','normal',false],['login','error',false],['account','normal',false],['account','loading',false],['account','error',false],['account','error',true]];
 try {
 for(const width of [360,1440,767,768])for(const [kind,state,long] of cases){
  await page.setViewportSize({width,height:width===360?800:900});
  const url=`http://127.0.0.1:5174/samples.html?page=${kind}&state=${state}&long=${long?1:0}`;
  await page.goto(url);await page.locator('h1').waitFor();await page.evaluate(()=>document.fonts.ready);
  assert.equal(await page.locator('h1').count(),1);
  const geometry=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert.ok(geometry.scroll<=geometry.width,JSON.stringify(geometry));
  const contrast=await page.evaluate(()=>{
   const rgb=s=>s.match(/[\d.]+/g)?.slice(0,3).map(Number)||[255,255,255];
   const lum=c=>c.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
   const ratio=(a,b)=>{const x=lum(rgb(a)),y=lum(rgb(b));return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
   const out=[];
   for(const el of document.querySelectorAll('a,button,label,input,p,dt,dd,h1,h2,.sample-banner')){
    if(!el.getClientRects().length||!((el.textContent||'').trim()||el.tagName==='INPUT'))continue;
    const style=getComputedStyle(el);let node=el,bg='rgb(255, 255, 255)';
    while(node){const b=getComputedStyle(node).backgroundColor;if(b!=='rgba(0, 0, 0, 0)'&&b!=='transparent'){bg=b;break;}node=node.parentElement}
    out.push({tag:el.tagName,color:style.color,background:bg,ratio:ratio(style.color,bg)});
   }return out;
  });assert.ok(contrast.every(c=>c.ratio>=4.5),JSON.stringify(contrast.filter(c=>c.ratio<4.5)));
  if(long)assert.equal((await page.locator('#class-error').innerText()).length,256);
  const name=`${kind}-${state}${long?'-long':''}-${width}.png`;
  if([360,1440].includes(width))await page.screenshot({path:dir+'/'+name,fullPage:true});
  rows.push({sha,url,viewport:{width,height:width===360?800:900},kind,state,long,source:'isolated synthetic fixture, no authentication service',geometry,contrast,screenshot:[360,1440].includes(width)?name:null});
 }
 await page.goto('http://127.0.0.1:5174/samples.html');await page.locator('#username').waitFor();
 await page.locator('#username').focus();await page.keyboard.press('Tab');assert.equal(await page.locator('#password').evaluate(el=>el===document.activeElement),true);
 await page.keyboard.press('Tab');assert.equal(await page.getByRole('button',{name:'登录',exact:true}).evaluate(el=>el===document.activeElement),true);
 await page.keyboard.press('Enter');await page.waitForFunction(()=>document.activeElement?.id==='login-error');assert.match(await page.locator('#login-error').innerText(),/请填写/);
 await page.locator('#username').fill('qa-user');await page.locator('#password').fill('synthetic-only');await page.getByRole('button',{name:'登录',exact:true}).click();assert.equal(await page.locator('#password').inputValue(),'');assert.equal(await page.locator('#username').inputValue(),'qa-user');
 await page.goto('http://127.0.0.1:5174/samples.html?page=account');await page.getByRole('button',{name:'切换班级',exact:true}).click();await page.waitForFunction(()=>document.activeElement?.id==='class-id');
 await page.locator('#class-id').fill('9223372036854775808');await page.getByRole('button',{name:'确认切换'}).click();assert.match(await page.locator('#class-error').innerText(),/有效的班级ID/);
 await page.locator('#class-id').fill('2');await page.getByRole('button',{name:'确认切换'}).click();assert.match(await page.locator('form').innerText(),/当前已在此班级/);
 await page.getByRole('button',{name:'收起',exact:true}).click();assert.equal(await page.getByRole('button',{name:'切换班级',exact:true}).evaluate(el=>el===document.activeElement),true);
 await page.getByRole('button',{name:'退出登录',exact:true}).click();assert.match(await page.locator('.signout').innerText(),/未执行服务端登出/);
 assert.deepEqual(api,[]);assert.deepEqual(errors,[]);
 fs.writeFileSync(dir+'/manifest.json',JSON.stringify({sha,sourceDirty,browser:await browser.version(),fixture:true,checks:'layout, real computed text contrast, 256-character errors, keyboard focus, input boundaries, no API traffic; no real identity test',nativeBrowserZoom:'not executed; final 200% manual review remains for reviewer',rows},null,2));
 console.log('Sample browser proof: '+rows.length+' cases; all layouts/text contrast/keyboard/input/no-API assertions passed.');
 } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
