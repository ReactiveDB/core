import * as lf from 'lovefield'
import { StatementType } from '../../interface'

export function predicatableQuery(
  db: lf.Database,
  table: lf.schema.Table,
  predicate: lf.Predicate | null,
  type: StatementType.Select,
  ...columns: lf.schema.Column[]
): lf.query.Select

export function predicatableQuery(
  db: lf.Database,
  table: lf.schema.Table,
  predicate: lf.Predicate | null,
  type: StatementType.Delete,
  ...columns: lf.schema.Column[]
): lf.query.Delete

export function predicatableQuery(
  db: lf.Database,
  table: lf.schema.Table,
  predicate: lf.Predicate | null,
  type: StatementType.Update,
  ...columns: lf.schema.Column[]
): lf.query.Update

export function predicatableQuery(
  db: lf.Database,
  table: lf.schema.Table,
  predicate: lf.Predicate | null,
  type: StatementType.Select | StatementType.Update | StatementType.Delete,
  ...columns: lf.schema.Column[]
) {
  let query: lf.query.Select | lf.query.Delete | lf.query.Update

  switch (type) {
    case StatementType.Select:
      query = db.select(...columns).from(table)
      break
    case StatementType.Delete:
      query = db.delete().from(table)
      break
    case StatementType.Update:
      query = db.update(table)
      break
    default:
      throw TypeError('unreachable code path')
  }

  return predicate ? query.where(predicate) : query
}
