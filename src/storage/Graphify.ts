import { GRAPHIFY_ROWS_FAILED_ERR } from './RuntimeError'
import { identity } from '../utils'
import { RDBType } from './DataType'

const nestJS = require('nesthydrationjs')()

const LiteralArray = 'LiteralArray'

nestJS.registerType(LiteralArray, identity)

// primaryKey based, key: { id: true } must be given in definition.
export default function<T>(rows: any[], definition: Object) {
  try {
    const result = nestJS.nest(rows, [definition])
    return result as T[]
  } catch (e) {
    throw GRAPHIFY_ROWS_FAILED_ERR(e)
  }
}

/**
 * Specify a part of the definition object that is
 * to be fed to nestJS.nest function.
 */
export function definition(
  fieldName: string,
  asId: boolean,
  type: any
) {
  const matcher = {
    column: fieldName,
    id: asId
  }

  if (type === RDBType.LITERAL_ARRAY) {
     return { ...matcher, type: LiteralArray }
  }

  return matcher
}
