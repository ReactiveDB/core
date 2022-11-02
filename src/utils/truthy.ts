export function isNonNullable<T = any>(x: T): x is NonNullable<T> {
  return x != null
}
