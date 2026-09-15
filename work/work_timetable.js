// work_timetable.js
// 주간 시간표 뷰 — 순수 데이터 로직(시간 계산, 주 범위, 시간대별 묶음).
// window.logs를 그대로 읽기만 하고, 새 컬렉션/스키마는 만들지 않는다.

window.WorkTimetable = (() => {
    const SETTINGS_KEY = 'wm_timetable_settings';
    const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'];
    const DEFAULT_SETTINGS = {
        categories: { work: true, commute: true, memo: false },
        defaultView: 'month', // 'month' | 'timetable'
        scale: 'medium', // 'small' | 'medium' | 'large' — 시간표 글씨/줄 크기
        longNameMode: 'wrap' // 'wrap'(칸 높이를 늘려 줄바꿈) | 'ellipsis'(한 줄로 말줄임)
    };

    function getSettings() {
        let saved = {};
        try { saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); } catch (_) { saved = {}; }
        const scale = ['small', 'medium', 'large'].includes(saved.scale) ? saved.scale : DEFAULT_SETTINGS.scale;
        const longNameMode = ['wrap', 'ellipsis'].includes(saved.longNameMode) ? saved.longNameMode : DEFAULT_SETTINGS.longNameMode;
        return {
            categories: { ...DEFAULT_SETTINGS.categories, ...(saved.categories || {}) },
            defaultView: saved.defaultView === 'timetable' ? 'timetable' : 'month',
            scale,
            longNameMode
        };
    }

    function saveSettings(patch) {
        const merged = { ...getSettings(), ...patch };
        if (patch && patch.categories) merged.categories = { ...getSettings().categories, ...patch.categories };
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
        return merged;
    }

    function toMin(hhmm) {
        if (!hhmm || typeof hhmm !== 'string' || hhmm.indexOf(':') === -1) return null;
        const parts = hhmm.split(':');
        const h = parseInt(parts[0], 10), m = parseInt(parts[1], 10);
        if (Number.isNaN(h) || Number.isNaN(m)) return null;
        return h * 60 + m;
    }

    function toHHMM(min) {
        const clamped = Math.max(0, Math.min(24 * 60 - 1, Math.round(min)));
        const h = Math.floor(clamped / 60), m = clamped % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }

    // 해당 날짜가 속한 주(월~일)의 월요일 00:00을 반환
    function mondayOf(date) {
        const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const dow = d.getDay(); // 0=일 ... 6=토
        const diff = dow === 0 ? -6 : 1 - dow;
        d.setDate(d.getDate() + diff);
        return d;
    }

    function weekDays(monday) {
        return Array.from({ length: 7 }, (_, i) => {
            const d = new Date(monday);
            d.setDate(d.getDate() + i);
            return d;
        });
    }

    function logsForDay(logs, date) {
        return (logs || []).filter(l => l && l.y === date.getFullYear() && l.m === date.getMonth() + 1 && l.d === date.getDate());
    }

    // 카테고리 3분류: work / commute / memo(그 외 전부 — memo, photo, duty 등)
    function groupCatOf(log) {
        if (log.cat === 'work') return 'work';
        if (log.cat === 'commute_in' || log.cat === 'commute_out') return 'commute';
        return 'memo';
    }

    function labelOf(log) {
        if (log.customerName && String(log.customerName).trim()) return String(log.customerName).trim();
        if (log.taskType) {
            const first = String(log.taskType).split(',')[0].trim();
            if (first) return first;
        }
        if (log.cat === 'commute_in') return '출근';
        if (log.cat === 'commute_out') return '퇴근';
        if (log.memo) return String(log.memo).slice(0, 14);
        return '(내용없음)';
    }

    // 로그 1건의 대표 시각(분) — work는 시작시간(없으면 작업시간), 그 외는 time/workTime
    function startMinOf(log) {
        if (log.cat === 'work') {
            const s = toMin(log.startTime);
            if (s !== null) return s;
            return toMin(log.workTime || log.time);
        }
        const t = toMin(log.time);
        return t !== null ? t : toMin(log.workTime);
    }

    // 정시 단위로만 구분한다 — 15시 59분도 15시 칸으로 판단(분 단위는 표시만 유지).
    function hourOf(startMin) {
        return Math.floor(startMin / 60);
    }

    function buildDayBlocks(logs, date, settings) {
        const dayLogs = logsForDay(logs, date);
        const blocks = [];
        dayLogs.forEach(log => {
            const groupCat = groupCatOf(log);
            if (!settings.categories[groupCat]) return;
            const startMin = startMinOf(log);
            if (startMin === null || startMin === undefined || Number.isNaN(startMin)) return;
            blocks.push({
                logId: log.id,
                cat: log.cat,
                groupCat,
                label: labelOf(log),
                completed: log.status === '완료',
                canceled: log.status === '취소',
                taskNo: log.taskNo || '',
                address: log.address || '',
                memo: log.memo || '',
                startMin,
                hour: hourOf(startMin)
            });
        });
        return blocks.sort((a, b) => a.startMin - b.startMin);
    }

    return {
        DEFAULT_SETTINGS, DAY_LABELS,
        getSettings, saveSettings,
        toMin, toHHMM,
        mondayOf, weekDays, logsForDay,
        groupCatOf, labelOf, startMinOf, hourOf, buildDayBlocks
    };
})();
