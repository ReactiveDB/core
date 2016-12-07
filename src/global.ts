import * as lf from 'lovefield'
if (typeof global !== 'undefined') {
  global['self'] = global
}

// lovefield declare merge
declare module 'lovefield' {
  export interface Predicate {
    copy(): lf.Predicate
  }

  namespace query {
    export interface Select extends lf.query.Builder {
      clone(): Select
    }
  }
}
