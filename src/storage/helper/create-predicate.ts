import * as lf from 'lovefield'
import { PredicateProvider } from '../modules/PredicateProvider'
import { Predicate } from '../../interface'

export function createPredicate<T>(table: lf.schema.Table, clause: Predicate<T> | null = null) {
  return clause ? new PredicateProvider(table, clause).getPredicate() : null
}
