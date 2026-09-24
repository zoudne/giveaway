import { useMemo, useState } from 'react'
import { formatScore } from '../lib/parse.ts'
import type { ViewEntry } from '../lib/prepare.ts'
import type { Score } from '../lib/types.ts'

type Filter = 'all' | 'ready' | 'correct' | 'incomplete'

type Props = {
  entries: ViewEntry[]
  onExclude: (key: string) => void
  onOverride: (key: string, commentId: string, value: Score | 'cleared' | 'auto') => void
}

export function EntryTable({ entries, onExclude, onOverride }: Props) {
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<string | null>(null)
  const pageSize = 20

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return entries
      .filter((entry) => {
        if (filter === 'ready') return entry.rulesMet
        if (filter === 'correct') return entry.correct === true && entry.mentionsOk && !entry.excluded
        if (filter === 'incomplete') return !entry.rulesMet
        return true
      })
      .filter((entry) => {
        if (!q) return true
        return (
          entry.comment.username.toLowerCase().includes(q) ||
          entry.comment.text.toLowerCase().includes(q) ||
          entry.mentions.some((name) => name.includes(q))
        )
      })
      .sort((a, b) => rank(a) - rank(b) || a.comment.username.localeCompare(b.comment.username, 'ar'))
  }, [entries, filter, query])

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const current = Math.min(page, pages)
  const slice = filtered.slice((current - 1) * pageSize, current * pageSize)

  return (
    <section className="panel">
      <div className="section-kicker">المراجعة</div>
      <h2>تعليقات المشاركين</h2>
      <div className="filters">
        <input
          data-testid="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setPage(1)
          }}
          placeholder="ابحث بالاسم أو نص التعليق"
          aria-label="بحث"
        />
        {(
          [
            ['all', 'الكل'],
            ['ready', 'مستوفون'],
            ['correct', 'توقع مطابق'],
            ['incomplete', 'غير مستوفين'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={filter === id ? 'chip on' : 'chip'}
            onClick={() => {
              setFilter(id)
              setPage(1)
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="hint">{filtered.length} صفًا في هذا العرض.</p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>المشارك</th>
              <th>التوقع</th>
              <th>المنشن</th>
              <th>الحالة</th>
              <th>التعليق</th>
            </tr>
          </thead>
          <tbody>
            {slice.length === 0 ? (
              <tr>
                <td colSpan={5}>لا توجد صفوف في هذا العرض.</td>
              </tr>
            ) : (
              slice.map((entry) => (
                <tr key={entry.key} data-testid="entry-row" className={entry.excluded ? 'is-excluded' : undefined}>
                  <td data-label="المشارك">
                    <strong dir="ltr">{entry.comment.missingUser ? 'بدون اسم' : `@${entry.comment.username}`}</strong>
                    {entry.others.length > 0 ? <small>{entry.others.length + 1} تعليقات، اعتُمد الأكمل</small> : null}
                  </td>
                  <td data-label="التوقع">
                    {editing === entry.key ? (
                      <ScoreEdit
                        value={entry.prediction}
                        onCancel={() => setEditing(null)}
                        onSave={(score) => {
                          onOverride(entry.key, entry.comment.id, score)
                          setEditing(null)
                        }}
                        onClear={() => {
                          onOverride(entry.key, entry.comment.id, 'cleared')
                          setEditing(null)
                        }}
                        onAuto={() => {
                          onOverride(entry.key, entry.comment.id, 'auto')
                          setEditing(null)
                        }}
                      />
                    ) : (
                      <button type="button" className="text-btn" onClick={() => setEditing(entry.key)}>
                        {entry.prediction ? <bdi dir="ltr">{formatScore(entry.prediction)}</bdi> : 'لا يوجد توقع'}
                      </button>
                    )}
                  </td>
                  <td data-label="المنشن">
                    <b>{entry.mentions.length}</b>
                    <small dir="ltr">{entry.mentions.map((name) => `@${name}`).join(' ')}</small>
                  </td>
                  <td data-label="الحالة">
                    <span className={`badge ${badgeClass(entry)}`}>{statusLabel(entry)}</span>
                  </td>
                  <td data-label="التعليق">
                    <p className="comment-text" dir="auto">{entry.comment.text}</p>
                    {entry.others.length > 0 ? (
                      <details>
                        <summary>تعليقات أخرى</summary>
                        {entry.others.map((comment) => (
                          <p key={comment.id}>{comment.text}</p>
                        ))}
                      </details>
                    ) : null}
                    <button type="button" className="text-btn" onClick={() => onExclude(entry.key)}>
                      {entry.excluded ? 'إرجاع للسحب' : 'استبعاد'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {pages > 1 ? (
        <div className="row-actions">
          <button type="button" className="ghost" disabled={current === 1} onClick={() => setPage(current - 1)}>
            السابق
          </button>
          <span>
            {current} / {pages}
          </span>
          <button type="button" className="ghost" disabled={current === pages} onClick={() => setPage(current + 1)}>
            التالي
          </button>
        </div>
      ) : null}
    </section>
  )
}

function rank(entry: ViewEntry): number {
  if (entry.rulesMet) return 0
  if (entry.excluded) return 5
  if (entry.correct === true && entry.mentionsOk) return 1
  if (entry.prediction) return 2
  return 3
}

function statusLabel(entry: ViewEntry): string {
  if (entry.excluded) return 'مستبعد'
  if (!entry.onTime) return 'بعد الموعد'
  if (!entry.prediction) return 'بدون توقع'
  if (!entry.mentionsOk) return 'منشن ناقص'
  if (entry.correct === null) return 'بانتظار النتيجة'
  if (!entry.correct) return 'توقع مختلف'
  return 'مستوفي'
}

function badgeClass(entry: ViewEntry): string {
  if (entry.rulesMet) return 'good'
  if (entry.excluded || !entry.onTime || !entry.prediction || !entry.mentionsOk || entry.correct === false) return 'bad'
  return 'ok'
}

function ScoreEdit({
  value,
  onSave,
  onClear,
  onAuto,
  onCancel,
}: {
  value: Score | null
  onSave: (score: Score) => void
  onClear: () => void
  onAuto: () => void
  onCancel: () => void
}) {
  const [saudi, setSaudi] = useState(value ? String(value.saudi) : '0')
  const [kuwait, setKuwait] = useState(value ? String(value.kuwait) : '0')
  return (
    <span className="inline-edit">
      <input aria-label="أهداف السعودية" value={saudi} onChange={(event) => setSaudi(event.target.value)} />
      <input aria-label="أهداف الكويت" value={kuwait} onChange={(event) => setKuwait(event.target.value)} />
      <button
        type="button"
        onClick={() => {
          const home = Number(saudi)
          const away = Number(kuwait)
          if (!Number.isInteger(home) || !Number.isInteger(away) || home < 0 || away < 0 || home > 20 || away > 20) return
          onSave({ saudi: home, kuwait: away })
        }}
      >
        حفظ
      </button>
      <button type="button" onClick={onClear}>
        حذف
      </button>
      <button type="button" onClick={onAuto}>
        تلقائي
      </button>
      <button type="button" onClick={onCancel}>
        إلغاء
      </button>
    </span>
  )
}
