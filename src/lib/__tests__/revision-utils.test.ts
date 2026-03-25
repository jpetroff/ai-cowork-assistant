import { describe, it, expect } from 'vitest'
import type { ArtifactRevision, Message } from '@/lib/db/types'
import {
  canEditInPlace,
  findLastSealedRevision,
  hasContentChangedSinceLastSeal,
  buildThread,
  hasRevisionMetadata,
  parseRevisionMetadata,
} from '../revision-utils'

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeRevision(overrides: Partial<ArtifactRevision> = {}): ArtifactRevision {
  return {
    id: crypto.randomUUID(),
    artifact_id: 'art-1',
    message_id: null,
    author: 'user',
    content: 'hello',
    created_at: Date.now(),
    updated_at: Date.now(),
    ...overrides,
  }
}

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: crypto.randomUUID(),
    conversation_id: 'conv-1',
    role: 'user',
    content: 'hi',
    metadata: null,
    sequence_order: 0,
    created_at: Date.now(),
    ...overrides,
  }
}

function makeSystemRevisionMessage(revisionId: string, author: 'user' | 'ai', overrides: Partial<Message> = {}): Message {
  return makeMessage({
    role: 'system',
    content: `${author} created artifact revision`,
    metadata: JSON.stringify({ revisionId, author }),
    ...overrides,
  })
}

// ── canEditInPlace ─────────────────────────────────────────────────────────────

describe('canEditInPlace', () => {
  it('returns true when message_id is null (user draft)', () => {
    expect(canEditInPlace(makeRevision({ message_id: null }))).toBe(true)
  })

  it('returns false when message_id is set (sealed)', () => {
    expect(canEditInPlace(makeRevision({ message_id: 'msg-1' }))).toBe(false)
  })
})

// ── findLastSealedRevision ─────────────────────────────────────────────────────

describe('findLastSealedRevision', () => {
  it('returns null when no revisions', () => {
    expect(findLastSealedRevision([])).toBeNull()
  })

  it('returns null when all revisions are drafts', () => {
    const revs = [makeRevision(), makeRevision()]
    expect(findLastSealedRevision(revs)).toBeNull()
  })

  it('returns the last sealed revision', () => {
    const sealed1 = makeRevision({ message_id: 'msg-1', created_at: 100 })
    const sealed2 = makeRevision({ message_id: 'msg-2', created_at: 200 })
    const draft = makeRevision({ message_id: null, created_at: 300 })
    expect(findLastSealedRevision([sealed1, sealed2, draft])).toBe(sealed2)
  })
})

// ── hasContentChangedSinceLastSeal ─────────────────────────────────────────────

describe('hasContentChangedSinceLastSeal', () => {
  it('returns false when content matches last sealed revision', () => {
    const sealed = makeRevision({ message_id: 'msg-1', content: 'baseline' })
    const head = makeRevision({ content: 'baseline' })
    expect(hasContentChangedSinceLastSeal(head, [sealed, head])).toBe(false)
  })

  it('returns true when content differs from last sealed revision', () => {
    const sealed = makeRevision({ message_id: 'msg-1', content: 'old' })
    const head = makeRevision({ content: 'new' })
    expect(hasContentChangedSinceLastSeal(head, [sealed, head])).toBe(true)
  })

  it('compares against empty string when no sealed revisions exist', () => {
    const head = makeRevision({ content: '' })
    expect(hasContentChangedSinceLastSeal(head, [head])).toBe(false)

    const headWithContent = makeRevision({ content: 'something' })
    expect(hasContentChangedSinceLastSeal(headWithContent, [headWithContent])).toBe(true)
  })
})

// ── buildThread ────────────────────────────────────────────────────────────────

describe('buildThread', () => {
  it('returns empty array when messages list is empty', () => {
    expect(buildThread([])).toEqual([])
  })

  it('includes user and assistant messages', () => {
    const msg1 = makeMessage({ role: 'user', created_at: 100 })
    const msg2 = makeMessage({ role: 'assistant', created_at: 200 })
    const thread = buildThread([msg1, msg2])
    expect(thread).toHaveLength(2)
    expect(thread[0]).toEqual({ type: 'message', data: msg1 })
    expect(thread[1]).toEqual({ type: 'message', data: msg2 })
  })

  it('includes system messages with valid revisionId metadata', () => {
    const sysMsg = makeSystemRevisionMessage('rev-1', 'user', { created_at: 150 })
    const thread = buildThread([sysMsg])
    expect(thread).toHaveLength(1)
    expect(thread[0]).toEqual({ type: 'message', data: sysMsg })
  })

  it('excludes system messages without metadata', () => {
    const sysMsg = makeMessage({ role: 'system', metadata: null })
    expect(buildThread([sysMsg])).toHaveLength(0)
  })

  it('excludes system messages with invalid/empty metadata', () => {
    const noRevId = makeMessage({ role: 'system', metadata: JSON.stringify({ author: 'user' }) })
    const badJson = makeMessage({ role: 'system', metadata: 'not-json' })
    expect(buildThread([noRevId, badJson])).toHaveLength(0)
  })

  it('sorts all items by created_at ASC', () => {
    const msg1 = makeMessage({ role: 'user', created_at: 100 })
    const sysMsg = makeSystemRevisionMessage('rev-1', 'user', { created_at: 150 })
    const msg2 = makeMessage({ role: 'assistant', created_at: 200 })
    const aiSysMsg = makeSystemRevisionMessage('rev-2', 'ai', { created_at: 250 })

    const thread = buildThread([msg1, sysMsg, msg2, aiSysMsg])
    expect(thread).toHaveLength(4)
    expect(thread[0].data).toBe(msg1)
    expect(thread[1].data).toBe(sysMsg)
    expect(thread[2].data).toBe(msg2)
    expect(thread[3].data).toBe(aiSysMsg)
  })
})

// ── hasRevisionMetadata / parseRevisionMetadata ────────────────────────────────

describe('hasRevisionMetadata', () => {
  it('returns true for system message with valid metadata', () => {
    const msg = makeSystemRevisionMessage('rev-1', 'user')
    expect(hasRevisionMetadata(msg)).toBe(true)
  })

  it('returns false for non-system message', () => {
    expect(hasRevisionMetadata(makeMessage({ role: 'user' }))).toBe(false)
    expect(hasRevisionMetadata(makeMessage({ role: 'assistant' }))).toBe(false)
  })

  it('returns false for system message with null metadata', () => {
    expect(hasRevisionMetadata(makeMessage({ role: 'system', metadata: null }))).toBe(false)
  })

  it('returns false for system message with no revisionId in metadata', () => {
    const msg = makeMessage({ role: 'system', metadata: JSON.stringify({ author: 'user' }) })
    expect(hasRevisionMetadata(msg)).toBe(false)
  })
})

describe('parseRevisionMetadata', () => {
  it('returns parsed metadata for valid system message', () => {
    const msg = makeSystemRevisionMessage('rev-abc', 'ai')
    const meta = parseRevisionMetadata(msg)
    expect(meta).toEqual({ revisionId: 'rev-abc', author: 'ai' })
  })

  it('returns null for invalid system message', () => {
    const msg = makeMessage({ role: 'system', metadata: null })
    expect(parseRevisionMetadata(msg)).toBeNull()
  })
})
