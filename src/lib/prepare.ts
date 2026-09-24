import { extractMentions, parseScore, sameScore } from './parse.ts'
import type { AppData, RawComment, Score } from './types.ts'

export type ViewEntry = {
  key: string
  comment: RawComment
  others: RawComment[]
  prediction: Score | null
  mentions: string[]
  mentionsOk: boolean
  onTime: boolean
  rulesMet: boolean
  correct: boolean | null
  excluded: boolean
}

function excludeNames(comment: RawComment, handle: string): string[] {
  return [comment.username, handle]
}

export function resolvePrediction(comment: RawComment, overrides: AppData['overrides']): Score | null {
  const override = overrides[comment.id]
  if (override === 'cleared') return null
  if (override) return override
  return parseScore(comment.text)
}

function quality(comment: RawComment, data: AppData): number {
  const prediction = resolvePrediction(comment, data.overrides)
  const mentions = extractMentions(comment.text, excludeNames(comment, data.handle)).length
  const mentionsOk = mentions >= data.requiredMentions
  const correct = data.actual && prediction ? sameScore(prediction, data.actual) : false
  let score = 0
  if (prediction && mentionsOk) score = 50
  else if (prediction) score = 20
  else if (mentionsOk) score = 10
  if (correct) score += 40
  return score
}

function recency(comment: RawComment): number {
  if (comment.timestamp) {
    const time = Date.parse(comment.timestamp)
    if (!Number.isNaN(time)) return time
  }
  return -comment.order
}

function groupKey(comment: RawComment): string {
  if (comment.missingUser) return `id:${comment.id}`
  return `user:${comment.username.trim().toLowerCase()}`
}

export function commentOnTime(comment: RawComment, deadline: string): boolean {
  if (!deadline) return true
  const limit = Date.parse(deadline)
  const time = comment.timestamp ? Date.parse(comment.timestamp) : Number.NaN
  if (Number.isNaN(limit) || Number.isNaN(time)) return false
  return time < limit
}

function better(a: RawComment, b: RawComment, data: AppData): RawComment {
  const aOn = commentOnTime(a, data.commentDeadline)
  const bOn = commentOnTime(b, data.commentDeadline)
  if (aOn !== bOn) return aOn ? a : b
  const qa = quality(a, data)
  const qb = quality(b, data)
  if (qa !== qb) return qa > qb ? a : b
  return recency(a) >= recency(b) ? a : b
}

export function prepareEntries(data: AppData): ViewEntry[] {
  const groups = new Map<string, RawComment[]>()
  const order: string[] = []
  for (const comment of data.comments) {
    const key = groupKey(comment)
    const list = groups.get(key)
    if (list) {
      list.push(comment)
    } else {
      groups.set(key, [comment])
      order.push(key)
    }
  }

  return order.map((key) => {
    const list = groups.get(key) ?? []
    const comment = list.reduce((best, item) => better(best, item, data))
    const prediction = resolvePrediction(comment, data.overrides)
    const mentions = extractMentions(comment.text, excludeNames(comment, data.handle))
    const excluded = data.excluded[key] === true
    const mentionsOk = mentions.length >= data.requiredMentions
    const onTime = commentOnTime(comment, data.commentDeadline)
    let correct: boolean | null = null
    if (data.actual && prediction) correct = sameScore(prediction, data.actual)
    const rulesMet = mentionsOk && correct === true && !excluded && onTime
    return {
      key,
      comment,
      others: list.filter((item) => item.id !== comment.id),
      prediction,
      mentions,
      mentionsOk,
      onTime,
      rulesMet,
      correct,
      excluded,
    }
  })
}

export function drawPool(entries: ViewEntry[], skipKeys: string[]): ViewEntry[] {
  const skip = new Set(skipKeys)
  return entries.filter((entry) => !skip.has(entry.key) && entry.rulesMet)
}

export function pickWinners(pool: ViewEntry[], count: number): ViewEntry[] {
  const copy = [...pool]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = randomIndex(i + 1)
    const current = copy[i]
    copy[i] = copy[j]
    copy[j] = current
  }
  return copy.slice(0, Math.max(0, count))
}

function randomIndex(max: number): number {
  if (max <= 1) return 0
  const bucket = 0x100000000
  const limit = bucket - (bucket % max)
  const buf = new Uint32Array(1)
  let value = 0
  do {
    crypto.getRandomValues(buf)
    value = buf[0]
  } while (value >= limit)
  return value % max
}
