import { ReplaySubject, Observable, from } from 'rxjs'
import { combineAll, map, flatMap, reduce, take } from 'rxjs/operators'

export class MockSelector<T> {
  static datas = new Map<string, any>()
  static selectMeta = new Map<string, MockSelector<any>>()

  static update(_id: string, patch: any) {
    if (!MockSelector.datas.has(_id)) {
      throw new TypeError(`Patch target is not exist: ${_id}`)
    }
    const data = MockSelector.datas.get(_id)
    const newData = Object.assign({}, data, patch)
    MockSelector.datas.set(_id, newData)
    const mockSelector = MockSelector.selectMeta.get(_id)
    mockSelector.datas = mockSelector.datas.map((d) => {
      return d === data ? newData : d
    })

    mockSelector.notify()
  }

  private static mapFn = <U>(dist$: Observable<U>) => dist$

  private subject = new ReplaySubject<T[]>(1)
  private change$ = this.subject
  private datas: T[]
  private mapFn = MockSelector.mapFn

  constructor(datas: Map<string, T>) {
    const result: T[] = []
    datas.forEach((val, key) => {
      if (MockSelector.datas.has(key)) {
        throw new TypeError(`Conflic data`)
      }
      MockSelector.datas.set(key, val)
      MockSelector.selectMeta.set(key, this)
      result.push(val)
    })
    this.datas = result
    this.subject.next(this.datas)
  }

  changes(): Observable<T[]> {
    return this.mapFn(this.change$)
  }

  values() {
    return this.mapFn(this.change$.pipe(take(1)))
  }

  concat(...metas: MockSelector<T>[]) {
    const dist = this.combine(...metas)
    dist['__test_label_selector_kind__'] = 'by concat'
    return dist
  }

  combine(...metas: MockSelector<T>[]) {
    metas.unshift(this)
    const dist = new MockSelector(new Map())
    dist.values = () => {
      return from(metas).pipe(
        flatMap((meta) => meta.values()),
        reduce((acc: T[], val: T[]) => acc.concat(val)),
      )
    }

    dist.changes = () => {
      return from(metas).pipe(
        map((meta) => meta.changes()),
        combineAll(),
        map((r: T[][]) => r.reduce((acc, val) => acc.concat(val))),
      )
    }
    dist['__test_label_selector_kind__'] = 'by combine'
    return dist
  }

  toString() {
    return `MockSelector SQL`
  }

  map(fn: any) {
    this.mapFn = fn
  }

  private notify() {
    this.subject.next(this.datas)
  }
}
