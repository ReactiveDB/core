## Database

### Constructor

```ts
constructor(
  storeType: DataStoreType = DataStoreType.MEMORY,
  enableInspector: boolean = false,
  name = 'ReactiveDB',
  version = 1
)
```
构造函数

- ```Enum: DataStoreType```

<table>
  <tr>
    <td>Value</td>
    <td>Index</td>
  </tr>
  <tr>
    <td>INDEXED_DB</td>
    <td>0</td>
  </tr>
  <tr>
    <td>MEMORY</td>
    <td>1</td>
  </tr>
  <tr>
    <td>LOCAL_STORAGE</td>
    <td>2</td>
  </tr>
  <tr>
    <td>WEB_SQL</td>
    <td>3</td>
  </tr>
  <tr>
    <td>OBSERVABLE_STORE</td>
    <td>4</td>
  </tr>
</table>

*example:*

```ts
// Database.ts
improt { Database, DataStoreType } from 'reactivedb'

export default new Database(DataStoreType)
```

### Database.prototype.defineSchema

```ts
Database.defineSchema(tableName: string, schemaDef: SchemaDef): Database
```
定义库中表的数据结构 / 形态

- ```Method: Database.defineSchema(tableName: string, schemaDef: SchemaDef)```

<table>
  <tr>
    <td>Parameter</td>
    <td>Type</td>
    <td>Required</td>
    <td>Description</td>
  </tr>
  <tr>
    <td>tableName</td>
    <td>String</td>
    <td>required</td>
    <td>数据表的名字</td>
  </tr>
  <tr>
    <td>schemaDef</td>
    <td>SchemaDef</td>
    <td>required</td>
    <td>Schema Defination的描述信息</td>
  </tr>
</table>

- ```Interface: SchemaDef```

<table>
  <tr>
    <td>Parameter</td>
    <td>Type</td>
    <td>Required</td>
    <td>Description</td>
  </tr>
  <tr>
    <td>index</td>
    <td>String</td>
    <td>required</td>
    <td>对象索引</td>
  </tr>
</table>

- ```Interface: SchemaMetadata```

<table>
  <tr>
    <td>Parameter</td>
    <td>Type</td>
    <td>Required</td>
    <td>Description</td>
  </tr>
  <tr>
    <td>type</td>
    <td>RDBType</td>
    <td>required</td>
    <td>存储类型，只能为 RDBType 枚举值</td>
  </tr>
  <tr>
    <td>primaryKey</td>
    <td>Boolean</td>
    <td>optional</td>
    <td>该字段是否设为主键</td>
  </tr>
  <tr>
    <td>index</td>
    <td>Boolean</td>
    <td>optional</td>
    <td>该字段是否设为索引</td>
  </tr>
  <tr>
    <td>unique</td>
    <td>Boolean</td>
    <td>optional</td>
    <td>该字段是否唯一</td>
  </tr>
  <tr>
    <td>virtual</td>
    <td>VirtualDef</td>
    <td>optional</td>
    <td>该字段是否关联为其他表</td>
  </tr>
</table>

- ```Enum: RDBType```

<table>
  <tr>
    <td>Value</td>
    <td>Index</td>
  </tr>
  <tr>
    <td>ARRAY_BUFFER</td>
    <td>0</td>
  </tr>
  <tr>
    <td>BOOLEAN</td>
    <td>1</td>
  </tr>
  <tr>
    <td>DATE_TIME</td>
    <td>2</td>
  </tr>
  <tr>
    <td>INTEGER</td>
    <td>3</td>
  </tr>
  <tr>
    <td>NUMBER</td>
    <td>4</td>
  </tr>
  <tr>
    <td>OBJECT</td>
    <td>5</td>
  </tr>
  <tr>
    <td>STRING</td>
    <td>6</td>
  </tr>
  <tr>
    <td>LITERAL_ARRAY</td>
    <td>7</td>
  </tr>
</table>

- ```Interface: VirtualDef```

<table>
  <tr>
    <td>Parameter</td>
    <td>Type</td>
    <td>Required</td>
    <td>Description</td>
  </tr>
  <tr>
    <td>name</td>
    <td>String</td>
    <td>required</td>
    <td>关联表的名字</td>
  </tr>
  <tr>
    <td>where</td>
    <td>Function</td>
    <td>required</td>
    <td>关联数据的约束条件</td>
  </tr>
</table>

[example](https://github.com/teambition/ReactiveDB/blob/master/example/rdb/defineSchema.ts)

### Database.defineHook
```ts
Database.defineHook(tableName: string, hookDef: HookDef): HookDef
```
对已有的表定义hook, hook将会在数据插入或删除时被执行, 可以用于保证单个实体上多个关联数据的一致性.

- ```Method: Database.defineHook(tableName: string, hookDef: HookDef)```

<table>
  <tr>
    <td>Parameter</td>
    <td>Type</td>
    <td>Required</td>
    <td>Description</td>
  </tr>
  <tr>
    <td>tableName</td>
    <td>String</td>
    <td>required</td>
    <td>数据表的名字</td>
  </tr>
  <tr>
    <td>hookDef</td>
    <td>HookDef</td>
    <td>required</td>
    <td>hook的定义描述</td>
  </tr>
</table>

- ```Interface: HookDef```

<table>
  <tr>
    <td>Parameter</td>
    <td>Type</td>
    <td>Required</td>
    <td>Description</td>
  </tr>
  <tr>
    <td>insert</td>
    <td>Function</td>
    <td>optional</td>
    <td>insert Function 数据插入时的 hook Function(trigger)，执行的时候 Database 会将 lovefield Database 实例与数据实体传入，必须返回一个 Promise</td>
  </tr>
  <tr>
    <td>destory</td>
    <td>Function</td>
    <td>optional</td>
    <td>数据销毁时的 hook Function(trigger)，使用方法同insert</td>
  </tr>
</table>

*example:*

```ts
Database.defineHook('Demo', {
  destroy: (db, entity) => {
    // db docs: https://github.com/google/lovefield/blob/master/docs/spec/04_query.md
    const basicTable = db.getSchema().table('Demo')
    return db.delete()
      .from(basicTable)
      .where(basicTable['_id'].in(entity.basicIds))
  }
})
```

### Database.prototype.connect

```ts
  database.connect(): void
```
连接数据库，在 `defineSchema` 与 `defineHook` 完成之后调用，如果上述两个接口在 `connect` 之后依然被调用，则会抛出一个异常。
只有在 `connect` 之后才能调用下面的 API。

### Database.prototype.get
```ts
  database.get<T>(tableName: string, clause: QueryDescription = {}): QueryToken<T>
```
对指定的表进行查询操作.

- ```Method: database.get(tableName: string, clause: QueryDescription)```

<table>
  <tr>
    <td>Parameter</td>
    <td>Type</td>
    <td>Required</td>
    <td>Description</td>
  </tr>
  <tr>
    <td>tableName</td>
    <td>String</td>
    <td>required</td>
    <td>指定要执行<code>查询</code>操作的数据表的名字</td>
  </tr>
  <tr>
    <td>clause</td>
    <td><a href="./QueryDescription.md">QueryDescription</a></td>
    <td>required</td>
    <td>指定用于<code>查询</code>操作的描述信息</td>
  </tr>
</table>

- ```Interface: QueryDescription```

继承自ClauseDescription接口

<table>
  <tr>
    <td>Parameter</td>
    <td>Type</td>
    <td>Required</td>
    <td>Description</td>
  </tr>
  <tr>
    <td>fields</td>
    <td>FieldsValue[]</td>
    <td>optional</td>
    <td>指定将要执行<code>查询</code>操作的时筛选的字段</td>
  </tr>
  <tr>
    <td>where</td>
    <td>Function</td>
    <td>optional</td>
    <td>指定用于<code>查询</code>操作时的匹配条件</td>
  </tr>
</table>

- ```type: FieldsValue```
```
  type FieldsValue = string | { [index: string]: string[] }
```

- return [QueryToken](./QueryToken.md)

*example:*

```ts
database.get('Task', {
  where: {
    dueDate: {
      $and: {
        $gt: moment().add(1, 'day').startOf('day').valueOf(),
        $lt: moment().add(6, 'day').endOf('day').valueOf()
      }
    },
    involveMembers: {
      $has: 'xxxxuserId'
    }
  }
})
```

### Database.prototype.insert
```ts
  database.insert(tableName: string, data: T | T[]): Observable<T> | Observable<T[]>
```
对指定的数据表进行插入操作. 若table上存在insert hook, 则先执行hook再进行插入操作。

- ```Method: database.insert(tableName: string, data: T | T[])```

<table>
  <tr>
    <td>Parameter</td>
    <td>Type</td>
    <td>Required</td>
    <td>Description</td>
  </tr>
  <tr>
    <td>tableName</td>
    <td>String</td>
    <td>required</td>
    <td>指定将要执行<code>插入</code>操作的数据表的名字</td>
  </tr>
  <tr>
    <td>data</td>
    <td>T | T[]</td>
    <td>required</td>
    <td>存储的数据实体</td>
  </tr>
</table>

## Database.prototype.update
```ts
  database.update(tableName: string, clause: ClauseDescription, patch): void
```
对表中的指定的数据进行更新操作.

- ```Method: database.update(tableName: string, clause: ClauseDescription, patch: any)```

<table>
  <tr>
    <td>Parameter</td>
    <td>Type</td>
    <td>Required</td>
    <td>Description</td>
  </tr>
  <tr>
    <td>tableName</td>
    <td>String</td>
    <td>required</td>
    <td>指定将要执行<code>更新</code>操作的数据表的名字</td>
  </tr>
  <tr>
    <td>clause</td>
    <td>ClauseDescription</td>
    <td>required</td>
    <td>指定将要执行<code>更新</code>操作的实体匹配条件</td>
  </tr>
  <tr>
    <td>patch</td>
    <td>Object</td>
    <td>required</td>
    <td>更新的实体</td>
  </tr>
</table>

- ```Interface: ClauseDescription```

<table>
  <tr>
    <td>Parameter</td>
    <td>Type</td>
    <td>Required</td>
    <td>Description</td>
  </tr>
  <tr>
    <td>where</td>
    <td>Function</td>
    <td>optional</td>
    <td>指定用于<code>查询</code>操作时的匹配条件</td>
  </tr>
</table>

## Database.prototype.delete
```ts
  database.delete(tableName: string, clause: ClauseDescription): void
```
对表中符合条件的数据进行删除操作. 若表中存在delete hook, 则先执行hook再进行删除.

- ```Method: database.delete(tableName: string, clause: ClauseDescription)```

<table>
  <tr>
    <td>Parameter</td>
    <td>Type</td>
    <td>Required</td>
    <td>Description</td>
  </tr>
  <tr>
    <td>tableName</td>
    <td>String</td>
    <td>required</td>
    <td>指定将要执行<code>删除</code>操作的数据表的名字</td>
  </tr>
  <tr>
    <td>clause</td>
    <td>ClauseDescription</td>
    <td>required</td>
    <td>指定用于执行<code>删除</code>操作的匹配条件</td>
  </tr>
</table>

## Database.prototype.dispose()
```ts
  database.dispose()
```
重置Database, 清空所有数据.

- ```Method: database.dispose()```

<table>
  <tr>
    <td>Parameter</td>
    <td>Type</td>
    <td>Required</td>
    <td>Description</td>
  </tr>
  <tr>
    <td colspan='4'>No parameters</td>
  </tr>
</table>

## Database.prototype.upsert
```ts
upsert<T>(tableName: string, raw: T | T[]): Observable<ExecutorResult>

interface ExecutorResult {
  result: boolean
  insert: number
  delete: number
  update: number
  select: number
}
```

<table>
  <tr>
    <td>Parameter</td>
    <td>Type</td>
    <td>Required</td>
    <td>Description</td>
  </tr>
  <tr>
    <td>tableName</td>
    <td>String</td>
    <td>required</td>
    <td>指定将要执行<code>upsert</code>操作的数据表的名字</td>
  </tr>
  <tr>
    <td>raw</td>
    <td>T | T[]</td>
    <td>required</td>
    <td>执行<code>upsert</code>操作的数据</td>
  </tr>
</table>

- return `ExecutorResult`

<table>
  <tr>
    <td>fields</td>
    <td>Type</td>
    <td>Description</td>
  </tr>
  <tr>
    <td>result</td>
    <td>Boolean</td>
    <td>执行是否成功</td>
  </tr>
  <tr>
    <td>insert</td>
    <td>number</td>
    <td>执行<code>insert</code>的数据条数</td>
  </tr>
  <tr>
    <td>delete</td>
    <td>number</td>
    <td>执行<code>delete</code>的数据条数</td>
  </tr>
  <tr>
    <td>update</td>
    <td>number</td>
    <td>执行<code>update</code>的数据条数</td>
  </tr>
  <tr>
    <td>select</td>
    <td>number</td>
    <td>执行<code>select</code>的数据条数</td>
  </tr>
</table>
