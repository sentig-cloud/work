// work_auth.js
// 구글 로그인 게이트 — 로그인 전에는 #app-container를 숨겨서 앱을 아예 못 쓰게 막고,
// 로그인 후에는 모든 서버 요청에 구글 ID 토큰을 실어 보낸다(실제 첨부는 work_sync.js의
// window.fetchWithTimeout 한 곳에서 처리 — 모든 API 호출이 그 함수를 거쳐가기 때문).
// 서버(worker.js)가 이 토큰을 매번 다시 검증하므로, 여기서 막는 건 UX용이고
// 실제 접근 차단은 서버 쪽에서 이루어진다.

const GOOGLE_CLIENT_ID = "677166432997-u0vd4cmpi2al3utagjhkbmkac547e2h8.apps.googleusercontent.com";

window.wmAuthToken = null;
window.wmAuthEmail = null;

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
    try {
        localStorage.setItem("wm_auth", JSON.stringify({ token, email, exp }));
    } catch {
        // 저장 실패해도 이번 세션 로그인 자체는 유지(새로고침 시 다시 로그인 필요할 뿐)
    }
}

function clearAuth() {
    window.wmAuthToken = null;
    window.wmAuthEmail = null;
    try {
        localStorage.removeItem("wm_auth");
    } catch {
        // 무시
    }
}

// 서명 검증은 서버가 하므로, 여기서는 만료 시각 등을 읽기 위해 페이로드만 그냥 디코딩한다.
function decodeJwtPayload(token) {
    try {
        const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
        const json = decodeURIComponent(
            atob(base64)
                .split("")
                .map(ch => "%" + ch.charCodeAt(0).toString(16).padStart(2, "0"))
                .join("")
        );
        return JSON.parse(json);
    } catch {
        return null;
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

function onCredential(response) {
    const token = response.credential;
    const payload = decodeJwtPayload(token);
    if (!payload || !payload.exp) {
        showGate("로그인 처리 중 오류가 발생했습니다. 다시 시도해주세요.");
        return;
    }
    storeAuth(token, payload.email, payload.exp * 1000);
    hideGate();
    window.dispatchEvent(new CustomEvent("wm-auth-ready"));
}

// 서버가 401을 주면(토큰 만료 등) work_sync.js의 fetchWithTimeout이 이 함수를 호출한다.
window.wmRequireReauth = () => {
    clearAuth();
    showGate("로그인이 만료되었습니다. 다시 로그인해주세요.");
};

function boot() {
    const appEl = document.getElementById("app-container");
    if (appEl) appEl.style.display = "none"; // 로그인 확인 전까지는 항상 숨김 상태로 시작

    const stored = getStoredAuth();
    if (stored) {
        window.wmAuthToken = stored.token;
        window.wmAuthEmail = stored.email;
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
