import { readFileSync } from 'fs'

export default {
  input: 'index.js',
  output: {
    file: 'index.cjs',
    format: 'cjs',
    exports: 'default',
    preferConst: true,

    // https://nodejs.org/api/esm.html#esm_commonjs_namespaces
    interop: 'default',

    // Extract license header
    banner: () => readFileSync('index.js', 'utf8').match(/^\/{4,}[^]+?\/{4,}/)[0]
  },
  external: () => true
}
