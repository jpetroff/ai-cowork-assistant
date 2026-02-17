// Validator builder similar to Convex's v object for runtime validation
export type Validator<T> = {
  validate: (value: unknown) => value is T
  typeName: string
}

// Primitive validators
export const v = {
  string(): Validator<string> {
    return {
      validate: (value): value is string => typeof value === 'string',
      typeName: 'string',
    }
  },

  number(): Validator<number> {
    return {
      validate: (value): value is number => typeof value === 'number',
      typeName: 'number',
    }
  },

  boolean(): Validator<boolean> {
    return {
      validate: (value): value is boolean => typeof value === 'boolean',
      typeName: 'boolean',
    }
  },

  id<T extends string>(table: T): Validator<string> {
    return {
      validate: (value): value is string =>
        typeof value === 'string' && value.startsWith(`${table}_`),
      typeName: `id(${table})`,
    }
  },

  optional<T>(validator: Validator<T>): Validator<T | undefined> {
    return {
      validate: (value): value is T | undefined =>
        value === undefined || validator.validate(value),
      typeName: `optional(${validator.typeName})`,
    }
  },

  union<T, U>(a: Validator<T>, b: Validator<U>): Validator<T | U> {
    return {
      validate: (value): value is T | U =>
        a.validate(value) || b.validate(value),
      typeName: `union(${a.typeName}, ${b.typeName})`,
    }
  },

  literal<T extends string | number | boolean>(value: T): Validator<T> {
    return {
      validate: (value): value is T => value === value,
      typeName: `literal(${String(value)})`,
    }
  },

  object<T extends Record<string, unknown>>(fields: {
    [K in keyof T]: Validator<T[K]>
  }): Validator<T> {
    return {
      validate: (value): value is T => {
        if (value === null || typeof value !== 'object') return false
        const recordValue = value as Record<string, unknown>
        for (const key of Object.keys(fields)) {
          if (
            !(key in recordValue) ||
            !fields[key as keyof T].validate(recordValue[key])
          ) {
            return false
          }
        }
        return true
      },
      typeName: 'object',
    }
  },

  record<K extends string, V>(
    keyValidator: Validator<K>,
    valueValidator: Validator<V>
  ): Validator<Record<string, V>> {
    return {
      validate: (value): value is Record<string, V> => {
        if (value === null || typeof value !== 'object') return false
        for (const [key, val] of Object.entries(value)) {
          if (!keyValidator.validate(key) || !valueValidator.validate(val)) {
            return false
          }
        }
        return true
      },
      typeName: `record(${keyValidator.typeName}, ${valueValidator.typeName})`,
    }
  },
}

// Schema definition types
export type TableSchema<T> = {
  fields: Record<string, Validator<unknown>>
  validate: (data: unknown) => data is T
}

export type SchemaDefinition = {
  [tableName: string]: TableSchema<unknown>
}

// Helper to create table schemas
export function defineTable<T>(fields: {
  [K in keyof T]: Validator<T[K]>
}): TableSchema<T> {
  return {
    fields: fields as Record<string, Validator<unknown>>,
    validate: (value): value is T => {
      if (value === null || typeof value !== 'object') return false
      const recordValue = value as Record<string, unknown>
      for (const key of Object.keys(fields)) {
        if (
          !(key in recordValue) ||
          !fields[key as keyof T].validate(recordValue[key])
        ) {
          return false
        }
      }
      return true
    },
  }
}

export function defineSchema<T extends SchemaDefinition>(schema: T): T {
  return schema
}

// Document type with system fields
export type Document<T> = T & {
  _id: string
  _creationTime: number
}
