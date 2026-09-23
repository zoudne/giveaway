import { PrizeWheel } from './PrizeWheel.tsx'
import { announcement } from '../lib/announce.ts'
import { CONTEST } from '../lib/contest.ts'
import { formatScore } from '../lib/parse.ts'
import type { ViewEntry } from '../lib/prepare.ts'
import type { AppData } from '../lib/types.ts'

type Props = {
  data: AppData
  poolCount: number
  winners: ViewEntry[]
  spinning: boolean
  spinRequest: { id: number; names: string[]; targets: string[] }
  poolNames: string[]
  onSpinDone: () => void
  onWinnerCount: (value: number) => void
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

export function DrawPanel({
  data,
  poolCount,
  winners,
  spinning,
  spinRequest,
  poolNames,
  onSpinDone,
  onWinnerCount,
  onDraw,
}: Props) {
  const confirmed = winners.length > 0 && winners.every((winner) => winner.rulesMet)
  const waitingForScore = !data.actual && data.comments.length > 0
  const shortDraw = !spinning && winners.length > 0 && winners.length < data.winnerCount

  return (
    <section className="panel draw-panel">
      <div className="section-kicker">السحب</div>
      <h2>
        {data.winnerCount} فائزين ب{CONTEST.prize}
      </h2>
      <div className="scope no-print">
        <label>
          عدد الفائزين
          <input
            data-testid="winner-count"
            type="number"
            min={1}
            max={20}
            value={data.winnerCount}
            onChange={(event) => onWinnerCount(Math.min(20, Math.max(1, Number(event.target.value) || 1)))}
          />
        </label>
      </div>
      <p className="hint no-print">
        يدخل السحب من طابق توقعه النتيجة المحفوظة وكتب منشن {data.requiredMentions} أشخاص. التوقع المختلف يُستبعد تلقائيًا.
      </p>
      <div className="draw-layout">
        <PrizeWheel names={poolNames} request={spinRequest} onDone={onSpinDone} />
        <div className="draw-side">
      <button data-testid="draw-button" type="button" className="draw-btn no-print" disabled={spinning || poolCount === 0} onClick={onDraw}>
        {spinning ? 'القرص يدور…' : waitingForScore ? 'احفظ النتيجة أولًا' : poolCount === 0 ? 'السحب بانتظار المشاركين' : `أدر القرص لـ ${Math.min(data.winnerCount, poolCount)} من ${poolCount}`}
      </button>
      {poolCount === 0 && data.comments.length > 0 ? (
        <p className="form-error" data-testid="draw-empty">
          {waitingForScore
            ? 'احفظ النتيجة الفعلية أولًا. أي توقع مختلف يُستبعد تلقائيًا.'
            : 'لا يوجد مشارك جمع التوقع المطابق ومنشن العدد المطلوب.'}
        </p>
      ) : null}

      {winners.length > 0 && !spinning ? (
        <div data-testid="winners">
          {shortDraw ? <p className="hint">عدد المستحقين أقل من المطلوب، فاختير كل من في النطاق.</p> : null}
          <div className="ticket-grid">
            {winners.map((winner, index) => (
              <article key={winner.key} className="ticket" data-testid="winner-card">
                <span className="ticket-index">فائز {index + 1}</span>
                <strong dir="ltr">{winner.comment.missingUser ? 'بدون اسم' : `@${winner.comment.username}`}</strong>
                <p>
                  توقعه{' '}
                  {winner.prediction ? <bdi dir="ltr">{formatScore(winner.prediction)}</bdi> : 'غير مقروء'}
                </p>
                <p>
                  {data.actual ? (
                    <>
                      النتيجة <bdi dir="ltr">{formatScore(data.actual)}</bdi>
                    </>
                  ) : (
                    'النتيجة لم تُحفظ'
                  )}
                </p>
                <em className="stamp">مطابق</em>
                {!winner.rulesMet ? <em className="stamp muted-stamp">خرج من الشروط</em> : null}
              </article>
            ))}
          </div>
          <div className="row-actions no-print">
            <button
              data-testid="copy-winners"
              type="button"
              disabled={!confirmed}
              onClick={() => void copyText(announcement(data.actual, winners))}
            >
              نسخ إعلان الفائزين
            </button>
            <button type="button" className="ghost" onClick={() => window.print()}>
              طباعة
            </button>
          </div>
          {!confirmed ? <p className="hint no-print">أحد الفائزين لم يعد مستوفيًا للشروط. أعد السحب قبل نسخ الإعلان.</p> : null}
        </div>
      ) : null}
        </div>
      </div>
    </section>
  )
}
