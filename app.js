/* 방탄가족단 · app.js */
const firebaseConfig = {
  apiKey: "AIzaSyDubF2Hn1AH3vz7eCDjTulnKcBRX5ntcPU",
  authDomain: "oh-family-office.firebaseapp.com",
  databaseURL: "https://oh-family-office-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "oh-family-office",
  storageBucket: "oh-family-office.firebasestorage.app",
  messagingSenderId: "173882626242",
  appId: "1:173882626242:web:c27a8630688707e2c46b5b"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

/* 가족 (이름·애칭만) */
const MEMBERS = [
  { id: "seunghwan", name: "승환", role: "아빠", color: "#a8d36b", ink: "#5f8f33", mark: "ㅂ", pickle: "제키핑클" },
  { id: "goun",      name: "고운", role: "엄마", color: "#f7a8b8", ink: "#c4597a", mark: "ㄱ", pickle: "고운의 피클" },
  { id: "hyeok",     name: "혁이", role: "아들", color: "#8fc9f2", ink: "#2f7bb8", mark: "ㅎ", pickle: "혁이의 피클" },
  { id: "jiwoo",     name: "지우", role: "딸",   color: "#ffd47e", ink: "#a97d00", mark: "ㅈ", pickle: "지우의 피클" }
];
const ROOMS = [
  { id: "living",  name: "가족 거실" },
  { id: "meeting", name: "회의·작업실" }
];
/* 예전 '비서 작업실'(work)은 '회의·작업실'로 합쳐 읽는다 */
function normRoom(room) {
  if (room === "work") return "meeting";
  return ROOMS.some((r) => r.id === room) ? room : null;
}
function roomById(id) { return ROOMS.find((r) => r.id === normRoom(id)) || null; }

const PIN_SALT = "ofs-2026-family:";
const PIN_HASH = "aa5cbb473ced295ba4835b53968b12c9c8bb72864e543aa3345ef1256ca10e77";
const LS_PASS = "ofo.pass";
const LS_ME = "ofo.me";
const LS_AS = "ofo.as";

const state = {
  me: localStorage.getItem(LS_ME) || null,
  /* 말하는 사람: "me"(가족 본인) 또는 "pickle"(내 비서) */
  as: localStorage.getItem(LS_AS) === "pickle" ? "pickle" : "me",
  office: {}, messages: [], todos: {}, pickles: {}, tab: "desk", pin: ""
};

const $ = (s) => document.querySelector(s);
const memberById = (id) => MEMBERS.find((m) => m.id === id);
const esc = (s) => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

function pickleName(id) {
  const m = memberById(id);
  return (state.pickles && state.pickles[id]) || (m ? m.pickle : "피클");
}
function ago(at) {
  if (!at) return "";
  const d = Date.now() - at;
  const min = Math.floor(d / 60000);
  if (min < 1) return "지금";
  if (min < 60) return min + "분 전";
  const hr = Math.floor(min / 60);
  if (hr < 24) return hr + "시간 전";
  return Math.floor(hr / 24) + "일 전";
}
function clock(at) {
  const d = new Date(at || Date.now());
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}
const isLive = (at) => at && Date.now() - at < 5 * 60 * 1000;

/* 색 → 옅은 톤 (비서 말풍선 배경) */
function tint(hex, a) {
  const h = String(hex || "#cfc4ba").replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  if (isNaN(n)) return "rgba(207,196,186," + a + ")";
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/* 메시지 한 건을 화면용으로 정규화
   · 앱에서 보낸 가족 글: { by, text, at }
   · 피클(비서) 글:        { authorId, authorName, isPickle:true, text, ts }
   둘 다 같은 말풍선으로 읽는다. */
function normMsg(key, m) {
  if (!m || typeof m !== "object") return null;
  const isPickle = m.isPickle === true || m.senderType === "pickle" || m.authorType === "pickle";
  const ownerId = m.authorId || m.by || m.ownerId || "";
  const owner = memberById(ownerId) || null;
  const ts = Number(m.ts || m.at || 0) || 0;
  let name = m.authorName || (isPickle ? pickleName(ownerId) : owner && owner.name) || ownerId || "가족";
  name = String(name).slice(0, 20);
  const text = String(m.text == null ? "" : m.text).slice(0, 400);
  if (!text) return null;
  return { key, text, ts, isPickle, ownerId, owner, name };
}

function dayKey(at) {
  const d = new Date(at || Date.now());
  return d.getFullYear() + "-" + d.getMonth() + "-" + d.getDate();
}
function dayLabel(at) {
  const d = new Date(at);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((today - day) / 86400000);
  if (diff === 0) return "오늘";
  if (diff === 1) return "어제";
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${"일월화수목금토"[d.getDay()]})`;
}

/* 받침에 맞는 조사 (회의·작업실로 / 거실로) */
function josaRo(word) {
  const c = word.charCodeAt(word.length - 1);
  if (!(c >= 0xac00 && c <= 0xd7a3)) return word + "로";
  const jong = (c - 0xac00) % 28;
  return word + (jong === 0 || jong === 8 ? "로" : "으로");
}

/* 피클 캐릭터 */
function critter(m) {
  const c = (m && m.color) || "#cfc4ba";
  const mark = (m && m.mark) || "";
  return `<svg viewBox="0 0 64 64" role="img" aria-label="${esc((m && m.name) || "")}의 피클">
    <path d="M32 8c13.4 0 22.6 9 22.6 21.4C54.6 43.2 44.7 55 32 55S9.4 43.2 9.4 29.4C9.4 17 18.6 8 32 8Z" fill="${c}"/>
    <g stroke="#ffffff" stroke-opacity=".5" stroke-width="1.6" fill="none" stroke-linecap="round">
      <path d="M18 42c2.4-2.3 4.9-2.3 7.3 0s4.9 2.3 7.3 0 4.9-2.3 7.3 0 4.9 2.3 7.3 0"/>
      <path d="M18 48c2.4-2.3 4.9-2.3 7.3 0s4.9 2.3 7.3 0 4.9-2.3 7.3 0 4.9 2.3 7.3 0"/>
    </g>
    ${mark ? `<text x="32" y="39" text-anchor="middle" font-size="8.5" font-weight="800" fill="#3b2f2a" opacity=".22">${esc(mark)}</text>` : ""}
    <circle cx="24.5" cy="27" r="2.6" fill="#3b2f2a"/>
    <circle cx="39.5" cy="27" r="2.6" fill="#3b2f2a"/>
    <circle cx="25.2" cy="26.2" r=".9" fill="#ffffff"/>
    <circle cx="40.2" cy="26.2" r=".9" fill="#ffffff"/>
    <ellipse cx="18.8" cy="32" rx="3.2" ry="1.9" fill="#ff9db0" opacity=".5"/>
    <ellipse cx="45.2" cy="32" rx="3.2" ry="1.9" fill="#ff9db0" opacity=".5"/>
  </svg>`;
}
$("#lock-critter").innerHTML = critter(memberById("seunghwan"));

/* ── 잠금 ─────────────────────────────── */
async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function paintPin() {
  const dots = $("#pin-dots").children;
  for (let i = 0; i < dots.length; i++) dots[i].classList.toggle("on", i < state.pin.length);
}
async function submitPin() {
  if (state.pin.length < 4) return;
  if ((await sha256(PIN_SALT + state.pin)) === PIN_HASH) {
    localStorage.setItem(LS_PASS, PIN_HASH);
    state.pin = ""; paintPin();
    enterApp();
  } else {
    $("#pin-msg").textContent = "PIN이 맞지 않아요";
    const card = $("#lock .lock-card");
    card.classList.add("shake");
    setTimeout(() => card.classList.remove("shake"), 340);
    state.pin = ""; paintPin();
  }
}
$("#keypad").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-key]");
  if (!btn) return;
  const k = btn.dataset.key;
  $("#pin-msg").textContent = "";
  if (k === "clear") { state.pin = ""; paintPin(); return; }
  if (k === "back") { state.pin = state.pin.slice(0, -1); paintPin(); return; }
  if (state.pin.length >= 4) return;
  state.pin += k; paintPin();
  if (state.pin.length === 4) setTimeout(submitPin, 120);
});
document.addEventListener("keydown", (e) => {
  if (!$("#app").hidden) return;
  if (/^[0-9]$/.test(e.key) && state.pin.length < 4) {
    state.pin += e.key; paintPin();
    if (state.pin.length === 4) setTimeout(submitPin, 120);
  } else if (e.key === "Backspace") { state.pin = state.pin.slice(0, -1); paintPin(); }
});

/* ── 입장 / 잠금 ─────────────────────── */
let started = false;
function enterApp() {
  $("#lock").style.display = "none";
  $("#app").hidden = false;
  if (!started) { started = true; startRealtime(); }
  renderRooms(); renderSeat();
  if (!state.me) openWhoSheet();
}
$("#lock-btn").addEventListener("click", () => { localStorage.removeItem(LS_PASS); location.reload(); });

/* ── 실시간 ───────────────────────────── */
function startRealtime() {
  db.ref(".info/connected").on("value", (s) => {
    $("#conn-label").textContent = s.val() ? "" : "· 연결 중";
  });
  db.ref("office").on("value", (s) => {
    const v = s.val() || {};
    const norm = {};
    Object.keys(v).forEach((id) => {
      const p = Object.assign({}, v[id]);
      if (p.room != null) p.room = normRoom(p.room);
      norm[id] = p;
    });
    state.office = norm;
    renderRooms(); renderSeat();
  });
  db.ref("messages").limitToLast(200).on("value", (s) => {
    const v = s.val() || {};
    state.messages = Object.keys(v)
      .map((k) => normMsg(k, v[k]))
      .filter(Boolean)
      .sort((a, b) => (a.ts || 0) - (b.ts || 0));
    renderChat();
  });
  db.ref("todos").on("value", (s) => { state.todos = s.val() || {}; renderTodos(); });
  db.ref("setting/pickle").on("value", (s) => { state.pickles = s.val() || {}; renderSeat(); renderChat(); renderTodos(); });

  if (state.me) db.ref("office/" + state.me).update({ at: Date.now() });
  setInterval(() => { if (state.me) db.ref("office/" + state.me).update({ at: Date.now() }); }, 45 * 1000);
  setInterval(() => { renderRooms(); renderSeat(); renderChat(); }, 60 * 1000);
}

/* ── 방 현황 (2개 방) ─────────────────── */
function renderRooms() {
  const grid = $("#room-grid");
  const myRoom = state.me ? normRoom((state.office[state.me] || {}).room) : null;
  grid.innerHTML = ROOMS.map((room) => {
    const people = MEMBERS.filter((m) => normRoom((state.office[m.id] || {}).room) === room.id);
    const faces = people.map((m) => `<span class="rt-face">${critter(m)}</span>`).join("");
    return `<button type="button" class="room-tile ${myRoom === room.id ? "mine" : ""}" data-room="${room.id}">
      <span class="rt-top">
        <span class="rt-name">${esc(room.name)}${myRoom === room.id ? `<em class="rt-mine">내 자리</em>` : ""}</span>
        <span class="rt-count">${people.length}명</span>
      </span>
      <span class="rt-faces">${faces || `<span class="rt-empty">비어 있음</span>`}</span>
    </button>`;
  }).join("");

  const live = MEMBERS.filter((m) => isLive((state.office[m.id] || {}).at)).length;
  $("#here-count").textContent = live ? `${live}명 접속` : "";
}

/* ── 내 자리 ──────────────────────────── */
function renderSeat() {
  const me = state.me ? memberById(state.me) : null;
  const my = me ? (state.office[me.id] || {}) : {};
  const myRoom = me ? roomById(my.room) : null;

  $("#seat-ava").innerHTML = me ? critter(me) : `<span class="seat-ava-empty"></span>`;
  $("#seat-sum-name").textContent = me ? `${me.name} · ${me.role}` : "나 선택";
  $("#seat-sum-sub").textContent = me
    ? [myRoom ? myRoom.name : "방 미정", my.status || ""].filter(Boolean).join(" · ")
    : "내 자리를 골라 주세요";

  $("#who-row").innerHTML = MEMBERS.map((m) =>
    `<button type="button" class="who-btn ${state.me === m.id ? "sel" : ""}" data-who="${m.id}">
      <span class="ava">${critter(m)}</span>${esc(m.name)}
    </button>`).join("");

  $("#room-seg").innerHTML = ROOMS.map((r) =>
    `<button type="button" class="${myRoom && myRoom.id === r.id ? "sel" : ""}" data-room-pick="${r.id}">${esc(r.name)}</button>`).join("");

  if (me) {
    $("#me-name").textContent = me.name;
    $("#me-dot").style.background = isLive(my.at) ? "#7fb84e" : "#cfcec9";
    if (document.activeElement !== $("#status-input")) $("#status-input").value = my.status || "";
  } else {
    $("#me-name").textContent = "나 선택";
    $("#me-dot").style.background = "#cfcec9";
  }
  renderAsToggle();
}

function setSeatOpen(open) {
  $("#seat-panel").hidden = !open;
  $("#seat-toggle").setAttribute("aria-expanded", open ? "true" : "false");
  $("#seat-caret").textContent = open ? "접기 ▴" : "내 자리 ▾";
}
$("#seat-toggle").addEventListener("click", () => setSeatOpen($("#seat-panel").hidden));

function setPresence(patch, note) {
  if (!state.me) { openWhoSheet(); return; }
  const cur = state.office[state.me] || {};
  db.ref("office/" + state.me).update(Object.assign({ room: normRoom(cur.room) || "living", status: cur.status || "", at: Date.now() }, patch));
  if (note) toast(note);
}
$("#who-row").addEventListener("click", (e) => {
  const b = e.target.closest("[data-who]"); if (b) pickMe(b.dataset.who);
});
$("#room-seg").addEventListener("click", (e) => {
  const b = e.target.closest("[data-room-pick]");
  if (b) setPresence({ room: b.dataset.roomPick }, josaRo(roomById(b.dataset.roomPick).name) + " 이동");
});
$("#room-grid").addEventListener("click", (e) => {
  const card = e.target.closest(".room-tile");
  if (card) setPresence({ room: card.dataset.room }, josaRo(roomById(card.dataset.room).name) + " 이동");
});
$("#status-save").addEventListener("click", () => {
  setPresence({ status: $("#status-input").value.trim().slice(0, 30) }, "저장했어요");
});
$("#status-input").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); $("#status-save").click(); } });

/* ── 프로필 ───────────────────────────── */
function openWhoSheet() {
  $("#who-list").innerHTML = MEMBERS.map((m) =>
    `<button type="button" class="who-card ${state.me === m.id ? "sel" : ""}" data-pick="${m.id}">
      <span class="ava">${critter(m)}</span>
      <span><span class="who-card-name">${esc(m.name)}</span><span class="who-card-role">${esc(m.role)} · ${esc(pickleName(m.id))}</span></span>
    </button>`).join("");
  $("#who-sheet").hidden = false;
}
$("#who-close").addEventListener("click", () => { $("#who-sheet").hidden = true; });
$("#me-chip").addEventListener("click", openWhoSheet);
$("#who-sheet").addEventListener("click", (e) => { if (e.target.id === "who-sheet") $("#who-sheet").hidden = true; });
$("#who-list").addEventListener("click", (e) => {
  const b = e.target.closest("[data-pick]");
  if (!b) return;
  pickMe(b.dataset.pick);
  $("#who-sheet").hidden = true;
});
function pickMe(id) {
  if (!memberById(id)) return;
  state.me = id;
  localStorage.setItem(LS_ME, id);
  const cur = state.office[id];
  db.ref("office/" + id).update({ room: normRoom(cur && cur.room) || "living", status: (cur && cur.status) || "", at: Date.now() });
  renderRooms(); renderSeat(); renderChat();
  toast(memberById(id).name + "으로 입장");
}

/* ── 가족 대화 (카톡 단톡방처럼) ────────── */
let chatInit = false;
function renderChat() {
  const list = $("#chat-list");
  if (!list) return;
  const nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
  if (!state.messages.length) {
    list.innerHTML = `<p class="empty">아직 메모가 없어요.<br>첫 한마디를 남겨 보세요.</p>`;
    chatInit = true;
    return;
  }
  let lastDay = "";
  list.innerHTML = state.messages.map((m) => {
    const owner = m.owner;
    const mine = !!state.me && m.ownerId === state.me && !m.isPickle;
    const delOk = !!state.me && m.ownerId === state.me;
    const color = owner ? owner.color : (m.isPickle ? "#9aa79a" : "#cfc4ba");
    const ink = owner ? owner.ink : (m.isPickle ? "#5c6b5c" : "#8b8b86");
    const role = m.isPickle
      ? (owner ? owner.name + " 님 비서" : "비서")
      : (owner ? owner.role : "");
    const face = owner || { color: color, name: m.name, mark: "" };
    const dk = dayKey(m.ts);
    const divider = dk !== lastDay ? `<div class="day-div"><span>${esc(dayLabel(m.ts))}</span></div>` : "";
    lastDay = dk;
    return `${divider}<div class="msg ${mine ? "mine" : "other"} ${m.isPickle ? "pickle" : ""}" style="--who:${esc(color)};--whoInk:${esc(ink)};--whoTint:${tint(color, 0.16)}">
      <span class="ava">${critter(face)}</span>
      <div class="msg-col">
        <div class="msg-head">
          <span class="msg-name">${esc(m.name)}</span>
          ${m.isPickle ? `<span class="pkl-badge">비서</span>` : ""}
          ${role ? `<span class="msg-role">${esc(role)}</span>` : ""}
          <span class="msg-time">${clock(m.ts)}</span>
          ${delOk ? `<button type="button" class="msg-del" data-msg-del="${esc(m.key)}" aria-label="삭제">✕</button>` : ""}
        </div>
        <div class="bubble">${esc(m.text)}</div>
      </div>
    </div>`;
  }).join("");
  if (!chatInit || nearBottom || list.scrollTop === 0) {
    list.scrollTop = list.scrollHeight;
    chatInit = true;
  }
}

/* 말하는 사람 전환: 나 / 내 비서 */
function renderAsToggle() {
  const box = $("#as-toggle");
  if (!box) return;
  box.querySelectorAll("[data-as]").forEach((b) => b.classList.toggle("sel", b.dataset.as === state.as));
  const pkl = state.me ? pickleName(state.me) : "내 비서";
  $("#chat-input").placeholder = state.as === "pickle" ? pkl + "로 말하기" : "가족·비서에게 한마디";
}
$("#as-toggle").addEventListener("click", (e) => {
  const b = e.target.closest("[data-as]");
  if (!b) return;
  if (!state.me) { openWhoSheet(); return; }
  state.as = b.dataset.as === "pickle" ? "pickle" : "me";
  localStorage.setItem(LS_AS, state.as);
  renderAsToggle();
});

$("#chat-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = $("#chat-input");
  const text = input.value.trim();
  if (!text) return;
  if (!state.me) { openWhoSheet(); return; }
  if (state.as === "pickle") {
    db.ref("messages").push({
      authorId: state.me,
      authorName: pickleName(state.me),
      isPickle: true,
      text: text.slice(0, 200),
      ts: Date.now()
    });
  } else {
    db.ref("messages").push({ by: state.me, text: text.slice(0, 200), at: Date.now() });
  }
  input.value = "";
  setTimeout(() => { const l = $("#chat-list"); l.scrollTop = l.scrollHeight; }, 200);
});
$("#chat-list").addEventListener("click", (e) => {
  const b = e.target.closest("[data-msg-del]");
  if (b) db.ref("messages/" + b.dataset.msgDel).remove();
});

/* ── 할 일 ───────────────────────────── */
function renderTodos() {
  const items = Object.keys(state.todos).map((k) => Object.assign({ key: k }, state.todos[k]))
    .sort((a, b) => (a.done === b.done ? (a.at || 0) - (b.at || 0) : (a.done ? 1 : 0) - (b.done ? 1 : 0)));
  $("#todo-empty").hidden = items.length > 0;
  $("#todo-count").textContent = items.filter((t) => !t.done).length + "개 남음";
  $("#todo-list").innerHTML = items.map((t) => {
    const who = memberById(t.by);
    return `<li class="todo ${t.done ? "done" : ""}">
      <button type="button" class="todo-check" data-toggle="${esc(t.key)}" aria-label="완료">${t.done ? "✓" : ""}</button>
      <span class="todo-txt">${esc(t.text)}<span class="todo-meta">${esc(who ? who.name : "가족")} · ${esc(ago(t.at))}</span></span>
      <button type="button" class="todo-del" data-todo-del="${esc(t.key)}" aria-label="삭제">✕</button>
    </li>`;
  }).join("");
}
$("#todo-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = $("#todo-input");
  const text = input.value.trim();
  if (!text) return;
  if (!state.me) { openWhoSheet(); return; }
  db.ref("todos").push({ text: text.slice(0, 80), done: false, by: state.me, at: Date.now() });
  input.value = "";
});
$("#todo-list").addEventListener("click", (e) => {
  const t = e.target.closest("[data-toggle]");
  if (t) { db.ref("todos/" + t.dataset.toggle).update({ done: !(state.todos[t.dataset.toggle] || {}).done }); return; }
  const d = e.target.closest("[data-todo-del]");
  if (d) db.ref("todos/" + d.dataset.todoDel).remove();
});

/* ── 탭 · 토스트 ──────────────────────── */
$("#tabbar").addEventListener("click", (e) => {
  const b = e.target.closest("[data-tab]");
  if (!b) return;
  state.tab = b.dataset.tab;
  document.querySelectorAll(".tabbar button").forEach((t) => t.classList.toggle("active", t.dataset.tab === state.tab));
  document.querySelectorAll(".view").forEach((v) => (v.hidden = v.id !== "view-" + state.tab));
  if (state.tab === "desk") { const l = $("#chat-list"); l.scrollTop = l.scrollHeight; }
});

let toastTimer = null;
function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 1600);
}

(function boot() {
  paintPin();
  if (localStorage.getItem(LS_PASS) === PIN_HASH) enterApp();
})();
