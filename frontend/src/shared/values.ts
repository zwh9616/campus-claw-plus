export type RecordValue = Record<string, unknown>
export const object = (v: unknown): v is RecordValue => typeof v === 'object' && v !== null && !Array.isArray(v)
export const shape = (v: unknown, keys: string[]): v is RecordValue =>
  object(v) && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k))
export const bounded = (v: unknown, min: number, max: number): v is string =>
  typeof v === 'string' && [...v].length >= min && [...v].length <= max
export const validId = (v: unknown): v is string =>
  typeof v === 'string' && /^[1-9][0-9]{0,18}$/.test(v) && BigInt(v) <= 9223372036854775807n
export const timestamp = (v: unknown): v is string => typeof v === 'string' &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === v
