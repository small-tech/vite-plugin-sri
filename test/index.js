import fs from 'fs'
import path from 'path'
import test from 'tape'
import { fileURLToPath } from 'url'
import fetch from 'node-fetch'
import { createHash } from 'crypto'

import sri from '../index.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

test('basic functionality', async (t) => {

  // Setup
  const fixtures = path.join(__dirname, 'fixtures')

  const indexHTML = fs.readFileSync(path.join(fixtures, 'index.html'))
  const localJS = fs.readFileSync(path.join(fixtures, 'main.js'))
  const localCSS = fs.readFileSync(path.join(fixtures, 'assets', 'style.css'))
  const remoteJS = await (await fetch('https://ar.al/chat.js')).buffer()
  const remoteCSS = await (await fetch('https://ar.al/style.css')).buffer()

  const localJSHash = createHash('sha384').update(localJS).digest().toString('base64')
  const localCSSHash = createHash('sha384').update(localCSS).digest().toString('base64')
  const remoteJSHash = createHash('sha384').update(remoteJS).digest().toString('base64')
  const remoteCSSHash = createHash('sha384').update(remoteCSS).digest().toString('base64')

  const expectedLocalCSSLinkTag = `<link rel="stylesheet" type="text/css" href="/assets/style.css" integrity="sha384-${localCSSHash}">`
  const expectedRemoteCSSLinkTag = `<link rel="stylesheet" type="text/css" href="https://ar.al/style.css" integrity="sha384-${remoteCSSHash}">`
  const expectedLocalJSScriptTag = `<script type="module" src="/main.js" integrity="sha384-${localJSHash}"></script>`
  const expectedRemoteJSScriptTag = `<script type="module" src="https://ar.al/chat.js" integrity="sha384-${remoteJSHash}"></script>`

  const context = {
    bundle: {
      'assets/style.css': { source: localCSS },
      'main.js': { code: localJS }
    }
  }

  const plugin = sri()

  t.strictEquals(plugin.name, 'vite-plugin-sri', 'Plugin name is as expected.')
  t.strictEquals(plugin.apply, 'build', 'Plugin applies to build tasks only.')
  t.strictEquals(plugin.enforce, 'post', 'Plugin is enforced to run during post stage.')

  const html = await plugin.transformIndexHtml(indexHTML, context)

  t.true(html.includes(expectedLocalCSSLinkTag), 'Transformed HTML includes expected local CSS link tag.')
  t.true(html.includes(expectedRemoteCSSLinkTag), 'Transformed HTML includes expected remote CSS link tag.')
  t.true(html.includes(expectedLocalJSScriptTag), 'Transformed HTML includes expected local JS link tag.')
  t.true(html.includes(expectedRemoteJSScriptTag), 'Transformed HTML includes expected remote JS link tag.')
})
