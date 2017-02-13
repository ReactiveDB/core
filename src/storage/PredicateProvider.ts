import * as lf from 'lovefield'
import { BUILD_PREDICATE_FAILED_WARN } from './RuntimeError'
import { forEach } from '../utils'

export type ValueLiteral = string | number | boolean
export type VaildEqType = ValueLiteral | lf.schema.Column | lf.Binder

export interface PredicateMeta<T> {
  $ne: ValueLiteral
  $eq: ValueLiteral
  $and: PredicateDescription<T>
  $or: PredicateDescription<T>
  $not: PredicateDescription<T>
  $lt: ValueLiteral
  $lte: ValueLiteral
  $gt: ValueLiteral
  $gte: ValueLiteral
  $match: RegExp
  $notMatch: RegExp
  $has: ValueLiteral
  $between: [ number, number ]
  $in: ValueLiteral[]
  $isNull: boolean
  $isNotNull: boolean
}

export type PredicateDescription<T> = {
  [P in keyof T]?: Partial<PredicateMeta<T>> | ValueLiteral | PredicateDescription<T[P]>
}

const predicateFactory = {

  $ne <T extends ValueLiteral>(column: lf.schema.Column, value: T): lf.Predicate {
    return lf.op.not(column.eq(value))
  },

  $lt <T extends VaildEqType>(column: lf.schema.Column, value: T): lf.Predicate {
    return column.lt(value)
  },

  $lte <T extends VaildEqType>(column: lf.schema.Column, value: T): lf.Predicate {
    return column.lte(value)
  },

  $gt <T extends VaildEqType>(column: lf.schema.Column, value: T): lf.Predicate {
    return column.gt(value)
  },

  $gte <T extends VaildEqType>(column: lf.schema.Column, value: T): lf.Predicate {
    return column.gte(value)
  },

  $match (column: lf.schema.Column, reg: RegExp): lf.Predicate {
    return column.match(reg)
  },

  $notMatch(column: lf.schema.Column, reg: RegExp): lf.Predicate {
    return lf.op.not(column.match(reg))
  },

  $between (column: lf.schema.Column, values: [ number, number ]): lf.Predicate {
    return column.between(values[0], values[1])
  },

  $has(column: lf.schema.Column, value: string): lf.Predicate {
    return column.match(new RegExp(`(${value}\\b)`))
  },

  $in (column: lf.schema.Column, range: ValueLiteral[]): lf.Predicate {
    return column.in(range)
  },

  $isNull (column: lf.schema.Column): lf.Predicate {
    return column.isNull()
  },

  $isNotNull (column: lf.schema.Column): lf.Predicate {
    return column.isNotNull()
  },
}

const compoundPredicateFactory = {
  $and (predicates: lf.Predicate[]): lf.Predicate {
    return lf.op.and(...predicates)
  },

  $or (predicates: lf.Predicate[]): lf.Predicate {
    return lf.op.or(...predicates)
  },

  $not (predicates: lf.Predicate[]): lf.Predicate {
    return lf.op.not(predicates[0])
  },
}

export class PredicateProvider<T> {

  constructor(
    private table: lf.schema.Table,
    private meta: PredicateDescription<T>
  ) { }

  getPredicate(): lf.Predicate {
    const predicates = this.normalizeMeta(this.meta)
    if (predicates.length) {
      if (predicates.length === 1) {
        return predicates[0]
      } else {
        return lf.op.and(...predicates)
      }
    } else {
      return null
    }
  }

  toString(): string {
    return this.getPredicate().toString()
  }

  private normalizeMeta(meta: PredicateDescription<T>, column?: lf.schema.Column) {
    let predicates: lf.Predicate[] = []
    forEach(meta, (val, key) => {
      if (this.checkCompound(key)) {
        predicates.push(compoundPredicateFactory[key](this.normalizeMeta(val as PredicateDescription<T>, column)))
      } else if (this.checkPredicate(val)) {
        predicates = predicates.concat(this.normalizeMeta(val as PredicateDescription<any>, this.table[key]))
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

  private checkPredicate(val: Partial<PredicateMeta<T>> | ValueLiteral) {
    return typeof val === 'object' &&
          !(val instanceof Array) &&
          !(val instanceof RegExp) &&
          !(val instanceof (lf.schema as any).BaseColumn)
  }

}
