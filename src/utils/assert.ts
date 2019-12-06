type FailureHandler<U extends any[]> = (...args: U) => Error

export function assert(condition: boolean, failureMsg: string): void
export function assert<U extends any[]>(condition: boolean, failure: FailureHandler<U>, ...failureArgs: U): void
export function assert<U extends any[]>(
  condition: boolean,
  failure: FailureHandler<U> | string,
  ...failureArgs: U
): void {
  truthyOrThrow(condition, failure, ...failureArgs)
}

type Maybe<T> = T | null | undefined

export function assertValue<T>(value: Maybe<T>, falsyValueMsg: string): asserts value is T
export function assertValue<T, U extends any[]>(
  value: Maybe<T>,
  failure: FailureHandler<U>,
  ...failureArgs: U
): asserts value is T
export function assertValue<T, U extends any[]>(
  value: Maybe<T>,
  failure: FailureHandler<U> | string,
  ...failureArgs: U
): asserts value is T {
  truthyOrThrow(value, failure, ...failureArgs)
}

function truthyOrThrow<T, U extends any[]>(
  x: Maybe<T>,
  failure: FailureHandler<U> | string,
  ...failureArgs: U
): asserts x is T {
  if ((x as Maybe<unknown>) === false || x == null) {
    const error = typeof failure === 'string' ? new Error(failure) : failure(...failureArgs)
    throw error
  }
}
