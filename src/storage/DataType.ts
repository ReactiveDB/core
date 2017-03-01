export enum RDBType {
  ARRAY_BUFFER,
  BOOLEAN,
  DATE_TIME,
  INTEGER,
  NUMBER,
  OBJECT,
  STRING,
  LITERAL_ARRAY
}

export enum Association {
  oneToMany = 1000,
  oneToOne,
  manyToMany
}

export enum DataStoreType {
  INDEXED_DB = 0,
  MEMORY = 1,
  LOCAL_STORAGE = 2,
  WEB_SQL = 3,
  OBSERVABLE_STORE = 4
}
