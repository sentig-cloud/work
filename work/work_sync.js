// work_sync.js
// Work Master - partial automatic sync with Cloudflare KV / R2 (v2)

const WORK_API_BASE = "https://work.sentig335.workers.dev";
// 저장하면 거의 바로 서버로 보낸다(연속 입력은 이 시간 안에서만 묶어서 한 번에 전송).
const WORK_SYNC_PUSH_DELAY = 300;
const WORK_SYNC_PULL_COOLDOWN = 15000;
// 화면이 켜져 있는 동안 다른 기기의 변경을 확인하는 주기
const WORK_VISIBLE_PULL_INTERVAL = 20000;

window.syncTimer = null;
window.syncInProgress = false;
window.pendingSyncAfterCurrent = false;
window.isApplyingServerData = false;
window.autoPullSyncTimer = null;
window.lastRemoteCheckAt = 0;

window.fetchWithTimeout = async function (url, options = {}, timeoutMs = 15000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const externalSignal = options.signal;
    const onExternalAbort = () => controller.abort();
    if (externalSignal) {
        if (externalSignal.aborted) controller.abort();
        else externalSignal.addEventListener("abort", onExternalAbort);
    }
    // 서버(worker.js)로 가는 요청에는 구글 로그인 토큰을 자동으로 실어 보낸다 — 호출부마다
    // 따로 안 붙여도 되게 여기 한 곳에서 처리(모든 API 호출이 이 함수를 거쳐간다).
    const isWorkApiCall = typeof url === "string" && url.startsWith(WORK_API_BASE);
    const headers = { ...(options.headers || {}) };
    if (isWorkApiCall && window.wmAuthToken) {
        headers["Authorization"] = `Bearer ${window.wmAuthToken}`;
    }
    try {
        const response = await fetch(url, { ...options, headers, signal: controller.signal });
        if (response.status === 401 && isWorkApiCall) {
            window.wmRequireReauth?.();
        }
        return response;
    } catch (e) {
        if (e.name === "AbortError") {
            if (externalSignal && externalSignal.aborted) {
                const cancelled = new Error("요청이 취소되었습니다.");
                cancelled.cancelled = true;
                throw cancelled;
            }
            throw new Error(`서버 응답 시간 초과: ${timeoutMs / 1000}초`);
        }
        throw e;
    } finally {
        clearTimeout(timer);
        if (externalSignal) externalSignal.removeEventListener("abort", onExternalAbort);
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

// 이 기기(모든 탭 공용)에서 서버 저장이 성공할 때마다 1씩 오른다 — 서버 응답을 기다리는 사이
// 다른 탭이 저장을 끝냈는지(그래서 받은 응답이 낡았는지) 판단하는 데 쓴다.
window.getPushSeq = function () {
    return localStorage.getItem("wm_push_seq") || "0";
};
window.bumpPushSeq = function () {
    localStorage.setItem("wm_push_seq", String((Number(window.getPushSeq()) || 0) + 1));
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

// ─── 여러 탭 동시 사용 대비 ───
// 같은 기기의 탭들은 localStorage를 함께 쓰지만 메모리(window.logs)는 탭마다 따로라서,
// 예전엔 뒤에 떠 있던 탭이 저장하면 오래된 메모리 내용으로 다른 탭의 저장분을 덮어쓰거나
// (서버 전체 저장 시 서버에서도 지워짐) 다른 탭이 표시한 변경 표시를 자기 걸로 지워버려서
// "저장했는데 안 된" 상태가 생겼다. 그래서 쓰기 전/서버 전송 전에 다른 탭이 쓴 내용을
// 항목(id) 단위로 합친다. 기준(base)은 이 탭이 마지막으로 읽거나 쓴 시점의 id 목록.
const WORK_TAB_ID = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const LOCAL_REV_KEY = "wm_local_rev";
let localRevCounter = 0;
let lastSeenLocalRev = localStorage.getItem(LOCAL_REV_KEY) || "";
const localBaseIds = {
    logs: new Set((window.logs || []).map(item => String(item && item.id))),
    trash: new Set((window.trash || []).map(item => String(item && item.id)))
};

function mergeCollectionWithStored(key, memory, stored) {
    const base = localBaseIds[key] || new Set();
    const storedById = new Map();
    stored.forEach(item => { if (item && item.id !== undefined) storedById.set(String(item.id), item); });
    const merged = [];
    const seen = new Set();
    memory.forEach(item => {
        if (!item) return;
        const id = String(item.id);
        seen.add(id);
        const other = storedById.get(id);
        if (!other) {
            // 이 탭에만 있음: 기준에 있었다면 다른 탭이 지운 것, 없었다면 이 탭이 새로 만든 것
            if (!base.has(id)) merged.push(item);
            return;
        }
        const mine = String(item.updatedAt || "");
        const theirs = String(other.updatedAt || "");
        merged.push(theirs > mine ? other : item);
    });
    stored.forEach(item => {
        if (!item) return;
        const id = String(item.id);
        if (seen.has(id)) return;
        // 저장소에만 있음: 기준에 있었다면 이 탭이 지운 것, 없었다면 다른 탭이 새로 만든 것
        if (!base.has(id)) merged.push(item);
    });
    return merged;
}

// 다른 탭이 localStorage에 쓴 내용이 있으면 이 탭 메모리에 합친다. 바뀐 게 있으면 true.
window.mergeOtherTabsLocal = function (force = false) {
    const rev = localStorage.getItem(LOCAL_REV_KEY) || "";
    if (!force && rev === lastSeenLocalRev) return false;
    lastSeenLocalRev = rev;
    let changed = false;
    for (const key of ["logs", "trash"]) {
        let stored;
        try { stored = JSON.parse(localStorage.getItem(`wm_${key}`) || "[]"); } catch (e) { continue; }
        if (!Array.isArray(stored)) continue;
        const before = window[key] || [];
        const merged = mergeCollectionWithStored(key, before, stored);
        localBaseIds[key] = new Set(stored.filter(Boolean).map(item => String(item.id)));
        if (merged.length !== before.length || merged.some((item, i) => item !== before[i])) changed = true;
        window[key] = merged;
    }
    try {
        const storedGroups = JSON.parse(localStorage.getItem("wm_groups") || "null");
        if (Array.isArray(storedGroups) && JSON.stringify(storedGroups) !== JSON.stringify(window.groups || [])) {
            window.groups = storedGroups.filter(Boolean);
            window.ensureDefaultGroups && window.ensureDefaultGroups();
            changed = true;
        }
    } catch (e) { /* 그룹 파싱 실패는 무시 */ }
    return changed;
};

function bumpLocalRev() {
    lastSeenLocalRev = `${WORK_TAB_ID}:${++localRevCounter}`;
    localStorage.setItem(LOCAL_REV_KEY, lastSeenLocalRev);
}

// ─── 로컬 저장 (v2: groups 통합) ───
window.saveArrayToLocal = function (key, array) {
    localStorage.setItem(`wm_${key}`, JSON.stringify((array || []).filter(Boolean)));
};

window.saveAllLocalOnly = function () {
    // 다른 탭이 그 사이 저장했으면 먼저 합쳐서, 이 탭의 오래된 내용으로 덮어쓰지 않게 한다.
    window.mergeOtherTabsLocal();
    window.logs = (window.logs || []).filter(Boolean);
    window.trash = (window.trash || []).filter(Boolean);
    window.groups = (window.groups || []).filter(Boolean);

    // 사용자 정의 선택상자 정의를 먼저 기록한다. 사진이 많은 로그 저장 중 용량 오류가 나더라도
    // 새 그룹 정의가 통째로 유실되는 문제를 막는다.
    localStorage.setItem("wm_groups", JSON.stringify(window.groups));
    window.saveArrayToLocal("logs", window.logs);
    window.saveArrayToLocal("trash", window.trash);
    localBaseIds.logs = new Set(window.logs.map(item => String(item.id)));
    localBaseIds.trash = new Set(window.trash.map(item => String(item.id)));
    bumpLocalRev();

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

// 출퇴근 사진에서 시간/거리를 자동으로 읽어오는 Google Vision OCR — 서버(worker.js)의
// /api/ocr로 이미지를 보내면, 실제 Vision API 키는 서버에만 있는 채로 인식된 텍스트만 돌려준다.
window.runVisionOcr = async function (dataUrlOrBlob, signal = null) {
    const blob = typeof dataUrlOrBlob === "string" ? window.dataUrlToBlob(dataUrlOrBlob) : dataUrlOrBlob;
    const response = await window.fetchWithTimeout(
        `${WORK_API_BASE}/api/ocr`,
        {
            method: "POST",
            headers: { "Content-Type": blob.type || "application/octet-stream" },
            body: blob,
            signal
        },
        20000
    );
    const text = await response.text();
    const result = text ? JSON.parse(text) : {};
    if (result.used !== undefined && result.limit !== undefined) {
        window.setVisionOcrUsage?.(result.used, result.limit);
    }
    if (!response.ok || !result.ok) {
        const err = new Error(result.error || `OCR 실패: ${response.status}`);
        err.quotaExceeded = !!result.quotaExceeded;
        throw err;
    }
    return result.text || "";
};

// 주소 → 좌표 변환(지오코딩, 동선 관리용) — 서버(worker.js)의 /api/geocode로 주소 문자열을
// 보내면, 실제 카카오 REST API 키는 서버에만 있는 채로 좌표/정제된 주소만 돌려준다.
window.geocodeAddress = async function (address, signal = null) {
    const response = await window.fetchWithTimeout(
        `${WORK_API_BASE}/api/geocode`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ address }),
            signal
        },
        15000
    );
    const text = await response.text();
    const result = text ? JSON.parse(text) : {};
    if (!response.ok || !result.ok) {
        const err = new Error(result.error || `지오코딩 실패: ${response.status}`);
        err.notFound = !!result.notFound;
        throw err;
    }
    return result;
};

// 현재 위치 → 목적지 자동차 길찾기(카카오 모빌리티, 동선 관리의 소요시간 표시용) —
// 서버(worker.js)의 /api/directions로 좌표만 보내면, 카카오 REST API 키는 서버에만
// 있는 채로 거리(m)/소요시간(초)만 돌려준다.
window.fetchDrivingRoute = async function (originLat, originLng, destLat, destLng, signal = null) {
    const response = await window.fetchWithTimeout(
        `${WORK_API_BASE}/api/directions`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ originLat, originLng, destLat, destLng }),
            signal
        },
        15000
    );
    const text = await response.text();
    const result = text ? JSON.parse(text) : {};
    if (!response.ok || !result.ok) {
        const err = new Error(result.error || `길찾기 실패: ${response.status}`);
        err.notFound = !!result.notFound;
        throw err;
    }
    return result;
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
        basicGroupTitle: localStorage.getItem('wm_basic_group_title') || '',
        tagCompact: {
            mode: localStorage.getItem('wm_tag_compact_mode') || '0',
            close: localStorage.getItem('wm_tag_compact_close') || 'outside'
        },
        geoRouteMarks: readJson('wm_georoute_marks', [])
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
    // 아래 두 항목은 예전 버전이 보낸 설정에는 없으므로, 들어있을 때만 덮어쓴다.
    if (uiSettings.tagCompact && typeof uiSettings.tagCompact === 'object') {
        localStorage.setItem('wm_tag_compact_mode', uiSettings.tagCompact.mode === '1' ? '1' : '0');
        localStorage.setItem('wm_tag_compact_close', uiSettings.tagCompact.close === 'ok' ? 'ok' : 'outside');
        window.applyTagCompactMode?.();
    }
    if (Array.isArray(uiSettings.geoRouteMarks)) {
        setJson('wm_georoute_marks', uiSettings.geoRouteMarks);
        window.refreshGeoRouteMarks?.();
    }
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
    const pushSeqBefore = window.getPushSeq();

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
        // 응답을 기다리는 사이 이 기기(다른 탭 포함)가 저장했으면 이 응답은 이미 낡은 것 —
        // 그대로 덮으면 방금 저장한 카드가 사라질 수 있으니 버리고 다음 확인 때 다시 받는다.
        if (window.hasDirtyChanges() || window.getPushSeq() !== pushSeqBefore || window.getSyncStamp() !== decodeURIComponent(since)) return false;

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

// 이번에 서버로 보낸 변경 표시만 지운다. 예전엔 전송하는 동안 새로 생긴 변경 표시까지 통째로
// 지워서(clearDirtyMap), 저장 직후 바로 고친 내용은 서버로 영영 안 가는 경우가 있었다.
window.clearSentDirty = function (sent) {
    const current = window.getDirtyMap();
    Object.keys(sent || {}).forEach(collection => {
        const sentEntries = sent[collection] || {};
        const currentEntries = current[collection];
        if (!currentEntries) return;
        Object.keys(sentEntries).forEach(id => {
            const now = currentEntries[id];
            if (now && now.changedAt === sentEntries[id].changedAt && now.action === sentEntries[id].action) {
                delete currentEntries[id];
            }
        });
        if (Object.keys(currentEntries).length === 0) delete current[collection];
    });
    if (Object.keys(current).length === 0) window.clearDirtyMap();
    else window.setDirtyMap(current);
};

// 같은 기기의 여러 탭이 동시에 서버로 보내지 않도록 브라우저 잠금을 쓴다(지원 안 하면 그냥 실행).
// 잠금이 어떤 이유로든 오래 안 풀리면(브라우저 이상) 저장이 멈추지 않도록 일정 시간 뒤엔 잠금 없이 진행한다.
function withSyncLock(task) {
    if (!(navigator.locks && navigator.locks.request && typeof AbortController === "function")) return task();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45000);
    return navigator.locks.request("wm-sync-push", { signal: controller.signal }, (lock) => {
        clearTimeout(timer);
        return task();
    }).catch((e) => {
        clearTimeout(timer);
        if (e && e.name === "AbortError") return task();
        throw e;
    });
}

window.syncNow = async function (showError = false) {
    if (window.syncInProgress) {
        window.pendingSyncAfterCurrent = true;
        return null;
    }

    if (!window.hasDirtyChanges()) {
        if (showError) return await window.pullRemoteChanges("manual", true);
        return null;
    }

    window.syncInProgress = true;
    let needsPull = false;
    let failed = false;

    try {
        return await withSyncLock(async () => {
            // 잠금을 기다리는 동안 다른 탭이 이미 보냈을 수 있으니 다시 확인한다.
            const dirty = window.getDirtyMap();
            if (Object.keys(dirty).length === 0) return null;
            // 다른 탭이 저장한 카드가 이 탭 메모리에 없으면 전송에서 빠지거나(부분 저장),
            // 서버에서 지워질 수 있으므로(전체 저장) 보내기 직전에 합친다.
            if (window.mergeOtherTabsLocal()) window.refreshCurrentUI();

            const stampBefore = window.getSyncStamp();
            let result;
            if (dirty.snapshot) result = await window.saveFullSnapshot();
            else result = await window.saveDirtyPatch(dirty);

            if (result && result.savedAt && result.savedAt !== stampBefore) {
                // 우리 저장 직전 서버 시각이 우리가 마지막으로 본 시각과 같을 때만 시각을 앞당긴다.
                // 그 사이 다른 기기가 저장했다면 그 변경을 놓치지 않게 바로 받아온다.
                if (result.prevSavedAt && result.prevSavedAt <= stampBefore) window.setSyncStamp(result.savedAt);
                else needsPull = true;
            }
            window.clearSentDirty(dirty);
            window.bumpPushSeq();
            return result;
        });
    } catch (e) {
        failed = true;
        console.warn("서버 저장 실패, 로컬 변경사항 유지:", e);
        if (showError) throw e;
        return null;
    } finally {
        window.syncInProgress = false;
        if (failed) {
            // 실패하면 바로 반복하지 않고 잠시 뒤 다시 시도한다(새로 저장하거나 온라인이 되면 그때도 시도).
            window.pendingSyncAfterCurrent = false;
            clearTimeout(window.syncRetryTimer);
            window.syncRetryTimer = setTimeout(() => window.syncNow(false), 15000);
        } else if (window.pendingSyncAfterCurrent || window.hasDirtyChanges()) {
            window.pendingSyncAfterCurrent = false;
            window.scheduleSync();
        } else if (needsPull) {
            window.pullRemoteChanges("after-push", true);
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

        const stampBeforeLoad = window.getSyncStamp();
        const pushSeqBeforeLoad = window.getPushSeq();
        const result = await window.loadFromServer();
        const serverData = window.getServerData(result);
        const serverStamp = window.getServerStamp(result);

        // 불러오는 사이 다른 탭이 저장을 마쳤다면(시각이 바뀜) 이 응답은 그 저장보다 오래된 것이라
        // 덮어쓰지 않고, 바뀐 부분만 다시 받아온다.
        const staleResponse = window.getSyncStamp() !== stampBeforeLoad || window.getPushSeq() !== pushSeqBeforeLoad;
        if (serverData && !window.hasDirtyChanges() && !staleResponse) {
            window.applyServerData(serverData);
            window.setSyncStamp(serverStamp);
            console.log("초기 서버 데이터 불러오기 완료", serverStamp);
        } else if (staleResponse) {
            window.isInitialLoad = false;
            window.mergeOtherTabsLocal();
            window.refreshCurrentUI();
            window.pullRemoteChanges("startup-retry", true);
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

    // 다른 탭에서 저장하면 이 탭 화면에도 바로 반영한다.
    let storageRefreshTimer = null;
    window.addEventListener("storage", (e) => {
        if (e.key !== LOCAL_REV_KEY && e.key !== "wm_logs" && e.key !== "wm_trash" && e.key !== "wm_groups") return;
        clearTimeout(storageRefreshTimer);
        storageRefreshTimer = setTimeout(() => {
            if (window.mergeOtherTabsLocal(e.key !== LOCAL_REV_KEY)) window.refreshCurrentUI();
        }, 80);
    });

    // 화면을 벗어나기 직전엔 기다리지 않고 바로 서버로 보낸다(앱 전환/탭 닫기 대비).
    const flushNow = () => {
        if (!window.hasDirtyChanges()) return;
        clearTimeout(window.syncTimer);
        window.syncNow(false);
    };
    window.addEventListener("pagehide", flushNow);

    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            flushNow();
            return;
        }
        // 다시 보일 때: 잠들어 있던 동안 다른 탭이 저장한 것부터 합치고, 서버 변경도 확인
        if (window.mergeOtherTabsLocal()) window.refreshCurrentUI();
        if (window.hasDirtyChanges()) window.scheduleSync();
        else window.pullRemoteChanges("visible", true);
    });

    window.addEventListener("online", () => {
        if (window.hasDirtyChanges()) window.scheduleSync();
        else window.pullRemoteChanges("online", true);
    });

    window.autoPullSyncTimer = setInterval(() => {
        if (document.hidden) return;
        if (window.hasDirtyChanges()) window.scheduleSync();
        else window.pullRemoteChanges("visible-interval", false);
    }, WORK_VISIBLE_PULL_INTERVAL);
};

setTimeout(() => {
    window.startSync().finally(() => {
        window.installAutomaticPull();
    });
}, 500);
