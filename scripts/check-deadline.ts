import { readFileSync } from 'node:fs'
import { fetchPost, postUrlFromInput } from '../server/instagram.ts'

type CheckFile = {
  before: string
  posts: Array<{ name: string; url: string; users: string[] }>
}

type Hit = { at: Date; text: string }

function usernameOf(value: string): string {
  return value.trim().replace(/^@+/, '').toLowerCase()
}

function formatKuwait(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kuwait',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date)
}

const file = process.argv[2]
if (!file) {
  console.error('Usage: node --experimental-strip-types scripts/check-deadline.ts checks.json')
  process.exit(1)
}

const input = JSON.parse(readFileSync(file, 'utf8')) as CheckFile
const cutoff = new Date(input.before)
if (Number.isNaN(cutoff.getTime())) throw new Error(`Invalid cutoff: ${input.before}`)

console.log(`Cutoff: ${formatKuwait(cutoff)} Kuwait`)

for (const post of input.posts) {
  const url = postUrlFromInput(post.url)
  process.stderr.write(`Fetching ${post.name}...\n`)
  const result = await fetchPost(url)
  const byUser = new Map<string, Hit[]>()
  let missingTime = 0
  for (const comment of result.comments) {
    if (!comment.timestamp) {
      missingTime += 1
      continue
    }
    const at = new Date(comment.timestamp)
    const key = usernameOf(comment.username)
    const list = byUser.get(key) ?? []
    list.push({ at, text: comment.text })
    byUser.set(key, list)
  }
  for (const list of byUser.values()) list.sort((a, b) => a.at.getTime() - b.at.getTime())

  console.log(`\n${post.name}  ${url}`)
  console.log(`Account: ${result.accountUsername || 'unknown'}  comments read: ${result.comments.length}${result.commentsCount ? ` of ${result.commentsCount}` : ''}`)
  if (missingTime) console.log(`Comments without a time: ${missingTime}`)

  for (const raw of post.users) {
    const name = usernameOf(raw)
    const hits = byUser.get(name) ?? []
    if (hits.length === 0) {
      console.log(`- @${name}: NOT FOUND`)
      continue
    }
    const early = hits.filter((hit) => hit.at.getTime() < cutoff.getTime())
    const first = hits[0]
    const verdict = early.length > 0 ? 'BEFORE' : 'AFTER'
    const shown = early[0] ?? first
    if (!first || !shown) continue
    console.log(`- @${name}: ${verdict}  first ${formatKuwait(first.at)}  comments ${hits.length}  early ${early.length}`)
    console.log(`  ${shown.text.replace(/\s+/g, ' ').slice(0, 160)}`)
  }
}
