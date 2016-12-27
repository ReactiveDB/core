'use strict'
import * as lf from 'lovefield'
import { BUILD_PREDICATE_FAILED_WARN } from './RuntimeError'
import { forEach } from '../utils'

export type ValueLiteral = string | number | boolean
export type VaildEqType = ValueLiteral | lf.schema.Column | lf.Binder

export interface PredicateMeta {
  $eq: ValueLiteral
  $and: PredicateDescription
  $or: PredicateDescription
  $not: PredicateDescription
  $lt: ValueLiteral
  $lte: ValueLiteral
  $gt: ValueLiteral
  $gte: ValueLiteral
  $match: RegExp
  $between: [ number, number ]
  $in: ValueLiteral[]
  $isNull: boolean
}

export interface PredicateDescription {
  [index: string]: Partial<PredicateMeta> | ValueLiteral | PredicateDescription
}

const predicateFactory = {

  $ne <T extends ValueLiteral>(colum: lf.schema.Column, value: T): lf.Predicate {
    return lf.op.not(colum.eq(value))
  },

  $lt <T extends VaildEqType>(colum: lf.schema.Column, value: T): lf.Predicate {
    return colum.lt(value)
  },

  $lte <T extends VaildEqType>(colum: lf.schema.Column, value: T): lf.Predicate {
    return colum.lte(value)
  },

  $gt <T extends VaildEqType>(colum: lf.schema.Column, value: T): lf.Predicate {
    return colum.gt(value)
  },

  $gte <T extends VaildEqType>(colum: lf.schema.Column, value: T): lf.Predicate {
    return colum.gte(value)
  },

  $match (colum: lf.schema.Column, reg: RegExp): lf.Predicate {
    return colum.match(reg)
  },

  $notMatch(colum: lf.schema.Column, reg: RegExp): lf.Predicate {
    return lf.op.not(colum.match(reg))
  },

  $between (colum: lf.schema.Column, values: [ number, number ]): lf.Predicate {
    return colum.between(values[0], values[1])
  },

  $has(colum: lf.schema.Column, value: string): lf.Predicate {
    return colum.match(new RegExp(`(${value}\\b)`))
  },

  $in (colum: lf.schema.Column, range: ValueLiteral[]): lf.Predicate {
    return colum.in(range)
  },

  $isNull (colum: lf.schema.Column): lf.Predicate {
    return colum.isNull()
  },

  $isNotNull (colum: lf.schema.Column): lf.Predicate {
    return colum.isNotNull()
  },
}

const compoundPredicateFactory = {
  $and (predicates: lf.Predicate[]): lf.Predicate {
    return lf.op.and.apply(lf.op, predicates)
  },

  $or (predicates: lf.Predicate[]): lf.Predicate {
    return lf.op.or.apply(lf.op, predicates)
  },

  $not (predicates: lf.Predicate[]): lf.Predicate {
    return lf.op.not(predicates[0])
  },
}

export class PredicateProvider {

  constructor(
    private table: lf.schema.Table,
    private meta: PredicateDescription
  ) { }

  getPredicate(): lf.Predicate {
    const predicates = this.normalizeMeta(this.meta)
    if (predicates.length) {
      if (predicates.length === 1) {
        return predicates[0]
      } else {
        return lf.op.and.apply(lf.op, predicates)
      }
    } else {
      return null
    }
  }

  private normalizeMeta(meta: PredicateDescription, column?: lf.schema.Column) {
    let predicates: lf.Predicate[] = []
    forEach(meta, (val, key) => {
      if (this.checkCompound(key)) {
        predicates.push(compoundPredicateFactory[key](this.normalizeMeta(val as PredicateDescription, column)))
      } else if (this.checkPredicate(val)) {
        predicates = predicates.concat(this.normalizeMeta(val as PredicateDescription, this.table[key]))
      } else {
        const _column = column || this.table[key]
        if (!_column) {
          BUILD_PREDICATE_FAILED_WARN('Column is non-existenet', this.table.getName(), key)
        } else {
          const predicate = this.checkMethod(key) ? predicateFactory[key](_column, val) : _column.eq(val as ValueLiteral)
          predicates.push(predicate)
        }
      }
    })
    return predicates
  }

  private checkMethod(methodName: string) {
    return typeof predicateFactory[methodName] === 'function'
  }

  private checkCompound(methodName: string) {
    return typeof compoundPredicateFactory[methodName] === 'function'
  }

  private checkPredicate(val: Partial<PredicateMeta> | ValueLiteral) {
    return typeof val === 'object' &&
          !(val instanceof Array) &&
          !(val instanceof RegExp) &&
          !(val instanceof (lf.schema as any).BaseColumn)
  }

}
