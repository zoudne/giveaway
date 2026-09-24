export type Score = {
  saudi: number
  kuwait: number
}

export type RawComment = {
  id: string
  username: string
  text: string
  timestamp?: string
  order: number
  missingUser: boolean
  userId?: string
  following?: boolean | null
}

export type Scope = 'qualified' | 'correct'

export type FollowMark = 'yes' | 'no'

export type AppData = {
  actual: Score | null
  handle: string
  requiredMentions: number
  winnerCount: number
  commentDeadline: string
  requireFollow: boolean
  scope: Scope
  comments: RawComment[]
  follows: Record<string, FollowMark>
  overrides: Record<string, Score | 'cleared'>
  excluded: Record<string, boolean>
  winnerKeys: string[]
  replacedKeys: string[]
}

export const EMPTY_DATA: AppData = {
  actual: null,
  handle: '',
  requiredMentions: 3,
  winnerCount: 5,
  commentDeadline: '',
  requireFollow: false,
  scope: 'qualified',
  comments: [],
  follows: {},
  overrides: {},
  excluded: {},
  winnerKeys: [],
  replacedKeys: [],
}
