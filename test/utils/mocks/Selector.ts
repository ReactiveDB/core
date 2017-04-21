import { ReplaySubject } from 'rxjs/ReplaySubject'
import { Observable } from 'rxjs/Observable'

export class MockSelector<T> {
  static datas = new Map<string, any>()
  static selectMeta = new Map<string, MockSelector<any>>()

  static update(_id: string, patch: any) {
    if (!MockSelector.datas.has(_id)) {
      throw new TypeError(`Patch target is not exist: ${_id}`)
    }
    const data = MockSelector.datas.get(_id)
    Object.assign(data, patch)
    MockSelector.selectMeta.get(_id).notify()
  }

  private mapFn: <J, K>(v: J, index?: number, array?: J[]) => K = (v: T) => v
  private subject = new ReplaySubject<T[]>(1)
  private change$ = this.subject
    .map(v => v.map(this.mapFn))
  private datas: T[]

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
    return this.change$
  }

  values () {
    return this.change$.take(1)
  }

  concat = this.combine

  combine(... metas: MockSelector<T>[]) {
    metas.unshift(this)
    const dist = new MockSelector(new Map)
    dist.values = () => {
      return Observable.from(metas)
        .flatMap(meta => meta.values())
        .reduce((acc: T[], val: T[]) => acc.concat(val))
    }

    dist.changes = () => {
      return Observable.from(metas)
        .map(meta => meta.changes())
        .combineAll()
        .map((r: T[][]) => r.reduce((acc, val) => acc.concat(val)))
    }
    return dist
  }

  toString() {
    return `MockSelector SQL`
  }

  setMapFn<J, K>(fn: (v: J, index?: number, array?: J[]) => K) {
    if (typeof fn === 'function') {
      this.mapFn = fn
    }
  }

  private notify() {
    this.subject.next(this.datas)
  }
}
