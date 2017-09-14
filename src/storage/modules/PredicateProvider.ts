import * as lf from 'lovefield'
import { fieldIdentifier } from '../symbols'
import { forEach, warn, concat, keys } from '../../utils'
import { ValueLiteral, VaildEqType, Predicate, PredicateMeta, TableStruct } from '../../interface'

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

export const predicateOperators = new Set(keys(predicateFactory))

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

  private table: lf.schema.Table | null

  constructor(
    private tables: TableStruct,
    private tableName: string,
    private meta?: Predicate<T>
  ) {
    const tableDef = this.tables[this.tableName]
    this.table = tableDef ? tableDef.table : null
  }

  static check<K>(val: Partial<PredicateMeta<K>> | ValueLiteral) {
    return val && typeof val === 'object' &&
      !(val instanceof Array) &&
      !(val instanceof RegExp) &&
      !(val instanceof (lf.schema as any).BaseColumn)
  }

  static checkNull(pred: lf.Predicate | null, tableName: string) {
    if (!pred) {
      warn(`The result of parsed predicate is null, you\'re trying to remove all records from Table: ${ tableName }!`)
    }
  }

  static create<K>(struct: TableStruct, tableName: string, clause: Predicate<K>) {
    return new PredicateProvider(struct, tableName, clause).getPredicate()
  }

  static parse<K>(predicate: Predicate<K>) {
    let lastLeaf: Object

    function parsePredicate (predicateMeta: any) {
      const target = Object.create(null)
      lastLeaf = target

      forEach(predicateMeta, (val, key) => {
        if (predicateOperators.has(key)) {
          lastLeaf[key] = val
        } else {
          const ks: string[] = key.split('.')
          const length = ks.length
          if (length > 1) {
            ks.reduce((acc, cur, index) => {
              if (index === length - 1) {
                if (PredicateProvider.check(val)) {
                  const subLeaf = parsePredicate(val)
                  acc[cur] = subLeaf
                  lastLeaf = subLeaf
                } else {
                  acc[cur] = val
                }
              } else {
                const newLeaf = Object.create(null)
                acc[cur] = newLeaf
                return newLeaf
              }
            }, lastLeaf)
          } else if (PredicateProvider.check(val)) {
            lastLeaf[key] = parsePredicate(val)
          } else if (Array.isArray(val)) {
            lastLeaf[key] = parseArray(val)
          } else {
            lastLeaf[key] = val
          }
        }
      })

      return target
    }

    function parseArray(predicates: Predicate<K>[]) {
      return predicates.map(pred => parsePredicate(pred))
    }

    return parsePredicate(predicate)
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

  private normalizeMeta(meta: Predicate<T>, column?: lf.schema.Column, parentKey?: string, tableName = this.tableName): lf.Predicate[] {
    const identifier = parentKey ? fieldIdentifier(tableName, parentKey) : tableName
    const struct = parentKey ? this.tables[identifier] : { table: this.table!, contextName: this.tableName }
    let table: lf.schema.Table
    let contextName: string | undefined
    if (!struct) {
      const parentStruct = this.tables[tableName]
      table = parentStruct.table
      contextName = parentStruct.contextName
    } else {
      table = struct.table
      contextName = struct.contextName
    }

    const buildSinglePred = (col: lf.schema.Column, val: any, key: string): lf.Predicate =>
      PredicateProvider.checkMethod(key) ? predicateFactory[key](col, val) : col.eq(val as ValueLiteral)

    const predicates: lf.Predicate[] = []

    forEach(meta, (val: any, key) => {
      let nestedPreds: lf.Predicate[]
      let resultPred: lf.Predicate

      if (PredicateProvider.checkCompound(key)) {
        nestedPreds = (Array.isArray(val) ? val : [val]).reduce((acc: Predicate<any>[], pred: Predicate<any>) => {
          return concat(acc, this.normalizeMeta(pred as Predicate<T>, column, parentKey, contextName))
        }, [])
        resultPred = compoundPredicateFactory[key](nestedPreds)
      } else if (PredicateProvider.check<T>(val)) {
        nestedPreds = this.normalizeMeta(val as any, table[key], key, contextName)
        resultPred = compoundPredicateFactory['$and'](nestedPreds)
      } else {
        let targetCol: lf.schema.Column | null = null
        if (!column) {
          if (struct) {
            targetCol = struct.table[key]
          } else {
            PredicateProvider.warn(parentKey!, table.getName())
            return
          }
        } else {
          targetCol = column
        }
        if (targetCol) {
          resultPred = buildSinglePred(targetCol, val, key)
        } else {
          PredicateProvider.warn(key, table.getName())
          return
        }
      }

      predicates.push(resultPred)
    })
    return predicates
  }

  private static checkMethod(methodName: string) {
    return typeof predicateFactory[methodName] === 'function'
  }

  private static checkCompound(methodName: string) {
    return typeof compoundPredicateFactory[methodName] === 'function'
  }

  private static warn(key: string, tableName: string) {
    warn(`Failed to build predicate, since column: ${key} is not existed, on table: ${tableName}`)
  }

}
