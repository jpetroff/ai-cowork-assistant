// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Project } from '@/lib/db/types'
import { useProjectStore } from '@/components/projects/projectStore'
import { useNotificationStore } from '@/components/ui/notificationStore'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockNavigate = vi.fn()

vi.mock('react-router-dom', () => ({
  Link: ({
    to,
    children,
    className,
  }: {
    to: string
    children: React.ReactNode
    className?: string
  }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
  useNavigate: () => mockNavigate,
}))

vi.mock('@tauri-apps/plugin-sql', () => ({
  default: { load: vi.fn(async () => ({ select: vi.fn(), execute: vi.fn() })) },
}))

const mockUpdateProject = vi.fn()

vi.mock('@/lib/db/repositories/projects', () => ({
  listProjects: vi.fn(async () => []),
  createProject: vi.fn(async () => crypto.randomUUID()),
  updateProject: (...args: unknown[]) => mockUpdateProject(...args),
  deleteProject: vi.fn(async () => {}),
}))

// ── Imports after mocks ───────────────────────────────────────────────────────

import { ProjectHeader } from '../ProjectHeader'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'proj-1',
    name: 'My Project',
    folder_path: null,
    created_at: Date.now(),
    updated_at: Date.now(),
    ...overrides,
  }
}

afterEach(cleanup)

beforeEach(() => {
  useProjectStore.setState({
    projects: [],
    activeProjectId: null,
    status: 'ready',
    error: null,
    operationStates: {},
  })
  useNotificationStore.getState().dismissAll()
  mockUpdateProject.mockReset()
  mockNavigate.mockReset()
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ProjectHeader — display mode', () => {
  it('renders the project name', () => {
    render(<ProjectHeader project={makeProject({ name: 'Research Hub' })} />)
    expect(screen.getByText('Research Hub')).toBeTruthy()
  })

  it('renders a back link pointing to /', () => {
    render(<ProjectHeader project={makeProject()} />)
    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toBe('/')
  })
})

describe('ProjectHeader — inline rename', () => {
  it('shows an input when the project name is clicked', async () => {
    render(<ProjectHeader project={makeProject({ name: 'Old Name' })} />)
    await userEvent.click(screen.getByRole('button', { name: /old name/i }))
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('pre-fills the input with the current name', async () => {
    render(<ProjectHeader project={makeProject({ name: 'Old Name' })} />)
    await userEvent.click(screen.getByRole('button', { name: /old name/i }))
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe(
      'Old Name'
    )
  })

  it('calls rename and exits edit mode when Enter is pressed', async () => {
    const project = makeProject({ name: 'Old Name' })
    useProjectStore.setState({ projects: [project] })
    mockUpdateProject.mockResolvedValue(undefined)

    render(<ProjectHeader project={project} />)
    await userEvent.click(screen.getByRole('button', { name: /old name/i }))

    const input = screen.getByRole('textbox')
    await userEvent.clear(input)
    await userEvent.type(input, 'New Name')
    await userEvent.keyboard('{Enter}')

    expect(mockUpdateProject).toHaveBeenCalledWith('proj-1', {
      name: 'New Name',
    })
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('discards rename and exits edit mode when Escape is pressed', async () => {
    const project = makeProject({ name: 'Original' })
    render(<ProjectHeader project={project} />)

    await userEvent.click(screen.getByRole('button', { name: /original/i }))
    const input = screen.getByRole('textbox')
    await userEvent.clear(input)
    await userEvent.type(input, 'Discarded')
    await userEvent.keyboard('{Escape}')

    expect(mockUpdateProject).not.toHaveBeenCalled()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('calls rename when the ✓ button is clicked', async () => {
    const project = makeProject({ name: 'Before' })
    useProjectStore.setState({ projects: [project] })
    mockUpdateProject.mockResolvedValue(undefined)

    render(<ProjectHeader project={project} />)
    await userEvent.click(screen.getByRole('button', { name: /before/i }))

    const input = screen.getByRole('textbox')
    await userEvent.clear(input)
    await userEvent.type(input, 'After')
    await userEvent.click(screen.getByRole('button', { name: /apply/i }))

    expect(mockUpdateProject).toHaveBeenCalledWith('proj-1', { name: 'After' })
  })

  it('discards rename when the × button is clicked', async () => {
    render(<ProjectHeader project={makeProject({ name: 'Unchanged' })} />)
    await userEvent.click(screen.getByRole('button', { name: /unchanged/i }))
    await userEvent.click(screen.getByRole('button', { name: /discard/i }))

    expect(mockUpdateProject).not.toHaveBeenCalled()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })
})
