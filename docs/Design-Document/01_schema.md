# ReactiveDB Design Document

## 1. Schema Design

### 1.1 Schema Metadata
Schema Metadata 是 ReactiveDB 的基础，ReactiveDB 会根据定义的 SchemaMetadata 生成数据表。SchemaMetadata 承载了

- 数据表的形状信息(字段，类型)
- 对应的数据存入数据表的过程中，数据该如何解析的信息(RDBType)
- 从这个数据表中获取数据的时候，如果获取关联数据的信息(Virtual)

这种设计的原因是: 通常 API 返回的数据，是多个数据表 `Join` 之后的结果, 如果要在前端还原这种数据与数据间的 `Join` 关系，就必须要有一个地方承载这种关系的信息，而在一般的数据表设计中，Table 与 Table 的关系(one - one or one - many) 通常是静态可确定的，所以将它作为 Schema 的`元信息`存放在 Schema Metadata 中， ReactiveDB 会使用这个信息在查询数据的时候将数据折叠成和存入时一致的结构。

### 1.2 Select Metadata
Schema Metadata 中的数据表形状信息在 ReactiveDB 初始化的时候被消费，然后 Schema Metadata 会被销毁，其中定义的`解析信息`与`关联信息`会转存到 Select Metadata 中。
除此之外 Select Metadata 还会存储与这个 table 相关联的 Virtual Metadata


### 1.3 Virtual Metadata
Virtual Metadata 存储了 Schema Metadata 中的 Virtual 信息，包括 property name ==> tablename 映射信息，Virtual Table 在取数据时 `leftOuterJoin` 的 Predicate。除此之外， Virtual Metadata 还会承载外部调用 `Database#insert` 时数据中 Virtual 字段的形状信息(Collection or Model)。
