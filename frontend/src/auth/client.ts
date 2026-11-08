type RecordValue = Record<string, unknown>
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
  413: 'PAYLOAD_TOO_LARGE', 429: 'RATE_LIMITED', 503: 'DEPENDENCY_UNAVAILABLE', 504: 'UPSTREAM_TIMEOUT',
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
const object = (v: unknown): v is RecordValue => typeof v === 'object' && v !== null && !Array.isArray(v)
const shape = (v: unknown, keys: string[]): v is RecordValue =>
  object(v) && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k))
const bounded = (v: unknown, min: number, max: number): v is string =>
  typeof v === 'string' && [...v].length >= min && [...v].length <= max
const hex = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{32}$/.test(v)
export const validId = (v: unknown): v is string =>
  typeof v === 'string' && /^[1-9][0-9]{0,18}$/.test(v) && BigInt(v) <= 9223372036854775807n
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
function errorFor(op: Operation, status: number, v: unknown, headers: Headers): AuthError {
  const id = headers.get('X-Request-ID')
  if (!endpoints[op][3].some(n => n === status) ||
      !shape(v, ['error', 'request_id']) || !hex(v.request_id) ||
      !shape(v.error, ['code', 'message', 'fields', 'details']) || v.error.code !== codes[status] ||
      !bounded(v.error.message, 1, 256) || v.error.details !== null || !Array.isArray(v.error.fields) ||
      !v.error.fields.every(f => shape(f, ['field', 'reason']) && bounded(f.field, 1, 64) && bounded(f.reason, 1, 256))) return formatError(hex(id) ? id : '')
  const messages: Record<number, string> = {
    400: '输入有误，请检查后重试。', 401: '会话已更新或失效，请重新登录。',
    403: '当前操作未获授权，请重新验证会话。', 413: '提交内容过长，请检查输入。',
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
  const listeners = new Set<() => void>()
  const publish = (next: View) => { view = next; listeners.forEach(fn => fn()) }
  const reset = (next: View) => {
    ++epoch
    controller.abort()
    controller = new AbortController()
    credentials = undefined
    csrf = ''
    lastRead = undefined
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
  function verify() {
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
        if (e.status === 401) await recover(true)
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
  return {
    snapshot: () => view,
    subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn) } },
    login, recover, verify, switchClass: (target: string) => change('switchClass', target),
    logout: () => change('logout'),
    clear: () => reset({ phase: 'anonymous' }),
    clearError: () => publish({ phase: view.phase, principal: view.principal }),
    async externalChange() {
      if (write) await write
      if (view.phase === 'authenticated') {
        // A pending GET belongs to the previous tab context. Invalidate it
        // before recovery so its delayed success cannot restore old identity.
        reset({ phase: 'refreshing' })
        await recover(true)
      }
    },
  }
}
