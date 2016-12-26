export interface ReactiveDBError extends Error { }

export interface ReactiveDBErrorConstructor {
  new(message: string): ReactiveDBError
  readonly prototype: ReactiveDBError
}

function ReactiveDBErrorCtor(this: ReactiveDBError, message: string): ReactiveDBError {
  const err = Error.call(this, message)
  this.name = err.name
  this.message = message
  this.stack = err.stack
  return this
}

ReactiveDBErrorCtor.prototype = Object.create(Error.prototype, {
  constructor: {
    value: ReactiveDBErrorCtor,
    enumerable: false,
    writable: true,
    configurable: true
  }
})

export const ReactiveDBError = ReactiveDBErrorCtor as any as ReactiveDBErrorConstructor

/**
 * Databse Error
 */

export const DEFINE_HOOK_ERR =
  (tableName: string) => new ReactiveDBError(`Table: \`${tableName}\` cannot be found, Please use \`defineSchema\` first.`)

export const NON_EXISTENT_TABLE_ERR =
  (tableName: string) => new ReactiveDBError(`Table: \`${tableName}\` cannot be found.`)

export const UNMODIFIABLE_TABLE_SCHEMA_ERR =
  (tableName: string) => new ReactiveDBError(`Table: \`${tableName}\`'s schema cannot be modified.`)

export const UNMODIFIABLE_TABLE_SCHEMA_AFTER_INIT_ERR =
  () => new ReactiveDBError(`Method: defineSchema cannot be invoked once Database is connected.`)

export const NON_EXISTENT_PRIMARY_KEY_ERR =
  (meta: Object) => new ReactiveDBError(`PrimaryKey is required in schema defination: ${JSON.stringify(meta, null, 2)}`)

export const NON_EXISTENT_COLUMN_ERR =
  (column: string, tableName: string) => new ReactiveDBError(`Column: \`${column}\` was not defined in table: \`${tableName}\` `)

export const INVALID_NAVIGATINO_TYPE_ERR =
  (column: string, expect?: string[]) => {
    let message = `Invalid type of navigation properties: \`${column}\``
    if (expect) {
      message += `, Expect ${expect[0]} but got ${expect[1]}`
    }
    return new ReactiveDBError(message + '.')
  }

export const INVALID_ROW_TYPE_ERR =
  () => new ReactiveDBError('Invalid row type.')

export const INVALID_FIELD_DES_ERR =
  () => new ReactiveDBError('Invalid field description, Only navigation properties were included in description.')

export const ALIAS_CONFLICT_ERR =
  (alias: string, tableName: string) => new ReactiveDBError(`Alias: \`${alias}\` conflict in table: ${tableName}.`)

export const GRAPHIFY_ROWS_FAILED_ERR =
  (err: Error) => new ReactiveDBError(`Graphify query result failed, due to: ${err.message}.`)

export const NOT_IMPLEMENT_ERR =
  () => new ReactiveDBError('Not implement yet.')

export const UNEXPECTED_ASSOCIATION_ERR =
  () => new ReactiveDBError('Unexpected association was specified.')

export const TRANSACTION_EXECUTE_FAILED =
  (e?: Error) => {
    const reason = e ? `, due to: ${e.message}` : ''
    return new ReactiveDBError(`Transaction execute failed${reason}.`)
  }

export const HOOK_EXECUTE_FAILED =
  (type: 'delete' | 'insert', e?: Error) => {
    const reason = e ? `, due to ${e.message}` : ''
    return new ReactiveDBError(`${type} hook execute faild${reason}`)
  }

export const INVALID_PATCH_TYPE_ERR =
  (errType: string) => new ReactiveDBError(`Unexpected type of data, expect Object but got ${errType}`)

/**
 * SelectMeta Error
 */

export const TOKEN_CONSUMED_ERR =
  () => new ReactiveDBError('QueryToken was already consumed.')

export const TOKEN_INVALID_ERR =
  () => new ReactiveDBError(`Token cannot be combined.`)

/**
 * Warning
 */

export const NON_DEFINED_PROPERTY_WARN =
 (prop: string) => console.warn(`WARNING: Property \`${prop}\` is not defined.`)

export const NON_EXISTENT_FIELD_WARN =
  (field: string, virtualProp: string) => console.warn(`Field: \`${field}\` is not exist in table ${virtualProp}.`)

export const BUILD_PREDICATE_FAILED_WARN =
  (e: Error, tableName?: string, key?: string) => {
    let message = `Build predicate faild due to: ${e.message}`
    if (tableName) {
      message += `, error was in ${tableName}`
    }
    if (key) {
      message += `, ${key}`
    }
    message += '.'
    console.warn(message)
  }

export const UNMODIFIABLE_PRIMARYKEY_WARN =
  () => console.warn(`PrimaryKey is unmodifiable.`)
