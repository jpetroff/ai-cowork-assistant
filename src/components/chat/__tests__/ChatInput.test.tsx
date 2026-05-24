// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Children, cloneElement, isValidElement, type ReactNode } from 'react'
import type { Artifact } from '@/lib/db/types'

const {
  chatState,
  artifactState,
  mockListArtifacts,
  mockListArtifactsByProject,
} = vi.hoisted(() => ({
  chatState: {
    isAssistantStreaming: false,
    activeConversationId: 'conv-1' as string | null,
    activeProjectId: 'proj-1' as string | null,
    submitMessage: vi.fn(async () => undefined),
  },
  artifactState: {
    artifact: null as Artifact | null,
    requestArtifactLoad: vi.fn(async () => undefined),
  },
  mockListArtifacts: vi.fn<() => Promise<Artifact[]>>(),
  mockListArtifactsByProject: vi.fn<() => Promise<Artifact[]>>(),
}))

vi.mock('@/components/chat/chatSessionStore', () => ({
  useChatSessionStore: (selector: (s: typeof chatState) => unknown) =>
    selector(chatState),
}))

vi.mock('@/components/editor/artifactStore', () => ({
  useArtifactStore: (selector: (s: typeof artifactState) => unknown) =>
    selector(artifactState),
}))

vi.mock('@/lib/db/repositories/documents', () => ({
  listArtifacts: () => mockListArtifacts(),
  listArtifactsByProject: () => mockListArtifactsByProject(),
}))

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuTrigger: ({
    children,
    disabled,
    ...props
  }: {
    children: ReactNode
    disabled?: boolean
  }) => (
    <button type='button' disabled={disabled} {...props}>
      {children}
    </button>
  ),
  DropdownMenuContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    onClick,
    disabled,
    className,
  }: {
    children: ReactNode
    onClick?: () => void
    disabled?: boolean
    className?: string
  }) => (
    <button
      type='button'
      disabled={disabled}
      className={className}
      onClick={onClick}
    >
      {children}
    </button>
  ),
  DropdownMenuLabel: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuRadioGroup: ({
    children,
    onValueChange,
  }: {
    children: ReactNode
    onValueChange?: (value: string) => void
  }) => (
    <div>
      {Children.map(children, (child) =>
        isValidElement(child)
          ? cloneElement(child, { onValueChange } as Record<string, unknown>)
          : child
      )}
    </div>
  ),
  DropdownMenuRadioItem: ({
    children,
    disabled,
    onValueChange,
    value,
  }: {
    children: ReactNode
    disabled?: boolean
    onValueChange?: (value: string) => void
    value: string
  }) => (
    <button
      type='button'
      disabled={disabled}
      onClick={() => onValueChange?.(value)}
    >
      {children}
    </button>
  ),
  DropdownMenuSeparator: () => <hr />,
}))

import { ChatInput } from '../ChatInput'

function makeArtifact(overrides: Partial<Artifact> = {}): Artifact {
  return {
    id: 'art-1',
    conversation_id: 'conv-1',
    title: 'Draft',
    current_revision_id: 'rev-1',
    file_path: null,
    file_hash: null,
    created_at: 1000,
    updated_at: 1000,
    ...overrides,
  }
}

async function removeDefaultContext() {
  await userEvent.click(screen.getByLabelText('Remove artifact context'))
  expect(screen.getByLabelText('Add artifact context')).toBeInTheDocument()
}

async function submitMessage(text = 'hello') {
  await userEvent.type(screen.getByPlaceholderText(/Message/), text)
  await userEvent.click(screen.getByLabelText('Send message'))
}

beforeEach(() => {
  vi.clearAllMocks()
  chatState.isAssistantStreaming = false
  chatState.activeConversationId = 'conv-1'
  chatState.activeProjectId = 'proj-1'
  artifactState.artifact = null
  mockListArtifacts.mockResolvedValue([])
  mockListArtifactsByProject.mockResolvedValue([])
})

afterEach(() => {
  cleanup()
})

describe('ChatInput', () => {
  it('shows the current editor artifact as default context', async () => {
    artifactState.artifact = makeArtifact({ title: 'Open artifact' })

    render(<ChatInput />)

    expect(screen.getByText('Open artifact')).toBeInTheDocument()
    expect(screen.getByText('Editor')).toBeInTheDocument()
    expect(
      screen.queryByLabelText('Add artifact context')
    ).not.toBeInTheDocument()
  })

  it('removes default context and shows the add button', async () => {
    artifactState.artifact = makeArtifact({ title: 'Open artifact' })

    render(<ChatInput />)

    await removeDefaultContext()

    expect(screen.queryByText('Open artifact')).not.toBeInTheDocument()
  })

  it('selects a conversation artifact and submits it as message context', async () => {
    artifactState.artifact = makeArtifact({ title: 'Open artifact' })
    const selectedArtifact = makeArtifact({
      id: 'art-2',
      title: 'Conversation artifact',
      updated_at: 2000,
    })
    mockListArtifacts.mockResolvedValue([
      artifactState.artifact,
      selectedArtifact,
    ])

    render(<ChatInput />)
    await removeDefaultContext()

    await waitFor(() => {
      expect(screen.getByText('Conversation artifact')).toBeInTheDocument()
    })
    await userEvent.click(screen.getByText('Conversation artifact'))
    expect(screen.getByText('Selected')).toBeInTheDocument()

    await submitMessage()

    expect(chatState.submitMessage).toHaveBeenCalledWith('hello', {
      artifactId: 'art-2',
    })
  })

  it('selects a project artifact without loading it into the editor', async () => {
    artifactState.artifact = makeArtifact({ title: 'Open artifact' })
    mockListArtifacts.mockResolvedValue([artifactState.artifact])
    mockListArtifactsByProject.mockResolvedValue([
      makeArtifact({
        id: 'project-art',
        conversation_id: 'conv-2',
        title: 'Project artifact',
        updated_at: 3000,
      }),
    ])

    render(<ChatInput />)
    await removeDefaultContext()

    await userEvent.click(screen.getByText('Project artifacts'))

    await waitFor(() => {
      expect(screen.getByText('Project artifact')).toBeInTheDocument()
    })
    await userEvent.click(screen.getByText('Project artifact'))

    await submitMessage()

    expect(artifactState.requestArtifactLoad).not.toHaveBeenCalled()
    expect(chatState.submitMessage).toHaveBeenCalledWith('hello', {
      artifactId: 'project-art',
    })
  })

  it('shows only one selected artifact after changing context', async () => {
    artifactState.artifact = makeArtifact({ title: 'Open artifact' })
    mockListArtifacts.mockResolvedValue([
      makeArtifact({ id: 'art-2', title: 'First artifact', updated_at: 2000 }),
      makeArtifact({ id: 'art-3', title: 'Second artifact', updated_at: 3000 }),
    ])

    render(<ChatInput />)
    await removeDefaultContext()

    await waitFor(() => {
      expect(screen.getByText('First artifact')).toBeInTheDocument()
    })
    await userEvent.click(screen.getByText('First artifact'))
    await userEvent.click(screen.getByLabelText('Remove artifact context'))
    await waitFor(() => {
      expect(screen.getByText('Second artifact')).toBeInTheDocument()
    })
    await userEvent.click(screen.getByText('Second artifact'))

    expect(screen.queryByText('First artifact')).not.toBeInTheDocument()
    expect(screen.getByText('Second artifact')).toBeInTheDocument()
    expect(screen.getAllByText('Selected')).toHaveLength(1)
  })
})
