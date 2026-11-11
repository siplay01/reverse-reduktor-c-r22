# Реверс-редуктор c-r21: portable static site + git-based admin (revision 21, published to the working slot repo reverse-reduktor-c-r20; c-r19 is the approved version and stays as it is)

Revision 19 of the site (2026-11-04). Same look as `v6-demo/c-r18`, rebuilt so it can move between hosts (GitHub Pages, Russian shared hosting, .com, anything that serves files) and so every model, drawing and part has its own address for search engines.

## How it works

- `content/*.json` is the database: `settings.json` (company, hero, warranty, tenders, contacts), `models/` (6 cards), `parts/` (377, one file each), `nodes/` (36 drawing pages with part tables), `figures.json`, `documents.json`, `scans.json`.
- `build.mjs` (plain Node, zero dependencies) turns content + `public/` into `dist/`: 429 pages, `sitemap.xml`, `robots.txt`, JSON-LD (Organization, Product, BreadcrumbList), canonical and Open Graph per page.
- `public/admin/` is the Decap CMS admin (loaded from the jsDelivr CDN, pinned 3.17.1). It edits the same JSON files through git.
- Deploy = copy `dist/` anywhere. Nothing runs on the server.

## Commands

```
node build.mjs                      # build into dist/ (root-domain build, noindex)
node scripts/serve.mjs 4341         # serve dist/ at http://localhost:4341/
node qa/static-check.mjs            # structure, SEO tags, every internal link, sitemap, РРП names
node qa/owner-flow.mjs              # simulates the owner editing (photo, price removed/added, text) and checks the built site
node qa/test.mjs                    # browser tests (Chromium + WebKit, 1360 and 390 px) + admin loads (needs internet for the CDN)
```

Build options (environment): `SITE_URL` (absolute address for canonical and sitemap), `BASE` (path prefix, `/reverse-reduktor-c-r21` on GitHub Pages, empty on a domain), `INDEX=1` (allow indexing; without it every page is `noindex` and `robots.txt` disallows all). Moving hosts = change these three values and rebuild.

## Admin

Two admins read the same `public/admin/config.yml` and the same `content/` files:

- `/admin/` = chooser page with links to both editors (for demos and comparison).
- `/admin-sveltia/` = **Sveltia CMS** (pinned 0.255.0): modern UI, Russian when the browser language is Russian, works on a phone. Two ways to use it:
  - **On the published site (any browser):** «Sign In Using Access Token», paste a GitHub fine-grained token with Contents (read/write) on this repository. Every save becomes a commit on `main`; the Pages workflow rebuilds and republishes in about a minute. No OAuth server needed. The token stays in that browser only.
  - **Locally (Chrome, Edge or Brave only, not Safari or Firefox):** `node build.mjs && node scripts/serve.mjs 4341`, open http://localhost:4341/admin-sveltia/, «Work with Local Repository», pick this folder. Edits go to the files; rebuild and reload to see them.
- `/admin-decap/` = **Decap CMS** (pinned 3.17.1): needs `npx decap-server` in this folder for local editing (`local_backend: true`); production login needs an OAuth proxy.

Collections: «Настройки сайта» (hero, big NEW banner, warranty, tenders, map coordinates and directions text, company, SEO), «Продукция (модели)», «Запасные части» (377 + new).

Why Sveltia: it supports token sign-in (Decap does not), its local mode needs no helper server, and it is actively maintained (checked 2026-11-04). Its documentation says that the CMS reads the same config as Decap; the automated test creates a part through its form and sees it in the list.

## Contacts page

`/kontakty/` («Как нас найти»): address, phone, e-mail, route buttons that open Yandex Maps in a new tab, and two annotated maps that are plain images (they always show, no third-party code): a close-up with building No. 24 in red and the highlighted streets (ул. Зоотехническая, ул. Герцена), and a district map with Змеиногорский тракт and Южный тракт. Both are rendered from OpenStreetMap tiles and road/building geometry (© участники OpenStreetMap, credited on the page) by `node scripts/map/make-map.mjs` (needs internet; geometry cached in `scripts/map/osm-data.json`). An optional interactive Yandex map sits in a collapsed block and loads only after a click; a fallback link covers browsers that block it. Coordinates (53.2563675, 83.7063668) come from a one-time OSM lookup of the address and were checked on the Yandex map. The «Ориентиры» list, the «Как добраться» text and working hours are editable in the admin; directions and hours are empty until the owner supplies them (entrances and routes are not invented).

## Content rules kept from earlier revisions

Products are named РРП (реверс-редукторная передача): РРП-300, РРП-238, РРП-3Д6, РРП-3Д12; document titles keep their real name (РР-300.РЭ). Drawings, no photos (only РРП-300 is drawn so far; the rest show a placeholder). Warranty 12 months on all products. Tender participation block. Red NEW on the new hydraulic gearbox. Constructor for РРП-300 with the owner's options; the request list is a mail draft only on a click. Prices are the 2025 price list, labelled as such. Archive prices stay out of structured data.

## Not ported from c-r18 (still in `v6-demo/c-r18`)

Clickable callouts on the РРП-300 section drawing, the per-variant selector on drawing pages (c-r19 shows all variants in one table), the model-switch bar. Drawing-page tables and the 3Д6/3Д12 section legends are read-only in the admin.

## Regenerating content

`node scripts/extract.mjs` rebuilds `content/` and `public/` from `../v6-demo` (c-r18). It overwrites hand edits, so use it only to start over.

## Publishing

`.github/workflows/pages.yml` builds and deploys on every push to `main` (set repository variables `SITE_URL`, `BASE`, `INDEXABLE` for a real domain). Nothing is published yet.

## Revision 20 (2026-11-11)

- Model cards show the owner's photos (labels from his WhatsApp messages), cut out on white by `swift scripts/cutout.swift <in> <out.png> all 1200 900 0.86` (macOS Vision, on-device), same 3/4 side view with the coupling flange on the right; РРП-238 has no such shot, its flange is on the left (photos are never mirrored). Муфта: fig. 135 of the owner's catalog. NEW: sheets 29-31 of the СРРП draft ТУ (owner sent them "для сайта стр.29,30,31").
- РРП-238: mass 460 kg (manual: РР-300-238), outline drawing «РР-300 А ГЧ» with PDF (`figures.json` supports `pdf`, `image_large`, empty `legend`).
- Services are a plain list plus call/write buttons (the rows used to link to the footer).
- Constructor: the owner's fields live in `settings.json` → `constructor.groups`; each model only has `constructor.enabled` + `preset`. A choice that matches a РРП-300 variant row (hydraulic, 3Д6/3Д12, 1500 rpm, power and both ratios) shows «Серийное исполнение <designation+code>»; everything else shows «Под заказ».
- Rollback: `git checkout before-c-r20`.

## Revision 21 (2026-11-11)

- Hero: crossfade carousel (`settings.json` → `hero.slides`, `hero.slide_seconds`, editable in the admin): owner photo No. 12 cut out on white and the Blender render (round 6). Without JS only the first picture shows; reduced motion = no rotation; hover/focus pauses.
- Home cards: Dmitry's two drawings (`picture_small`): hydraulic one for РРП-300 and РРП-238, mechanical one for РРП-3Д6 and РРП-3Д12; model pages keep the real photos (`picture`). Card alt in `card_alt`.
