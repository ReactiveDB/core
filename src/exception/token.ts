export const TokenConsumed =
  () => 'QueryToken was already consumed.'

export const TokenConcatFailed =
  (msg?: string) => {
    const errMsg = 'Token cannot be concated' + `${ msg ? ' due to: ' + msg : '' }.`
    return errMsg
  }
