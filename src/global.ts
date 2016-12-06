declare namespace NodeJS {
  export interface Global {
    self: NodeJS.Global
  }
}

if (typeof global !== 'undefined') {
  global.self = global
}
