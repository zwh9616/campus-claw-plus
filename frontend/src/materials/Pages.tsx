import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { AuthError } from '../auth/client'
import type { createAuthClient, Principal } from '../auth/client'
import { ErrorSummary, Link, useCooldown } from '../components/ui'
import { checkCitation, trimSpace, UploadValidationError, validateTitle, validateUpload } from './contracts'
import type { Citation, Material, MaterialDetail, MaterialPage, SearchResult, UploadPayload } from './contracts'
import './materials.css'

type Client = ReturnType<typeof createAuthClient>['materials']
const failure = (value: unknown) => value instanceof AuthError ? value : new AuthError(0, '资料响应异常，请重试或联系教师。')
const size = (bytes: number) => bytes < 1024 ? `${bytes} B` : `${+(bytes / 1024).toFixed(1)} KiB`
const date = (value: string) => new Date(value).toLocaleString('zh-CN', { hour12: false })
export function MaterialStatus({ value }: { value: Material['index_status'] }) {
  return <span className={`material-status material-status-${value}`}>{{ ready: '可检索', pending: '待处理', failed: '处理失败' }[value]}</span>
}

export function MaterialsList({ client, principal, openCitation }: { client: Client; principal: Principal; openCitation: (value: Citation) => void }) {
  const [query, setQuery] = useState('')
  const [activeQuery, setActiveQuery] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<MaterialPage | SearchResult>()
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState<AuthError>()
  const request = useRef<AbortController>()
  const sequence = useRef(0)
  const heading = useRef<HTMLHeadingElement>(null)
  const wait = useCooldown(error?.retryAt)
  async function load(targetPage: number, q: string, focus = true) {
    request.current?.abort()
    const controller = new AbortController(); request.current = controller
    const id = ++sequence.current
    setBusy(true); setData(undefined); setError(undefined); setActiveQuery(q); setPage(targetPage)
    try {
      const result = q ? await client.search(q, controller.signal) : await client.list(targetPage, controller.signal)
      if (controller.signal.aborted || id !== sequence.current) return
      setData(result)
      if (focus) requestAnimationFrame(() => heading.current?.focus())
    } catch (value) { if (!controller.signal.aborted && id === sequence.current) setError(failure(value)) }
    finally { if (!controller.signal.aborted && id === sequence.current) setBusy(false) }
  }
  useEffect(() => { void load(1, '', false); return () => { ++sequence.current; request.current?.abort() } }, [client])
  function search(event: FormEvent) {
    event.preventDefault()
    if (wait) return
    const q = trimSpace(query)
    if (!q || [...q].length > 2000 || /[\p{Cc}\uD800-\uDFFF]/u.test(q)) { setError(new AuthError(400, '请输入 1–2000 个有效字符的关键词。', '', 0, ['q'])); return }
    void load(1, q)
  }
  const isSearch = data && 'mode' in data
  return <div className="materials-page">
    <div className="material-title-row"><div><h1>班级资料</h1><p className="muted">查找本班资料，阅读原文并核对出处。</p></div>{principal.role === 'teacher' && <Link to="/app/materials/upload" className="material-upload-link">上传资料</Link>}</div>
    <form className="material-search" onSubmit={search} noValidate>
      <div className="material-search-field"><label htmlFor="material-query">关键词</label><input id="material-query" value={query} onChange={event => setQuery(event.target.value)} placeholder="按资料内容搜索" aria-invalid={error?.fields.includes('q')} aria-describedby={error ? 'material-list-error' : undefined} /></div>
      <div className="material-actions"><button disabled={wait > 0}>搜索</button><button type="button" disabled={wait > 0} onClick={() => { setQuery(''); void load(1, '') }}>清除</button></div>
    </form>
    <ErrorSummary id="material-list-error" error={error} wait={wait} />
    <section className="material-results" aria-busy={busy}><h2 ref={heading} tabIndex={-1}>{activeQuery ? '检索结果' : '本班资料'}</h2>
      {busy ? <p className="material-state" role="status">正在加载资料…</p> : error ? <div className="material-state"><button disabled={wait > 0} onClick={() => void load(page, activeQuery)}>重试加载</button></div> : data?.items.length === 0 ? <div className="material-state"><p>{activeQuery ? '没有找到匹配资料' : '当前班级还没有资料'}</p><p className="muted">{activeQuery ? '请调整关键词，或清除查询查看列表。' : principal.role === 'teacher' ? '使用页面上方的“上传资料”添加本班学习材料。' : '请等待任课教师提供资料。'}</p></div> :
        isSearch ? <ul className="material-citations">{(data as SearchResult).items.map(item => <li key={item.chunk_id}><Link to={'/app/materials/' + item.material_id} onFollow={() => openCitation(item)}>{item.title}</Link><p className="material-id muted">资料 ID：{item.material_id} · 出处 {item.ordinal + 1}</p><p className="material-quote">{item.quote}</p></li>)}</ul> :
          data && <><ul className="material-list">{(data as MaterialPage).items.map(item => <li key={item.id}><div className="material-record-title"><Link to={'/app/materials/' + item.id}>{item.title}</Link><p className="material-id muted">资料 ID：{item.id}</p></div><MaterialStatus value={item.index_status} /><span className="muted">{size(item.size_bytes)}</span><time className="muted" dateTime={item.created_at}>{date(item.created_at)}</time></li>)}</ul><div className="material-pagination" aria-label="资料分页"><button disabled={page <= 1 || busy} onClick={() => void load(page - 1, '')}>上一页</button><span>第 {page} 页</span><button disabled={page * 20 >= (data as MaterialPage).total || page >= 2147483647 || busy} onClick={() => void load(page + 1, '')}>下一页</button></div></>}
    </section>
  </div>
}

export function MaterialView({ client, principal, id, citation, notice }: { client: Client; principal: Principal; id: string; citation?: Citation; notice?: string }) {
  const [data, setData] = useState<MaterialDetail>()
  const [error, setError] = useState<AuthError>()
  const [actionError, setActionError] = useState<AuthError>()
  const [busy, setBusy] = useState(true)
  const [action, setAction] = useState('')
  const [downloadNotice, setDownloadNotice] = useState('')
  const alive = useRef(false)
  const requests = useRef(new Set<AbortController>())
  const urls = useRef(new Set<string>())
  const actionLock = useRef(false)
  const wait = useCooldown(actionError?.retryAt)
  function controller() { const value = new AbortController(); requests.current.add(value); return value }
  async function load() {
    if (actionLock.current) return
    actionLock.current = true
    const current = controller(); setBusy(true); setError(undefined); setData(undefined)
    try {
      const result = await client.detail(id, current.signal)
      if (citation) checkCitation(result, citation)
      if (alive.current && !current.signal.aborted) setData(result)
    } catch (value) { if (alive.current && !current.signal.aborted) setError(failure(value)) }
    finally { requests.current.delete(current); if (alive.current && !current.signal.aborted) { setBusy(false); actionLock.current = false } }
  }
  useEffect(() => {
    alive.current = true; void load()
    return () => { alive.current = false; requests.current.forEach(value => value.abort()); requests.current.clear(); urls.current.forEach(value => URL.revokeObjectURL(value)); urls.current.clear(); actionLock.current = false }
  }, [client, id, citation])
  async function perform(kind: 'download' | 'retry') {
    if (actionLock.current || wait || !data) return
    actionLock.current = true; setAction(kind); setActionError(undefined); setDownloadNotice('')
    const current = controller()
    try {
      if (kind === 'retry') {
        const material = await client.retry(id, current.signal)
        if (material.title !== data.material.title || material.version !== data.material.version) throw new Error('Version mismatch')
        if (alive.current && !current.signal.aborted) setData({ ...data, material })
      } else {
        const blob = await client.download(id, current.signal)
        if (!alive.current || current.signal.aborted) return
        const url = URL.createObjectURL(blob); urls.current.add(url)
        const link = document.createElement('a'); link.href = url; link.download = `material-${id}.txt`
        document.body.append(link); link.click(); link.remove()
        window.setTimeout(() => { URL.revokeObjectURL(url); urls.current.delete(url) }, 0)
        setDownloadNotice('已发起原文件下载。')
      }
    } catch (value) {
      if (alive.current && !current.signal.aborted) {
        const e = failure(value)
        if (e.status === 404) { setData(undefined); setError(e) } else setActionError(e)
      }
    } finally { requests.current.delete(current); if (alive.current && !current.signal.aborted) { actionLock.current = false; setAction('') } }
  }
  const body = data && [...data.body]
  return <div className="materials-page"><Link to="/app/materials" className="material-back">← 返回资料列表</Link>
    <h1>{data?.material.title ?? '资料详情'}</h1><p className="muted material-id">资料 ID：{id}</p>
    {notice && <p role="status">{notice}</p>}
    {busy ? <p className="material-state" role="status">正在加载资料…</p> : error ? <><ErrorSummary id="material-detail-error" error={error} /><button onClick={() => void load()}>重试加载</button></> : data && <>
      <div className="material-detail-meta"><MaterialStatus value={data.material.index_status} /><span className="muted">{size(data.material.size_bytes)} · {date(data.material.created_at)}</span><button disabled={!!action || wait > 0} onClick={() => void perform('download')}>{action === 'download' ? '正在下载…' : '下载原文件'}</button></div>
      {data.material.index_status !== 'ready' && <p className="material-saved">资料已保存，暂时无法检索。</p>}
      <ErrorSummary id="material-action-error" error={actionError} wait={wait} /><p role="status">{downloadNotice}</p>
      <section className="material-body" aria-label="资料正文"><h2>资料内容</h2><p>{citation && body ? <>{body.slice(0, citation.char_start).join('')}<mark>{body.slice(citation.char_start, citation.char_end).join('')}</mark>{body.slice(citation.char_end).join('')}</> : data.body}</p></section>
      {principal.role === 'teacher' && data.material.index_status !== 'ready' && <section className="section material-processing"><h2>资料处理</h2><p className="muted">原文已保存。可先刷新状态，再按需重新处理。</p><div className="material-actions"><button disabled={!!action || wait > 0} onClick={() => void load()}>刷新状态</button><button className="primary" disabled={!!action || wait > 0} onClick={() => void perform('retry')}>{action === 'retry' ? '正在处理…' : '重新处理'}</button></div></section>}
    </>}
  </div>
}

export function MaterialUpload({ client, principal, completed }: { client: Client; principal: Principal; completed: (item: Material) => void }) {
  const [title, setTitle] = useState('')
  const [file, setFile] = useState<File>()
  const [error, setError] = useState<AuthError>()
  const [busy, setBusy] = useState(false)
  const [uncertain, setUncertain] = useState(false)
  const [confirmNew, setConfirmNew] = useState(false)
  const [titleHint, setTitleHint] = useState('')
  const attempt = useRef<{ payload: UploadPayload; key: string }>()
  const input = useRef<HTMLInputElement>(null)
  const alive = useRef(false)
  const sending = useRef(false)
  const request = useRef<AbortController>()
  const wait = useCooldown(error?.retryAt)
  useEffect(() => { alive.current = true; return () => { alive.current = false; request.current?.abort(); attempt.current = undefined; if (input.current) input.current.value = '' } }, [])
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (sending.current || wait || principal.role !== 'teacher' || error?.status === 409) return
    sending.current = true; setBusy(true); setError(undefined)
    const current = new AbortController(); request.current = current
    try {
      if (!attempt.current) {
        if (!file) throw new UploadValidationError('file', '请选择 UTF-8 .txt 文件。')
        const payload = await validateUpload({ title, file })
        if (!alive.current || current.signal.aborted) return
        attempt.current = { payload, key: crypto.randomUUID() }
      }
      const result = await client.upload(attempt.current.payload, attempt.current.key, current.signal)
      if (alive.current && !current.signal.aborted) { attempt.current = undefined; completed(result) }
    } catch (value) {
      if (alive.current && !current.signal.aborted) {
        const e = value instanceof UploadValidationError ? new AuthError(400, value.message, '', 0, [value.field]) : failure(value)
        setUncertain(!!attempt.current && [0, 401, 503, 504].includes(e.status)); setError(e)
      }
    } finally { if (alive.current && !current.signal.aborted) { sending.current = false; setBusy(false) } }
  }
  if (principal.role !== 'teacher') return <div className="materials-page"><h1>无权上传资料</h1><p>只有当前班级教师可以上传资料。</p><Link to="/app/materials">返回资料列表</Link></div>
  return <div className="materials-page"><Link to="/app/materials" className="material-back">← 返回资料列表</Link><h1>上传资料</h1>
    <p className="muted intro">上传 UTF-8 .txt 文件，供当前班级检索和阅读。</p>
    <form className="material-upload-form" onSubmit={submit} noValidate aria-busy={busy}>
      <label htmlFor="material-title">标题 <span className="muted">（必填，最多200个字符）</span></label>
      <input id="material-title" required value={title} disabled={busy || !!attempt.current} onChange={event => { setTitle(event.target.value); setTitleHint('') }} onBlur={() => { try { validateTitle(title); setTitleHint('') } catch { setTitleHint('标题须为 1–200 个字符，且不能包含控制字符。') } }} aria-invalid={!!titleHint || error?.fields.includes('title')} aria-describedby={titleHint || error?.fields.includes('title') ? 'material-title-error upload-error' : undefined} />
      {(titleHint || error?.fields.includes('title')) && <p id="material-title-error" className="error-message help">{titleHint || '请检查标题长度和控制字符。'}</p>}
      <label htmlFor="material-file">文本文件 <span className="muted">（必填，最大256 KiB）</span></label>
      <input ref={input} id="material-file" type="file" accept=".txt,text/plain" required disabled={busy || !!attempt.current} onChange={event => setFile(event.target.files?.[0])} aria-invalid={error?.fields.includes('file')} aria-describedby="material-file-help upload-error" />
      <p className="help muted" id="material-file-help">保留原文件字节；不支持 PDF、Office 或其他编码。</p>
      {error?.fields.includes('file') && <p className="error-message help">请检查文件类型、大小、编码和正文。</p>}
      <ErrorSummary id="upload-error" error={error} wait={wait} />
      {uncertain && <p role="status" className="material-saved">上传结果尚未确认。请点击“确认上传结果”，用相同内容核对结果。</p>}
      <div className="material-actions"><button className="primary" disabled={busy || wait > 0 || error?.status === 409}>{busy ? '正在提交…' : uncertain ? '确认上传结果' : attempt.current ? '重试上传' : '上传资料'}</button>{attempt.current && <button type="button" disabled={busy} onClick={() => setConfirmNew(true)}>更换内容，发起新上传</button>}</div>
      {confirmNew && <section className="section" aria-label="确认新上传"><h2>确认发起新上传</h2><p>旧请求可能已保存。请先在资料列表核对；新上传会使用新的上传标识。</p><div className="material-actions"><button type="button" onClick={() => { attempt.current = undefined; setFile(undefined); setTitle(''); if (input.current) input.current.value = ''; setError(undefined); setUncertain(false); setConfirmNew(false) }}>确认新上传</button><button type="button" onClick={() => setConfirmNew(false)}>取消</button></div></section>}
    </form>
    <p className="help muted material-notice">刷新、离开页面或身份变化会清除选中文件与上传确认信息。若结果不确定，请先在资料列表核对，再发起新上传。取消等待不会撤销服务端已保存的资料。</p>
  </div>
}
