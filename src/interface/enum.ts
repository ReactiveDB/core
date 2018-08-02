export enum RDBType {
  ARRAY_BUFFER = 100,
  BOOLEAN,
  DATE_TIME,
  INTEGER,
  NUMBER,
  OBJECT,
  STRING,
  LITERAL_ARRAY,
}

export enum Relationship {
  oneToMany = 500,
  oneToOne = 501,
  manyToMany = 502,
}

export enum DataStoreType {
  INDEXED_DB = 0,
  MEMORY = 1,
  LOCAL_STORAGE = 2,
  WEB_SQL = 3,
  OBSERVABLE_STORE = 4,
}

export enum StatementType {
  Insert = 1001,
  Update = 1002,
  Delete = 1003,
  Select = 1004,
}

export enum JoinMode {
  imlicit = 2001,
  explicit = 2002,
}

export enum LeafType {
  column = 300,
  navigator = 301,
}
