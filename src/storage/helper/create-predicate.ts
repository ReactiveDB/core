import { PredicateProvider, Tables } from '../modules/PredicateProvider'
import { Predicate } from '../../interface'

export function createPredicate<T>(tables: Tables, tableName: string, clause: Predicate<T> | null = null) {
  return clause ? new PredicateProvider(tables, tableName, clause).getPredicate() : null
}
