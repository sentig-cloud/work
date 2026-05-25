// work_sync.js
// Work Master - Cloudflare Worker / KV / R2 sync

const WORK_API_BASE = "https://work.sentig335.workers.dev";

window.syncTimer = null;
window.syncInProgress = false;
window.pendingSyncAfterCurrent = false;
window.isApplyingServerData = false;

window.fetchWithTimeout = async function (url, options = {}, timeoutMs = 15000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        return await fetch(url, {
            ...options,
            signal: controller.signal
        });
    } catch (e) {
        if (e.name === "AbortError") {
            throw new Error(`서버 응답 시간 초과: ${timeoutMs / 1000}초`);
        }

        throw e;
    } finally {
        clearTimeout(timer);
    }
};

window.getSyncStamp = function () {
    return localStorage.getItem("wm_sync_updated_at") || "1970-01-01T00:00:00.000Z";
};

window.setSyncStamp = function (stamp = null) {
    const value = stamp || new Date().toISOString();
    localStorage.setItem("wm_sync_updated_at", value);
    return value;
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

    if (!dirty[colName]) {
        dirty[colName] = {};
    }

    dirty[colName][String(id)] = {
        id: String(id),
        action,
        changedAt: new Date().toISOString()
    };

    window.setDirtyMap(dirty);
};

window.saveArrayToLocal = function (key, arr) {
    localStorage.setItem(
        `wm_${key}`,
        JSON.stringify((arr || []).filter(Boolean))
    );
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
    if (window.renderMain) {
        window.renderMain();
    }

    const popupLayer = document.getElementById("popupLayer");
    const isPopupOpen = popupLayer && popupLayer.style.display === "flex";

    if (isPopupOpen) {
        if (window.renderCal) {
            window.renderCal(window.currentYear, window.curMonth - 1);
        }

        if (window.updateUI) {
            window.updateUI();
        }
    }

    const searchLayer = document.getElementById("searchLayer");
    if (searchLayer && searchLayer.style.display === "flex" && window.doSearch) {
        window.doSearch();
    }

    const trashLayer = document.getElementById("trashLayer");
    if (trashLayer && trashLayer.style.display === "flex" && window.renderTrash) {
        window.renderTrash();
    }
};

window.getServerData = function (serverResult) {
    if (serverResult && serverResult.saved && serverResult.saved.data) {
        return serverResult.saved.data;
    }

    if (serverResult && serverResult.data) {
        return serverResult.data;
    }

    return null;
};

window.getServerStamp = function (serverResult) {
    if (serverResult && serverResult.saved && serverResult.saved.syncUpdatedAt) {
        return serverResult.saved.syncUpdatedAt;
    }

    if (serverResult && serverResult.syncUpdatedAt) {
        return serverResult.syncUpdatedAt;
    }

    if (serverResult && serverResult.savedAt) {
        return serverResult.savedAt;
    }

    return "1970-01-01T00:00:00.000Z";
};

window.touchUpdatedAt = function (item) {
    if (item && typeof item === "object") {
        item.updatedAt = new Date().toISOString();
    }

    return item;
};

window.applyServerData = function (data) {
    if (!data || !Array.isArray(data.logs)) {
        return false;
    }

    window.isApplyingServerData = true;

    try {
        window.logs = (data.logs || []).filter(Boolean);
        window.trash = (data.trash || []).filter(Boolean);
        window.taskTypes = (data.taskTypes || []).filter(Boolean);
        window.coworkers = (data.coworkers || []).filter(Boolean);
        window.statuses = (data.statuses || []).filter(Boolean);
        window.equipments = (data.equipments || []).filter(Boolean);
        window.memoTags = (data.memoTags || []).filter(Boolean);

        window.saveAllLocalOnly();
    } finally {
        window.isApplyingServerData = false;
        window.isInitialLoad = false;
    }

    window.refreshCurrentUI();
    return true;
};

window.loadFromServer = async function () {
    const response = await window.fetchWithTimeout(
        `${WORK_API_BASE}/api/load`,
        {
            method: "GET",
            headers: {
                "Accept": "application/json"
            }
        },
        15000
    );

    const text = await response.text();

    if (!response.ok) {
        throw new Error(`서버 불러오기 실패: ${response.status} / ${text}`);
    }

    return text ? JSON.parse(text) : {};
};

window.isInlineImageSrc = function (src) {
    return typeof src === "string" && src.startsWith("data:image/");
};

window.dataUrlToBlob = function (dataUrl) {
    const parts = String(dataUrl || "").split(",");
    const header = parts[0] || "";
    const base64 = parts[1] || "";
    const match = header.match(/^data:(image\/[^;]+);base64$/i);

    if (!match || !base64) {
        throw new Error("지원하지 않는 이미지 데이터입니다.");
    }

    const mimeType = match[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }

    return new Blob([bytes], {
        type: mimeType
    });
};

window.uploadToStorage = async function (dataUrl) {
    if (!window.isInlineImageSrc(dataUrl)) {
        return dataUrl;
    }

    const blob = window.dataUrlToBlob(dataUrl);

    const response = await window.fetchWithTimeout(
        `${WORK_API_BASE}/api/upload`,
        {
            method: "POST",
            headers: {
                "Content-Type": blob.type || "application/octet-stream"
            },
            body: blob
        },
        60000
    );

    const text = await response.text();

    if (!response.ok) {
        throw new Error(`사진 R2 업로드 실패: ${response.status} / ${text}`);
    }

    const result = text ? JSON.parse(text) : {};

    if (!result.ok || !result.url) {
        throw new Error("사진 업로드 결과에 URL이 없습니다.");
    }

    return result.url;
};

window.migrateInlineImagesToR2 = async function () {
    const uploadedBySource = new Map();
    const collections = [
        window.logs || [],
        window.trash || []
    ];

    let changed = false;
    let uploadedCount = 0;

    for (const collection of collections) {
        for (const log of collection) {
            if (!log || !Array.isArray(log.imgs)) {
                continue;
            }

            for (const image of log.imgs) {
                if (!image || !window.isInlineImageSrc(image.src)) {
                    continue;
                }

                const originalSrc = image.src;
                let uploadedUrl = uploadedBySource.get(originalSrc);

                if (!uploadedUrl) {
                    uploadedUrl = await window.uploadToStorage(originalSrc);
                    uploadedBySource.set(originalSrc, uploadedUrl);
                    uploadedCount++;
                }

                image.src = uploadedUrl;
                image.updatedAt = new Date().toISOString();
                log.updatedAt = new Date().toISOString();
                changed = true;
            }
        }
    }

    if (changed) {
        window.saveAllLocalOnly();
    }

    return {
        changed,
        uploadedCount
    };
};

window.startSync = async function () {
    try {
        window.logs = window.logs || [];
        window.trash = window.trash || [];

        const dirty = window.getDirtyMap();
        const hasDirty = Object.keys(dirty).length > 0;

        if (hasDirty) {
            window.isInitialLoad = false;

            if (window.renderMain) {
                window.renderMain();
            }

            console.log("로컬 변경사항이 있어 서버 저장을 먼저 시도합니다.");

            try {
                await window.syncNow(true);
            } catch (e) {
                console.warn("초기 로컬 변경사항 저장 실패:", e);
            }

            return;
        }

        const result = await window.loadFromServer();
        const serverData = window.getServerData(result);
        const serverStamp = window.getServerStamp(result);

        if (serverData) {
            window.applyServerData(serverData);
            window.setSyncStamp(serverStamp);
            console.log("서버 데이터 불러오기 완료", serverStamp);
        } else {
            window.isInitialLoad = false;

            try {
                window.saveAllLocalOnly();
            } catch (e) {
                console.warn("초기 로컬 저장 실패:", e);
            }

            if (window.renderMain) {
                window.renderMain();
            }
        }
    } catch (e) {
        console.warn("서버 불러오기 실패, 로컬 데이터로 실행합니다.", e);
        window.isInitialLoad = false;

        if (window.renderMain) {
            window.renderMain();
        }
    }
};

window.isSyncApplyBlocked = function () {
    const blockingLayerIds = [
        "workModal",
        "editModal",
        "commuteModal",
        "titleEditModal",
        "tagEditModal"
    ];

    const hasOpenModal = blockingLayerIds.some((id) => {
        const element = document.getElementById(id);
        return element && element.style.display === "flex";
    });

    if (hasOpenModal) {
        return true;
    }

    const active = document.activeElement;

    if (
        active &&
        ["INPUT", "TEXTAREA", "SELECT"].includes(active.tagName)
    ) {
        return true;
    }

    return false;
};

window.syncFromServerIfSafe = async function (reason = "manual") {
    if (window.syncInProgress || window.isApplyingServerData) {
        return false;
    }

    const dirty = window.getDirtyMap();

    if (Object.keys(dirty).length > 0) {
        console.log("서버 불러오기 건너뜀: 저장하지 않은 로컬 변경사항 있음", reason);
        return false;
    }

    if (window.isSyncApplyBlocked()) {
        console.log("서버 불러오기 건너뜀: 현재 편집 중", reason);
        return false;
    }

    try {
        const result = await window.loadFromServer();
        const serverData = window.getServerData(result);
        const serverStamp = window.getServerStamp(result);
        const localStamp = window.getSyncStamp();

        if (!serverData) {
            return false;
        }

        if (serverStamp && serverStamp <= localStamp) {
            console.log("서버 데이터가 이미 반영된 상태입니다.", reason);
            return false;
        }

        window.applyServerData(serverData);
        window.setSyncStamp(serverStamp);

        console.log("서버 최신 데이터 적용 완료", reason, serverStamp);
        return true;
    } catch (e) {
        console.warn("서버 최신 데이터 확인 실패:", reason, e);
        return false;
    }
};

window.syncNow = async function (showError = false) {
    if (window.syncInProgress) {
        window.pendingSyncAfterCurrent = true;
        return null;
    }

    const dirty = window.getDirtyMap();
    const hasDirty = Object.keys(dirty).length > 0;

    if (!hasDirty && !showError) {
        return null;
    }

    window.syncInProgress = true;

    try {
        const migration = await window.migrateInlineImagesToR2();
        const stamp = new Date().toISOString();

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

        const body = JSON.stringify(payload);
        const bodyBytes = new Blob([body]).size;
        const bodyMb = bodyBytes / 1024 / 1024;
        const safeLimitBytes = 24 * 1024 * 1024;

        if (bodyBytes > safeLimitBytes) {
            throw new Error(
                `사진 분리 후에도 저장 데이터가 ${bodyMb.toFixed(2)}MB입니다. ` +
                "기록 데이터 자체를 추가로 나누어야 합니다."
            );
        }

        const response = await window.fetchWithTimeout(
            `${WORK_API_BASE}/api/save`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body
            },
            30000
        );

        const text = await response.text();

        if (!response.ok) {
            throw new Error(`서버 저장 실패: ${response.status} / ${text}`);
        }

        const result = text ? JSON.parse(text) : {};

        window.setSyncStamp(stamp);
        window.clearDirtyMap();

        console.log("자동 동기화 완료", {
            result,
            sizeMb: bodyMb.toFixed(2),
            uploadedImages: migration.uploadedCount
        });

        return result;
    } catch (e) {
        console.warn("서버 저장 실패, 로컬 변경사항 유지:", e);

        if (showError) {
            throw e;
        }

        return null;
    } finally {
        window.syncInProgress = false;

        if (window.pendingSyncAfterCurrent) {
            window.pendingSyncAfterCurrent = false;
            window.scheduleSync();
        }
    }
};

window.scheduleSync = function () {
    if (window.isApplyingServerData) {
        return;
    }

    clearTimeout(window.syncTimer);

    window.syncTimer = setTimeout(() => {
        window.syncNow(false);
    }, 1000);
};

window.saveToServer = async function (showError = false) {
    return await window.syncNow(showError);
};

window.saveLocal = function (dirtyKey = "_all", options = {}) {
    if (!window.logs) {
        window.logs = [];
    }

    if (!window.trash) {
        window.trash = [];
    }

    try {
        window.saveAllLocalOnly();
    } catch (e) {
        console.warn("사진 이전 전 로컬 저장 용량 부족 가능성:", e);
    }

    if (!window.isApplyingServerData) {
        const keyText = String(dirtyKey || "_all");
        const alreadyTracked = keyText.includes(":") || options.skipSnapshotDirty;

        // 개별 카드(logs:id) 변경은 이미 markDirty('logs', id)로 추적한다.
        // 전체 마스터 배열/설정 변경처럼 대상이 애매할 때만 snapshot dirty를 남긴다.
        if (!alreadyTracked) {
            window.markDirty("snapshot", keyText, "save");
        }

        window.scheduleSync();
    }

    window.refreshCurrentUI();
};

window.saveToLocalStore = function (colName, data) {
    if (!window.logs) {
        window.logs = [];
    }

    if (!window.trash) {
        window.trash = [];
    }

    data = window.touchUpdatedAt(data);

    if (colName === "logs") {
        const index = window.logs.findIndex(
            (item) => String(item.id) === String(data.id)
        );

        if (index >= 0) {
            window.logs[index] = data;
        } else {
            window.logs.push(data);
        }
    }

    if (colName === "trash") {
        const index = window.trash.findIndex(
            (item) => String(item.id) === String(data.id)
        );

        if (index >= 0) {
            window.trash[index] = data;
        } else {
            window.trash.push(data);
        }
    }

    window.markDirty(colName, data.id, "upsert");
    window.saveLocal(`${colName}:${data.id}`, { skipSnapshotDirty: true });
};

window.deleteFromLocalStore = function (colName, id) {
    if (colName === "logs") {
        window.logs = (window.logs || []).filter(
            (item) => String(item.id) !== String(id)
        );
    }

    if (colName === "trash") {
        window.trash = (window.trash || []).filter(
            (item) => String(item.id) !== String(id)
        );
    }

    window.markDirty(colName, id, "delete");
    window.saveLocal(`${colName}:${id}:delete`, { skipSnapshotDirty: true });
};

window.forceSync = async function () {
    try {
        if (window.showLoading) {
            window.showLoading("서버 동기화 중...");
        }

        const dirty = window.getDirtyMap();
        const hasDirty = Object.keys(dirty).length > 0;

        if (hasDirty) {
            await window.syncNow(true);
            alert("변경사항을 서버에 저장했습니다.");
        } else {
            const loaded = await window.syncFromServerIfSafe("force");

            if (loaded) {
                alert("서버 최신 데이터를 불러왔습니다.");
            } else {
                alert("이미 최신 상태입니다.");
            }
        }
    } catch (e) {
        alert("서버 동기화 실패: " + e.message);
    } finally {
        if (window.hideLoading) {
            window.hideLoading();
        }
    }
};

window.startAutoPullSync = function () {
    if (window.autoPullSyncTimer) {
        clearInterval(window.autoPullSyncTimer);
    }

    window.autoPullSyncTimer = setInterval(() => {
        window.syncFromServerIfSafe("auto-pull");
    }, 20000);

    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) {
            window.syncFromServerIfSafe("visible");
        }
    });

    window.addEventListener("online", () => {
        if (Object.keys(window.getDirtyMap()).length > 0) {
            window.scheduleSync();
        } else {
            window.syncFromServerIfSafe("online");
        }
    });

    window.addEventListener("storage", (event) => {
        if (event.key && event.key.startsWith("wm_") && !window.isApplyingServerData) {
            window.logs = (window.safeParseLocal ? window.safeParseLocal("wm_logs", []) : window.logs) || [];
            window.trash = (window.safeParseLocal ? window.safeParseLocal("wm_trash", []) : window.trash) || [];
            window.refreshCurrentUI();
        }
    });
};

setTimeout(() => {
    if (window.startSync) {
        window.startSync().finally(() => {
            if (window.startAutoPullSync) window.startAutoPullSync();
        });
    }
}, 500);