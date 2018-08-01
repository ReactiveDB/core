export function identity(): void
export function identity<T>(r: T): T
export function identity<T>(r?: T) {
  return r
}
