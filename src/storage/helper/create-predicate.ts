import { PredicateProvider } from '../modules/PredicateProvider'
import { Predicate, TablesStruct } from '../../interface'

export function createPredicate<T>(tables: TablesStruct, tableName: string, clause: Predicate<T>) {
  return new PredicateProvider(tables, tableName, clause).getPredicate()
}
