export class ReactiveDBException extends Error {

  constructor(message: string) {
    super(message)
    this.name = 'ReactiveDBError';
    (Object as any).setPrototypeOf(this, ReactiveDBException.prototype)
  }

}
