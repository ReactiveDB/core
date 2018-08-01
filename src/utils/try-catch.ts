// think it as Either[T, Error]
export function tryCatch<T>(this: any, fn: (...args: any[]) => T) {
  return (...args: any[]): [T | null, null | Error] => {
    try {
      return [fn.apply(this, args), null]
    } catch (e) {
      return [null, e]
    }
  }
}
