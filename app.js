/* ─────────────────────────────────────────────
   가족 합동 비서실 · app.js
   가족 전용 PIN 잠금 + 실시간 오피스 + 회의실 + 할 일
   ───────────────────────────────────────────── */
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

/* ── 고정 정보 (개인정보 없이 이름과 애칭만) ───────────── */
const MEMBERS = [
  { id: "seunghwan", name: "승환", role: "아빠 · 사장님", color: "#a8d36b", mark: "ㅂ", pickle: "제키핑클" },
  { id: "goun",      name: "고운", role: "엄마",          color: "#f7a8b8", mark: "ㄱ", pickle: "고운의 피클" },
  { id: "hyeok",     name: "혁이", role: "아들",          color: "#8fc9f2", mark: "ㅎ", pickle: "혁이의 피클" },
  { id: "jiwoo",     name: "지우", role: "딸",            color: "#ffd47e", mark: "ㅈ", pickle: "지우의 피클" }
];
const ROOMS = [
  { id: "living",  icon: "🛋️", name: "가족 거실" },
  { id: "meeting", icon: "📋", name: "회의실" },
  { id: "work",    icon: "💼", name: "비서 작업실" }
];
const PRESETS = ["운행 중", "회의 중", "쉬는 중", "이동 중", "점심 중", "집중 중", "산책 중"];

const PIN_SALT = "ofs-2026-family:";
const PIN_HASH = "aa5cbb473ced295ba4835b53968b12c9c8bb72864e543aa3345ef1256ca10e77";
const LS_PASS = "ofo.pass";
const LS_ME = "ofo.me";

/* ── 상태 ──────────────────────────────────────── */
const state = {
  me: localStorage.getItem(LS_ME) || null,
  office: {},
  messages: [],
  todos: {},
  pickles: {},
  tab: "office",
  pin: ""
};

/* ── 짧은 도우미 ──────────────────────────────── */
const $ = (sel) => document.querySelector(sel);
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
  const diff = Date.now() - at;
  if (diff < 0) return "방금";
  const min = Math.floor(diff / 60000);
  if (min < 1) return "방금";
  if (min < 60) return min + "분 전";
  const hr = Math.floor(min / 60);
  if (hr < 24) return hr + "시간 전";
  return Math.floor(hr / 24) + "일 전";
}
function clock(at) {
  const d = new Date(at || Date.now());
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}
function isLive(at) { return at && Date.now() - at < 5 * 60 * 1000; }

/* ── 캐릭터 그림 (연두 니트 ㅂ 캐릭터 느낌) ──────────── */
function critter(m, size) {
  const c = (m && m.color) || "#cfc4ba";
  const mark = (m && m.mark) || "";
  return `<svg viewBox="0 0 64 64" role="img" aria-label="${esc((m && m.name) || "")}의 피클" style="width:100%;height:100%;display:block">
    <path d="M32 7c13.8 0 23.5 9.4 23.5 22.2C55.5 43.6 45.2 56 32 56S8.5 43.6 8.5 29.2C8.5 16.4 18.2 7 32 7Z" fill="${c}"/>
    <path d="M32 7c13.8 0 23.5 9.4 23.5 22.2 0 1.3-.1 2.5-.3 3.7H8.8c-.2-1.2-.3-2.4-.3-3.7C8.5 16.4 18.2 7 32 7Z" fill="#ffffff" opacity=".25"/>
    <g stroke="#ffffff" stroke-opacity=".55" stroke-width="1.5" fill="none" stroke-linecap="round">
      <path d="M17 42c2.6-2.5 5.2-2.5 7.8 0s5.2 2.5 7.8 0 5.2-2.5 7.8 0 5.2 2.5 7.4 0"/>
      <path d="M17 48c2.6-2.5 5.2-2.5 7.8 0s5.2 2.5 7.8 0 5.2-2.5 7.8 0 5.2 2.5 7.4 0"/>
    </g>
    ${mark ? `<text x="32" y="39.5" text-anchor="middle" font-size="9" font-weight="800" fill="#3b2f2a" opacity=".28">${esc(mark)}</text>` : ""}
    <circle cx="24.3" cy="26.5" r="2.7" fill="#3b2f2a"/>
    <circle cx="39.7" cy="26.5" r="2.7" fill="#3b2f2a"/>
    <circle cx="25.1" cy="25.6" r=".95" fill="#ffffff"/>
    <circle cx="40.5" cy="25.6" r=".95" fill="#ffffff"/>
    <ellipse cx="18.5" cy="31.6" rx="3.3" ry="2" fill="#ff9db0" opacity=".55"/>
    <ellipse cx="45.5" cy="31.6" rx="3.3" ry="2" fill="#ff9db0" opacity=".55"/>
  </svg>`;
}
$("#lock-critter").innerHTML = critter(memberById("seunghwan"));

/* ─────────────────────────────────────────────
   잠금 화면
   ───────────────────────────────────────────── */
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
  const hash = await sha256(PIN_SALT + state.pin);
  if (hash === PIN_HASH) {
    localStorage.setItem(LS_PASS, PIN_HASH);
    state.pin = "";
    paintPin();
    enterApp();
  } else {
    $("#pin-msg").textContent = "PIN이 맞지 않아요. 다시 눌러주세요";
    $("#pin-msg").classList.add("err");
    const card = $(".lock-card");
    card.classList.add("shake");
    setTimeout(() => card.classList.remove("shake"), 380);
    state.pin = "";
    paintPin();
  }
}

$("#keypad").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-key]");
  if (!btn) return;
  const k = btn.dataset.key;
  $("#pin-msg").classList.remove("err");
  $("#pin-msg").textContent = "가족 PIN 4자리를 눌러주세요";
  if (k === "clear") { state.pin = ""; paintPin(); return; }
  if (k === "back") { state.pin = state.pin.slice(0, -1); paintPin(); return; }
  if (state.pin.length >= 4) return;
  state.pin += k;
  paintPin();
  if (state.pin.length === 4) setTimeout(submitPin, 130);
});

document.addEventListener("keydown", (e) => {
  if (!$("#app").hidden) return; // 본문이 열려 있으면 무시
  if (/^[0-9]$/.test(e.key)) {
    if (state.pin.length < 4) { state.pin += e.key; paintPin(); if (state.pin.length === 4) setTimeout(submitPin, 130); }
  } else if (e.key === "Backspace") { state.pin = state.pin.slice(0, -1); paintPin(); }
});

/* ─────────────────────────────────────────────
   입장 / 잠금
   ───────────────────────────────────────────── */
let started = false;
function enterApp() {
  $("#lock").hidden = true;
  $("#lock").style.display = "none";
  $("#app").hidden = false;
  if (!started) { started = true; startRealtime(); }
  renderOffice();
  if (!state.me) openWhoSheet();
}
function lockApp() {
  localStorage.removeItem(LS_PASS);
  location.reload();
}
$("#lock-btn").addEventListener("click", lockApp);

/* ─────────────────────────────────────────────
   실시간 데이터
   ───────────────────────────────────────────── */
function startRealtime() {
  db.ref(".info/connected").on("value", (snap) => {
    $("#conn-label").textContent = snap.val() ? "실시간 연결됨" : "연결 끊김…";
  });

  db.ref("office").on("value", (snap) => {
    state.office = snap.val() || {};
    renderOffice();
    renderHeroNames();
  });

  db.ref("messages").limitToLast(200).on("value", (snap) => {
    const val = snap.val() || {};
    state.messages = Object.keys(val)
      .map((key) => Object.assign({ key }, val[key]))
      .sort((a, b) => (a.at || 0) - (b.at || 0));
    renderChat(true);
  });

  db.ref("todos").on("value", (snap) => {
    state.todos = snap.val() || {};
    renderTodos();
  });

  db.ref("setting/pickle").on("value", (snap) => {
    state.pickles = snap.val() || {};
    renderOffice();
    renderChat(false);
    renderTodos();
  });

  // 내 하트비트 (접속 중 표시)
  setInterval(() => {
    if (!state.me) return;
    db.ref("office/" + state.me).update({ at: Date.now() });
  }, 60 * 1000);

  setInterval(() => { renderOffice(); renderChat(false); }, 60 * 1000);
}

/* ─────────────────────────────────────────────
   오피스 맵
   ───────────────────────────────────────────── */
function sortedMembers() {
  return MEMBERS.slice().sort((a, b) => {
    const ra = state.office[a.id] ? ROOMS.findIndex((r) => r.id === state.office[a.id].room) : 9;
    const rb = state.office[b.id] ? ROOMS.findIndex((r) => r.id === state.office[b.id].room) : 9;
    return ra - rb;
  });
}

function renderHeroNames() {
  const stack = $("#hero-stack");
  stack.innerHTML = sortedMembers().map((m) => {
    const p = state.office[m.id] || {};
    return `<span class="mini" title="${esc(m.name)} · ${esc(pickleName(m.id))}">${critter(m)}</span>`;
  }).join("");

  const here = MEMBERS.filter((m) => state.office[m.id] && isLive(state.office[m.id].at)).length;
  $("#hero-sub").textContent = here
    ? `${here}명이 비서실에 있어요`
    : "방을 눌러 내 자리를 옮겨보세요";
}

function renderOffice() {
  // 방 카드
  const grid = $("#room-grid");
  grid.innerHTML = ROOMS.map((room) => {
    const people = sortedMembers().filter((m) => (state.office[m.id] || {}).room === room.id);
    const rows = people.map((m) => {
      const p = state.office[m.id] || {};
      return `<div class="person">
        <span class="ava">${critter(m)}</span>
        <span class="person-txt">
          <span class="person-name">
            <span class="live-dot ${isLive(p.at) ? "on" : ""}"></span>${esc(m.name)}
          </span>
          <span class="person-pickle">${esc(pickleName(m.id))}</span>
          <span class="person-status">${esc((p.status || "비서실에 도착").trim() || "비서실에 도착")}</span>
        </span>
        <span class="person-ago">${esc(ago(p.at))}</span>
      </div>`;
    }).join("");
    return `<div class="room ${state.me && (state.office[state.me] || {}).room === room.id ? "mine" : ""}" data-room="${room.id}">
      <div class="room-top">
        <span class="room-name">${room.icon} ${esc(room.name)}</span>
        <span class="room-count">${people.length}명</span>
      </div>
      <div class="room-people">${rows || `<span class="room-empty">아직 비어 있어요</span>`}</div>
    </div>`;
  }).join("");

  // 내 자리 패널
  const whoRow = $("#who-row");
  whoRow.innerHTML = MEMBERS.map((m) => `<button type="button" class="who-btn ${state.me === m.id ? "sel" : ""}" data-who="${m.id}">
      <span class="ava">${critter(m)}</span>${esc(m.name)}
    </button>`).join("");

  const seg = $("#room-seg");
  const myRoom = state.me && state.office[state.me] ? state.office[state.me].room : null;
  seg.innerHTML = ROOMS.map((r) => `<button type="button" class="${myRoom === r.id ? "sel" : ""}" data-room-pick="${r.id}">
      <span class="seg-ico">${r.icon}</span>${esc(r.name)}
    </button>`).join("");

  const presets = $("#status-presets");
  if (!presets.dataset.built) {
    presets.innerHTML = PRESETS.map((p) => `<button type="button" data-preset="${esc(p)}">${esc(p)}</button>`).join("");
    presets.dataset.built = "1";
  }

  if (state.me) {
    const st = (state.office[state.me] || {}).status;
    if (document.activeElement !== $("#status-input")) $("#status-input").value = st || "";
    $("#me-name").textContent = memberById(state.me).name + " · " + pickleName(state.me);
    const p = state.office[state.me] || {};
    $("#me-dot").style.background = isLive(p.at) ? "#5ec26a" : "#e2b13c";
  } else {
    $("#me-name").textContent = "나 선택";
    $("#me-dot").style.background = "#d9cec4";
  }
}

/* 내 자리 바꾸기 */
function setPresence(patch, note) {
  if (!state.me) { openWhoSheet(); return; }
  const ref = db.ref("office/" + state.me);
  const cur = state.office[state.me] || {};
  ref.update(Object.assign({ room: cur.room || "living", status: cur.status || "", at: Date.now() }, patch));
  if (note) toast(note);
}

$("#who-row").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-who]");
  if (!btn) return;
  pickMe(btn.dataset.who);
});

$("#room-seg").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-room-pick]");
  if (!btn) return;
  const room = ROOMS.find((r) => r.id === btn.dataset.roomPick);
  setPresence({ room: room.id }, room.icon + " " + room.name + "(으)로 이동했어요");
});

$("#room-grid").addEventListener("click", (e) => {
  const card = e.target.closest(".room");
  if (!card) return;
  const room = ROOMS.find((r) => r.id === card.dataset.room);
  setPresence({ room: room.id }, room.icon + " " + room.name + "(으)로 이동했어요");
});

$("#status-save").addEventListener("click", () => {
  const v = $("#status-input").value.trim().slice(0, 30);
  setPresence({ status: v }, "상태를 바꿨어요");
});
$("#status-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); $("#status-save").click(); }
});
$("#status-presets").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-preset]");
  if (!btn) return;
  $("#status-input").value = btn.dataset.preset;
  setPresence({ status: btn.dataset.preset }, "상태를 바꿨어요");
});

/* ─────────────────────────────────────────────
   프로필 선택
   ───────────────────────────────────────────── */
function openWhoSheet() {
  const list = $("#who-list");
  list.innerHTML = MEMBERS.map((m) => `<button type="button" class="who-card ${state.me === m.id ? "sel" : ""}" data-pick="${m.id}">
      <span class="ava">${critter(m)}</span>
      <span>
        <span class="who-card-name">${esc(m.name)}</span>
        <span class="who-card-role">${esc(m.role)} · ${esc(pickleName(m.id))}</span>
      </span>
    </button>`).join("");
  $("#who-sheet").hidden = false;
}
function closeWhoSheet() { $("#who-sheet").hidden = true; }
$("#who-close").addEventListener("click", closeWhoSheet);
$("#me-chip").addEventListener("click", openWhoSheet);
$("#who-sheet").addEventListener("click", (e) => { if (e.target.id === "who-sheet") closeWhoSheet(); });

$("#who-list").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-pick]");
  if (!btn) return;
  pickMe(btn.dataset.pick);
  closeWhoSheet();
});

function pickMe(id) {
  if (!memberById(id)) return;
  state.me = id;
  localStorage.setItem(LS_ME, id);
  if (!state.office[id]) {
    db.ref("office/" + id).update({ room: "living", status: "비서실에 도착", at: Date.now() });
  } else {
    db.ref("office/" + id).update({ at: Date.now() });
  }
  renderOffice();
  toast(memberById(id).name + "님으로 입장했어요");
}

/* ─────────────────────────────────────────────
   회의실 (메모)
   ───────────────────────────────────────────── */
function renderChat(scroll) {
  const list = $("#chat-list");
  const nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
  const empty = $("#chat-empty");

  if (!state.messages.length) {
    list.innerHTML = "";
    list.appendChild(empty);
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  const html = state.messages.map((m) => {
    const who = memberById(m.by) || { name: m.by || "가족", color: "#cfc4ba", mark: "" };
    const mine = state.me && m.by === state.me;
    return `<div class="msg ${mine ? "mine" : ""}">
      <span class="ava">${critter(who)}</span>
      <span class="msg-body">
        <span class="msg-head">
          <span class="msg-name">${esc(who.name)} · ${esc(pickleName(m.by))}</span>
          <span class="msg-time">${clock(m.at)}</span>
        </span>
        <span class="msg-text">${esc(m.text)}</span>
      </span>
      ${mine ? `<button type="button" class="msg-del" data-msg-del="${esc(m.key)}" aria-label="내 메모 지우기">✕</button>` : ""}
    </div>`;
  }).join("");
  list.innerHTML = html;
  if (scroll && (nearBottom || list.scrollTop === 0)) list.scrollTop = list.scrollHeight;
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
  const btn = e.target.closest("[data-msg-del]");
  if (!btn) return;
  db.ref("messages/" + btn.dataset.msgDel).remove();
});

/* ─────────────────────────────────────────────
   할 일
   ───────────────────────────────────────────── */
function renderTodos() {
  const list = $("#todo-list");
  const items = Object.keys(state.todos)
    .map((k) => Object.assign({ key: k }, state.todos[k]))
    .sort((a, b) => (a.done === b.done ? (a.at || 0) - (b.at || 0) : (a.done ? 1 : 0) - (b.done ? 1 : 0)));

  $("#todo-empty").hidden = items.length > 0;
  $("#todo-count").textContent = items.filter((t) => !t.done).length + "개 남음";

  list.innerHTML = items.map((t) => {
    const who = memberById(t.by);
    return `<li class="todo ${t.done ? "done" : ""}">
      <button type="button" class="todo-check" data-toggle="${esc(t.key)}" aria-label="완료 표시">${t.done ? "✓" : ""}</button>
      <span class="todo-txt">${esc(t.text)}
        <span class="todo-meta">${esc(who ? who.name : "가족")} · ${esc(ago(t.at))}</span>
      </span>
      <button type="button" class="todo-del" data-todo-del="${esc(t.key)}" aria-label="할 일 삭제">🗑️</button>
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
  const toggle = e.target.closest("[data-toggle]");
  if (toggle) {
    const key = toggle.dataset.toggle;
    const cur = state.todos[key] || {};
    db.ref("todos/" + key).update({ done: !cur.done });
    return;
  }
  const del = e.target.closest("[data-todo-del]");
  if (del) db.ref("todos/" + del.dataset.todoDel).remove();
});

/* ─────────────────────────────────────────────
   탭 · 토스트
   ───────────────────────────────────────────── */
$("#tabbar").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-tab]");
  if (!btn) return;
  state.tab = btn.dataset.tab;
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === state.tab));
  document.querySelectorAll(".view").forEach((v) => (v.hidden = v.id !== "view-" + state.tab));
  if (state.tab === "chat") {
    const list = $("#chat-list");
    list.scrollTop = list.scrollHeight;
  }
  window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
});

let toastTimer = null;
function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 1900);
}

/* ─────────────────────────────────────────────
   시작
   ───────────────────────────────────────────── */
(function boot() {
  paintPin();
  if (localStorage.getItem(LS_PASS) === PIN_HASH) enterApp();
})();
