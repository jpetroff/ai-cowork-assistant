import type { Project } from '../generated/prisma/client'
import { createSqliteDb } from './db'
import type { TableName } from './db'

export type { Project }

const TABLE: TableName = 'projects'
const db = createSqliteDb()

export type ProjectInput = Omit<Project, 'id' | 'created_at' | 'updated_at'>

export async function get(id: string): Promise<Project | null> {
  return db.get<Project>(TABLE, id)
}

export async function insert(data: ProjectInput): Promise<string> {
  return db.insert<Project>(TABLE, data)
}

export async function upsert(
  data: Partial<Project> & { id: string }
): Promise<void> {
  return db.upsert<Project>(TABLE, data)
}

export async function list(): Promise<Project[]> {
  return db.select<Project>('SELECT * FROM projects ORDER BY updated_at DESC')
}

export async function remove(id: string): Promise<void> {
  return db.remove(TABLE, id)
}

export async function rename(id: string, name: string): Promise<void> {
  await upsert({ id, name })
}
