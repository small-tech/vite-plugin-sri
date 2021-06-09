import { readFile } from 'fs/promises'
import path from 'path'
import test from 'tape'
import { fileURLToPath } from 'url'
import fetch from 'node-fetch'
import { createHash } from 'crypto'

import sri from '../index.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

async function loadFixture(location) {
  let source;
  if (location.startsWith('http')) {
    source = await (await fetch(location)).text()
  } else {
    source = await readFile(path.join(__dirname, 'fixtures', location), 'utf8')
  }

  const hash = createHash('sha384').update(source).digest().toString('base64')

  return { source, hash }
}

async function loadLocalResources() {
  const { source: localJS, hash: localJSHash } = await loadFixture('main.js')
  const { source: localCSS, hash: localCSSHash } = await loadFixture(path.join('assets', 'style.css'))

  return { localJS, localCSS, localJSHash, localCSSHash }
}

async function loadRemoteResources() {
  const { source: remoteJS, hash: remoteJSHash } = await loadFixture('https://ar.al/chat.js')
  const { source: remoteCSS, hash: remoteCSSHash } = await loadFixture('https://ar.al/style.css')

  return { remoteJS, remoteCSS, remoteJSHash, remoteCSSHash }
}

test('basic functionality', async (t) => {

  // Setup
  const { source: indexHTML } = await loadFixture('index.html')
  const { localJS, localCSS, localJSHash, localCSSHash } = await loadLocalResources()
  const { remoteJSHash, remoteCSSHash } = await loadRemoteResources()

  const expectedLocalJSScriptTag = `<script type="module" src="/main.js" integrity="sha384-${localJSHash}"></script>`
  const expectedLocalCSSLinkTag = `<link rel="stylesheet" type="text/css" href="/assets/style.css" integrity="sha384-${localCSSHash}">`
  const expectedRemoteJSScriptTag = `<script type="module" src="https://ar.al/chat.js" integrity="sha384-${remoteJSHash}"></script>`
  const expectedRemoteCSSLinkTag = `<link rel="stylesheet" type="text/css" href="https://ar.al/style.css" integrity="sha384-${remoteCSSHash}">`

  const context = {
    bundle: {
      'assets/style.css': { source: localCSS },
      'main.js': { code: localJS }
    }
  }

  const plugin = sri()

  plugin.configResolved({
    base: '/'
  })

  t.strictEquals(plugin.name, 'vite-plugin-sri', 'Plugin name is as expected.')
  t.strictEquals(plugin.apply, 'build', 'Plugin applies to build tasks only.')
  t.strictEquals(plugin.enforce, 'post', 'Plugin is enforced to run during post stage.')

  const html = await plugin.transformIndexHtml(indexHTML, context)

  t.true(html.includes(expectedLocalCSSLinkTag), 'Transformed HTML includes expected local CSS link tag.')
  t.true(html.includes(expectedRemoteCSSLinkTag), 'Transformed HTML includes expected remote CSS link tag.')
  t.true(html.includes(expectedLocalJSScriptTag), 'Transformed HTML includes expected local JS script tag.')
  t.true(html.includes(expectedRemoteJSScriptTag), 'Transformed HTML includes expected remote JS script tag.')
})

test('base path handling', async (t) => {

  const { localJS, localCSS, localJSHash } = await loadLocalResources()

  const context = {
    bundle: {
      'assets/style.css': { source: localCSS },
      'main.js': { code: localJS }
    }
  }

  const cases = [
    { id: 'local',    base: '/local/',              src: `/local/main.js`,              integrity: `sha384-${localJSHash}` },
    { id: 'empty',    base: '',                     src: `main.js`,                     integrity: `sha384-${localJSHash}` },
    { id: 'http',     base: 'https://example.com/', src: `https://example.com/main.js`, integrity: `sha384-${localJSHash}` },
    { id: 'external', base: '/',                    src: `../lib/nonexistent.js`,       integrity: null },
  ]

  for (const testCase of cases) {
    const plugin = sri()

    plugin.configResolved({
      base: testCase.base
    })

    const input = `<script src="${testCase.src}"></script>`
    const expectedTag = testCase.integrity ? `<script src="${testCase.src}" integrity="${testCase.integrity}"></script>` : input;
    const output = await plugin.transformIndexHtml(input, context)

    t.true(output.includes(expectedTag), `Correctly handles base path test case '${testCase.id}'.`)
  }
})
