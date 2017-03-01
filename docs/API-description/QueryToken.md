# QueryToken
## Instance Method
实例方法
```ts
  const queryToken = database.get(...args)
```
## QueryToken.prototype.values()
```ts
  queryToken<T>.values(): Observable<T[]>
```
对已定义的query条件做单次求值操作. (complete immediately stream)

- ```Method: queryToken.values()```

## QueryToken.prototype.changes()
```ts
  queryToken<T>.changes(): Observable<T[]>
```
对已定义的query条件做持续求值操作, 每当监听的query匹配的集合数据发生变化, 数据都将从该接口被推送出来. (live stream)

## QueryToken.prototype.concat(...tokens)
```ts
  queryToken<T>.concat(...tokens: QueryToken[]): QueryToken
```
对已有的单个或多个QueryToken进行合并操作。在 ReactiveDB 内部会合并这些 `QueryToken` 的 `query`，并且停止被 `concat` query 的 `observe`。具体对应的场景是数据分页。
使用 `concat` 连接的所有 `QueryToken` 需要满足以下要求:

1. 它们的 `predicate` 与 `select` 都必须完全相等

2. 它们的查询的数据必须连起来是一块连续的区域，比如:
    ```ts
    // valid
    new QueryToken(limit = 20, skip = 0)
      .concat(
        new QueryToken(limit = 20, skip = 20),
        new QueryToken(limit = 20, skip = 40),
        new QueryToken(limit = 20, skip = 60)
      )

    // valid
    new QueryToken(limit = 10, skip = 0)
      .concat(
        new QueryToken(limit = 20, skip = 10),
        new QueryToken(limit = 10, skip = 30),
        new QueryToken(limit = 20, skip = 40)
      )

    // invalid
    new QueryToken(limit = 11, skip = 0)
      .concat(
        new QueryToken(limit = 20, skip = 10)
        ...
      )
    ```


- ```Method: queryToken.concat(...tokens: QueryToken[]) ```

<table>
  <tr>
    <td>Parameter</td>
    <td>Type</td>
    <td>Required</td>
    <td>Description</td>
  </tr>
  <tr>
    <td>token</td>
    <td>QueryToken</td>
    <td>required</td>
    <td>QueryToken实例</td>
  </tr>
  <tr>
    <td colspan='4'>...</td>
  </tr>
</table>

***使用 concat 可以显著减少资源的消耗，在一个长分页列表中始终保持只有一个 query 被 observe***

## QueryToken.prototype.combine(...tokens)
```ts
  queryToken<T>.combine(...tokens: QueryToken[]): QueryToken
```
对已有的单个或多个 QueryToken 进行合并操作。
如果调用新的 QueryToken 的 `change` 方法, 这些旧的 QueryToken 并不会被 `unobserve`，而是被 `combineLatest` 到一起，在每一个 `QueryToken#change` 被触发时，被 combine 的结果 QueryToken 都会重新发射一个新的重新计算后的值。

***相对于 concat，combine 不会减少资源的消耗，它只是一个 RxJS 多种接口的语法糖***

- ```Method: queryToken.combine(...tokens: QueryToken[]) ```

<table>
  <tr>
    <td>Parameter</td>
    <td>Type</td>
    <td>Required</td>
    <td>Description</td>
  </tr>
  <tr>
    <td>token</td>
    <td>QueryToken</td>
    <td>required</td>
    <td>QueryToken实例</td>
  </tr>
  <tr>
    <td colspan='4'>...</td>
  </tr>
</table>
