/**
 * Closes open code fences in a partially streamed markdown string.
 * Only handles ``` and ~~~ fences which cause rendering issues when left open.
 * Does NOT manipulate inline formatting (*, **, _, `, etc.) as these:
 * 1. Render fine even when unclosed during streaming
 * 2. Are impossible to track correctly without full context
 * 3. Get naturally paired as more content arrives
 */
export function closeOpenMarkdownDelimiters(text: string): string {
  if (!text.trim()) return text

  const len = text.length
  let i = 0

  // Track code fence state: null | { char: string, count: number }
  let codeFence: { char: string; count: number } | null = null

  function peek(n: number): string {
    return text.slice(i, i + n)
  }

  while (i < len) {
    // Code fence (``` or ~~~) - only at start of line or after newline
    const isAtLineStart = i === 0 || text[i - 1] === '\n'

    if (isAtLineStart && (peek(3) === '```' || peek(3) === '~~~')) {
      const char = text[i]
      let count = 0
      const start = i
      while (i < len && text[i] === char) {
        count++
        i++
      }

      // Only treat as code fence if we have 3+ backticks/tildes
      if (count >= 3) {
        if (codeFence && codeFence.char === char && codeFence.count === count) {
          codeFence = null
        } else if (!codeFence) {
          codeFence = { char, count }
        }
      }
      continue
    }

    if (codeFence) {
      // Inside code fence, skip until we find the closing fence
      i++
      continue
    }

    // Outside code fence, just skip everything else
    i++
  }

  // Close code fence if still open
  if (codeFence) {
    return text + '\n' + codeFence.char.repeat(codeFence.count)
  }

  return text
}
