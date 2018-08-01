import { Subject, Subscription } from 'rxjs'
import { map } from 'rxjs/operators'
import { expect } from 'chai'
import { beforeEach, it, describe, afterEach } from 'tman'
import { ProxySelector } from '../../../index'

export default describe('ProxySelector test', () => {
  let selector: ProxySelector<any>
  let subscription: Subscription | undefined
  let request$: Subject<any>

  beforeEach(() => {
    request$ = new Subject()
    selector = new ProxySelector(request$, {} as any, 'Task' )
  })

  afterEach(() => {
    request$.complete()
    request$.unsubscribe()
    if (subscription instanceof Subscription) {
      subscription.unsubscribe()
    }
  })

  it('should transfer Object to Array by \`values\`', done => {
    const fixture = {
      foo: 'bar'
    }

    subscription = selector.values()
      .subscribe(([r]) => {
        expect(r).to.deep.equal(fixture)
        done()
      })

    request$.next(fixture)
  })

  it('should return Array directly by \`values\`', done => {
    const fixture = {
      foo: 'bar'
    }

    subscription = selector.values()
      .subscribe((r) => {
        expect(r).to.deep.equal([fixture])
        done()
      })

    request$.next([fixture])
  })

  it ('changes should complete after emit value', done => {
    const fixture = {
      foo: 'bar'
    }

    subscription = selector.values()
      .subscribe({
        next: (r) => {
          expect(r).to.deep.equal([fixture])
          done()
        },
        complete: () => done()
      })

    request$.next([fixture])
    request$.complete()
  })

  it('should map values', done => {
    const fixture = {
      foo: 'bar'
    }

    subscription = selector
      .map(s$ => s$.pipe(map(r => r.map(() => 1))))
      .values()
      .subscribe((r) => {
        expect(r).to.deep.equal([1])
        done()
      })

    request$.next([fixture])
  })

  it('should map changes', done => {
    const fixture = {
      foo: 'bar'
    }

    subscription = selector
      .map(s$ => s$.pipe(map(r => r.map(() => 1))))
      .changes()
      .subscribe((r) => {
        expect(r).to.deep.equal([1])
        done()
      })

    request$.next([fixture])
  })

})
