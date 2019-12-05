import { forEach } from './for-each'

export const clone = <T = unknown>(origin: T, target: T | null = null): T | null => {
  if (origin == null) {
    return origin
  }

  if (((origin as unknown) as Date).constructor === Date) {
    return new Date((origin as any).valueOf()) as any
  }

  if (origin instanceof RegExp) {
    const pattern = origin.valueOf() as RegExp
    let flags = ''
    flags += pattern.global ? 'g' : ''
    flags += pattern.ignoreCase ? 'i' : ''
    flags += pattern.multiline ? 'm' : ''

    return new RegExp(pattern.source, flags) as any
  }

  if (
    ((origin as unknown) as Function).constructor === Function ||
    ((origin as unknown) as Function).constructor === String ||
    ((origin as unknown) as Function).constructor === Number ||
    ((origin as unknown) as Function).constructor === Boolean
  ) {
    return origin
  }

  target = target || new (origin as any).constructor()

  forEach(origin, (val, key) => {
    target![key] = clone(val, null)
  })

  return target
}
