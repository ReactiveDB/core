const lf = require('lovefield')

const shallowEqual = function(thisArg: any, columns: any[], left: any, right: any) {
  return columns.every(function(this: any, column) {
    const colType = column.getType()
    const leftField = left.getField(column)
    const rightField = right.getField(column)

    if (colType == lf.Type.OBJECT || colType == lf.Type.ARRAY_BUFFER) {
      return leftField === rightField
    }

    const evalEqual = this.evalRegistry_.getEvaluator(colType, lf.eval.Type.EQ)
    return evalEqual(leftField, rightField)
  }, thisArg)
}

const compareFn = function(ctx: any, left: any, right: any) {
  if (left.length !== right.length) {
    return true
  }

  for (let i = 0; i < left.length; i++) {
    const ret = shallowEqual(ctx, ctx.columns_, left[i], right[i])
    if (!ret) {
      return true
    }
  }

  return false
}

export const aggresiveOptimizer = () => {
  lf.ObserverRegistry.Entry_.prototype.updateResults = function(newResults: any[]) {
    const oldList: any = (this.lastResults_ && this.lastResults_.entries) || []
    const newList: any = newResults.entries || []

    const hasChanges = compareFn(this.diffCalculator_, oldList, newList)
    this.lastResults_ = newResults

    if (hasChanges) {
      this.observers_.forEach((observerFn: Function) => {
        observerFn()
      })
    }
  }
}
