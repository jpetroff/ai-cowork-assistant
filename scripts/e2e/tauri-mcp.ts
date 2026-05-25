import {
  appendFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { spawn as spawnChildProcess } from 'node:child_process'
import { homedir, tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createConnection } from 'node:net'

type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue }

interface CliCall {
  args: string[]
  exitCode: number
  stdout: string
  stderr: string
  parsed: JsonValue | null
  durationMs: number
}

const root = resolve(import.meta.dir, '../..')
const port = Number(process.env.TAURI_MCP_PORT ?? 9223)
const timeoutMs = Number(process.env.TAURI_E2E_TIMEOUT_MS ?? 120_000)
const runId = new Date().toISOString().replace(/[:.]/g, '-')
const artifactDir = resolve(root, 'e2e-artifacts', 'tauri-mcp', runId)
const transcript: CliCall[] = []
const devOutputPath = join(artifactDir, 'tauri-dev.log')
const transcriptPath = join(artifactDir, 'transcript.json')
const tempRoot = mkdtempSync(join(tmpdir(), 'ai-cowork-tauri-e2e-'))
const isolatedHome = join(tempRoot, 'home')
const macAccelerator = process.platform === 'darwin' ? 'Meta' : 'Control'

mkdirSync(artifactDir, { recursive: true })
mkdirSync(isolatedHome, { recursive: true })

const cliPrefix = process.env.TAURI_MCP_CLI_BIN
  ? [process.env.TAURI_MCP_CLI_BIN]
  : ['bunx', '@hypothesi/tauri-mcp-cli']

const tauriEnv = {
  ...process.env,
  TAURI_MCP: '1',
  TAURI_DEV_HOST: process.env.TAURI_DEV_HOST ?? '127.0.0.1',
  HOME: isolatedHome,
  CARGO_HOME: process.env.CARGO_HOME ?? join(homedir(), '.cargo'),
  RUSTUP_HOME: process.env.RUSTUP_HOME ?? join(homedir(), '.rustup'),
}

function log(message: string) {
  console.log(`[tauri-mcp-e2e] ${message}`)
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function stringify(value: unknown): string {
  if (typeof value === 'string') return value
  return JSON.stringify(value, null, 2)
}

function allText(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return value.map(allText).join('\n')
  if (typeof value === 'object') return Object.values(value).map(allText).join('\n')
  return ''
}

function parseJsonOutput(stdout: string): JsonValue | null {
  const trimmed = stdout.trim()
  if (!trimmed) return null

  try {
    return JSON.parse(trimmed) as JsonValue
  } catch {
    const start = trimmed.search(/[\[{]/)
    if (start === -1) return null
    try {
      return JSON.parse(trimmed.slice(start)) as JsonValue
    } catch {
      return null
    }
  }
}

function tailFile(path: string, maxLength = 4_000): string {
  try {
    return readFileSync(path, 'utf8').slice(-maxLength)
  } catch {
    return ''
  }
}

function readNodeStream(
  stream: NodeJS.ReadableStream | null,
  prefix: string
) {
  if (!stream) return

  stream.on('data', (chunk: Buffer | string) => {
    appendFileSync(devOutputPath, `${prefix}${chunk.toString()}`)
  })
}

async function runCli(
  args: string[],
  allowFailure = false
): Promise<JsonValue | string | null> {
  const startedAt = Date.now()
  const proc = Bun.spawn([...cliPrefix, ...args], {
    cwd: root,
    stdout: 'pipe',
    stderr: 'pipe',
    env: process.env,
  })

  const [stdout, stderr, exitCode] = await Promise.all([
    proc.stdout.text(),
    proc.stderr.text(),
    proc.exited,
  ])
  const parsed = parseJsonOutput(stdout)
  const call = {
    args,
    exitCode,
    stdout,
    stderr,
    parsed,
    durationMs: Date.now() - startedAt,
  }
  transcript.push(call)
  writeFileSync(transcriptPath, JSON.stringify(transcript, null, 2))

  if (exitCode !== 0 && !allowFailure) {
    throw new Error(
      `tauri-mcp ${args.join(' ')} failed with ${exitCode}\n${stderr || stdout}`
    )
  }

  return parsed ?? stdout
}

async function isTcpOpen(checkPort: number): Promise<boolean> {
  return await new Promise((resolveOpen) => {
    const socket = createConnection({ host: '127.0.0.1', port: checkPort })
    const finish = (open: boolean) => {
      socket.removeAllListeners()
      socket.destroy()
      resolveOpen(open)
    }

    socket.setTimeout(300)
    socket.once('connect', () => finish(true))
    socket.once('timeout', () => finish(false))
    socket.once('error', () => finish(false))
  })
}

async function waitForPort(
  checkPort: number,
  getAppExitCode: () => number | null | undefined
) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    const appExitCode = getAppExitCode()
    if (appExitCode !== undefined) {
      throw new Error(
        `Tauri dev exited with ${appExitCode} before MCP bridge opened.\n${tailFile(
          devOutputPath
        )}`
      )
    }
    if (await isTcpOpen(checkPort)) return
    await Bun.sleep(500)
  }

  throw new Error(`Timed out waiting for MCP bridge on 127.0.0.1:${checkPort}`)
}

async function captureFailureArtifacts() {
  await runCli(
    [
      'webview-screenshot',
      '--file-path',
      join(artifactDir, 'failure.png'),
      '--window-id',
      'main',
      '--json',
    ],
    true
  )
  await runCli(
    [
      'webview-dom-snapshot',
      '--type',
      'accessibility',
      '--window-id',
      'main',
      '--json',
    ],
    true
  )
  await runCli(
    ['read-logs', '--source', 'console', '--lines', '300', '--window-id', 'main', '--json'],
    true
  )
  await runCli(['ipc-get-captured', '--json'], true)
}

async function main() {
  if (process.platform !== 'darwin') {
    log(`running on ${process.platform}; this harness is optimized for local macOS`)
  }

  assert(
    !(await isTcpOpen(port)),
    `Port ${port} is already open. Stop any running Tauri MCP app before running this harness.`
  )
  assert(
    !(await isTcpOpen(1420)),
    'Port 1420 is already open. Stop the existing Vite/Tauri dev server before running this harness.'
  )

  log(`artifacts: ${artifactDir}`)
  log(`isolated HOME: ${isolatedHome}`)
  log('starting TAURI_MCP=1 bun run tauri dev')

  const app = spawnChildProcess('bun', ['run', 'tauri', 'dev'], {
    cwd: root,
    env: tauriEnv,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let appExitCode: number | null | undefined
  const appExited = new Promise<number | null>((resolve) => {
    app.once('exit', (code) => resolve(code))
    app.once('error', () => resolve(1))
  })
  appExited.then((code) => {
    appExitCode = code
  })

  readNodeStream(app.stdout, '[stdout] ')
  readNodeStream(app.stderr, '[stderr] ')

  try {
    await waitForPort(port, () => appExitCode)
    await runCli(['driver-session', 'start', '--port', String(port), '--json'])

    const backendState = await runCli(['ipc-get-backend-state', '--json'])
    assert(
      allText(backendState).includes('asc.evgn.aicoworklab'),
      'Backend state did not include the expected Tauri app identifier.'
    )

    const windows = await runCli(['manage-window', '--action', 'list', '--json'])
    assert(allText(windows).includes('main'), 'Window list did not include the main window.')

    await runCli(['ipc-monitor', '--action', 'start', '--json'])
    await runCli([
      'webview-wait-for',
      '--type',
      'text',
      '--value',
      "Welcome! What's your name?",
      '--window-id',
      'main',
      '--timeout',
      '60000',
      '--json',
    ])

    const setupSnapshot = await runCli([
      'webview-dom-snapshot',
      '--type',
      'accessibility',
      '--window-id',
      'main',
      '--json',
    ])
    const setupText = allText(setupSnapshot)
    assert(setupText.includes("Welcome! What's your name?"), 'Setup profile heading is missing.')
    assert(setupText.includes('Your name'), 'Profile name input is missing.')

    await runCli([
      'webview-interact',
      '--action',
      'focus',
      '--selector',
      '#profile-name',
      '--window-id',
      'main',
      '--json',
    ])
    await runCli([
      'webview-keyboard',
      '--action',
      'press',
      '--key',
      'a',
      '--modifiers',
      macAccelerator,
      '--window-id',
      'main',
      '--json',
    ])
    await runCli([
      'webview-keyboard',
      '--action',
      'type',
      '--selector',
      '#profile-name',
      '--text',
      'MCP Tester',
      '--window-id',
      'main',
      '--json',
    ])

    const profileValue = await runCli([
      'webview-execute-js',
      '--window-id',
      'main',
      '--script',
      "(() => document.querySelector('#profile-name')?.value ?? null)()",
      '--json',
    ])
    assert(allText(profileValue).includes('MCP Tester'), 'Profile name was not typed.')

    await runCli([
      'webview-interact',
      '--action',
      'click',
      '--selector',
      'Continue',
      '--strategy',
      'text',
      '--window-id',
      'main',
      '--json',
    ])
    await runCli([
      'webview-wait-for',
      '--type',
      'text',
      '--value',
      'Connect an AI provider',
      '--window-id',
      'main',
      '--timeout',
      '15000',
      '--json',
    ])
    await runCli([
      'webview-interact',
      '--action',
      'click',
      '--selector',
      'Custom (OpenAI-compatible)',
      '--strategy',
      'text',
      '--window-id',
      'main',
      '--json',
    ])
    await runCli([
      'webview-keyboard',
      '--action',
      'type',
      '--selector',
      '#provider-url',
      '--text',
      'http://127.0.0.1:11434',
      '--window-id',
      'main',
      '--json',
    ])

    const providerValue = await runCli([
      'webview-execute-js',
      '--window-id',
      'main',
      '--script',
      "(() => document.querySelector('#provider-url')?.value ?? null)()",
      '--json',
    ])
    assert(
      allText(providerValue).includes('http://127.0.0.1:11434'),
      'Provider URL was not typed.'
    )

    const capturedIpc = await runCli(['ipc-get-captured', '--json'])
    assert(
      stringify(capturedIpc).length > 2,
      'IPC monitor returned no structured capture payload.'
    )

    const consoleLogs = await runCli([
      'read-logs',
      '--source',
      'console',
      '--lines',
      '300',
      '--window-id',
      'main',
      '--json',
    ])
    assert(
      !/\b(error|exception|unhandled)\b/i.test(allText(consoleLogs)),
      'Console logs contain an error, exception, or unhandled failure.'
    )

    await runCli(['driver-session', 'stop', '--json'], true)
    log('passed')
  } catch (error) {
    log('failed; capturing MCP artifacts')
    await captureFailureArtifacts()
    throw error
  } finally {
    await runCli(['driver-session', 'stop', '--json'], true)

    if (app.pid && appExitCode === undefined) {
      try {
        process.kill(-app.pid, 'SIGTERM')
      } catch {
        app.kill('SIGTERM')
      }

      const exited = await Promise.race([
        appExited,
        Bun.sleep(5_000).then(() => undefined),
      ])
      if (exited === undefined) {
        try {
          process.kill(-app.pid, 'SIGKILL')
        } catch {
          app.kill('SIGKILL')
        }
      }
    }

    writeFileSync(transcriptPath, JSON.stringify(transcript, null, 2))
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  console.error(`Artifacts written to ${artifactDir}`)
  process.exit(1)
})
