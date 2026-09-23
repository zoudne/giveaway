import type { Score } from './types.ts'

const DIGITS: Record<string, string> = {
  '٠': '0',
  '١': '1',
  '٢': '2',
  '٣': '3',
  '٤': '4',
  '٥': '5',
  '٦': '6',
  '٧': '7',
  '٨': '8',
  '٩': '9',
  '۰': '0',
  '۱': '1',
  '۲': '2',
  '۳': '3',
  '۴': '4',
  '۵': '5',
  '۶': '6',
  '۷': '7',
  '۸': '8',
  '۹': '9',
}

export function formatScore(score: Score): string {
  return `${score.saudi}–${score.kuwait}`
}

export function sameScore(a: Score, b: Score): boolean {
  return a.saudi === b.saudi && a.kuwait === b.kuwait
}

export function normalizeDigits(input: string): string {
  return input.replace(/[٠-٩۰-۹]/g, (ch) => DIGITS[ch] ?? ch)
}

function cleanForScore(input: string): string {
  return normalizeDigits(input)
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/@[A-Za-z0-9._]{1,30}/g, ' ')
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
}

export function extractMentions(text: string, exclude: string[]): string[] {
  const skip = new Set(
    exclude
      .map((name) => name.replace(/^@+/, '').trim().toLowerCase())
      .filter(Boolean),
  )
  const found: string[] = []
  const seen = new Set<string>()
  const re = /@[A-Za-z0-9._]{1,30}/g
  for (const match of text.matchAll(re)) {
    const index = match.index ?? 0
    const prev = index > 0 ? text[index - 1] : ''
    if (prev && /[\p{L}\p{N}._]/u.test(prev)) continue
    const name = match[0].slice(1).replace(/\.+$/g, '').toLowerCase()
    if (!name || skip.has(name) || seen.has(name)) continue
    seen.add(name)
    found.push(name)
  }
  return found
}

type Hit = { value: number; start: number; end: number }

function numberHits(text: string): Hit[] {
  const hits: Hit[] = []
  const re = /(?<![\p{L}\p{N}])صفر(?![\p{L}\p{N}])|(?<!\d)\d{1,2}(?!\d)/gu
  for (const match of text.matchAll(re)) {
    const raw = match[0]
    const value = raw === 'صفر' ? 0 : Number(raw)
    if (!Number.isInteger(value) || value > 20) continue
    const start = match.index ?? 0
    hits.push({ value, start, end: start + raw.length })
  }
  return hits
}

function findPair(text: string): Score | null {
  const re =
    /(?<![\p{L}\p{N}])(صفر|\d{1,2})(?![\p{L}\p{N}])\s*[-:xX×/–—,،]\s*(صفر|\d{1,2})(?![\p{L}\p{N}])/u
  const match = re.exec(text)
  if (!match) return null
  const saudi = match[1] === 'صفر' ? 0 : Number(match[1])
  const kuwait = match[2] === 'صفر' ? 0 : Number(match[2])
  return acceptScore(saudi, kuwait)
}

function nearestHit(hits: Hit[], teamStart: number, teamEnd: number): Hit | null {
  let best: Hit | null = null
  let bestRank = Infinity
  for (const hit of hits) {
    const dist = hit.start >= teamEnd ? hit.start - teamEnd : teamStart - hit.end
    if (dist < 0 || dist > 16) continue
    const afterPenalty = hit.start >= teamEnd ? 0 : 1
    const rank = dist * 2 + afterPenalty
    if (rank < bestRank) {
      best = hit
      bestRank = rank
    }
  }
  return best
}

function findTeamScore(text: string, hits: Hit[]): Score | null {
  const saudiRe = /السعوديه|سعوديه|سعودي|saudi|ksa/iu
  const kuwaitRe = /الكويت|كويتيه|كويتي|kuwait/iu
  const saudi = saudiRe.exec(text)
  const kuwait = kuwaitRe.exec(text)
  if (!saudi || !kuwait || saudi.index === undefined || kuwait.index === undefined) return null
  const saudiHit = nearestHit(hits, saudi.index, saudi.index + saudi[0].length)
  const kuwaitHit = nearestHit(hits, kuwait.index, kuwait.index + kuwait[0].length)
  if (!saudiHit || !kuwaitHit || saudiHit.start === kuwaitHit.start) return null
  return acceptScore(saudiHit.value, kuwaitHit.value)
}

function acceptScore(saudi: number, kuwait: number): Score | null {
  if (!Number.isInteger(saudi) || !Number.isInteger(kuwait)) return null
  if (saudi < 0 || kuwait < 0 || saudi > 20 || kuwait > 20) return null
  return { saudi, kuwait }
}

export function parseScore(text: string): Score | null {
  const cleaned = cleanForScore(text)
  const hits = numberHits(cleaned)
  const byTeam = findTeamScore(cleaned, hits)
  if (byTeam) return byTeam
  const pair = findPair(cleaned)
  if (pair) return pair
  if (hits.length === 2) return acceptScore(hits[0].value, hits[1].value)
  return null
}
