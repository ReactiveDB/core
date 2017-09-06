## Query

```ts
interface Query<T> extends Clause<T> {
  fields?: Field[]
  limit?: number
  skip?: number
  orderBy?: OrderDescription[]
}

interface Clause<T> {
  where?: PredicateDescription<T>
}

interface OrderDescription {
  fieldName: string
  orderBy?: 'DESC' | 'ASC'
}
```

### Description
<table>
  <tr>
    <td>字段名</td>
    <td>描述</td>
  </tr>
  <tr>
    <td>fields</td>
    <td>查询哪些字段，数组，合法值为字符串或字面量对象, 详细定义: <a href='#fields'>fields</a></td>
  </tr>
  <tr>
    <td>limit</td>
    <td>最多查询多少条记录，整数</td>
  </tr>
  <tr>
    <td>skip</td>
    <td>跳过多少条记录，整数</td>
  </tr>
  <tr>
    <td>orderBy</td>
    <td>排序，数组，合法值是 <a href='#OrderDescription'>OrderDescription</a></td>
  </tr>
  <tr>
    <td>where</td>
    <td>查询条件，一个字面量对象。合法值是 <a href='#PredicateDescription'>PredicateDescription</a></td>
  </tr>
</table>

### *example*

```ts
{
  fields: ['_id', 'name', 'content', {
    project: ['_id', 'name'],
    executor: ['_id', 'name', 'avatarUrl']
  }],
  limit: 20,
  skip: 40,
  orderBy: [
    {
      fieldName: 'priority',
      orderBy: 'ASC'
    },
    {
      fieldName: 'dueDate',
      orderBy: 'DESC'
    }
  ],
  where: {
    dueDate: {
      $lte: moment().add(7, 'day').startOf('day').valueOf()
    },
    startDate: {
      $gte: moment().add(1, 'day').endOf('day').valueOf()
    },
    involveMembers: {
      $has: 'xxxuserId'
    }
  }
}
```

<h2 id='fields'>Fields</h2>

### Description

fields 是一个数组，其中的值可为 string | Field 它的形状为:

```ts
type Field<T> = [...keyof T[], VirtualField<T>]

type Field<T> = {
  [key in keyof T]: [...keyof (key in keyof T), Field<T[key]>]
}
```
> 注，源码里面并没有 VirtualField 这个类型，这里只是为了描述它的形状而用 `VirtualField` 来表达

其中，可以包含一个 `VirtualField` 类型的元素，用来查询`关联表`的数据，它必须位于数组的最后，不然会抛出一个类型错误。
`VirtualField` 的每一个字段的 key 都对应着查询的数据表上对应的 schema 上定义了 `virtual` 的字段，对应的值则是对应的 `Table` 的形状。

### example:

```ts
// query
database.get('Task', {
  fields: ['_id', 'content', {
    project: ['_id', 'name', {
      organization: ['_id']
    }]
  }]
})

// schema definations
database.defineSchema('Task', {
  _id: {
    type: RDBType.string,
    primaryKey: true
  },
  project: {
    type: Relationship.oneToOne,
    virtual: {
      name: 'Project',
      where: ref => {
        return {
          _projectId: ref._id
        }
      }
    }
  },
})

database.defineSchema('Project', {
  _id: {
    type: RDBType.string,
    primaryKey: true
  },
  organization: {
    type: Relationship.oneToOne,
    virtual: {
      name: 'Organization',
      where: (organizationTable) => ({
         _organizationId: organizationTable._id
      })
    }
  }
})
```

<h2 id="OrderDescription">OrderDescription</h2>


```ts
interface OrderDescription {
  fieldName: string
  orderBy?: 'DESC' | 'ASC'
}
```

### Description
<table>
  <tr>
    <td>字段名</td>
    <td>描述</td>
  </tr>
  <tr>
    <td>fieldName</td>
    <td>排序的字段</td>
  </tr>
  <tr>
    <td>orderBy</td>
    <td>排序方法。ASC 升序，DESC 降序</td>
  </tr>
</table>

### *example*:

```ts
{
  fieldName: 'priority',
  orderBy: 'ASC'
}
```

<h2 id="PredicateDescription">PredicateDescription</h2>

```ts
type ValueLiteral = string | number | boolean
type VaildEqType = ValueLiteral | lf.schema.Column | lf.Binder

type PredicateDescription<T> = {
  [P in keyof T & PredicateMeta<T>]?: Partial<PredicateMeta<T>> | ValueLiteral | PredicateDescription<T[P]>
}

interface PredicateMeta<T> {
  $ne: ValueLiteral
  $eq: ValueLiteral
  $and: PredicateDescription<T>
  $or: PredicateDescription<T> | PredicateDescription<T>[]
  $not: PredicateDescription<T>
  $lt: ValueLiteral
  $lte: ValueLiteral
  $gt: ValueLiteral
  $gte: ValueLiteral
  $match: RegExp
  $notMatch: RegExp
  $has: ValueLiteral
  $between: [ number, number ]
  $in: ValueLiteral[]
  $isNull: boolean
  $isNotNull: boolean
}
```

### Description
字面量对象，它的 key 为 PredicateMeta 的 key 时受到 PredicateMeta 接口的约束。
比如
```ts
{
  // 只能为正则
  $match: RegExp
}
```
当它的 key 为其它值时，它的值可能为新的 `PredicateDescription`, `PredicateMeta<T>`, `ValueLiteral`, 它们可以一层层的递归的定义。

第一层定义的 key 默认用 `$and` 连接，比如:
```ts
{
  dueDate: {
    $lte: moment().add(7, 'day').endOf('day').valueOf()
  },
  startDate: {
    $gte: moment().add(1, 'day').startOf('day').valueOf()
  }
}
```
默认表示 `dueDate` 小于或等于七天后 ***并且*** `startDate` 大于或等于一天后

### *example:*
```ts
{
  $or: [
    {
      dueDate: {
        $and: [
          { $lte: moment().add(7, 'day').startOf('day').valueOf() },
          { $gte: moment().add(1, 'day').endtOf('day').valueOf() }
        ]
      },
      startDate: {
        $and: [
          { $lte: moment().add(7, 'day').startOf('day').valueOf() },
          { $gte: moment().add(1, 'day').endtOf('day').valueOf() }
        ]
      },
    }
  ],
  involveMembers: {
    $has: 'xxxuserId'
  }
}
```