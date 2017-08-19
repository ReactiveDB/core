export const fieldLink = '@'

export function fieldIdentifier(tableName: string, val: string) {
  return `${tableName}${fieldLink}${val}`
}
