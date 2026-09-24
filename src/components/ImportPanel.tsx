import { useState } from 'react'
import type { FormEvent } from 'react'
import { CONTEST, KLARAIG_DRAW, POSTS } from '../lib/contest.ts'
import { assignOrder } from '../lib/importComments.ts'
import { SAMPLE_COMMENTS } from '../lib/sample.ts'
import type { RawComment } from '../lib/types.ts'

type FetchResult = {
  accountUsername: string
  commentsCount: number | null
  comments: Array<{
    id: string
    username: string
    text: string
    timestamp?: string
    missingUser: boolean
  }>
  error?: string
}

function deadlineInput(value: string): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

type Props = {
  handle: string
  requiredMentions: number
  winnerCount: number
  commentCount: number
  commentDeadline: string
  onDeadline: (value: string) => void
  onHandle: (value: string) => void
  onRequiredMentions: (value: number) => void
  onWinnerCount: (value: number) => void
  onComments: (comments: RawComment[], mode: 'replace' | 'append') => void
  onKlaraigDraw: () => void
  onNotice: (message: string) => void
}

export function ImportPanel({
  handle,
  requiredMentions,
  winnerCount,
  commentCount,
  commentDeadline,
  onDeadline,
  onHandle,
  onRequiredMentions,
  onWinnerCount,
  onComments,
  onKlaraigDraw,
  onNotice,
}: Props) {
  const [url, setUrl] = useState(CONTEST.postUrl)
  const [loading, setLoading] = useState(false)
  const [manualUser, setManualUser] = useState('')
  const [manualText, setManualText] = useState('')

  async function fetchUrl(nextUrl: string) {
    const target = nextUrl.trim()
    if (!target) {
      onNotice('الصق رابط المنشور.')
      return
    }
    setUrl(target)
    setLoading(true)
    onNotice('جارٍ جلب التعليقات.')
    try {
      const response = await fetch('/api/instagram/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: target }),
      })
      const body = (await response.json()) as FetchResult
      if (!response.ok) throw new Error(body.error || 'تعذر جلب التعليقات')
      const comments = assignOrder(
        body.comments.map((comment) => ({
          id: comment.id,
          username: comment.username,
          text: comment.text,
          timestamp: comment.timestamp,
          missingUser: comment.missingUser,
        })),
      )
      if (body.accountUsername) onHandle(body.accountUsername)
      onComments(comments, 'replace')
      const short =
        body.commentsCount && body.commentsCount > comments.length
          ? ` من ${body.commentsCount}`
          : ''
      onNotice(`وصلت ${comments.length} تعليق${short}. التوقع غير المطابق يُستبعد بعد حفظ النتيجة.`)
    } catch (error) {
      onNotice(error instanceof Error ? error.message : 'تعذر جلب التعليقات')
    } finally {
      setLoading(false)
    }
  }

  function addManual(event: FormEvent) {
    event.preventDefault()
    const body = manualText.trim()
    if (!body) return
    const username = manualUser.trim().replace(/^@+/, '')
    const [comment] = assignOrder([
      {
        id: crypto.randomUUID(),
        username: username || 'بدون-اسم',
        text: body,
        missingUser: !username,
      },
    ])
    if (!comment) return
    onComments([comment], 'append')
    setManualText('')
    setManualUser('')
    onNotice('أُضيف المشارك.')
  }

  return (
    <section className="panel">
      <div className="section-kicker">الإعداد</div>
      <h2>اجلب تعليقات المنشور</h2>
      <p className="hint">اختر المنشور أو الصق رابطًا آخر. التعليق بعد آخر موعد لا يدخل السحب.</p>
      <div className="post-picks">
        {POSTS.map((post) => (
          <button
            key={post.url}
            type="button"
            className={url === post.url ? 'chip on' : 'chip'}
            disabled={loading}
            onClick={() => void fetchUrl(post.url)}
          >
            {post.name}
          </button>
        ))}
        <button type="button" className="chip" data-testid="klaraig-shortlist" onClick={onKlaraigDraw}>
          سحب كلاريج · {KLARAIG_DRAW.names.length}
        </button>
      </div>
      <form
        className="link-form"
        onSubmit={(event) => {
          event.preventDefault()
          void fetchUrl(url)
        }}
      >
        <label>
          رابط المنشور
          <input
            data-testid="post-url"
            value={url}
            dir="ltr"
            spellCheck={false}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://www.instagram.com/p/..."
          />
        </label>
        <button data-testid="fetch-comments" type="submit" disabled={loading}>
          {loading ? 'جارٍ الجلب…' : 'جلب التعليقات'}
        </button>
      </form>

      <div className="settings-row">
        <label>
          حساب المسابقة
          <input
            data-testid="handle"
            value={handle}
            placeholder="يُملأ من المنشور"
            onChange={(event) => onHandle(event.target.value.replace(/^@+/, '').trim())}
          />
        </label>
        <label>
          عدد المنشن المطلوب
          <input
            data-testid="mention-count"
            type="number"
            min={1}
            max={10}
            value={requiredMentions}
            onChange={(event) => onRequiredMentions(Math.min(10, Math.max(1, Number(event.target.value) || 1)))}
          />
        </label>
        <label>
          آخر موعد للتعليق
          <input
            data-testid="comment-deadline"
            type="datetime-local"
            value={deadlineInput(commentDeadline)}
            onChange={(event) => onDeadline(event.target.value ? new Date(event.target.value).toISOString() : '')}
          />
        </label>
        <label>
          عدد الفائزين
          <input
            data-testid="winner-count"
            type="number"
            min={1}
            max={20}
            value={winnerCount}
            onChange={(event) => onWinnerCount(Math.min(20, Math.max(1, Number(event.target.value) || 1)))}
          />
        </label>
      </div>
      <p className="hint">منشن حساب المسابقة لا يُحسب ضمن العدد المطلوب. يظهر عدد المشاركين الآن: {commentCount}.</p>

      <details className="help">
        <summary>إضافة مشارك يدويًا</summary>
        <form className="manual-form" onSubmit={addManual}>
          <input
            value={manualUser}
            onChange={(event) => setManualUser(event.target.value)}
            placeholder="اسم المستخدم"
            aria-label="اسم المستخدم"
          />
          <input
            data-testid="manual-text"
            value={manualText}
            onChange={(event) => setManualText(event.target.value)}
            placeholder="نص التعليق"
            aria-label="نص التعليق"
          />
          <button type="submit">إضافة</button>
        </form>
        <button
          type="button"
          className="ghost"
          data-testid="load-sample"
          onClick={() => {
            onComments(SAMPLE_COMMENTS, 'replace')
            onNotice('تم تحميل مثال للتجربة. اجلب المنشور الحقيقي قبل سحب المسابقة.')
          }}
        >
          مثال للتجربة
        </button>
      </details>
    </section>
  )
}
