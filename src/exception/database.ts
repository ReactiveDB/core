import { ReactiveDBException } from './Exception'

export const NonExistentTable =
  (tableName: string) => new ReactiveDBException(`Table: \`${tableName}\` cannot be found.`)

export const UnmodifiableTable =
  () => new ReactiveDBException(`Method: defineSchema cannot be invoked since schema is existed or database is connected`)

export const InvalidQuery =
  () => new ReactiveDBException('Only navigation properties were included in query.')

export const AliasConflict =
  (column: string, tableName: string) => new ReactiveDBException(`Definition conflict, Column: \`${column}\` on table: ${tableName}.`)

export const GraphFailed =
  (err: Error) => new ReactiveDBException(`Graphify query result failed, due to: ${err.message}.`)

export const NotImplemented =
  () => new ReactiveDBException('Not implemented yet.')

export const UnexpectedRelationship =
  () => new ReactiveDBException('Unexpected relationship was specified.')

export const InvalidType =
  (expect?: [string, string]) => {
    let message = 'Unexpected data type'
    if (expect) {
      message += `, expect ${expect[0]} but got ${expect[1]}`
    }
    return new ReactiveDBException(message + '.')
  }

export const PrimaryKeyNotProvided =
  () => new ReactiveDBException(`Primary key was not provided.`)

export const PrimaryKeyConflict =
  () => new ReactiveDBException(`Primary key was already provided.`)

export const DatabaseIsNotEmpty =
  () => new ReactiveDBException('Method: load cannnot be invoked since database is not empty.')

export const NotConnected =
  () => new ReactiveDBException('Method: dispose cannnot be invoked before database is connected.')

export const FieldMustBeArray =
  (field: any) => new ReactiveDBException(`Field must be Array, but got: ${ JSON.stringify(field) }`)

export const AssociatedFieldsPostionError =
  () => new ReactiveDBException(`Associated fields description must be the last item in Fields`)
