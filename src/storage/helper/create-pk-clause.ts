export function createPkClause(key: string, val: any) {
  return {
    where: {
      [key]: val,
    },
  }
}
