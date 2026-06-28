// work_data.js
// Firebase 완전 제거 / 로컬 초기 데이터 전용

window.APP_NAME = 'work_master';
window.syncRef = null;
window.syncTimer = null;
window.isInitialLoad = true;

window.currentYear = new Date().getFullYear();
window.curMonth = new Date().getMonth() + 1;
window.curDay = new Date().getDate();

window.safeParseLocal = function (key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return fallback;
        const parsed = JSON.parse(raw);
        return parsed || fallback;
    } catch (e) {
        console.warn("localStorage 파싱 실패:", key, e);
        return fallback;
    }
};

window.holidays = {
    "20260101": "신정", "20260216": "설날", "20260217": "설날", "20260218": "설날",
    "20260301": "삼일절", "20260501": "근로자의날", "20260505": "어린이날", "20260524": "부처님오신날", "20260606": "현충일",
    "20260815": "광복절", "20260924": "추석", "20260925": "추석", "20260926": "추석",
    "20261003": "개천절", "20261009": "한글날", "20261225": "성탄절"
};

window.logs = (window.safeParseLocal('wm_logs', []) || []).filter(Boolean);
window.trash = (window.safeParseLocal('wm_trash', []) || []).filter(Boolean);

// ─────────────────────────────────────────────
// 그룹 통합 구조 (v2)
// 기존 taskTypes/coworkers/statuses/equipments/memoTags를
// groups 배열로 통합 관리
// ─────────────────────────────────────────────

const DEFAULT_GROUPS = [
    {
        id: 'taskTypes',
        title: '작업유형',
        enabled: true,
        order: 0,
        selectionMode: 'multi',   // multi: 다중선택, single: 단일선택, qty: 수량선택, tag: 메모태그
        tags: [
            { name: '설치', count: 0, showNumber: true, includeMonthly: true },
            { name: 'A/S', count: 0, showNumber: true, includeMonthly: true },
            { name: '점검', count: 0, showNumber: true, includeMonthly: true }
        ]
    },
    {
        id: 'coworkers',
        title: '매니저',
        enabled: true,
        order: 1,
        selectionMode: 'multi',
        tags: []
    },
    {
        id: 'statuses',
        title: '상태',
        enabled: true,
        order: 2,
        selectionMode: 'single',
        tags: [
            { name: '완료', count: 0, showNumber: true, includeMonthly: true },
            { name: '취소', count: 0, showNumber: true, includeMonthly: true },
            { name: '보류', count: 0, showNumber: true, includeMonthly: true },
            { name: '일정변경', count: 0, showNumber: true, includeMonthly: true }
        ]
    },
    {
        id: 'equipments',
        title: '장비',
        enabled: true,
        order: 3,
        selectionMode: 'qty',
        tags: [
            { name: '인' },
            { name: '티' },
            { name: '전' },
            { name: 'CCTV' }
        ]
    },
    {
        id: 'memoTags',
        title: '메모태그',
        enabled: true,
        order: 4,
        selectionMode: 'tag',
        tags: []
    }
];

// ─── 마이그레이션: 구 데이터 → groups 통합 구조 ───
window.migrateToGroups = function () {
    // 이미 마이그레이션 됐으면 스킵
    if (window.safeParseLocal('wm_migrated_v2', false)) return;

    const stored = window.safeParseLocal('wm_groups', null);
    if (stored) return; // groups 이미 있으면 스킵

    const oldTaskTypes = window.safeParseLocal('wm_taskTypes', null);
    const oldCoworkers = window.safeParseLocal('wm_coworkers', null);
    const oldStatuses = window.safeParseLocal('wm_statuses', null);
    const oldEquipments = window.safeParseLocal('wm_equipments', null);
    const oldMemoTags = window.safeParseLocal('wm_memoTags', null);

    // 기존 데이터가 하나라도 있으면 마이그레이션
    const hasOldData = oldTaskTypes || oldCoworkers || oldStatuses || oldEquipments || oldMemoTags;

    if (hasOldData) {
        const migrated = DEFAULT_GROUPS.map(g => {
            let tags = g.tags;
            if (g.id === 'taskTypes' && oldTaskTypes) tags = oldTaskTypes.filter(Boolean);
            if (g.id === 'coworkers' && oldCoworkers) tags = oldCoworkers.filter(Boolean);
            if (g.id === 'statuses' && oldStatuses) tags = oldStatuses.filter(Boolean);
            if (g.id === 'equipments' && oldEquipments) tags = oldEquipments.filter(Boolean);
            if (g.id === 'memoTags' && oldMemoTags) tags = oldMemoTags.filter(Boolean);
            return { ...g, tags };
        });
        localStorage.setItem('wm_groups', JSON.stringify(migrated));
        console.log('[v2] 구 데이터 → groups 마이그레이션 완료');
    }

    localStorage.setItem('wm_migrated_v2', 'true');
};

window.migrateToGroups();

// groups 로드 (없으면 기본값)
window.groups = (window.safeParseLocal('wm_groups', null) || DEFAULT_GROUPS).map(g => ({
    ...g,
    tags: (g.tags || []).filter(Boolean)
}));

// ─── 하위 호환: 기존 코드가 window.taskTypes 등을 참조하는 경우 대응 ───
// groups에서 파생된 getter로 연결
Object.defineProperty(window, 'taskTypes', {
    get: () => (window.groups.find(g => g.id === 'taskTypes') || {}).tags || [],
    set: (v) => { const g = window.groups.find(g => g.id === 'taskTypes'); if (g) g.tags = v; },
    configurable: true
});
Object.defineProperty(window, 'coworkers', {
    get: () => (window.groups.find(g => g.id === 'coworkers') || {}).tags || [],
    set: (v) => { const g = window.groups.find(g => g.id === 'coworkers'); if (g) g.tags = v; },
    configurable: true
});
Object.defineProperty(window, 'statuses', {
    get: () => (window.groups.find(g => g.id === 'statuses') || {}).tags || [],
    set: (v) => { const g = window.groups.find(g => g.id === 'statuses'); if (g) g.tags = v; },
    configurable: true
});
Object.defineProperty(window, 'equipments', {
    get: () => (window.groups.find(g => g.id === 'equipments') || {}).tags || [],
    set: (v) => { const g = window.groups.find(g => g.id === 'equipments'); if (g) g.tags = v; },
    configurable: true
});
Object.defineProperty(window, 'memoTags', {
    get: () => (window.groups.find(g => g.id === 'memoTags') || {}).tags || [],
    set: (v) => { const g = window.groups.find(g => g.id === 'memoTags'); if (g) g.tags = v; },
    configurable: true
});

// ─── 선택 상태 ───
window.activeTaskTypes = [];
window.selectedCoworkers = [];
window.activeStatus = null;
window.activeEquips = {};
window.activeEditTags = [];
// 커스텀 그룹 선택 상태: { [groupId]: 선택된 tag 이름 배열 }
window.activeCustomGroupSelections = {};

window.tempEquipQty = 0;
window.tempImgs = [];
window.workImgs = [];
window.currentWorkId = null;

window.currentViewerIndex = -1;
window.currentViewerImages = [];
window.currentViewerMode = null;
window.currentViewerRefId = null;
window.editingLogId = null;

window.pressTimer = null;
window.isLongPress = false;
window.lastClickTime = 0;
window.editingTagType = null;
window.editingTagIndex = -1;
window.editingGroupId = null;  // 현재 편집 중인 그룹 ID
window.mapPressTimer = 0;
window.mapLastClickTime = 0;

window.isMicOn = false;
window.globalRecognition = null;
window.activeInputId = null;
window.activeMicBtnId = null;

window.currentCommuteType = null;
window.isCommuteException = false;
window.calculatedOvertimeMin = 0;
window.tempCommuteImg = null;
window.tempCommuteOriginalName = "";
window.isWorkDuty = false;

// ─── 그룹 헬퍼 함수 ───

// 활성화된 그룹만, 순서대로
window.getActiveGroups = function () {
    return [...window.groups]
        .filter(g => g.enabled !== false)
        .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
};

// 전체 그룹 (비활성 포함), 순서대로
window.getAllGroupsSorted = function () {
    return [...window.groups]
        .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
};

window.getGroupById = function (id) {
    return window.groups.find(g => g.id === id) || null;
};

// 그룹의 현재 선택값 가져오기 (기존 전역 변수 + 커스텀 그룹 통합)
window.getGroupSelection = function (groupId) {
    if (groupId === 'taskTypes') return window.activeTaskTypes;
    if (groupId === 'coworkers') return window.selectedCoworkers;
    if (groupId === 'statuses') return window.activeStatus ? [window.activeStatus] : [];
    if (groupId === 'equipments') return Object.keys(window.activeEquips).filter(k => window.activeEquips[k] > 0);
    if (groupId === 'memoTags') return window.activeEditTags;
    return window.activeCustomGroupSelections[groupId] || [];
};

// 그룹 선택 설정
window.setGroupSelection = function (groupId, names) {
    if (groupId === 'taskTypes') { window.activeTaskTypes = names; return; }
    if (groupId === 'coworkers') { window.selectedCoworkers = names; return; }
    if (groupId === 'statuses') { window.activeStatus = names[0] || null; return; }
    if (groupId === 'memoTags') { window.activeEditTags = names; return; }
    window.activeCustomGroupSelections[groupId] = names;
};

// 그룹 선택 초기화
window.clearAllGroupSelections = function () {
    window.activeTaskTypes = [];
    window.selectedCoworkers = [];
    window.activeStatus = null;
    window.activeEquips = {};
    window.activeEditTags = [];
    window.activeCustomGroupSelections = {};
};

// 로그에서 그룹 데이터 읽기
window.getGroupValueFromLog = function (log, groupId) {
    if (groupId === 'taskTypes') return log.taskType ? log.taskType.split(', ') : [];
    if (groupId === 'coworkers') return log.coworkers || [];
    if (groupId === 'statuses') return log.status ? [log.status] : [];
    if (groupId === 'equipments') return log.equips || {};
    if (groupId === 'memoTags') return log.tags || [];
    // 커스텀 그룹: log.customGroups[groupId]
    return (log.customGroups && log.customGroups[groupId]) || [];
};

// 로그에 그룹 데이터 쓰기
window.setGroupValueToLog = function (log, groupId, value) {
    if (groupId === 'taskTypes') { log.taskType = Array.isArray(value) ? value.join(', ') : ''; return; }
    if (groupId === 'coworkers') { log.coworkers = value; return; }
    if (groupId === 'statuses') { log.status = Array.isArray(value) ? (value[0] || null) : value; return; }
    if (groupId === 'equipments') { log.equips = value; return; }
    if (groupId === 'memoTags') { log.tags = value; return; }
    // 커스텀 그룹
    if (!log.customGroups) log.customGroups = {};
    log.customGroups[groupId] = value;
};

// 새 커스텀 그룹 추가
window.addCustomGroup = function (title) {
    const id = 'grp_' + Date.now();
    const maxOrder = window.groups.reduce((m, g) => Math.max(m, g.order ?? 0), 0);
    const newGroup = {
        id,
        title,
        enabled: true,
        order: maxOrder + 1,
        selectionMode: 'multi',
        tags: []
    };
    window.groups.push(newGroup);
    return newGroup;
};

// 그룹 비활성화/활성화 토글
window.toggleGroupEnabled = function (groupId) {
    const g = window.getGroupById(groupId);
    if (!g) return;
    g.enabled = !g.enabled;
    // 비활성화 시 맨 아래로
    if (!g.enabled) {
        const maxOrder = window.groups.reduce((m, grp) => Math.max(m, grp.order ?? 0), 0);
        g.order = maxOrder + 1;
    }
};

// 그룹 삭제
window.removeGroup = function (groupId) {
    // 기본 그룹은 삭제 불가 (비활성화만 가능)
    const builtIn = ['taskTypes', 'coworkers', 'statuses', 'equipments', 'memoTags'];
    if (builtIn.includes(groupId)) return false;
    window.groups = window.groups.filter(g => g.id !== groupId);
    return true;
};

// ─── 저장 헬퍼 ───
window.saveToLocalStore = function (colName, data) {
    if (!window.logs) window.logs = [];
    if (!window.trash) window.trash = [];

    data.updatedAt = new Date().toISOString();

    if (colName === 'logs') {
        const idx = window.logs.findIndex(l => String(l.id) === String(data.id));
        if (idx >= 0) window.logs[idx] = data;
        else window.logs.push(data);
        localStorage.setItem('wm_logs', JSON.stringify(window.logs));
    } else if (colName === 'trash') {
        const idx = window.trash.findIndex(l => String(l.id) === String(data.id));
        if (idx >= 0) window.trash[idx] = data;
        else window.trash.push(data);
        localStorage.setItem('wm_trash', JSON.stringify(window.trash));
    }

    if (window.markDirty) {
        window.markDirty(colName, data.id, 'upsert');
    }
    if (window.updateUI) window.updateUI();
};

window.deleteFromLocalStore = function (colName, id) {
    if (colName === 'logs') {
        window.logs = window.logs.filter(l => String(l.id) !== String(id));
        localStorage.setItem('wm_logs', JSON.stringify(window.logs));
    } else if (colName === 'trash') {
        window.trash = window.trash.filter(l => String(l.id) !== String(id));
        localStorage.setItem('wm_trash', JSON.stringify(window.trash));
    }

    if (window.markDirty) {
        window.markDirty(colName, id, 'delete');
    }
    if (window.updateUI) window.updateUI();
};