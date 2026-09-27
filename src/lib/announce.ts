import type { ViewEntry } from './prepare.ts'
import type { Score } from './types.ts'

export function announcement(_actual: Score | null, winners: ViewEntry[]): string {
  const lines = [
    'الفائزون:',
    ...winners.map((winner, index) => {
      const name = winner.comment.missingUser ? 'مشارك بدون اسم' : `@${winner.comment.username}`
      return `${index + 1}. ${name}`
    }),
  ]
  return lines.join('\n')
}
