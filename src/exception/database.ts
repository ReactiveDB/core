export const NonExistentTable =
  (tableName: string) => `Table: \`${tableName}\` cannot be found.`

export const UnmodifiableTable =
  () => `Method: defineSchema cannot be invoked since schema is existed or database is connected`

export const InvalidQuery =
  () => 'Only navigation properties were included in query.'

export const AliasConflict =
  (column: string, tableName: string) => `Definition conflict, Column: \`${column}\` on table: ${tableName}.`

export const GraphFailed =
  (err: Error) => `Graphify query result failed, due to: ${err.message}.`

export const NotImplemented =
  () => 'Not implemented yet.'

export const UnexpectedRelationship =
  () => 'Unexpected relationship was specified.'

export const InvalidType =
  (expect?: [string, string]) => {
    let message = 'Unexpected data type'
    if (expect) {
      message += `, expect ${expect[0]} but got ${expect[1]}`
    }
    return message + '.'
  }

export const UnexpectedTransactionUse =
  () => 'Please use Database#transaction to get a transaction scope first.'

export const PrimaryKeyNotProvided =
  () => `Primary key was not provided.`

export const PrimaryKeyConflict =
  () => `Primary key was already provided.`

export const DatabaseIsNotEmpty =
  () => 'Method: load cannnot be invoked since database is not empty.'

export const NotConnected =
  () => 'Method: dispose cannnot be invoked before database is connected.'
