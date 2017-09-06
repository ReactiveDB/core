import { describe, it } from 'tman'
import { expect } from 'chai'

import { parsePredicate } from '../../../index'

export default describe('Helper - parsePredicate TestCase', () => {

  const expected = {
    task: {
      tasklist: {
        project: {
          organization: {
            _id: 'xxx'
          }
        }
      }
    }
  }

  it('should parse normal predicate', () => {
    const meta = {
      task: {
        tasklist: {
          project: {
            organization: {
              _id: 'xxx'
            }
          }
        }
      }
    }
    const metaString = JSON.stringify(meta)
    const result = parsePredicate(meta)

    expect(result).to.deep.equal(expected)
    expect(JSON.stringify(result)).to.equal(metaString)
  })

  it('should parse nested predicate', () => {
    const meta = {
      task: {
        'tasklist.project.organization._id': 'xxx'
      }
    }

    const result = parsePredicate(meta)

    expect(result).to.deep.equal(expected)
  })

  it('should parse mutiple levels nested predicate #1', () => {
    const meta = {
      'task.tasklist': {
        'project.organization': {
          _id: 'xxx'
        }
      }
    }

    const result = parsePredicate(meta)

    expect(result).to.deep.equal(expected)
  })

  it('should parse mutiple levels nested predicate #2', () => {
    const meta = {
      task: {
        'tasklist.project.organization': {
          _id: 'xxx'
        }
      }
    }

    const result = parsePredicate(meta)

    expect(result).to.deep.equal(expected)
  })

  it('should parse mutiple levels nested predicate #3', () => {
    const meta = {
      task: {
        'tasklist.project': {
          'organization._id': 'xxx'
        }
      }
    }

    const result = parsePredicate(meta)

    expect(result).to.deep.equal(expected)
  })

  it('should parse with predicate operators', () => {
    const meta = {
      task: {
        'tasklist._id': {
          $in: ['xxx', 'yyy']
        }
      }
    }

    const result = parsePredicate(meta)

    expect(result).to.deep.equal({
      task: {
        tasklist: {
          _id: {
            $in: ['xxx', 'yyy']
          }
        }
      }
    })
  })

  it('should parse compound nested predicate', () => {
    const meta = {
      task: {
        $or: [
          {
            'tasklist.project': {
              'organization._id': 'xxx'
            }
          },
          {
            'tasklist.project': {
              'organization._id': 'yyy'
            }
          }
        ]
      }
    }

    const result = parsePredicate(meta)

    expect(result).to.deep.equal({
      task: {
        $or: [
          {
            tasklist: {
              project: {
                organization: {
                  _id: 'xxx'
                }
              }
            }
          },
          {
            tasklist: {
              project: {
                organization: {
                  _id: 'yyy'
                }
              }
            }
          }
        ]
      }
    })
  })

  it('should parse compound nested predicate with operator #1', () => {
    const reg = /e/g

    const meta = {
      task: {
        $and: [
          {
            'tasklist.project': {
              'organization._id': 'xxx'
            }
          },
          {
            'tasklist.project': {
              'organization': {
                _id: {
                  $match: reg
                }
              }
            }
          }
        ]
      }
    }

    const result = parsePredicate(meta)

    expect(result).to.deep.equal({
      task: {
        $and: [
          {
            tasklist: {
              project: {
                organization: {
                  _id: 'xxx'
                }
              }
            }
          },
          {
            tasklist: {
              project: {
                organization: {
                  _id: {
                    $match: reg
                  }
                }
              }
            }
          }
        ]
      }
    })
  })

  it('should parse compound nested predicate with operator #2', () => {
    const reg = /e/g
    const now = Date.now()

    const meta = {
      task: {
        $and: [
          {
            'tasklist.project': {
              $and: [
                { 'organization._id': 'xxx' },
                {
                  organization: {
                    expireDate: {
                      $gte: now
                    }
                  }
                }
              ]
            }
          },
          {
            'tasklist.project': {
              'organization': {
                _id: {
                  $match: reg
                }
              }
            }
          }
        ]
      }
    }

    const result = parsePredicate(meta)

    expect(result).to.deep.equal({
      task: {
        $and: [
          {
            tasklist: {
              project: {
                $and: [
                  {
                    organization: {
                      _id: 'xxx'
                    }
                  },
                  {
                    organization: {
                      expireDate: {
                        $gte: now
                      }
                    }
                  }
                ]
              }
            }
          },
          {
            tasklist: {
              project: {
                organization: {
                  _id: {
                    $match: reg
                  }
                }
              }
            }
          }
        ]
      }
    })
  })
})
