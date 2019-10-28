import { forEach } from './for-each'

export const clone = <T = any>(origin: T, target: T | null = null): T | null => {
  if (origin == null) {
    return origin
  }

  const constructor = ((origin as unknown) as Function).constructor

  if (constructor === Date) {
    return new Date((origin as any).valueOf()) as any
  }

  if (constructor === RegExp) {
    const pattern = ((origin as unknown) as RegExp).valueOf() as RegExp
    let flags = ''
    flags += pattern.global ? 'g' : ''
    flags += pattern.ignoreCase ? 'i' : ''
    flags += pattern.multiline ? 'm' : ''

    return new RegExp(pattern.source, flags) as any
  }

  if (constructor === Function || constructor === String || constructor === Number || constructor === Boolean) {
    return origin
  }

  target = target || new (origin as any).constructor()

  forEach(origin, (val, key) => {
    target![key] = clone(val, null)
  })

  return target
}
