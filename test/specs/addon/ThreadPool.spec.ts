import { describe, it, beforeEach, afterEach } from 'tman'
import { expect } from 'chai'
import { ThreadPool, workify } from '../../index'

export default describe('ThreadPool Testcase: ', () => {
  let threads: ThreadPool
  const fn = function(): void {
    return void 0
  }

  beforeEach(() => {
    threads = new ThreadPool(() => workify(fn), 2)
  })

  afterEach(() => {
    threads.terminate()
  })

  it('should be instantiated successfully', () => {
    expect(threads).to.be.instanceof(ThreadPool)
  })

  describe('Property: size', () => {
    it('should be able to get size of pool', () => {
      expect(threads.size).to.equal(2)
    })
  })

  describe('Method: terminate', () => {
    it('should be able to call destroyAll', () => {
      threads.terminate()
      expect(threads.size).to.equal(0)
    })
  })

  describe('Method: peek', () => {
    it('should be able to call peek', () => {
      const ret = threads.peek()
      expect(ret.length).to.equal(2)
    })

    it('should throw if thread pool was not initialized', () => {
      const t = new ThreadPool(() => workify(fn))

      try {
        t.peek()
        throw new Error('unreachable code path')
      } catch (e) {
        expect(e.message).to.equal('Thread Pool is not initialized.')
      }
    })

    it('should be get a difference worker', () => {
      const [worker1] = threads.peek()
      const [worker2] = threads.peek()

      expect(worker1).not.to.equal(worker2)
    })
  })

  describe('Method: start', () => {
    it('cannot be start again once it is started', () => {
      try {
        threads.start(10)
        throw new Error('unreachable code path')
      } catch (e) {
        expect(e.message).to.equal('Thread Pool Size cannot be overrided.')
      }
    })

    it('should be able to restart with a difference size', () => {
      threads.terminate()
      threads.start(10)
      expect(threads.size).to.equal(10)
    })
  })
})
