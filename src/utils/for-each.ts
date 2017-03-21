import { noop } from './noop'

export function forEach<T> (target: Array<T>, eachFunc: (val: T, key: number) => void, inverse?: boolean): void

export function forEach<T> (
  target: {
    [index: string]: T
  },
  eachFunc: (val: T, key: string) => void, inverse?: boolean
): void

export function forEach (target: any, eachFunc: (val: any, key: any) => void, inverse?: boolean): void

export function forEach (target: any, eachFunc: (val: any, key: any) => any, inverse?: boolean): void {
  let length: number
  let handler = eachFunc
  if (target instanceof Set || target instanceof Map) {
    // since we cannot use [[Set/Map]].entries() directly
    (target as any).forEach((value: any, key: any) => {
      if (handler(value, key) === false) {
        handler = noop
      }
    })
  } else if (target instanceof Array) {
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
}
