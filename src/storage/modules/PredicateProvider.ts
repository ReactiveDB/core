import * as lf from 'lovefield'
import { forEach, warn, concat, keys } from '../../utils'
import { ValueLiteral, VaildEqType, Predicate, PredicateMeta, TablesStruct } from '../../interface'

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

export const predicateOperatorNames =
  new Set(concat(keys(predicateFactory), keys(compoundPredicateFactory)))

export class PredicateProvider<T> {

  private table: lf.schema.Table | null

  constructor(
    private tables: TablesStruct,
    private tableName: string,
    private meta?: Predicate<T>
  ) {
    const tableDef = this.tables[this.tableName]
    this.table = tableDef ? tableDef.table : null
  }

  getPredicate(): lf.Predicate | null {
    if (!this.table) {
      return null
    }
    const predicates = this.meta ? this.normalizeMeta(this.meta) : []
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
    return pred ? JSON.stringify(this.meta) : ''
  }

  private normalizeMeta(meta: Predicate<T>, column?: lf.schema.Column, parentKey?: string): lf.Predicate[] {
    const table = this.table!
    const buildSinglePred = (col: lf.schema.Column, val: any, key: string): lf.Predicate =>
      this.checkMethod(key) ? predicateFactory[key](col, val) : col.eq(val as ValueLiteral)

    const predicates: lf.Predicate[] = []

    forEach(meta, (val, key) => {
      let nestedPreds: lf.Predicate[]
      let resultPred: lf.Predicate

      if (this.checkCompound(key)) {
        nestedPreds = this.normalizeMeta(val as Predicate<T>, column)
        resultPred = compoundPredicateFactory[key](nestedPreds)
      } else if (checkPredicate<T>(val)) {
        nestedPreds = this.normalizeMeta(val as any, table[key], key)
        resultPred = compoundPredicateFactory['$and'](nestedPreds)
      } else {
        if (parentKey && !this.checkMethod(key)) {
          key = `${ parentKey }.${ key }`
        }
        const ks: string[] = key.split('.')
        let _column: lf.schema.Column
        if (!column) {
          if (ks.length === 1) {
            _column = table[key]
          } else {
            const columnKey = ks.pop()!
            const tableName = this.getAliasTableName(ks)
            _column = this.tables[tableName].table[columnKey]
          }
        } else {
          _column = column
        }
        if (_column) {
          resultPred = buildSinglePred(_column, val, key)
        } else {
          warn(`Failed to build predicate, since column: ${key} is not exist, on table: ${table.getName()}`)
          return
        }
      }

      predicates.push(resultPred)
    })

    return predicates
  }

  private getAliasTableName(ks: string[]) {
    let { length } = ks
    let ctxName = this.tableName
    let resultKey = this.tableName
    while (length > 0) {
      const localKey = ks.shift()!
      resultKey = `${ ctxName }@${ localKey }`
      ctxName = this.tables[resultKey].contextName!
      length = ks.length
    }
    return resultKey
  }

  private checkMethod(methodName: string) {
    return typeof predicateFactory[methodName] === 'function'
  }

  private checkCompound(methodName: string) {
    return typeof compoundPredicateFactory[methodName] === 'function'
  }

}

export function checkPredicate<T>(val: Partial<PredicateMeta<T>> | ValueLiteral) {
  return val && typeof val === 'object' &&
    !(val instanceof Array) &&
    !(val instanceof RegExp) &&
    !(val instanceof (lf.schema as any).BaseColumn)
}
