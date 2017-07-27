import { ReactiveDBException } from './Exception'

export const tokenMustBeSymbol = (token: any) =>
  new ReactiveDBException(`Symbol type expected, but got ${ typeof token }: ${ token }`)

export const clauseMissingError = () =>
  new ReactiveDBException('Clause must be specified when when reverControoler is passed to delete method')

export const revertBeforeOperationSuccessError = () =>
  new ReactiveDBException('You can only revert after the operation that you passed RevertController success')
