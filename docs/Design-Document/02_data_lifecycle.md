# ReactiveDB Design Document

## 2. Data Lifecycle
ReactiveDB 的职责之一就是将后端 `Join` 多个 `table` 之后的结果重新拆分并存储为原来的结构。
整个数据的流动过程其实是:

`a) Backend Database` =>

`b) Join and Group` =>

`c) Normalize and Store lovefield` =>

`d) Join and Group` =>

`e) Consumed by Views`

### 2.1 Store Progress
在数据流动的过程中，`c` 步骤就是 Data Store 的过程。

Normalize 的过程在存储数据之前，这个过程的依据是 Schema Metadata 中存储的 Virtual 信息，这些信息会指导 ReactiveDB 完成对数据的拆解。
数据拆解后会根据 Virtual 信息中的 name 找到目标 `Table` 存入数据。这些过程都是`事务性`的，不会因为数据中间过程的失败导致脏数据产生。

Store 之后的数据表结构应该和后端存储的数据表结构基本一致。


### 2.2 Data Select
在数据流动的过程中，`d` 步骤就是 Data Select 的过程，这个过程应该是和 `b` 过程基本一致。
在 ReactiveDB 中，`get` 方法对应 Select 的过程，它通过以下几个步骤从 `lovefield` 中取出数据:

1. 通过传入的 `QueryDescription` 构建 query 对象(如果为空则默认 Select all)
2. 通过传入的 `QueryDescription` 构建 Predicate
3. 通过 query predicate 与 fold 方法构建 QueryToken 作为返回值
4. 在 QueryToken 的 `values` 方法或 `changes` 方法被调用时，执行 `query.where(predicate)`
5. QueryToken query 执行的结构 `fold` 到 `QueryDescription` 定义的数据结构

### 2.3 Data Update
数据的更新是一次直接调用，与 **Store/Select/Delete** 不同的是，它的 hook 不存在 Database 内，而是由 Database 将 update 事件 Broadcast 到外部。
ReactiveDB 的 `update` 实现过程非常简单：

`QueryDescription` => `UpdateQuery` => `exec`

### 2.4 Data Delete
在删除一条数据时，后端会在数据库中删除与之相关的数据。这个过程则依赖 ReactiveDB 的使用者定义的 `delete hook`。
deleteHook 的执行过程在 delete 真正要 delete 的数据之前。

### 2.5 Data Observe
ReactiveDB 实现 Observe 依赖 lovefield 的 `lf.Database#observe` 方法。 ReactiveDB 只是将这个 observe 包装成 `Observable`。
