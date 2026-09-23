import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DrawPanel } from './components/DrawPanel.tsx'
import { EntryTable } from './components/EntryTable.tsx'
import { ImportPanel } from './components/ImportPanel.tsx'
import { ScoreBoard } from './components/ScoreBoard.tsx'
import { CONTEST } from './lib/contest.ts'
import { formatScore, sameScore } from './lib/parse.ts'
import { drawPool, pickWinners, prepareEntries } from './lib/prepare.ts'
import { loadData, saveData } from './lib/storage.ts'
import { EMPTY_DATA, type AppData, type RawComment, type Score } from './lib/types.ts'

export default function App() {
  const [data, setData] = useState<AppData>(() => loadData())
  const [notice, setNotice] = useState('')
  const [spinning, setSpinning] = useState(false)
  const [spinRequest, setSpinRequest] = useState<{ id: number; names: string[]; targets: string[] }>({
    id: 0,
    names: [],
    targets: [],
  })
  const pendingKeys = useRef<string[]>([])

  useEffect(() => {
    saveData(data)
  }, [data])

  const entries = useMemo(() => prepareEntries(data), [data])
  const eligible = useMemo(() => drawPool(entries, []), [entries])
  const winners = data.winnerKeys.flatMap((key) => {
    const entry = entries.find((item) => item.key === key)
    return entry ? [entry] : []
  })
  const readyCount = entries.filter((entry) => entry.rulesMet).length
  const correctCount = data.actual
    ? entries.filter((entry) => entry.correct === true && entry.mentionsOk && !entry.excluded).length
    : null

  const finishSpin = useCallback(() => {
    setData((current) => ({ ...current, winnerKeys: pendingKeys.current, replacedKeys: [] }))
    setSpinning(false)
    setNotice('تم السحب من أصحاب التوقع المطابق.')
  }, [])

  function saveActual(next: Score | null) {
    setData((current) => {
      const unchanged =
        current.actual === null ? next === null : next !== null && sameScore(current.actual, next)
      return {
        ...current,
        actual: next,
        winnerKeys: unchanged ? current.winnerKeys : [],
        replacedKeys: unchanged ? current.replacedKeys : [],
      }
    })
    setNotice(
      next
        ? `حُفظت النتيجة ${formatScore(next)}. أي توقع مختلف يُستبعد من السحب.`
        : 'مُسحت النتيجة الفعلية. لن يُسحب أحد حتى تُحفظ النتيجة.',
    )
  }

  function setComments(comments: RawComment[], mode: 'replace' | 'append') {
    setData((current) => {
      if (mode === 'append') {
        const ids = new Set(current.comments.map((comment) => comment.id))
        const extra = comments
          .filter((comment) => !ids.has(comment.id))
          .map((comment, index) => ({ ...comment, order: current.comments.length + index }))
        return { ...current, comments: [...current.comments, ...extra] }
      }
      return { ...current, comments, winnerKeys: [], replacedKeys: [] }
    })
  }

  function drawFresh() {
    if (spinning || eligible.length === 0) return
    const picked = pickWinners(eligible, data.winnerCount)
    pendingKeys.current = picked.map((entry) => entry.key)
    const targets = picked.map(entryLabel)
    setSpinRequest((current) => ({ id: current.id + 1, names: eligible.map(entryLabel), targets }))
    setSpinning(true)
  }

  function setOverride(key: string, commentId: string, value: Score | 'cleared' | 'auto') {
    setData((current) => {
      const overrides = { ...current.overrides }
      if (value === 'auto') delete overrides[commentId]
      else overrides[commentId] = value
      return {
        ...current,
        overrides,
        winnerKeys: current.winnerKeys.filter((winner) => winner !== key),
      }
    })
  }

  return (
    <div className="page">
      <header className="hero">
        <div>
          <p className="eyebrow">قرص السحب</p>
          <h1>
            <span>{CONTEST.home}</span>
            <span className="vs">×</span>
            <span>{CONTEST.away}</span>
          </h1>
          <p className="lede">
            {CONTEST.prize} لـ {data.winnerCount} فائزين. المقارنة تلقائية: يُستبعد كل توقع غير مطابق، ويبقى من كتب منشن{' '}
            {data.requiredMentions} أشخاص.
          </p>
        </div>
        <div className="hero-side no-print">
          <a href={CONTEST.postUrl} target="_blank" rel="noreferrer">
            فتح المنشور
          </a>
          <button
            type="button"
            className="ghost"
            onClick={() => {
              if (!window.confirm('تمسح النتيجة والتعليقات والفائزين من هذا المتصفح؟')) return
              setData(EMPTY_DATA)
              setNotice('تم مسح بيانات المسابقة من هذا المتصفح.')
            }}
          >
            مسح البيانات
          </button>
        </div>
      </header>

      {notice ? (
        <p className="notice no-print" data-testid="notice" role="status">
          {notice}
        </p>
      ) : null}

      <ScoreBoard
        key={data.actual ? `${data.actual.saudi}-${data.actual.kuwait}` : 'empty'}
        actual={data.actual}
        correctCount={correctCount}
        onSave={saveActual}
      />

      <div className="no-print">
        <ImportPanel
          handle={data.handle}
          requiredMentions={data.requiredMentions}
          commentCount={data.comments.length}
          onHandle={(handle) => setData((current) => ({ ...current, handle }))}
          onRequiredMentions={(requiredMentions) =>
            setData((current) => ({ ...current, requiredMentions, winnerKeys: [], replacedKeys: [] }))
          }
          onComments={setComments}
          onNotice={setNotice}
        />
      </div>

      <section className="stats no-print" data-testid="stats">
        <Stat label="التعليقات" value={data.comments.length} testId="stat-comments" />
        <Stat label="الحسابات" value={entries.length} testId="stat-accounts" />
        <Stat label="توقع مطابق" value={correctCount === null ? '—' : correctCount} testId="stat-correct" />
        <Stat label="مستوفون" value={readyCount} testId="stat-ready" />
      </section>

      <DrawPanel
        data={data}
        poolCount={eligible.length}
        winners={winners}
        spinning={spinning}
        spinRequest={spinRequest}
        poolNames={eligible.map(entryLabel)}
        onSpinDone={finishSpin}
        onWinnerCount={(winnerCount) =>
          setData((current) => ({ ...current, winnerCount, winnerKeys: [], replacedKeys: [] }))
        }
        onDraw={drawFresh}
      />

      <div className="no-print">
        <EntryTable
          entries={entries}
          onExclude={(key) =>
            setData((current) => {
              const excluded = { ...current.excluded, [key]: !current.excluded[key] }
              return {
                ...current,
                excluded,
                winnerKeys: excluded[key] ? current.winnerKeys.filter((winner) => winner !== key) : current.winnerKeys,
              }
            })
          }
          onOverride={setOverride}
        />
      </div>
    </div>
  )
}

function entryLabel(entry: { comment: { missingUser: boolean; username: string } }): string {
  return entry.comment.missingUser ? 'بدون اسم' : `@${entry.comment.username}`
}

function Stat({ label, value, testId }: { label: string; value: number | string; testId: string }) {
  return (
    <article className="stat">
      <span>{label}</span>
      <strong data-testid={testId}>{value}</strong>
    </article>
  )
}
