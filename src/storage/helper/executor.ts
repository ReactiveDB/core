import { mergeTransactionResult } from './merge-transaction-result'
import { ExecutorResult } from '../../interface'
import { warn } from '../../utils'

export function executor(db: lf.Database, queries: lf.query.Builder[]): Promise<ExecutorResult> {
  const tx = db.createTransaction()

  return tx.exec(queries)
    .then(ret => ({
      result: true,
      ...mergeTransactionResult(queries, ret)
    }))
    .catch((e: Error) => {
      warn(`Execute failed, transaction is already marked for rollback.`)
      throw e
    })
}
