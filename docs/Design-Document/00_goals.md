# ReactiveDB Design Document

## 0. Goals
ReactiveDB 主要目标是提供可声明式调用的接口来操作底层的关系型数据库，并返回响应式的结果。

## 0.1 Motivation
Lovefield 提供了命令式的接口来操作关系型的数据，但这些接口是不够抽象且不够直观的。ReactiveDB 最初被用来封装 Lovefield 中的常用接口，比如建数据表，更新数据，observe 数据等。在这个实践过程中我们发现我们封装出来的功能与传统数据库中的 ORM 角色非常类似，于是 ReactiveDB 被重新设计成一个类 ORM 的 Database Driven。将所底层数据库提供的接口转化成 Reactive 风格，并且能以声明式调用，降低使用数据库的难度。

## 0.2 Database
ReactiveDB 使用 Lovefield 是经过多方面考察的结果。

  1. Lovefield 支持最新的 IndexedDB
  2. Lovefield 有 Google 的复杂产品实践背书(Inbox)
  3. Lovefield 支持事务，可以极大的程度上避免脏数据的产生
  4. 作者响应问题迅速(通常 issue 在 5 分钟内就有回应)

而且 Lovefield 提供的 `query` 级别的 **observe** 非常适合被封装成 Reactive 风格的接口。而市面上其它的 `js-sql` Database Driven 都无法提供这种粒度的 **observe**。

## 0.3 Components of ReactiveDB
ReactiveDB 由下面几个部分组成:
- Database (src/storage/Database.ts)
  - Schema Management
  - Lovefield Bridge
    - CRUD Method
    - QueryToken (src/storage/QueryToken.ts)
      - SelectMeta (src/storage/SelectMeta.ts)
- Query Engine
  - PredicateProvider (src/storage/PredicateProvider.ts)
  - Type Definition (src/storage/DataType.ts)

## 0.4 Design Principles
- 不做 hack，不侵入任何使用的库的功能 (Lovefield & RxJS)
- 职责单一，所有方法都有明确的职责和语义
- 初始化前的静态方法全部是同步的，初始化后的方法都是异步的
- Query 的写法与社区主流的写法保持风格的一致(主要参考 Sequelize)，关键的术语比如 and, or, lt, gt 不使用其它词代替。

## 0.5 API Design
Lovefield 的 API 设计宗旨有一条就是易读性。其中有一个例子很有代表性:
> Microsoft 的 LINQ 实现的接口类似:
  ```ts
  db.from(job)
    .where(function(x) { return x.id < 200; })
    .select();
  ```
> 而这种封装方式破坏了 SQL 语言最大的优势 "易读性"，相对 LINQ，lovefield 提供的 API 是这种风格:
  ```ts
  db.select()
    .from(job)
    .where(job.id.lt(200))
    .exec();
  ```
> 这种风格的封装保持了 SQL 接近自然语言且容易读懂的优势。

在 ReactiveDB 的 API 实现过程中，极力避免了以破坏语义为代价去实现一个 API。
比如 `Database#get` 方法的第二个参数，`selectQl` 是这种形式的:

```ts
{
  fields: [
    '_id', 'name', 'ownerId',
    {
      owner: ['_id', 'name', 'avatarUrl']
    }
  ],
  where: {
    '$or': {
      dueDate: {
        '$gt': new Date().valueOf()
      },
      created: {
        '$lt': new Date(2015, 1, 1).valueOf()
      }
    }
  }
}
```

其中 fields 字段的定义方式借鉴了 `[GraphQL](http://facebook.github.io/graphql/)` 的 QL 定义，而 where 的定义借鉴了 [Sequelize](http://docs.sequelizejs.com/en/v3/docs/querying/#where) 的 定义。
