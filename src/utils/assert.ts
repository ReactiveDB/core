import { Truthy } from './truthy'

export function assert(condition: boolean, error: Error | string): void {
  truthyOrThrow(condition, error)
}

export function assertValue<T>(
  value: T,
  error: Error | string
): Truthy<T> | never {
  return truthyOrThrow(value, error)
}

function truthyOrThrow<T>(x: T, error: Error | string): Truthy<T> | never {
  if (x) {
    return x as Truthy<T>
  }

  if (error instanceof Error) {
    throw error
  } else {
    throw new Error(error)
  }
}
