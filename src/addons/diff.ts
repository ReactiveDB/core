// this module should be compabitable with ES5
// pure implementation without any runtime polyfill

export type Location = {
  loc: number
  index: number
}
export type Op = {
  type: 0 | 1
  index: number
}
export type Dataset<T> = [string, T, T, number]
export type Ops = {
  // 0 = error
  // 1 = success
  // 2 = success but should skip
  type: 0 | 1 | 2
  ops: Op[]
  message?: string
  sequence: number
}

export default function diff(e: { data: { payload: Dataset<object[]>; chan: MessagePort } }) {
  const payload = e.data.payload
  const channel = e.data.chan
  const [pk, prev, curr, sequence] = payload

  if (!Array.isArray(prev) || !Array.isArray(curr)) {
    channel.postMessage({
      type: 0,
      ops: [],
      message: `cannot compare non-list object`,
      sequence,
      skip: false,
    })
    return
  }

  const currIds = []
  const prevIds = []
  const index = {}

  for (let i = 0; i < prev.length; i++) {
    const value = prev[i][pk]
    if (value === undefined) {
      channel.postMessage({
        type: 0,
        ops: [],
        message: `cannot find pk: ${pk} at prev.${i}`,
        sequence,
        skip: false,
      })
      return
    }
    prevIds.push(value)
    index[value] = i
  }

  for (let j = 0; j < curr.length; j++) {
    const value = curr[j][pk]
    if (value === undefined) {
      channel.postMessage({
        type: 0,
        ops: [],
        message: `cannot find pk: ${pk} at curr.${j}`,
        sequence,
        skip: false,
      })
      return
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
      const isEqual = fastEqual(curr[k], prev[prevIndex])
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

  channel.postMessage({
    type: reused === curr.length ? 2 : 1,
    ops: ret,
    sequence,
  })
}
