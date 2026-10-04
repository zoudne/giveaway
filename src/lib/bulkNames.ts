/** Pull Instagram usernames from pasted text. No count cap. */
export function parseBulkUsernames(raw: string): string[] {
  const seen = new Set<string>()
  const usernames: string[] = []
  const chunks = raw.split(/[\n\r,،;]+/)
  for (const chunk of chunks) {
    for (const token of chunk.trim().split(/\s+/)) {
      let name = token.trim()
      if (!name || /^[-*•]+$/.test(name) || /^\d+[.)\-:\u060c]?$/u.test(name)) continue
      name = name
        .replace(/^[@#]+/, '')
        // "12.name" / "12) name" list prefixes, with or without a space
        .replace(/^\d+[.)\-:\u060c]\s*/u, '')
        .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
        .replace(/\/.*$/, '')
        .replace(/^@+/, '')
        // List/OCR junk Instagram never allows in a username
        .replace(/[-]+/g, '')
        .replace(/^[^\w.]+|[^\w.]+$/g, '')
        .replace(/\.+$/g, '')
      if (!/^[A-Za-z0-9._]{1,30}$/.test(name)) continue
      const key = name.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      usernames.push(name)
    }
  }
  return usernames
}
