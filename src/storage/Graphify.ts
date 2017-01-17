import { GRAPHIFY_ROWS_FAILED_ERR } from './RuntimeError'
import { identity } from '../utils'

const nestJS = require('nesthydrationjs')()

nestJS.registerType('LiteralArray', identity)

// primaryKey based, key: { id: true } must be given in definition.
export default function<T>(rows: any[], definition: Object) {
  try {
    const result = nestJS.nest(rows, [definition])
    return result as T[]
  } catch (e) {
    throw GRAPHIFY_ROWS_FAILED_ERR(e)
  }
}
