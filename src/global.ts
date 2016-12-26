// lovefield nodejs polyfill
if (typeof global !== 'undefined') {
  global['self'] = global
  // shim for SinonJS
  global['location'] = Object.create(null)
}

import * as lf from 'lovefield'

// lovefield declaration merging
declare module 'lovefield' {
  namespace query {
    export interface Select extends lf.query.Builder {
      clone(): lf.query.Select
    }
  }
}
