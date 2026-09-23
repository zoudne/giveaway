import type { IncomingMessage, ServerResponse } from 'node:http'
import { chromium, type Page } from 'playwright'
import type { Plugin } from 'vite'

type Json = Record<string, unknown>

type CommentDraft = {
  id: string
  username: string
  text: string
  timestamp?: string
  missingUser: boolean
}

type PageBatch = {
  comments: CommentDraft[]
  cursor: string | null
  hasNext: boolean
}

function isRecord(value: unknown): value is Json {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer | string) => {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
    })
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(raw) as unknown)
      } catch {
        reject(new Error('الطلب المرسل غير صالح'))
      }
    })
    req.on('error', reject)
  })
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

export function postUrlFromInput(input: string): string {
  const trimmed = input.trim()
  const match = trimmed.match(/instagram\.com\/((?:p|reel|tv)\/[A-Za-z0-9_-]+)/i)
  if (!match) throw new Error('الصق رابط منشور انستغرام.')
  return `https://www.instagram.com/${match[1]}/`
}

function shortcodeOf(url: string): string {
  return url.match(/\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/)?.[1] ?? ''
}

function extractObject(source: string, start: number): string {
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < source.length; i += 1) {
    const char = source[i]
    if (inString) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === '"') inString = false
      continue
    }
    if (char === '"') inString = true
    else if (char === '{') depth += 1
    else if (char === '}') {
      depth -= 1
      if (depth === 0) return source.slice(start, i + 1)
    }
  }
  throw new Error('تعذر قراءة بيانات المنشور.')
}

function stringField(obj: Json | null, key: string): string {
  if (!obj) return ''
  const value = obj[key]
  return typeof value === 'string' ? value : ''
}

function numberField(obj: Json | null, key: string): number | null {
  if (!obj) return null
  const value = obj[key]
  return typeof value === 'number' ? value : null
}

function readComments(connection: Json | null): PageBatch {
  const edges = connection && Array.isArray(connection.edges) ? connection.edges : []
  const pageInfo = connection && isRecord(connection.page_info) ? connection.page_info : null
  const comments: CommentDraft[] = []
  for (const edge of edges) {
    if (!isRecord(edge) || !isRecord(edge.node)) continue
    const node = edge.node
    const text = stringField(node, 'text').trim()
    if (!text) continue
    const user = isRecord(node.user) ? node.user : null
    const username = stringField(user, 'username')
    const createdAt = numberField(node, 'created_at')
    comments.push({
      id: stringField(node, 'pk') || stringField(node, 'id') || `c-${comments.length}`,
      username: username || 'بدون-اسم',
      text,
      timestamp: createdAt ? new Date(createdAt * 1000).toISOString() : undefined,
      missingUser: !username,
    })
  }
  const cursor = pageInfo ? stringField(pageInfo, 'end_cursor') : ''
  return {
    comments,
    cursor: cursor || null,
    hasNext: pageInfo?.has_next_page === true && Boolean(cursor),
  }
}

export function parsePostHtml(html: string, shortcode: string): {
  mediaId: string
  username: string
  commentCount: number | null
  lsd: string
  rev: string
  batch: PageBatch
} {
  const key = '"xig_polaris_media":'
  let from = 0
  let media: Json | null = null
  while (from < html.length) {
    const index = html.indexOf(key, from)
    if (index < 0) break
    const brace = html.indexOf('{', index + key.length)
    if (brace < 0) break
    try {
      const raw = extractObject(html, brace)
      if (raw.includes('"comments_connection"') && raw.includes(shortcode)) {
        const parsed: unknown = JSON.parse(raw)
        if (isRecord(parsed)) {
          media = parsed
          break
        }
      }
    } catch {
      // keep scanning
    }
    from = index + key.length
  }
  if (!media) throw new Error('لم أجد تعليقات هذا المنشور. تأكد أن الحساب عام والرابط صحيح.')
  const gated = isRecord(media.if_not_gated_logged_out) ? media.if_not_gated_logged_out : media
  const user = isRecord(gated.user) ? gated.user : isRecord(media.user) ? media.user : null
  const connection = isRecord(media.comments_connection)
    ? media.comments_connection
    : isRecord(gated.comments_connection)
      ? gated.comments_connection
      : null
  const mediaId = stringField(media, 'pk') || stringField(gated, 'pk')
  if (!mediaId) throw new Error('تعذر تحديد المنشور.')
  return {
    mediaId,
    username: stringField(user, 'username'),
    commentCount: numberField(gated, 'comment_count') ?? numberField(media, 'comment_count'),
    lsd: html.match(/"LSD",\[\],\{"token":"([^"]+)"/)?.[1] ?? '',
    rev: html.match(/"rev":(\d+)/)?.[1] ?? '',
    batch: readComments(connection),
  }
}

async function launchBrowser() {
  try {
    return await chromium.launch({ channel: 'msedge', headless: true })
  } catch {
    try {
      return await chromium.launch({ channel: 'chrome', headless: true })
    } catch {
      throw new Error('يلزم وجود Microsoft Edge أو Chrome على الجهاز لجلب التعليقات.')
    }
  }
}

async function loadNextPage(page: Page, payload: {
  mediaId: string
  lsd: string
  rev: string
  cursor: string
}): Promise<PageBatch> {
  const result = await page.evaluate(async (input) => {
    const jazoest = String(2 + [...input.lsd].reduce((sum, char) => sum + char.charCodeAt(0), 0))
    const body = new URLSearchParams({
      av: '0',
      __d: 'www',
      __user: '0',
      __a: '1',
      __req: '8',
      dpr: '1',
      __ccg: 'GOOD',
      __rev: input.rev,
      __comet_req: '7',
      lsd: input.lsd,
      jazoest,
      __spin_r: input.rev,
      __spin_b: 'trunk',
      __spin_t: String(Math.floor(Date.now() / 1000)),
      fb_api_caller_class: 'RelayModern',
      fb_api_req_friendly_name: 'PolarisLoggedOutDesktopWWWPostCommentsPaginationQuery',
      variables: JSON.stringify({ after: input.cursor, first: 50, media_id: input.mediaId }),
      server_timestamps: 'true',
      doc_id: '27659279553772821',
    })
    const response = await fetch('/api/graphql', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-FB-Friendly-Name': 'PolarisLoggedOutDesktopWWWPostCommentsPaginationQuery',
        'X-FB-LSD': input.lsd,
        'X-IG-App-ID': '936619743392459',
      },
      body,
      signal: AbortSignal.timeout(20000),
    })
    const raw = await response.text()
    return { ok: response.ok, raw: raw.replace(/^for\s*\(;;\);/, '') }
  }, payload)

  if (!result.ok) throw new Error('توقف انستغرام عن إرسال بقية التعليقات.')
  let json: unknown
  try {
    json = JSON.parse(result.raw)
  } catch {
    throw new Error('رد انستغرام غير مفهوم أثناء جلب بقية التعليقات.')
  }
  if (!isRecord(json)) throw new Error('رد انستغرام غير مفهوم أثناء جلب بقية التعليقات.')
  if (typeof json.error === 'number' || (isRecord(json.error) && json.error)) {
    throw new Error('رفض انستغرام إكمال جلب التعليقات.')
  }
  const data = isRecord(json.data) ? json.data : null
  const media = data && isRecord(data.xig_polaris_media) ? data.xig_polaris_media : null
  const connection = media && isRecord(media.comments_connection) ? media.comments_connection : null
  if (!connection) throw new Error('لم تصل الصفحة التالية من التعليقات.')
  return readComments(connection)
}

async function fetchPost(url: string): Promise<{
  accountUsername: string
  commentsCount: number | null
  permalink: string
  comments: CommentDraft[]
}> {
  const browser = await launchBrowser()
  try {
    const page = await browser.newPage()
    page.setDefaultNavigationTimeout(45000)
    const response = await page.goto(url, { waitUntil: 'domcontentloaded' })
    if (!response) throw new Error('تعذر فتح المنشور.')
    const html = await response.text()
    const parsed = parsePostHtml(html, shortcodeOf(url))
    const seen = new Set<string>()
    const comments: CommentDraft[] = []
    const pushAll = (batch: PageBatch) => {
      for (const comment of batch.comments) {
        if (seen.has(comment.id)) continue
        seen.add(comment.id)
        comments.push(comment)
      }
    }
    pushAll(parsed.batch)
    let cursor = parsed.batch.cursor
    let hasNext = parsed.batch.hasNext
    let pages = 0
    while (hasNext && cursor && pages < 40 && comments.length < 5000) {
      pages += 1
      const batch = await loadNextPage(page, {
        mediaId: parsed.mediaId,
        lsd: parsed.lsd,
        rev: parsed.rev,
        cursor,
      })
      const before = comments.length
      pushAll(batch)
      if (comments.length === before || batch.cursor === cursor) break
      cursor = batch.cursor
      hasNext = batch.hasNext
    }

    return {
      accountUsername: parsed.username,
      commentsCount: parsed.commentCount,
      permalink: url,
      comments,
    }
  } finally {
    await browser.close()
  }
}

async function handle(req: IncomingMessage, res: ServerResponse) {
  if (req.method === 'GET') {
    send(res, 200, { ok: true })
    return
  }
  if (req.method !== 'POST') {
    send(res, 405, { error: 'الطريقة غير مدعومة' })
    return
  }
  try {
    const body = await readBody(req)
    const rawUrl = isRecord(body) && typeof body.url === 'string' ? body.url : ''
    const url = postUrlFromInput(rawUrl)
    const result = await fetchPost(url)
    send(res, 200, result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'تعذر جلب التعليقات'
    const status = message === 'الصق رابط منشور انستغرام.' ? 400 : 502
    send(res, status, { error: message })
  }
}

export function instagramPlugin(): Plugin {
  const attach = (middlewares: { use: (path: string, handler: (req: IncomingMessage, res: ServerResponse) => void) => void }) => {
    middlewares.use('/api/instagram/comments', (req, res) => {
      void handle(req, res)
    })
  }
  return {
    name: 'instagram-comments',
    configureServer(server) {
      attach(server.middlewares)
    },
    configurePreviewServer(server) {
      attach(server.middlewares)
    },
  }
}
