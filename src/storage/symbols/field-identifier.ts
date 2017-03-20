export const link = '@'

export function fieldIdentifier(tableName: string, val: string) {
  return `${tableName}${link}${val}`
}
