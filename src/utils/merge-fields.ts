import { forEach } from './for-each'
import { FieldMustBeArray, AssociatedFieldsPostionError } from '../exception'

export const mergeFields = (targetFields: any[], patchFields: any[]): void => {
  if (!Array.isArray(targetFields)) {
    throw FieldMustBeArray(targetFields)
  }
  if (!Array.isArray(patchFields)) {
    throw FieldMustBeArray(patchFields)
  }

  let targetLength = targetFields.length
  const fieldLength = patchFields.length
  forEach(patchFields, (field: any, index: number) => {
    if (typeof field === 'object') {
      if (index !== fieldLength - 1) {
        throw AssociatedFieldsPostionError()
      }
      const lastTargetField = targetFields[targetLength - 1]
      if (typeof lastTargetField === 'object') {
        forEach(field, (val: any, key: string) => {
          const targetField = lastTargetField[key]
          if (targetField) {
            mergeFields(targetField, val)
          } else {
            lastTargetField[key] = val
          }
        })
      } else {
        targetFields.push(field)
        targetLength = targetFields.length
      }
    } else {
      const lastField = targetFields[targetLength - 1]
      if (targetFields.indexOf(field) === -1) {
        if (typeof lastField === 'object') {
          targetFields.splice(targetLength - 1, 0, field)
        } else {
          targetFields.push(field)
        }
        targetLength = targetFields.length
      }
    }
  })
}
