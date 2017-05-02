import * as lf from 'lovefield'
import { forEach, warn } from '../../utils'
import { ValueLiteral, VaildEqType, Predicate, PredicateMeta } from '../../interface'

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
    private meta: Predicate<T>
  ) { }

  getPredicate(): lf.Predicate | null {
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

  toString(): string | void {
    const pred = this.getPredicate()
    if (pred !== null) {
      return pred.toString()
    }
  }

  private normalizeMeta(meta: Predicate<T>, column?: lf.schema.Column) {
    let predicates: lf.Predicate[] = []
    forEach(meta, (val, key) => {
      if (this.checkCompound(key)) {
        predicates.push(compoundPredicateFactory[key](this.normalizeMeta(val as Predicate<T>, column)))
      } else if (this.checkPredicate(val)) {
        predicates = predicates.concat(this.normalizeMeta(val as any, this.table[key]))
      } else {
        const _column = column || this.table[key]
        if (!_column) {
          warn(
            `Failed to build predicate, since column: ${key} is not exist` +
            `, on table: ${this.table.getName()}`
          )
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
    return val && typeof val === 'object' &&
      !(val instanceof Array) &&
      !(val instanceof RegExp) &&
      !(val instanceof (lf.schema as any).BaseColumn)
  }

}
