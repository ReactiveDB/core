import * as lf from 'lovefield'
import { ExecutorResult } from '../../interface'
import { executor } from '../helper'
import { tokenMustBeSymbol, revertBeforeOperationSuccessError } from '../../exception/revert'

export interface RevertToken extends String {
  kind?: 'revert-token'
}

export interface RevertControllerInteface {
  revert(): Promise<ExecutorResult>
}

export class RevertController implements RevertControllerInteface {
  static create() {
    return new RevertController
  }

  static getToken(token: Symbol) {
    if (typeof token !== typeof RevertController.symbolTemplate) {
      throw tokenMustBeSymbol(token)
    }
    return RevertController.controllers.get(token) || null
  }

  private static controllers = new Map<Symbol, RevertController>()

  private static symbolTemplate = Symbol('template-for-revert')

  private readonly symbol: Symbol
  private queries: lf.query.Builder[]
  private db: lf.Database

  revert() {
    if (!this.db || !this.queries) {
      throw revertBeforeOperationSuccessError()
    }
    return executor(this.db, this.queries)
  }

  giveup() {
    RevertController.controllers.delete(this.symbol)
  }

  toToken() {
    return this.symbol
  }

  inject(db: lf.Database, queries: lf.query.Builder[]) {
    this.db = db
    this.queries = queries
    return this
  }

  merge(...revertCtrls: RevertController[]) {
    const dist = RevertController.create()
    const queries = revertCtrls.reduce((acc, cur) => {
      return acc.concat(cur.queries)
    }, this.queries)

    return dist.inject(this.db, queries)
  }

  private constructor () {
    this.symbol = Symbol(`revert-token-${ Date.now() }`)
  }
}
