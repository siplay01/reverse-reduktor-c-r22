// Static site generator, plain Node, no dependencies. content/*.json + public/ -> dist/ (ready to copy to any host).
// Env: SITE_URL (absolute address, for canonical and sitemap), BASE (path prefix, e.g. /repo-name for GitHub Pages),
//      INDEX=1 (allow search engines; without it every page is noindex and robots.txt disallows all).
import fs from "node:fs"; import path from "node:path";
const ROOT = import.meta.dirname, DIST = path.join(ROOT, "dist");
const SITE_URL = (process.env.SITE_URL || "http://localhost:4341").replace(/\/$/, ""), BASE = (process.env.BASE || "").replace(/\/$/, ""), INDEX = process.env.INDEX === "1";
const J = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));
const dir = (p) => fs.readdirSync(path.join(ROOT, p)).filter((f) => f.endsWith(".json")).sort();
const S = J("content/settings.json"), C = S.company;
const models = dir("content/models").map((f) => J("content/models/" + f)).sort((a, b) => a.order - b.order);
const parts = dir("content/parts").map((f) => ({ ...J("content/parts/" + f), slug: f.replace(/\.json$/, "") }));
const nodes = dir("content/nodes").map((f) => J("content/nodes/" + f));
const FIGS = J("content/figures.json"), SCANS = J("content/scans.json"), DOCS = J("content/documents.json");
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const mBy = Object.fromEntries(models.map((m) => [m.slug, m]));
// a model with `catalog_of` shares another model's catalog (РРП-238 uses the РРП-300 catalog): no catalog pages of its own, its parts move to the target
for (const m of models) m.cname = m.name;
for (const m of models) if (m.catalog_of) mBy[m.catalog_of].cname = `${mBy[m.catalog_of].name} и ${m.name}`;
for (const p of parts) p.models = [...new Set(p.models.map((s) => mBy[s].catalog_of || s))];
const catOf = (m) => mBy[m.catalog_of] || m;
const withCat = models.filter((m) => !m.catalog_of && (m.status === "ready" || nodes.some((n) => n.model === m.slug)));
const kindOf = (m) => (m.kind.includes("муфта") ? cap(m.kind) : `${cap(m.kind)} реверс-редуктор`);
const norm = (s) => String(s).toLowerCase().replace(/[\s\-–.]/g, "").replace(/ё/g, "е");
const partBy = new Map(parts.map((p) => [norm(p.designation), p]));
const nodesOf = (slug) => nodes.filter((n) => n.model === slug).sort((a, b) => a.fig - b.fig);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const u = (p) => BASE + (p.startsWith("/") ? p : "/" + p);                    // site path -> href
const abs = (p) => SITE_URL + u(p);
const sku = (s) => `<span class="sku" translate="no">${String(s).split(" ").map((t) => `<span class="nw">${esc(t)}</span>`).join(" ")}</span>`;
const rel = (p) => String(p || "").replace(/^\/+/, "");                 // admin uploads are stored as /img/uploads/x.webp
const nf = new Intl.NumberFormat("ru-RU");
const plur = (n, a, b, c) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? a : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? b : c}`;
const price = (p) => (p.price_rub ? `${nf.format(p.price_rub)}&nbsp;₽` : `<span class="muted">по запросу</span>`);
const PRICE_NOTE = "Цены за единицу по прайсу 2025 г., уточняйте при заказе.";
const written = [];
fs.rmSync(DIST, { recursive: true, force: true }); // never ship stale files from earlier builds
function write(urlPath, html) { const f = path.join(DIST, urlPath.endsWith(".html") ? urlPath : path.join(urlPath, "index.html")); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, html); written.push(urlPath); }

// ---------- layout ----------
const NAV = [["produkciya", "/#produkciya", "Наша продукция"], ["katalog", "/katalog/", "Запасные части"], ["uslugi", "/#uslugi", "Услуги"], ["dokumenty", "/dokumenty/", "Техническая документация"], ["kontakty", "/kontakty/", "Контакты"]];
const strip = `<div class="strip"><div class="wrap strip-in"><span class="strip-l">${esc(C.operator)} · г. Барнаул · Судовое машиностроение</span><span class="strip-c">РКО № ${esc(S.cert.no)} · до ${esc(S.cert.to)}</span><a class="strip-r" href="tel:${esc(C.tel)}">${esc(C.phone)}</a></div></div>`;
const header = (section) => `<header class="head"><div class="wrap head-in">
    <a class="brand" href="${u("/")}" aria-label="${esc(C.brand)}, на главную"><svg class="brand-mark" viewBox="0 0 48 48" aria-hidden="true"><rect x="1.5" y="1.5" width="45" height="45"/><circle cx="24" cy="24" r="10.5"/><path d="M9 37L39 12"/></svg><span><span class="brand-name">${esc(C.brand)}</span><span class="brand-sub">Судовое оборудование · ${esc(C.operator)}</span></span></a>
    <nav class="nav" aria-label="Разделы">${NAV.map(([k, h, t]) => `<a href="${u(h)}"${section === k ? ' aria-current="page"' : ""}>${t}</a>`).join("")}</nav>
    <button type="button" class="btn-list" data-cart-open aria-label="Список запроса"><svg class="bl-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h12M8 12h12M8 18h12M3.5 6h.01M3.5 12h.01M3.5 18h.01"/></svg><span class="t">Список запроса</span> <span class="count" data-cart-count hidden>0</span></button>
    <details class="burger"><summary aria-label="Меню"><span></span></summary><nav aria-label="Разделы, мобильное меню">${NAV.map(([, h, t]) => `<a href="${u(h)}">${t}</a>`).join("")}<a href="tel:${esc(C.tel)}">${esc(C.phone)}</a></nav></details>
  </div></header>`;
const footer = `<footer class="foot foot-r2" id="kontakty"><div class="wrap"><div class="foot-grid">
  <div class="foot-contact"><p class="foot-name">${esc(C.brand)}</p><p>Судовое оборудование · ${esc(C.operator)}</p><p class="foot-phone"><a href="tel:${esc(C.tel)}">${esc(C.phone)}</a></p><p><a href="mailto:${esc(C.email)}">${esc(C.email)}</a></p><p>${esc(C.address)}</p><p><a href="${u("/kontakty/")}">Как нас найти</a></p></div>
  <nav aria-label="Разделы, подвал"><p class="foot-h">Разделы</p>${NAV.map(([, h, t]) => `<a href="${u(h)}">${t}</a>`).join("")}</nav>
  <nav aria-label="Запасные части, подвал"><p class="foot-h">Запасные части</p>${withCat.map((m) => `<a href="${u(`/katalog/${m.slug}/`)}">${esc(m.name)}</a>`).join("")}<a href="${u("/katalog/vse/")}">Все запчасти</a></nav>
  <div class="foot-req"><p class="foot-h">Реквизиты</p><dl class="req" id="req">${[["Организация", C.operator], ["ИНН / КПП", `${C.inn} / ${C.kpp}`], ["ОГРН", C.ogrn], ["Банк", C.bank], ["БИК", C.bik], ["Р/с", C.rs], ["К/с", C.ks]].map(([a, b]) => `<div><dt>${a}</dt><dd>${esc(b)}</dd></div>`).join("")}</dl><button type="button" class="linkish" data-copy-req>Скопировать реквизиты</button></div>
</div></div></footer>
<dialog id="cart" aria-labelledby="cart-h" data-mail="${esc(C.email)}"><div class="cart-in"><header class="cart-head"><h2 id="cart-h">Заявка</h2><button type="button" class="cart-close" data-cart-close aria-label="Закрыть">×</button></header>
<p id="cart-empty" class="muted">Список пуст. Добавьте позиции кнопкой «В запрос» в каталоге или соберите конфигурацию в конструкторе.</p><ol id="cart-items" class="cart-items"></ol>
<div id="cart-send" class="cart-send" hidden><label for="cart-text" class="cart-lab">Текст заявки</label><textarea id="cart-text" class="cart-text" rows="9" readonly></textarea>
<p class="small">Если письмо не открылось, скопируйте текст и отправьте его на <b id="cart-addr">${esc(C.email)}</b> <button type="button" class="linkish" data-cart-copy-addr>скопировать адрес</button></p></div>
<div class="cart-actions"><button type="button" class="btn btn-white" data-cart-mail data-need-items>Оставить заявку</button><button type="button" class="btn btn-line" data-cart-copy data-need-items>Скопировать текст заявки</button><button type="button" class="linkish" data-cart-clear data-need-items>Очистить</button></div>
<p class="muted small">Сайт не собирает и не хранит ваши данные. «Оставить заявку» открывает черновик письма в вашей почтовой программе, вы отправляете его сами. Или позвоните: <a href="tel:${esc(C.tel)}">${esc(C.phone)}</a>.</p></div></dialog><div id="toast" class="toast" role="status" aria-live="polite"></div>`;
const crumbs = (items) => `<nav class="crumbs" aria-label="Путь"><a href="${u("/")}">Главная</a>${items.map(([t, h]) => `<span aria-hidden="true">/</span>${h ? `<a href="${u(h)}">${esc(t)}</a>` : `<span aria-current="page">${esc(t)}</span>`}`).join("")}</nav>`;
const crumbLd = (items) => ({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [["Главная", "/"], ...items].map(([t, h], i) => ({ "@type": "ListItem", position: i + 1, name: t, ...(h ? { item: abs(h) } : {}) })) });
function page({ url, title, description, section, body, ld = [], extraHead = "", cls = "" }) {
  const full = title.includes("Реверс-редуктор") ? title : `${title} · ${S.seo.site_name}`;
  const html = `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(full)}</title><meta name="description" content="${esc(description)}">
<link rel="canonical" href="${abs(url)}">${INDEX ? "" : '\n<meta name="robots" content="noindex, nofollow">'}
<meta property="og:type" content="website"><meta property="og:locale" content="ru_RU"><meta property="og:site_name" content="${esc(S.seo.site_name)}"><meta property="og:title" content="${esc(full)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${abs(url)}"><meta property="og:image" content="${abs("/img/rrp300-drawing.webp")}">
<meta name="color-scheme" content="light"><link rel="preload" href="${u("/fonts/golos-text-cyrillic-wght-normal.woff2")}" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${u("/fonts.css")}"><link rel="stylesheet" href="${u("/site.css")}"><link rel="stylesheet" href="${u("/extra.css")}">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect x='1.5' y='1.5' width='29' height='29' fill='%23fff' stroke='%23172a3a' stroke-width='3'/%3E%3C/svg%3E">
${ld.map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join("\n")}${extraHead}
</head><body class="static ${cls}"><a class="skip" href="#main">К содержанию</a>${strip}${header(section)}
<main id="main">${body}</main>${footer}<script src="${u("/app.js")}" defer></script></body></html>`;
  write(url, html);
}
const head1 = (title, aside = "", sub = "", art = "") => `<header class="cat-head compact${art ? " " + art : ""}"><div><h1 tabindex="-1">${title}</h1>${sub ? `<p class="muted">${sub}</p>` : ""}</div>${aside}</header>`;
const buy = (des, name, where) => `<span class="buy"><label class="sr" for="q-${esc(des)}-${esc(where.length)}">Количество, ${esc(des)}</label><input id="q-${esc(des)}-${esc(where.length)}" type="number" min="1" value="1" inputmode="numeric" data-qty><button type="button" class="btn-add" data-add="${esc(des)}" data-name="${esc(name)}" data-where="${esc(where)}">В запрос</button></span>`;
const partLink = (des) => { const p = partBy.get(norm(des)); return p ? `<a href="${u(`/detal/${p.slug}/`)}">${sku(des)}</a>` : sku(des); };
const orgLd = { "@context": "https://schema.org", "@type": "Organization", name: C.operator, url: abs("/"), telephone: C.phone, email: C.email, taxID: C.inn,
  address: { "@type": "PostalAddress", streetAddress: "ул. Зоотехническая, 24, р.п. Южный", addressLocality: "Барнаул", addressRegion: "Алтайский край", postalCode: "656609", addressCountry: "RU" } };

// ---------- cards ----------
const modelCard = (m) => {
  const n = parts.filter((p) => p.models.includes(catOf(m).slug)).length;
  const small = rel(m.picture_small || m.picture);
  const pic = small ? `<a class="mcard-pic is-art${m.status === "new" ? " is-stamp" : ""}" href="${u(`/produkciya/${m.slug}/`)}" tabindex="-1" aria-hidden="true"><img src="${u("/" + small)}" width="640" height="480" alt="${esc(m.picture_alt)}" loading="lazy">${m.status === "new" ? '<span class="stamp is-corner">NEW</span>' : ""}</a>`
    : m.status === "new" ? (S.new_style === "stamp" ? `<a class="mcard-pic is-soon is-stamp" href="${u(`/produkciya/${m.slug}/`)}" tabindex="-1" aria-hidden="true">${soonArt()}<span class="stamp">NEW</span></a>` : `<a class="mcard-pic is-newbig" href="${u(`/produkciya/${m.slug}/`)}" tabindex="-1" aria-hidden="true"><span>NEW</span></a>`)
    : `<a class="mcard-pic is-soon" href="${u(`/produkciya/${m.slug}/`)}" tabindex="-1" aria-hidden="true">${soonArt()}</a>`;
  if (m.status !== "ready") return `<article class="mcard${m.status === "new" ? " mcard-new" : ""}" id="model-${m.slug}">${pic}<div class="mcard-body"><p class="mcard-kind">${m.status === "new" ? "Новая разработка · в работе" : "Муфта сцепления"}</p>
    <h3 class="mcard-h"><a href="${u(`/produkciya/${m.slug}/`)}">${esc(m.name)}</a></h3><p class="mcard-app">${esc(m.applicability)}</p>
    <p class="mcard-btns">${withCat.includes(m) ? `<a class="btn btn-white btn-sm" href="${u(`/katalog/${m.slug}/`)}">Запчасти (${n})</a><a class="btn btn-line btn-sm" href="${u(`/produkciya/${m.slug}/`)}">Подробнее</a>` : `<a class="btn ${m.status === "new" ? "btn-line" : "btn-white"} btn-sm" href="${u(`/produkciya/${m.slug}/`)}">Подробнее</a>`}</p></div></article>`;
  return `<article class="mcard" id="model-${m.slug}">${pic}<div class="mcard-body"><p class="mcard-kind">${cap(m.kind)} реверс-редуктор</p>
    <h3 class="mcard-h"><a href="${u(`/produkciya/${m.slug}/`)}">${esc(m.name)}</a> ${sku(m.designation)}</h3><p class="mcard-app">${esc(m.applicability)}</p>
    <dl class="mcard-spec">${m.key.map((k) => `<div><dt>${esc(k.label)}</dt><dd>${esc(k.value)}</dd></div>`).join("")}<div><dt>Гарантия</dt><dd>${S.warranty.months} мес.</dd></div></dl>
    <p class="mcard-btns"><a class="btn btn-white btn-sm" href="${u(`/katalog/${catOf(m).slug}/`)}">Запчасти ${esc(m.name)} (${n})</a><a class="btn btn-line btn-sm" href="${u(`/produkciya/${m.slug}/`)}">Характеристики</a></p></div></article>`;
};
const soonArt = () => `<svg class="ph-art" viewBox="0 0 600 340" role="img" aria-label="Рисунок скоро будет"><rect class="sa-veil" x="146" y="128" width="308" height="104" rx="12"/><text class="sa-soon" x="300" y="174">РИСУНОК</text><text class="sa-soon sa-soon-2" x="300" y="218">СКОРО БУДЕТ</text></svg>`;
const cfgBlock = (m) => !S.constructor ? "" : `<div class="cfg" data-config data-model="${esc(m ? m.name : "")}"></div><script type="application/json" id="cfg-data">${JSON.stringify({ groups: S.constructor.groups, preset: (m || mBy["rrp-300"]).constructor?.preset || {}, serial: { designation: mBy["rrp-300"].designation, variants: mBy["rrp-300"].variants } }).replace(/</g, "\\u003c")}</script>`;

// ---------- home ----------
{
  const h = S.hero;
  const heroSlides = h.slides?.length ? h.slides : [{ picture: h.picture, picture_small: h.picture_small, alt: "Реверс-редукторная передача РРП-300" }];
  const body = `<section class="hero"><div class="hero-txt"><p class="eyebrow">${esc(h.eyebrow)}</p><h1>${esc(h.title)}</h1><p class="hero-lead">${esc(h.lead)}</p>
    <p class="hero-btns"><a class="btn btn-white" href="${u("/katalog/")}">Найти запчасть <span aria-hidden="true">→</span></a><a class="btn btn-line" href="#produkciya">Посмотреть оборудование</a></p></div>
    <figure class="hero-pic is-art${heroSlides.length > 1 ? " is-fade" : ""}"${heroSlides.length > 1 ? ` data-fade="${Math.max(3, +h.slide_seconds || 6)}"` : ""}>${heroSlides.map((sl, i) => `<img${i ? "" : ' class="on"'} src="${u("/" + rel(sl.picture_small || sl.picture))}" srcset="${u("/" + rel(sl.picture_small || sl.picture))} 640w, ${u("/" + rel(sl.picture))} 1600w" sizes="(min-width: 900px) 50vw, 100vw" width="1600" height="1200" alt="${esc(sl.alt)}"${i ? ' decoding="async"' : ' fetchpriority="high"'}>`).join("")}<figcaption><b>${esc(h.picture_caption)}</b><span>${esc(h.picture_note)}</span></figcaption></figure></section>
  ${S.new_product?.enabled ? `<section class="newband" aria-labelledby="new-h"><div class="wrap newband-in"><p class="newband-label" aria-hidden="true">${esc(S.new_product.label)}</p>
    <div class="newband-txt"><p class="newband-kicker">${esc(S.new_product.kicker)}</p><h2 id="new-h">${esc(S.new_product.title)}</h2><p>${esc(S.new_product.text)}</p><p><a class="btn btn-white" href="${esc(S.new_product.link)}">${esc(S.new_product.button)} <span aria-hidden="true">→</span></a></p></div></div></section>` : ""}
  <section class="sec sec-models" id="produkciya" aria-labelledby="models-h"><div class="wrap"><h2 id="models-h">Модельный ряд</h2><div class="models">${models.map(modelCard).join("")}</div></div></section>
  <section class="sec sec-cfg" id="konstruktor" aria-labelledby="cfg-h"><div class="wrap"><p class="eyebrow">Конструктор</p><h2 id="cfg-h">${esc(S.constructor.title)}</h2>
    <p class="cfg-lead">${esc(S.constructor.lead)}</p>${cfgBlock(null)}</div></section>
  <section class="sec sec-terms" id="garantiya" aria-labelledby="terms-h"><div class="wrap"><h2 id="terms-h" class="sr">Гарантия и закупки</h2><div class="terms">
    <div class="term"><p class="term-big">${S.warranty.months} месяцев</p><h3>${esc(S.warranty.title)}</h3><p>${esc(S.warranty.text)}</p></div>
    <div class="term"><p class="term-big">Тендеры</p><h3>${esc(S.tenders.title)}</h3><p>${esc(S.tenders.text)}</p><p><a class="btn btn-white btn-sm" href="#kontakty">Запросить предложение</a></p></div></div></div></section>
  <section class="sv8" id="uslugi" aria-labelledby="svc-h"><div class="wrap sv8-wrap"><div class="sv8-intro"><p class="eyebrow">Услуги</p><h2 id="svc-h">Ремонт, изготовление и&nbsp;техническое сопровождение</h2><p class="sv8-rule" aria-hidden="true"></p>
    <p class="sv8-lead">Работы выполняются по документации, согласованной с Российским Классификационным Обществом. Свидетельство о признании № ${esc(S.cert.no)}.</p><img class="sv8-bp" src="${u("/img/blueprint.webp")}" width="556" height="284" alt="" decoding="async"></div>
    <div class="sv8-list"><ul>${S.services.map((t, i) => `<li><div class="sv8-row"><span class="sv8-n">0${i + 1}</span><span class="sv8-t">${esc(t)}</span></div></li>`).join("")}</ul>
    <p class="sv8-ask">${esc(S.services_note || "")}</p><p class="sv8-btns"><a class="btn btn-white btn-sm" href="tel:${esc(C.tel)}">${esc(C.phone)}</a><a class="btn btn-line btn-sm" href="mailto:${esc(C.email)}?subject=${encodeURIComponent("Услуги: ремонт и изготовление")}">Написать письмо</a></p>
    <a class="sv8-docs" href="${u("/dokumenty/")}"><span class="sv8-dt">Техническая документация <svg viewBox="0 0 24 12" aria-hidden="true"><path d="M0 6h22M17 1l5 5-5 5"/></svg></span><span class="sv8-ds">Каталоги, руководства и чертежи</span></a></div></div></section>
  <section class="sec" id="svidetelstvo" aria-labelledby="cert-h"><div class="wrap"><div class="cert"><div class="cert-scan"><a href="${u("/" + S.cert.scan_large)}" target="_blank" rel="noopener"><img src="${u("/" + S.cert.scan)}" width="600" height="851" alt="Скан свидетельства о признании РКО № ${esc(S.cert.no)}" loading="lazy"></a></div>
    <div class="cert-body"><p class="cert-kicker">Российское Классификационное Общество</p><h2 id="cert-h">Свидетельство о признании № ${esc(S.cert.no)}</h2>
    <dl class="cert-kv"><div><dt>Признано за</dt><dd>${esc(C.operator)} (ИНН ${esc(C.inn)}), г. Барнаул</dd></div><div><dt>Вступает в силу</dt><dd>${esc(S.cert.from)}</dd></div><div><dt>Действует до</dt><dd>${esc(S.cert.to)}</dd></div><div><dt>Выдано</dt><dd>${esc(S.cert.issuer)}</dd></div></dl>
    <p class="cert-h3">Виды работ, выполняемых в соответствии с Правилами РКО:</p><ul class="cert-list">${[].concat(S.cert.scope).map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
    <a class="btn btn-pale" href="${u("/" + S.cert.pdf)}" target="_blank" rel="noopener">Открыть PDF свидетельства</a></div></div></div></section>`;
  page({ url: "/", title: "Реверс-редуктор · ООО «Дело» · судовые реверс-редукторы", description: S.seo.default_description, section: "", body, ld: [orgLd] });
}

// ---------- model pages ----------
for (const m of models) {
  const tabs = m.status === "ready" ? `<div class="stab-wrap"><table class="stab"><tbody>${m.specs.map((s) => `<tr><th scope="row">${esc(s.label)}</th><td>${esc(s.value)}</td></tr>`).join("")}<tr><th scope="row">Гарантия</th><td>${S.warranty.months} месяцев</td></tr></tbody></table></div>` : "";
  const vars = m.variants.length ? `<div class="tbl"><table class="vtab"><caption>Исполнения</caption><thead><tr><th scope="col">Исполнение</th><th scope="col">Вращение</th><th scope="col">л.с.</th><th scope="col">Вперёд</th><th scope="col">Назад</th><th scope="col">Муфта</th></tr></thead><tbody>${m.variants.map((v) => `<tr><td>${sku(m.designation + (v.code === "-" ? "" : v.code))}</td><td>${esc(v.rotation)}</td><td>${v.hp}</td><td>${esc(v.forward)}</td><td>${esc(v.reverse)}</td><td>${v.fingers}-пальцевая</td></tr>`).join("")}</tbody></table></div>` : "";
  const figs = (FIGS[m.slug] || []).map((f) => `<figure class="gfig"><div class="sheet">${f.image_large ? `<a href="${u("/" + f.image_large)}" target="_blank" rel="noopener">` : ""}<img src="${u("/" + f.image)}" width="${f.width}" height="${f.height}" alt="${esc(f.title)}" loading="lazy">${f.image_large ? "</a>" : ""}</div><figcaption><b>${esc(f.title)}</b>${f.pdf ? ` <a class="gdoc" href="${u("/" + f.pdf)}" target="_blank" rel="noopener">Открыть чертёж (PDF)</a>` : ""}${f.pdf_page ? ` <a class="gdoc" href="${u(m.slug === "rrp-3d6" ? "/assets/3d6-7d6-sudovye-dizeli-1972.pdf" : "/assets/d12-rukovodstvo-po-ekspluatacii.pdf")}${f.pdf_page}" target="_blank" rel="noopener">Чертёж в руководстве (PDF)</a>` : ""}
    ${f.legend.length ? `<details class="gleg"><summary>Позиции на чертеже (${f.legend.length})</summary><table class="spec legend plain"><thead><tr><th scope="col" class="c-pos">Поз.</th><th scope="col">Наименование</th></tr></thead><tbody>${f.legend.map((r) => `<tr><td class="c-pos nw">${esc(r.pos)}</td><td>${esc(r.name)}</td></tr>`).join("")}</tbody></table></details>` : ""}</figcaption></figure>`).join("");
  const pic = m.picture ? `<figure class="model-pic${m.status === "new" ? " is-stamp" : ""}"><img src="${u("/" + rel(m.picture))}" width="1600" height="1200" alt="${esc(m.picture_alt)}" fetchpriority="high">${m.status === "new" ? '<span class="stamp is-corner">NEW</span>' : ""}</figure>` : m.status === "new" ? (S.new_style === "stamp" ? `<figure class="model-pic is-soon is-stamp">${soonArt()}<span class="stamp">NEW</span></figure>` : `<figure class="model-pic is-newbig"><span>NEW</span></figure>`) : `<figure class="model-pic is-soon">${soonArt()}</figure>`;
  const n = parts.filter((p) => p.models.includes(catOf(m).slug)).length;
  const cta = m.status === "ready" || withCat.includes(m) ? `<a class="btn btn-white" href="${u(`/katalog/${catOf(m).slug}/`)}">Запчасти ${esc(m.name)} (${n})</a>` : "";
  const contact = `<a class="btn btn-line" href="mailto:${esc(C.email)}?subject=${encodeURIComponent(m.name)}">Написать на ${esc(C.email)}</a> <a class="btn btn-line" href="tel:${esc(C.tel)}">${esc(C.phone)}</a>`;
  const body = `<div class="wrap model-page">${crumbs([["Продукция", "/#produkciya"], [m.name]])}${head1(`${esc(m.name)}`, "", m.designation ? `Обозначение по каталогу: ${sku(m.designation)}` : "")}
    <div class="model-grid">${pic}<div class="model-info"><p class="mcard-kind">${m.status === "ready" ? kindOf(m) : cap(m.kind)}</p><p>${esc(m.applicability)}</p>${tabs}<p class="mcard-btns">${cta} ${contact}</p></div></div>
    ${vars}${m.constructor?.enabled ? `<section class="sec-cfg-in" aria-labelledby="cfg-h"><h2 id="cfg-h">Конструктор ${esc(m.name)}</h2><p class="cfg-lead">${esc(S.constructor.lead)}</p>${cfgBlock(m)}</section>` : ""}${figs ? `<section aria-labelledby="fig-h"><h2 id="fig-h" class="sr">Чертежи</h2><div class="node-fig">${figs}</div></section>` : ""}</div>`;
  const ld = [crumbLd([["Продукция", "/#produkciya"], [m.name]]),
    ...(m.status === "ready" ? [{ "@context": "https://schema.org", "@type": "Product", name: `Реверс-редукторная передача ${m.name}`, sku: m.designation, description: m.seo.description, brand: { "@type": "Brand", name: C.operator }, manufacturer: { "@type": "Organization", name: C.operator }, ...(m.picture ? { image: abs("/" + rel(m.picture)) } : {}) }] : [])];
  page({ url: `/produkciya/${m.slug}/`, title: m.seo.title, description: m.seo.description, section: "produkciya", body, ld });
}

// ---------- catalog ----------
const partRow = (p, m) => `<tr data-des="${esc(p.designation)}"><td class="c-des"><a href="${u(`/detal/${p.slug}/`)}">${sku(p.designation)}</a></td><td class="c-name">${esc(p.name)}</td><td>${esc(p.type)}</td>${m ? "" : `<td class="c-ap">${p.models.map((s) => esc(mBy[s].cname)).join(", ")}</td>`}<td class="c-p">${price(p)}</td><td class="c-buy">${buy(p.designation, p.name, m ? m.cname : "каталог")}</td></tr>`;
const partsTable = (list, m) => `<div class="tools"><label class="tool-f"><span class="sr">Фильтр по перечню</span><input type="search" placeholder="Обозначение или название" data-filter autocomplete="off"></label></div>
  <div class="tbl"><table class="spec"><thead><tr><th scope="col">Обозначение</th><th scope="col">Наименование</th><th scope="col">Группа</th>${m ? "" : '<th scope="col">Применяется</th>'}<th scope="col" class="c-p">Цена за ед.</th><th scope="col" class="c-buy">Количество</th></tr></thead><tbody>${list.map((p) => partRow(p, m)).join("")}</tbody></table><p class="none" hidden>Ничего не найдено. Проверьте обозначение или отправьте запрос по номеру.</p></div><p class="muted small">${PRICE_NOTE}</p>`;
page({ url: "/katalog/", title: "Запасные части для судовых реверс-редукторов: каталог", description: "Каталог запасных частей для реверс-редукторных передач РРП-300, РРП-238, РРП-3Д6, РРП-3Д12 с чертежами и перечнями деталей. ООО «Дело», Барнаул.", section: "katalog",
  body: `<div class="wrap cat">${crumbs([["Запасные части"]])}${head1("Запасные части", `<a class="all-link" href="${u("/katalog/vse/")}">Все запчасти одним списком (${parts.length})</a>`, "", "art-gear")}<form class="cat-search" action="${u("/katalog/vse/")}" method="get" role="search"><label class="sr" for="cs">Номер детали или название</label><input id="cs" type="search" name="q" placeholder="Номер детали или название, например 1225-15-1" autocomplete="off"><button class="btn btn-white" type="submit">Найти</button></form><div class="models-sm">${withCat.map((m) => {
    const n = parts.filter((p) => p.models.includes(m.slug)).length, nn = nodesOf(m.slug).length;
    return `<article class="mcard mcard-sm"><a class="mcard-pic${(m.picture_small || m.picture) ? " is-art" : " is-soon"}" href="${u(`/katalog/${m.slug}/`)}" tabindex="-1" aria-hidden="true">${(m.picture_small || m.picture) ? `<img src="${u("/" + rel(m.picture_small || m.picture))}" width="640" height="480" alt="" loading="lazy">` : soonArt()}</a><div class="mcard-body"><p class="mcard-kind">${kindOf(m)}</p><h2 class="mcard-h"><a href="${u(`/katalog/${m.slug}/`)}">${esc(m.cname)} ${sku(m.designation)}</a></h2><p class="mcard-app">${nn ? `${plur(nn, "узел", "узла", "узлов")} с чертежами, ` : ""}${plur(n, "позиция", "позиции", "позиций")}</p><p class="mcard-btns"><a class="btn btn-white btn-sm" href="${u(`/katalog/${m.slug}/`)}">Каталог запчастей</a></p></div></article>`;
  }).join("")}</div></div>`, ld: [crumbLd([["Запасные части"]])] });
page({ url: "/katalog/vse/", title: "Все запасные части: единый список", description: `Единый список ${parts.length} запасных частей для реверс-редукторов РРП-300, РРП-238, РРП-3Д6, РРП-3Д12: обозначение, наименование, применяемость.`, section: "katalog",
  body: `<div class="wrap cat">${crumbs([["Запасные части", "/katalog/"], ["Все запчасти"]])}${head1(`Все запчасти (${parts.length})`)}${partsTable(parts, null)}</div>`, ld: [crumbLd([["Запасные части", "/katalog/"], ["Все запчасти"]])] });
for (const m of withCat) {
  const list = parts.filter((p) => p.models.includes(m.slug)), ns = nodesOf(m.slug);
  const tiles = ns.length ? `<section aria-labelledby="nodes-h"><h2 id="nodes-h">Чертежи узлов (${ns.length})</h2><div class="tiles">${ns.map((n) => `<a class="tile" href="${u(`/katalog/${m.slug}/ris-${n.fig}/`)}"><span class="tile-img">${n.thumb ? `<img src="${u("/" + n.thumb)}" width="420" height="${Math.round(420 * n.height / n.width)}" alt="" loading="lazy">` : ""}</span><span class="tile-t"><b>Рис. ${n.fig}</b> ${esc(n.title)}</span><span class="tile-n">${n.rows.length} поз.</span></a>`).join("")}</div></section>` : "";
  page({ url: `/katalog/${m.slug}/`, title: `Запасные части ${m.cname}: каталог с чертежами`, description: `Каталог запасных частей ${m.cname} (${m.designation}): ${ns.length ? plur(ns.length, "узел", "узла", "узлов") + " с чертежами, " : ""}${plur(list.length, "позиция", "позиции", "позиций")} с обозначениями и наименованиями. ООО «Дело», Барнаул.`, section: "katalog",
    body: `<div class="wrap cat">${crumbs([["Запасные части", "/katalog/"], [m.cname]])}${head1(`Запчасти ${esc(m.cname)}`, `<a class="all-link" href="${u(`/produkciya/${m.slug}/`)}">Характеристики ${esc(m.cname)}</a>`)}${tiles}<section aria-labelledby="all-h"><h2 id="all-h">Все детали ${esc(m.cname)} (${list.length})</h2>${partsTable(list, m)}</section></div>`, ld: [crumbLd([["Запасные части", "/katalog/"], [m.cname]])] });
  ns.forEach((n, i) => {
    const prev = ns[i - 1], next = ns[i + 1], vars = n.variants.length > 1;
    const rows = n.rows.map((r) => `<tr data-des="${esc(r.designation)}"><td class="c-pos">${r.pos || ""}</td><td class="c-des">${partLink(r.designation)}${r.note ? `<sup>${esc(r.note)}</sup>` : ""}</td><td class="c-name">${esc(r.name)}</td>${r.qty.map((q, vi) => `<td class="c-q" data-v="${vi}">${q ?? "—"}</td>`).join("")}<td class="c-buy">${buy(r.designation, r.name, `${m.cname}, рис. ${n.fig}${r.pos ? `, поз. ${r.pos}` : ""}`)}</td></tr>`).join("");
    const foot = Object.entries(n.footnotes).map(([k, t]) => `<li><sup>${esc(k)}</sup> ${esc(t)}</li>`).join("");
    const pn = `<nav class="pn" aria-label="Соседние узлы">${prev ? `<a href="${u(`/katalog/${m.slug}/ris-${prev.fig}/`)}">← Рис. ${prev.fig}</a>` : ""}${next ? `<a href="${u(`/katalog/${m.slug}/ris-${next.fig}/`)}">Рис. ${next.fig} →</a>` : ""}</nav>`;
    page({ url: `/katalog/${m.slug}/ris-${n.fig}/`, title: `Рис. ${n.fig}. ${n.title}: ${m.cname}`, description: `${n.title}, рис. ${n.fig} каталога деталей ${m.cname}: ${plur(n.rows.length, "позиция", "позиции", "позиций")} с обозначениями и количеством по исполнениям.`, section: "katalog",
      body: `<div class="wrap cat">${crumbs([["Запасные части", "/katalog/"], [m.cname, `/katalog/${m.slug}/`], [`Рис. ${n.fig}`]])}${head1(`<span class="h-fig">Рис. ${n.fig}</span> ${esc(n.title)}`, pn)}
      <div class="node${n.image ? "" : " node-noimg"}">${!n.image ? "" : `<figure class="node-fig"><a class="sheet zoom" href="${u("/" + n.image_large)}" target="_blank" rel="noopener"><img src="${u("/" + n.image)}" srcset="${u("/" + n.image)} 900w, ${u("/" + n.image_large)} 2000w" sizes="(min-width: 1000px) 34vw, 100vw" width="${n.width}" height="${n.height}" alt="Рис. ${n.fig}. ${esc(n.title)}"></a></figure>`}
      <section class="node-spec" aria-label="Перечень деталей"><div class="tools"><label class="tool-f"><span class="sr">Фильтр по перечню</span><input type="search" placeholder="Фильтр по перечню" data-filter autocomplete="off"></label></div>
      ${vars ? `<div class="var-pick"><label for="vsel">Исполнение</label><select id="vsel" data-variant>${n.variants.map((c, i) => `<option value="${i}">${esc(c === "-" ? "основное" : c)}${m.slug === "rrp-300" && c !== "-" ? " (" + esc(m.designation + c) + ")" : ""}</option>`).join("")}</select><span class="muted small">Покажем количество в выбранном исполнении</span></div>` : ""}<div class="tbl"><table class="spec cmp"${vars ? " data-vtable" : ""}><thead><tr><th scope="col" class="c-pos">Поз.</th><th scope="col">Обозначение</th><th scope="col">Наименование</th>${n.variants.map((c, vi) => `<th scope="col" class="c-q" data-v="${vi}" title="${m.slug === "rrp-300" ? esc(m.designation + (c === "-" ? "" : c)) : esc(c)}">${esc(c === "-" ? "основное" : c)}</th>`).join("")}<th scope="col" class="c-buy">Количество</th></tr></thead><tbody>${rows}</tbody></table><p class="none" hidden>В этом узле такой позиции нет.</p></div>
      <ul class="foot-notes">${foot}<li>${vars ? "Количество в изделии по исполнениям; «—»: деталь не входит в исполнение. " : ""}Позиции без числа: деталь не входит.</li></ul></section></div></div>`, ld: [crumbLd([["Запасные части", "/katalog/"], [m.cname, `/katalog/${m.slug}/`], [`Рис. ${n.fig}`]])] });
  });
}

// ---------- part pages ----------
for (const p of parts) {
  const ms = p.models.map((s) => mBy[s]);
  const inNodes = ms.flatMap((m) => (p.figures[m.slug] || []).map((f) => ({ m, f })));
  const first = ms[0];
  const body = `<div class="wrap cat part-page">${crumbs([["Запасные части", "/katalog/"], [first.cname, `/katalog/${first.slug}/`], [p.designation]])}${head1(`${esc(p.name)} ${sku(p.designation)}`)}
    <div class="part-grid"><dl class="req part-kv"><div><dt>Обозначение</dt><dd>${sku(p.designation)}</dd></div><div><dt>Наименование</dt><dd>${esc(p.name)}</dd></div><div><dt>Группа</dt><dd>${esc(p.type)}</dd></div>
      <div><dt>Применяется</dt><dd>${ms.map((m) => `<a href="${u(`/katalog/${m.slug}/`)}">${esc(m.cname)}</a>`).join(", ")}${ms.length > 1 ? ' <span class="muted">(уточните при заказе)</span>' : ""}</dd></div>
      ${inNodes.length ? `<div><dt>На чертежах</dt><dd>${inNodes.map(({ m, f }) => `<a href="${u(`/katalog/${m.slug}/ris-${f}/`)}">${esc(m.cname)}, рис.&nbsp;${f}</a>`).join(", ")}</dd></div>` : ""}
      <div><dt>Цена за ед.</dt><dd>${price(p)}${p.price_rub ? ' <span class="muted">по прайсу 2025 г.</span>' : ""}</dd></div></dl>
      <div class="part-buy"><p class="muted">Добавьте позицию в список запроса и отправьте письмо, или позвоните: <a href="tel:${esc(C.tel)}">${esc(C.phone)}</a>.</p>${buy(p.designation, p.name, ms.map((m) => m.cname).join(", "))}</div></div></div>`;
  const ld = [crumbLd([["Запасные части", "/katalog/"], [first.cname, `/katalog/${first.slug}/`], [p.designation]]), { "@context": "https://schema.org", "@type": "Product", name: p.name, sku: p.designation, brand: { "@type": "Brand", name: C.operator }, description: `${p.name} ${p.designation}, запасная часть для ${ms.map((m) => m.cname).join(", ")}` }];
  page({ url: `/detal/${p.slug}/`, title: `${p.name} ${p.designation}: запчасть для ${ms.map((m) => m.cname).join(", ")}`, description: `${p.name} ${p.designation}, запасная часть для реверс-редукторной передачи ${ms.map((m) => m.cname).join(", ")}. Группа: ${p.type}. Подбор по заводскому каталогу, ООО «Дело», Барнаул.`, section: "katalog", body, ld });
}

// ---------- documents ----------
const hrefOf = (h) => (h.startsWith("/") ? u(h) : u("/" + h));
page({ url: "/dokumenty/", title: "Техническая документация: руководства и каталоги", description: "Руководства по эксплуатации и каталоги деталей судовых реверс-редукторов РРП-300, РРП-3Д6, РРП-3Д12 в PDF и сканах.", section: "dokumenty",
  body: `<div class="wrap cat">${crumbs([["Техническая документация"]])}${head1("Техническая документация", "", "Каталоги и руководства. Новые документы добавляются по мере подготовки.", "art-doc")}${DOCS.map((g) => `<section class="ar-group"><h2>${esc(g.group)}</h2><ul class="ar-list archive">${g.items.map((d) => `<li${d.soon ? ' class="ar-soon"' : ""}><svg class="ar-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2.5h8l4.5 4.5v14.5H6z M14 2.5V7h4.5"/></svg><span class="ar-t">${esc(d.title)}</span><span class="ar-p">${esc(d.product)}</span><span class="ar-f">${d.soon ? '<span class="badge">В подготовке</span>' : esc(d.format)}</span><span class="ar-a">${d.links.map((l) => `<a class="btn btn-line btn-sm" href="${hrefOf(l.href)}"${/\.pdf/.test(l.href) ? ' target="_blank" rel="noopener"' : ""}>${esc(l.label)}</a>`).join("")}</span></li>`).join("")}</ul></section>`).join("")}</div>`, ld: [crumbLd([["Техническая документация"]])] });
page({ url: "/dokumenty/katalog-rrp-300/", title: "Каталог деталей РРП-300: сканы страниц", description: `Сканы ${SCANS.length} страниц каталога деталей реверс-редукторной передачи РРП-300.`, section: "dokumenty",
  body: `<div class="wrap cat">${crumbs([["Техническая документация", "/dokumenty/"], ["Каталог деталей РРП-300"]])}${head1("Каталог деталей РРП-300: сканы страниц", "", `${SCANS.length} страниц. Нажмите страницу, чтобы открыть её в полном размере.`)}<ul class="scans">${SCANS.map((s) => `<li><a href="${u("/" + s.full)}" target="_blank" rel="noopener"><img src="${u("/" + s.thumb)}" width="420" height="305" alt="Страница ${s.n}: ${esc(s.title)}" loading="lazy"><span>${s.n}. ${esc(s.title)}</span></a></li>`).join("")}</ul></div>`, ld: [] });

// ---------- contacts: how to find us (own annotated maps, always visible; Yandex only as links and an optional frame) ----------
{
  const K = S.contacts, ll = `${K.lon}%2C${K.lat}`;
  const widget = `https://yandex.ru/map-widget/v1/?ll=${ll}&z=${K.zoom}&pt=${ll}%2Cpm2rdm`;
  const open = `https://yandex.ru/maps/?ll=${ll}&z=${K.zoom}&pt=${ll}`, route = `https://yandex.ru/maps/?rtext=~${K.lat}%2C${K.lon}&rtt=auto`;
  const fig = (src, n, title, alt, lazy) => `<figure class="find-fig"><a href="${u(src)}" target="_blank" rel="noopener"><img src="${u(src)}" width="1400" height="860" alt="${esc(alt)}"${lazy ? ' loading="lazy"' : ""}></a><figcaption><b>${n}. ${esc(title)}</b> Карта: © участники <a href="https://www.openstreetmap.org/copyright" rel="noopener">OpenStreetMap</a>. Нажмите, чтобы открыть крупнее.</figcaption></figure>`;
  const body = `<div class="wrap cat find-page">${crumbs([["Как нас найти"]])}${head1("Как нас найти", "", `${esc(C.operator)}, ${esc(C.address)}`)}
    <section class="find-top" aria-label="Адрес и маршрут">
      <div class="find-card"><p class="find-k">Адрес</p><p class="find-addr">${esc(C.address)}</p>
        <dl class="find-kv"><div><dt>Телефон</dt><dd><a href="tel:${esc(C.tel)}">${esc(C.phone)}</a></dd></div><div><dt>E-mail</dt><dd><a href="mailto:${esc(C.email)}">${esc(C.email)}</a></dd></div>${K.hours ? `<div><dt>Часы работы</dt><dd>${esc(K.hours)}</dd></div>` : ""}</dl></div>
      <div class="find-card"><p class="find-k">Маршрут</p>
        <p class="find-btns"><a class="btn btn-white" href="${route}" target="_blank" rel="noopener">Построить маршрут в Яндекс.Картах</a><a class="btn btn-line" href="${open}" target="_blank" rel="noopener">Открыть на Яндекс.Картах</a></p>
        <ul class="find-lm">${K.landmarks.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>${K.directions ? `<p class="find-dir"><b>Как добраться.</b> ${esc(K.directions).replace(/\n/g, "<br>")}</p>` : ""}</div>
    </section>
    ${fig("/img/map-close.webp", 1, "Участок и ближайшие улицы.", "Крупный план: здание ООО «Дело» (ул. Зоотехническая, 24) отмечено красным, подсвечены ул. Зоотехническая и ул. Герцена", false)}
    ${fig("/img/map-district.webp", 2, "Район и основные дороги.", "Обзорная карта: расположение ООО «Дело» в районе Южный, подсвечены Змеиногорский тракт и Южный тракт, на севере виден центр Барнаула", true)}
    <details class="find-live" data-map data-src="${widget}"><summary>Интерактивная карта Яндекса</summary><div class="find-facade"><p><button type="button" class="btn btn-white" data-map-load>Показать карту</button></p>
      <p class="muted small">Карту предоставляет Яндекс. При загрузке Яндекс может получать данные о вашем посещении. Если карта не показалась, откройте её <a href="${open}" target="_blank" rel="noopener">на Яндекс.Картах</a>.</p></div></details>
  </div>`;
  page({ url: "/kontakty/", title: "Как нас найти: контакты и схема проезда", description: `${C.operator}: адрес, телефон, e-mail, схема проезда и карта района Южный, Барнаул. ${C.address}.`, section: "kontakty", body,
    ld: [{ ...orgLd, geo: { "@type": "GeoCoordinates", latitude: K.lat, longitude: K.lon } }, crumbLd([["Как нас найти"]])] });
}

// ---------- 404, sitemap, robots, static files ----------
fs.mkdirSync(DIST, { recursive: true });
page({ url: "/404.html", title: "Страница не найдена", description: "Страница не найдена.", section: "", body: `<div class="wrap cat"><h1>Страница не найдена</h1><p>Проверьте адрес или найдите деталь по номеру.</p><form class="cat-search" action="${u("/katalog/vse/")}" method="get" role="search"><label class="sr" for="cs">Номер детали или название</label><input id="cs" type="search" name="q" placeholder="Номер детали или название" autocomplete="off"><button class="btn btn-white" type="submit">Найти</button></form><p>Или откройте <a href="${u("/katalog/")}">каталог запчастей</a>, <a href="${u("/#produkciya")}">нашу продукцию</a>. Телефон: <a href="tel:${esc(C.tel)}">${esc(C.phone)}</a>.</p></div>` });
fs.cpSync(path.join(ROOT, "public"), DIST, { recursive: true });
const urls = written.filter((p) => !p.endsWith(".html"));
fs.writeFileSync(path.join(DIST, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((p) => `<url><loc>${abs(p)}</loc></url>`).join("\n")}\n</urlset>\n`);
fs.writeFileSync(path.join(DIST, "robots.txt"), INDEX ? `User-agent: *\nAllow: /\nSitemap: ${abs("/sitemap.xml")}\n` : "User-agent: *\nDisallow: /\n");
console.log(`built ${written.length} pages into dist/ (BASE="${BASE}", INDEX=${INDEX ? 1 : 0})`);
