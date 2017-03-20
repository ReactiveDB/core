export interface ReactiveDBException extends Error { }

export interface ReactiveDBExceptionCtor {
  new(message: string): ReactiveDBException
  readonly prototype: ReactiveDBException
}

function ReactiveDBExceptionCtor(this: ReactiveDBException, message: string): ReactiveDBException {
  const err = Error.call(this, message)
  this.name = err.name
  this.message = message
  this.stack = err.stack
  return this
}

ReactiveDBExceptionCtor.prototype = Object.create(Error.prototype, {
  constructor: {
    value: ReactiveDBExceptionCtor,
    enumerable: false,
    writable: true,
    configurable: true
  }
})

export const ReactiveDBException = ReactiveDBExceptionCtor as any as ReactiveDBExceptionCtor
