// work_auth.js
// 구글 로그인 게이트 — 로그인 전에는 #app-container를 숨겨서 앱을 아예 못 쓰게 막는다.
//
// 구글 로그인 자체는 "성공하면 통과"가 아니라, 받은 구글 ID 토큰을 서버(worker.js)
// /api/auth/exchange로 보내서 허용 목록(ALLOWED_EMAILS)에 있는지 먼저 확인한다 — 여기서
// 거부되면 허용 안 된 계정으로는 앱 화면 자체가 안 열린다. 통과하면 서버가 서명한 14일짜리
// 자체 세션 토큰을 대신 받아서 쓰고(구글 ID 토큰은 1시간이라 매시간 재로그인해야 했음),
// 이후 모든 서버 요청에 그 세션 토큰을 실어 보낸다(실제 첨부는 work_sync.js의
// window.fetchWithTimeout 한 곳에서 처리 — 모든 API 호출이 그 함수를 거쳐가기 때문).

// work_sync.js도 같은 이름(WORK_API_BASE)의 최상위 const를 갖고 있는데, 둘 다 일반
// <script> 태그(모듈 아님)라 같은 전역 스코프를 공유한다 — 이름이 겹치면 두 번째로
// 로드되는 스크립트가 "Identifier has already been declared" SyntaxError로 통째로
// 실행이 깨진다(실제로 이 버그로 fetchWithTimeout이 정의되지 않는 문제가 있었음).
const AUTH_API_BASE = "https://work.sentig335.workers.dev";
const GOOGLE_CLIENT_ID = "677166432997-u0vd4cmpi2al3utagjhkbmkac547e2h8.apps.googleusercontent.com";

window.wmAuthToken = null;
window.wmAuthEmail = null;
window.wmAuthExp = null;

function getStoredAuth() {
    try {
        const raw = localStorage.getItem("wm_auth");
        if (!raw) return null;
        const data = JSON.parse(raw);
        if (!data.token || !data.exp || Date.now() >= data.exp) return null;
        return data;
    } catch {
        return null;
    }
}

function storeAuth(token, email, exp) {
    window.wmAuthToken = token;
    window.wmAuthEmail = email;
    window.wmAuthExp = exp;
    try {
        localStorage.setItem("wm_auth", JSON.stringify({ token, email, exp }));
    } catch {
        // 저장 실패해도 이번 세션 로그인 자체는 유지(새로고침 시 다시 로그인 필요할 뿐)
    }
}

function clearAuth() {
    window.wmAuthToken = null;
    window.wmAuthEmail = null;
    window.wmAuthExp = null;
    try {
        localStorage.removeItem("wm_auth");
    } catch {
        // 무시
    }
}

function ensureGateDom() {
    if (document.getElementById("authGate")) return;
    const gate = document.createElement("div");
    gate.id = "authGate";
    gate.className = "auth-gate";
    gate.innerHTML = `
        <div class="auth-gate-box w95-window">
            <div class="w95-titlebar"><span>로그인</span></div>
            <div class="auth-gate-body">
                <div class="auth-gate-title">Work Master</div>
                <div class="auth-gate-sub">구글 계정으로 로그인해주세요</div>
                <div id="googleSignInBtn" class="auth-gate-btn-slot"></div>
                <div id="authGateBusy" class="auth-gate-busy" hidden>확인 중...</div>
                <div id="authGateError" class="auth-gate-error" hidden></div>
            </div>
        </div>
    `;
    document.body.appendChild(gate);
}

function renderGoogleButton() {
    if (typeof google === "undefined" || !google.accounts || !google.accounts.id) {
        // SDK가 아직 로드되기 전이면 잠시 후 다시 시도
        setTimeout(renderGoogleButton, 200);
        return;
    }
    google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: onCredential });
    const btnEl = document.getElementById("googleSignInBtn");
    if (btnEl) {
        btnEl.innerHTML = "";
        google.accounts.id.renderButton(btnEl, { theme: "outline", size: "large", text: "signin_with", width: 240 });
    }
}

function showGate(errorText) {
    ensureGateDom();
    document.getElementById("authGate").style.display = "flex";
    const appEl = document.getElementById("app-container");
    if (appEl) appEl.style.display = "none";
    const errEl = document.getElementById("authGateError");
    if (errorText) {
        errEl.textContent = errorText;
        errEl.hidden = false;
    } else {
        errEl.hidden = true;
    }
    renderGoogleButton();
}

function hideGate() {
    const gate = document.getElementById("authGate");
    if (gate) gate.style.display = "none";
    const appEl = document.getElementById("app-container");
    if (appEl) appEl.style.display = "";
}

function setGateBusy(busy) {
    const busyEl = document.getElementById("authGateBusy");
    if (busyEl) busyEl.hidden = !busy;
}

// 구글 로그인 자체가 성공했다고 바로 통과시키지 않는다 — 받은 구글 ID 토큰을 서버로 보내
// 허용 목록에 있는지 먼저 확인하고, 통과했을 때만 서버가 발급한 세션 토큰으로 들어간다.
async function onCredential(response) {
    setGateBusy(true);
    try {
        const res = await fetch(`${AUTH_API_BASE}/api/auth/exchange`, {
            method: "POST",
            headers: { Authorization: `Bearer ${response.credential}` }
        });
        const text = await res.text();
        const result = text ? JSON.parse(text) : {};
        if (!res.ok || !result.ok) {
            showGate(result.error || "로그인이 거부되었습니다. 허용된 계정인지 확인해주세요.");
            return;
        }
        storeAuth(result.sessionToken, result.email, result.exp);
        hideGate();
        window.dispatchEvent(new CustomEvent("wm-auth-ready"));
    } catch (e) {
        showGate("로그인 확인 중 네트워크 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
        setGateBusy(false);
    }
}

// 서버가 401을 주면(토큰 만료 등) work_sync.js의 fetchWithTimeout이 이 함수를 호출한다.
window.wmRequireReauth = () => {
    clearAuth();
    showGate("로그인이 만료되었습니다. 다시 로그인해주세요.");
};

// 로그아웃 / 계정 전환(설정 > 계정) — 둘 다 현재 세션을 지우고 로그인 화면을 다시 띄운다.
// "계정 전환"은 구글 로그인 버튼이 항상 계정 선택 UI를 띄우므로 별도 처리 없이도 다른
// 계정을 고를 수 있다 — disableAutoSelect로 자동 재선택만 꺼서 확실히 선택창이 뜨게 한다.
window.wmLogout = (switchAccount = false) => {
    clearAuth();
    try { google?.accounts?.id?.disableAutoSelect(); } catch { /* SDK 미로딩 시 무시 */ }
    showGate(switchAccount ? "다른 계정으로 로그인해주세요." : null);
};

// ─── 접속 기록 (설정 > 계정 > 접속 기록 보기) ───
// "설정한 적 없는 계정이 로그인됐다" 같은 문제를 실제로 어떤 이메일이 언제 시도했는지
// 눈으로 확인할 수 있게, 서버(worker.js)가 남긴 허용/거부 기록을 그대로 보여준다.
function ensureAccessLogModalDom() {
    if (document.getElementById("accessLogModal")) return;
    const modal = document.createElement("div");
    modal.id = "accessLogModal";
    modal.className = "modal-overlay";
    modal.style.display = "none";
    // 설정 창(ttSettingsModal)이 z-index:2650으로 떠 있는 상태에서 열리므로, 그 위에
    // 오도록 더 높은 z-index를 명시해야 한다(기본 .modal-overlay는 2000이라 가려짐).
    modal.style.zIndex = "2700";
    modal.innerHTML = `
        <div class="modal-box w95-window" style="max-width:360px;">
            <div class="w95-titlebar"><span>접속 기록</span><button type="button" class="w95-btn" id="accessLogCloseBtn">X</button></div>
            <div id="accessLogCurrent" class="access-log-current"></div>
            <div class="access-log-actions">
                <button type="button" class="w95-btn" id="accessLogExportBtn">내보내기</button>
                <button type="button" class="w95-btn" id="accessLogClearBtn">기록 삭제</button>
            </div>
            <div id="accessLogBody" class="access-log-body"></div>
        </div>
    `;
    document.body.appendChild(modal);
    document.getElementById("accessLogCloseBtn").addEventListener("click", () => {
        modal.style.display = "none";
    });
    modal.addEventListener("click", (e) => {
        if (e.target === modal) modal.style.display = "none";
    });
    document.getElementById("accessLogExportBtn").addEventListener("click", exportAccessLog);
    document.getElementById("accessLogClearBtn").addEventListener("click", clearAccessLog);
}

function formatAccessLogTime(iso) {
    try {
        const d = new Date(iso);
        const pad = (n) => String(n).padStart(2, "0");
        return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch {
        return iso || "";
    }
}

let lastAccessLogEntries = [];

function renderAccessLogCurrent() {
    const el = document.getElementById("accessLogCurrent");
    if (!el) return;
    if (!window.wmAuthEmail) { el.textContent = ""; return; }
    const expText = window.wmAuthExp ? `만료: ${formatAccessLogTime(new Date(window.wmAuthExp).toISOString())}` : "";
    el.textContent = `현재 접속 중: ${window.wmAuthEmail}${expText ? " (" + expText + ")" : ""}`;
}

window.showAccessLog = async function () {
    ensureAccessLogModalDom();
    const modal = document.getElementById("accessLogModal");
    const body = document.getElementById("accessLogBody");
    modal.style.display = "flex";
    renderAccessLogCurrent();
    body.innerHTML = `<div class="access-log-status">불러오는 중...</div>`;
    try {
        const res = await window.fetchWithTimeout(`${AUTH_API_BASE}/api/auth/log`, { method: "GET" }, 15000);
        const text = await res.text();
        const result = text ? JSON.parse(text) : {};
        if (!res.ok || !result.ok) {
            body.innerHTML = `<div class="access-log-status">기록을 불러오지 못했습니다: ${result.error || res.status}</div>`;
            return;
        }
        lastAccessLogEntries = result.entries || [];
        if (lastAccessLogEntries.length === 0) {
            body.innerHTML = `<div class="access-log-status">기록이 없습니다.</div>`;
            return;
        }
        body.innerHTML = lastAccessLogEntries.map(e => `
            <div class="access-log-row ${e.result === "denied" ? "access-log-denied" : ""}">
                <span class="access-log-email">${e.email || "-"}</span>
                <span class="access-log-badge">${e.result === "denied" ? "거부됨" : "허용됨"}</span>
                <span class="access-log-time">${formatAccessLogTime(e.at)}</span>
            </div>
        `).join("");
    } catch (e) {
        body.innerHTML = `<div class="access-log-status">기록을 불러오지 못했습니다: ${e.message}</div>`;
    }
};

// 지금까지 불러온 접속 기록을 CSV로 내보낸다(순수 클라이언트 동작, 서버 호출 없음).
function exportAccessLog() {
    if (lastAccessLogEntries.length === 0) {
        alert("내보낼 기록이 없습니다.");
        return;
    }
    const rows = [["이메일", "결과", "시각"]];
    for (const e of lastAccessLogEntries) {
        rows.push([e.email || "", e.result === "denied" ? "거부됨" : "허용됨", e.at || ""]);
    }
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `access_log_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

async function clearAccessLog() {
    if (!confirm("접속 기록을 전부 삭제할까요? 되돌릴 수 없습니다.")) return;
    try {
        const res = await window.fetchWithTimeout(`${AUTH_API_BASE}/api/auth/log`, { method: "DELETE" }, 15000);
        const text = await res.text();
        const result = text ? JSON.parse(text) : {};
        if (!res.ok || !result.ok) {
            alert("삭제 실패: " + (result.error || res.status));
            return;
        }
        lastAccessLogEntries = [];
        window.showAccessLog();
    } catch (e) {
        alert("삭제 실패: " + e.message);
    }
}

function boot() {
    const appEl = document.getElementById("app-container");
    if (appEl) appEl.style.display = "none"; // 로그인 확인 전까지는 항상 숨김 상태로 시작

    const stored = getStoredAuth();
    if (stored) {
        window.wmAuthToken = stored.token;
        window.wmAuthEmail = stored.email;
        window.wmAuthExp = stored.exp;
        hideGate();
        window.dispatchEvent(new CustomEvent("wm-auth-ready"));
    } else {
        showGate();
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
} else {
    boot();
}
