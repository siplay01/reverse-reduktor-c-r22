// c-r19 client code: request list (localStorage, mail draft only on a click), РРП constructor, table filter, requisites copy.
(() => {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const norm = (s) => String(s).toLowerCase().replace(/[\s\-–.]/g, "").replace(/ё/g, "е");
  const KEY = "rr-c19-cart"; let cart = [];
  try { cart = JSON.parse(localStorage.getItem(KEY)) || []; } catch { cart = []; }
  const toast = (msg) => { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 2400); };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(cart)); } catch {} renderCart(); };
  function add(des, name, where, q = 1) { const it = cart.find((c) => c.des === des && c.where === where); if (it) it.q += q; else cart.push({ des, name, where, q }); save(); toast(`${des}: ${q} шт. в списке запроса`); }
  const cartText = () => cart.map((c, i) => `${i + 1}. ${c.des} ${c.name} (${c.where}), ${c.q} шт.`).join("\n");
  const mailBody = () => `Здравствуйте!\n\nПрошу сообщить наличие, цену и срок поставки:\n\n${cartText()}\n\nОрганизация:\nКонтактное лицо:\nТелефон:\n`;
  function renderCart() {
    const total = cart.reduce((s, c) => s + c.q, 0);
    $$("[data-cart-count]").forEach((el) => { el.textContent = total; el.hidden = total === 0; });
    $$("[data-cart-open]").forEach((el) => el.setAttribute("aria-label", total ? `Список запроса, всего ${total} шт.` : "Список запроса"));
    $("#cart-empty").hidden = cart.length > 0; $$("#cart [data-need-items]").forEach((b) => { b.disabled = !cart.length; });
    $("#cart-send").hidden = !cart.length; $("#cart-text").value = cart.length ? mailBody() : "";
    $("#cart-items").innerHTML = cart.map((c, i) => `<li><div><span class="sku" translate="no">${esc(c.des)}</span><span>${esc(c.name)}</span><small>${esc(c.where)}</small></div><label class="sr" for="cq${i}">Количество, ${esc(c.des)}</label><input id="cq${i}" type="number" min="1" inputmode="numeric" value="${c.q}" data-q="${i}"><button type="button" class="cart-x" data-x="${i}" aria-label="Убрать ${esc(c.des)}">×</button></li>`).join("");
  }
  // ---- constructor: owner's fields (settings.json), model preset; "серийное исполнение" when the choice matches a РРП-300 variant row
  const box = $("[data-config]"), cfgEl = $("#cfg-data");
  const CFG = box && cfgEl ? JSON.parse(cfgEl.textContent) : { groups: [] }, groups = CFG.groups || [], sel = {};
  groups.forEach((g) => { sel[g.key] = (CFG.preset || {})[g.key] ?? g.options[0]; });
  const withUnit = (g, o) => (/^\d/.test(o) ? o + (g.unit || "") : o);
  const modelName = () => box.dataset.model || (sel.type === "механический" ? (sel.engine === "3Д12" ? "РРП-3Д12" : sel.engine === "3Д6" ? "РРП-3Д6" : "РРП, механический") : sel.engine === "серия ЯМЗ" ? "РРП-238" : /^3Д/.test(sel.engine) ? "РРП-300" : "РРП, гидравлический");
  function status() {
    const sr = CFG.serial; if (!sr || sel.type !== "гидравлический" || !/^3Д/.test(sel.engine) || sel.rpm !== "1500") return null;
    const hit = sr.variants.filter((v) => String(v.hp) === sel.hp && v.forward === sel.fwd && v.reverse === sel.rev);
    return hit.length ? hit.map((v) => `${sr.designation}${v.code === "-" ? "" : v.code} (${v.rotation} вращение, муфта ${v.fingers}-пальцевая)`) : null;
  }
  const cfgLine = () => { const st = status(); return groups.map((g) => `${g.label.replace("Передаточное отношение, ", "").toLowerCase()}: ${withUnit(g, sel[g.key])}`).join(", ") + (st ? `; серийное исполнение ${st.map((x) => x.split(" (")[0]).join(" или ")}` : "; под заказ"); };
  function renderConfig() {
    if (!groups.length) return; const st = status();
    box.innerHTML = `<div class="cfg-groups">${groups.map((g) => `<fieldset class="cfg-g"><legend>${esc(g.label)}</legend><div class="cfg-opts">${g.options.map((o) => `<label class="cfg-o"><input type="radio" name="cfg-${g.key}" value="${esc(o)}" data-cfg="${g.key}"${sel[g.key] === o ? " checked" : ""}><span>${esc(withUnit(g, o))}</span></label>`).join("")}</div></fieldset>`).join("")}</div>` +
      `<aside class="cfg-res" aria-live="polite"><p class="cfg-k">Ваша конфигурация</p><p class="cfg-name">${esc(modelName())}</p><ul class="cfg-sum">${groups.map((g) => `<li><span>${esc(g.label)}</span><b>${esc(withUnit(g, sel[g.key]))}</b></li>`).join("")}</ul>` +
      `<p class="cfg-st ${st ? "is-serial" : "is-order"}" data-cfg-status>${st ? `<b>Серийное исполнение</b>${st.map((x) => `<span>${esc(x)}</span>`).join("")}` : `<b>Под заказ</b><span>Возможность и сроки подтвердит инженер.</span>`}</p>` +
      `<p class="cfg-note">Гарантия 12 месяцев.</p><p class="cfg-btns"><button type="button" class="btn btn-white" data-cfg-add>В список запроса</button></p></aside>`;
  }
  // ---- table filter
  function filterRows(input) {
    const wrap = input.closest(".node-spec, .cat, .wrap") || document, nq = norm(input.value); let shown = 0;
    $$("table.spec tbody tr", wrap).forEach((tr) => { const hit = !nq || norm(tr.textContent).includes(nq); tr.hidden = !hit; shown += hit; });
    const none = $(".none", wrap); if (none) none.hidden = shown > 0;
  }
  document.addEventListener("click", (e) => {
    const t = e.target;
    // catalog drawing: zoom in place (full width above the parts list), second click shrinks it back; the link stays as the no-JS fallback
    const z = t.closest(".node a.zoom"); if (z) { e.preventDefault(); const on = z.closest(".node").classList.toggle("is-zoomed"); z.setAttribute("aria-expanded", on); $("img", z).sizes = on ? "100vw" : "(min-width: 1000px) 34vw, 100vw"; z.scrollIntoView({ block: "start" }); return; }
    if (t.closest("[data-cfg-add]")) add(modelName(), cfgLine(), "Конструктор", 1);
    const a = t.closest("[data-add]"); if (a) add(a.dataset.add, a.dataset.name, a.dataset.where, Math.max(1, parseInt(a.parentElement.querySelector("[data-qty]")?.value, 10) || 1));
    if (t.closest("[data-cart-open]")) { renderCart(); $("#cart").showModal(); }
    if (t.closest("[data-cart-close]") || t.id === "cart") $("#cart").close();
    const x = t.closest("[data-x]"); if (x) { cart.splice(+x.dataset.x, 1); save(); }
    if (t.closest("[data-cart-clear]")) { cart = []; save(); }
    const copyTxt = (txt, ok) => navigator.clipboard.writeText(txt).then(() => toast(ok), () => { const ta = $("#cart-text"); ta.focus(); ta.select(); toast("Не удалось скопировать: текст выделен, нажмите Cmd/Ctrl+C"); });
    if (t.closest("[data-cart-copy]")) copyTxt(mailBody(), "Текст заявки скопирован");
    if (t.closest("[data-cart-copy-addr]")) copyTxt($("#cart").dataset.mail, "Адрес скопирован");
    if (t.closest("[data-cart-mail]")) location.href = `mailto:${$("#cart").dataset.mail}?subject=${encodeURIComponent("Запрос запчастей, реверс-редукторы")}&body=${encodeURIComponent(mailBody())}`;
    if (t.closest("[data-copy-req]")) navigator.clipboard.writeText($$("#req div").map((d) => `${d.querySelector("dt").textContent}: ${d.querySelector("dd").textContent}`).join("\n")).then(() => toast("Реквизиты скопированы"), () => toast("Не удалось скопировать: выделите реквизиты вручную"));
  });
  // ---- variant picker on figure pages: show one quantity column; the choice is remembered for the session
  const vtab = $("[data-vtable]"), vsel = $("[data-variant]"), VKEY = "rr-c19-variant";
  function showVariant(i) {
    vtab.classList.remove("cmp"); vtab.classList.add("vsel");
    $$("[data-v]", vtab).forEach((c) => { c.hidden = c.dataset.v !== String(i); });
    $$("tbody tr", vtab).forEach((tr) => { const c = tr.querySelector(`td[data-v="${i}"]`); tr.classList.toggle("na", !!c && /^[—–-]$/.test(c.textContent.trim())); });
  }
  if (vtab && vsel) {
    let saved = null; try { saved = sessionStorage.getItem(VKEY); } catch {}
    const idx = [...vsel.options].findIndex((o) => o.textContent.split(" (")[0] === saved);
    if (idx > 0) vsel.selectedIndex = idx;
    showVariant(vsel.selectedIndex);
    vsel.addEventListener("change", () => { showVariant(vsel.selectedIndex); try { sessionStorage.setItem(VKEY, vsel.selectedOptions[0].textContent.split(" (")[0]); } catch {} });
  }
  document.addEventListener("input", (e) => { if (e.target.matches("[data-filter]")) filterRows(e.target); });
  document.addEventListener("change", (e) => {
    const t = e.target;
    if (t.matches("[data-cfg]")) { sel[t.dataset.cfg] = t.value; renderConfig(); $(`[data-cfg="${t.dataset.cfg}"]:checked`)?.focus(); }
    if (t.matches("[data-q]")) { cart[+t.dataset.q].q = Math.max(1, parseInt(t.value, 10) || 1); save(); }
  });
  const q0 = new URLSearchParams(location.search).get("q"), f0 = $("[data-filter]"); if (q0 && f0) { f0.value = q0; filterRows(f0); }
  // ---- hero crossfade: next picture every N seconds; stops on hover/focus and when the visitor asks for reduced motion
  const fade = $("[data-fade]");
  if (fade && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const imgs = $$("img", fade); let k = 0, hold = false;
    ["mouseenter", "focusin"].forEach((e) => fade.addEventListener(e, () => { hold = true; }));
    ["mouseleave", "focusout"].forEach((e) => fade.addEventListener(e, () => { hold = false; }));
    setInterval(() => { if (hold || document.hidden) return; imgs[k].classList.remove("on"); k = (k + 1) % imgs.length; imgs[k].classList.add("on"); const c = $("figcaption", fade); if (c) { c.firstChild.textContent = imgs[k].dataset.cap; c.lastChild.textContent = imgs[k].dataset.note; } }, +fade.dataset.fade * 1000);
  }
  renderConfig(); renderCart();
})();
