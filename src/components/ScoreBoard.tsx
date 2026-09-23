import { useState } from 'react'
import type { FormEvent } from 'react'
import { CONTEST } from '../lib/contest.ts'
import { formatScore } from '../lib/parse.ts'
import type { Score } from '../lib/types.ts'

type Props = {
  actual: Score | null
  correctCount: number | null
  onSave: (score: Score | null) => void
}

export function ScoreBoard({ actual, correctCount, onSave }: Props) {
  const [saudi, setSaudi] = useState(actual ? String(actual.saudi) : '')
  const [kuwait, setKuwait] = useState(actual ? String(actual.kuwait) : '')
  const [editing, setEditing] = useState(actual === null)

  function save(event: FormEvent) {
    event.preventDefault()
    if (saudi.trim() === '' || kuwait.trim() === '') return
    const home = Number(saudi)
    const away = Number(kuwait)
    if (!Number.isInteger(home) || !Number.isInteger(away) || home < 0 || away < 0 || home > 20 || away > 20) {
      return
    }
    onSave({ saudi: home, kuwait: away })
  }

  const invalid =
    saudi.trim() !== '' &&
    kuwait.trim() !== '' &&
    (!Number.isInteger(Number(saudi)) || !Number.isInteger(Number(kuwait)))

  return (
    <section className={`scoreboard${actual ? ' has-score' : ''}`}>
      <div className="score-head">
        <div>
          <div className="section-kicker">النتيجة الرسمية</div>
          <h2>{actual && !editing ? 'النتيجة التي يُسحب عليها' : 'بعد صافرة النهاية، ثبّت النتيجة'}</h2>
        </div>
        {actual ? (
          <p className="locked-score">
            <bdi dir="ltr">{formatScore(actual)}</bdi>
            <span>محفوظة</span>
          </p>
        ) : (
          <p className="waiting-pill">بانتظار النتيجة</p>
        )}
      </div>
      <form className="score-form" onSubmit={save} hidden={!editing}>
        <div className="score-row">
          <label>
            <span className="team">
              <i className="flag flag-ksa" aria-hidden="true" />
              {CONTEST.home}
            </span>
            <input
              data-testid="score-saudi"
              inputMode="numeric"
              min={0}
              max={20}
              value={saudi}
              onChange={(event) => setSaudi(event.target.value)}
              aria-label="أهداف السعودية"
            />
          </label>
          <b className="score-sep">×</b>
          <label>
            <span className="team">
              <i className="flag flag-kwt" aria-hidden="true" />
              {CONTEST.away}
            </span>
            <input
              data-testid="score-kuwait"
              inputMode="numeric"
              min={0}
              max={20}
              value={kuwait}
              onChange={(event) => setKuwait(event.target.value)}
              aria-label="أهداف الكويت"
            />
          </label>
        </div>
        <div className="score-actions">
          <button data-testid="save-score" type="submit">
            حفظ النتيجة
          </button>
          {actual ? (
            <button type="button" className="ghost" onClick={() => onSave(null)}>
              مسح النتيجة
            </button>
          ) : null}
        </div>
        {invalid ? <p className="form-error">اكتب رقمين صحيحين من 0 إلى 20.</p> : null}
      </form>
      {actual && !editing ? (
        <div className="score-actions operator">
          <button type="button" className="ghost" onClick={() => setEditing(true)}>
            تعديل النتيجة
          </button>
        </div>
      ) : null}
      <p className="score-status" data-testid="score-status">
        {actual ? (
          <>
            النتيجة المحفوظة <bdi dir="ltr">{formatScore(actual)}</bdi>. التوقع المختلف يُستبعد تلقائيًا. المطابق مع
            المنشن: {correctCount ?? 0}.
          </>
        ) : (
          'لم تُحفظ نتيجة بعد. لن يُسحب أحد حتى تُحفظ النتيجة، وبعدها يُستبعد كل توقع مختلف.'
        )}
      </p>
    </section>
  )
}
