// work_sync.js
// Work Master - partial automatic sync with Cloudflare KV / R2 (v2)

const WORK_API_BASE = "https://work.sentig335.workers.dev";
const WORK_SYNC_PUSH_DELAY = 1500;
const WORK_SYNC_PULL_COOLDOWN = 15000;
const WORK_CALENDAR_PULL_INTERVAL = 60000;

window.syncTimer = null;
window.syncInProgress = false;
window.pendingSyncAfterCurrent = false;
window.isApplyingServerData = false;
window.autoPullSyncTimer = null;
window.lastRemoteCheckAt = 0;

window.fetchWithTimeout = async function (url, options = {}, timeoutMs = 15000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } catch (e) {
        if (e.name === "AbortError") throw new Error(`서버 응답 시간 초과: ${timeoutMs / 1000}초`);
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

window.hasDirtyChanges = function () {
    return Object.keys(window.getDirtyMap()).length > 0;
};

window.markDirty = function (collection, id = "_all", action = "upsert") {
    if (window.isApplyingServerData) return;
    const dirty = window.getDirtyMap();
    if (!dirty[collection]) dirty[collection] = {};
    dirty[collection][String(id)] = {
        id: String(id),
        action,
        changedAt: new Date().toISOString()
    };
    window.setDirtyMap(dirty);
};

// ─── 로컬 저장 (v2: groups 통합) ───
window.saveArrayToLocal = function (key, array) {
    localStorage.setItem(`wm_${key}`, JSON.stringify((array || []).filter(Boolean)));
};

window.saveAllLocalOnly = function () {
    window.logs = (window.logs || []).filter(Boolean);
    window.trash = (window.trash || []).filter(Boolean);
    window.groups = (window.groups || []).filter(Boolean);

    // 사용자 정의 선택상자 정의를 먼저 기록한다. 사진이 많은 로그 저장 중 용량 오류가 나더라도
    // 새 그룹 정의가 통째로 유실되는 문제를 막는다.
    localStorage.setItem("wm_groups", JSON.stringify(window.groups));
    window.saveArrayToLocal("logs", window.logs);
    window.saveArrayToLocal("trash", window.trash);

    // v1 하위 호환 키도 업데이트 (구 코드 참조 대비)
    window.saveArrayToLocal("taskTypes", window.taskTypes);
    window.saveArrayToLocal("coworkers", window.coworkers);
    window.saveArrayToLocal("statuses", window.statuses);
    window.saveArrayToLocal("equipments", window.equipments);
    window.saveArrayToLocal("memoTags", window.memoTags);
};

window.refreshCurrentUI = function () {
    if (window.renderMain) window.renderMain();

    const popupLayer = document.getElementById("popupLayer");
    if (popupLayer && popupLayer.style.display === "flex") {
        if (window.renderCal) window.renderCal(window.currentYear, window.curMonth - 1);
        if (window.updateUI) window.updateUI();
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

window.getServerData = function (result) {
    if (result && result.saved && result.saved.data) return result.saved.data;
    if (result && result.data) return result.data;
    return null;
};

window.getServerStamp = function (result) {
    return (
        result?.saved?.syncUpdatedAt ||
        result?.savedAt ||
        result?.syncUpdatedAt ||
        "1970-01-01T00:00:00.000Z"
    );
};

window.touchUpdatedAt = function (item) {
    if (item && typeof item === "object") item.updatedAt = new Date().toISOString();
    return item;
};

window.isInlineImageSrc = function (src) {
    return typeof src === "string" && src.startsWith("data:image/");
};

window.dataUrlToBlob = function (dataUrl) {
    const parts = String(dataUrl || "").split(",");
    const header = parts[0] || "";
    const base64 = parts[1] || "";
    const match = header.match(/^data:(image\/[^;]+);base64$/i);
    if (!match || !base64) throw new Error("지원하지 않는 이미지 데이터입니다.");
    const mimeType = match[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mimeType });
};

window.uploadToStorage = async function (src, originalName = "") {
    if (!window.isInlineImageSrc(src)) return src;
    const blob = window.dataUrlToBlob(src);
    const response = await window.fetchWithTimeout(
        `${WORK_API_BASE}/api/upload`,
        {
            method: "POST",
            headers: {
                "Content-Type": blob.type || "application/octet-stream",
                "X-Original-Name": encodeURIComponent(originalName || "")
            },
            body: blob
        },
        60000
    );
    const text = await response.text();
    if (!response.ok) throw new Error(`사진 R2 업로드 실패: ${response.status} / ${text}`);
    const result = text ? JSON.parse(text) : {};
    if (!result.ok || !result.url) throw new Error("사진 업로드 결과에 URL이 없습니다.");
    return result.url;
};

window.migrateImagesInItem = async function (item, uploadedBySource) {
    if (!item || !Array.isArray(item.imgs)) return 0;
    let uploadedCount = 0;
    for (const image of item.imgs) {
        if (!image || !window.isInlineImageSrc(image.src)) continue;
        const originalSrc = image.src;
        const uploadKey = `${originalSrc}\u0000${image.originalName || ""}`;
        let url = uploadedBySource.get(uploadKey);
        if (!url) {
            url = await window.uploadToStorage(originalSrc, image.originalName || "");
            uploadedBySource.set(uploadKey, url);
            uploadedCount++;
        }
        image.src = url;
        image.updatedAt = new Date().toISOString();
        item.updatedAt = new Date().toISOString();
    }
    return uploadedCount;
};

window.migrateDirtyImagesToR2 = async function (dirty) {
    const uploadedBySource = new Map();
    let uploadedCount = 0;
    for (const collection of ["logs", "trash"]) {
        const changes = dirty[collection] || {};
        for (const id of Object.keys(changes)) {
            const change = changes[id];
            if (!change || change.action === "delete") continue;
            const item = (window[collection] || []).find(v => String(v.id) === String(id));
            uploadedCount += await window.migrateImagesInItem(item, uploadedBySource);
        }
    }
    if (uploadedCount > 0) window.saveAllLocalOnly();
    return uploadedCount;
};

window.migrateAllImagesToR2 = async function () {
    const uploadedBySource = new Map();
    let uploadedCount = 0;
    for (const collection of ["logs", "trash"]) {
        for (const item of window[collection] || []) {
            uploadedCount += await window.migrateImagesInItem(item, uploadedBySource);
        }
    }
    if (uploadedCount > 0) window.saveAllLocalOnly();
    return uploadedCount;
};

// ─── v2: master payload = groups 배열 통합 ───
window.getUiSettingsPayload = function () {
    const readJson = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch (_) { return fallback; } };
    return {
        cardWidgets: readJson('wm_work_card_widget_settings', {}),
        cardOrder: readJson('wm_work_card_section_order', []),
        cardPresets: readJson('wm_work_card_presets', {}),
        activeCardPreset: localStorage.getItem('wm_work_card_active_preset') || '',
        workLayout: readJson('wm_work_layout_v3', {}),
        workDragOrder: readJson('wm_work_drag_order', []),
        exportConfig: readJson('wm_export_conf', {}),
        basicGroupTitle: localStorage.getItem('wm_basic_group_title') || ''
    };
};
window.applyUiSettingsPayload = function (uiSettings) {
    if (!uiSettings || typeof uiSettings !== 'object' || Object.keys(uiSettings).length === 0) return;
    const setJson = (key, value) => { if (value !== undefined) localStorage.setItem(key, JSON.stringify(value)); };
    setJson('wm_work_card_widget_settings', uiSettings.cardWidgets || {});
    setJson('wm_work_card_section_order', uiSettings.cardOrder || []);
    setJson('wm_work_card_presets', uiSettings.cardPresets || {});
    setJson('wm_work_layout_v3', uiSettings.workLayout || {});
    setJson('wm_work_drag_order', uiSettings.workDragOrder || []);
    setJson('wm_export_conf', uiSettings.exportConfig || {});
    if (uiSettings.activeCardPreset) localStorage.setItem('wm_work_card_active_preset', uiSettings.activeCardPreset);
    else localStorage.removeItem('wm_work_card_active_preset');
    if (uiSettings.basicGroupTitle) localStorage.setItem('wm_basic_group_title', uiSettings.basicGroupTitle);
};
window.getMasterPayload = function () {
    return {
        groups: window.groups || [],
        uiSettings: window.getUiSettingsPayload(),
        // v1 하위 호환 (구 서버가 읽을 경우 대비)
        taskTypes: window.taskTypes || [],
        coworkers: window.coworkers || [],
        statuses: window.statuses || [],
        equipments: window.equipments || [],
        memoTags: window.memoTags || []
    };
};

window.getFullPayload = function () {
    const stamp = new Date().toISOString();
    return {
        app: "work",
        version: 2,
        savedAt: stamp,
        syncUpdatedAt: stamp,
        data: {
            logs: window.logs || [],
            trash: window.trash || [],
            groups: window.groups || [],
            // v1 하위 호환
            taskTypes: window.taskTypes || [],
            coworkers: window.coworkers || [],
            statuses: window.statuses || [],
            equipments: window.equipments || [],
            memoTags: window.memoTags || [],
            uiSettings: window.getUiSettingsPayload()
        }
    };
};

// ─── v2: 서버 데이터 적용 ───
window.applyServerData = function (data) {
    if (!data || !Array.isArray(data.logs)) return false;

    window.isApplyingServerData = true;
    try {
        window.logs = (data.logs || []).filter(Boolean);
        window.trash = (data.trash || []).filter(Boolean);

        // v2: groups 우선, 없으면 v1 키에서 복원
        if (Array.isArray(data.groups) && data.groups.length > 0) {
            window.groups = data.groups.filter(Boolean);
        } else {
            // v1 → 클라이언트 측 마이그레이션
            window.migrateToGroups && window.migrateToGroups();
        }
        // 서버 데이터에는 이 기기에서 새로 추가된 기본 그룹(duration 등)이 없을 수 있으므로 보정
        window.ensureDefaultGroups && window.ensureDefaultGroups();
        window.applyUiSettingsPayload(data.uiSettings);

        window.saveAllLocalOnly();
    } finally {
        window.isApplyingServerData = false;
        window.isInitialLoad = false;
    }

    window.refreshCurrentUI();
    return true;
};

// ─── v2: 부분 변경 적용 ───
window.applyRemoteOperations = function (operations, master) {
    window.isApplyingServerData = true;
    try {
        (operations || []).forEach(operation => {
            if (!operation) return;
            const collection = operation.collection;
            if (collection !== "logs" && collection !== "trash") return;

            if (operation.action === "delete") {
                window[collection] = (window[collection] || []).filter(
                    item => String(item.id) !== String(operation.id)
                );
                return;
            }

            if (operation.action === "upsert" && operation.item) {
                const index = (window[collection] || []).findIndex(
                    item => String(item.id) === String(operation.item.id)
                );
                if (index >= 0) window[collection][index] = operation.item;
                else window[collection].push(operation.item);
            }
        });

        if (master) {
            // v2: groups 통합
            if (Array.isArray(master.groups) && master.groups.length > 0) {
                window.groups = master.groups.filter(Boolean);
                window.ensureDefaultGroups && window.ensureDefaultGroups();
            } else {
                // v1 하위 호환
                for (const key of ["taskTypes","coworkers","statuses","equipments","memoTags"]) {
                    if (Array.isArray(master[key])) {
                        const g = window.groups.find(g => g.id === key);
                        if (g) g.tags = master[key];
                    }
                }
            }
            window.applyUiSettingsPayload(master.uiSettings);
        }

        window.saveAllLocalOnly();
    } finally {
        window.isApplyingServerData = false;
        window.isInitialLoad = false;
    }

    window.refreshCurrentUI();
};

window.loadFromServer = async function () {
    const response = await window.fetchWithTimeout(
        `${WORK_API_BASE}/api/load`,
        { method: "GET", headers: { "Accept": "application/json" } },
        15000
    );
    const text = await response.text();
    if (!response.ok) throw new Error(`서버 불러오기 실패: ${response.status} / ${text}`);
    return text ? JSON.parse(text) : {};
};

window.pullRemoteChanges = async function (reason = "auto", force = false) {
    if (window.syncInProgress || window.isApplyingServerData) return false;
    if (window.hasDirtyChanges()) return false;

    const now = Date.now();
    if (!force && now - window.lastRemoteCheckAt < WORK_SYNC_PULL_COOLDOWN) return false;

    window.lastRemoteCheckAt = now;
    const since = encodeURIComponent(window.getSyncStamp());

    try {
        const response = await window.fetchWithTimeout(
            `${WORK_API_BASE}/api/changes?since=${since}`,
            { method: "GET", headers: { "Accept": "application/json" } },
            15000
        );
        const text = await response.text();
        if (!response.ok) throw new Error(`변경 확인 실패: ${response.status} / ${text}`);

        const result = text ? JSON.parse(text) : {};
        if (!result.changed) return false;

        if (result.full) window.applyServerData(result.data);
        else window.applyRemoteOperations(result.operations, result.master);

        window.setSyncStamp(result.savedAt);
        console.log("서버 변경사항 자동 반영 완료", reason, result.savedAt);
        return true;
    } catch (e) {
        console.warn("서버 변경사항 확인 실패:", reason, e);
        return false;
    }
};

window.buildPatchOperations = function (dirty) {
    const operations = [];
    for (const collection of ["logs", "trash"]) {
        const changes = dirty[collection] || {};
        Object.keys(changes).forEach(id => {
            const change = changes[id];
            if (!change) return;
            if (change.action === "delete") {
                operations.push({ collection, id, action: "delete" });
                return;
            }
            const item = (window[collection] || []).find(v => String(v.id) === String(id));
            if (item) operations.push({ collection, id, action: "upsert", item });
        });
    }
    return operations;
};

window.saveFullSnapshot = async function () {
    const uploadedImages = await window.migrateAllImagesToR2();
    const payload = window.getFullPayload();
    const body = JSON.stringify(payload);
    const bodyMb = new Blob([body]).size / 1024 / 1024;

    if (bodyMb > 24) {
        throw new Error(`사진 분리 후에도 전체 저장 데이터가 ${bodyMb.toFixed(2)}MB입니다.`);
    }

    const response = await window.fetchWithTimeout(
        `${WORK_API_BASE}/api/save`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json", "Accept": "application/json" },
            body
        },
        30000
    );

    const text = await response.text();
    if (!response.ok) throw new Error(`전체 저장 실패: ${response.status} / ${text}`);
    const result = text ? JSON.parse(text) : {};
    console.log("전체 동기화 완료", { sizeMb: bodyMb.toFixed(2), uploadedImages });
    return result;
};

window.saveDirtyPatch = async function (dirty) {
    const uploadedImages = await window.migrateDirtyImagesToR2(dirty);
    const operations = window.buildPatchOperations(dirty);
    const hasMasterChange = !!dirty.master;

    if (operations.length === 0 && !hasMasterChange) {
        return { ok: true, message: "nothing changed", savedAt: window.getSyncStamp() };
    }

    const payload = {
        operations,
        master: hasMasterChange ? window.getMasterPayload() : null
    };

    const response = await window.fetchWithTimeout(
        `${WORK_API_BASE}/api/patch`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json", "Accept": "application/json" },
            body: JSON.stringify(payload)
        },
        30000
    );

    const text = await response.text();
    if (!response.ok) throw new Error(`부분 저장 실패: ${response.status} / ${text}`);
    const result = text ? JSON.parse(text) : {};
    console.log("부분 동기화 완료", { changedCards: operations.length, uploadedImages });
    return result;
};

window.syncNow = async function (showError = false) {
    if (window.syncInProgress) {
        window.pendingSyncAfterCurrent = true;
        return null;
    }

    const dirty = window.getDirtyMap();
    const hasDirty = Object.keys(dirty).length > 0;

    if (!hasDirty) {
        if (showError) return await window.pullRemoteChanges("manual", true);
        return null;
    }

    window.syncInProgress = true;

    try {
        let result;
        if (dirty.snapshot) result = await window.saveFullSnapshot();
        else result = await window.saveDirtyPatch(dirty);

        if (result && result.savedAt) window.setSyncStamp(result.savedAt);
        window.clearDirtyMap();
        return result;
    } catch (e) {
        console.warn("서버 저장 실패, 로컬 변경사항 유지:", e);
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

window.scheduleSync = function () {
    if (window.isApplyingServerData) return;
    clearTimeout(window.syncTimer);
    window.syncTimer = setTimeout(() => window.syncNow(false), WORK_SYNC_PUSH_DELAY);
};

window.saveToServer = async function (showError = false) {
    return await window.syncNow(showError);
};

window.saveLocal = function (dirtyKey = "_all", options = {}) {
    try {
        window.saveAllLocalOnly();
    } catch (e) {
        console.warn("로컬 저장 실패:", e);
    }

    if (window.isApplyingServerData) {
        window.refreshCurrentUI();
        return;
    }

    const key = String(dirtyKey || "_all");

    if (key.startsWith("work:")) {
        const id = key.split(":")[1];
        const changedWork = (window.logs || []).find(item => String(item.id) === String(id));
        if (changedWork) {
            window.markDirty("logs", changedWork.id, "upsert");
            (window.logs || [])
                .filter(item => item.cat === "work" && item.y === changedWork.y && item.m === changedWork.m && item.d === changedWork.d)
                .forEach(item => window.markDirty("logs", item.id, "upsert"));
        }
    } else if (key.startsWith("commute-delete:")) {
        window.markDirty("snapshot", key, "replace");
    } else if (!options.skipSnapshotDirty && !key.includes(":")) {
        window.markDirty("snapshot", key, "replace");
    }

    window.scheduleSync();
    window.refreshCurrentUI();
};

window.saveToLocalStore = function (collection, data) {
    data = window.touchUpdatedAt(data);

    if (collection === "logs") {
        const index = (window.logs || []).findIndex(item => String(item.id) === String(data.id));
        if (index >= 0) window.logs[index] = data;
        else window.logs.push(data);
    }

    if (collection === "trash") {
        const index = (window.trash || []).findIndex(item => String(item.id) === String(data.id));
        if (index >= 0) window.trash[index] = data;
        else window.trash.push(data);
    }

    window.markDirty(collection, data.id, "upsert");
    window.saveLocal(`${collection}:${data.id}`, { skipSnapshotDirty: true });
};

window.deleteFromLocalStore = function (collection, id) {
    if (collection === "logs") {
        window.logs = (window.logs || []).filter(item => String(item.id) !== String(id));
    }
    if (collection === "trash") {
        window.trash = (window.trash || []).filter(item => String(item.id) !== String(id));
    }
    window.markDirty(collection, id, "delete");
    window.saveLocal(`${collection}:${id}:delete`, { skipSnapshotDirty: true });
};

window.startSync = async function () {
    try {
        if (window.hasDirtyChanges()) await window.syncNow(false);

        const result = await window.loadFromServer();
        const serverData = window.getServerData(result);
        const serverStamp = window.getServerStamp(result);

        if (serverData && !window.hasDirtyChanges()) {
            window.applyServerData(serverData);
            window.setSyncStamp(serverStamp);
            console.log("초기 서버 데이터 불러오기 완료", serverStamp);
        } else {
            window.isInitialLoad = false;
            window.refreshCurrentUI();
        }
    } catch (e) {
        console.warn("초기 동기화 실패, 로컬 데이터로 실행:", e);
        window.isInitialLoad = false;
        window.refreshCurrentUI();
    }
};

window.forceSync = async function (options = {}) {
    const silent = !!options.silent;
    const notify = message => {
        const speech = document.querySelector('#fabToday .robot-speech');
        if (speech) {
            speech.textContent = message;
            speech.classList.add('is-visible');
            setTimeout(() => speech.classList.remove('is-visible'), 2200);
        }
        window.showWorkNavigationToast?.(message);
    };
    try {
        if (silent) notify('동기화 중...');
        else if (window.showLoading) window.showLoading("서버 동기화 중...");
        if (window.hasDirtyChanges()) {
            await window.syncNow(true);
            if (silent) notify('저장 완료!');
            else alert("변경사항을 서버에 저장했습니다.");
        } else {
            const changed = await window.pullRemoteChanges("force", true);
            const message = changed ? "서버 변경사항 반영 완료!" : "이미 최신 상태예요";
            if (silent) notify(message); else alert(message);
        }
    } catch (e) {
        if (silent) notify('동기화 실패'); else alert("서버 동기화 실패: " + e.message);
    } finally {
        if (!silent && window.hideLoading) window.hideLoading();
    }
};

window.installAutomaticPull = function () {
    if (window.automaticPullInstalled) return;
    window.automaticPullInstalled = true;

    const originalOpenPop = window.openPop;
    if (typeof originalOpenPop === "function") {
        window.openPop = function (month) {
            const result = originalOpenPop(month);
            window.pullRemoteChanges("calendar-open", true);
            return result;
        };
    }

    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) window.pullRemoteChanges("visible", false);
    });

    window.addEventListener("online", () => {
        if (window.hasDirtyChanges()) window.scheduleSync();
        else window.pullRemoteChanges("online", true);
    });

    window.autoPullSyncTimer = setInterval(() => {
        const popupLayer = document.getElementById("popupLayer");
        const calendarOpen = popupLayer && popupLayer.style.display === "flex" && !document.hidden;
        if (calendarOpen) window.pullRemoteChanges("calendar-open-interval", false);
    }, WORK_CALENDAR_PULL_INTERVAL);
};

setTimeout(() => {
    window.startSync().finally(() => {
        window.installAutomaticPull();
    });
}, 500);
