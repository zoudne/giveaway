import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DrawPanel } from './components/DrawPanel.tsx'
import { EntryTable } from './components/EntryTable.tsx'
import { ImportPanel } from './components/ImportPanel.tsx'
import { ScoreBoard } from './components/ScoreBoard.tsx'
import { armCeremony } from './lib/ceremony.ts'
import { CONTEST, KLARAIG_DRAW } from './lib/contest.ts'
import { formatScore, sameScore } from './lib/parse.ts'
import { drawPool, pickWinners, prepareEntries } from './lib/prepare.ts'
import { loadData, saveData } from './lib/storage.ts'
import { EMPTY_DATA, type AppData, type RawComment, type Score } from './lib/types.ts'

export default function App() {
  const [data, setData] = useState<AppData>(() => loadData())
  const [notice, setNotice] = useState('')
  const [spinning, setSpinning] = useState(false)
  const [stage, setStage] = useState(false)
  const [sound, setSound] = useState(() => {
    try {
      return localStorage.getItem('giveaway-sound') !== 'off'
    } catch {
      return true
    }
  })
  const [spinRequest, setSpinRequest] = useState<{ id: number; names: string[]; targets: string[] }>({
    id: 0,
    names: [],
    targets: [],
  })
  const pendingKeys = useRef<string[]>([])

  useEffect(() => {
    saveData(data)
  }, [data])

  useEffect(() => {
    try {
      localStorage.setItem('giveaway-sound', sound ? 'on' : 'off')
    } catch {
      /* The draw still works if the browser blocks storage. */
    }
  }, [sound])

  useEffect(() => {
    function onFullscreen() {
      if (!document.fullscreenElement) setStage(false)
    }
    document.addEventListener('fullscreenchange', onFullscreen)
    return () => document.removeEventListener('fullscreenchange', onFullscreen)
  }, [])

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

  function loadKlaraigDraw() {
    const comments: RawComment[] = KLARAIG_DRAW.names.map((entry, order) => ({
      id: `klaraig-${entry.username}`,
      username: entry.username,
      text: entry.text,
      order,
      missingUser: false,
    }))
    setData((current) => ({
      ...current,
      actual: { saudi: 1, kuwait: 0 },
      handle: KLARAIG_DRAW.handle,
      requiredMentions: 2,
      commentDeadline: '',
      comments,
      excluded: {},
      overrides: {},
      winnerKeys: [],
      replacedKeys: [],
    }))
    setNotice(`سحب كلاريج جاهز على ${comments.length} أسماء فقط. النتيجة ١–٠.`)
  }

  function drawFresh() {
    if (spinning || eligible.length === 0) return
    if (sound) armCeremony()
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

  const drawRef = useRef(drawFresh)
  useEffect(() => {
    drawRef.current = drawFresh
  })

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.code !== 'Space') return
      const target = event.target
      if (target instanceof HTMLElement) {
        const tag = target.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return
      }
      event.preventDefault()
      drawRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  async function toggleStage() {
    const next = !stage
    setStage(next)
    try {
      if (next) {
        if (!document.fullscreenElement) await document.documentElement.requestFullscreen()
      } else if (document.fullscreenElement) {
        await document.exitFullscreen()
      }
    } catch {
      /* Fullscreen can be denied; the stage layout still applies. */
    }
  }

  const steps = [
    { label: 'التعليقات', done: data.comments.length > 0, detail: data.comments.length > 0 ? String(data.comments.length) : 'الصق الرابط' },
    {
      label: 'النتيجة',
      done: data.actual !== null,
      detail: data.actual ? formatScore(data.actual) : 'بعد الصافرة',
    },
    {
      label: 'السحب',
      done: winners.length > 0,
      detail: winners.length > 0 ? `${winners.length} فائزين` : 'القرص',
    },
  ]

  return (
    <div className={`page${stage ? ' is-stage' : ''}${data.comments.length > 0 ? ' has-show' : ''}`}>
      <header className="mast">
        <div className="mast-top">
          <p className="brand">
            <i className="live-dot" aria-hidden="true" />
            سحب مباشر
          </p>
          <div className="mast-actions no-print">
            <button type="button" className="stage-btn" aria-pressed={stage} onClick={() => void toggleStage()}>
              {stage ? 'إنهاء العرض' : 'شاشة العرض'}
            </button>
            <button type="button" className="ghost" aria-pressed={sound} onClick={() => setSound((current) => !current)}>
              {sound ? 'الصوت يعمل' : 'الصوت متوقف'}
            </button>
            <a href={CONTEST.postUrl} target="_blank" rel="noreferrer">
              المنشور
            </a>
            <button
              type="button"
              className="ghost operator"
              onClick={() => {
                if (!window.confirm('تمسح النتيجة والتعليقات والفائزين من هذا المتصفح؟')) return
                setData(EMPTY_DATA)
                setNotice('تم مسح بيانات المسابقة من هذا المتصفح.')
              }}
            >
              مسح
            </button>
          </div>
        </div>
        <p className="prize-pill">
          {data.winnerCount} فائزين
        </p>
        <h1>
          <span>{CONTEST.home}</span>
          <span className="vs">×</span>
          <span>{CONTEST.away}</span>
        </h1>
        <p className="lede">
          يفوز من طابق النتيجة وكتب منشن {data.requiredMentions} أشخاص. كل توقع مختلف يخرج من القرص تلقائيًا.
        </p>
      </header>

      {notice ? (
        <p className="notice no-print" data-testid="notice" role="status">
          {notice}
        </p>
      ) : null}

      <ol className="steps operator no-print">
        {steps.map((step, index) => (
          <li key={step.label} className={step.done ? 'done' : undefined}>
            <span>{index + 1}</span>
            <div>
              <strong>{step.label}</strong>
              <small>
                <bdi>{step.detail}</bdi>
              </small>
            </div>
          </li>
        ))}
      </ol>

      <ScoreBoard
        key={data.actual ? `${data.actual.saudi}-${data.actual.kuwait}` : 'empty'}
        actual={data.actual}
        correctCount={correctCount}
        onSave={saveActual}
      />

      <div className="no-print operator control-room">
        <ImportPanel
          handle={data.handle}
          requiredMentions={data.requiredMentions}
          winnerCount={data.winnerCount}
          commentCount={data.comments.length}
          commentDeadline={data.commentDeadline}
          onDeadline={(commentDeadline) =>
            setData((current) => ({ ...current, commentDeadline, winnerKeys: [], replacedKeys: [] }))
          }
          onHandle={(handle) => setData((current) => ({ ...current, handle }))}
          onRequiredMentions={(requiredMentions) =>
            setData((current) => ({ ...current, requiredMentions, winnerKeys: [], replacedKeys: [] }))
          }
          onWinnerCount={(winnerCount) =>
            setData((current) => ({ ...current, winnerCount, winnerKeys: [], replacedKeys: [] }))
          }
          onComments={setComments}
          onKlaraigDraw={loadKlaraigDraw}
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
        sound={sound}
        spinRequest={spinRequest}
        poolNames={eligible.map(entryLabel)}
        onSpinDone={finishSpin}
        onDraw={drawFresh}
      />

      <div className="no-print operator review">
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
