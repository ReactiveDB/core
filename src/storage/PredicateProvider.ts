'use strict'
import * as lf from 'lovefield'

export type ValueLiteral = string | number | boolean | Date
export type VaildEqType = ValueLiteral | lf.schema.Column | lf.Binder

export class PredicateProvider {
  eq <T extends VaildEqType>(colum: lf.schema.Column, value: T): lf.Predicate {
    return colum.eq(value)
  }

  and (predicates: lf.Predicate[]): lf.Predicate {
    return lf.op.and.apply(lf.op, predicates)
  }

  lt <T extends VaildEqType>(colum: lf.schema.Column, value: T): lf.Predicate {
    return colum.lt(value)
  }

  lte <T extends VaildEqType>(colum: lf.schema.Column, value: T): lf.Predicate {
    return colum.lte(value)
  }

  gt <T extends VaildEqType>(colum: lf.schema.Column, value: T): lf.Predicate {
    return colum.gt(value)
  }

  gte <T extends VaildEqType>(colum: lf.schema.Column, value: T): lf.Predicate {
    return colum.gte(value)
  }

  match (colum: lf.schema.Column, reg: RegExp): lf.Predicate {
    return colum.match(reg)
  }

  between (colum: lf.schema.Column, value1: ValueLiteral, value2: ValueLiteral): lf.Predicate {
    return colum.between(value1, value2)
  }

  in (colum: lf.schema.Column, range: lf.Binder | ValueLiteral[]): lf.Predicate {
    return colum.in(range)
  }

  isNull (colum: lf.schema.Column): lf.Predicate {
    return colum.isNull()
  }

  isNotNull (colum: lf.schema.Column): lf.Predicate {
    return colum.isNotNull()
  }
}

export default new PredicateProvider
