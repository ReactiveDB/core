export enum OpType {
  // 0 = reuse
  // 1 = use new item
  Reuse,
  New,
}

export type Op<T = any> = {
  type: OpType.Reuse
  index: number
  value?: undefined
} | {
  type: OpType.New
  value: T
  index?: undefined
}

export enum OpsType {
  // 0 = error
  // 1 = success
  // 2 = success but should skip
  Error,
  Success,
  ShouldSkip,
}

export type Ops<T = any> = {
  type: OpsType.Error
  result: ReadonlyArray<T>
  ops?: undefined
  message?: string
} | {
  type: OpsType.Success
  ops: Op<T>[]
  result?: undefined
  message?: string
} | {
  type: OpsType.ShouldSkip
  ops?: undefined
  result?: undefined
  message?: string
}

// as an example, use diff to patch data
export const patch = <T>(ops: ReadonlyArray<Op>, oldList: ReadonlyArray<T>) => {
  return ops.map(op => {
    if (op.type === OpType.Reuse) {
      return oldList[op.index]
    } else {
      return op.value
    }
  })
}

export const getPatchResult = <T>(oldList: ReadonlyArray<T>, ops: Ops): ReadonlyArray<T> => {
  switch (ops.type) {
    case OpsType.Error:
      return ops.result
    case OpsType.ShouldSkip:
      return oldList
    case OpsType.Success:
    default:
      return patch(ops.ops, oldList)
  }
}

function fastEqual(left: object, right: object) {
  if (left === right) {
    return true
  }

  if (left && right && typeof left == 'object' && typeof right == 'object') {
    const isLeftArray = Array.isArray(left)
    const isRightArray = Array.isArray(right)

    if (isLeftArray && isRightArray) {
      const length = (left as any[]).length

      if (length != (right as any[]).length) {
        return false
      }

      for (let i = length; i-- !== 0;) {
        if (!fastEqual(left[i], right[i])) {
          return false
        }
      }

      return true
    }

    if (isLeftArray !== isRightArray) {
      return false
    }

    const isLeftDate = left instanceof Date
    const isRightDate = right instanceof Date

    if (isLeftDate != isRightDate) {
      return false
    }

    if (isLeftDate && isRightDate) {
      return (left as Date).getTime() == (right as Date).getTime()
    }

    const keys = Object.keys(left)
    const LeftLen = keys.length

    if (LeftLen !== Object.keys(right).length) {
      return false
    }

    for (let k = LeftLen; k-- !== 0;) {
      if (!right.hasOwnProperty(keys[k])) {
        return false
      }
    }

    for (let j = LeftLen; j-- !== 0;) {
      const key = keys[j]
      if (!fastEqual(left[key], right[key])) {
        return false
      }
    }

    return true
  }

  return left !== left && right !== right
}

export function diff<T>(oldList: ReadonlyArray<T>, newList: ReadonlyArray<T>, pk = '_id'): Ops<T> {
  const prev = oldList
  const curr = newList

  if (!Array.isArray(prev) || !Array.isArray(curr)) {
    return {
      type: OpsType.Error,
      result: newList,
      message: `cannot compare non-list object`,
    }
  }

  const index = {}
  for (let i = 0; i < prev.length; i++) {
    const value = prev[i][pk]
    if (value === undefined) {
      return {
        type: OpsType.Error,
        result: newList,
        message: `cannot find pk: ${pk} at prev.${i}`,
      }
    }
    index[value] = i
  }

  const ret: Op<T>[] = []
  let reused = 0

  for (let k = 0; k < curr.length; k++) {
    const key = curr[k][pk]
    if (key === undefined) {
      return {
        type: OpsType.Error,
        result: newList,
        message: `cannot find pk: ${pk} at curr.${k}`,
      }
    }

    const prevIndex = index[key]

    if (prevIndex !== undefined) {
      const isEqual = fastEqual(curr[k], prev[prevIndex])
      // if equal then reuse the previous data otherwise use the new data
      const op: Op<T> = isEqual ? { type: OpType.Reuse, index: prevIndex } : { type: OpType.New, value: curr[k] }

      if (prevIndex === k && isEqual) {
        reused++
      }
      ret.push(op)
    } else {
      ret.push({ type: OpType.New, value: curr[k] })
    }
  }

  const arrayIsSame = reused === curr.length && prev.length === curr.length
  return arrayIsSame
    ? { type: OpsType.ShouldSkip }
    : { type: OpsType.Success, ops: ret }
}

export const concatDiff = <T>(newList: ReadonlyArray<T>, concatLength: number) => {
  return {
    type: OpsType.Success,
    ops: newList.map((value, index) => {
      return index >= concatLength
        ? { type: OpType.New, value }
        : { type: OpType.Reuse, index }
    })
  } as Ops<T>
}
