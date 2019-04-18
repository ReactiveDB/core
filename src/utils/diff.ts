export type Op = {
  // 0 = reuse
  // 1 = use new item
  type:  0 | 1
  index: number
}

export type Ops = {
  // 0 = error
  // 1 = success
  // 2 = success but should skip
  type: 0 | 1 | 2
  ops: Op[]
  message?: string
}

// as an example, use diff to patch data
export const patch = <T>(ops: Op[], oldList: T[], newList: T[]) => {
  if (!oldList.length) {
    return newList
  }

  return newList.map((data, i) => {
    const op = ops[i]

    if (op.type === 0) {
      return oldList[op.index]
    }

    return data
  })
}

export default function diff<T>(oldList: T[], newList: T[], pk = '_id'): Ops {
  const prev = oldList
  const curr = newList

  if (!Array.isArray(prev) || !Array.isArray(curr)) {
    return {
      type: 0,
      ops: [],
      message: `cannot compare non-list object`,
    }
  }

  const currIds = []
  const prevIds = []
  const index = {}

  for (let i = 0; i < prev.length; i++) {
    const value = prev[i][pk]
    if (value === undefined) {
      return {
        type: 0,
        ops: [],
        message: `cannot find pk: ${pk} at prev.${i}`,
      }
    }
    prevIds.push(value)
    index[value] = i
  }

  for (let j = 0; j < curr.length; j++) {
    const value = curr[j][pk]
    if (value === undefined) {
      return {
        type: 0,
        ops: [],
        message: `cannot find pk: ${pk} at curr.${j}`,
      }
    }
    currIds.push(value)
  }

  const fastEqual = (left: object, right: object) => {
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

        for (let i = length; i-- !== 0; ) {
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

      for (let k = LeftLen; k-- !== 0; ) {
        if (!right.hasOwnProperty(keys[k])) {
          return false
        }
      }

      for (let j = LeftLen; j-- !== 0; ) {
        const key = keys[j]
        if (!fastEqual(left[key], right[key])) {
          return false
        }
      }

      return true
    }

    return left !== left && right !== right
  }

  const ret: Op[] = []
  let reused = 0

  for (let k = 0; k < currIds.length; k++) {
    const key = currIds[k]
    const prevIndex = index[key]

    if (prevIndex !== undefined) {
      const isEqual = fastEqual((curr as any)[k], (prev as any)[prevIndex])
      // if equal then reuse the previous data otherwise use the new data
      const op: Op = isEqual ? { type: 0, index: prevIndex } : { type: 1, index: k }

      if (prevIndex === k && isEqual) {
        reused++
      }
      ret.push(op)
    } else {
      ret.push({ type: 1, index: k })
    }
  }

  const arrayIsSame = reused === curr.length && prev.length === curr.length
  return {
    type: arrayIsSame ? 2 : 1,
    ops: ret,
  }
}
