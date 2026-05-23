// ==========================================
// work_sync.js (통합 동기화 모듈 - 전체 덮어쓰기)
// ==========================================

const WORK_API_BASE = "https://work.sentig335.workers.dev";

// 1. 로컬 변경점(Dirty) 관리 함수들
window.getDirtyMap = function () {
    try { return JSON.parse(localStorage.getItem("wm_dirty_map") || "{}"); } catch (e) { return {}; }
};
window.setDirtyMap = function (map) { localStorage.setItem("wm_dirty_map", JSON.stringify(map || {})); };
window.clearDirtyMap = function () { localStorage.removeItem("wm_dirty_map"); };

window.markDirty = function (colName, id, action) {
    const map = window.getDirtyMap();
    if (!map[colName]) map[colName] = {};
    map[colName][id] = action;
    window.setDirtyMap(map);
    window.scheduleSync();
};

// 2. 서버 통신 (GET / POST)
window.loadFromServer = async function () {
    const res = await fetch(`${WORK_API_BASE}/api/load`, { method: "GET", headers: { "Accept": "application/json" }});
    if (!res.ok) throw new Error("서버 응답 오류");
    return await res.json();
};

window.getServerData = function (serverResult) {
    if (!serverResult) return null;
    return serverResult.saved ? serverResult.saved.data : serverResult.data;
};

// 3. 데이터 적용 및 로컬 저장 함수
window.saveAllLocalOnly = function () {
    localStorage.setItem('wm_logs', JSON.stringify(window.logs || []));
    localStorage.setItem('wm_trash', JSON.stringify(window.trash || []));
    localStorage.setItem('wm_taskTypes', JSON.stringify(window.taskTypes || []));
    localStorage.setItem('wm_coworkers', JSON.stringify(window.coworkers || []));
    localStorage.setItem('wm_statuses', JSON.stringify(window.statuses || []));
    localStorage.setItem('wm_equipments', JSON.stringify(window.equipments || []));
    localStorage.setItem('wm_memoTags', JSON.stringify(window.memoTags || []));
};

window.saveLocal = function () {
    window.saveAllLocalOnly();
    window.markDirty('snapshot', 'save', 'upsert');
};

window.applyServerData = function (serverData) {
    if (!serverData) return;
    window.logs = serverData.logs || [];
    window.trash = serverData.trash || [];
    window.taskTypes = serverData.taskTypes || window.taskTypes;
    window.coworkers = serverData.coworkers || window.coworkers;
    window.statuses = serverData.statuses || window.statuses;
    window.equipments = serverData.equipments || window.equipments;
    window.memoTags = serverData.memoTags || window.memoTags;
    window.saveAllLocalOnly();
    if (window.renderMain) window.renderMain();
};

// 4. 동기화 핵심 로직
window.syncTimer = null;
window.scheduleSync = function () {
    clearTimeout(window.syncTimer);
    window.syncTimer = setTimeout(() => { window.syncNow(); }, 2000);
};

window.syncInProgress = false;
window.syncNow = async function (showError = false) {
    if (window.syncInProgress) return;
    const dirty = window.getDirtyMap();
    const hasDirty = Object.keys(dirty).length > 0;
    window.syncInProgress = true;

    try {
        if (!hasDirty && !showError) {
            window.syncInProgress = false; return;
        }

        const payload = {
            savedAt: new Date().toISOString(),
            app: "work",
            data: {
                logs: window.logs || [], trash: window.trash || [],
                taskTypes: window.taskTypes || [], coworkers: window.coworkers || [],
                statuses: window.statuses || [], equipments: window.equipments || [],
                memoTags: window.memoTags || []
            }
        };

        const res = await fetch(`${WORK_API_BASE}/api/save`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error("서버 저장 실패");
        window.clearDirtyMap();
    } catch (e) {
        console.warn("동기화 실패:", e);
    } finally {
        window.syncInProgress = false;
    }
};

window.forceSync = async function () {
    const mode = confirm("서버 동기화를 진행합니다.\n\n[확인] 현재 내 데이터를 서버로 업로드 (덮어쓰기)\n[취소] 서버에 있는 최신 데이터를 내 폰으로 강제 복원");
    try {
        if (window.showLoading) window.showLoading("서버와 통신 중...");
        if (mode) {
            window.markDirty('snapshot', 'force', 'upsert');
            await window.syncNow(true);
            alert("✅ 서버로 데이터 업로드 완료!");
        } else {
            const serverResult = await window.loadFromServer();
            const serverData = window.getServerData(serverResult);
            if (serverData) {
                window.applyServerData(serverData);
                window.clearDirtyMap();
                alert("✅ 서버 데이터로 강제 복원 완료!");
            } else {
                alert("❌ 서버에 가져올 데이터가 없습니다.");
            }
        }
        if (window.hideLoading) window.hideLoading();
    } catch (e) {
        if (window.hideLoading) window.hideLoading();
        alert("❌ 통신 실패: " + e.message);
    }
};

window.startSync = async function () {
    try {
        const res = await window.loadFromServer();
        const serverData = window.getServerData(res);
        if (serverData) window.applyServerData(serverData);
    } catch(e) {
        console.warn("초기 동기화 확인 실패 (오프라인 상태일 수 있습니다)", e);
    }
};

// 앱이 실행되고 0.5초 뒤에 자동으로 서버 최신본을 한번 당겨옵니다.
setTimeout(() => { window.startSync(); }, 500);