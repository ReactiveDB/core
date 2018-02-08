import { identity } from '../../utils'
import { Exception, dbErrMsg } from '../../exception'

const nestJS = require('nesthydrationjs')()

export const LiteralArray = 'LiteralArray'
nestJS.registerType(LiteralArray, identity)

// primaryKey based, key: { id: true } must be given in definition.
export function graph<T>(rows: any[], definition: Object) {
  try {
    const result = nestJS.nest(rows, [definition])
    return result as T[]
  } catch (e) {
    throw new Exception(dbErrMsg.GraphFailed(e))
  }
}
