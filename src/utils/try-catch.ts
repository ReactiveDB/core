type Value<T> = { kind: 'value'; unwrapped: T }
type Exception = { kind: 'exception'; unwrapped: Error }
type Maybe<T> = Value<T> | Exception

export function isException<T>(maybeT: Maybe<T>): maybeT is Exception {
  return maybeT.kind === 'exception'
}

export const attachMoreErrorInfo = <T extends Error | string>(error: T, info: {}): T => {
  const appendMessage = `\nMoreInfo: ${JSON.stringify(info)}`
  if (error instanceof Error) {
    error.message += appendMessage
    return error
  } else {
    return (error + appendMessage) as T
  }
}

type Options<F extends boolean> = {
  doThrow?: F
  [errorInfoKey: string]: any
}

type Return<F extends boolean, T> = F extends true ? Value<T> : Maybe<T>

/**
 * 包裹一个可能抛异常的、生成值类型为`T`的函数，令其抛异常这种可能，
 * 显式地表达在使用它的代码里：
 *
 * 1. 使用的代码里提供`doThrow: true`选项，表示包裹得到的函数可以
 * 直接抛异常；而在没发生异常的情况下，会返回`Value<T>`类型。
 *
 * 2. 如果`doThrow`选项为假值或空值（没有设置），表示包裹得到的函数
 * 在发生异常的情况下，不会将其直接抛出，而是返回`Exception`类型；而
 * 在没发生异常的情况下，会返回`Value<T>`类型。
 *
 * 另外，可以在使用的代码（`options`）里提供任意键值对，它们会在出现
 * 异常时被 JSON.stringify，并添加到对应的 Error 对象的 message 里。
 */
export function tryCatch<T, U extends any[]>(this: any, fn: (...args: U) => T) {
  return <F extends boolean>(options?: Options<F>) => (...args: U): Return<F, T> => {
    try {
      return {
        kind: 'value',
        unwrapped: fn.apply(this, args),
      } as Return<F, T>
    } catch (error) {
      if (options) {
        const { doThrow, ...info } = options
        error = attachMoreErrorInfo(error, info)
        if (doThrow) {
          throw error
        }
      }
      return {
        kind: 'exception',
        unwrapped: error,
      } as Return<F, T>
    }
  }
}
