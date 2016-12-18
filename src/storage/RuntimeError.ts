const ReactiveDBError = (message: string) => new TypeError(message)

/**
 * Databse Error
 */

export const DEFINE_HOOK_ERR =
  (tableName: string) => ReactiveDBError(`Table: \`${tableName}\` cannot be found, Please use \`defineSchema\` first.`)

export const NON_EXISTENT_TABLE_ERR =
  (tableName: string) => ReactiveDBError(`Table: \`${tableName}\` cannot be found.`)

export const UNMODIFIABLE_TABLE_SCHEMA_ERR =
  (tableName: string) => ReactiveDBError(`Table: \`${tableName}\`'s schema cannot be modified.`)

export const UNMODIFIABLE_TABLE_SCHEMA_AFTER_INIT_ERR =
  () => ReactiveDBError(`Method: defineSchema cannot be invoked once Database is initialized.`)

export const NON_EXISTENT_PRIMARY_KEY_ERR =
  (meta: Object) => ReactiveDBError(`PrimaryKey is required in schema defination: ${JSON.stringify(meta, null, 2)}`)

export const UNMODIFIABLE_PRIMARYKEY_ERR =
  () => ReactiveDBError(`PrimaryKey is unmodifiable.`)

export const NON_EXISTENT_COLUMN_ERR =
  (column: string, tableName: string) => ReactiveDBError(`Updated column: \`${column}\` was not defined in table: \`${tableName}\` `)

export const INVALID_RESULT_TYPE_ERR =
  (column: string) => ReactiveDBError(`Invalid resultType \`${column}\`.`)

export const INVALID_ROW_TYPE_ERR =
  () => ReactiveDBError('Invalid row type.')

export const INVALID_VIRTUAL_VALUE_ERR =
  (prop: string) => ReactiveDBError(`Invalid value of virtual prop: \`${prop}\`, Expect Object/Array.`)

export const INVALID_FIELD_DES_ERR =
  () => ReactiveDBError('Invalid field description, It should include its association field.')

export const ALIAS_CONFLICT_ERR =
  (alias: string, tableName: string) => ReactiveDBError(`Alias: \`${alias}\` conflict in table: ${tableName}.`)

export const GRAPHIFY_ROWS_FAILED_ERR =
  (err: Error) => ReactiveDBError(`Graphify query result failed, due to: ${err.message}.`)

export const NOT_IMPLEMENT_ERR =
  () => ReactiveDBError('Not implement yet.')

export const UNEXPECTED_ASSOCIATION_ERR =
  () => ReactiveDBError('Unexpected association was specified.')

export const TRANSACTION_EXECUTE_FAILED =
  (e?: Error) => {
    let reason = e ? `, due to: ${e.message}` : ''
    return ReactiveDBError(`Transaction execute failed${reason}.`)
  }

/**
 * SelectMeta Error
 */

export const TOKEN_CONSUMED_ERR =
  () => ReactiveDBError('QueryToken was already consumed.')

export const TOKEN_INVALID_ERR =
  () => ReactiveDBError(`Token cannot be combined.`)

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
    if (tableName && key) {
      message += `, error was in ${tableName}, ${key}`
    }

    message += '.'
    console.warn(message)
  }
