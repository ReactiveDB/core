import { GRAPHIFY_ROWS_FAILED_ERR } from './RuntimeError'
import { forEach, identity } from '../utils'

const nestJS = require('nesthydrationjs')()

nestJS.registerType('LiteralArray', identity)

// filter the [[key]] with undefined
function reduceUndef(obj: any) {
  if (typeof obj !== 'object') {
    return obj
  }

  const ret = Array.isArray(obj) ? [] : Object.create(null)

  forEach(obj, (val, key) => {
    if (typeof val === 'object') {
      if (val instanceof Date) {
        ret[key] = val
      } else if (Array.isArray(val)) {
        const partial = val
          .map((v) => reduceUndef(v))
          .filter((v) => {
            return !!v && (typeof v !== 'object' || Object.keys(v).length > 0)
          })

        if (partial.length > 0 || (val.length === partial.length && val.length === 0)) {
          // if both partial and val are empty array that means field was queried but no records matched
          ret[key] = partial
        }
      } else {
        ret[key] = val !== null ? reduceUndef(val) : null
      }
    } else {
      if (val !== undefined) {
        ret[key] = val
      }
    }
  })

  return ret
}

// primaryKey based, key: { id: true } must be given in definition.
export default function<T>(rows: any[], definition: Object) {
  try {
    const result = nestJS.nest(rows, [definition])
    return reduceUndef(result) as T[]
  } catch (e) {
    throw GRAPHIFY_ROWS_FAILED_ERR(e)
  }
}
