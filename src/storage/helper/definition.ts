import { forEach } from '../../utils'
import { RDBType, ColumnDef } from '../../interface'
import { LiteralArray } from './graph'
import { Relationship } from '../../interface'
import * as Exception from '../../exception'

export function revise(relation: Relationship, def: Object) {
  switch (relation) {
    case Relationship.oneToOne:
      forEach(def, (value) => {
        if (value.id) {
          value.id = false
        }
      })
      break
    case Relationship.oneToMany:
      def = [def]
      break
    case Relationship.manyToMany:
      throw Exception.NotImplemented()
    default:
      throw Exception.UnexpectedRelationship()
  }

  return def
}

/**
 * Specify a part of the definition object that is
 * to be fed to nestJS.nest function.
 */
export function create(column: string, asId: boolean, type: RDBType): ColumnDef {
  if (type === RDBType.LITERAL_ARRAY) {
    return { column, id: asId, type: LiteralArray }
  }

  return { column, id: asId }
}
