// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import { unified } from '@astrojs/markdown-remark';
import rehypeExternalLinks from 'rehype-external-links';

import { remarkReadingTime } from './src/lib/remark-reading-time.mjs';
import { remarkLastUpdated } from './src/lib/remark-last-updated.mjs';
import { rehypeExternalLinkOptions } from './src/lib/rehype-external-link-options.mjs';

// https://astro.build/config
export default defineConfig({
  site: import.meta.env.SITE_URL || 'http://localhost:4321',
  output: 'static',
  trailingSlash: 'never',
  redirects: {
    '/docs': '/docs/overview',
  },
  // Astro 7's default markdown processor (satteri) doesn't run remark/rehype
  // plugins on MDX. Give MDX a unified processor so our plugins run on every
  // .mdx doc page.
  integrations: [
    mdx({
      processor: unified({
        remarkPlugins: [remarkReadingTime, remarkLastUpdated],
        rehypePlugins: [[rehypeExternalLinks, rehypeExternalLinkOptions]],
      }),
    }),
  ],
  vite: {
    server: {
      proxy: {
        '/api': {
          target: process.env.BACKEND_URL || 'http://localhost:3000',
          changeOrigin: true,
        },
      },
    },
  },
});
