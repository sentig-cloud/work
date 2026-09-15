// work_timetable.js
// 주간 시간표 뷰 — 순수 데이터 로직(시간 계산, 주 범위, 겹침 분할).
// window.logs를 그대로 읽기만 하고, 새 컬렉션/스키마는 만들지 않는다.

window.WorkTimetable = (() => {
    const SETTINGS_KEY = 'wm_timetable_settings';
    const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'];
    const DEFAULT_SETTINGS = {
        categories: { work: true, commute: true, memo: false },
        defaultView: 'month', // 'month' | 'timetable'
        gridUnit: 30 // 15 | 30 | 60 (분)
    };

    function getSettings() {
        let saved = {};
        try { saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); } catch (_) { saved = {}; }
        const gridUnit = [15, 30, 60].includes(Number(saved.gridUnit)) ? Number(saved.gridUnit) : DEFAULT_SETTINGS.gridUnit;
        return {
            categories: { ...DEFAULT_SETTINGS.categories, ...(saved.categories || {}) },
            defaultView: saved.defaultView === 'timetable' ? 'timetable' : 'month',
            gridUnit
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

    function snapToGrid(min, gridUnit) {
        return Math.round(min / gridUnit) * gridUnit;
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

    // 로그 1건 -> {startMin, endMin, isRange} 또는 null(시간 정보 없어 제외)
    function timeRangeOf(log, gridUnit) {
        if (log.cat === 'work') {
            const s = toMin(log.startTime);
            const e = toMin(log.endTime);
            if (s !== null && e !== null && e > s) return { startMin: s, endMin: e, isRange: true };
            const point = s !== null ? s : toMin(log.workTime || log.time);
            if (point === null) return null;
            return { startMin: point, endMin: Math.min(24 * 60, point + gridUnit), isRange: false };
        }
        const point = toMin(log.time) !== null ? toMin(log.time) : toMin(log.workTime);
        if (point === null) return null;
        return { startMin: point, endMin: Math.min(24 * 60, point + gridUnit), isRange: false };
    }

    // 겹치는 블록끼리 lane(가로 분할 슬롯)을 배정하는 고전적 interval partitioning
    function assignLanes(blocks) {
        const sorted = [...blocks].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
        const active = []; // {endMin, lane}
        sorted.forEach(block => {
            for (let i = active.length - 1; i >= 0; i--) {
                if (active[i].endMin <= block.startMin) active.splice(i, 1);
            }
            const usedLanes = new Set(active.map(a => a.lane));
            let lane = 0;
            while (usedLanes.has(lane)) lane++;
            block.lane = lane;
            active.push({ endMin: block.endMin, lane });
        });
        sorted.forEach(block => {
            const overlapping = sorted.filter(o => o.startMin < block.endMin && o.endMin > block.startMin);
            block.laneCount = overlapping.reduce((max, o) => Math.max(max, o.lane + 1), 1);
        });
        return sorted;
    }

    function buildDayBlocks(logs, date, settings) {
        const dayLogs = logsForDay(logs, date);
        const blocks = [];
        dayLogs.forEach(log => {
            const groupCat = groupCatOf(log);
            if (!settings.categories[groupCat]) return;
            const range = timeRangeOf(log, settings.gridUnit);
            if (!range) return;
            blocks.push({
                logId: log.id,
                cat: log.cat,
                groupCat,
                label: labelOf(log),
                completed: log.status === '완료',
                taskNo: log.taskNo || '',
                address: log.address || '',
                memo: log.memo || '',
                startMin: range.startMin,
                endMin: range.endMin,
                isRange: range.isRange
            });
        });
        return assignLanes(blocks);
    }

    return {
        DEFAULT_SETTINGS, DAY_LABELS,
        getSettings, saveSettings,
        toMin, toHHMM, snapToGrid,
        mondayOf, weekDays, logsForDay,
        groupCatOf, labelOf, timeRangeOf, assignLanes, buildDayBlocks
    };
})();
