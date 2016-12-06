'use strict'
import * as lf from 'lovefield'

export class SelectMeta <T> {
  static replacePredicate<U>(oldMeta: SelectMeta<U>, newPredicate: lf.Predicate) {
    return new SelectMeta(oldMeta.db, oldMeta.select, oldMeta.fold, newPredicate)
  }

  constructor(
    public db: lf.Database,
    public select: lf.query.Select,
    private fold: (values: T[]) => T[],
    public predicate?: lf.Predicate
  ) { }

  getValue(): Promise<T[]> {
    let select: lf.query.Builder
    if (this.predicate) {
      select = this.select
        .where(this.predicate)
    } else {
      select = this.select
    }
    return select.exec()
      .then(values => this.fold(<T[]>values))
  }

}
