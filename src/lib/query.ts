import Database from '@tauri-apps/plugin-sql'
import { getLocalAppDb } from './db'

export type Operator = '=' | '!=' | '<' | '<=' | '>' | '>=' | 'LIKE' | 'IN'
export type OrderDirection = 'asc' | 'desc'

export type FilterCondition = {
  field: string
  operator: Operator
  value: unknown
}

export type OrderCondition = {
  field: string
  direction: OrderDirection
}

export class QueryBuilder<T = unknown> {
  private table: string
  private filters: FilterCondition[] = []
  private orders: OrderCondition[] = []
  private limitValue: number | null = null
  private offsetValue: number | null = null

  constructor(table: string) {
    this.table = table
  }

  filter(field: string, operator: Operator, value: unknown): this {
    this.filters.push({ field, operator, value })
    return this
  }

  orderBy(field: string, direction: OrderDirection = 'asc'): this {
    this.orders.push({ field, direction })
    return this
  }

  limit(n: number): this {
    this.limitValue = n
    return this
  }

  offset(n: number): this {
    this.offsetValue = n
    return this
  }

  async all(db?: Database): Promise<T[]> {
    const query = this.buildQuery()
    const bindings = this.buildBindings()
    const database =
      db || await getLocalAppDb()
    return database.select<T[]>(query, bindings)
  }

  async first(db?: Database): Promise<T | null> {
    const result = await this.limit(1).all(db)
    return result.length > 0 ? result[0] : null
  }

  async count(db?: Database): Promise<number> {
    const query = `SELECT COUNT(*) as count FROM ${this.table}${this.buildWhereClause()}`
    const bindings = this.buildBindings()
    const database =
      db || await getLocalAppDb()
    const rows = await database.select<{ count: number }[]>(query, bindings)
    return rows[0]?.count ?? 0
  }

  private buildQuery(): string {
    let query = `SELECT * FROM ${this.table}`
    const whereClause = this.buildWhereClause()
    if (whereClause) {
      query += ` ${whereClause}`
    }
    if (this.orders.length > 0) {
      const orderClause = this.buildOrderClause()
      query += ` ORDER BY ${orderClause}`
    }
    if (this.limitValue !== null) {
      query += ` LIMIT ${this.limitValue}`
    }
    if (this.offsetValue !== null) {
      query += ` OFFSET ${this.offsetValue}`
    }
    return query
  }

  private buildWhereClause(): string | null {
    if (this.filters.length === 0) return null
    const conditions = this.filters.map((f) => {
      if (f.operator === 'IN') {
        const placeholders = Array.isArray(f.value)
          ? f.value.map(() => '?').join(', ')
          : '?'
        return `${f.field} IN (${placeholders})`
      }
      return `${f.field} ${f.operator} ?`
    })
    return `WHERE ${conditions.join(' AND ')}`
  }

  private buildOrderClause(): string {
    return this.orders
      .map((o) => `${o.field} ${o.direction.toUpperCase()}`)
      .join(', ')
  }

  private buildBindings(): unknown[] {
    const bindings: unknown[] = []
    for (const filter of this.filters) {
      if (filter.operator === 'IN' && Array.isArray(filter.value)) {
        bindings.push(...filter.value)
      } else {
        bindings.push(filter.value)
      }
    }
    return bindings
  }
}
