[![CircleCI](https://circleci.com/gh/Reactive-DB/ReactiveDB.svg?style=svg)](https://circleci.com/gh/Reactive-DB/ReactiveDB)
[![Coverage Status](https://coveralls.io/repos/github/Reactive-DB/ReactiveDB/badge.svg?branch=master)](https://coveralls.io/github/Reactive-DB/ReactiveDB?branch=master)
[![Dependency Status](https://david-dm.org/Reactive-DB/ReactiveDB.svg)](https://david-dm.org/Reactive-DB/ReactiveDB)
[![devDependencies Status](https://david-dm.org/Reactive-DB/ReactiveDB/dev-status.svg)](https://david-dm.org/Reactive-DB/ReactiveDB?type=dev)
[![Greenkeeper badge](https://badges.greenkeeper.io/Reactive-DB/ReactiveDB.svg)](https://greenkeeper.io/)
# ReactiveDB

一个 Reactive 风格的前端 ORM。基于 [Lovefield](https://github.com/google/lovefield) 与 [RxJS](https://github.com/ReactiveX/rxjs)。

Fork from [teambition/ReactiveDB](https://github.com/teambition/reactivedb)

## Features
- 响应式查询

  支持以 Observable 的形式返回响应式数据
- 数据一致性

  所有的执行过程都是`事务性`的，在遇到环境异常时(indexDB 异常，浏览器限制，隐私模式导致的功能性缺失等) 也不会产生脏数据。

- 数据持久化

  大量的数据场景下，极端如单页应用不间断运行几个月的情况下，不会造成内存占用量过多。所有的数据都可以持久化在本地存储而非内存中，~~并支持丰富的数据换页配置~~[WIP]。

- debug tools

  [Lovefield debug tool for Chrome](https://chrome.google.com/webstore/detail/lovefield-db-inspector/pcolnppcajocbhmgmljobphopnchkcig)


## Documents
- [Design Document](./docs/Design-Document)
- [API Description](./docs/API-description)


## Scenarios
> 在单页实时性应用的场景下，抽象出在前端维护数据以及其关联的数据的变更的逻辑

考虑下面的场景，在一个单页前端应用中，需要展示 A，B, C, D 四个列表:

其中列表 A 展示所有 ownerId 为 `user1` 的 Item :

```json
[
  {
    "_id": 1,
    "name": "item 1",
    "ownerId": "user1",
    "creatorId": "user2",
    "created": "2016-01-31T16:00:00.000Z",
    "owner": {
      "_id": "user1",
      "name": "user1 name"
    },
    "creator": {
      "_id": "user2",
      "name": "user2 name"
    }
  },
  {
    "_id": 3,
    "name": "item 1",
    "ownerId": "user1",
    "creatorId": "user3",
    "created": "2016-05-03T16:00:00.000Z",
    "owner": {
      "_id": "user1",
      "name": "user1 name"
    },
    "creator": {
      "_id": "user3",
      "name": "user3 name"
    }
  }
  ...
]
```

列表 B 展示所有 creatorId 为 `user2` 的 Item:

```json
[
  {
    "_id": 1,
    "name": "item 1",
    "ownerId": "user1",
    "creatorId": "user2",
    "created": "2016-01-31T16:00:00.000Z",
    "owner": {
      "_id": "user1",
      "name": "user1 name"
    },
    "creator": {
      "_id": "user2",
      "name": "user2 name"
    }
  },
  {
    "_id": 2,
    "name": "item 1",
    "ownerId": "user2",
    "creatorId": "user3",
    "created": "2016-04-20T16:00:00.000Z",
    "owner": {
      "_id": "user2",
      "name": "user2 name"
    },
    "creator": {
      "_id": "user3",
      "name": "user3 name"
    }
  }
  ...
]
```

列表 C 展示所有 `created` 时间为 `2016年3月1日` 以后的 Item:

```json
[
  {
    "_id": 2,
    "name": "item 1",
    "ownerId": "user2",
    "creatorId": "user3",
    "created": "2016-04-20T16:00:00.000Z",
    "owner": {
      "_id": "user2",
      "name": "user2 name"
    },
    "creator": {
      "_id": "user3",
      "name": "user3 name"
    }
  },
  {
    "_id": 3,
    "name": "item 1",
    "ownerId": "user1",
    "creatorId": "user3",
    "created": "2016-05-03T16:00:00.000Z",
    "owner": {
      "_id": "user1",
      "name": "user1 name"
    },
    "creator": {
      "_id": "user3",
      "name": "user3 name"
    }
  }
]
```

列表 D 展示所有的用户信息:
```json
[
  {
    "_id": "user1",
    "name": "user1 name",
    "avatarUrl": "user1 avatarUrl",
    "birthday": "user1 birthday"
  },
  {
    "_id": "user2",
    "name": "user2 name",
    "avatarUrl": "user2 avatarUrl",
    "birthday": "user2 birthday"
  },
  {
    "_id": "user3",
    "name": "user3 name",
    "avatarUrl": "user3 avatarUrl",
    "birthday": "user3 birthday"
  }
]
```


这四个列表的数据分别从四个 API 获取。在大多数单页应用的架构中，数据层会缓存这几个接口的数据，避免重复请求。而在实时性的单页应用中，这些数据的更新通常需要通过 `WebSocket` 等手段进行更新。根据缓存策略的不同（单例存储/同一 ID 存储多份数据），则有不同的更新方式。但这个过程一般是 *业务化且难以抽象* 的。


比如单一引用存储数据时, 上面场景中列举到的数据只会存储为:

```
{
  item1, item2, item3,
  user1, user2, user3
}
```

在这种缓存策略下，一个数据变更后，将变更后的结果通知到所属的集合是一件非常麻烦的事情。
假设现在我们的应用收到一条 socket 消息:

```json
{
  "change:item1": {
    "ownerId": "user3"
  }
}
```

按照业务需求我们应该将 `item1` 从 `ListA` 中移除。在这种缓存策略中，如果使用的 `pub/sub` 的模型进行通知(Backbone 之类)，则会导致数据层外的代码不得不进行大量的计算，不停的 `filter` 一个变更是否满足某个列表的需求。这种重复的过程是非常难以维护，业务化，且难以抽象的。
而按照 `ReactiveDB` 的设计理念，所有的数据都有可选的响应模式，即任何与之相关的变动都会让数据`自行`更新为最新的值:

伪代码如下:

```ts
/**
 * @param tableName
 * @param queryOptions
 * @return QueryToken<T>
 **/
database.get<ItemSchema>('Item', {
  where: {
    ownerId: 'user1'
  },
  fields: [
    '_id', 'name', 'ownerId',
    {
      owner: ['_id', 'name']
    }
  ]
})
  .changes()
  .subscribe(items => {
    console.log(items)
  })
```

使用 ReactiveDB 的情况下，无论是 `Item` 本身的变更还是与之关联的 `User` 变更，都会产生新的 items 值。
更复杂的比如 `ListC`:

```ts
/**
 * @param tableName
 * @param queryOptions
 * @return QueryToken<T>
 **/
database.get<ItemSchema>('Item', {
  where: {
    created: {
      // $gte means great than and equal
      // 更多操作符参见详细的使用文档
      '$gte': new Date(2016, 3, 1).valueOf()
    }
  },
  fields: [
    '_id', 'name', 'ownerId',
    {
      owner: ['_id', 'name']
    }
  ]
})
  .changes()
  .subscribe(items => {
    console.log(items)
  })
```
