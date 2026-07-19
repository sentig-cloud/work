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
        remember: false,          // 켜면 새 작업일지를 열 때 이 그룹만 마지막 선택값을 자동 적용
        showNumber: true,         // 그룹 전체 설정: 태그 옆에 [횟수] 표시할지
        includeMonthly: true,     // 그룹 전체 설정: 그 횟수를 월별 집계에 포함할지
        showCount: false,         // 그룹 전체 설정: 태그 이름 뒤에 (갯수) 표시할지
        active: true,             // 꺼지면 상자는 보이되 선택 불가 + 내보내기 제외(제목 색으로 표시)
        tags: [
            { name: '설치', count: 0 },
            { name: 'A/S', count: 0 },
            { name: '점검', count: 0 }
        ]
    },
    {
        id: 'coworkers',
        title: '매니저',
        enabled: true,
        order: 1,
        selectionMode: 'multi',
        remember: false,
        showNumber: true,
        includeMonthly: true,
        showCount: false,
        active: true,
        tags: []
    },
    {
        id: 'statuses',
        title: '상태',
        enabled: true,
        order: 2,
        selectionMode: 'single',
        remember: false,
        showNumber: true,
        includeMonthly: true,
        showCount: false,
        active: true,
        tags: [
            { name: '완료', count: 0 },
            { name: '취소', count: 0 },
            { name: '보류', count: 0 },
            { name: '일정변경', count: 0 }
        ]
    },
    {
        id: 'equipments',
        title: '장비',
        enabled: true,
        order: 3,
        selectionMode: 'qty',
        remember: false,
        showNumber: true,
        includeMonthly: true,
        showCount: false,
        active: true,
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
        showNumber: true,
        includeMonthly: true,
        showCount: false,
        active: true,
        tags: []
    },
    {
        id: 'duration',
        title: '시작/종료',
        enabled: true,
        order: 5,
        selectionMode: 'duration', // 시작/종료 버튼 + 총시간 표시 전용 특수 그룹(태그 목록 없음)
        tags: []
    }
];

// 기본 제공 그룹 id 목록 — 삭제(그룹-)는 안 되고 비활성화만 가능.
// duration(시작/종료)도 특수 기능이라 그룹 해제 대상에서 제외된다.
window.BUILT_IN_GROUP_IDS = ['taskTypes', 'coworkers', 'statuses', 'equipments', 'memoTags', 'duration'];

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

// 이미 groups가 저장돼 있던 기존 사용자(예: 서버 동기화로 이미 받아온 데이터)에게는
// 새로 추가된 기본 그룹(예: duration=시작/종료)이 없을 수 있으므로, 없으면 추가해준다.
// (DEFAULT_GROUPS는 groups가 아예 없을 때만 쓰이므로, 이 보정이 없으면 기존 사용자는
// 새 기본 그룹을 영영 못 받는다.) 최초 로드뿐 아니라 서버 동기화로 window.groups가
// 통째로 교체될 때마다(work_sync.js) 다시 불러 써야 하므로 함수로 분리한다.
window.ensureDefaultGroups = function () {
    if (!Array.isArray(window.groups)) window.groups = [];
    DEFAULT_GROUPS.forEach(defaultGroup => {
        if (!window.groups.find(g => g.id === defaultGroup.id)) {
            window.groups.push({ ...defaultGroup, tags: [...defaultGroup.tags] });
        }
    });
    window.groups.forEach((g, index) => {
        if (!Array.isArray(g.tags)) g.tags = [];
        if (typeof g.showNumber !== 'boolean') g.showNumber = true;
        if (typeof g.includeMonthly !== 'boolean') g.includeMonthly = true;
        if (typeof g.showCount !== 'boolean') g.showCount = false;
        if (!g.selectionMode) {
            if (g.id === 'statuses') g.selectionMode = 'single';
            else if (g.id === 'equipments') g.selectionMode = 'qty';
            else if (g.id === 'memoTags') g.selectionMode = 'tag';
            else if (g.id === 'duration') g.selectionMode = 'duration';
            else g.selectionMode = 'multi';
        }
        if (!Number.isFinite(Number(g.order))) g.order = index;
    });
};

// groups 로드 (없으면 기본값)
window.groups = (window.safeParseLocal('wm_groups', null) || DEFAULT_GROUPS).map(g => ({
    ...g,
    tags: (g.tags || []).filter(Boolean)
}));
window.ensureDefaultGroups();

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
// 현재 편집 중인 작업일지에서 집계 제외한 그룹 ID 목록.
// 값이 없는 기존 로그는 모두 포함으로 처리한다.
window.currentWorkExcludedGroups = [];

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
window.workStartTime = null;
window.workEndTime = null;
window.workOTCount = 0;

// ─── 기억(remember): 그룹별로 켜고 끄는 기능. 켜진 그룹만 마지막 선택값을 저장/복원한다.
// 레이아웃 편집모드의 "기억" 버튼을 눌러 선택모드로 들어간 뒤, 원하는 그룹을 탭해서
// 그 그룹만 켜고 끌 수 있다(순서 모드가 그룹을 탭해서 이동시키는 것과 동일한 방식).
window.getGroupRememberedValue = function (groupId) {
    const store = window.safeParseLocal('wm_group_last_selections', null) || {};
    return store[groupId];
};

window.saveGroupRememberedValue = function (groupId, value) {
    const store = window.safeParseLocal('wm_group_last_selections', null) || {};
    store[groupId] = value;
    window.localStorage.setItem('wm_group_last_selections', JSON.stringify(store));
};

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

// ─── 숫자 표시 / 월별 집계 포함 여부: 태그 하나하나가 아니라 그룹 전체 설정 ───
// (태그 편집창에서 하나를 켜고 끄면 그 그룹에 속한 모든 태그에 똑같이 적용된다)
window.groupShowsNumber = function (groupId) {
    const g = window.getGroupById(groupId);
    return !g || g.showNumber !== false;
};

window.groupIncludesMonthly = function (groupId) {
    const g = window.getGroupById(groupId);
    return !g || g.includeMonthly !== false;
};

window.isLogGroupExcluded = function (log, groupId) {
    return !!log && Array.isArray(log.excludedGroups) && log.excludedGroups.includes(groupId);
};

window.isCurrentWorkGroupExcluded = function (groupId) {
    return Array.isArray(window.currentWorkExcludedGroups) && window.currentWorkExcludedGroups.includes(groupId);
};

// 태그 이름 뒤에 (갯수) 접미사를 붙일지 — 새 기능이라 기존 설치와의 호환을 위해 기본값은 false
window.groupShowsCount = function (groupId) {
    const g = window.getGroupById(groupId);
    return !!g && g.showCount === true;
};

// 그룹 활성/비활성 — 비활성이어도 상자는 계속 보이되 선택 불가 + 내보내기 컬럼에서 제외됨
window.isGroupActive = function (groupId) {
    return true;
};

// 그룹의 "월별 집계 포함" 설정을 반영한, 이번 달 기준 태그 선택 횟수(또는 장비 수량 합)
window.getGroupTagMonthlyCount = function (groupId, tagName) {
    if (!window.groupIncludesMonthly(groupId)) return 0;
    const logs = (window.logs || []).filter((l) => l && l.y === window.currentYear && l.m === window.curMonth);
    return logs.reduce((sum, l) => {
        if (window.isLogGroupExcluded(l, groupId)) return sum;
        const val = window.getGroupValueFromLog(l, groupId);
        if (groupId === 'equipments') return sum + Number((val && val[tagName]) || 0);
        if (Array.isArray(val)) return sum + (val.includes(tagName) ? 1 : 0);
        return sum + (val === tagName ? 1 : 0);
    }, 0);
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
        remember: false,
        showNumber: true,
        includeMonthly: true,
        showCount: false,
        active: true,
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
    if (window.BUILT_IN_GROUP_IDS.includes(groupId)) return false;
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
