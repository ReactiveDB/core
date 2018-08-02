import { ReactiveDBException } from './Exception'

export const TokenConsumed = () => new ReactiveDBException('QueryToken was already consumed.')

export const TokenConcatFailed = (msg?: string) => {
  const errMsg = 'Token cannot be concated' + `${msg ? ' due to: ' + msg : ''}.`
  return new ReactiveDBException(errMsg)
}
