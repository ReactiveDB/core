import { Truthy } from './truthy'

type FailureHandler<U extends any[]> = (...args: U) => Error

export function assert(condition: boolean, failureMsg: string): void
export function assert<U extends any[]>(
  condition: boolean,
  failure: FailureHandler<U>,
  ...failureArgs: U
): void
export function assert<U extends any[]>(
  condition: boolean,
  failure: FailureHandler<U> | string,
  ...failureArgs: U
): void {
  truthyOrThrow(condition, failure, ...failureArgs)
}

export function assertValue<T>(value: T, falsyValueMsg: string): Truthy<T> | never
export function assertValue<T, U extends any[]>(
  value: T,
  failure: FailureHandler<U>,
  ...failureArgs: U
): Truthy<T> | never
export function assertValue<T, U extends any[]>(
  value: T,
  failure: FailureHandler<U> | string,
  ...failureArgs: U
): Truthy<T> | never {
  return truthyOrThrow(value, failure, ...failureArgs)
}

function truthyOrThrow<T, U extends any[]>(
  x: T,
  failure: FailureHandler<U> | string,
  ...failureArgs: U
): Truthy<T> | never {
  if (x) {
    return x as Truthy<T>
  }

  const error = typeof failure === 'string' ? new Error(failure) : failure(...failureArgs)
  throw error
}
