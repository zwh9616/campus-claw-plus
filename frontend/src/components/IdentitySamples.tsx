import { useRef, useState } from 'react'
import type { FormEvent } from 'react'

export type SampleState = 'normal' | 'loading' | 'error'
export function LoginSample({ state = 'normal' }: { state?: SampleState }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(state === 'error' ? '账号或密码不正确，或账号暂不可用。请检查后重试。' : '')
  const summary = useRef<HTMLDivElement>(null)
  function submit(event: FormEvent) {
    event.preventDefault()
    if (state === 'loading') return
    const valid = [...username].length >= 1 && [...username].length <= 64 && [...password].length >= 1 && [...password].length <= 128
    setError(valid ? '账号或密码不正确，或账号暂不可用。请检查后重试。' : '请填写用户名（1–64字）和密码（1–128字）。')
    setPassword('')
    requestAnimationFrame(() => summary.current?.focus())
  }
  return <main className="login-layout"><div className="login-content">
    <a className="brand" href="/">CampusClawPlus</a>
    <h1>登录你的账号</h1><p className="muted intro">连接班级，开启今天的教学与学习。</p>
    <form className="panel" onSubmit={submit} noValidate aria-busy={state === 'loading'}>
      <label htmlFor="username">用户名 <span className="muted">（必填）</span></label>
      <input id="username" autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} disabled={state === 'loading'} aria-describedby={error ? 'login-error' : undefined} />
      <label htmlFor="password">密码 <span className="muted">（必填）</span></label>
      <input id="password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} disabled={state === 'loading'} aria-describedby={error ? 'login-error' : undefined} />
      <div id="login-error" ref={summary} tabIndex={-1} role="alert" className={error ? 'error-message' : ''}>{error}</div>
      <button className="primary" disabled={state === 'loading'}>{state === 'loading' ? '正在登录…' : '登录'}</button>
      <p className="muted help">请使用本班提供的账号。登录遇到问题时，请联系任课教师。</p>
    </form>
  </div></main>
}

export function AccountSample({ state = 'normal', long = false }: { state?: SampleState; long?: boolean }) {
  const [open, setOpen] = useState(state !== 'normal')
  const [target, setTarget] = useState('')
  const [error, setError] = useState(state === 'error' ? (long ? '无法切换到该班级，请确认班级权限或重新验证会话。'.repeat(16).slice(0, 256) : '无法切换到该班级，请确认班级权限或重新验证会话。') : '')
  const [notice, setNotice] = useState('')
  const [logoutNotice, setLogoutNotice] = useState('')
  const currentClass = long ? '9223372036854775807' : '2'
  const trigger = useRef<HTMLButtonElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const summary = useRef<HTMLDivElement>(null)
  function toggle() {
    setOpen(!open)
    requestAnimationFrame(() => open ? trigger.current?.focus() : input.current?.focus())
  }
  function submit(event: FormEvent) {
    event.preventDefault()
    if (state === 'loading') return
    const valid = /^[1-9][0-9]{0,18}$/.test(target) && BigInt(target) <= 9223372036854775807n
    if (target === currentClass) { setNotice('当前已在此班级'); setError(''); return }
    setNotice('')
    setError(valid ? '无法切换到该班级，请确认班级权限或重新验证会话。' : '请输入有效的班级ID（1至9223372036854775807）。')
    requestAnimationFrame(() => summary.current?.focus())
  }
  return <div className="account-layout">
    <header className="topbar"><a className="brand" href="/">CampusClawPlus</a><span className="muted">教师 · 班级ID {long ? '9223372036854775807' : '2'}</span></header>
    <div className="workspace"><nav aria-label="应用导航"><a href="/samples.html?page=account">工作台</a><a href="/samples.html?page=account" aria-current="page">账号与班级</a></nav>
    <main className="account-content"><h1>账号与班级</h1><p className="muted intro">核对当前身份，在任教班级之间切换。</p>
      <section className="section"><h2>当前身份</h2><dl><dt>账号ID</dt><dd>{long ? '9223372036854775807' : '1'}</dd><dt>角色</dt><dd>教师</dd><dt>当前班级ID</dt><dd>{long ? '9223372036854775807' : '2'}</dd></dl></section>
      <section className="section"><div className="section-title"><h2>切换班级</h2><button type="button" ref={trigger} onClick={toggle} aria-expanded={open} aria-controls="switch-form">{open ? '收起' : '切换班级'}</button></div>
      <p className="muted">请输入你任教班级的ID，由服务端核验权限。</p>
      {open && <form id="switch-form" onSubmit={submit} noValidate aria-busy={state === 'loading'}>
        {state === 'loading' ? <p role="status">正在切换班级…</p> : <><label htmlFor="class-id">目标班级ID <span className="muted">（必填）</span></label><input ref={input} id="class-id" inputMode="numeric" value={target} onChange={e => setTarget(e.target.value)} aria-describedby="class-help class-error" /><p id="class-help" className="muted help">请向任课教师确认班级ID，无需输入班级名称。</p></>}
        <div id="class-error" ref={summary} tabIndex={-1} role="alert" className={error ? 'error-message' : ''}>{error}</div>
        <p role="status">{notice}</p><button className="primary" disabled={state === 'loading'}>{state === 'loading' ? '正在切换…' : '确认切换'}</button>
      </form>}
      </section>
      <section className="section signout"><h2>结束会话</h2><p className="muted">退出后，需要重新验证身份才能访问班级内容。</p><button type="button" onClick={() => setLogoutNotice('样板仅演示交互，未执行服务端登出。')}>退出登录</button><p role="status">{logoutNotice}</p></section>
    </main></div>
  </div>
}
