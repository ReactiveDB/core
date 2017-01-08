import { ReplaySubject } from 'rxjs/ReplaySubject'
import { Observable } from 'rxjs/Observable'

export default class MockSelector<T> {
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

  private subject = new ReplaySubject<T[]>(1)
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
    return this.subject
  }

  values () {
    return this.subject.take(1)
  }

  combine(... metas: MockSelector<T>[]) {
    metas.unshift(this)
    const dist = new MockSelector(new Map)
    dist.values = () => {
      return Observable.from(metas)
        .map(meta => meta.values())
        .combineAll()
        .map((r: T[][]) => r.reduce((acc, val) => acc.concat(val)))
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

  private notify() {
    this.subject.next(this.datas)
  }
}
