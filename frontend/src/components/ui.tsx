import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { AuthError } from '../auth/client'

export function navigate(path: string, replace = false) {
  if (location.pathname !== path) {
    if (replace) history.replaceState(null, '', path)
    else history.pushState(null, '', path)
  }
  dispatchEvent(new PopStateEvent('popstate'))
}
export function Link({ to, children, current, className, onFollow }: { to: string; children: ReactNode; current?: boolean; className?: string; onFollow?: () => void }) {
  return <a href={to} className={className} aria-current={current ? 'page' : undefined} onClick={event => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
    event.preventDefault(); onFollow?.(); navigate(to)
  }}>{children}</a>
}
export function useCooldown(until = 0) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    setNow(Date.now())
    if (until <= Date.now()) return
    const timer = window.setInterval(() => { setNow(Date.now()); if (Date.now() >= until) window.clearInterval(timer) }, 250)
    return () => window.clearInterval(timer)
  }, [until])
  return Math.max(0, Math.ceil((until - now) / 1000))
}
export function ErrorSummary({ id, error, wait = 0 }: { id: string; error?: AuthError; wait?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { if (error) ref.current?.focus() }, [error])
  if (!error) return null
  return <div className="error-message" role="alert" tabIndex={-1} id={id} ref={ref}>{error.message}
    {wait > 0 && <span> 请等待 {wait} 秒。</span>}
    {error.requestId && <p className="help">请求编号 <code>{error.requestId}</code></p>}
  </div>
}
