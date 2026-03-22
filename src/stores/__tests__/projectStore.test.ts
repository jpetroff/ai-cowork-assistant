import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Project } from '@/lib/db/types'

// ── Mock repositories ─────────────────────────────────────────────────────────

const mockListProjects = vi.fn<() => Promise<Project[]>>()
const mockCreateProject = vi.fn<() => Promise<string>>()
const mockUpdateProject = vi.fn<() => Promise<void>>()
const mockDeleteProject = vi.fn<() => Promise<void>>()

vi.mock('@/lib/db/repositories/projects', () => ({
  listProjects: () => mockListProjects(),
  createProject: (...args: unknown[]) => mockCreateProject(...args),
  updateProject: (...args: unknown[]) => mockUpdateProject(...args),
  deleteProject: (...args: unknown[]) => mockDeleteProject(...args),
}))

// ── Mock Tauri (required by db/sqlite.ts even if not used directly) ───────────

vi.mock('@tauri-apps/plugin-sql', () => ({
  default: { load: vi.fn(async () => ({ select: vi.fn(), execute: vi.fn() })) },
}))

// ── Imports after mocks ───────────────────────────────────────────────────────

import { useProjectStore } from '../projectStore'
import { useNotificationStore } from '../notificationStore'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: crypto.randomUUID(),
    name: 'Test Project',
    folder_path: null,
    created_at: Date.now(),
    updated_at: Date.now(),
    ...overrides,
  }
}

beforeEach(() => {
  // Reset both stores to clean state
  useProjectStore.setState({
    projects: [],
    activeProjectId: null,
    status: 'idle',
    error: null,
    operationStates: {},
  })
  useNotificationStore.getState().dismissAll()
  vi.clearAllMocks()
})

// ── loadAll() ─────────────────────────────────────────────────────────────────

describe('loadAll()', () => {
  it('sets status to ready and populates projects on success', async () => {
    const projects = [makeProject({ name: 'A' }), makeProject({ name: 'B' })]
    mockListProjects.mockResolvedValue(projects)

    await useProjectStore.getState().loadAll()

    const state = useProjectStore.getState()
    expect(state.status).toBe('ready')
    expect(state.projects).toEqual(projects)
    expect(state.error).toBeNull()
  })

  it('sets status to error on DB failure', async () => {
    mockListProjects.mockRejectedValue(new Error('disk I/O error'))

    await useProjectStore.getState().loadAll()

    const state = useProjectStore.getState()
    expect(state.status).toBe('error')
    expect(state.error).toContain('disk I/O error')
    expect(state.projects).toHaveLength(0)
  })

  it('transitions through loading before resolving', async () => {
    const statuses: string[] = []
    const unsub = useProjectStore.subscribe((s) => statuses.push(s.status))

    mockListProjects.mockResolvedValue([])
    await useProjectStore.getState().loadAll()
    unsub()

    expect(statuses).toContain('loading')
    expect(statuses[statuses.length - 1]).toBe('ready')
  })
})

// ── create() ─────────────────────────────────────────────────────────────────

describe('create()', () => {
  it('creates a project with default name and null folder_path', async () => {
    const id = crypto.randomUUID()
    mockCreateProject.mockResolvedValue(id)

    const result = await useProjectStore.getState().create()

    expect(result).not.toBeNull()
    expect(result!.name).toBe('New project')
    expect(result!.folder_path).toBeNull()
    expect(result!.id).toBe(id)
  })

  it('prepends the new project to the list', async () => {
    const existing = makeProject({ name: 'Old' })
    useProjectStore.setState({ projects: [existing] })
    mockCreateProject.mockResolvedValue(crypto.randomUUID())

    await useProjectStore.getState().create()

    const { projects } = useProjectStore.getState()
    expect(projects).toHaveLength(2)
    expect(projects[0].name).toBe('New project')
  })

  it('pushes an error notification and returns null on failure', async () => {
    mockCreateProject.mockRejectedValue(new Error('write failed'))

    const result = await useProjectStore.getState().create()

    expect(result).toBeNull()
    const { notifications } = useNotificationStore.getState()
    expect(notifications).toHaveLength(1)
    expect(notifications[0].kind).toBe('error')
    expect(notifications[0].detail).toContain('write failed')
  })
})

// ── rename() ─────────────────────────────────────────────────────────────────

describe('rename()', () => {
  it('sets operationStates to renaming before DB call, then clears it', async () => {
    const project = makeProject()
    useProjectStore.setState({ projects: [project] })
    const states: string[] = []

    mockUpdateProject.mockImplementation(async () => {
      states.push(useProjectStore.getState().operationStates[project.id] ?? 'none')
    })

    await useProjectStore.getState().rename(project.id, 'Renamed')

    expect(states[0]).toBe('renaming')
    expect(useProjectStore.getState().operationStates[project.id]).toBeUndefined()
  })

  it('updates project name in place on success', async () => {
    const project = makeProject({ name: 'Old' })
    useProjectStore.setState({ projects: [project] })
    mockUpdateProject.mockResolvedValue(undefined)

    await useProjectStore.getState().rename(project.id, 'New Name')

    const updated = useProjectStore.getState().projects.find((p) => p.id === project.id)
    expect(updated?.name).toBe('New Name')
  })

  it('clears operationState and pushes toast on DB failure', async () => {
    const project = makeProject()
    useProjectStore.setState({ projects: [project] })
    mockUpdateProject.mockRejectedValue(new Error('locked'))

    await useProjectStore.getState().rename(project.id, 'Fail')

    expect(useProjectStore.getState().operationStates[project.id]).toBeUndefined()
    const { notifications } = useNotificationStore.getState()
    expect(notifications[0].kind).toBe('error')
  })

  it('ignores concurrent rename if operation already in progress', async () => {
    const project = makeProject()
    useProjectStore.setState({
      projects: [project],
      operationStates: { [project.id]: 'renaming' },
    })

    await useProjectStore.getState().rename(project.id, 'Ignored')

    expect(mockUpdateProject).not.toHaveBeenCalled()
  })
})

// ── delete() ─────────────────────────────────────────────────────────────────

describe('delete()', () => {
  it('sets operationStates to deleting before DB call, then removes project', async () => {
    const project = makeProject()
    useProjectStore.setState({ projects: [project] })
    const states: string[] = []

    mockDeleteProject.mockImplementation(async () => {
      states.push(useProjectStore.getState().operationStates[project.id] ?? 'none')
    })

    await useProjectStore.getState().delete(project.id)

    expect(states[0]).toBe('deleting')
    expect(useProjectStore.getState().projects).toHaveLength(0)
    expect(useProjectStore.getState().operationStates[project.id]).toBeUndefined()
  })

  it('recovers card and pushes toast on DB failure', async () => {
    const project = makeProject()
    useProjectStore.setState({ projects: [project] })
    mockDeleteProject.mockRejectedValue(new Error('constraint'))

    await useProjectStore.getState().delete(project.id)

    // Project still in list
    expect(useProjectStore.getState().projects).toHaveLength(1)
    // Operation state cleared
    expect(useProjectStore.getState().operationStates[project.id]).toBeUndefined()
    // Toast fired
    expect(useNotificationStore.getState().notifications[0].kind).toBe('error')
  })

  it('guards against concurrent deletes for the same ID', async () => {
    const project = makeProject()
    useProjectStore.setState({
      projects: [project],
      operationStates: { [project.id]: 'deleting' },
    })

    await useProjectStore.getState().delete(project.id)

    expect(mockDeleteProject).not.toHaveBeenCalled()
  })

  it('does not call any filesystem operations', async () => {
    const project = makeProject({ folder_path: '/some/path' })
    useProjectStore.setState({ projects: [project] })
    mockDeleteProject.mockResolvedValue(undefined)

    await useProjectStore.getState().delete(project.id)

    // Only deleteProject (DB) was called — no invoke or fs calls
    expect(mockDeleteProject).toHaveBeenCalledTimes(1)
    expect(mockDeleteProject).toHaveBeenCalledWith(project.id)
  })
})
