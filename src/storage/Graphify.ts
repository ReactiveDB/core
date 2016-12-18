import { GRAPHIFY_ROWS_FAILED_ERR } from './RuntimeError'
const nest = require('nesthydrationjs')().nest

// primaryKey based, key: { id: true } should be given in definition at least.
export default function<T>(rows: any[], definition: Object) {
  try {
    return nest(rows, [definition]) as T[]
  } catch (e) {
    throw GRAPHIFY_ROWS_FAILED_ERR(e)
  }
}
