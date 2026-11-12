import { bounded, shape, validId } from '../shared/values.ts'
import { parseDetail, parseMaterial, parsePage, parseSearch, trimSpace, validateUpload } from '../materials/contracts.ts'
import type { Material, UploadPayload } from '../materials/contracts.ts'
export { validId } from '../shared/values.ts'
export type Principal = {
  user_id: string; class_id: string; role: 'student' | 'teacher'
  session_id: string; session_version: number; expires_at: string
}
type Session = { access_token: string; principal: Principal }
type Phase = 'logging-in' | 'anonymous' | 'recovering' | 'authenticated' | 'refreshing' | 'changing-class' | 'signing-out' | 'recovery-error'
export type View = { phase: Phase; principal?: Principal; notice?: string; error?: AuthError }

const endpoints = {
  login: ['POST', '/api/v1/auth/login', 200, [400, 401, 413, 429, 503, 504]],
  csrf: ['GET', '/api/v1/auth/csrf', 200, [401, 429, 503, 504]],
  refresh: ['POST', '/api/v1/auth/refresh', 200, [401, 403, 429, 503, 504]],
  me: ['GET', '/api/v1/me', 200, [401, 429, 503, 504]],
  logout: ['POST', '/api/v1/auth/logout', 204, [401, 403, 429, 503, 504]],
  switchClass: ['POST', '/api/v1/auth/switch-class', 200, [400, 401, 403, 413, 429, 503, 504]],
} as const
type Operation = keyof typeof endpoints
const codes: Record<number, string> = {
  400: 'VALIDATION_ERROR', 401: 'UNAUTHENTICATED', 403: 'FORBIDDEN',
  404: 'NOT_FOUND', 409: 'CONFLICT', 413: 'PAYLOAD_TOO_LARGE', 429: 'RATE_LIMITED', 503: 'DEPENDENCY_UNAVAILABLE', 504: 'UPSTREAM_TIMEOUT',
}
export class AuthError extends Error {
  status: number
  requestId: string
  retryAt: number
  fields: string[]
  constructor(status: number, message: string, requestId = '', retryAt = 0, fields: string[] = []) {
    super(message)
    this.status = status
    this.requestId = requestId
    this.retryAt = retryAt
    this.fields = fields
  }
}
const obsolete = () => new AuthError(0, '会话上下文已更新。')
const formatError = (id = '') => new AuthError(0, '服务响应异常，请重试或联系教师。', id)
const hex = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{32}$/.test(v)
function principal(v: unknown): Principal {
  if (!shape(v, ['user_id', 'class_id', 'role', 'session_id', 'session_version', 'expires_at']) ||
      !validId(v.user_id) || !validId(v.class_id) || (v.role !== 'student' && v.role !== 'teacher') ||
      !hex(v.session_id) || typeof v.session_version !== 'number' || !Number.isInteger(v.session_version) || v.session_version < 1 ||
      typeof v.expires_at !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v.expires_at) ||
      !Number.isFinite(Date.parse(v.expires_at)) || new Date(v.expires_at).toISOString() !== v.expires_at) throw formatError()
  return { user_id: v.user_id, class_id: v.class_id, role: v.role, session_id: v.session_id,
    session_version: v.session_version, expires_at: v.expires_at }
}
function session(v: unknown): Session {
  if (!shape(v, ['access_token', 'token_type', 'expires_in', 'principal']) || v.token_type !== 'Bearer' ||
      v.expires_in !== 900 || !bounded(v.access_token, 1, 8192) || /[\s\x00-\x1f\x7f]/.test(v.access_token)) throw formatError()
  return { access_token: v.access_token, principal: principal(v.principal) }
}
function retryAfter(value: string | null): number {
  if (!value) return 0
  const now = Date.now()
  const at = /^\d+$/.test(value) ? now + Number(value) * 1000 : /GMT$/.test(value) ? Date.parse(value) : 0
  return Number.isSafeInteger(at) && at > now ? at : 0
}
function errorFor(op: Operation, status: number, v: unknown, headers: Headers, allowed: readonly number[] = endpoints[op][3]): AuthError {
  const id = headers.get('X-Request-ID')
  if (!allowed.includes(status) ||
      !shape(v, ['error', 'request_id']) || !hex(v.request_id) ||
      !shape(v.error, ['code', 'message', 'fields', 'details']) || v.error.code !== codes[status] ||
      !bounded(v.error.message, 1, 256) || v.error.details !== null || !Array.isArray(v.error.fields) ||
      !v.error.fields.every(f => shape(f, ['field', 'reason']) && bounded(f.field, 1, 64) && bounded(f.reason, 1, 256))) return formatError(hex(id) ? id : '')
  const messages: Record<number, string> = {
    400: '输入有误，请检查后重试。', 401: '会话已更新或失效，请重新登录。',
    403: '当前操作未获授权，请重新验证会话。', 404: '资料不存在或当前不可查看。',
    409: '该上传标识已用于不同内容，请核对列表后明确发起新上传。', 413: '提交内容过长，请缩小文件或检查输入。',
    429: '操作过于频繁，请稍后重试。', 503: '服务暂不可用，请稍后重试。',
    504: '服务响应超时，请稍后重试。',
  }
  const message = op === 'login' && status === 401 ? '账号或密码不正确，或账号暂不可用。请检查后重试。'
    : op === 'switchClass' && status === 403 ? '无法切换到该班级，请确认班级权限或重新验证会话。'
      : messages[status]
  return new AuthError(status, message, v.request_id, status === 429 ? retryAfter(headers.get('Retry-After')) : 0,
    v.error.fields.map(f => f.field as string))
}

export function createAuthClient(fetcher: typeof fetch = (...args) => fetch(...args), changed = () => {}) {
  let view: View = { phase: 'anonymous' }
  let credentials: Session | undefined
  let csrf = ''
  let epoch = 0
  let controller = new AbortController()
  let write: Promise<void> | undefined
  let lastRead: Promise<void> | undefined
  let materialWrite: { key: string; payload?: UploadPayload; promise: Promise<Material> } | undefined
  const listeners = new Set<() => void>()
  const publish = (next: View) => { view = next; listeners.forEach(fn => fn()) }
  const reset = (next: View) => {
    ++epoch
    controller.abort()
    controller = new AbortController()
    credentials = undefined
    csrf = ''
    lastRead = undefined
    materialWrite = undefined
    publish(next)
    return epoch
  }
  const current = (id: number) => { if (id !== epoch) throw obsolete() }
  const failure = (error: unknown) => error instanceof AuthError ? error : formatError()
  async function request(op: Operation, id: number, token = '', protection = '', body?: object): Promise<unknown> {
    current(id)
    const [method, path, success] = endpoints[op]
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (token) headers.Authorization = 'Bearer ' + token
    if (protection) headers['X-CSRF-Token'] = protection
    if (body) headers['Content-Type'] = 'application/json'
    const timeout = AbortSignal.timeout(10000)
    const signal = AbortSignal.any([controller.signal, timeout])
    try {
      const response = await fetcher(path, { method, headers, credentials: 'same-origin', cache: 'no-store',
        redirect: 'error', signal, body: body ? JSON.stringify(body) : undefined })
      current(id)
      if (response.status === 204 && success === 204) return
      const reqId = response.headers.get('X-Request-ID')
      if (!/^application\/json\s*(?:;|$)/i.test(response.headers.get('Content-Type') ?? '')) throw formatError(hex(reqId) ? reqId : '')
      const data: unknown = await response.json()
      current(id)
      if (response.status !== success) throw errorFor(op, response.status, data, response.headers)
      return data
    } catch (error) {
      current(id)
      if (error instanceof AuthError) throw error
      if (error instanceof SyntaxError) throw formatError()
      throw new AuthError(0, timeout.aborted ? '请求超时，请检查网络后重试。' : '连接失败，请检查网络后重试。')
    }
  }
  async function getCsrf(id: number): Promise<string> {
    const data = await request('csrf', id)
    if (!shape(data, ['csrf_token']) || !bounded(data.csrf_token, 32, 256) || /[\r\n]/.test(data.csrf_token)) throw formatError()
    return data.csrf_token
  }
  function install(id: number, next: Session, nextCsrf: string, verified = next.principal) {
    current(id)
    if (verified.session_id !== next.principal.session_id || verified.user_id !== next.principal.user_id ||
        verified.role !== next.principal.role || verified.class_id !== next.principal.class_id ||
        verified.session_version !== next.principal.session_version) throw formatError()
    credentials = { ...next, principal: verified }
    csrf = nextCsrf
    publish({ phase: 'authenticated', principal: verified })
  }
  function serial(action: () => Promise<void>) {
    if (write) return write
    const pending = Promise.resolve().then(action).finally(() => { if (write === pending) write = undefined })
    write = pending
    return pending
  }
  function recover(refreshing = false) {
    return serial(async () => {
      const id = reset({ phase: refreshing ? 'refreshing' : 'recovering' })
      try {
        const first = await getCsrf(id)
        const next = session(await request('refresh', id, '', first))
        const nextCsrf = await getCsrf(id)
        const verified = principal(await request('me', id, next.access_token))
        install(id, next, nextCsrf, verified)
      } catch (error) {
        if (id !== epoch) return
        const e = failure(error)
        reset(e.status === 401 ? { phase: 'anonymous', notice: refreshing ? e.message : undefined }
          : { phase: 'recovery-error', error: e })
      }
    })
  }
  function verify(keepMaterialContext = false) {
    if (lastRead) return lastRead
    if (write) return write
    if (!credentials) return recover()
    const id = epoch
    const active = credentials
    const pending = (async () => {
      try {
        install(id, active, csrf, principal(await request('me', id, active.access_token)))
      } catch (error) {
        if (id !== epoch) return
        const e = failure(error)
        if (e.status === 401) {
          if (keepMaterialContext) { try { await recoverMaterial(active, id) } catch { /* recovery already cleared the failed identity */ } }
          else await recover(true)
        }
        else reset({ phase: 'recovery-error', error: e })
      }
    })().finally(() => { if (lastRead === pending) lastRead = undefined })
    lastRead = pending
    return pending
  }
  function login(username: string, password: string) {
    if (write) return write
    if (!bounded(username, 1, 64) || !bounded(password, 1, 128)) {
      publish({ phase: 'anonymous', error: new AuthError(400, '请填写用户名（1–64字）和密码（1–128字）。', '', 0,
        [!bounded(username, 1, 64) ? 'username' : '', !bounded(password, 1, 128) ? 'password' : ''].filter(Boolean)) })
      return Promise.resolve()
    }
    if ((view.error?.retryAt ?? 0) > Date.now()) return Promise.resolve()
    return serial(async () => {
      const id = reset({ phase: 'logging-in' })
      let accepted = false
      try {
        const next = session(await request('login', id, '', '', { username, password }))
        accepted = true
        install(id, next, await getCsrf(id))
        changed()
      } catch (error) {
        if (id !== epoch) return
        const e = failure(error)
        reset({ phase: accepted ? 'recovery-error' : 'anonymous', error: e })
      }
    })
  }
  function change(op: 'logout' | 'switchClass', target?: string) {
    if (write) return write
    const active = credentials
    const protection = csrf
    if (!active || !protection || (view.error?.retryAt ?? 0) > Date.now()) return Promise.resolve()
    if (op === 'switchClass') {
      if (active.principal.role !== 'teacher') return Promise.resolve()
      if (!validId(target) || target === active.principal.class_id) {
        publish({ phase: 'authenticated', principal: active.principal,
          ...(validId(target) ? { notice: '当前已在此班级。' } :
            { error: new AuthError(400, '请输入有效的班级ID（1至9223372036854775807）。', '', 0, ['class_id']) }) })
        return Promise.resolve()
      }
    }
    return serial(async () => {
      const id = reset({ phase: op === 'logout' ? 'signing-out' : 'changing-class' })
      try {
        // Another tab may have rotated the shared HttpOnly refresh cookie.
        // Obtain matching protection immediately before the single write.
        const currentProtection = await getCsrf(id)
        const data = await request(op, id, active.access_token, currentProtection, target ? { class_id: target } : undefined)
        if (op === 'logout') {
          reset({ phase: 'anonymous', notice: '已退出登录。' })
        } else {
          const next = session(data)
          if (next.principal.class_id !== target || next.principal.user_id !== active.principal.user_id ||
              next.principal.role !== active.principal.role) throw formatError()
          install(id, next, await getCsrf(id))
        }
        changed()
      } catch (error) {
        if (id !== epoch) return
        const e = failure(error)
        if (e.status === 401) return void reset({ phase: 'anonymous', notice: e.message })
        if (op === 'switchClass' && [400, 403, 413, 429].includes(e.status)) {
          try {
            install(id, active, protection, principal(await request('me', id, active.access_token)))
            publish({ ...view, error: e })
            return
          } catch (check) {
            if (id !== epoch) return
            if (failure(check).status === 401) return void reset({ phase: 'anonymous', notice: failure(check).message })
          }
        }
        const action = op === 'logout' ? '退出' : '切班'
        reset({ phase: 'recovery-error', error: e,
          notice: [0, 503, 504].includes(e.status) ? action + '结果暂未确认，请先恢复会话。' : undefined })
      }
    })
  }
  // MF-SC-07..09: six fixed operations only; Bearer never leaves this closure.
  function materialIdentity() {
    if (!credentials || view.phase !== 'authenticated') throw new AuthError(401, '请先重新登录。')
    return credentials
  }
  function sameIdentity(a: Principal, b: Principal) {
    return a.user_id === b.user_id && a.class_id === b.class_id && a.role === b.role && a.session_id === b.session_id
  }
  async function recoverMaterial(active: Session, id: number) {
    // Same 02 CSRF/refresh/CSRF/me sequence, serialized with identity writes.
    // Keep the mounted form while rotating the same identity; context changes
    // still reset epoch, abort requests and remove private page state.
    await serial(async () => {
      current(id)
      // A response sent with the old token can arrive after another request
      // completed recovery. Reuse its verified credentials instead of issuing
      // another CSRF/refresh/me sequence for that same expired token.
      if (credentials && credentials.access_token !== active.access_token && sameIdentity(active.principal, credentials.principal)) return
      try {
        const first = await getCsrf(id)
        const next = session(await request('refresh', id, '', first))
        const protection = await getCsrf(id)
        const verified = principal(await request('me', id, next.access_token))
        if (!sameIdentity(active.principal, verified)) throw new AuthError(401, '会话身份已变化，请重新登录。')
        install(id, next, protection, verified)
      } catch (error) {
        if (id !== epoch) throw obsolete()
        const e = failure(error)
        reset(e.status === 401 ? { phase: 'anonymous', notice: e.message } : { phase: 'recovery-error', error: e })
        throw e
      }
    })
    current(id)
    if (!credentials || !sameIdentity(active.principal, credentials.principal)) throw obsolete()
  }
  type MaterialOperation = 'list' | 'search' | 'detail' | 'download' | 'upload' | 'retry'
  const allowedErrors: Record<MaterialOperation, number[]> = {
    list: [400, 401, 503, 504], search: [400, 401, 503, 504], detail: [400, 401, 404, 503, 504],
    download: [400, 401, 404, 503, 504], upload: [400, 401, 403, 409, 413, 429, 503, 504],
    retry: [400, 401, 403, 404, 429, 503, 504],
  }
  async function materialRequest(op: MaterialOperation, path: string, caller?: AbortSignal, body?: FormData, key?: string): Promise<unknown> {
    const active = materialIdentity(), id = epoch
    if ((op === 'upload' || op === 'retry') && active.principal.role !== 'teacher') throw new AuthError(403, '只有当前班级教师可以操作资料。')
    const once = async (token: string) => {
      current(id)
      const timeout = AbortSignal.timeout(10000)
      const signal = AbortSignal.any([controller.signal, timeout, ...(caller ? [caller] : [])])
      const headers: Record<string, string> = { Accept: op === 'download' ? 'text/plain' : 'application/json', Authorization: 'Bearer ' + token }
      if (key) headers['Idempotency-Key'] = key
      let rejectAbort: () => void = () => {}
      const aborted = new Promise<never>((_, reject) => { rejectAbort = () => reject(new AuthError(0, timeout.aborted ? '请求超时，请检查网络后重试。' : '请求已取消。')) })
      signal.addEventListener('abort', rejectAbort, { once: true })
      if (signal.aborted) rejectAbort()
      try {
        return await Promise.race([aborted, (async () => {
          const response = await fetcher(path, { method: op === 'upload' || op === 'retry' ? 'POST' : 'GET', headers,
            body, credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal })
          current(id); signal.throwIfAborted()
          const success = response.status === 200 || (op === 'upload' && response.status === 201)
          if (success && op === 'download') {
            if (!/^text\/plain\s*(?:;|$)/i.test(response.headers.get('Content-Type') ?? '') || response.headers.get('X-Content-Type-Options') !== 'nosniff') throw formatError()
            const blob = await response.blob()
            current(id); signal.throwIfAborted()
            if (blob.size < 1 || blob.size > 262144) throw formatError()
            return blob
          }
          if (!/^application\/json\s*(?:;|$)/i.test(response.headers.get('Content-Type') ?? '')) throw formatError()
          const value: unknown = await response.json()
          current(id); signal.throwIfAborted()
          if (!success) throw errorFor('me', response.status, value, response.headers, allowedErrors[op])
          return value
        })()])
      } catch (error) {
        current(id)
        if (error instanceof AuthError) throw error
        throw new AuthError(0, signal.aborted ? (timeout.aborted ? '请求超时，请检查网络后重试。' : '请求已取消。') : '资料请求失败，请检查连接后重试。')
      } finally { signal.removeEventListener('abort', rejectAbort) }
    }
    try { return await once(active.access_token) }
    catch (error) {
      const e = failure(error)
      if (caller?.aborted) throw e
      current(id)
      if (e.status === 401) {
        await recoverMaterial(active, id)
        if (caller?.aborted) throw obsolete()
        if (op === 'list' || op === 'search' || op === 'detail') {
          try { return await once(materialIdentity().access_token) }
          catch (again) {
            if (failure(again).status === 401 && id === epoch) reset({ phase: 'anonymous', notice: '会话已失效，请重新登录。' })
            throw again
          }
        }
        // Upload, index retry and download never replay automatically.
      } else if (e.status === 403) await verify()
      throw e
    }
  }
  async function decode<T>(run: Promise<unknown>, parse: (value: unknown) => T): Promise<T> {
    const value = await run
    try { return parse(value) } catch { throw formatError() }
  }
  const requireId = (id: string) => { if (!validId(id)) throw new AuthError(400, '资料ID无效。') }
  function materialMutation(key: string, payload: UploadPayload | undefined, run: () => Promise<Material>): Promise<Material> {
    if (materialWrite) {
      if (materialWrite.key === key && materialWrite.payload?.title === payload?.title && materialWrite.payload?.file === payload?.file) return materialWrite.promise
      return Promise.reject(new AuthError(409, '已有资料操作正在提交，请等待结果。'))
    }
    const pending = Promise.resolve().then(run).finally(() => { if (materialWrite?.promise === pending) materialWrite = undefined })
    materialWrite = { key, payload, promise: pending }
    return pending
  }
  const materials = {
    list(page = 1, signal?: AbortSignal) {
      if (!Number.isInteger(page) || page < 1 || page > 2147483647) return Promise.reject(new AuthError(400, '页码无效。'))
      return decode(materialRequest('list', `/api/v1/materials?page=${page}&page_size=20`, signal), value => parsePage(value, page))
    },
    search(query: string, signal?: AbortSignal) {
      const q = trimSpace(query)
      if (!bounded(q, 1, 2000) || /[\p{Cc}\uD800-\uDFFF]/u.test(q)) return Promise.reject(new AuthError(400, '请输入 1–2000 个有效字符的关键词。', '', 0, ['q']))
      return decode(materialRequest('search', '/api/v1/search?' + new URLSearchParams({ q, mode: 'keyword', top_k: '4' }), signal), parseSearch)
    },
    detail(id: string, signal?: AbortSignal) { requireId(id); return decode(materialRequest('detail', `/api/v1/materials/${id}`, signal), value => parseDetail(value, id)) },
    download(id: string, signal?: AbortSignal) { requireId(id); return materialRequest('download', `/api/v1/materials/${id}/download`, signal) as Promise<Blob> },
    upload(payload: UploadPayload, key: string, signal?: AbortSignal) {
      const id = epoch
      if (!/^[A-Za-z0-9_-]{16,64}$/.test(key)) return Promise.reject(new AuthError(400, '上传标识无效，请发起新上传。'))
      return materialMutation('upload:' + key, payload, async () => {
        const valid = await validateUpload(payload)
        current(id)
        const data = new FormData(); data.set('title', valid.title); data.set('file', valid.file)
        return decode(materialRequest('upload', '/api/v1/materials', signal, data, key), parseMaterial)
      })
    },
    retry(id: string, signal?: AbortSignal) {
      requireId(id)
      return materialMutation('retry:' + id, undefined, () => decode(materialRequest('retry', `/api/v1/materials/${id}/retry-index`, signal), value => {
        const item = parseMaterial(value)
        if (item.id !== id) throw formatError()
        return item
      }))
    },
  }
  return {
    materials,
    refreshMaterialIdentity: () => { const active = materialIdentity(); return recoverMaterial(active, epoch) },
    snapshot: () => view,
    subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn) } },
    login, recover, verify, switchClass: (target: string) => change('switchClass', target),
    logout: () => change('logout'),
    clear: () => reset({ phase: 'anonymous' }),
    clearError: () => publish({ phase: view.phase, principal: view.principal }),
    async externalChange() {
      const invalidated = view.phase === 'authenticated'
      if (invalidated) reset({ phase: 'refreshing' })
      if (write) { try { await write } catch { /* old context is already invalid */ } }
      if (invalidated || view.phase === 'authenticated') {
        // A pending GET belongs to the previous tab context. Invalidate it
        // before recovery so its delayed success cannot restore old identity.
        if (!invalidated) reset({ phase: 'refreshing' })
        await recover(true)
      }
    },
  }
}
