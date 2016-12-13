// lovefield nodejs polyfill
if (typeof global !== 'undefined') {
  global['self'] = global
  // shim for SinonJS
  global['location'] = Object.create(null)
}

import * as lf from 'lovefield'

// lovefield declare merge
declare module 'lovefield' {
  export interface Predicate {
    copy(): lf.Predicate
  }

  namespace query {
    export interface Select extends lf.query.Builder {
      clone(): lf.query.Select
    }
  }
}
