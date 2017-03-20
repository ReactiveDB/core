export class MockQueryBuilder {
  toSql() {
    return 'SELECT * FROM MOCK WHERE COND = FALSE'
  }

  explain() {
    return 'MOCK EXPLAIN'
  }

  exec() {
    return new Promise((resolve) => {
      resolve(0)
    })
  }

  bind() {
    return this
  }
}

export class MockInsert extends MockQueryBuilder {
  into() {
    return this
  }

  values() {
    return this
  }
}

export class MockUpdate extends MockQueryBuilder {
  private params = Object.create(null)

  where(predicate: lf.Predicate) {
    return predicate
  }

  set(key: any, val: any) {
    this.params[key.toString()] = val
    return this
  }

  valueOf() {
    return this.params
  }
}

export class MockDatabaseTable {
  constructor(
    private name: string = null
  ) {
    return new Proxy(this, {
      get: function(target, prop) {
        if (target[prop]) {
          return target[prop]
        }
        return new MockComparator(prop.toString())
      }
    })
  }

  createRow() {
    return {} as lf.Row
  }

  getName() {
    return this.name.toString() ? this.name.toString() : 'MOCKTABLE'
  }
}

export class MockComparator {
  private handler = (_: any) => null as lf.Predicate
  public and: lf.Predicate
  public or: lf.Predicate
  public eq: lf.Predicate
  public match: lf.Predicate
  public not: lf.Predicate
  public lt: lf.Predicate
  public lte: lf.Predicate
  public gt: lf.Predicate
  public gte: lf.Predicate
  public between: lf.Predicate
  public in: lf.Predicate
  public isNull: lf.Predicate

  constructor(
    private propName: string
  ) {
    this.and = this.between = this.eq =
    this.gt = this.gte = this.in =
    this.isNull = this.lt = this.lte =
    this.match = this.not = this.handler
  }

  valueOf() {
    return this.propName
  }

  toString() {
    return this.propName
  }
}

export class MockDatabase {
  update(_: MockDatabaseTable) {
    return new MockUpdate()
  }

  insertOrReplace() {
    return new MockInsert()
  }

  insert() {
    return new MockInsert()
  }

  getSchema() {
    return {
      table: () => new MockDatabaseTable()
    }
  }
}
