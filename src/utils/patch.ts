import { Op, OpsType, Ops } from './diff'

export const patch = <K, T extends Array<K>, R extends Array<K>>(ops: Op[], oldList: T, newList: T) => {
  return newList.map((data, i) => {
    const op = ops[i]

    if (op.type === 0) {
      return oldList[op.index]
    }
    return data
  }) as R
}

export const getPatchResult = <T>(opsResult: Ops, oldList: T[], newList: T[]): T[] => {
  const { type, ops } = opsResult
  switch (type) {
    case OpsType.Error:
      return newList
    case OpsType.SuccessAndSkip:
      return oldList
    case OpsType.Success:
    default:
      return patch(ops, oldList, newList)
  }
}
