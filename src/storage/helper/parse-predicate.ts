import { Predicate } from '../../interface'
import { forEach } from '../../utils'
import { checkPredicate, predicateOperators } from '../modules/PredicateProvider'

export function parsePredicate<T>(predicate: Predicate<T>) {
  let lastLeaf: Object
  function parse (predicateMeta: any) {
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
              if (checkPredicate(val)) {
                const subLeaf = parse(val)
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
        } else if (checkPredicate(val)) {
          lastLeaf[key] = parse(val)
        } else if (Array.isArray(val)) {
          lastLeaf[key] = parseArray(val)
        } else {
          lastLeaf[key] = val
        }
      }
    })
    return target
  }

  function parseArray(predicates: Predicate<T>[]) {
    return predicates.map(pred => parse(pred))
  }

  return parse(predicate)
}
