import { db } from '../sqlite'
import type { Project } from '../types'

export async function createProject(data: {
  name: string
  folder_path: string
}): Promise<string> {
  const id = crypto.randomUUID()
  const now = Date.now()
  await db.execute(
    'INSERT INTO projects (id, name, folder_path, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)',
    [id, data.name, data.folder_path, now, now]
  )
  return id
}

export async function getProject(id: string): Promise<Project | null> {
  return db.get<Project>('projects', id)
}

export async function listProjects(): Promise<Project[]> {
  return db.select<Project>('SELECT * FROM projects ORDER BY updated_at DESC')
}

export async function updateProject(
  id: string,
  data: Partial<Pick<Project, 'name' | 'folder_path'>>
): Promise<void> {
  const fields = Object.keys(data)
  if (fields.length === 0) return
  const now = Date.now()
  const set = [...fields.map((k, i) => `${k} = $${i + 1}`), `updated_at = $${fields.length + 1}`].join(', ')
  await db.execute(
    `UPDATE projects SET ${set} WHERE id = $${fields.length + 2}`,
    [...Object.values(data), now, id]
  )
}

export async function deleteProject(id: string): Promise<void> {
  return db.remove('projects', id)
}
