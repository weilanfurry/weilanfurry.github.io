async function fetchJson(url, init) {
  const debug =
    (typeof location !== "undefined" &&
      location &&
      new URLSearchParams(location.search || "").get("debug") === "1") ||
    (typeof localStorage !== "undefined" && localStorage && localStorage.getItem
      ? localStorage.getItem("skillbottle:debug") === "1"
      : false);

  const i = { ...(init || {}) };
  const timeoutMs = typeof i.timeoutMs === "number" ? i.timeoutMs : 15000;
  delete i.timeoutMs;

  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  let timer = null;
  if (controller) {
    i.signal = controller.signal;
    timer = setTimeout(() => {
      try { controller.abort(); } catch {}
    }, timeoutMs);
  }

  try {
    if (debug) console.log("[SkillBottle] fetch", url, { timeoutMs });
    const res = await fetch(url, {
      ...i,
      headers: { Accept: "application/json", ...((i && i.headers) || {}) },
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json();
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function showInitError(err) {
  try {
    console.error("[SkillBottle] init failed", err);
    const el = document.getElementById("navEmpty");
    const items = document.getElementById("navItems");
    if (!el) return;
    if (items && items.children && items.children.length) return;

    const msg = err && err.message ? err.message : String(err || "unknown error");
    el.textContent = `前端初始化失败：${msg}（可在地址栏加 ?debug=1 查看更多日志）`;
    el.style.display = "block";
  } catch {}
}

function setEmptyVisible(visible) {
  const empty = document.getElementById("viewerEmpty");
  if (!empty) return;
  empty.style.display = visible ? "flex" : "none";
}


function setViewerEmpty(title, desc) {
  const titleEl = document.getElementById("viewerTitle");
  const descEl = document.getElementById("viewerDesc");
  if (titleEl) titleEl.textContent = title || "";
  if (descEl) descEl.textContent = desc || "";
}

function showLockedMessage() {
  hideAllViewers();
  setViewerEmpty("该项目已锁定，请联系管理员", "");
  setEmptyVisible(true);
}

function getFramesContainer() {
  return document.getElementById("viewerFrames");
}

function getAdvancedPanel() {
  return document.getElementById("advancedPanel");
}

const runningFrames = new Map(); // id -> iframe
const runningPanels = new Set(); // id
let activeId = "";

const ADVANCED_ID = "__advanced__";

const STORAGE_MANAGE = "skillbottle:manage";
const STORAGE_LOCKED = "skillbottle:locked";
const STORAGE_LABELS = "skillbottle:labels";
const STORAGE_PERSONALIZE = "skillbottle:personalize";
function getEmbeddedTheme() {
  const el = document.getElementById("sb-theme");
  if (!el) return "";
  try {
    const v = JSON.parse(el.textContent || '""');
    return v === "light" || v === "dark" ? v : "";
  } catch {
    return "";
  }
}

function getEmbeddedPersonalize() {
  const el = document.getElementById("sb-personalize");
  if (!el) return null;
  try {
    const v = JSON.parse(el.textContent || "{}");
    return v && typeof v === "object" ? v : null;
  } catch {
    return null;
  }
}

function safeStorageGet(storage, key) {
  try {
    return storage && storage.getItem ? storage.getItem(key) : null;
  } catch {
    return null;
  }
}

function safeStorageSet(storage, key, value) {
  try {
    if (storage && storage.setItem) storage.setItem(key, value);
  } catch {}
}

function safeStorageRemove(storage, key) {
  try {
    if (storage && storage.removeItem) storage.removeItem(key);
  } catch {}
}

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

let manageMode = safeStorageGet(sessionStorage, STORAGE_MANAGE) === "1";
let labels = loadJson(STORAGE_LABELS, {});

const lockedObj = loadJson(STORAGE_LOCKED, {});
const lockedIds = new Set(Object.keys(lockedObj || {}).filter((k) => lockedObj[k]));

function isLocked(id) {
  return !!id && id !== ADVANCED_ID && lockedIds.has(id);
}

function setManageMode(on) {
  manageMode = !!on;
  try {
    sessionStorage.setItem(STORAGE_MANAGE, manageMode ? "1" : "0");
  } catch {}
  try {
    localStorage.removeItem(STORAGE_MANAGE);
  } catch {}

  document.documentElement.setAttribute("data-manage", manageMode ? "1" : "0");

  const manageCard = document.getElementById("manageCard");
  if (manageCard) manageCard.style.display = manageMode ? "block" : "none";

  const pwdCard = document.getElementById("adminPwdCard");
  if (pwdCard) pwdCard.style.display = manageMode ? "block" : "none";

  // Fire-and-forget UI refresh
  if (manageMode) refreshAdminUi();
}
async function fetchAdminStatus() {
  try {
    const data = await fetchJson("/api/admin/status");
    return data || { configured: false, source: "none" };
  } catch {
    return { configured: false, source: "static" };
  }
}

async function refreshAdminUi() {
  const card = document.getElementById("adminPwdCard");
  if (!card) return;
  if (!manageMode) {
    card.style.display = "none";
    return;
  }

  card.style.display = "block";

  const statusEl = document.getElementById("adminPwdStatus");
  const setBtn = document.getElementById("adminSetPwdBtn");
  const changeBtn = document.getElementById("adminChangePwdBtn");

  const st = await fetchAdminStatus();

  if (st.source === "static") {
    if (statusEl) statusEl.textContent = "管理模式需要后端支持";
    if (setBtn) setBtn.style.display = "none";
    if (changeBtn) changeBtn.style.display = "none";
    return;
  }

  if (st.source === "env") {
    if (statusEl) statusEl.textContent = "已通过环境变量配置，无法在界面修改";
    if (setBtn) setBtn.style.display = "none";
    if (changeBtn) changeBtn.style.display = "none";
    return;
  }

  if (!st.configured) {
    if (statusEl) statusEl.textContent = "未设置，可注册密码";
    if (setBtn) setBtn.style.display = "inline-flex";
    if (changeBtn) changeBtn.style.display = "none";
    return;
  }

  if (statusEl) statusEl.textContent = "已设置";
  if (setBtn) setBtn.style.display = "none";
  if (changeBtn) changeBtn.style.display = "inline-flex";
}

async function registerAdminPassword() {
  const p1 = prompt("未设置管理员密码，请注册（至少 4 位）");
  if (p1 === null) return false;
  if (String(p1).length < 4) {
    alert("密码至少 4 位");
    return false;
  }

  const p2 = prompt("请再次输入管理员密码");
  if (p2 === null) return false;
  if (String(p1) !== String(p2)) {
    alert("两次输入不一致");
    return false;
  }

  try {
    const data = await fetchJson("/api/admin/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: String(p1) }),
    });

    if (data && data.ok) {
      await refreshAdminUi();
      return true;
    }

    alert((data && data.reason) || "注册失败");
    await refreshAdminUi();
    return false;
  } catch {
    alert("管理模式需要后端支持（请通过后端运行）");
    return false;
  }
}

async function changeAdminPassword() {
  const oldPassword = prompt("请输入原管理员密码");
  if (oldPassword === null) return false;

  const p1 = prompt("请输入新管理员密码（至少 4 位）");
  if (p1 === null) return false;
  if (String(p1).length < 4) {
    alert("新密码至少 4 位");
    return false;
  }

  const p2 = prompt("请再次输入新管理员密码");
  if (p2 === null) return false;
  if (String(p1) !== String(p2)) {
    alert("两次输入不一致");
    return false;
  }

  try {
    const data = await fetchJson("/api/admin/change", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ old_password: String(oldPassword), new_password: String(p1) }),
    });

    if (data && data.ok) {
      alert("管理员密码已更新");
      await refreshAdminUi();
      return true;
    }

    alert((data && data.reason) || "修改失败");
    await refreshAdminUi();
    return false;
  } catch {
    alert("管理模式需要后端支持（请通过后端运行）");
    return false;
  }
}

function initAdminPasswordCard() {
  const setBtn = document.getElementById("adminSetPwdBtn");
  const changeBtn = document.getElementById("adminChangePwdBtn");

  if (setBtn) {
    setBtn.addEventListener("click", async () => {
      await registerAdminPassword();
    });
  }

  if (changeBtn) {
    changeBtn.addEventListener("click", async () => {
      await changeAdminPassword();
    });
  }
}

async function enterManageMode() {
  const st = await fetchAdminStatus();

  if (st.source === "static") {
    alert("管理模式需要后端支持（请通过后端运行）");
    return false;
  }

  if (!st.configured) {
    const ok = await registerAdminPassword();
    if (!ok) return false;

    setManageMode(true);
    rerenderNav();
    return true;
  }

  const password = prompt("请输入管理员密码");
  if (password === null) return false;

  try {
    const data = await fetchJson("/api/admin/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: String(password) }),
    });

    if (data && data.ok) {
      setManageMode(true);
      await refreshAdminUi();
      rerenderNav();
      return true;
    }

    alert((data && data.reason) || "管理员密码错误");
    return false;
  } catch {
    alert("管理模式需要后端支持（请通过后端运行）");
    return false;
  }
}
function setLocked(id, on) {
  if (!id || id === ADVANCED_ID) return;
  if (on) lockedIds.add(id);
  else lockedIds.delete(id);

  const next = {};
  for (const k of lockedIds) next[k] = true;
  saveJson(STORAGE_LOCKED, next);
}

function getItemLabel(item) {
  if (!item || !item.id) return "";
  const custom = labels && Object.prototype.hasOwnProperty.call(labels, item.id) ? labels[item.id] : null;
  if (typeof custom === "string" && custom.trim()) return custom.trim();
  return item.label;
}

function setItemLabel(id, label) {
  if (!id) return;
  const v = (label || "").trim();
  if (!labels || typeof labels !== "object") labels = {};

  if (!v) delete labels[id];
  else labels[id] = v;

  saveJson(STORAGE_LABELS, labels);
}

let lastNavItems = [];
let lastNavMode = "backend";

function rerenderNav() {
  renderNav(lastNavItems, lastNavMode);
}

let contextMenuEl = null;
let contextMenuItem = null;

function hideAppMenu() {
  if (!contextMenuEl) return;
  contextMenuEl.style.display = "none";
  contextMenuItem = null;
}

function ensureAppMenu() {
  if (contextMenuEl) return contextMenuEl;

  const el = document.createElement("div");
  el.id = "sbContextMenu";
  el.className = "sb-menu";
  el.setAttribute("role", "menu");
  el.innerHTML = `
    <button type="button" data-action="edit">应用编辑</button>
    <button type="button" data-action="lock">管理锁定</button>
    <div class="sb-menu-sep" aria-hidden="true"></div>
    <button type="button" data-action="fullscreen">全屏</button>
    <div class="sb-menu-sep" aria-hidden="true"></div>
    <button type="button" data-action="manage">管理模式</button>
  `.trim();

  el.addEventListener("click", async (e) => {
    const btn = e.target && e.target.closest ? e.target.closest("button[data-action]") : null;
    if (!btn) return;

    const item = contextMenuItem;
    const action = btn.getAttribute("data-action");

    hideAppMenu();

    if (!item) return;

    if (action === "edit") {
      if (!manageMode) {
        alert("请先进入管理模式");
        return;
      }
      if (item.id === ADVANCED_ID) return;

      const current = getItemLabel(item);
      const nextLabel = prompt("应用名称（留空恢复默认）", current);
      if (nextLabel === null) return;
      setItemLabel(item.id, nextLabel);
      rerenderNav();
      return;
    }

    if (action === "lock") {
      if (!manageMode) {
        alert("请先进入管理模式");
        return;
      }
      if (item.id === ADVANCED_ID) return;

      setLocked(item.id, !isLocked(item.id));
      rerenderNav();
      return;
    }

    if (action === "fullscreen") {
      if (!manageMode && isLocked(item.id)) {
        showLockedMessage();
        return;
      }

      openApp(item);
      setTimeout(() => {
        const advanced = getAdvancedPanel();
        if (activeId === ADVANCED_ID && advanced && advanced.requestFullscreen) {
          advanced.requestFullscreen().catch(() => {});
          return;
        }
        const iframe = runningFrames.get(activeId);
        if (iframe && iframe.requestFullscreen) iframe.requestFullscreen().catch(() => {});
      }, 0);
      return;
    }

    if (action === "manage") {
      if (manageMode) {
        openAdvanced();
        return;
      }
      await enterManageMode();
      return;
    }
  });

  document.addEventListener("click", () => hideAppMenu());
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hideAppMenu();
  });
  window.addEventListener("blur", () => hideAppMenu());
  window.addEventListener("resize", () => hideAppMenu());

  document.body.appendChild(el);
  contextMenuEl = el;
  return el;
}

function showAppMenuAt(clientX, clientY, item) {
  const el = ensureAppMenu();
  contextMenuItem = item;

  const editBtn = el.querySelector('button[data-action="edit"]');
  if (editBtn) editBtn.disabled = !manageMode || item.id === ADVANCED_ID;

  const lockBtn = el.querySelector('button[data-action="lock"]');
  if (lockBtn) {
    lockBtn.disabled = !manageMode || item.id === ADVANCED_ID;
    lockBtn.classList.toggle("checked", isLocked(item.id));
  }

  const manageBtn = el.querySelector('button[data-action="manage"]');
  if (manageBtn) manageBtn.classList.toggle("checked", !!manageMode);

  el.style.display = "block";
  el.style.left = "0px";
  el.style.top = "0px";

  const pad = 8;
  const rect = el.getBoundingClientRect();
  const maxX = Math.max(pad, window.innerWidth - rect.width - pad);
  const maxY = Math.max(pad, window.innerHeight - rect.height - pad);

  const x = Math.min(Math.max(pad, clientX), maxX);
  const y = Math.min(Math.max(pad, clientY), maxY);

  el.style.left = x + "px";
  el.style.top = y + "px";
}

function showAppMenu(e, item) {
  e.preventDefault();
  e.stopPropagation();
  showAppMenuAt(e.clientX, e.clientY, item);
}

function applyTheme(theme) {
  const t = theme === "light" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", t);
  safeStorageSet(localStorage, "skillbottle:theme", t);

  try { document.dispatchEvent(new Event("skillbottle:theme")); } catch {}

  const toggle = document.getElementById("themeToggle");
  if (toggle) toggle.checked = t === "light";
}

function initTheme() {
  const saved = safeStorageGet(localStorage, "skillbottle:theme");
  const embedded = getEmbeddedTheme();
  applyTheme(saved || embedded || "dark");

  const toggle = document.getElementById("themeToggle");
  if (toggle) {
    toggle.addEventListener("change", () => {
      applyTheme(toggle.checked ? "light" : "dark");
    });
  }
}
function normalizeHexColor(v) {
  if (!v) return "";
  const s = String(v).trim();
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase();
  return "";
}

function getCssHexVar(name) {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return normalizeHexColor(v);
  } catch {
    return "";
  }
}

function applyPersonalize(state, defaults) {
  const root = document.documentElement;

  const titleRaw = state && typeof state.title === "string" ? state.title.trim() : "";
  const subtitleRaw = state && typeof state.subtitle === "string" ? state.subtitle.trim() : "";

  const title = titleRaw || defaults.defaultTitle;
  const subtitle = subtitleRaw || defaults.defaultSubtitle;

  if (defaults.titleEl) defaults.titleEl.textContent = title;
  if (defaults.subtitleEl) defaults.subtitleEl.textContent = subtitle;
  document.title = title;

  const brandColor = normalizeHexColor(state && state.brandColor);
  if (brandColor) root.style.setProperty("--custom-brand-color", brandColor);
  else root.style.removeProperty("--custom-brand-color");

  const frameBg = normalizeHexColor(state && state.frameBg);
  if (frameBg) root.style.setProperty("--custom-frame-bg", frameBg);
  else root.style.removeProperty("--custom-frame-bg");
}

function initPersonalize() {
  const titleEl = document.getElementById("brandTitle");
  const subtitleEl = document.getElementById("brandSubtitle");

  const defaults = {
    titleEl,
    subtitleEl,
    defaultTitle: titleEl ? titleEl.textContent : "SkillBottle Web",
    defaultSubtitle: subtitleEl ? subtitleEl.textContent : "",
  };

  const inputTitle = document.getElementById("personalTitleInput");
  const inputSubtitle = document.getElementById("personalSubtitleInput");
  const inputBrandColor = document.getElementById("personalBrandColorInput");
  const inputFrameBg = document.getElementById("personalFrameBgInput");
  const resetBtn = document.getElementById("personalResetBtn");

  const defaultBrandColor = getCssHexVar("--brand") || "#9ad1ff";
  const defaultFrameBg = getCssHexVar("--card") || "#1a1a1a";

  let state = loadJson(STORAGE_PERSONALIZE, null);
  if (!state || typeof state !== "object") state = null;
  if (!state || Object.keys(state).length === 0) {
    const embedded = getEmbeddedPersonalize();
    if (embedded && typeof embedded === "object") state = embedded;
    else state = {};
  }

  applyPersonalize(state, defaults);

  if (inputTitle) inputTitle.value = (state.title && String(state.title)) || "";
  if (inputSubtitle) inputSubtitle.value = (state.subtitle && String(state.subtitle)) || "";
  if (inputBrandColor) inputBrandColor.value = normalizeHexColor(state.brandColor) || defaultBrandColor;
  if (inputFrameBg) inputFrameBg.value = normalizeHexColor(state.frameBg) || defaultFrameBg;

  function persist() {
    saveJson(STORAGE_PERSONALIZE, state);
    applyPersonalize(state, defaults);
  }

  if (inputTitle) {
    inputTitle.addEventListener("input", () => {
      const v = inputTitle.value.trim();
      if (v) state.title = v;
      else delete state.title;
      persist();
    });
  }

  if (inputSubtitle) {
    inputSubtitle.addEventListener("input", () => {
      const v = inputSubtitle.value.trim();
      if (v) state.subtitle = v;
      else delete state.subtitle;
      persist();
    });
  }

  if (inputBrandColor) {
    inputBrandColor.addEventListener("input", () => {
      const v = normalizeHexColor(inputBrandColor.value);
      if (v) state.brandColor = v;
      else delete state.brandColor;
      persist();
    });
  }

  if (inputFrameBg) {
    inputFrameBg.addEventListener("input", () => {
      const v = normalizeHexColor(inputFrameBg.value);
      if (v) state.frameBg = v;
      else delete state.frameBg;
      persist();
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      state = {};
      try {
        localStorage.removeItem(STORAGE_PERSONALIZE);
      } catch {}

      applyPersonalize(state, defaults);

      if (inputTitle) inputTitle.value = "";
      if (inputSubtitle) inputSubtitle.value = "";
      if (inputBrandColor) inputBrandColor.value = getCssHexVar("--brand") || defaultBrandColor;
      if (inputFrameBg) inputFrameBg.value = getCssHexVar("--card") || defaultFrameBg;
    });
  }

  document.addEventListener("skillbottle:theme", () => {
    if (!state.frameBg && inputFrameBg) {
      inputFrameBg.value = getCssHexVar("--card") || defaultFrameBg;
    }
  });
}
function hideAllViewers() {
  for (const iframe of runningFrames.values()) iframe.style.display = "none";
  const advanced = getAdvancedPanel();
  if (advanced) advanced.style.display = "none";
}

function setActiveRow(id) {
  const rows = document.querySelectorAll(".nav-row");
  for (const row of rows) {
    row.classList.toggle("active", row.getAttribute("data-id") === id);
  }
}

function setRowRunning(id, running) {
  const row = document.querySelector(`.nav-row[data-id="${CSS.escape(id)}"]`);
  if (!row) return;
  row.classList.toggle("running", !!running);
}

function ensureFrame(item) {
  if (runningFrames.has(item.id)) return runningFrames.get(item.id);

  const container = getFramesContainer();
  if (!container) return null;

  const iframe = document.createElement("iframe");
  iframe.className = "viewer-frame";
  iframe.title = item.label;
  iframe.referrerPolicy = "no-referrer";
  iframe.src = item.href;
  container.appendChild(iframe);

  runningFrames.set(item.id, iframe);
  setRowRunning(item.id, true);
  return iframe;
}

function ensurePanel(id) {
  if (id !== ADVANCED_ID) return;
  runningPanels.add(id);
  setRowRunning(id, true);
}

function openAdvanced() {
  if (!manageMode) return;
  ensurePanel(ADVANCED_ID);
  activeId = ADVANCED_ID;
  safeStorageSet(localStorage, "skillbottle:last", activeId);

  hideAllViewers();
  const panel = getAdvancedPanel();
  if (panel) panel.style.display = "block";

  setEmptyVisible(false);
  setActiveRow(activeId);
}

async function runExportOnce() {
  const status = document.getElementById("exportStatus");
  const pathEl = document.getElementById("exportPath");
  const btn = document.getElementById("exportBtn");

  if (status) status.textContent = "正在导出…";
  if (pathEl) pathEl.textContent = "";
  if (btn) btn.disabled = true;

  try {
    const personalize = loadJson(STORAGE_PERSONALIZE, {}) || {};
    const theme = safeStorageGet(localStorage, "skillbottle:theme") || document.documentElement.getAttribute("data-theme") || "dark";

    const data = await fetchJson("/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ personalize, theme }),
    });
    if (status) status.textContent = data.ok ? "导出完成" : "导出失败";
    if (pathEl) pathEl.textContent = data.out_dir || "";
  } catch {
    if (status) status.textContent = "导出不可用（纯前端模式无法导出）";
  } finally {
    if (btn) btn.disabled = false;
  }
}

function initExport() {
  const btn = document.getElementById("exportBtn");
  if (!btn) return;
  btn.addEventListener("click", () => runExportOnce());
}

function openApp(item) {
  if (!item || !item.id) return;

  if (item.kind === "advanced") {
    if (!manageMode) return;
    return openAdvanced();
  }

  if (!manageMode && isLocked(item.id)) {
    showLockedMessage();
    setActiveRow(item.id);
    return;
  }
  ensureFrame(item);
  activeId = item.id;
  safeStorageSet(localStorage, "skillbottle:last", activeId);

  hideAllViewers();
  const iframe = runningFrames.get(activeId);
  if (iframe) iframe.style.display = "block";

  setEmptyVisible(false);
  setActiveRow(activeId);
}

function stopApp(id) {
  if (id === ADVANCED_ID) {
    runningPanels.delete(id);
    setRowRunning(id, false);

    const panel = getAdvancedPanel();
    if (panel) panel.style.display = "none";

    if (activeId === id) {
      activeId = "";
      setActiveRow("");
      setEmptyVisible(true);
    }
    return;
  }

  if (!manageMode && isLocked(id)) return;
  const iframe = runningFrames.get(id);
  if (!iframe) return;

  try {
    iframe.src = "about:blank";
  } catch {}

  iframe.remove();
  runningFrames.delete(id);
  setRowRunning(id, false);

  if (activeId === id) {
    const nextFrame = runningFrames.keys().next();
    if (!nextFrame.done) {
      activeId = nextFrame.value;
      hideAllViewers();
      const nextIframe = runningFrames.get(activeId);
      if (nextIframe) nextIframe.style.display = "block";
      setActiveRow(activeId);
      setEmptyVisible(false);
      return;
    }

    if (runningPanels.has(ADVANCED_ID)) {
      openAdvanced();
      return;
    }

    activeId = "";
    setActiveRow("");
    setEmptyVisible(true);
  }
}

function getEmbeddedManifest() {
  const el = document.getElementById("sb-manifest");
  if (!el) return null;
  try {
    return JSON.parse(el.textContent || "{}");
  } catch {
    return null;
  }
}

async function loadManifestOrApi() {
  const embedded = getEmbeddedManifest();
  if (embedded && Array.isArray(embedded.items)) {
    return { items: embedded.items, mode: "static" };
  }

  try {
    const manifest = await fetchJson("./manifest.json", { timeoutMs: 4000 });
    if (manifest && Array.isArray(manifest.items)) return { items: manifest.items, mode: "static" };
  } catch {
    // ignore
  }

  if (typeof location !== "undefined" && location && location.protocol === "file:") {
    return { items: [], mode: "static" };
  }

  const api = await fetchJson("/api/nav", { timeoutMs: 8000 });
  return { items: api.items || [], mode: "backend" };
}

function renderNav(items, mode) {
  lastNavItems = items || [];
  lastNavMode = mode || "backend";
  const empty = document.getElementById("navEmpty");
  const container = document.getElementById("navItems");
  if (!empty || !container) return;

  const exportCard = document.getElementById("exportCard");
  if (exportCard) exportCard.style.display = mode === "backend" ? "block" : "none";

  container.innerHTML = "";
  const allItems = [...(items || [])];

  if (manageMode) allItems.push({ id: ADVANCED_ID, label: "高级模块", kind: "advanced" });
  empty.style.display = allItems.length ? "none" : "block";
  if (!allItems.length) {
    empty.textContent = mode === "backend" ? "目录为空。" : "无法加载目录：请启动后端（uvicorn app:app）或使用导出版本（result/export-*）。";
    setEmptyVisible(true);
    return;
  }
  for (const item of allItems) {
    const row = document.createElement("div");
    row.className = "nav-row";
    row.setAttribute("data-id", item.id);

    if (isLocked(item.id)) row.classList.add("locked");

    // Disable native/host right-click menu on the nav list.
    row.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    const openBtn = document.createElement("button");
    openBtn.type = "button";
    openBtn.className = "nav-open";
    openBtn.textContent = getItemLabel(item);
    openBtn.addEventListener("click", () => openApp(item));
    openBtn.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    const moreBtn = document.createElement("button");
    moreBtn.type = "button";
    moreBtn.className = "nav-more";
    moreBtn.setAttribute("aria-label", `更多：${getItemLabel(item)}`);
    moreBtn.title = "更多";
    moreBtn.textContent = "...";
    moreBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const r = moreBtn.getBoundingClientRect();
      showAppMenuAt(r.right, r.bottom, item);
    });

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "nav-close";
    closeBtn.setAttribute("aria-label", `停止 ${item.label}`);
    closeBtn.title = "停止运行";
    closeBtn.textContent = "×";
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (isLocked(item.id)) return;
      stopApp(item.id);
    });

    row.appendChild(openBtn);
    row.appendChild(moreBtn);
    row.appendChild(closeBtn);
    container.appendChild(row);

    if (runningFrames.has(item.id) || runningPanels.has(item.id)) row.classList.add("running");
  }


  const last = safeStorageGet(localStorage, "skillbottle:last");
  const preferred = allItems.find((x) => x.id === last) || allItems[0];
  openApp(preferred);
}

async function main() {
  initTheme();
  initPersonalize();
  setManageMode(manageMode);
  initExport();
  initAdminPasswordCard();

  const exitBtn = document.getElementById("exitManageBtn");
  if (exitBtn) {
    exitBtn.addEventListener("click", () => {
      setManageMode(false);
      hideAppMenu();
      if (activeId === ADVANCED_ID) stopApp(ADVANCED_ID);
      rerenderNav();
    });
  }
  try {
    const { items, mode } = await loadManifestOrApi();
    renderNav(items, mode);
  } catch {
    renderNav([], "static");
  }
}

main().catch(showInitError);












