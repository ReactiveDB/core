'use strict'
export function forEach<T> (target: Array<T>, eachFunc: (val: T, key: number) => void, inverse?: boolean): void

export function forEach<T> (
  target: {
    [index: string]: T
  },
  eachFunc: (val: T, key: string) => void, inverse?: boolean
): void

export function forEach (target: any, eachFunc: (val: any, key: any) => void, inverse?: boolean): void

export function forEach (target: any, eachFunc: (val: any, key: any) => any, inverse?: boolean) {
  let length: number
  if (target instanceof Array) {
    length = target.length
    if (!inverse) {
      let i = -1
      while (++i < length) {
        if (eachFunc(target[i], i) === false) {
          break
        }
      }
    } else {
      let i = length
      while (i --) {
        if (eachFunc(target[i], i) === false) {
          break
        }
      }
    }

  } else if (typeof target === 'object') {
    const keys = Object.keys(target)
    let key: string
    length = keys.length
    let i = -1
    while (++i < length) {
      key = keys[i]
      if (eachFunc(target[key], key) === false) {
        break
      }
    }
  }
  return target
}

export const clone = <T>(origin: T): T | null => {
  /* istanbul ignore if */
  if (origin === null) {
    return null
  }
  /* istanbul ignore if */
  if (!origin || typeof origin !== 'object') {
    return null
  }
  let target: any
  if (origin instanceof Array) {
    target = new Array()
  } else {
    target = { }
  }
  forEach(origin, (val: any, key: string) => {
    if (typeof val === 'object') {
      // null
      if (val) {
        if (val instanceof Date) {
          target[key] = new Date(val.toISOString())
        } else {
          target[key] = clone(val)
        }
      } else {
        target[key] = val
      }
    } else {
      target[key] = val
    }
  })
  return target
}

const s4 = () => Math.floor(
  (1 + Math.random()) * 0x10000
)
  .toString(16)
  .substring(1)

const uuidStack = new Set<string>()

export const uuid = () => {
  let UUID = s4() + s4()
  /* istanbul ignore next */
  while (uuidStack.has(UUID)) {
    UUID = s4() + s4()
  }
  uuidStack.add(UUID)
  return UUID
}

export function flat (r: any) { return r }
