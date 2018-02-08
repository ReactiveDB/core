import { ReactiveDBException } from '../exception/Exception'

export function assert(condition: any, message: string) {
  if (!condition) {
    throw new ReactiveDBException(message)
  }
}
