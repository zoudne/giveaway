import assert from 'node:assert/strict'
import { importComments } from '../src/lib/importComments.ts'
import { extractMentions, parseScore } from '../src/lib/parse.ts'
import { drawPool, prepareEntries } from '../src/lib/prepare.ts'
import { SAMPLE_COMMENTS } from '../src/lib/sample.ts'
import { EMPTY_DATA } from '../src/lib/types.ts'

function score(text: string) {
  const parsed = parseScore(text)
  return parsed ? `${parsed.saudi}-${parsed.kuwait}` : null
}

assert.equal(score('2-1 @ahmad @sara @faisal'), '2-1')
assert.equal(score('توقعي ٢:١ @mona @ali @noor'), '2-1')
assert.equal(score('السعودية 1 الكويت 0 @laila @omar @huda'), '1-0')
assert.equal(score('الكويت 2 السعودية 3 @jad @rami @tura'), '3-2')
assert.equal(score('٠-٠ @a @b @c'), '0-0')
assert.equal(score('صفر-صفر @w @e @r'), '0-0')
assert.equal(score('2 × 1'), '2-1')
assert.equal(score('ksa 4 kuwait 2'), '4-2')
assert.equal(score('تعادل'), null)
assert.equal(score('بالتوفيق @a @b @c'), null)
assert.equal(score('منشن 3 اشخاص'), null)
assert.deepEqual(extractMentions('@Store @a @b @c 1-0', ['store']), ['a', 'b', 'c'])
assert.deepEqual(extractMentions('@a @A @b @c', []), ['a', 'b', 'c'])

const blocks = importComments('@noura\n2-1 @ahmad @sara @faisal\n\n@fahad\n1-0 @a @b @c')
assert.equal(blocks.length, 2)
assert.equal(blocks[0]?.username, 'noura')
assert.equal(blocks[1]?.username, 'fahad')

const lines = importComments('noura | 2-1 @ahmad @sara @faisal\nfahad | 1-0 @a @b @c')
assert.equal(lines.length, 2)
assert.equal(score(lines[0]?.text ?? ''), '2-1')

const waiting = prepareEntries({ ...EMPTY_DATA, comments: SAMPLE_COMMENTS })
assert.equal(waiting.filter((entry) => entry.rulesMet).length, 0)

const data = { ...EMPTY_DATA, comments: SAMPLE_COMMENTS, actual: { saudi: 2, kuwait: 1 } }
const entries = prepareEntries(data)
const ready = entries.filter((entry) => entry.rulesMet)
assert.deepEqual(
  ready.map((entry) => entry.comment.username),
  ['noura', 'hassan'],
)
assert.equal(entries.find((entry) => entry.comment.username === 'fahad')?.correct, false)
assert.equal(entries.find((entry) => entry.comment.username === 'fahad')?.rulesMet, false)
assert.equal(drawPool(entries, []).length, 2)

console.log('parse checks passed')
