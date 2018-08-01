import * as lf from 'lovefield'

export function mergeTransactionResult(queries: lf.query.Builder[], transactionResult: any[]) {
  const ret = { insert: 0, update: 0, delete: 0 }

  queries.forEach((query, index) => {
    if (query instanceof lf.query.InsertBuilder) {
      ret.insert += Array.isArray(transactionResult[index]) ? transactionResult[index].length : 1
    } else if (query instanceof lf.query.UpdateBuilder) {
      ret.update++
    } else if (query instanceof lf.query.DeleteBuilder) {
      ret.delete++
    }
  })

  return ret
}
