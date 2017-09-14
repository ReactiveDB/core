import { Field } from '../../interface'

export function checkAssociateFields(fields?: Field[]) {
  if (fields) {
    for (let i = 0; i < fields.length; i++) {
      const field = fields[i]
      const isObject = typeof field === 'object'
      if (isObject && i !== fields.length - 1) {
        return false
      }
    }
  }

  return true
}
