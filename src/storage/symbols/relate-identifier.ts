export const relatedLink = '.'

export function relateIdentifier(tableName: string, relatedName: string) {
  return `${tableName}${relatedLink}${relatedName}`
}
