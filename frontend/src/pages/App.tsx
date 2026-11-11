import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { createAuthClient } from '../auth/client'
import type { AuthError, Principal } from '../auth/client'
import { Link, navigate, useCooldown, ErrorSummary } from '../components/ui'
import { materialRoute } from '../materials/contracts'
import type { Citation } from '../materials/contracts'
import { MaterialsList, MaterialView, MaterialUpload } from '../materials/Pages'

const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('campusclaw-context') : undefined
const auth = createAuthClient(undefined, () => channel?.postMessage('context-changed'))
const protectedRoute = (path: string) => path === '/app' || path === '/app/account' || !!materialRoute(path)
const authRoute = (path: string) => protectedRoute(path) || path === '/login'
const roleName = (role: Principal['role']) => role === 'teacher' ? '教师' : '学生'

function Login({ error, notice, busy }: { error?: AuthError; notice?: string; busy: boolean }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const wait = useCooldown(error?.retryAt)
  function submit(e: FormEvent) {
    e.preventDefault()
    if (busy || wait) return
    void auth.login(username, password)
    setPassword('')
  }
  return <main className="login-layout"><div className="login-content">
    <Brand />
    <h1>登录你的账号</h1><p className="muted intro">连接班级，开启今天的教学与学习。</p>
    {notice && <p role="status">{notice}</p>}
    <form className="panel" onSubmit={submit} noValidate aria-busy={busy}>
      <label htmlFor="username">用户名 <span className="muted">（必填）</span></label>
      <input id="username" name="username" autoComplete="username" required value={username}
        onChange={e => setUsername(e.target.value)} disabled={busy} aria-invalid={error?.fields.includes('username')}
        aria-describedby={error ? 'login-error' : undefined} />
      <label htmlFor="password">密码 <span className="muted">（必填）</span></label>
      <input id="password" name="password" type="password" autoComplete="current-password" required value={password}
        onChange={e => setPassword(e.target.value)} disabled={busy} aria-invalid={error?.fields.includes('password')}
        aria-describedby={error ? 'login-error' : undefined} />
      <ErrorSummary id="login-error" error={error} wait={wait} />
      <button className="primary" disabled={busy || wait > 0}>{busy ? '正在登录…' : '登录'}</button>
      <p className="muted help">请使用本班提供的账号。登录遇到问题时，请联系任课教师。</p>
    </form>
  </div></main>
}
function Brand() { return <span className="app-brand"><Link to="/">CampusClawPlus</Link></span> }
function Identity({ principal }: { principal: Principal }) {
  return <dl><dt>账号ID</dt><dd>{principal.user_id}</dd><dt>角色</dt><dd>{roleName(principal.role)}</dd>
    <dt>当前班级ID</dt><dd>{principal.class_id}</dd></dl>
}
function Account({ principal, error, notice, target, setTarget }: { principal: Principal; error?: AuthError; notice?: string; target: string; setTarget: (value: string) => void }) {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const wait = useCooldown(error?.retryAt)
  const expanded = open || !!error
  function toggle() {
    if (expanded && error) auth.clearError()
    setOpen(!expanded)
    requestAnimationFrame(() => (expanded ? trigger : input).current?.focus())
  }
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (wait) return
    const previous = principal.class_id
    await auth.switchClass(target)
    if (auth.snapshot().principal?.class_id !== undefined && auth.snapshot().principal?.class_id !== previous) {
      setTarget('')
      navigate('/app/materials', true)
    }
  }
  return <><h1>账号与班级</h1><p className="muted intro">核对当前身份与班级。</p>
    <section className="section"><h2>当前身份</h2><Identity principal={principal} /></section>
    {principal.role === 'teacher' && <section className="section">
      <div className="section-title"><h2>切换班级</h2><button ref={trigger} type="button" onClick={toggle}
        aria-expanded={expanded} aria-controls={expanded ? 'switch-form' : undefined}>{expanded ? '收起' : '切换班级'}</button></div>
      <p className="muted">请输入你任教班级的ID，由服务端核验权限。</p>
      {expanded && <form id="switch-form" noValidate onSubmit={submit}>
        <label htmlFor="class-id">目标班级ID <span className="muted">（必填）</span></label>
        <input ref={input} id="class-id" required inputMode="numeric" value={target} onChange={e => setTarget(e.target.value)}
          aria-invalid={error?.fields.includes('class_id')} aria-describedby={error ? 'class-help class-error' : 'class-help'} />
        <p id="class-help" className="muted help">请向任课教师确认班级ID，无需输入班级名称。</p>
        <ErrorSummary id="class-error" error={error} wait={wait} />
        {notice && <p role="status">{notice}</p>}
        <button className="primary" disabled={wait > 0}>确认切换</button>
      </form>}
    </section>}
    <section className="section signout"><h2>结束会话</h2>
      <p className="muted">退出后，需要重新验证身份才能访问班级内容。</p>
      <button type="button" onClick={() => void auth.logout()} disabled={wait > 0}>退出登录</button>
    </section>
  </>
}
function Shell({ path, principal, children }: { path: string; principal: Principal; children: ReactNode }) {
  return <div className="account-layout">
    <header className="topbar"><Brand /><span className="muted">{roleName(principal.role)} · 班级ID {principal.class_id}</span></header>
    <div className="workspace"><nav aria-label="应用导航">
      <Link to="/app" current={path === '/app'}>工作台</Link>
      <Link to="/app/materials" current={!!materialRoute(path)}>资料</Link>
      <Link to="/app/account" current={path === '/app/account'}>账号与班级</Link>
    </nav><main className="account-content">{children}</main></div>
  </div>
}
function PublicPanel({ title, children, busy = false }: { title: string; children: ReactNode; busy?: boolean }) {
  return <main className="login-layout"><div className="login-content"><Brand /><h1>{title}</h1>
    <div className="panel" aria-busy={busy}>{children}</div></div></main>
}

export function App() {
  const view = useSyncExternalStore(auth.subscribe, auth.snapshot)
  const [path, setPath] = useState(location.pathname)
  const [target, setTarget] = useState('')
  const [checking, setChecking] = useState(authRoute(location.pathname))
  const routeVersion = useRef(0)
  const currentPath = useRef(location.pathname)
  const resume = useRef<string>()
  const citation = useRef<Citation>()
  const flash = useRef<string>()
  const previousContext = useRef<string>()
  const material = materialRoute(path)
  useEffect(() => {
    let active = true
    const route = () => {
      const next = location.pathname
      const samePage = currentPath.current === next
      currentPath.current = next
      const version = ++routeVersion.current
      setPath(next)
      if (!authRoute(next)) { setChecking(false); return }
      setChecking(!(samePage && materialRoute(next) && auth.snapshot().phase === 'authenticated'))
      const run = auth.snapshot().phase === 'authenticated' ? auth.verify(!!materialRoute(next)) : auth.recover()
      void run.finally(() => { if (active && version === routeVersion.current) setChecking(false) })
    }
    const visible = () => {
      if (document.visibilityState === 'visible' && protectedRoute(location.pathname) && auth.snapshot().phase === 'authenticated') route()
    }
    const restored = (event: PageTransitionEvent) => { if (event.persisted && authRoute(location.pathname)) route() }
    const incoming = (event: MessageEvent) => { if (event.data === 'context-changed') void auth.externalChange() }
    addEventListener('popstate', route)
    addEventListener('pageshow', restored)
    document.addEventListener('visibilitychange', visible)
    channel?.addEventListener('message', incoming)
    route()
    return () => {
      active = false
      removeEventListener('popstate', route)
      removeEventListener('pageshow', restored)
      document.removeEventListener('visibilitychange', visible)
      channel?.removeEventListener('message', incoming)
    }
  }, [])
  useEffect(() => {
    if (checking) return
    if (view.phase === 'authenticated' && path === '/login') {
      const next = resume.current; resume.current = undefined
      navigate(next && materialRoute(next) ? next : '/app', true)
    }
    if (view.phase === 'anonymous' && protectedRoute(path)) {
      resume.current = materialRoute(path) ? path : undefined
      history.replaceState(null, '', '/login')
      setPath('/login')
    }
  }, [checking, path, view.phase])
  useEffect(() => {
    const current = view.principal ? view.principal.user_id + ':' + view.principal.class_id + ':' + view.principal.session_id : undefined
    if (view.phase !== 'authenticated') { citation.current = undefined; flash.current = undefined }
    if (view.phase === 'authenticated' && previousContext.current && current !== previousContext.current && protectedRoute(path)) {
      citation.current = undefined; flash.current = undefined; navigate('/app/materials', true)
    }
    if (view.phase === 'authenticated') previousContext.current = current
    if (view.phase === 'anonymous' || view.phase === 'recovery-error') setTarget('')
    if (view.phase === 'anonymous') previousContext.current = undefined
  }, [view.phase, view.principal, path])
  useEffect(() => {
    if (view.phase !== 'authenticated' || !view.principal || !protectedRoute(path)) return
    const expiration = Date.parse(view.principal.expires_at)
    const timer = window.setTimeout(() => {
      if (document.visibilityState === 'visible') {
        if (materialRoute(path)) void auth.refreshMaterialIdentity().catch(() => {})
        else void auth.recover(true)
      }
    }, Math.max(1000, expiration - Date.now() - 30000))
    return () => window.clearTimeout(timer)
  }, [view.principal?.expires_at, view.phase, path])
  if (path === '/') return <PublicPanel title="CampusClawPlus">
    <p>通过学校提供的账号进入工作台，查看身份和班级。</p>
    <Link to={view.principal ? '/app' : '/login'}>{view.principal ? '进入工作台' : '登录'}</Link>
  </PublicPanel>
  if (!authRoute(path)) return <PublicPanel title="页面不存在"><Link to="/">返回首页</Link></PublicPanel>
  if (!checking && (view.phase === 'anonymous' || view.phase === 'logging-in')) return <Login error={view.error} notice={view.notice} busy={view.phase === 'logging-in'} />
  if (view.phase === 'recovery-error') return <Recovery error={view.error} notice={view.notice} onLogin={() => {
    auth.clear()
    history.replaceState(null, '', '/login')
    setPath('/login')
    setChecking(false)
  }} />
  if (checking || view.phase !== 'authenticated' || !view.principal) {
    const status = view.phase === 'changing-class' ? '正在切换班级…' : view.phase === 'signing-out' ? '正在退出…' : '正在恢复会话…'
    return <PublicPanel title="请稍候" busy><p role="status">{status}</p></PublicPanel>
  }
  const pageKey = view.principal.user_id + ':' + view.principal.session_id + ':' + view.principal.class_id
  const contextKey = view.principal.user_id + ':' + view.principal.class_id + ':' + view.principal.session_id
  if (previousContext.current && previousContext.current !== contextKey && path !== '/app/materials') return <PublicPanel title="请稍候" busy><p role="status">正在更新班级资料…</p></PublicPanel>
  return <Shell path={path} principal={view.principal}>
    {material?.kind === 'list' ? <MaterialsList key={pageKey + ':list'} client={auth.materials} principal={view.principal} openCitation={value => { citation.current = value; flash.current = undefined }} /> :
      material?.kind === 'upload' ? <MaterialUpload key={pageKey + ':upload'} client={auth.materials} principal={view.principal} completed={item => { flash.current = item.index_status === 'ready' ? '资料已上传，可以检索。' : '资料已保存，暂时无法检索。'; citation.current = undefined; navigate('/app/materials/' + item.id) }} /> :
      material?.kind === 'detail' ? <MaterialView key={pageKey + ':' + material.id} client={auth.materials} principal={view.principal} id={material.id} citation={citation.current?.material_id === material.id ? citation.current : undefined} notice={flash.current} /> :
      path === '/app/account' ? <Account key={view.principal.session_id + ':' + view.principal.class_id}
      principal={view.principal} error={view.error} notice={view.notice} target={target} setTarget={setTarget} /> :
      <><h1>工作台</h1><section className="section"><h2>当前身份</h2><Identity principal={view.principal} /></section>
      <section className="section"><h2>班级工作区</h2><p>查看本班资料，或核对账号与班级。</p><div className="auth-actions"><Link to="/app/materials">查看班级资料</Link><Link to="/app/account">查看账号与班级</Link></div></section></>}
  </Shell>
}
function Recovery({ error, notice, onLogin }: { error?: AuthError; notice?: string; onLogin: () => void }) {
  const wait = useCooldown(error?.retryAt)
  return <PublicPanel title="暂时无法确认会话">
    {notice && <p role="status">{notice}</p>}
    <ErrorSummary id="recovery-error" error={error} wait={wait} />
    <div className="auth-actions"><button className="primary" disabled={wait > 0} onClick={() => void auth.recover()}>重试恢复</button>
      <button disabled={wait > 0} onClick={onLogin}>返回登录</button></div>
  </PublicPanel>
}
