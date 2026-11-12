// Browser checks (Chromium + WebKit) against `node scripts/serve.mjs` on :4341 (BASE="" build). Playwright is borrowed from the archived v5-ab.
import { createRequire } from "node:module"; import path from "node:path"; import assert from "node:assert/strict"; import fs from "node:fs";
const require = createRequire(import.meta.url);
const { chromium, webkit } = require(path.resolve(import.meta.dirname, "../../_archive/2026-11-03/v5-ab/node_modules/playwright"));
const U = (p = "/") => `http://localhost:4341${p}`;
for (const [name, eng] of [["chromium", chromium], ["webkit", webkit]]) {
  const b = await eng.launch(); const errs = [];
  for (const [w, h] of [[1360, 900], [390, 844]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h } }); const p = await ctx.newPage();
    p.on("pageerror", (e) => errs.push(e.message)); p.on("requestfailed", (r) => { if (!/abort|cancel/i.test(r.failure()?.errorText || "")) errs.push("failed " + r.url()); }); // aborted = lazy image cut off by our own navigation
    // 1. home: РРП names, drawing, red NEW, warranty, tenders, constructor -> request list
    await p.goto(U()); await p.waitForSelector(".mcard");
    const text = await p.locator("main").innerText();
    for (const n of ["РРП-300", "РРП-238", "РРП-3Д6", "РРП-3Д12", "12 месяцев", "Тендеры"]) assert.ok(text.includes(n), n);
    assert.equal(await p.locator(".mcard-spec", { hasText: "Гарантия" }).count(), 4);
    assert.equal(await p.locator(".models .mcard").last().getAttribute("id"), "model-novaya-razrabotka");
    assert.equal((await p.locator("#model-novaya-razrabotka .stamp, #model-novaya-razrabotka .is-newbig span").first().innerText()).trim(), "NEW");
    const pick = (leg, txt) => p.locator("fieldset.cfg-g", { has: p.locator("legend", { hasText: leg }) }).locator("label.cfg-o", { hasText: new RegExp(`^${txt.replace(/[.()]/g, "\\$&")}$`) }).click();
    assert.equal(await p.locator("fieldset.cfg-g").count(), 8, "owner's 8 constructor fields");
    await pick("Применяемый ДВС", "3Д6"); await pick("Тип РРП", "гидравлический"); await pick("Мощность", "150 л.с."); await pick("обороты", "1500 об/мин");
    await pick("передний ход", "1:2,95"); await pick("задний ход", "1:2,61");
    assert.match(await p.locator("[data-cfg-status]").innerText(), /Серийное исполнение[\s\S]*СБ525-01-13-040/);
    await pick("обороты", "2100 об/мин"); assert.match(await p.locator("[data-cfg-status]").innerText(), /Под заказ/);
    await pick("обороты", "1500 об/мин");
    await p.evaluate(() => localStorage.removeItem("rr-c19-cart")); await p.click("[data-cfg-add]");
    const cart = await p.evaluate(() => JSON.parse(localStorage.getItem("rr-c19-cart")));
    assert.equal(cart.length, 1); assert.equal(cart[0].des, "РРП-300"); assert.ok(/150 л\.с\./.test(cart[0].name) && /1:2,61/.test(cart[0].name) && /СБ525-01-13-040/.test(cart[0].name), cart[0].name);
    assert.equal(await p.locator("#uslugi .sv8-list li a").count(), 0, "services rows are not links");
    assert.equal(await p.locator(".hero-pic.is-fade img").count(), 2, "two hero slides"); assert.equal(await p.locator(".hero-pic img.on").count(), 1);
    await p.waitForFunction(() => document.querySelectorAll(".hero-pic img")[1].classList.contains("on"), null, { timeout: 9000 }); // crossfade moves on
    for (const id of ["rrp-300", "rrp-238", "rrp-3d6", "rrp-3d12", "mufta-ms", "novaya-razrabotka"]) assert.equal(await p.locator(`#model-${id} .mcard-pic img`).count(), 1, `picture on ${id}`);
    // 2. real addresses: card -> model page -> catalog -> node -> part, each its own URL
    await p.locator("#model-rrp-300 .mcard-h a").click(); await p.waitForURL("**/produkciya/rrp-300/"); assert.match(await p.locator("h1").innerText(), /РРП-300/);
    assert.ok(await p.locator("table.vtab tbody tr").count() >= 10, "variants table");
    await p.goto(U("/katalog/rrp-300/")); assert.ok((await p.locator(".tile").count()) === 26, "26 node tiles");
    await p.goto(U("/katalog/rrp-300/ris-3/")); assert.equal(await p.locator("table.spec tbody tr").count(), 16);
    await p.fill("[data-filter]", "прокладка"); assert.ok((await p.locator("table.spec tbody tr:not([hidden])").count()) < 16);
    await p.goto(U("/katalog/rrp-3d6/ris-89/")); assert.ok((await p.locator("table.spec thead th.c-q").count()) === 4, "four 3Д6 variants");
    await p.goto(U("/detal/525-16-113/")); await p.click(".part-buy [data-add]");
    assert.equal(await p.locator("[data-cart-count]").first().innerText(), "2");
    await p.click("[data-cart-open]"); assert.equal(await p.locator("#cart-items li").count(), 2); await p.click("[data-cart-close]");
    // 2b. contacts: one own district map, no Yandex links or frames, corrected address
    await p.goto(U("/kontakty/")); await p.waitForSelector(".find-fig img");
    await p.waitForFunction(() => [...document.querySelectorAll(".find-fig img")].every((i) => i.complete && i.naturalWidth > 0));
    assert.equal(await p.locator(".find-fig").count(), 1); assert.equal(await p.locator("iframe, a[href*='yandex']").count(), 0, "no Yandex");
    assert.match(await p.locator(".find-addr").innerText(), /Зоотехническая, 24Ж$/);
    assert.equal(await p.locator('.find-kv a[href="tel:+73852668419"], footer a[href="tel:+73852668419"]').count(), 2, "second phone on contacts and in footer");
    assert.equal(await p.locator(".strip-r a[href^='tel:']").count(), 2, "both phones in the header strip");
    assert.ok((await p.locator("header.head nav a", { hasText: "Контакты" }).count()) >= 1 || w < 1300, "nav item");
    // 2c. catalog drawing zooms in place and shrinks back, no navigation
    await p.goto(U("/katalog/rrp-300/ris-3/")); await p.click(".node a.zoom");
    assert.equal(await p.locator(".node.is-zoomed").count(), 1); assert.ok(p.url().endsWith("/ris-3/"), "stays on the page");
    await p.click(".node a.zoom"); assert.equal(await p.locator(".node.is-zoomed").count(), 0);
    // 3. catalog list filter from ?q
    await p.goto(U("/katalog/vse/?q=525-16-113")); await p.waitForSelector("table.spec");
    assert.equal(await p.locator("table.spec tbody tr:not([hidden])").count(), 1);
    // 3b. review fixes: count hidden until the first add, catalog search, variant picker, sticky head never over rows, stamp inside its block, one sentence once
    await p.goto(U()); await p.evaluate(() => localStorage.removeItem("rr-c19-cart")); await p.reload();
    assert.equal(await p.locator("[data-cart-count]").first().isHidden(), true, "count hidden while the list is empty");
    await p.goto(U("/detal/525-16-113/")); await p.click(".part-buy [data-add]");
    assert.equal(await p.locator("[data-cart-count]").first().isVisible(), true, "count shown after the first add");
    await p.evaluate(() => localStorage.removeItem("rr-c19-cart"));
    await p.goto(U("/katalog/")); await p.fill("#cs", "525-16-113"); await p.press("#cs", "Enter"); await p.waitForURL("**/katalog/vse/?q=525-16-113");
    assert.equal(await p.locator("table.spec tbody tr:not([hidden])").count(), 1, "catalog search finds the part");
    await p.goto(U("/katalog/rrp-300/ris-1/"));
    const qcol = w >= 700 ? "table.spec th.c-q:visible" : "table.spec tbody tr:first-child td.c-q:visible";
    assert.equal(await p.locator(qcol).count(), 1, "one quantity column");
    await p.selectOption("#vsel", { index: 1 }); assert.match(await p.locator("table.spec [data-v='1']:visible").first().innerText(), /-010|^[\d—–-]+$/);
    if (w >= 700) assert.equal(await p.evaluate(() => { const t = document.querySelector(".tbl"); return t.scrollWidth <= t.clientWidth + 1; }), true, "figure table fits its box");
    if (w >= 1000) {
      await p.goto(U("/katalog/vse/")); await p.fill("[data-filter]", "1225-48");
      assert.equal(await p.evaluate(() => { const th = document.querySelector(".tbl thead th").getBoundingClientRect(), r = [...document.querySelectorAll(".tbl tbody tr")].find((x) => x.offsetParent).getBoundingClientRect(); return th.bottom <= r.top + 1; }), true, "table head sits above the found row");
    }
    await p.goto(U("/produkciya/novaya-razrabotka/"));
    assert.equal(await p.evaluate(() => { const f = document.querySelector(".model-pic").getBoundingClientRect(), s = document.querySelector(".stamp").getBoundingClientRect(); return s.left >= f.left && s.right <= f.right && s.top >= f.top && s.bottom <= f.bottom; }), true, "stamp is not cropped");
    assert.equal(await p.locator("p", { hasText: "Новая модель в линейке" }).count(), 1, "sentence once");
    await p.goto(U("/katalog/")); assert.equal(await p.locator('a[href$="/katalog/rrp-238/"]').count(), 0, "238 has no catalog of its own");
    assert.equal(await p.locator(".mcard-h", { hasText: "РРП-300 и РРП-238" }).count(), 1, "shared 300/238 catalog card");
    assert.equal(await p.locator(".mcard-h", { hasText: "Муфта сцепления" }).count(), 1, "clutch catalog card");
    // request without collecting data: text window + copy, no personal-data fields
    await p.goto(U("/katalog/rrp-3d12/ris-123/")); await p.locator(".btn-add").first().click(); await p.locator("[data-cart-open]").first().click();
    assert.equal(await p.locator("#cart-send").isVisible(), true, "request text window visible");
    const ctext = await p.inputValue("#cart-text"); assert.ok(ctext.includes("1225-17-1") && ctext.includes("Прошу сообщить"), "request text holds the item");
    assert.equal(await p.locator("#cart input:not([data-q]), #cart select").count(), 0, "no personal-data fields in the request dialog");
    assert.equal(await p.locator("#cart [data-cart-mail]").innerText(), "Оставить заявку");
    await p.locator("[data-cart-clear]").click(); assert.equal(await p.locator("#cart-send").isVisible(), false, "text window hidden for an empty list"); await p.keyboard.press("Escape");
    // 4. no horizontal overflow on the main page types
    for (const pg of ["/", "/produkciya/rrp-300/", "/katalog/", "/katalog/rrp-300/", "/katalog/rrp-300/ris-3/", "/katalog/rrp-3d12/", "/katalog/rrp-3d12/ris-123/", "/katalog/rrp-3d12/ris-134/", "/katalog/mufta-ms/", "/katalog/mufta-ms/ris-137/", "/detal/525-16-113/", "/dokumenty/", "/kontakty/"]) {
      await p.goto(U(pg)); await p.waitForLoadState("load");
      const over = await p.evaluate(() => { const bad = []; if (document.documentElement.scrollWidth > innerWidth) bad.push("page " + document.documentElement.scrollWidth); return bad; });
      assert.deepEqual(over, [], `${pg} @${w}`);
    }
    await ctx.close();
  }
  // 4b. width sweep (a desktop window narrowed by a side panel is every width, not only 390 and 1360): no page overflow, header
  //     fits every 20 px from 700 to 1900, nothing visible sticks out of the viewport, the request list stays inside the window
  {
    const PAGES = ["/", "/produkciya/rrp-300/", "/katalog/", "/katalog/rrp-300/", "/katalog/rrp-300/ris-3/", "/katalog/rrp-3d12/", "/katalog/rrp-3d12/ris-123/", "/katalog/rrp-3d12/ris-134/", "/katalog/mufta-ms/", "/katalog/mufta-ms/ris-137/", "/katalog/vse/", "/detal/525-16-113/", "/dokumenty/", "/kontakty/"];
    const items = Array.from({ length: 12 }, (_, i) => ({ des: "525-16-" + (100 + i), name: "Тестовая деталь с длинным названием для переноса " + i, where: "РРП-300, рис. 3, поз. " + i, q: 3 }));
    const p = await (await b.newContext({ viewport: { width: 1000, height: 700 } })).newPage(); const bad = [];
    await p.goto(U());
    for (let w = 700; w <= 1900; w += 20) { await p.setViewportSize({ width: w, height: 700 });
      const r = await p.evaluate(() => { const W = innerWidth, q = (s) => document.querySelector(s).getBoundingClientRect(), btn = q(".btn-list"), nav = q(".nav"), brand = q(".brand"); const showNav = nav.width > 0;
        return btn.right > W || document.documentElement.scrollWidth > W || (showNav && (btn.left < nav.right || nav.left < brand.right)); });
      if (r) bad.push("header @" + w); }
    for (const w of [320, 360, 390, 430, 500, 620, 800, 1000, 1200, 1300, 1400]) {
      await p.setViewportSize({ width: w, height: 600 });
      for (const pg of PAGES) { await p.goto(U(pg)); await p.waitForLoadState("load");
        const r = await p.evaluate(() => { const W = innerWidth, out = []; if (document.documentElement.scrollWidth > W) out.push("page " + document.documentElement.scrollWidth);
          for (const e of document.querySelectorAll("body *")) { const cs = getComputedStyle(e); if (cs.display === "none" || cs.visibility === "hidden") continue; const b = e.getBoundingClientRect(); if (!b.width || e.closest("dialog:not([open]), details:not([open]) > :not(summary), .tbl, .tools, [hidden], .sr")) continue; if (b.right > W + 1 || b.left < -1) { out.push(e.tagName + "." + String(e.className).slice(0, 24)); break; } } return out; });
        if (r.length) bad.push(`${pg} @${w}: ${r.join(",")}`); }
      await p.goto(U()); await p.evaluate((it) => localStorage.setItem("rr-c19-cart", JSON.stringify(it)), items); await p.reload(); await p.click("[data-cart-open]");
      const d = await p.evaluate(() => { const r = document.querySelector("#cart").getBoundingClientRect(), c = document.querySelector("[data-cart-close]").getBoundingClientRect(); return r.left < 0 || r.right > innerWidth || r.top < 0 || r.bottom > innerHeight || c.right > innerWidth || c.bottom > innerHeight; });
      if (d) bad.push("cart @" + w); await p.evaluate(() => document.querySelector("#cart").close()); }
    assert.deepEqual(bad, [], bad.slice(0, 12).join("\n")); await p.context().close();
  }
  assert.deepEqual(errs, [], errs.join("\n")); console.log(name, "ok"); await b.close();
}
// 5. admins: both read the same config.yml; the test swaps the git backend for the in-browser test backend (no network writes)
const cfgText = (name) => fs.readFileSync(path.resolve(import.meta.dirname, "../public/admin/config.yml"), "utf8").replace(/backend:\n  name: github\n  repo: .*\n  branch: .*\n/, `backend:\n  name: test-repo\n  repo: test/test\n`).replace("local_backend: true\n", "");
async function adminPage(b, url, loginName) {
  const p = await (await b.newContext({ viewport: { width: 1360, height: 900 }, locale: "ru-RU" })).newPage(); const errs = [];
  p.on("pageerror", (e) => errs.push(e.message)); await p.route(/admin\/config\.yml/, (r) => r.fulfill({ contentType: "text/yaml", body: cfgText() }));
  await p.goto(U(url)); await p.getByRole("button", { name: loginName }).click(); return { p, errs };
}
{
  const b = await chromium.launch();
  // 5a. Sveltia (/admin-sveltia/): collections, create a part through the form, it shows in the list
  const ch = await (await b.newContext()).newPage(); await ch.goto(U("/admin/"));
  assert.equal(await ch.locator('a.btn[href="../admin-sveltia/"]').count(), 1); assert.equal(await ch.locator('a.btn[href="../admin-decap/"]').count(), 1); await ch.close();
  let { p, errs } = await adminPage(b, "/admin-sveltia/", /Test Repository|тестов/i);
  for (const t of ["Настройки сайта", "Продукция (модели)", "Запасные части"]) await p.getByText(t, { exact: true }).first().waitFor({ timeout: 30000 });
  await p.goto(U("/admin-sveltia/#/collections/parts/new"));
  await p.getByRole("textbox", { name: /Обозначение/ }).fill("999-TEST-1"); await p.getByRole("textbox", { name: /Наименование/ }).fill("Тестовая деталь");
  await p.getByRole("combobox", { name: /Группа/ }).click(); await p.getByRole("option", { name: "Кольца" }).click(); await p.getByRole("checkbox", { name: "rrp-300" }).check();
  await p.getByRole("button", { name: "Сохранить" }).click(); await p.goto(U("/admin-sveltia/#/collections/parts"));
  await p.getByText("999-TEST-1").first().waitFor({ timeout: 15000 });
  if (process.env.ADMIN_SHOT) await p.screenshot({ path: process.env.ADMIN_SHOT });
  assert.deepEqual(errs, [], errs.join("\n")); console.log("admin (Sveltia) ok");
  // 5b. Decap (/admin-decap/): loads, lists the collections, new-part form has the fields
  ({ p, errs } = await adminPage(b, "/admin-decap/", "Войти"));
  await p.waitForSelector('a[href^="#/collections/"]', { timeout: 30000 }); const side = await p.locator('a[href^="#/collections/"]').allInnerTexts();
  for (const t of ["Настройки сайта", "Продукция (модели)", "Запасные части"]) assert.ok(side.some((x) => x.includes(t)), t);
  await p.goto(U("/admin-decap/#/collections/parts/new")); for (const l of ["Обозначение", "Наименование", "Группа"]) await p.getByText(l, { exact: true }).first().waitFor({ timeout: 20000 });
  assert.deepEqual(errs, [], errs.join("\n")); console.log("admin (Decap) ok"); await b.close();
}
