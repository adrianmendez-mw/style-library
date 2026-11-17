// Style Library: static, data-driven. Content lives in data/library.json.
const $ = (s, el = document) => el.querySelector(s);
const esc = (s = "") => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const slug = s => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const state = { style: "all", section: "all", view: "grid", query: "" };

const res = await fetch("data/library.json", { cache: "no-cache" });
const { categories, entries, sections: sectionList = [] } = await res.json();
const catById = Object.fromEntries(categories.map(c => [c.id, c]));
// Section types: the canonical list first, then any extra values used by entries.
const sections = [...new Set([...sectionList, ...entries.map(e => e.section).filter(Boolean)])];

readHash();
render();
window.addEventListener("hashchange", () => { readHash(); render(); });

$("#search").addEventListener("input", e => { state.query = e.target.value.trim().toLowerCase(); render(); });
$("#addBtn").addEventListener("click", openAdd);

/* ---------- routing: #style=<id>&section=<slug> | #view=vocabulary | #entry=<id> ---------- */
function readHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  const entryId = p.get("entry");
  if (entryId) { openEntry(entryId); return; }
  state.style = p.get("style") || "all";
  state.section = p.get("section") || "all";
  state.view = p.get("view") === "vocabulary" ? "vocabulary" : "grid";
  if ($("#modal").open) $("#modal").close();
}
function hashFor({ style = state.style, section = state.section, view = "grid" } = {}) {
  if (view === "vocabulary") return "#view=vocabulary";
  const p = new URLSearchParams();
  if (style !== "all") p.set("style", style);
  if (section !== "all") p.set("section", section);
  return p.toString() ? `#${p}` : location.pathname;
}
function go(next) {
  const h = hashFor(next);
  if (h === location.pathname) { history.pushState(null, "", h); readHash(); render(); }
  else location.hash = h;
}

/* ---------- rendering ---------- */
function render() {
  renderChips();
  const isVocab = state.view === "vocabulary";
  $("#vocab").hidden = !isVocab;
  $("#grid").hidden = isVocab;
  $("#sectionChips").hidden = isVocab;
  const cat = !isVocab && catById[state.style];
  $("#guide").hidden = !cat;
  if (cat) $("#guide").innerHTML = guideHTML(cat, true);
  if (isVocab) {
    $("#vocab").innerHTML = categories.map(c => `<section class="guide">${guideHTML(c, false)}</section>`).join("");
    $("#empty").hidden = true;
  } else renderGrid();
  $("#count").textContent = `${entries.length} entries / ${categories.length} styles / ${sections.length} section types`;
}

function chip(group, id, label, n, pressed, alt = "") {
  return `<button class="chip ${alt}" type="button" data-g="${group}" data-f="${esc(id)}" aria-pressed="${pressed}"${n === 0 ? " data-empty" : ""}>${esc(label)}${n != null ? `<span>${n}</span>` : ""}</button>`;
}
function renderChips() {
  const isVocab = state.view === "vocabulary";
  // Style counts respect the active section, section counts respect the active style.
  const inSection = entries.filter(e => state.section === "all" || slug(e.section) === state.section);
  const inStyle = entries.filter(e => state.style === "all" || e.category === state.style);
  const styleN = id => inSection.filter(e => e.category === id).length;
  const sectionN = s => inStyle.filter(e => slug(e.section) === slug(s)).length;

  $("#chips").innerHTML = `<span class="chips__label">Style</span>` +
    chip("style", "all", "All", inSection.length, !isVocab && state.style === "all") +
    categories.map(c => chip("style", c.id, c.name, styleN(c.id), !isVocab && state.style === c.id)).join("") +
    chip("view", "vocabulary", "◈ Style vocabulary", categories.length, isVocab, "chip--alt");
  $("#sectionChips").innerHTML = `<span class="chips__label">Section</span>` +
    chip("section", "all", "Any", inStyle.length, state.section === "all") +
    sections.map(s => chip("section", slug(s), s, sectionN(s), state.section === slug(s))).join("");

  document.querySelectorAll(".chip").forEach(b => b.onclick = () => {
    const { g, f } = b.dataset;
    if (g === "view") go({ view: "vocabulary" });
    else if (g === "style") go({ style: f });
    else go({ section: f });
  });
}

function matches(e) {
  if (state.style !== "all" && e.category !== state.style) return false;
  if (state.section !== "all" && slug(e.section) !== state.section) return false;
  if (!state.query) return true;
  const c = catById[e.category] || {};
  const hay = [e.title, e.tagline, e.description, e.section, e.fonts, ...(e.tags || []), ...(e.anatomy || []), c.name, ...(c.vocabulary || [])].join(" ").toLowerCase();
  return state.query.split(/\s+/).every(q => hay.includes(q));
}

function renderGrid() {
  const list = entries.filter(matches);
  $("#empty").hidden = list.length > 0;
  $("#grid").innerHTML = list.map(e => {
    const c = catById[e.category] || { name: e.category };
    const idx = entries.indexOf(e) + 1;
    const tags = e.tags || [];
    return `<button class="card" type="button" data-id="${esc(e.id)}">
      <div class="thumb">${thumb(e)}${e.section ? `<span class="thumb__badge">${esc(e.section)}</span>` : ""}${isAnimated(e.image) ? `<span class="thumb__badge thumb__badge--r">GIF</span>` : ""}</div>
      <div class="card__body">
        <div class="card__head"><h3 class="card__title">${esc(e.title)}</h3><span class="card__tagline">${esc(e.tagline || "")}</span></div>
        <div class="tags">${tags.slice(0, 3).map(t => `<span class="tag">${esc(t)}</span>`).join("")}${tags.length > 3 ? `<span class="tag tag--more">+${tags.length - 3}</span>` : ""}</div>
        <div class="card__foot"><span><b>◆</b>${esc(c.name)}</span><span class="card__num">${String(idx).padStart(2, "0")} / ${String(entries.length).padStart(2, "0")}</span></div>
      </div>
    </button>`;
  }).join("");
  $("#grid").querySelectorAll(".card").forEach(b => b.onclick = () => (location.hash = `entry=${b.dataset.id}`));
}
function isAnimated(src) { return /\.gif($|\?)/i.test(src || ""); }

function guideHTML(c, withCount) {
  const n = entries.filter(e => e.category === c.id).length;
  return `<div>
      <p class="eyebrow">style guide${withCount ? `, ${n} entr${n === 1 ? "y" : "ies"}` : ""}</p>
      <h2>${esc(c.name)}</h2>
      <p>${esc(c.summary)}</p>
      <p class="label">Vocabulary</p>
      <div class="tags">${(c.vocabulary || []).map(v => `<span class="tag">${esc(v)}</span>`).join("")}</div>
      ${withCount ? "" : `<p style="margin-top:18px"><a class="btn btn--ghost" href="#style=${esc(c.id)}">See ${n} example${n === 1 ? "" : "s"} →</a></p>`}
    </div>
    <dl>
      ${[["Type", c.typography], ["Color", c.color], ["Layout", c.layout], ["Motion", c.motion], ["Use when", c.useWhen], ["Avoid", c.avoid]]
        .filter(([, v]) => v).map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("")}
    </dl>`;
}

/* ---------- entry modal ---------- */
function openEntry(id) {
  const e = entries.find(x => x.id === id);
  if (!e) return;
  const c = catById[e.category] || { name: e.category };
  const m = $("#modal");
  // Highlight placeholders like [BRAND] or [CONTENT: ...] the user should fill in.
  const prompt = esc(e.prompt || "").replace(/\[([A-Z][A-Z _-]*(?::[^\]]*)?)\]/g, "<mark>[$1]</mark>");
  m.innerHTML = `
    <div class="modal__media">${e.image ? `<img src="${esc(e.image)}" alt="${esc(e.title)} screenshot">` : thumb(e)}</div>
    <div class="modal__body">
      <div class="modal__head"><h2 class="modal__title">${esc(e.title)}</h2><span class="modal__meta">${esc(e.tagline || "")}</span></div>
      <p class="modal__desc">${esc(e.description || "")}</p>
      <p class="modal__meta"><a href="#style=${esc(c.id || "")}">${esc(c.name)}</a>${e.section ? ` / <a href="#section=${slug(e.section)}">${esc(e.section)}</a>` : ""}${e.url ? ` / <a href="${esc(e.url)}" target="_blank" rel="noopener">Visit site ↗</a>` : ""}</p>
      <div class="tags">${(e.tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join("")}</div>
      <div class="specs">
        ${e.anatomy?.length ? `<div><p class="label">Anatomy</p><ol class="anatomy">${e.anatomy.map(a => `<li>${esc(a)}</li>`).join("")}</ol></div>` : ""}
        <div>
          ${e.fonts ? `<p class="label">Type</p><p class="spec">${esc(e.fonts)}</p>` : ""}
          ${e.palette?.length ? `<p class="label">Palette</p><div class="palette">${e.palette.map(p => `<span class="swatch"><i style="background:${esc(p)}"></i>${esc(p)}</span>`).join("")}</div>` : ""}
        </div>
      </div>
      ${e.prompt ? `<div class="recipe"><p class="label">Build prompt: fill the highlighted parts</p>${prompt}</div>` : ""}
      <div class="actions">
        ${e.prompt ? `<button class="btn" data-copy="prompt" type="button">Copy build prompt</button>` : ""}
        <button class="btn" data-copy="brief" type="button">Copy style brief</button>
        <button class="btn btn--ghost" data-close type="button">Close</button>
      </div>
    </div>`;
  m.querySelector("[data-close]").onclick = () => m.close();
  m.querySelectorAll("[data-copy]").forEach(b => b.onclick = () => copy(b.dataset.copy === "brief" ? brief(e, c) : e.prompt));
  m.onclose = () => { if (location.hash.startsWith("#entry=")) history.replaceState(null, "", hashFor()); };
  m.onclick = ev => { if (ev.target === m) m.close(); };
  if (!m.open) m.showModal();
}

function brief(e, c) {
  return [
    `${e.title}: ${e.section || "section"} in the ${c.name} style${e.tagline ? ` (${e.tagline})` : ""}`,
    e.description,
    "",
    e.anatomy?.length && `Anatomy:\n${e.anatomy.map((a, i) => `${i + 1}. ${a}`).join("\n")}`,
    `Key moves: ${(e.tags || []).join(", ")}`,
    e.fonts && `Type: ${e.fonts}`,
    e.palette?.length && `Palette: ${e.palette.join(" ")}`,
    "",
    `Style (${c.name}): ${c.summary || ""}`,
    c.layout && `Layout: ${c.layout}`,
    c.motion && `Motion: ${c.motion}`,
    c.avoid && `Avoid: ${c.avoid}`,
    e.url && `Reference: ${e.url}`
  ].filter(x => x !== undefined && x !== false && x !== null).join("\n");
}

async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast("Copied"); }
  catch { toast("Copy failed, select the text manually"); }
}
function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("is-on");
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("is-on"), 1600);
}

/* ---------- add entry helper: builds JSON to paste into library.json ---------- */
function openAdd() {
  const m = $("#addModal");
  m.innerHTML = `<div class="modal__body">
    <div class="modal__head"><h2 class="modal__title">Add entry</h2><span class="modal__meta">Generates JSON for data/library.json</span></div>
    <form class="form" id="addForm" style="margin-top:20px">
      <label>Title<input name="title" required></label>
      <label>Style<select name="category">${categories.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join("")}</select></label>
      <label>Section type<input name="section" list="sectionOpts" placeholder="Pricing"><datalist id="sectionOpts">${sections.map(s => `<option value="${esc(s)}">`).join("")}</datalist></label>
      <label>URL<input name="url" type="url" placeholder="https://"></label>
      <label>Tagline<input name="tagline" placeholder="earthy soft UI x stepped cards"></label>
      <label>Screenshot or GIF path<input name="image" placeholder="shots/my-site-pricing.gif"></label>
      <label class="full">Description<textarea name="description"></textarea></label>
      <label class="full">Anatomy (one part per line)<textarea name="anatomy" placeholder="Headline top-left&#10;Three cards, ascending heights"></textarea></label>
      <label class="full">Tags (comma separated)<input name="tags"></label>
      <label>Type<input name="fonts" placeholder="Rounded grotesk, 400/500"></label>
      <label>Palette (hex, comma separated)<input name="palette" placeholder="#3A3D2C, #E4F0B4"></label>
      <label class="full">Build prompt<textarea name="prompt" placeholder="Build a [SECTION] for [BRAND] with..."></textarea></label>
    </form>
    <textarea class="out" id="addOut" readonly></textarea>
    <div class="actions">
      <button class="btn" id="addCopy" type="button">Copy JSON</button>
      <button class="btn btn--ghost" id="addClose" type="button">Close</button>
    </div></div>`;
  const form = $("#addForm", m), out = $("#addOut", m);
  const list = (s, sep = ",") => s.split(sep).map(x => x.trim()).filter(Boolean);
  const update = () => {
    const f = Object.fromEntries(new FormData(form));
    out.value = JSON.stringify({ id: slug(f.title) || "untitled", title: f.title, url: f.url, category: f.category, section: f.section,
      tagline: f.tagline, description: f.description, anatomy: list(f.anatomy, "\n"), tags: list(f.tags), fonts: f.fonts,
      palette: list(f.palette), image: f.image, prompt: f.prompt }, null, 2) + ",";
  };
  form.oninput = update; update();
  $("#addCopy", m).onclick = () => copy(out.value);
  $("#addClose", m).onclick = () => m.close();
  m.showModal();
}

/* ---------- generated placeholder art, one motif per style ---------- */
function rng(seed) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0) / 4294967296;
}
function thumb(e) {
  if (e.image) return `<img src="${esc(e.image)}" alt="" loading="lazy">`;
  const [bg = "#eee", ink = "#222", a1 = ink, a2 = a1] = e.palette || [];
  const r = rng(e.id), W = 800, H = 500;
  let g = "";
  switch (e.category) {
    case "print-tech-paper":
      for (let y = 0; y < H; y += 14) for (let x = 0; x < W; x += 14) {
        const d = Math.hypot(x - W * .55, y - H * .6) / 300;
        const rad = Math.max(0, 6 * (1 - d) + r() * .8);
        if (rad > .6) g += `<circle cx="${x}" cy="${y}" r="${rad.toFixed(1)}" fill="${y > H * .65 ? a2 : a1}" opacity=".85"/>`;
      }
      g += `<text x="30" y="40" font-family="monospace" font-size="13" fill="${ink}">34.0522° N</text><text x="${W - 140}" y="${H - 24}" font-family="monospace" font-size="13" fill="${ink}">118.2437° W</text>`;
      break;
    case "dither-mono":
      for (let y = 0; y < H; y += 10) for (let x = 0; x < W; x += 10) {
        const v = (x / W) * .6 + Math.sin(y / 60 + x / 120) * .25 + .2;
        if (r() < v) g += `<rect x="${x}" y="${y}" width="10" height="10" fill="${ink}"/>`;
      }
      break;
    case "vast-quiet-cinematic":
      g += `<defs><linearGradient id="s${e.id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a2}"/><stop offset=".7" stop-color="${bg}"/></linearGradient></defs>
        <rect width="${W}" height="${H}" fill="url(#s${e.id})"/><rect y="${H * .72}" width="${W}" height="${H * .28}" fill="${ink}" opacity=".85"/>
        <rect x="${W * .62}" y="${H * .68}" width="3" height="16" fill="${ink}"/>
        <text x="${W / 2}" y="${H * .38}" text-anchor="middle" font-family="Georgia,serif" font-size="22" fill="${ink}" opacity=".75">a quiet line of copy</text>`;
      break;
    case "data-as-texture":
      for (let i = 0; i < 22; i++) g += `<ellipse cx="${W / 2 + i * 2}" cy="${H / 2 - i * 3}" rx="${200 - i * 8}" ry="${120 - i * 4.5}" fill="none" stroke="${ink}" stroke-width="1"/>`;
      g += `<rect x="40" y="${H - 120}" width="200" height="80" fill="${a2}" stroke="${ink}"/><text x="54" y="${H - 90}" font-family="monospace" font-size="12" fill="${ink}">TXN 0042 / -$14.00</text><text x="54" y="${H - 66}" font-family="monospace" font-size="12" fill="${a1}">VERIFIED</text>`;
      break;
    case "classical-remix":
      g += `<rect x="${W * .55}" y="40" width="${W * .35}" height="${H - 80}" fill="${a1}"/><circle cx="${W * .45}" cy="${H * .5}" r="150" fill="${a2}"/><circle cx="${W * .45}" cy="${H * .42}" r="70" fill="${bg}" stroke="${ink}"/>
        <text x="40" y="${H - 40}" font-family="Georgia,serif" font-style="italic" font-size="28" fill="${ink}">No. XIV</text>`;
      break;
    case "glitched-antiquity":
      for (let y = 0; y < H; y += 12 + r() * 20) {
        const h = 6 + r() * 18, off = (r() - .5) * 120;
        g += `<rect x="${off}" y="${y}" width="${W}" height="${h}" fill="${[a1, a2, bg][Math.floor(r() * 3)]}" opacity="${.4 + r() * .6}"/>`;
      }
      break;
    case "illustrated-storybook":
      g += `<path d="M0 ${H * .7} Q ${W * .25} ${H * .35} ${W * .5} ${H * .62} T ${W} ${H * .55} V ${H} H 0Z" fill="${a1}"/>
        <path d="M0 ${H * .82} Q ${W * .35} ${H * .6} ${W * .7} ${H * .8} T ${W} ${H * .75} V ${H} H 0Z" fill="${a2 || a1}"/>
        <circle cx="${W * .78}" cy="${H * .22}" r="40" fill="${ink}" opacity=".25"/>`;
      break;
    case "swiss-grid":
      g += `<rect x="${W * .5}" y="0" width="${W * .5}" height="${H * .55}" fill="${a1}"/>
        <text x="30" y="${H - 40}" font-family="Helvetica,Arial,sans-serif" font-weight="700" font-size="220" fill="${ink}" letter-spacing="-12">01</text>`;
      for (let i = 1; i < 12; i++) g += `<line x1="${(W / 12) * i}" y1="0" x2="${(W / 12) * i}" y2="${H}" stroke="${ink}" stroke-opacity=".08"/>`;
      break;
    case "organic-soft-ui":
      [0, 1, 2].forEach(i => {
        const x = 260 + i * 180, y = 230 - i * 50;
        g += `<rect x="${x}" y="${y}" width="160" height="${H - y + 20}" rx="18" fill="${a2}"/><rect x="${x}" y="${y}" width="160" height="44" rx="18" fill="#fff"/><rect x="${x + 18}" y="${y + 120}" width="124" height="28" rx="14" fill="${bg}"/>`;
      });
      g += `<rect x="40" y="60" width="200" height="22" rx="4" fill="${ink}"/><rect x="40" y="92" width="150" height="22" rx="4" fill="${ink}"/>`;
      break;
    case "dark-kinetic-studio":
      [[60, 250], [330, 90], [440, 90], [550, 90], [660, 90]].forEach(([x, w], i) =>
        g += `<rect x="${x}" y="150" width="${w}" height="300" fill="${i ? a2 : a1}" opacity="${i ? .55 : .9}"/>`);
      g += `<rect x="60" y="60" width="380" height="26" fill="${ink}"/><rect x="60" y="96" width="250" height="26" fill="${a1}"/>`;
      break;
    default:
      for (let i = 0; i < 10; i++) g += `<rect x="0" y="${i * 50}" width="${W}" height="25" fill="${i % 2 ? a1 : a2}" opacity=".5"/>`;
  }
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${esc(e.title)} placeholder"><rect width="${W}" height="${H}" fill="${bg}"/>${g}</svg>`;
}
