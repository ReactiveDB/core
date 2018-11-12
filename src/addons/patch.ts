import { Op } from './diff'

export const patch = <K, T extends Array<K>, R extends Array<K>>(ops: Op[], oldList: T, newList: T) => {
  return newList.map((data, i) => {
    const op = ops[i]

    if (op.type === 0) {
      return oldList[op.index]
    }
    return data
  }) as R
}
