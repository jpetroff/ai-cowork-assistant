// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RenameProjectForm } from '../RenameProjectForm'
import type { Project } from '@/lib/db/types'
import { useProjectStore } from '@/components/projects/projectStore'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@tauri-apps/plugin-sql', () => ({
  default: { load: vi.fn(async () => ({ select: vi.fn(), execute: vi.fn() })) },
}))

const mockUpdateProject = vi.fn()

vi.mock('@/lib/db/repositories/projects', () => ({
  listProjects: vi.fn(async () => []),
  createProject: vi.fn(async () => crypto.randomUUID()),
  updateProject: (...args: unknown[]) => mockUpdateProject(...args),
  deleteProject: vi.fn(async () => undefined),
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'form-id',
    name: 'Original Name',
    folder_path: null,
    created_at: Date.now(),
    updated_at: Date.now(),
    ...overrides,
  }
}

function renderForm(project: Project, open = true) {
  const onOpenChange = vi.fn()
  render(
    <RenameProjectForm
      project={project}
      open={open}
      onOpenChange={onOpenChange}
    />
  )
  return { onOpenChange }
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
  mockUpdateProject.mockReset()
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('RenameProjectForm', () => {
  it('pre-fills input with current project name', () => {
    renderForm(makeProject({ name: 'My Notes' }))
    const input = screen.getByLabelText('Name') as HTMLInputElement
    expect(input.value).toBe('My Notes')
  })

  it('submit button is disabled when name is empty', async () => {
    renderForm(makeProject())
    const input = screen.getByLabelText('Name')
    await userEvent.clear(input)
    const submitBtn = screen.getByRole('button', { name: /^rename$/i })
    expect(submitBtn).toBeDisabled()
  })

  it('calls projectStore.rename with trimmed name on submit', async () => {
    mockUpdateProject.mockResolvedValue(undefined)
    const project = makeProject({ id: 'rename-id', name: 'Old' })
    useProjectStore.setState({ projects: [project] })
    renderForm(project)

    const input = screen.getByLabelText('Name')
    await userEvent.clear(input)
    await userEvent.type(input, '  New Name  ')
    await userEvent.click(screen.getByRole('button', { name: /^rename$/i }))

    expect(mockUpdateProject).toHaveBeenCalledWith('rename-id', {
      name: 'New Name',
    })
  })

  it('form elements are disabled while operationState is renaming', () => {
    const project = makeProject({ id: 'form-id' })
    useProjectStore.setState({
      projects: [project],
      operationStates: { 'form-id': 'renaming' },
    })
    renderForm(project)

    expect(screen.getByLabelText('Name')).toBeDisabled()
    expect(screen.getByRole('button', { name: /renaming/i })).toBeDisabled()
  })

  it('does not call rename when name is unchanged', async () => {
    const { onOpenChange } = renderForm(makeProject({ name: 'Same' }))
    await userEvent.click(screen.getByRole('button', { name: /^rename$/i }))
    expect(mockUpdateProject).not.toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
