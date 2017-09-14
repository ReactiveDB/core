// think it as Either[T, Error]
export function tryCatch<T>(fn: (...args: any[]) => T) {
  return (...args: any[]): [T | null, null | Error]  => {
    try {
      return [fn.apply(null, args), null]
    } catch (e) {
      return [null, e]
    }
  }
}
