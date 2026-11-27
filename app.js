/* 가족 합동 비서실 · app.js */
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
  { id: "seunghwan", name: "승환", role: "아빠", color: "#a8d36b", mark: "ㅂ", pickle: "제키핑클" },
  { id: "goun",      name: "고운", role: "엄마", color: "#f7a8b8", mark: "ㄱ", pickle: "고운의 피클" },
  { id: "hyeok",     name: "혁이", role: "아들", color: "#8fc9f2", mark: "ㅎ", pickle: "혁이의 피클" },
  { id: "jiwoo",     name: "지우", role: "딸",   color: "#ffd47e", mark: "ㅈ", pickle: "지우의 피클" }
];
const ROOMS = [
  { id: "living",  name: "가족 거실" },
  { id: "meeting", name: "회의실" },
  { id: "work",    name: "비서 작업실" }
];

const PIN_SALT = "ofs-2026-family:";
const PIN_HASH = "aa5cbb473ced295ba4835b53968b12c9c8bb72864e543aa3345ef1256ca10e77";
const LS_PASS = "ofo.pass";
const LS_ME = "ofo.me";

const state = {
  me: localStorage.getItem(LS_ME) || null,
  office: {}, messages: [], todos: {}, pickles: {}, tab: "office", pin: ""
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

/* 받침에 맞는 조사 (회의실로 / 거실로 / 작업실로) */
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
  renderOffice();
  if (!state.me) openWhoSheet();
}
$("#lock-btn").addEventListener("click", () => { localStorage.removeItem(LS_PASS); location.reload(); });

/* ── 실시간 ───────────────────────────── */
function startRealtime() {
  db.ref(".info/connected").on("value", (s) => {
    $("#conn-label").textContent = s.val() ? "" : "· 연결 중";
  });
  db.ref("office").on("value", (s) => { state.office = s.val() || {}; renderOffice(); });
  db.ref("messages").limitToLast(200).on("value", (s) => {
    const v = s.val() || {};
    state.messages = Object.keys(v).map((k) => Object.assign({ key: k }, v[k])).sort((a, b) => (a.at || 0) - (b.at || 0));
    renderChat();
  });
  db.ref("todos").on("value", (s) => { state.todos = s.val() || {}; renderTodos(); });
  db.ref("setting/pickle").on("value", (s) => { state.pickles = s.val() || {}; renderOffice(); renderChat(); renderTodos(); });

  if (state.me) db.ref("office/" + state.me).update({ at: Date.now() });
  setInterval(() => { if (state.me) db.ref("office/" + state.me).update({ at: Date.now() }); }, 45 * 1000);
  setInterval(() => { renderOffice(); renderChat(); }, 60 * 1000);
}

/* ── 오피스 ───────────────────────────── */
function renderOffice() {
  const grid = $("#room-grid");
  grid.innerHTML = ROOMS.map((room) => {
    const people = MEMBERS.filter((m) => (state.office[m.id] || {}).room === room.id);
    const rows = people.map((m) => {
      const p = state.office[m.id] || {};
      return `<div class="person">
        <span class="ava">${critter(m)}</span>
        <span class="person-txt">
          <span class="person-name">${esc(m.name)}</span>
          <span class="person-status">${esc(p.status || "")}</span>
        </span>
        <span class="person-ago">${esc(ago(p.at))}</span>
      </div>`;
    }).join("");
    return `<div class="room ${state.me && (state.office[state.me] || {}).room === room.id ? "mine" : ""}" data-room="${room.id}">
      <div class="room-top"><span class="room-name">${esc(room.name)}</span><span class="room-count">${people.length}명</span></div>
      ${rows ? `<div class="room-people">${rows}</div>` : `<p class="room-empty">비어 있음</p>`}
    </div>`;
  }).join("");

  const live = MEMBERS.filter((m) => isLive((state.office[m.id] || {}).at)).length;
  $("#here-count").textContent = live ? `${live}명 접속` : "";

  $("#who-row").innerHTML = MEMBERS.map((m) =>
    `<button type="button" class="who-btn ${state.me === m.id ? "sel" : ""}" data-who="${m.id}">
      <span class="ava">${critter(m)}</span>${esc(m.name)}
    </button>`).join("");

  const myRoom = state.me && state.office[state.me] ? state.office[state.me].room : null;
  $("#room-seg").innerHTML = ROOMS.map((r) =>
    `<button type="button" class="${myRoom === r.id ? "sel" : ""}" data-room-pick="${r.id}">${esc(r.name)}</button>`).join("");

  if (state.me) {
    const p = state.office[state.me] || {};
    $("#me-name").textContent = memberById(state.me).name;
    $("#me-dot").style.background = isLive(p.at) ? "#7fb84e" : "#cfcec9";
    if (document.activeElement !== $("#status-input")) $("#status-input").value = p.status || "";
    $("#status-input").placeholder = "한 줄 상태 (예: 운행 중)";
  } else {
    $("#me-name").textContent = "나 선택";
    $("#me-dot").style.background = "#cfcec9";
  }
}

function setPresence(patch, note) {
  if (!state.me) { openWhoSheet(); return; }
  const cur = state.office[state.me] || {};
  db.ref("office/" + state.me).update(Object.assign({ room: cur.room || "living", status: cur.status || "", at: Date.now() }, patch));
  if (note) toast(note);
}
$("#who-row").addEventListener("click", (e) => {
  const b = e.target.closest("[data-who]"); if (b) pickMe(b.dataset.who);
});
$("#room-seg").addEventListener("click", (e) => {
  const b = e.target.closest("[data-room-pick]");
  if (b) setPresence({ room: b.dataset.roomPick }, josaRo(ROOMS.find((r) => r.id === b.dataset.roomPick).name) + " 이동");
});
$("#room-grid").addEventListener("click", (e) => {
  const card = e.target.closest(".room");
  if (card) setPresence({ room: card.dataset.room }, josaRo(ROOMS.find((r) => r.id === card.dataset.room).name) + " 이동");
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
  db.ref("office/" + id).update(cur ? { at: Date.now() } : { room: "living", status: "", at: Date.now() });
  renderOffice();
  toast(memberById(id).name + "으로 입장");
}

/* ── 회의실 ───────────────────────────── */
function renderChat() {
  const list = $("#chat-list");
  const nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
  if (!state.messages.length) {
    list.innerHTML = `<p class="empty">아직 메모가 없어요.</p>`;
    return;
  }
  list.innerHTML = state.messages.map((m) => {
    const who = memberById(m.by) || { name: m.by || "가족", color: "#cfc4ba", mark: "" };
    const mine = state.me && m.by === state.me;
    return `<div class="msg ${mine ? "mine" : ""}">
      <span class="ava">${critter(who)}</span>
      <span class="msg-body">
        <span class="msg-head"><span class="msg-name">${esc(who.name)}</span><span class="msg-time">${clock(m.at)}</span></span>
        <span class="msg-text">${esc(m.text)}</span>
      </span>
      ${mine ? `<button type="button" class="msg-del" data-msg-del="${esc(m.key)}" aria-label="삭제">✕</button>` : ""}
    </div>`;
  }).join("");
  if (nearBottom || list.scrollTop === 0) list.scrollTop = list.scrollHeight;
}
$("#chat-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = $("#chat-input");
  const text = input.value.trim();
  if (!text) return;
  if (!state.me) { openWhoSheet(); return; }
  db.ref("messages").push({ by: state.me, text: text.slice(0, 200), at: Date.now() });
  input.value = "";
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
  if (state.tab === "chat") { const l = $("#chat-list"); l.scrollTop = l.scrollHeight; }
  window.scrollTo(0, 0);
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
