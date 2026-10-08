import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')
const base = (process.env.SITE_URL ?? 'https://www.example.com').replace(/\/+$/, '')
const paths = ['/', '/about', '/services', '/branches', '/reviews', '/faq', '/contact', '/book', '/privacy', '/terms']

const urls = paths.map((path) => `  <url>\n    <loc>${base}${path === '/' ? '/' : path}</loc>\n  </url>`).join('\n')
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
const robots = `User-agent: *\nAllow: /\nDisallow: /portal/\nDisallow: /login\nDisallow: /register\nDisallow: /forgot-password\nDisallow: /reset-password\nDisallow: /verify-email\n\nSitemap: ${base}/sitemap.xml\n`

mkdirSync(root, { recursive: true })
writeFileSync(join(root, 'sitemap.xml'), sitemap)
writeFileSync(join(root, 'robots.txt'), robots)
