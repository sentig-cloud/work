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

window.taskTypes = (window.safeParseLocal('wm_taskTypes', [
    { name: '설치', count: 0 },
    { name: 'A/S', count: 0 },
    { name: '점검', count: 0 }
]) || []).filter(Boolean);

window.coworkers = (window.safeParseLocal('wm_coworkers', []) || []).filter(Boolean);

window.statuses = (window.safeParseLocal('wm_statuses', [
    { name: '완료', count: 0 },
    { name: '취소', count: 0 },
    { name: '보류', count: 0 },
    { name: '일정변경', count: 0 }
]) || []).filter(Boolean);

window.equipments = (window.safeParseLocal('wm_equipments', [
    { name: '인' },
    { name: '티' },
    { name: '전' },
    { name: 'CCTV' }
]) || []).filter(Boolean);

window.memoTags = (window.safeParseLocal('wm_memoTags', []) || []).filter(Boolean);

window.activeTaskTypes = [];
window.selectedCoworkers = [];
window.activeStatus = null;
window.activeEquips = {};
window.activeEditTags = [];

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
window.isWorkDuty = false;