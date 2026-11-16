// Style Library: static, data-driven. Content lives in data/library.json.
const $ = (s, el = document) => el.querySelector(s);
const esc = (s = "") => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const state = { data: null, filter: "all", query: "" };

const res = await fetch("data/library.json", { cache: "no-cache" });
state.data = await res.json();
const { categories, entries } = state.data;
const catById = Object.fromEntries(categories.map(c => [c.id, c]));

readHash();
render();
window.addEventListener("hashchange", () => { readHash(); render(); });

$("#search").addEventListener("input", e => { state.query = e.target.value.trim().toLowerCase(); render(); });
$("#addBtn").addEventListener("click", openAdd);

/* ---------- routing: #style=<id> | #vocabulary | #entry=<id> ---------- */
function readHash() {
  const h = decodeURIComponent(location.hash.slice(1));
  if (h.startsWith("style=")) state.filter = h.slice(6);
  else if (h === "vocabulary") state.filter = "vocabulary";
  else if (!h.startsWith("entry=")) state.filter = "all";
  const entryId = h.startsWith("entry=") ? h.slice(6) : null;
  if (entryId) openEntry(entryId); else if ($("#modal").open) $("#modal").close();
}
function setFilter(f) {
  location.hash = f === "all" ? "" : f === "vocabulary" ? "vocabulary" : `style=${f}`;
  if (f === "all") { state.filter = "all"; render(); history.replaceState(null, "", location.pathname); }
}

/* ---------- rendering ---------- */
function render() {
  renderChips();
  const isVocab = state.filter === "vocabulary";
  $("#vocab").hidden = !isVocab;
  $("#grid").hidden = isVocab;
  const cat = catById[state.filter];
  $("#guide").hidden = !cat;
  if (cat) $("#guide").innerHTML = guideHTML(cat, true);
  if (isVocab) {
    $("#vocab").innerHTML = categories.map(c => `<section class="guide">${guideHTML(c, false)}</section>`).join("");
    $("#empty").hidden = true;
  } else renderGrid();
  $("#count").textContent = `${entries.length} entries / ${categories.length} styles`;
}

function renderChips() {
  const counts = entries.reduce((m, e) => (m[e.category] = (m[e.category] || 0) + 1, m), {});
  const chip = (id, label, n, alt = "") =>
    `<button class="chip ${alt}" type="button" data-f="${esc(id)}" aria-pressed="${state.filter === id}">${esc(label)}${n != null ? `<span>${n}</span>` : ""}</button>`;
  $("#chips").innerHTML =
    chip("all", "All", entries.length) +
    categories.map(c => chip(c.id, c.name, counts[c.id] || 0)).join("") +
    chip("vocabulary", "◈ Style vocabulary", categories.length, "chip--alt");
  $("#chips").querySelectorAll(".chip").forEach(b => b.onclick = () => setFilter(b.dataset.f));
}

function matches(e) {
  if (state.filter !== "all" && e.category !== state.filter) return false;
  if (!state.query) return true;
  const c = catById[e.category] || {};
  const hay = [e.title, e.tagline, e.description, e.section, ...(e.tags || []), c.name, ...(c.vocabulary || [])].join(" ").toLowerCase();
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
      <div class="thumb">${thumb(e)}${e.section ? `<span class="thumb__badge">${esc(e.section)}</span>` : ""}</div>
      <div class="card__body">
        <div class="card__head"><h3 class="card__title">${esc(e.title)}</h3><span class="card__tagline">${esc(e.tagline || "")}</span></div>
        <div class="tags">${tags.slice(0, 3).map(t => `<span class="tag">${esc(t)}</span>`).join("")}${tags.length > 3 ? `<span class="tag tag--more">+${tags.length - 3}</span>` : ""}</div>
        <div class="card__foot"><span><b>◆</b> ${esc(c.name)}</span><span>${String(idx).padStart(2, "0")} / ${String(entries.length).padStart(2, "0")}</span></div>
      </div>
    </button>`;
  }).join("");
  $("#grid").querySelectorAll(".card").forEach(b => b.onclick = () => (location.hash = `entry=${b.dataset.id}`));
}

function guideHTML(c, withCount) {
  const n = entries.filter(e => e.category === c.id).length;
  return `<div>
      <p class="eyebrow">Style guide${withCount ? ` / ${n} entr${n === 1 ? "y" : "ies"}` : ""}</p>
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
  const prompt = esc(e.prompt || "").replace(/\[(SUBJECT:[^\]]*)\]/, "<mark>[$1]</mark>");
  m.innerHTML = `
    <div class="modal__media">${e.image ? `<img src="${esc(e.image)}" alt="${esc(e.title)} screenshot">` : thumb(e)}</div>
    <div class="modal__body">
      <div class="modal__head"><h2 class="modal__title">${esc(e.title)}</h2><span class="modal__meta">${esc(e.tagline || "")}</span></div>
      <p class="modal__desc">${esc(e.description || "")}</p>
      <p class="modal__meta">◆ <a href="#style=${esc(c.id || "")}">${esc(c.name)}</a>${e.section ? ` / ${esc(e.section)}` : ""}${e.url ? ` / <a href="${esc(e.url)}" target="_blank" rel="noopener">Visit site ↗</a>` : ""}</p>
      <div class="tags">${(e.tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join("")}</div>
      ${e.palette?.length ? `<p class="label">Palette</p><div class="palette">${e.palette.map(p => `<span class="swatch"><i style="background:${esc(p)}"></i>${esc(p)}</span>`).join("")}</div>` : ""}
      ${e.prompt ? `<div class="recipe"><p class="label" style="margin-top:0;color:var(--accent)">Image recipe: replace [SUBJECT]</p>${prompt}</div>` : ""}
      <div class="actions">
        <button class="btn" data-copy="brief" type="button">Copy brief</button>
        ${e.prompt ? `<button class="btn" data-copy="prompt" type="button">Copy image prompt</button>` : ""}
        <button class="btn btn--ghost" data-close type="button">Close</button>
      </div>
    </div>`;
  m.querySelector("[data-close]").onclick = () => m.close();
  m.querySelectorAll("[data-copy]").forEach(b => b.onclick = () => copy(b.dataset.copy === "brief" ? brief(e, c) : e.prompt));
  m.onclose = () => {
    if (!location.hash.startsWith("#entry=")) return;
    const f = state.filter;
    history.replaceState(null, "", f === "all" ? location.pathname : `#${f === "vocabulary" ? f : `style=${f}`}`);
  };
  m.onclick = ev => { if (ev.target === m) m.close(); };
  if (!m.open) m.showModal();
}

function brief(e, c) {
  return [
    `${e.title} (${c.name}${e.tagline ? `, ${e.tagline}` : ""})`,
    e.description,
    "",
    `Style: ${c.summary || ""}`,
    `Key moves: ${(e.tags || []).join(", ")}`,
    c.typography && `Typography: ${c.typography}`,
    c.color && `Color: ${c.color}`,
    e.palette?.length && `Palette: ${e.palette.join(" ")}`,
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
      <label>URL<input name="url" type="url" placeholder="https://"></label>
      <label>Section<input name="section" placeholder="Hero, Footer, Full page"></label>
      <label>Tagline<input name="tagline" placeholder="warm editorial x print DNA"></label>
      <label>Screenshot path<input name="image" placeholder="shots/my-site.jpg"></label>
      <label class="full">Description<textarea name="description"></textarea></label>
      <label class="full">Tags (comma separated)<input name="tags"></label>
      <label class="full">Palette (hex, comma separated)<input name="palette" placeholder="#F3EEE4, #1C1A17"></label>
      <label class="full">Image prompt<textarea name="prompt" placeholder="[SUBJECT: ...] rendered as ..."></textarea></label>
    </form>
    <textarea class="out" id="addOut" readonly></textarea>
    <div class="actions">
      <button class="btn" id="addCopy" type="button">Copy JSON</button>
      <button class="btn btn--ghost" id="addClose" type="button">Close</button>
    </div></div>`;
  const form = $("#addForm", m), out = $("#addOut", m);
  const list = s => s.split(",").map(x => x.trim()).filter(Boolean);
  const update = () => {
    const f = Object.fromEntries(new FormData(form));
    const id = (f.title || "untitled").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    out.value = JSON.stringify({ id, title: f.title, url: f.url, category: f.category, section: f.section, tagline: f.tagline,
      description: f.description, tags: list(f.tags), palette: list(f.palette), image: f.image, prompt: f.prompt }, null, 2) + ",";
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
    default:
      for (let i = 0; i < 10; i++) g += `<rect x="0" y="${i * 50}" width="${W}" height="25" fill="${i % 2 ? a1 : a2}" opacity=".5"/>`;
  }
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${esc(e.title)} placeholder"><rect width="${W}" height="${H}" fill="${bg}"/>${g}</svg>`;
}
