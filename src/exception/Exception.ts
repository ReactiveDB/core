export class ReactiveDBException extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ReactiveDBError'
    Object.setPrototypeOf(this, ReactiveDBException.prototype)
  }
}
