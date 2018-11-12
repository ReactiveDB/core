export class ThreadPool {
  private initialized = false
  private pool: Worker[] = []
  private poolSize: number = 0
  private threadId: number = 0
  protected perfLabel = 'incremental-marker'

  constructor(private factory: () => Worker, size?: number) {
    if (size) {
      this.start(size)
    }
  }

  get size() {
    if (this.initialized) {
      return this.poolSize
    }

    return 0
  }

  start(size: number) {
    if (!this.initialized) {
      this.poolSize = size
      for (let i = 0; i < size; i++) {
        this.pool.push(this.factory())
      }
      this.initialized = true
    } else {
      throw Error('Thread Pool Size cannot be overrided.')
    }
  }

  peek(): [Worker, MessageChannel] {
    if (!this.initialized) {
      throw Error('Thread Pool is not initialized.')
    }
    // 实现一个简单的队列轮转
    const worker = this.pool.shift()!
    this.pool.push(worker)
    const chan = new MessageChannel()
    return [worker, chan]
  }

  /* istanbul ignore next */
  // 依赖 BOM 环境
  run<T, R>(payload: T, callback: (receiver: R) => void) {
    const [worker, chan] = this.peek()
    const threadId = this.threadId++

    if (process.env.NODE_ENV === 'development') {
      // note: postMessage will make a cost for object clone
      performance.mark(`thread-start-${threadId}`)
    }

    worker.postMessage({ payload, chan: chan.port2 }, [chan.port2])
    chan.port1.onmessage = (evt: { data: R }) => {
      callback(evt.data)

      if (process.env.NODE_ENV === 'development') {
        performance.mark(`thread-end-${threadId}`)
        performance.measure(this.perfLabel, `thread-start-${threadId}`, `thread-end-${threadId}`)
      }
    }
  }

  terminate() {
    this.pool.forEach((worker) => worker.terminate())
    this.pool = []
    this.initialized = false
  }
}
