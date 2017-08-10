import { forEach } from './for-each'

// side effect
export function concat<T>(target: T[], patch: T[]) {
  forEach(patch, p => {
    target.push(p)
  })
  return target
}
