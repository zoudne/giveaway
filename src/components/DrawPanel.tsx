import { useCallback, useEffect, useRef, useState } from 'react'
import { PrizeWheel } from './PrizeWheel.tsx'
import { Confetti } from './Confetti.tsx'
import { announcement } from '../lib/announce.ts'
import { CONTEST } from '../lib/contest.ts'
import { formatScore } from '../lib/parse.ts'
import type { ViewEntry } from '../lib/prepare.ts'
import type { AppData } from '../lib/types.ts'

const RANKS = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن']

type Props = {
  data: AppData
  poolCount: number
  winners: ViewEntry[]
  spinning: boolean
  sound: boolean
  spinRequest: { id: number; names: string[]; targets: string[] }
  poolNames: string[]
  onSpinDone: () => void
  onDraw: () => void
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const area = document.createElement('textarea')
    area.value = text
    document.body.appendChild(area)
    area.select()
    document.execCommand('copy')
    area.remove()
  }
}

function rankTitle(index: number): string {
  const rank = RANKS[index]
  return rank ? `الفائز ${rank}` : `الفائز ${index + 1}`
}

export function DrawPanel({
  data,
  poolCount,
  winners,
  spinning,
  sound,
  spinRequest,
  poolNames,
  onSpinDone,
  onDraw,
}: Props) {
  const [liveNames, setLiveNames] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const [celebrate, setCelebrate] = useState(false)
  const wasSpinning = useRef(false)
  const onProgress = useCallback((names: string[]) => setLiveNames(names), [])
  const confirmed = winners.length > 0 && winners.every((winner) => winner.rulesMet)
  const waitingForScore = !data.actual && data.comments.length > 0
  const shortDraw = !spinning && winners.length > 0 && winners.length < data.winnerCount
  const slotCount = Math.min(data.winnerCount, poolCount)

  useEffect(() => {
    if (wasSpinning.current && !spinning && winners.length > 0) {
      setCelebrate(true)
      const timer = window.setTimeout(() => setCelebrate(false), 3200)
      wasSpinning.current = spinning
      return () => window.clearTimeout(timer)
    }
    wasSpinning.current = spinning
  }, [spinning, winners.length])

  return (
    <section className="panel draw-panel" id="draw-stage">
      <Confetti active={celebrate} />
      <div className="section-kicker">السحب</div>
      <h2>
        {data.winnerCount} فائزين · {CONTEST.prize}
      </h2>
      <div className="draw-layout">
        <PrizeWheel names={poolNames} request={spinRequest} sound={sound} onProgress={onProgress} onDone={onSpinDone} />
        <div className="draw-side">
      <button data-testid="draw-button" type="button" className={`draw-btn no-print${spinning ? ' is-hot' : ''}`} disabled={spinning || poolCount === 0} onClick={onDraw}>
        {spinning ? 'السحب جارٍ' : waitingForScore ? 'احفظ النتيجة أولًا' : poolCount === 0 ? 'بانتظار المشاركين' : winners.length > 0 ? `إعادة السحب · ${Math.min(data.winnerCount, poolCount)} من ${poolCount}` : `ابدأ السحب · ${Math.min(data.winnerCount, poolCount)} من ${poolCount}`}
      </button>
      <p className="hint no-print operator">مفتاح المسافة يبدأ السحب.</p>
      {poolCount === 0 && data.comments.length > 0 ? (
        <p className="form-error" data-testid="draw-empty">
          {waitingForScore
            ? 'احفظ النتيجة الفعلية أولًا. أي توقع مختلف يُستبعد تلقائيًا.'
            : 'لا يوجد مشارك جمع التوقع المطابق ومنشن العدد المطلوب.'}
        </p>
      ) : null}

      {spinning ? (
        <div className="ticket-grid" aria-live="polite">
          {Array.from({ length: slotCount }, (_, index) => {
            const name = liveNames[index]
            return (
              <article key={index} className={`ticket${name ? ' is-in' : ' is-wait'}`}>
                <span className="ticket-index">{rankTitle(index)}</span>
                <strong dir="ltr">{name ?? '…'}</strong>
                <p>{name ? 'توقف القرص' : 'في الانتظار'}</p>
              </article>
            )
          })}
        </div>
      ) : null}

      {winners.length > 0 && !spinning ? (
        <div data-testid="winners">
          {shortDraw ? <p className="hint operator no-print">عدد المستحقين أقل من المطلوب، فاختير كل من في النطاق.</p> : null}
          <div className="ticket-grid">
            {winners.map((winner, index) => (
              <article key={winner.key} className="ticket is-in" data-testid="winner-card">
                <span className="ticket-rank" aria-hidden="true">{index + 1}</span>
                <div>
                  <span className="ticket-index">{rankTitle(index)}</span>
                  <strong dir="ltr">{winner.comment.missingUser ? 'بدون اسم' : `@${winner.comment.username}`}</strong>
                  <p>
                    توقعه{' '}
                    {winner.prediction ? <bdi dir="ltr">{formatScore(winner.prediction)}</bdi> : 'غير مقروء'}
                    {data.actual ? (
                      <>
                        {' '}
                        · النتيجة <bdi dir="ltr">{formatScore(data.actual)}</bdi>
                      </>
                    ) : null}
                  </p>
                  <em className="stamp">مطابق</em>
                  {!winner.rulesMet ? <em className="stamp muted-stamp">خرج من الشروط</em> : null}
                </div>
              </article>
            ))}
          </div>
          <div className="row-actions no-print">
            <button
              data-testid="copy-winners"
              type="button"
              disabled={!confirmed}
              onClick={() => {
                void copyText(announcement(data.actual, winners)).then(() => {
                  setCopied(true)
                  window.setTimeout(() => setCopied(false), 1800)
                })
              }}
            >
              {copied ? 'تم نسخ الإعلان' : 'نسخ إعلان الفائزين'}
            </button>
            <button type="button" className="ghost" onClick={() => window.print()}>
              طباعة
            </button>
          </div>
          {!confirmed ? <p className="hint no-print">أحد الفائزين لم يعد مستوفيًا للشروط. أعد السحب قبل نسخ الإعلان.</p> : null}
        </div>
      ) : null}

      {!spinning && winners.length === 0 ? (
        <div className="podium-empty">
          <p>أسماء الفائزين تظهر هنا، واحدًا بعد الآخر، لحظة توقف القرص.</p>
        </div>
      ) : null}
        </div>
      </div>
    </section>
  )
}
