import { forEach, getType, keys } from '../utils'
import { TraverseContext } from '../interface'

export class Traversable<T = {}> {

  private ctxgen: (key: any, val: any, ctx: TraverseContext) => T | boolean

  constructor(
    private entities: any
  ) {
    this.ctxgen = () => true
  }

  context(fn: (key: any, val?: any, ctx?: TraverseContext) => T | boolean) {
    this.ctxgen = fn
    return this
  }

  keys(target: any): any[] {
    switch (typeof target) {
      case 'string':
      case 'boolean':
      case 'number':
      case 'undefined':
        return []
      default:
        if (target instanceof Date) {
          return []
        } else if (target && typeof target.keys === 'function') {
          return Array.from(target.keys())
        } else {
          return (typeof target === 'object' && target !== null) || Array.isArray(target) ? keys(target) : []
        }
    }
  }

  forEach(eachFunc: (ctx: T & TraverseContext, node: any) => void) {
    const self = this
    let index = -1
    function walk (node: any, path: string[] = [], parents: any[] = []) {
      let advanced = true
      const children = self.keys(node)
      const parent = parents[parents.length - 1]

      index++
      const defaultCtx = {
        isRoot: path.length === 0,
        node,
        path: path,
        parent,
        children: children,
        key: path[path.length - 1],
        isLeaf: children.length === 0,
        type: () => getType(node),
        skip: () => advanced = false,
        index
      }

      const ret: Object | boolean =
        self.ctxgen(path[path.length - 1], node, defaultCtx)

      if (ret !== false) {
        const ctx =
          typeof ret === 'object' ? { ...defaultCtx, ...ret } : defaultCtx

        eachFunc.call(null, ctx, node)
      }

      if (!advanced) {
        return
      } else if (!defaultCtx.isLeaf) {
        forEach(node, (val, key) => {
          const nextPath = path.concat(key)
          const nextParents =
            Array.isArray(node) ? parents.concat([node]) : parents.concat(node)

          walk(val, nextPath, nextParents)
        })
      }
    }

    walk(this.entities)
  }

}
