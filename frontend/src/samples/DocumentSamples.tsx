import { useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import './material-samples.css'
import './document-samples.css'

type State = 'normal' | 'loading' | 'empty' | 'error'
type Role = 'teacher' | 'student'
type Status = 'queued' | 'processing' | 'ready' | 'needs_ocr' | 'failed'
type Record = { id: string; title: string; format: 'pdf' | 'docx'; status: Status; attempts: number; retryable?: boolean }
type Props = { page: string; state: State; role: Role; long: boolean; recordId: string | null; unit: string | null }

// DI-SC-13: isolated visual fixtures; no fetch, identity, storage or file-byte access.
const records: Record[] = [
  { id: '9223372036854775806', title: '微积分第一讲：从变化率理解导数', format: 'pdf', status: 'ready', attempts: 1 },
  { id: '9223372036854775805', title: '课堂讨论：如何写出完整的推理过程', format: 'docx', status: 'ready', attempts: 1 },
  { id: '9223372036854775804', title: '课后阅读与思考', format: 'pdf', status: 'queued', attempts: 0 },
  { id: '9223372036854775803', title: '实验记录与数据分析', format: 'docx', status: 'processing', attempts: 1 },
  { id: '9223372036854775802', title: '扫描讲义：变化率练习', format: 'pdf', status: 'needs_ocr', attempts: 1 },
  { id: '9223372036854775801', title: '补充材料：解析超时', format: 'pdf', status: 'failed', attempts: 1, retryable: true },
  { id: '9223372036854775800', title: '受密码保护的阅读材料', format: 'pdf', status: 'failed', attempts: 1 },
  { id: '9223372036854775799', title: '已达重试上限的资料', format: 'docx', status: 'failed', attempts: 3, retryable: true },
]
const labels: { [key in Status]: string } = { queued: '等待解析', processing: '正在解析', ready: '可检索', needs_ocr: '待文字识别', failed: '解析失败' }
const texts = [
  '平均变化率描述一段区间内的变化。缩小区间，观察变化率是否趋近于一个确定的数值。',
  '导数描述函数在一点附近的瞬时变化率。先说明已知条件，再写出推理依据。𠮷与📚也是正文中的普通字符。',
  '练习：用自己的话解释平均变化率与瞬时变化率的区别。正文里的 <script>alert(1)</script> 和 <img src=x onerror=alert(1)> 只作为文字展示。',
]
const longTitle = [...('本班资料长标题与非BMP字符𠮷📚'.repeat(20))].slice(0, 200).join('')
const longError = [...('资料暂时无法加载，请保留当前输入，检查连接后重试。'.repeat(20))].slice(0, 256).join('')

export function DocumentSample({ page, state: initialState, role, long, recordId, unit }: Props) {
  const [state, setState] = useState(initialState)
  const [query, setQuery] = useState('')
  const [submitted, setSubmitted] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [title, setTitle] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const errorSummary = useRef<HTMLParagraphElement>(null)
  const teacher = role === 'teacher'
  const selected = records.find(row => row.id === (recordId ?? records[0].id))
  const available = selected && (teacher || selected.status === 'ready')
  const detail = page === 'document-detail'
  const upload = page === 'document-upload'
  const titleOf = (row: Record) => long ? longTitle : row.title
  const url = (next: string, id?: string, position?: number) => {
    const params = new URLSearchParams({ page: next, role })
    if (long) params.set('long', '1')
    if (id) params.set('document', id)
    if (position) params.set('unit', String(position))
    return '/samples.html?' + params.toString() + (position ? `#source-${position}` : '')
  }
  const listUrl = url('documents')
  const focusResults = () => requestAnimationFrame(() => heading.current?.focus())
  function fail(message: string) { setError(message); requestAnimationFrame(() => errorSummary.current?.focus()) }
  function search(event: FormEvent) {
    event.preventDefault()
    const value = query.trim()
    if (!value || [...value].length > 2000 || /\p{Cc}/u.test(value)) { fail('请输入 1–2000 个字符的关键词，不包含控制字符。'); return }
    setError(''); setSubmitted(value); setState('normal'); setNotice('当前为合成样板检索，未发送服务端请求。'); focusResults()
  }
  function clear() { setQuery(''); setSubmitted(''); setError(''); setState('normal'); focusResults() }
  function retryLoad() { setState('normal'); setNotice('已恢复合成样板，未发送服务端请求。'); focusResults() }
  function submit(event: FormEvent) {
    event.preventDefault()
    const value = title.trim()
    if (!value || [...value].length > 200 || /\p{Cc}/u.test(value)) { fail('请输入 1–200 个字符的资料标题，不包含控制字符。'); return }
    if (!file) { fail('请选择一份 PDF 或 .docx 文件。'); return }
    if (!/\.(pdf|docx)$/i.test(file.name)) { fail('仅支持 PDF 和 .docx，不支持旧版 .doc、宏文件或图片。'); return }
    if (file.size < 1 || file.size > 10 * 1024 * 1024) { fail('文件须为 1 字节至 10 MiB。请选择符合大小限制的文件。'); return }
    setError(''); setState('normal'); setPreview(true); setNotice('样板已展示提交后的流程。未读取或上传文件，未保存任何资料。')
  }
  const failure = long ? longError : '资料加载失败，请检查连接后重试。'
  const matches = records.filter(row => (teacher || row.status === 'ready') && (!submitted || (row.status === 'ready' && texts.some(text => text.includes(submitted)))))
  function statePanel(empty: ReactNode, normal: ReactNode) {
    return state === 'loading' ? <div className="material-state" role="status">正在加载资料…</div>
      : state === 'error' ? <div className="material-state"><p role="alert" className="error-message">{failure}</p><button onClick={retryLoad}>重试加载</button></div>
        : state === 'empty' ? <div className="material-state">{empty}</div> : normal
  }
  function status(row: Record) { return <span className={`document-status document-status-${row.status}`}>{labels[row.status]}</span> }
  let content: ReactNode
  if (upload) {
    content = <><a className="material-back" href={listUrl}>返回 PDF 与 Word 资料</a><h1>上传 PDF 或 Word 资料</h1>
      {!teacher ? <div className="material-state"><p>仅教师可以上传资料。</p><a href={listUrl}>查看本班可检索资料</a></div>
        : <><p className="muted">添加本班学习材料。提交后等待解析，完成后学生即可检索和阅读。</p>
          <form className="document-upload" onSubmit={submit} noValidate aria-busy={state === 'loading'}>
            <label htmlFor="document-title">资料标题（必填）</label><input id="document-title" value={title} onChange={event => { setTitle(event.target.value); setPreview(false) }} disabled={state === 'loading'} aria-describedby="document-title-help document-form-error" aria-invalid={!!error} />
            <p className="help muted" id="document-title-help">1–200 个字符，使用便于本班查找的标题。</p>
            <label htmlFor="document-file">资料文件（必填）</label><input id="document-file" type="file" accept=".pdf,.docx" onChange={event => { setFile(event.target.files?.[0] ?? null); setPreview(false) }} disabled={state === 'loading'} aria-describedby="document-file-help document-form-error" aria-invalid={!!error} />
            <p className="help muted" id="document-file-help">PDF / .docx，最大 10 MiB。PDF 最多 200 页；暂不支持密码文件、旧版 .doc 和 .docm。扫描 PDF 需要后续文字识别。</p>
            {file && <p className="document-selected muted">已选择：{file.name}（{file.size.toLocaleString()} 字节）</p>}
            <p id="document-form-error" ref={errorSummary} tabIndex={-1} role="alert" className={error ? 'error-message' : 'material-no-error'}>{error}</p>
            {state === 'error' && <p role="alert" className="error-message">{failure} 标题和文件选择已保留。</p>}
            {state === 'empty' && <p className="muted">尚未选择资料，请填写标题并选择文件。</p>}
            <div className="material-actions"><button className="primary" disabled={state === 'loading'}>{state === 'loading' ? '正在提交…' : '上传资料'}</button><a className="document-button" href={listUrl}>返回列表</a></div>
          </form>
          {preview && <section className="section document-preview" aria-label="提交后流程预览"><h2>提交后流程预览</h2><p><strong>{title.trim()}</strong></p><p>等待解析 → 正在解析 → 可检索；扫描 PDF 会显示“待文字识别”。</p><a href={url('document-detail', records[2].id)}>查看等待解析的样板</a></section>}
        </>}
    </>
  } else if (detail) {
    content = <><a className="material-back" href={listUrl}>返回 PDF 与 Word 资料</a>
      {!available ? <><h1>找不到这份资料</h1><p>资料不存在，或当前账号无法查看。</p></>
        : <><h1>{titleOf(selected)}</h1><p className="muted material-id">资料 ID：{selected.id}</p>
          <h2 ref={heading} tabIndex={-1} className="material-result-heading">资料内容</h2>
          {statePanel(<><p className="error-message" role="alert">资料内容异常，请重试或联系任课教师。</p><button onClick={retryLoad}>重试加载</button></>, <>
            <div className="document-meta">{status(selected)}<span>{selected.format === 'pdf' ? 'PDF' : 'Word · .docx'}</span><span>版本 1</span><button onClick={() => setNotice('样板仅展示原文件下载入口，未下载真实文件。')}>下载原文件</button></div>
            {selected.status === 'ready' ? <>
              <p className="muted">{selected.format === 'pdf' ? '按 PDF 原始页码核对出处。' : 'Word 按逻辑块定位，包含表格内段落；不标注页码。'}</p>
              <nav className="document-locations" aria-label="资料内定位">{texts.map((_, i) => <a key={i} href={`#source-${i + 1}`}>{selected.format === 'pdf' ? `第 ${i + 1} 页` : `逻辑块 ${i + 1}`}</a>)}</nav>
              <section className="document-body" aria-label="解析正文">{texts.map((text, i) => <section key={i} id={`source-${i + 1}`} tabIndex={-1} className={unit === String(i + 1) ? 'document-source document-source-selected' : 'document-source'}><h3>{selected.format === 'pdf' ? `第 ${i + 1} 页` : `逻辑块 ${i + 1}`}</h3><p>{long ? text + '\n\n' + '连续英文边界：' + 'UnicodeText'.repeat(24) : text}</p></section>)}</section>
            </> : <section className="document-process" aria-label="解析状态"><h3>{labels[selected.status]}</h3>
              <p>{selected.status === 'needs_ocr' ? '这份 PDF 没有可用的文字层。文字识别功能尚未接入，请换用文字版 PDF 或 .docx；原文件仍可下载。'
                : selected.status === 'failed' ? selected.retryable ? selected.attempts >= 3 ? '已达到 3 次解析上限，请检查原文件后重新上传。' : '解析未能在时限内完成。可先刷新状态，再重试解析。' : '文件受密码保护，无法解析。请解除密码后重新上传。'
                  : '原文件已保存，解析完成前暂不能检索或阅读正文。可稍后刷新状态。'}</p>
              <p className="muted">已尝试 {selected.attempts} 次，最多 3 次。</p><div className="material-actions"><button onClick={() => setNotice('样板已演示刷新状态，未发送服务端请求。')}>刷新状态</button>
                {teacher && selected.status === 'failed' && selected.retryable && selected.attempts < 3 && <button className="primary" onClick={() => setNotice('样板已演示重试入口，未提交解析任务。')}>重试解析</button>}
                {teacher && (selected.status === 'needs_ocr' || selected.status === 'failed' && (!selected.retryable || selected.attempts >= 3)) && <a className="document-button" href={url('document-upload')}>重新上传资料</a>}
              </div></section>}
          </>)}
        </>}
    </>
  } else {
    content = <><div className="material-title-row"><div><h1>班级资料</h1><p className="muted">检索本班学习材料，阅读正文并核对出处。</p></div>{teacher && <a className="document-button primary" href={url('document-upload')}>上传资料</a>}</div>
      <div className="document-tabs" aria-label="资料类型"><a href={`/samples.html?page=materials&role=${role}`}>文本资料</a><a href={listUrl} aria-current="page">PDF 与 Word 资料</a></div>
      <form className="material-search" onSubmit={search} noValidate aria-busy={state === 'loading'}><div className="material-search-field"><label htmlFor="document-query">关键词</label><input id="document-query" placeholder="在已解析正文中搜索" value={query} onChange={event => setQuery(event.target.value)} disabled={state === 'loading'} aria-invalid={!!error} aria-describedby="document-query-error" /></div><div className="material-actions"><button disabled={state === 'loading'}>搜索</button><button type="button" onClick={clear} disabled={state === 'loading'}>清除</button></div><p ref={errorSummary} id="document-query-error" tabIndex={-1} role="alert" className={error ? 'error-message' : 'material-no-error'}>{error}</p></form>
      <section className="material-results" aria-busy={state === 'loading'}><h2 ref={heading} tabIndex={-1}>{submitted ? '关键词检索结果' : '本班 PDF 与 Word 资料'}</h2>
        {statePanel(<><p>当前班级还没有 PDF 或 Word 资料。</p><p className="muted">{teacher ? '使用上方“上传资料”添加学习材料。' : '请等待任课教师提供可检索资料。'}</p></>, matches.length ? <ul className="document-list">{matches.map(row => <li key={row.id}><div><a className="document-record-title" href={url('document-detail', row.id)}>{titleOf(row)}</a><p className="muted material-id">资料 ID：{row.id}</p>
          {submitted && <div className="document-hit"><p>{texts.find(text => text.includes(submitted))}</p><a href={url('document-detail', row.id, texts.findIndex(text => text.includes(submitted)) + 1)}>{row.format === 'pdf' ? '查看原文页' : '查看原文逻辑块'}</a></div>}
        </div><span className="document-format">{row.format === 'pdf' ? 'PDF' : 'Word · .docx'}</span>{status(row)}</li>)}</ul> : <div className="material-state"><p>没有找到匹配资料。</p><p className="muted">请调整关键词，或清除查询查看列表。</p></div>)}
      </section>
    </>
  }
  return <div className="material-sample document-sample"><header className="topbar"><span className="brand">CampusClawPlus</span><span className="muted">{teacher ? '教师' : '学生'} · 当前班级 ID：9223372036854775807</span></header><div className="workspace"><nav aria-label="主要导航"><button onClick={() => setNotice('当前为资料页面样板。')}>工作台</button><a href={listUrl} aria-current="page">资料</a><button onClick={() => setNotice('当前为资料页面样板。')}>账号与班级</button></nav><main className="account-content">{content}<p className="material-notice muted" role="status">{notice}</p></main></div></div>
}
