import { forEach } from './for-each'

export const clone = <T>(origin: T, target: T | null = null): T | null => {
  if (origin == null) {
    return origin
  }

  if (origin.constructor === Date) {
    return new Date((origin as any).valueOf()) as any
  }

  if (origin.constructor === RegExp) {
    const pattern = origin.valueOf() as RegExp
    let flags = ''
    flags += pattern.global ? 'g' : ''
    flags += pattern.ignoreCase ? 'i' : ''
    flags += pattern.multiline ? 'm' : ''

    return new RegExp(pattern.source, flags) as any
  }

  if (
    origin.constructor === Function ||
    origin.constructor === String ||
    origin.constructor === Number ||
    origin.constructor === Boolean
  ) {
    return origin
  }

  target = target || new (origin as any).constructor()

  forEach(origin, (val, key) => {
    target![key] = clone(val, null)
  })

  return target
}
