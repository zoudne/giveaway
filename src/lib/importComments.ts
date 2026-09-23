import type { RawComment } from './types.ts'

type Draft = Omit<RawComment, 'order'>

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function hash(input: string): string {
  let h = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(36)
}

function cleanUsername(value: string): string {
  return value.replace(/^@+/, '').trim()
}

function draft(username: string, text: string, id?: string, timestamp?: string): Draft | null {
  const body = text.trim()
  if (!body) return null
  const user = cleanUsername(username)
  const missingUser = !user
  return {
    id: id?.trim() || `p-${hash(`${user}\n${body}`)}`,
    username: missingUser ? 'بدون-اسم' : user,
    text: body,
    timestamp: timestamp?.trim() || undefined,
    missingUser,
  }
}

function readUsername(obj: Record<string, unknown>): string {
  if (typeof obj.username === 'string') return obj.username
  if (typeof obj.user === 'string') return obj.user
  if (typeof obj.author === 'string') return obj.author
  if (isRecord(obj.owner) && typeof obj.owner.username === 'string') return obj.owner.username
  if (isRecord(obj.from) && typeof obj.from.username === 'string') return obj.from.username
  if (isRecord(obj.user) && typeof obj.user.username === 'string') return obj.user.username
  return ''
}

function readText(obj: Record<string, unknown>): string {
  for (const key of ['text', 'comment', 'message', 'caption', 'content']) {
    if (typeof obj[key] === 'string') return obj[key]
  }
  return ''
}

function fromObjects(list: unknown[]): Draft[] {
  const comments: Draft[] = []
  for (const item of list) {
    if (!isRecord(item)) continue
    const row = draft(
      readUsername(item),
      readText(item),
      typeof item.id === 'string' ? item.id : undefined,
      typeof item.timestamp === 'string' ? item.timestamp : undefined,
    )
    if (row) comments.push(row)
  }
  return comments
}

function fromJson(raw: string): Draft[] | null {
  try {
    const data: unknown = JSON.parse(raw)
    if (Array.isArray(data)) return fromObjects(data)
    if (!isRecord(data)) return null
    if (Array.isArray(data.data)) return fromObjects(data.data)
    if (Array.isArray(data.comments)) return fromObjects(data.comments)
    return null
  } catch {
    return null
  }
}

function delimiterOf(line: string): ',' | ';' | '\t' {
  const commas = (line.match(/,/g) ?? []).length
  const semis = (line.match(/;/g) ?? []).length
  const tabs = (line.match(/\t/g) ?? []).length
  if (tabs >= commas && tabs >= semis && tabs > 0) return '\t'
  if (semis > commas) return ';'
  return ','
}

function parseCsv(raw: string, delimiter: ',' | ';' | '\t'): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i]
    if (quoted) {
      if (ch === '"') {
        if (raw[i + 1] === '"') {
          cell += '"'
          i += 1
        } else {
          quoted = false
        }
      } else {
        cell += ch
      }
      continue
    }
    if (ch === '"') {
      quoted = true
    } else if (ch === delimiter) {
      row.push(cell)
      cell = ''
    } else if (ch === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else if (ch !== '\r') {
      cell += ch
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  return rows.filter((cells) => cells.some((value) => value.trim()))
}

function headerIndex(headers: string[], pattern: RegExp): number {
  return headers.findIndex((header) => pattern.test(header))
}

function fromCsv(raw: string): Draft[] | null {
  const firstLine = raw.split(/\r?\n/, 1)[0] ?? ''
  if (!/[,;\t]/.test(firstLine)) return null
  const delimiter = delimiterOf(firstLine)
  const rows = parseCsv(raw, delimiter)
  if (rows.length < 2) return null
  const headers = rows[0].map((cell) => cell.trim().toLowerCase())
  const joined = headers.join(' ')
  const hasHeader = /user|name|text|comment|تعليق|مستخدم|اسم|caption/.test(joined)
  const start = hasHeader ? 1 : 0
  const userIndex = hasHeader ? headerIndex(headers, /user|name|مستخدم|اسم|author/) : 0
  const textIndex = hasHeader ? headerIndex(headers, /text|comment|message|caption|تعليق|content/) : 1
  if (userIndex < 0 || textIndex < 0) return null
  const comments: Draft[] = []
  for (const row of rows.slice(start)) {
    const item = draft(row[userIndex] ?? '', row[textIndex] ?? '')
    if (item) comments.push(item)
  }
  return comments
}

const USER_ONLY = /^(?:@)?([A-Za-z0-9._]{1,30})$/
const USER_INLINE = /^(?:@)?([A-Za-z0-9._]{1,30})\s*(?:\||:)\s+([\s\S]+)$/

function usableName(name: string): boolean {
  return !/^\d+$/.test(name)
}

function fromInline(line: string): Draft | null {
  const inline = USER_INLINE.exec(line.trim())
  if (!inline || !usableName(inline[1])) return null
  return draft(inline[1], inline[2])
}

function fromBlocks(raw: string): Draft[] {
  const blocks = raw
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
  const comments: Draft[] = []
  for (const block of blocks) {
    const lines = block
      .split(/\n/)
      .map((line) => line.trim())
      .filter(Boolean)
    if (lines.length === 0) continue
    const onlyUser = USER_ONLY.exec(lines[0])
    if (onlyUser && usableName(onlyUser[1]) && lines.length > 1) {
      const item = draft(onlyUser[1], lines.slice(1).join('\n'))
      if (item) comments.push(item)
      continue
    }
    const inline = fromInline(block.replace(/\n/g, ' '))
    if (inline) {
      comments.push(inline)
      continue
    }
    const item = draft('', lines.join('\n'))
    if (item) comments.push(item)
  }
  return comments
}

function fromLines(raw: string): Draft[] {
  if (/\n\s*\n/.test(raw)) return fromBlocks(raw)
  return raw
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      const item = fromInline(line) ?? draft('', line)
      return item ? [item] : []
    })
}

export function importComments(raw: string): Draft[] {
  const trimmed = raw.trim()
  if (!trimmed) return []
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    const json = fromJson(trimmed)
    if (json && json.length > 0) return json
  }
  const first = trimmed.split(/\r?\n/, 1)[0] ?? ''
  if (/user|text|comment|تعليق|مستخدم|username/i.test(first) && /[,;\t]/.test(first)) {
    const csv = fromCsv(trimmed)
    if (csv && csv.length > 0) return csv
  }
  return fromLines(trimmed)
}

export function assignOrder(comments: Draft[], start = 0): RawComment[] {
  return comments.map((comment, index) => ({ ...comment, order: start + index }))
}
