export function isNonNullable<T = any>(x: T): x is NonNullable<T> {
  return x != null
}

export type Truthy<T> = Exclude<T, undefined | null | false | 0 | ''>
