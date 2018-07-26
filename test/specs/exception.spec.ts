import { describe, it } from 'tman'
import { expect } from 'chai'
import { ReactiveDBException } from '../../src/exception/Exception'

describe('ReactiveDBException', () => {
  it('should create an instance of Error', () => {
    expect(new ReactiveDBException('hello')).to.be.instanceOf(Error)
    expect(new ReactiveDBException('world', { msg: 'hello' })).to.be.instanceOf(Error)
  })

  it('should create an Error with static name and specified message', () => {
    const err = new ReactiveDBException('hello')
    expect(err.name).to.equal('ReactiveDBError')
    expect(err.message).to.equal('hello')
  })

  it('should allow caller to pass in more related info through `moreInfo` param', () => {
    const err = new ReactiveDBException('hello', { msg: 'world' })
    expect(err.message).to.equal('hello\nMoreInfo: {"msg":"world"}')
  })
})
