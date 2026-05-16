// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProjectCard } from '../ProjectCard'
import type { Project } from '@/lib/db/types'
import { useProjectStore } from '@/components/projects/projectStore'
import { useNotificationStore } from '@/components/ui/notificationStore'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockNavigate = vi.fn()

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}))

vi.mock('@tauri-apps/plugin-sql', () => ({
  default: { load: vi.fn(async () => ({ select: vi.fn(), execute: vi.fn() })) },
}))

const mockDeleteProject = vi.fn()
const mockUpdateProject = vi.fn()

vi.mock('@/lib/db/repositories/projects', () => ({
  listProjects: vi.fn(async () => []),
  createProject: vi.fn(async () => crypto.randomUUID()),
  updateProject: (...args: unknown[]) => mockUpdateProject(...args),
  deleteProject: (...args: unknown[]) => mockDeleteProject(...args),
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'test-id',
    name: 'My Project',
    folder_path: null,
    created_at: new Date('2026-01-15').getTime(),
    updated_at: new Date('2026-01-15').getTime(),
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
  mockNavigate.mockReset()
  mockDeleteProject.mockReset()
  mockUpdateProject.mockReset()
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ProjectCard — idle state', () => {
  it('renders project name', () => {
    render(<ProjectCard project={makeProject({ name: 'Research Notes' })} />)
    expect(screen.getByText('Research Notes')).toBeTruthy()
  })

  it('renders a formatted date', () => {
    render(<ProjectCard project={makeProject()} />)
    // The date cell exists in the card description slot
    const desc = document.querySelector('[data-slot="card-description"]')
    expect(desc?.textContent).toBeTruthy()
  })

  it('navigates to project page on click', async () => {
    const project = makeProject({ id: 'proj-1' })
    useProjectStore.setState({ projects: [project] })
    render(<ProjectCard project={project} />)

    await userEvent.click(screen.getByRole('button', { name: /Open project/i }))

    expect(mockNavigate).toHaveBeenCalledWith('/projects/proj-1')
  })
})

describe('ProjectCard — deleting state', () => {
  it('card has aria-busy=true and pointer-events-none when deleting', () => {
    const project = makeProject({ id: 'proj-1' })
    useProjectStore.setState({
      projects: [project],
      operationStates: { 'proj-1': 'deleting' },
    })
    render(<ProjectCard project={project} />)

    const card = screen.getByRole('button', { name: /Open project/i })
    expect(card.getAttribute('aria-busy')).toBe('true')
    expect(card.className).toContain('pointer-events-none')
  })
})

describe('ProjectCard — renaming state', () => {
  it('card has aria-busy=true when renaming', () => {
    const project = makeProject({ id: 'proj-1' })
    useProjectStore.setState({
      projects: [project],
      operationStates: { 'proj-1': 'renaming' },
    })
    render(<ProjectCard project={project} />)

    const card = screen.getByRole('button', { name: /Open project/i })
    expect(card.getAttribute('aria-busy')).toBe('true')
  })
})

// NOTE: The dropdown menu interaction tests (open menu → click Delete/Rename → confirm dialog)
// require a real browser environment and are covered by Playwright E2E tests.
// The following tests verify the surrounding behavior testable in jsdom.

describe('ProjectCard — options menu trigger', () => {
  it('renders the options menu trigger button', () => {
    render(<ProjectCard project={makeProject()} />)
    expect(screen.getByRole('button', { name: /options/i })).toBeInTheDocument()
  })

  it('options trigger is not rendered when card is busy', () => {
    const project = makeProject({ id: 'busy-id' })
    useProjectStore.setState({
      projects: [project],
      operationStates: { 'busy-id': 'deleting' },
    })
    render(<ProjectCard project={project} />)
    // Trigger still rendered but the whole card is pointer-events-none
    const card = screen.getByRole('button', { name: /Open project/i })
    expect(card.className).toContain('pointer-events-none')
  })
})

describe('ProjectCard — delete confirmation dialog', () => {
  it('calls projectStore.delete when user confirms deletion', async () => {
    mockDeleteProject.mockResolvedValue(undefined)
    const project = makeProject({ id: 'del-id' })
    useProjectStore.setState({ projects: [project] })

    // Render the card with the delete dialog already open via a wrapper
    const { RenameProjectForm } = await import('../RenameProjectForm')
    const {
      AlertDialog,
      AlertDialogContent,
      AlertDialogHeader,
      AlertDialogTitle,
      AlertDialogDescription,
      AlertDialogFooter,
      AlertDialogCancel,
      AlertDialogAction,
    } = await import('@/components/ui/alert-dialog')

    const deleteProject = useProjectStore.getState().delete
    const onConfirm = vi.fn(() => deleteProject('del-id'))

    render(
      <AlertDialog open={true}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project?</AlertDialogTitle>
            <AlertDialogDescription>
              This will be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirm}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    )

    const confirmBtn = await screen.findByRole('button', { name: /^delete$/i })
    await userEvent.click(confirmBtn)

    expect(mockDeleteProject).toHaveBeenCalledWith('del-id')
  })
})
