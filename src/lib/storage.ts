import { EMPTY_DATA, type AppData, type FollowMark, type Scope } from './types.ts'
import type { RawComment, Score } from './types.ts'

const KEY = 'ksa-kwt-giveaway-v1'

function isScore(value: unknown): value is Score {
  if (!value || typeof value !== 'object') return false
  const score = value as Score
  return Number.isInteger(score.saudi) && Number.isInteger(score.kuwait)
}

function isComment(value: unknown): value is RawComment {
  if (!value || typeof value !== 'object') return false
  const comment = value as RawComment
  return typeof comment.id === 'string' && typeof comment.username === 'string' && typeof comment.text === 'string'
}

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return EMPTY_DATA
    const data: unknown = JSON.parse(raw)
    if (!data || typeof data !== 'object') return EMPTY_DATA
    const record = data as Partial<AppData>
    const scope: Scope = record.scope === 'correct' ? 'correct' : 'qualified'
    return {
      ...EMPTY_DATA,
      actual: isScore(record.actual) ? record.actual : null,
      handle: typeof record.handle === 'string' ? record.handle : '',
      requiredMentions:
        typeof record.requiredMentions === 'number' && record.requiredMentions > 0
          ? record.requiredMentions
          : 3,
      winnerCount:
        typeof record.winnerCount === 'number' && record.winnerCount > 0 ? record.winnerCount : 5,
      commentDeadline: typeof record.commentDeadline === 'string' ? record.commentDeadline : '',
      requireFollow: record.requireFollow === true,
      scope,
      comments: Array.isArray(record.comments) ? record.comments.filter(isComment) : [],
      follows: sanitizeFollows(record.follows),
      overrides: sanitizeOverrides(record.overrides),
      excluded: sanitizeFlags(record.excluded),
      winnerKeys: stringList(record.winnerKeys),
      replacedKeys: stringList(record.replacedKeys),
    }
  } catch {
    return EMPTY_DATA
  }
}

export function saveData(data: AppData): void {
  localStorage.setItem(KEY, JSON.stringify(data))
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

function sanitizeFlags(value: unknown): Record<string, boolean> {
  if (!value || typeof value !== 'object') return {}
  const flags: Record<string, boolean> = {}
  for (const [key, item] of Object.entries(value)) {
    if (item === true) flags[key] = true
  }
  return flags
}

function sanitizeFollows(value: unknown): Record<string, FollowMark> {
  if (!value || typeof value !== 'object') return {}
  const follows: Record<string, FollowMark> = {}
  for (const [key, item] of Object.entries(value)) {
    if (item === 'yes' || item === 'no') follows[key] = item
  }
  return follows
}

function sanitizeOverrides(value: unknown): AppData['overrides'] {
  if (!value || typeof value !== 'object') return {}
  const overrides: AppData['overrides'] = {}
  for (const [key, item] of Object.entries(value)) {
    if (item === 'cleared') overrides[key] = 'cleared'
    else if (isScore(item)) overrides[key] = item
  }
  return overrides
}
