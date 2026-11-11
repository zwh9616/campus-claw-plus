import { bounded, shape, timestamp, validId } from '../shared/values.ts'

export type Material = { id: string; title: string; version: 1; index_status: 'ready' | 'pending' | 'failed'; size_bytes: number; created_at: string }
export type MaterialPage = { items: Material[]; page: number; page_size: number; total: number }
export type MaterialDetail = { material: Material; body: string }
export type Citation = { material_id: string; chunk_id: string; material_version: number; title: string; ordinal: number; char_start: number; char_end: number; quote: string; url: string }
export type SearchResult = { mode: 'keyword'; items: Citation[] }
export type UploadPayload = { title: string; file: File }

// Match Go strings.TrimSpace, including NEL and excluding BOM (JS trim differs).
export const trimSpace = (value: string) => value.replace(/^[\u0009-\u000d \u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+|[\u0009-\u000d \u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+$/gu, '')
const text = (v: unknown, max: number): v is string => bounded(v, 1, max) && !/[\p{Cc}\uD800-\uDFFF]/u.test(v)
const integer = (v: unknown, min: number, max = Number.MAX_SAFE_INTEGER): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= max
const invalid = (): never => { throw new Error('Invalid material contract') }
export function parseMaterial(value: unknown): Material {
  if (!shape(value, ['id', 'title', 'version', 'index_status', 'size_bytes', 'created_at']) ||
      !validId(value.id) || !text(value.title, 200) || trimSpace(value.title) !== value.title || value.version !== 1 ||
      !['ready', 'pending', 'failed'].includes(value.index_status as string) || !integer(value.size_bytes, 1, 262144) || !timestamp(value.created_at)) return invalid()
  return { ...value } as Material
}
export function parsePage(value: unknown, page: number): MaterialPage {
  if (!shape(value, ['items', 'page', 'page_size', 'total']) || !Array.isArray(value.items) || value.items.length > 20 ||
      value.page !== page || value.page_size !== 20 || !integer(value.total, 0)) return invalid()
  const items = value.items.map(parseMaterial)
  if (new Set(items.map(item => item.id)).size !== items.length || items.length > value.total ||
      items.length !== Math.max(0, Math.min(20, value.total - (page - 1) * 20))) return invalid()
  return { items, page, page_size: 20, total: value.total }
}
export function parseDetail(value: unknown, id: string): MaterialDetail {
  if (!shape(value, ['material', 'body']) || !bounded(value.body, 1, 262144) || !trimSpace(value.body) ||
      /[\r\uD800-\uDFFF]/u.test(value.body) || /\p{Cc}/u.test(value.body.replace(/[\n\t]/g, '')) || new TextEncoder().encode(value.body).length > 262144) return invalid()
  const material = parseMaterial(value.material)
  if (material.id !== id) return invalid()
  return { material, body: value.body }
}
export function parseCitation(value: unknown): Citation {
  if (!shape(value, ['material_id', 'chunk_id', 'material_version', 'title', 'ordinal', 'char_start', 'char_end', 'quote', 'url']) ||
      !validId(value.material_id) || !validId(value.chunk_id) || !integer(value.material_version, 1) || !text(value.title, 200) ||
      !integer(value.ordinal, 0) || !integer(value.char_start, 0, 262143) || !integer(value.char_end, 1, 262144) ||
      !bounded(value.quote, 1, 2000) || /[\uD800-\uDFFF]/u.test(value.quote) || value.char_end <= value.char_start ||
      value.char_end - value.char_start !== [...value.quote].length || value.url !== `/api/v1/materials/${value.material_id}`) return invalid()
  return { ...value } as Citation
}
export function parseSearch(value: unknown): SearchResult {
  if (!shape(value, ['items', 'mode']) || value.mode !== 'keyword' || !Array.isArray(value.items) || value.items.length > 4) return invalid()
  const items = value.items.map(parseCitation)
  if (new Set(items.map(item => item.chunk_id)).size !== items.length) return invalid()
  return { items, mode: 'keyword' }
}
export function checkCitation(detail: MaterialDetail, citation: Citation) {
  const trusted = parseCitation(citation)
  if (trusted.material_id !== detail.material.id || trusted.material_version !== detail.material.version || trusted.title !== detail.material.title ||
      [...detail.body].slice(trusted.char_start, trusted.char_end).join('') !== trusted.quote) return invalid()
}
export function materialRoute(path: string): { kind: 'list' | 'upload' } | { kind: 'detail'; id: string } | undefined {
  if (path === '/app/materials') return { kind: 'list' }
  if (path === '/app/materials/upload') return { kind: 'upload' }
  const match = /^\/app\/materials\/([^/]+)$/.exec(path)
  return match && validId(match[1]) ? { kind: 'detail', id: match[1] } : undefined
}
export class UploadValidationError extends Error {
  field: 'title' | 'file'
  constructor(field: 'title' | 'file', message: string) { super(message); this.field = field }
}
export function validateTitle(value: string) {
  const title = trimSpace(value)
  if (!text(title, 200)) throw new UploadValidationError('title', '标题须为 1–200 个字符，且不能包含控制字符。')
  return title
}
export async function validateUpload(payload: UploadPayload): Promise<UploadPayload> {
  const title = validateTitle(payload.title)
  const file = payload.file
  if (!(file instanceof File) || !/\.txt$/i.test(file.name) || file.size < 1 || file.size > 262144) throw new UploadValidationError('file', '请选择 1–262144 字节的 UTF-8 .txt 文件。')
  let body: string
  try { body = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(await file.arrayBuffer()) }
  catch { throw new UploadValidationError('file', '文件必须使用有效的 UTF-8 编码。') }
  if (/\p{Cc}/u.test(body.replace(/[\t\r\n]/g, '')) || !trimSpace(body.replace(/^\uFEFF/u, '').replace(/\r\n?/g, '\n'))) throw new UploadValidationError('file', '文件正文不能为空，且不能包含制表符、换行之外的控制字符。')
  return { title, file }
}
