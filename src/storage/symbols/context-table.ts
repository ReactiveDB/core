export const context = '#'

export function contextTableName(tableName: string, suffix: number) {
  return `${tableName}${context}${suffix}`
}
