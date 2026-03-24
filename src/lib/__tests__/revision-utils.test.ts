import { describe, it, expect } from 'vitest'
import type { ArtifactRevision, Message } from '@/lib/db/types'
import {
  canEditInPlace,
  findLastSealedRevision,
  hasContentChangedSinceLastSeal,
  buildThread,
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
    sequence_order: 0,
    created_at: Date.now(),
    ...overrides,
  }
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
  it('returns empty array when both lists are empty', () => {
    expect(buildThread([], [])).toEqual([])
  })

  it('excludes draft revisions (message_id === null)', () => {
    const draft = makeRevision({ message_id: null })
    const thread = buildThread([], [draft])
    expect(thread).toHaveLength(0)
  })

  it('includes sealed revisions', () => {
    const sealed = makeRevision({ message_id: 'msg-1' })
    const thread = buildThread([], [sealed])
    expect(thread).toHaveLength(1)
    expect(thread[0]).toEqual({ type: 'revision', data: sealed })
  })

  it('merges messages and sealed revisions in created_at ASC order', () => {
    const msg1 = makeMessage({ created_at: 100 })
    const rev1 = makeRevision({ message_id: 'msg-1', created_at: 150 })
    const msg2 = makeMessage({ created_at: 200 })
    const draft = makeRevision({ message_id: null, created_at: 250 })

    const thread = buildThread([msg1, msg2], [rev1, draft])

    expect(thread).toHaveLength(3) // draft excluded
    expect(thread[0]).toEqual({ type: 'message', data: msg1 })
    expect(thread[1]).toEqual({ type: 'revision', data: rev1 })
    expect(thread[2]).toEqual({ type: 'message', data: msg2 })
  })
})
