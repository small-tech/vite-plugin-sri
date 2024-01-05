////////////////////////////////////////////////////////////////////////////////
//
// @small-tech/vite-plugin-sri
//
// Subresource integrity (SRI) plugin for Vite (https://vitejs.dev/)
//
// Adds subresource integrity hashes to script and stylesheet
// imports from your index.html file at build time.
//
// If you’re looking for a generic Rollup plugin that does the same thing,
// see rollup-plugin-sri by Jonas Kruckenberg that this one was inspired by:
// https://github.com/JonasKruckenberg/rollup-plugin-sri
//
// Like this? Fund us!
// https://small-tech.org/fund-us
//
// Copyright ⓒ 2021-present Aral Balkan, Small Technology Foundation
// License: ISC.
//
////////////////////////////////////////////////////////////////////////////////
'use strict';

const crypto = require('crypto');
const cheerio = require('cheerio');
const fetch = require('node-fetch');

////////////////////////////////////////////////////////////////////////////////

function sri () {
  let base = "/";
  return {
    name: 'vite-plugin-sri',
    enforce: 'post',
    apply: 'build',

    async configResolved(config) {
      base = config.base === "" ? "./" : config.base;
    },

    async transformIndexHtml(html, context) {
      const bundle = context.bundle;

      const calculateIntegrityHashes = async (element) => {
        let source;
        let attributeName = element.attribs.src ? 'src' : 'href';
        const resourcePath = element.attribs[attributeName];
        if (resourcePath.startsWith('http')) {
          // Load remote source from URL.
          source = await (await fetch(resourcePath)).buffer();
        } else {
          // Load local source from bundle.
          const resourcePathWithoutLeadingSlash = resourcePath.slice(base.length);
          const bundleItem = bundle[resourcePathWithoutLeadingSlash];
          source = bundleItem.code || bundleItem.source;
        }
        element.attribs.integrity = `sha384-${crypto.createHash('sha384').update(source).digest().toString('base64')}`;
      };

      const $ = cheerio.load(html);
      $.prototype.asyncForEach = async function (callback) {
        for (let index = 0; index < this.length; index++) {
          await callback(this[index], index, this);
        }
      };

      // Implement SRI for scripts and stylesheets.
      const scripts = $('script').filter('[src]');
      const stylesheets = $('link[rel=stylesheet]').filter('[href]');

      await scripts.asyncForEach(calculateIntegrityHashes);
      await stylesheets.asyncForEach(calculateIntegrityHashes);

      return $.html()
    }
  }
}

module.exports = sri;
