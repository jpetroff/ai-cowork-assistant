/**
 * Closes open markdown delimiters in a partially streamed string so that
 * the content renders without broken formatting (e.g. unclosed code fences or emphasis).
 */
export function closeOpenMarkdownDelimiters(text: string): string {
  if (!text.trim()) return text

  const result: string[] = []
  let i = 0
  const len = text.length

  // Track code fence state: null | { char: string, count: number }
  let codeFence: { char: string; count: number } | null = null
  // Stack of opened inline delimiters (we only need to close at end)
  const openInline: string[] = []

  function peek(n: number): string {
    return text.slice(i, i + n)
  }

  function consume(c: string): boolean {
    if (peek(c.length) === c) {
      i += c.length
      return true
    }
    return false
  }

  while (i < len) {
    // Code fence (``` or ~~~)
    if (peek(3) === '```' || peek(3) === '~~~') {
      const char = text[i]
      let count = 0
      while (i < len && text[i] === char) {
        count++
        i++
      }
      if (codeFence && codeFence.char === char && codeFence.count === count) {
        codeFence = null
      } else if (!codeFence) {
        codeFence = { char, count }
      }
      result.push(char.repeat(count))
      continue
    }

    if (codeFence) {
      result.push(text[i])
      i++
      continue
    }

    // Inline code backtick
    if (text[i] === '`') {
      let backticks = 0
      const start = i
      while (i < len && text[i] === '`') {
        backticks++
        i++
      }
      result.push(text.slice(start, i))
      // Simple heuristic: odd number of backticks means we have an unclosed span
      if (backticks === 1) {
        const last = openInline.lastIndexOf('`')
        if (last !== -1) openInline.splice(last, 1)
        else openInline.push('`')
      }
      continue
    }

    // Strong ** or __
    if (peek(2) === '**' || peek(2) === '__') {
      const d = peek(2)
      i += 2
      result.push(d)
      const last = openInline.lastIndexOf(d)
      if (last !== -1) openInline.splice(last, 1)
      else openInline.push(d)
      continue
    }

    // Emphasis * or _ (single; avoid matching ** or __)
    if (
      (text[i] === '*' || text[i] === '_') &&
      peek(2) !== '**' &&
      peek(2) !== '__'
    ) {
      const c = text[i]
      i++
      result.push(c)
      const last = openInline.lastIndexOf(c)
      if (last !== -1) openInline.splice(last, 1)
      else openInline.push(c)
      continue
    }

    // Strikethrough ~~
    if (peek(2) === '~~') {
      i += 2
      result.push('~~')
      const last = openInline.lastIndexOf('~~')
      if (last !== -1) openInline.splice(last, 1)
      else openInline.push('~~')
      continue
    }

    result.push(text[i])
    i++
  }

  // Close code fence if still open
  if (codeFence) {
    result.push('\n')
    result.push(codeFence.char.repeat(codeFence.count))
  }

  // Close inline delimiters in reverse order (LIFO)
  for (let k = openInline.length - 1; k >= 0; k--) {
    result.push(openInline[k])
  }

  return result.join('')
}
