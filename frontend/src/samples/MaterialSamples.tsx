import { useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import './material-samples.css'

export type MaterialState = 'normal' | 'loading' | 'empty' | 'error'
type Role = 'teacher' | 'student'
type Props = { state: MaterialState; role: Role; long: boolean; detail: boolean; recordId?: string | null }

// MF-SC-10/11: synthetic visual fixtures, imported only by the samples entry.
const classId = '9223372036854775807'
const materialId = '9223372036854775806'
const longTitle = '资料样板边界标题'.repeat(24) + '𠮷📚标题边界检查'
const longError = '资料暂时无法加载，请保留当前输入，检查连接后重试。'.repeat(12).slice(0, 256)
const paragraph = '学习笔记：先写出已知条件，再说明推理依据。非 BMP 文字示例：𠮷、📚。正文中的 <script> 与 <img src=x onerror=alert(1)> 是普通文字，不会执行。'
const longBody = Array.from({ length: 12 }, (_, i) => `${i + 1}. ${paragraph}\n${'连续英文字符'.repeat(2)}：${'UnicodeText'.repeat(18)}`).join('\n\n')
const records = [
  { id: materialId, title: '微积分第一讲：从变化率理解导数', status: 'ready', size: '12 KiB' },
  { id: '9223372036854775805', title: '课堂讨论与阅读笔记', status: 'pending', size: '8 KiB' },
  { id: '9223372036854775804', title: '实验步骤与记录方法', status: 'failed', size: '6 KiB' },
] as const
const statusLabel = { ready: '可检索', pending: '待处理', failed: '处理失败' }

function sampleUrl(role: Role, detail: boolean, long: boolean) {
  return `/samples.html?page=${detail ? 'material-detail' : 'materials'}&role=${role}${long ? '&long=1' : ''}`
}

export function MaterialSample({ state: initialState, role, long, detail, recordId }: Props) {
  const [state, setState] = useState(initialState)
  const [query, setQuery] = useState('')
  const [submittedQuery, setSubmittedQuery] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const resultHeading = useRef<HTMLHeadingElement>(null)
  const errorSummary = useRef<HTMLParagraphElement>(null)
  const teacher = role === 'teacher'
  const selected = (teacher ? records.find(item => item.id === recordId) : undefined) ?? records[teacher ? 2 : 0]
  const title = long ? longTitle : detail ? selected.title : records[0].title
  const listUrl = sampleUrl(role, false, long)
  function focusResults() { requestAnimationFrame(() => resultHeading.current?.focus()) }
  function search(event: FormEvent) {
    event.preventDefault()
    if (state === 'loading') return
    const value = query.trim()
    if (!value || [...value].length > 2000) {
      setError('请输入 1–2000 个字符的关键词。')
      requestAnimationFrame(() => errorSummary.current?.focus())
      return
    }
    setError('')
    setSubmittedQuery(value)
    setState('normal')
    setNotice('当前显示合成样板结果，未发送检索请求。')
    focusResults()
  }
  function clear() {
    setQuery(''); setSubmittedQuery(''); setError(''); setState('normal')
    setNotice('已回到样板列表第 1 页。'); focusResults()
  }
  function retry() {
    setState('normal'); setNotice('已恢复合成样板，未发送服务端请求。'); focusResults()
  }
  function sampleAction(action: string) { setNotice(`样板仅演示${action}入口，未发送服务端请求。`) }
  const rows = records.filter(item => teacher || item.status === 'ready').filter(item => !submittedQuery || `${item.title}${long ? title : ''}`.includes(submittedQuery))
  const failure = long ? longError : '资料加载失败，请检查连接后重试。'
  let content: ReactNode
  if (detail) {
    content = <>
      <a className="material-back" href={listUrl}>← 返回资料列表</a>
      <h1>{title}</h1>
      <p className="muted material-id">资料 ID：{selected.id}</p>
      <h2 ref={resultHeading} tabIndex={-1} className="material-result-heading">资料内容</h2>
      {state === 'loading' ? <div className="material-state" role="status">正在加载资料…</div>
        : state === 'error' ? <div className="material-state"><p role="alert" className="error-message">{failure}</p><button onClick={retry}>重试加载</button></div>
          : state === 'empty' ? <div className="material-state"><p role="alert" className="error-message">资料内容异常：服务端返回了空正文。请重试或联系任课教师。</p><button onClick={retry}>重试加载</button></div>
            : <>
              <div className="material-detail-meta"><Status value={selected.status} /><span className="muted">{selected.size} · 2026/11/11 10:00</span><button onClick={() => sampleAction('原文件下载')}>下载原文件</button></div>
              {selected.status !== 'ready' && <p className="material-saved">资料已保存，暂时无法检索。</p>}
              <section className="material-body" aria-label="资料正文"><p>{long ? longBody : `本资料记录课堂学习的主要步骤，阅读时请结合已知条件核对推理过程。\n\n${paragraph}\n\n阅读后，试着用自己的话概括本次学习的要点。`}</p></section>
              {teacher && selected.status !== 'ready' && <section className="section material-processing"><h2>资料处理</h2><p className="muted">原文已保存。处理失败不会删除资料，可先刷新状态，再按需重新处理。</p><div className="material-actions"><button onClick={() => sampleAction('刷新状态')}>刷新状态</button><button className="primary" onClick={() => sampleAction('重新处理')}>重新处理</button></div></section>}
            </>}
    </>
  } else {
    content = <>
      <div className="material-title-row"><div><h1>班级资料</h1><p className="muted">查找本班资料，阅读原文并核对出处。</p></div>{teacher && <button className="primary" onClick={() => sampleAction('上传资料')}>上传资料</button>}</div>
      <form className="material-search" onSubmit={search} noValidate aria-busy={state === 'loading'}>
        <div className="material-search-field"><label htmlFor="material-query">关键词</label><input id="material-query" value={query} onChange={event => setQuery(event.target.value)} placeholder="按资料内容搜索" disabled={state === 'loading'} aria-invalid={!!error} aria-describedby="material-query-error" /></div>
        <div className="material-actions"><button disabled={state === 'loading'}>搜索</button><button type="button" onClick={clear} disabled={state === 'loading'}>清除</button></div>
        <p ref={errorSummary} id="material-query-error" tabIndex={-1} role="alert" className={error ? 'error-message' : 'material-no-error'}>{error}</p>
      </form>
      <section className="material-results" aria-busy={state === 'loading'}>
        <h2 ref={resultHeading} tabIndex={-1}>{submittedQuery ? '检索结果' : '本班资料'}</h2>
        {state === 'loading' ? <div className="material-state" role="status">正在加载资料…</div>
          : state === 'error' ? <div className="material-state"><p className="error-message" role="alert">{failure}</p><button onClick={retry}>重试加载</button></div>
            : state === 'empty' || rows.length === 0 ? <div className="material-state"><p>{submittedQuery ? '没有找到匹配资料' : '当前班级还没有资料'}</p><p className="muted">{submittedQuery ? '请调整关键词，或清除查询查看列表。' : teacher ? '使用页面上方的“上传资料”添加本班学习材料。' : '请等待任课教师提供资料。'}</p></div>
              : <><ul className="material-list">{rows.map((item, index) => <li key={item.id}><div className="material-record-title"><a href={sampleUrl(role, true, long) + '&material=' + item.id}>{index === 0 ? title : item.title}</a><p className="muted material-id">资料 ID：{item.id}</p></div><Status value={item.status} /><span className="muted">{item.size}</span><time className="muted" dateTime="2026-11-11T02:00:00Z">2026/11/11 10:00</time></li>)}</ul>{!submittedQuery && <div className="material-pagination" aria-label="资料分页"><button disabled>上一页</button><span>第 1 页</span><button disabled>下一页</button></div>}</>}
      </section>
    </>
  }
  return <div className="material-sample">
    <header className="topbar"><span className="brand">CampusClawPlus</span><span className="muted">{teacher ? '教师' : '学生'} · 当前班级 ID：{classId}</span></header>
    <div className="workspace"><nav aria-label="主要导航"><button type="button" onClick={() => sampleAction('工作台')}>工作台</button><a href={listUrl} aria-current="page">资料</a><button type="button" onClick={() => sampleAction('账号与班级')}>账号与班级</button></nav><main className="account-content">{content}<p className="material-notice muted" role="status">{notice}</p></main></div>
  </div>
}

function Status({ value }: { value: 'ready' | 'pending' | 'failed' }) {
  return <span className={`material-status material-status-${value}`}>{statusLabel[value]}</span>
}
