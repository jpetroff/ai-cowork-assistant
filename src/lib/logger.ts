const enabledLabels: Set<string> = new Set(
  (import.meta.env.VITE_LOGGER ?? '')
    .split(',')
    .map((s: string) => s.trim())
    .filter(Boolean)
)

type LogArgs = [label: string, ...rest: unknown[]]

function logger(...args: LogArgs): unknown[] | undefined {
  const [label, ...rest] = args
  if (!enabledLabels.has(label)) return undefined

  const prefix = `%c[${label}]`
  const style = 'color: #a78bfa; font-weight: bold'

  if (rest.length === 1 && typeof rest[0] === 'object' && rest[0] !== null) {
    return [prefix, style, rest[0]]
  }
  return [prefix, style, ...rest]
}

declare global {
  interface Console {
    logger: typeof logger
  }
}

console.logger = logger
