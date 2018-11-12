import { Observable, OperatorFunction, Operator, Subscriber, asyncScheduler } from 'rxjs'
import { throttleTime } from 'rxjs/operators'

import { workify } from '../utils/workerify'
import diff, { Ops, Dataset } from './diff'
import { patch } from './patch'
import { ThreadPool } from './ThreadPool'

export interface IncrementalConfig {
  pk?: string
  timing?: number
}

const threads = new ThreadPool(() => workify(diff))
let defaultPkValue = ''

export function enableRefTracing(size: number = 2, defaultPK = '_id') {
  threads.start(size)
  defaultPkValue = defaultPK
}

export function incremental<T>(pk?: string): OperatorFunction<T, T>
export function incremental<T>(config?: IncrementalConfig): OperatorFunction<T, T>
export function incremental<T>(params: string | IncrementalConfig = {}): OperatorFunction<T, T> {
  const isPrimitive = typeof params === 'string'
  const timing = isPrimitive ? -1 : (params as IncrementalConfig).timing || -1
  const pk = isPrimitive ? (params as string) : (params as IncrementalConfig).pk || defaultPkValue

  return function(source: Observable<T>): Observable<T> {
    if (timing >= 0) {
      return source.pipe(throttleTime(timing, asyncScheduler, { trailing: true })).lift(new IncrementalOperator(pk))
    }
    return source.lift(new IncrementalOperator(pk))
  }
}

class IncrementalOperator<T, R> implements Operator<T, R> {
  constructor(private pk: string) {}
  call(subscriber: Subscriber<R>, source: any): any {
    const inst = new IncrementalSubscriber(subscriber as any, this.pk, null)
    return source.subscribe(inst)
  }
}

class IncrementalSubscriber<T extends Array<any>, R extends Array<any>> extends Subscriber<T> {
  private hasSeed = false
  // 用于确保当计算数据被异步返回时, 不发生乱序发射
  private seq = 0
  private pending: boolean = false
  private shouldComplete: boolean = false

  get seed(): T | R | null {
    return this.innerSeed
  }

  set seed(value: T | R | null) {
    this.hasSeed = true
    this.innerSeed = value
  }

  constructor(destination: Subscriber<R>, private pk: string, private innerSeed: T | R | null) {
    super(destination)
  }

  protected _next(value: T): void {
    type In = T | R | null

    const currSeq = (this.seq = this.seq + 1)

    if (!this.hasSeed) {
      this.destination.next!(value)
      this.seed = value
    } else {
      this.pending = true

      if (process.env.NODE_ENV === 'test') {
        setTimeout(() => {
          // mocked message-channel in node
          const chan: any = {
            postMessage: (ret: any) => {
              if (ret.sequence < this.seq) {
                return
              }
              this.handleMsg(ret, ret.sequence, value)
            },
          }

          diff({ data: { payload: [this.pk, this.seed as object[], value, currSeq], chan } })
        }, (currSeq % 2) + 100)
      } else {
        /* istanbul ignore next */
        threads.run<Dataset<In>, Ops>([this.pk, this.seed, value, currSeq], (ret) => {
          if (ret.sequence < this.seq) {
            return
          }
          this.handleMsg(ret, ret.sequence, value)
        })
      }
    }
  }

  protected handleMsg(ret: Ops, sequence: number, value: T) {
    switch (ret.type) {
      // error
      case 0:
        this.destination.error!(new Error(ret.message))
        break
      // success
      case 1:
        const nextRet: T = patch(ret.ops, this.seed as T, value)
        this.destination.next!(nextRet)
        this.seed = nextRet
        break
      // skip
      case 2:
        break
    }

    this.pending = false
    if (this.shouldComplete && sequence === this.seq) {
      this.destination.complete!()
    }
  }

  protected _complete(): void {
    this.shouldComplete = true
    if (!this.pending) {
      this.destination.complete!()
    }
  }
}
