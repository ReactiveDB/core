import { attachMoreErrorInfo } from '../utils'

export class ReactiveDBException extends Error {
  constructor(message: string, moreInfo?: {}) {
    const messageWithContext = !moreInfo ? message : attachMoreErrorInfo(message, moreInfo)
    super(messageWithContext)
    this.name = 'ReactiveDBError'
    Object.setPrototypeOf(this, ReactiveDBException.prototype)
  }
}
