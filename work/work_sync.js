// work_sync.js
// Cloudflare Worker/KV 동기화 전용
// 1초 디바운싱 + 변경 추적 + 병합 저장

const WORK_API_BASE = "https://work.sentig335.workers.dev";

window.syncTimer = null;
window.syncInProgress = false;
window.pendingSyncAfterCurrent = false;
window.isApplyingServerData = false;

window.getSyncStamp = function () {
    return localStorage.getItem("wm_sync_updated_at") || "1970-01-01T00:00:00.000Z";
};

window.setSyncStamp = function (stamp = null) {
    const nextStamp = stamp || new Date().toISOString();
    localStorage.setItem("wm_sync_updated_at", nextStamp);
    return nextStamp;
};

window.getDirtyMap = function () {
    try {
        return JSON.parse(localStorage.getItem("wm_dirty_map") || "{}");
    } catch (e) {
        return {};
    }
};

window.setDirtyMap = function (map) {
    localStorage.setItem("wm_dirty_map", JSON.stringify(map || {}));
};

window.clearDirtyMap = function () {
    localStorage.removeItem("wm_dirty_map");
};

window.markDirty = function (colName, id = "_all", action = "upsert") {
    if (window.isApplyingServerData) return;

    const dirty = window.getDirtyMap();

    if (!dirty[colName]) dirty[colName] = {};

    dirty[colName][String(id)] = {
        id: String(id),
        action,
        changedAt: new Date().toISOString()
    };

    window.setDirtyMap(dirty);
};

window.saveArrayToLocal = function (key, arr) {
    localStorage.setItem(`wm_${key}`, JSON.stringify((arr || []).filter(Boolean)));
};

window.saveAllLocalOnly = function () {
    window.logs = (window.logs || []).filter(Boolean);
    window.trash = (window.trash || []).filter(Boolean);
    window.taskTypes = (window.taskTypes || []).filter(Boolean);
    window.coworkers = (window.coworkers || []).filter(Boolean);
    window.statuses = (window.statuses || []).filter(Boolean);
    window.equipments = (window.equipments || []).filter(Boolean);
    window.memoTags = (window.memoTags || []).filter(Boolean);

    window.saveArrayToLocal("logs", window.logs);
    window.saveArrayToLocal("trash", window.trash);
    window.saveArrayToLocal("taskTypes", window.taskTypes);
    window.saveArrayToLocal("coworkers", window.coworkers);
    window.saveArrayToLocal("statuses", window.statuses);
    window.saveArrayToLocal("equipments", window.equipments);
    window.saveArrayToLocal("memoTags", window.memoTags);
};

window.refreshCurrentUI = function () {
    if (window.renderMain) window.renderMain();

    const popupLayer = document.getElementById("popupLayer");
    const isPopupOpen = popupLayer && popupLayer.style.display === "flex";

    if (isPopupOpen) {
        if (window.renderCal) window.renderCal(window.currentYear, window.curMonth - 1);
        if (window.updateUI) window.updateUI();
    }

    if (document.getElementById("searchLayer")?.style.display === "flex" && window.doSearch) {
        window.doSearch();
    }

    if (document.getElementById("trashLayer")?.style.display === "flex" && window.renderTrash) {
        window.renderTrash();
    }
};

window.getServerData = function (serverResult) {
    if (serverResult?.saved?.data) return serverResult.saved.data;
    if (serverResult?.data) return serverResult.data;
    return null;
};

window.getServerStamp = function (serverResult) {
    return (
        serverResult?.saved?.syncUpdatedAt ||
        serverResult?.syncUpdatedAt ||
        serverResult?.savedAt ||
        "1970-01-01T00:00:00.000Z"
    );
};

window.touchUpdatedAt = function (item) {
    if (item && typeof item === "object") {
        item.updatedAt = new Date().toISOString();
    }
    return item;
};

window.mergeById = function (localArr, serverArr) {
    const map = new Map();

    (serverArr || []).filter(Boolean).forEach(item => {
        if (!item.id) item.id = `${Date.now()}_${Math.random()}`;
        map.set(String(item.id), item);
    });

    (localArr || []).filter(Boolean).forEach(item => {
        if (!item.id) item.id = `${Date.now()}_${Math.random()}`;

        const id = String(item.id);
        const old = map.get(id);

        if (!old) {
            map.set(id, item);
            return;
        }

        const localTime = item.updatedAt || item.savedAt || "";
        const serverTime = old.updatedAt || old.savedAt || "";

        map.set(id, localTime >= serverTime ? item : old);
    });

    return Array.from(map.values()).filter(Boolean);
};

window.mergeMasterByName = function (localArr, serverArr) {
    const map = new Map();

    (serverArr || []).filter(Boolean).forEach(item => {
        if (item.name) map.set(item.name, item);
    });

    (localArr || []).filter(Boolean).forEach(item => {
        if (item.name) map.set(item.name, item);
    });

    return Array.from(map.values()).filter(Boolean);
};

window.applyServerData = function (data, merge = false) {
    if (!data || !Array.isArray(data.logs)) return false;

    window.isApplyingServerData = true;

    if (merge) {
        window.logs = window.mergeById(window.logs || [], data.logs || []);
        window.trash = window.mergeById(window.trash || [], data.trash || []);
        window.taskTypes = window.mergeMasterByName(window.taskTypes || [], data.taskTypes || []);
        window.coworkers = window.mergeMasterByName(window.coworkers || [], data.coworkers || []);
        window.statuses = window.mergeMasterByName(window.statuses || [], data.statuses || []);
        window.equipments = window.mergeMasterByName(window.equipments || [], data.equipments || []);
        window.memoTags = window.mergeMasterByName(window.memoTags || [], data.memoTags || []);
    } else {
        window.logs = (data.logs || []).filter(Boolean);
        window.trash = (data.trash || []).filter(Boolean);
        window.taskTypes = (data.taskTypes || []).filter(Boolean);
        window.coworkers = (data.coworkers || []).filter(Boolean);
        window.statuses = (data.statuses || []).filter(Boolean);
        window.equipments = (data.equipments || []).filter(Boolean);
        window.memoTags = (data.memoTags || []).filter(Boolean);
    }

    window.saveAllLocalOnly();

    window.isApplyingServerData = false;
    window.isInitialLoad = false;

    if (window.refreshCurrentUI) window.refreshCurrentUI();

    return true;
};

window.loadFromServer = async function () {
    const res = await fetch(`${WORK_API_BASE}/api/load`, {
        method: "GET",
        headers: { "Accept": "application/json" }
    });

    const text = await res.text();

    if (!res.ok) {
        throw new Error(`서버 불러오기 실패: ${res.status} / ${text}`);
    }

    return text ? JSON.parse(text) : {};
};

window.startSync = async function () {
    try {
        window.logs = window.logs || [];
        window.trash = window.trash || [];

        const result = await window.loadFromServer();
        const serverData = window.getServerData(result);
        const serverStamp = window.getServerStamp(result);

        const hasLocalData =
            (window.logs && window.logs.length > 0) ||
            (window.trash && window.trash.length > 0);

        if (serverData) {
            window.applyServerData(serverData, hasLocalData);
            window.setSyncStamp(serverStamp);
        } else {
            window.isInitialLoad = false;
            window.saveAllLocalOnly();
            if (window.renderMain) window.renderMain();
        }

        if (hasLocalData) {
            window.scheduleSync();
        }

        console.log("✅ 시작 동기화 완료", result);
    } catch (e) {
        console.warn("서버 불러오기 실패, 로컬로 실행:", e);
        window.isInitialLoad = false;
        if (window.renderMain) window.renderMain();
    }
};

window.scheduleSync = function () {
    if (window.isApplyingServerData) return;

    clearTimeout(window.syncTimer);

    window.syncTimer = setTimeout(() => {
        window.syncNow(false);
    }, 1000);
};

window.syncNow = async function (showError = false) {
    if (window.syncInProgress) {
        window.pendingSyncAfterCurrent = true;
        return null;
    }

    const dirty = window.getDirtyMap();
    const hasDirty = Object.keys(dirty).length > 0;

    if (!hasDirty && !showError) return null;

    window.syncInProgress = true;

    try {
        let serverResult = null;
        let serverData = null;

        try {
            serverResult = await window.loadFromServer();
            serverData = window.getServerData(serverResult);
        } catch (e) {
            console.warn("서버 병합용 불러오기 실패, 현재 로컬 기준 저장:", e);
        }

        if (serverData) {
            window.applyServerData(serverData, true);
        }

        const stamp = window.setSyncStamp();

        const payload = {
            savedAt: stamp,
            syncUpdatedAt: stamp,
            app: "work",
            dirty,
            data: {
                logs: window.logs || [],
                trash: window.trash || [],
                taskTypes: window.taskTypes || [],
                coworkers: window.coworkers || [],
                statuses: window.statuses || [],
                equipments: window.equipments || [],
                memoTags: window.memoTags || []
            }
        };

        const res = await fetch(`${WORK_API_BASE}/api/save`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify(payload)
        });

        const text = await res.text();

        if (!res.ok) {
            throw new Error(`서버 저장 실패: ${res.status} / ${text}`);
        }

        const result = text ? JSON.parse(text) : {};

        window.clearDirtyMap();
        console.log("✅ 자동 동기화 완료", result);

        return result;
    } catch (e) {
        console.warn("서버 저장 실패, 로컬 저장 유지:", e);
        if (showError) throw e;
        return null;
    } finally {
        window.syncInProgress = false;

        if (window.pendingSyncAfterCurrent) {
            window.pendingSyncAfterCurrent = false;
            window.scheduleSync();
        }
    }
};

window.saveToServer = async function (showError = false) {
    return await window.syncNow(showError);
};

window.saveLocal = function (dirtyKey = "_all") {
    if (!window.logs) window.logs = [];
    if (!window.trash) window.trash = [];

    window.saveAllLocalOnly();

    if (!window.isApplyingServerData) {
        window.markDirty("snapshot", dirtyKey, "save");
        window.scheduleSync();
    }

    if (window.refreshCurrentUI) window.refreshCurrentUI();
};

window.saveToLocalStore = function (colName, data) {
    if (!window.logs) window.logs = [];
    if (!window.trash) window.trash = [];

    data = window.touchUpdatedAt(data);

    if (colName === "logs") {
        const idx = window.logs.findIndex(l => String(l.id) === String(data.id));
        if (idx >= 0) window.logs[idx] = data;
        else window.logs.push(data);
    }

    if (colName === "trash") {
        const idx = window.trash.findIndex(l => String(l.id) === String(data.id));
        if (idx >= 0) window.trash[idx] = data;
        else window.trash.push(data);
    }

    window.markDirty(colName, data.id, "upsert");
    window.saveLocal(`${colName}:${data.id}`);
};

window.deleteFromLocalStore = function (colName, id) {
    if (colName === "logs") {
        window.logs = (window.logs || []).filter(l => String(l.id) !== String(id));
    }

    if (colName === "trash") {
        window.trash = (window.trash || []).filter(l => String(l.id) !== String(id));
    }

    window.markDirty(colName, id, "delete");
    window.saveLocal(`${colName}:${id}:delete`);
};

window.forceSync = async function () {
    try {
        if (window.showLoading) window.showLoading("서버 동기화 중...");
        await window.syncNow(true);
        if (window.hideLoading) window.hideLoading();
        alert("✅ 서버 동기화 완료!");
    } catch (e) {
        if (window.hideLoading) window.hideLoading();
        alert("❌ 서버 동기화 실패: " + e.message);
    }
};

setTimeout(() => {
    if (window.startSync) window.startSync();
}, 500);