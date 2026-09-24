import { CONTEST } from './contest.ts'
import { formatScore } from './parse.ts'
import type { ViewEntry } from './prepare.ts'
import type { Score } from './types.ts'

export function announcement(actual: Score | null, winners: ViewEntry[]): string {
  const lines = [
    `نتيجة ${CONTEST.home} × ${CONTEST.away}: ${actual ? formatScore(actual) : 'لم تُدخل بعد'}`,
    '',
    'الفائزون:',
    ...winners.map((winner, index) => {
      const name = winner.comment.missingUser ? 'مشارك بدون اسم' : `@${winner.comment.username}`
      const prediction = winner.prediction ? formatScore(winner.prediction) : 'بدون توقع'
      return `${index + 1}. ${name} — التوقع ${prediction}`
    }),
  ]
  return lines.join('\n')
}
