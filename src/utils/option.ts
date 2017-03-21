export function option<T, U>(condition: T, getElse: U) {
  if (!condition) {
    return getElse
  }
  return condition
}
