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
