// work_timetable_ui.js
// 주간 시간표 뷰 — 렌더링/드래그/팝오버/설정 패널.
// window.logs / window.saveToLocalStore / window.openWorkModal / window.openEditModal 등
// 기존 파이프라인을 그대로 재사용하고, 새 렌더러만 추가한다.

(() => {
    const WT = window.WorkTimetable;
    const DRAG_THRESHOLD = 6; // 이 이하 이동은 탭(클릭)으로 취급
    const UNDO_MS = 3000;
    const BASE_START_MIN = 9 * 60;  // 기본 표시 범위: 09:00
    const BASE_END_MIN = 18 * 60;   // 기본 표시 범위: 18:00
    const MIN_PPM = 0.6;            // 분당 최소 px (이보다 좁아지면 스크롤 발생)
    const FOOTER_SAFE_PAD = 120;    // .tt-scroll의 padding-bottom과 맞춘 값(.footer-nav 오버레이 회피)

    let active = false;
    let userToggled = false;
    let currentMonday = null;
    let dragCtx = null;
    let lastUndo = null;
    let undoTimer = null;
    // 마지막으로 렌더링한 주의 시간 범위/스케일 — 드래그 계산과 클릭(겹침 판정)이 재사용한다.
    let currentRange = { rangeStart: BASE_START_MIN, rangeEnd: BASE_END_MIN, ppm: MIN_PPM };

    function escapeHtml(str) {
        return String(str == null ? '' : str).replace(/[&<>"']/g, ch => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[ch]));
    }

    function daysInMonthOf(y, m) { return new Date(y, m, 0).getDate(); }

    function copyToClipboard(text, sourceEl) {
        if (!text) return;
        const flash = () => {
            if (!sourceEl) return;
            sourceEl.classList.add('tt-copied-flash');
            setTimeout(() => sourceEl.classList.remove('tt-copied-flash'), 500);
        };
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text).then(flash).catch(() => fallbackCopy(text, flash));
        } else {
            fallbackCopy(text, flash);
        }
    }
    function fallbackCopy(text, onDone) {
        try {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            if (onDone) onDone();
        } catch (_) { /* noop */ }
    }

    // 날짜(년/월/일 로컬)가 한국 공휴일/일요일이면 --sun, 토요일이면 --sat, 그 외는 기본 검정
    function dayHeaderColor(date) {
        const ds = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
        const isHoliday = !!(window.holidays && window.holidays[ds]);
        const dow = date.getDay();
        if (isHoliday || dow === 0) return 'var(--sun)';
        if (dow === 6) return 'var(--sat)';
        return 'var(--w-black)';
    }

    // 09:00~18:00을 기본으로 하되, 그 범위를 벗어나는 일정이 있으면 정시 단위로 넓힌다.
    function computeWeekRange(days, settings) {
        let rangeStart = BASE_START_MIN, rangeEnd = BASE_END_MIN;
        days.forEach(d => {
            WT.buildDayBlocks(window.logs || [], d, settings).forEach(b => {
                if (b.startMin < rangeStart) rangeStart = b.startMin;
                if (b.endMin > rangeEnd) rangeEnd = b.endMin;
            });
        });
        rangeStart = Math.max(0, Math.floor(rangeStart / 60) * 60);
        rangeEnd = Math.min(24 * 60, Math.ceil(rangeEnd / 60) * 60);
        return { rangeStart, rangeEnd };
    }

    // ─── DOM 준비 (최초 1회) ───
    function ensureAreaDom() {
        if (document.getElementById('timetableArea')) return;
        const contentArea = document.getElementById('popContentArea');
        if (!contentArea) return;

        const area = document.createElement('div');
        area.id = 'timetableArea';
        area.className = 'timetable-area';
        area.innerHTML = `
            <div class="tt-nav w95-out">
                <button type="button" class="w95-btn icon-btn" id="ttPrevWeekBtn" title="이전 주"><i class="fa-solid fa-chevron-left"></i></button>
                <span id="ttWeekLabel" class="tt-week-label"></span>
                <button type="button" class="w95-btn icon-btn" id="ttNextWeekBtn" title="다음 주"><i class="fa-solid fa-chevron-right"></i></button>
                <button type="button" class="w95-btn icon-btn" id="ttSettingsBtn" style="margin-left:auto;" title="시간표 설정"><i class="fa-solid fa-gear"></i></button>
            </div>
            <div class="tt-header-row" id="ttHeaderRow"></div>
            <div class="tt-scroll" id="ttScroll">
                <div class="tt-body" id="ttBody"></div>
            </div>
            <div id="ttUndoToast" class="tt-undo-toast" style="display:none;">
                <span id="ttUndoText"></span>
                <button type="button" class="w95-btn" id="ttUndoBtn">되돌리기</button>
            </div>
        `;
        contentArea.appendChild(area);

        document.getElementById('ttPrevWeekBtn').addEventListener('click', () => shiftWeek(-1));
        document.getElementById('ttNextWeekBtn').addEventListener('click', () => shiftWeek(1));
        document.getElementById('ttSettingsBtn').addEventListener('click', openSettingsModal);
        document.getElementById('ttUndoBtn').addEventListener('click', undoLastChange);

        const body = document.getElementById('ttBody');
        body.addEventListener('pointerdown', onBodyPointerDown);
    }

    function ensurePopoverDom() {
        if (document.getElementById('ttPopover')) return;
        const pop = document.createElement('div');
        pop.id = 'ttPopover';
        pop.className = 'tt-popover w95-window';
        pop.innerHTML = `
            <div class="w95-titlebar tt-popover-titlebar">
                <span id="ttPopoverTitle"></span>
                <button type="button" class="w95-btn" id="ttPopoverCloseBtn">X</button>
            </div>
            <div class="tt-popover-body" id="ttPopoverBody"></div>
            <div class="tt-popover-actions">
                <button type="button" class="w95-btn" id="ttPopoverDetailBtn" style="flex:1; font-weight:bold; color:var(--w-blue);">자세히 보기</button>
            </div>
        `;
        document.body.appendChild(pop);
        document.getElementById('ttPopoverCloseBtn').addEventListener('click', hidePopover);
        document.addEventListener('pointerdown', e => {
            const popEl = document.getElementById('ttPopover');
            if (!popEl || popEl.style.display === 'none') return;
            if (popEl.contains(e.target) || e.target.closest('.tt-block')) return;
            hidePopover();
        });
    }

    function ensureSettingsModalDom() {
        if (document.getElementById('ttSettingsModal')) return;
        const modal = document.createElement('div');
        modal.id = 'ttSettingsModal';
        modal.className = 'modal-overlay';
        modal.style.zIndex = '2650';
        modal.innerHTML = `
            <div class="modal-box w95-window" style="max-width:280px;">
                <div class="w95-titlebar"><span>메인 설정</span><button type="button" class="w95-btn" id="ttSettingsCloseBtn">X</button></div>
                <div class="tt-settings-body">
                    <div class="tt-settings-section">
                        <div class="tt-settings-label">타임테이블에 표시</div>
                        <label class="tt-settings-check"><input type="checkbox" id="ttOptCatWork"> 작업</label>
                        <label class="tt-settings-check"><input type="checkbox" id="ttOptCatCommute"> 출퇴근</label>
                        <label class="tt-settings-check"><input type="checkbox" id="ttOptCatMemo"> 메모/사진</label>
                    </div>
                    <div class="tt-settings-section">
                        <div class="tt-settings-label">기본 진입 뷰</div>
                        <label class="tt-settings-check"><input type="radio" name="ttDefaultView" id="ttOptViewMonth" value="month"> 월간 달력</label>
                        <label class="tt-settings-check"><input type="radio" name="ttDefaultView" id="ttOptViewTimetable" value="timetable"> 주간 시간표</label>
                    </div>
                    <div class="tt-settings-section">
                        <div class="tt-settings-label">그리드 단위</div>
                        <label class="tt-settings-check"><input type="radio" name="ttGridUnit" id="ttOptGrid15" value="15"> 15분</label>
                        <label class="tt-settings-check"><input type="radio" name="ttGridUnit" id="ttOptGrid30" value="30"> 30분</label>
                        <label class="tt-settings-check"><input type="radio" name="ttGridUnit" id="ttOptGrid60" value="60"> 60분</label>
                    </div>
                </div>
                <div class="modal-footer" style="padding:6px; background:var(--w-gray);">
                    <button type="button" class="w95-btn" id="ttSettingsSaveBtn" style="width:100%; height:32px; font-weight:bold; color:var(--w-blue);">저장</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        document.getElementById('ttSettingsCloseBtn').addEventListener('click', closeSettingsModal);
        document.getElementById('ttSettingsSaveBtn').addEventListener('click', saveSettingsFromModal);
    }

    function openSettingsModal() {
        ensureSettingsModalDom();
        const s = WT.getSettings();
        document.getElementById('ttOptCatWork').checked = !!s.categories.work;
        document.getElementById('ttOptCatCommute').checked = !!s.categories.commute;
        document.getElementById('ttOptCatMemo').checked = !!s.categories.memo;
        document.getElementById(s.defaultView === 'timetable' ? 'ttOptViewTimetable' : 'ttOptViewMonth').checked = true;
        document.getElementById(`ttOptGrid${s.gridUnit}`).checked = true;
        document.getElementById('ttSettingsModal').style.display = 'flex';
    }
    function closeSettingsModal() {
        const modal = document.getElementById('ttSettingsModal');
        if (modal) modal.style.display = 'none';
    }
    function saveSettingsFromModal() {
        const gridUnitEl = document.querySelector('input[name="ttGridUnit"]:checked');
        const viewEl = document.querySelector('input[name="ttDefaultView"]:checked');
        WT.saveSettings({
            categories: {
                work: document.getElementById('ttOptCatWork').checked,
                commute: document.getElementById('ttOptCatCommute').checked,
                memo: document.getElementById('ttOptCatMemo').checked
            },
            defaultView: viewEl ? viewEl.value : 'month',
            gridUnit: gridUnitEl ? Number(gridUnitEl.value) : 30
        });
        closeSettingsModal();
        if (active) renderWeek();
    }

    // ─── 활성화/비활성화 ───
    function computeBaseMonday() {
        const y = window.currentYear;
        const m = window.curMonth;
        const d = Math.min(window.curDay || 1, daysInMonthOf(y, m));
        return WT.mondayOf(new Date(y, m - 1, d));
    }

    function activate() {
        ensureAreaDom();
        ensurePopoverDom();
        currentMonday = computeBaseMonday();
        active = true;
        document.getElementById('popContentArea')?.classList.add('timetable-mode');
        const toggleBtn = document.getElementById('timetableToggleBtn');
        if (toggleBtn) toggleBtn.classList.add('active-btn');
        renderWeek();
    }

    function deactivate() {
        active = false;
        document.getElementById('popContentArea')?.classList.remove('timetable-mode');
        const toggleBtn = document.getElementById('timetableToggleBtn');
        if (toggleBtn) toggleBtn.classList.remove('active-btn');
        hidePopover();
    }

    function toggleTimetableView() {
        userToggled = true;
        if (active) deactivate(); else activate();
    }

    // openPop()이 새 달을 열 때, 사용자가 아직 수동으로 토글한 적이 없다면
    // "기본 진입 뷰" 설정을 그대로 따른다. 한 번이라도 수동 토글했다면 이후에는
    // 매번 설정값으로 되돌리지 않고 사용자가 마지막으로 선택한 모드를 유지한다.
    function onPopOpened() {
        const settings = WT.getSettings();
        if (!userToggled) {
            if (settings.defaultView === 'timetable') activate(); else deactivate();
        } else if (active) {
            activate();
        }
    }

    function shiftWeek(delta) {
        if (!currentMonday) currentMonday = computeBaseMonday();
        const d = new Date(currentMonday);
        d.setDate(d.getDate() + delta * 7);
        currentMonday = d;
        renderWeek();
    }

    // ─── 렌더링 ───
    function renderWeek() {
        if (!active) return;
        ensureAreaDom();
        const settings = WT.getSettings();
        const days = WT.weekDays(currentMonday);
        const today = new Date();

        const { rangeStart, rangeEnd } = computeWeekRange(days, settings);
        const totalRange = rangeEnd - rangeStart;

        // .tt-scroll 자체 높이는 컨텐츠와 무관하게 flex 레이아웃으로 정해지므로,
        // 본문을 새로 그리기 전에 먼저 측정해서 "한 화면에 맞는" 배율을 계산한다.
        const scrollEl = document.getElementById('ttScroll');
        const availableHeight = Math.max(200, (scrollEl?.clientHeight || 500) - FOOTER_SAFE_PAD);
        const ppm = Math.max(MIN_PPM, availableHeight / totalRange);
        const dayHeight = totalRange * ppm;
        currentRange = { rangeStart, rangeEnd, ppm, settings };

        const label = `${days[0].getFullYear()}.${String(days[0].getMonth() + 1).padStart(2, '0')}.${String(days[0].getDate()).padStart(2, '0')} ~ ${String(days[6].getMonth() + 1).padStart(2, '0')}.${String(days[6].getDate()).padStart(2, '0')}`;
        const weekLabelEl = document.getElementById('ttWeekLabel');
        if (weekLabelEl) weekLabelEl.textContent = label;

        // 헤더 (요일/날짜 색상은 공휴일·주말 기준, 탭하면 그 날짜로 이동)
        const headerRow = document.getElementById('ttHeaderRow');
        if (headerRow) {
            headerRow.innerHTML = `<div class="tt-time-col-header"></div>` + days.map((d, i) => {
                const isToday = d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
                const isSelected = d.getFullYear() === window.currentYear && d.getMonth() + 1 === window.curMonth && d.getDate() === window.curDay;
                const color = dayHeaderColor(d);
                return `<div class="tt-day-header${isToday ? ' is-today' : ''}${isSelected ? ' is-selected' : ''}" data-day-idx="${i}">
                    <div class="tt-day-name" style="color:${color};">${WT.DAY_LABELS[i]}</div>
                    <div class="tt-day-date" style="color:${color};">${d.getDate()}</div>
                </div>`;
            }).join('');
            headerRow.querySelectorAll('.tt-day-header').forEach(el => {
                el.addEventListener('click', () => onDayHeaderClick(days[Number(el.dataset.dayIdx)]));
            });
        }

        // 시간 라벨 / 정시 구분선 (표시 범위 안에서만)
        let timeLabelsHtml = '';
        let hourLinesHtml = '';
        for (let m = rangeStart; m <= rangeEnd; m += 60) {
            timeLabelsHtml += `<div class="tt-time-label" style="top:${(m - rangeStart) * ppm}px;">${String(Math.floor(m / 60)).padStart(2, '0')}:00</div>`;
            if (m > rangeStart && m < rangeEnd) hourLinesHtml += `<div class="tt-hour-line" style="top:${(m - rangeStart) * ppm}px;"></div>`;
        }

        // 요일 컬럼
        const dayColsHtml = days.map((d, dayIdx) => {
            const blocks = WT.buildDayBlocks(window.logs || [], d, settings);
            const blocksHtml = blocks.map(b => renderBlockHtml(b, ppm, rangeStart)).join('');
            return `<div class="tt-day-col" data-day-idx="${dayIdx}" style="height:${dayHeight}px;">${hourLinesHtml}${blocksHtml}</div>`;
        }).join('');

        const body = document.getElementById('ttBody');
        if (body) {
            body.style.height = `${dayHeight}px`;
            body.innerHTML = `<div class="tt-time-col" style="height:${dayHeight}px;">${timeLabelsHtml}</div>${dayColsHtml}`;
        }

        // 09:00이 기본으로 화면 맨 위에 오도록 — 그보다 이른 일정이 있어 범위가 늘어난 만큼만 스크롤이 생긴다.
        if (scrollEl) scrollEl.scrollTop = Math.max(0, (BASE_START_MIN - rangeStart) * ppm);
    }

    function onDayHeaderClick(date) {
        window.currentYear = date.getFullYear();
        window.curMonth = date.getMonth() + 1;
        window.curDay = date.getDate();
        const monthLabelEl = document.getElementById('monthLabel');
        if (monthLabelEl) monthLabelEl.innerText = `${window.curMonth}월`;
        if (window.renderCal) window.renderCal(window.currentYear, window.curMonth - 1);
        renderWeek();
    }

    function renderBlockHtml(b, ppm, rangeStart) {
        const top = (b.startMin - rangeStart) * ppm;
        const height = Math.max(16, (b.endMin - b.startMin) * ppm);
        const width = 100 / b.laneCount;
        const left = b.lane * width;
        const classes = ['tt-block', `cat-${b.cat}`, `group-${b.groupCat}`];
        if (b.completed) classes.push('is-completed');
        return `<div class="${classes.join(' ')}" data-log-id="${escapeHtml(b.logId)}" data-is-range="${b.isRange ? '1' : '0'}"
            style="top:${top}px; height:${height}px; left:${left}%; width:calc(${width}% - 2px);">
            <div class="tt-block-label">${escapeHtml(b.label)}</div>
            ${b.isRange ? '<div class="tt-resize-handle"></div>' : ''}
        </div>`;
    }

    // ─── 드래그(이동) / 리사이즈 ───
    function onBodyPointerDown(e) {
        const handle = e.target.closest('.tt-resize-handle');
        const blockEl = e.target.closest('.tt-block');
        if (!blockEl) return;

        const logId = blockEl.dataset.logId;
        const log = (window.logs || []).find(l => String(l.id) === String(logId));
        if (!log) return;

        const settings = currentRange.settings || WT.getSettings();
        const ppm = currentRange.ppm;
        // 짧은 블록은 화면 표시상 최소 높이로 늘려 그리므로, DOM 크기가 아니라
        // 로그의 실제 시간값에서 시작/종료(분)를 다시 계산해야 정확하다.
        const range = WT.timeRangeOf(log, settings.gridUnit);
        if (!range) return;
        const startMin = range.startMin;
        const endMin = range.endMin;
        const dayColEl = blockEl.closest('.tt-day-col');
        const dayIdx = dayColEl ? Number(dayColEl.dataset.dayIdx) : 0;

        dragCtx = {
            mode: handle ? 'resize' : 'move',
            logId,
            cat: log.cat,
            groupCat: WT.groupCatOf(log),
            isRange: range.isRange,
            origStartMin: startMin,
            origEndMin: endMin,
            origDayIdx: dayIdx,
            startClientX: e.clientX,
            startClientY: e.clientY,
            moved: 0,
            settings,
            ppm,
            rangeStart: currentRange.rangeStart,
            rangeEnd: currentRange.rangeEnd,
            blockEl
        };

        blockEl.classList.add('is-dragging');
        try { blockEl.setPointerCapture(e.pointerId); } catch (_) { /* noop */ }

        window.addEventListener('pointermove', onBodyPointerMove);
        window.addEventListener('pointerup', onBodyPointerUp, { once: true });
        window.addEventListener('pointercancel', onBodyPointerCancel, { once: true });

        ensureDragIndicatorDom();
        e.preventDefault();
    }

    function ensureDragIndicatorDom() {
        if (document.getElementById('ttDragIndicator')) return;
        const ind = document.createElement('div');
        ind.id = 'ttDragIndicator';
        ind.className = 'tt-drag-indicator';
        ind.style.display = 'none';
        document.body.appendChild(ind);
    }

    function onBodyPointerMove(e) {
        if (!dragCtx) return;
        const deltaX = e.clientX - dragCtx.startClientX;
        const deltaY = e.clientY - dragCtx.startClientY;
        dragCtx.moved = Math.max(dragCtx.moved, Math.abs(deltaX), Math.abs(deltaY));

        const deltaMinRaw = deltaY / dragCtx.ppm;
        const deltaMinSnapped = WT.snapToGrid(deltaMinRaw, dragCtx.settings.gridUnit);

        let newStartMin = dragCtx.origStartMin;
        let newEndMin = dragCtx.origEndMin;
        let dayIdx = dragCtx.origDayIdx;

        if (dragCtx.mode === 'resize') {
            newEndMin = Math.max(dragCtx.origStartMin + dragCtx.settings.gridUnit, Math.min(dragCtx.rangeEnd, dragCtx.origEndMin + deltaMinSnapped));
        } else {
            const duration = dragCtx.origEndMin - dragCtx.origStartMin;
            newStartMin = Math.max(dragCtx.rangeStart, Math.min(dragCtx.rangeEnd - duration, dragCtx.origStartMin + deltaMinSnapped));
            newEndMin = newStartMin + duration;

            const under = document.elementFromPoint(e.clientX, e.clientY);
            const dayColEl = under ? under.closest('.tt-day-col') : null;
            if (dayColEl) dayIdx = Number(dayColEl.dataset.dayIdx);
        }

        dragCtx.previewStartMin = newStartMin;
        dragCtx.previewEndMin = newEndMin;
        dragCtx.previewDayIdx = dayIdx;

        const days = WT.weekDays(currentMonday);
        const targetDate = days[dayIdx];
        const dayLabel = `${WT.DAY_LABELS[dayIdx]}(${targetDate.getDate()}일)`;
        const timeLabel = dragCtx.mode === 'resize'
            ? `~ ${WT.toHHMM(newEndMin)}`
            : `${dayLabel} ${WT.toHHMM(newStartMin)} ~ ${WT.toHHMM(newEndMin)}`;

        const ind = document.getElementById('ttDragIndicator');
        if (ind) {
            ind.style.display = 'block';
            ind.style.left = `${e.clientX + 14}px`;
            ind.style.top = `${e.clientY + 14}px`;
            ind.textContent = timeLabel;
        }
    }

    function onBodyPointerCancel() {
        cleanupDrag();
    }

    function onBodyPointerUp() {
        const ctx = dragCtx;
        cleanupDrag();
        if (!ctx) return;

        if (ctx.moved < DRAG_THRESHOLD) {
            onBlockTap(ctx.logId, ctx.blockEl, ctx.origDayIdx);
            return;
        }

        if (ctx.previewStartMin == null) return;

        if (ctx.mode === 'resize') {
            commitChange(ctx.logId, buildResizePatch(ctx), null, ctx.cat);
        } else {
            const days = WT.weekDays(currentMonday);
            const targetDate = days[ctx.previewDayIdx];
            const dayChanged = ctx.previewDayIdx !== ctx.origDayIdx;
            commitChange(ctx.logId, buildMovePatch(ctx), dayChanged ? targetDate : null, ctx.cat);
        }
    }

    function cleanupDrag() {
        window.removeEventListener('pointermove', onBodyPointerMove);
        if (dragCtx && dragCtx.blockEl) dragCtx.blockEl.classList.remove('is-dragging');
        const ind = document.getElementById('ttDragIndicator');
        if (ind) ind.style.display = 'none';
        dragCtx = null;
    }

    function buildMovePatch(ctx) {
        const newStart = ctx.previewStartMin, newEnd = ctx.previewEndMin;
        if (ctx.groupCat === 'work' && ctx.isRange) {
            return { startTime: WT.toHHMM(newStart), endTime: WT.toHHMM(newEnd) };
        }
        if (ctx.cat === 'work') return { workTime: WT.toHHMM(newStart) };
        if (ctx.cat === 'commute_in') { const t = WT.toHHMM(newStart); return { time: t, inTime: t }; }
        if (ctx.cat === 'commute_out') { const t = WT.toHHMM(newStart); return { time: t, outTime: t }; }
        return { time: WT.toHHMM(newStart) };
    }

    function buildResizePatch(ctx) {
        return { endTime: WT.toHHMM(ctx.previewEndMin) };
    }

    function commitChange(logId, patch, targetDate, cat) {
        const log = (window.logs || []).find(l => String(l.id) === String(logId));
        if (!log) return;

        const trackedFields = ['y', 'm', 'd', 'startTime', 'endTime', 'workTime', 'time', 'inTime', 'outTime'];
        const prevFields = {};
        trackedFields.forEach(f => { prevFields[f] = log[f]; });

        const updated = { ...log, ...patch };
        const origY = log.y, origM = log.m, origD = log.d;
        if (targetDate) {
            updated.y = targetDate.getFullYear();
            updated.m = targetDate.getMonth() + 1;
            updated.d = targetDate.getDate();
        }

        window.saveToLocalStore('logs', updated);

        if ((cat === 'commute_in' || cat === 'commute_out') && window.updateCommuteDetailByDate) {
            window.updateCommuteDetailByDate(updated.y, updated.m, updated.d);
            if (targetDate) window.updateCommuteDetailByDate(origY, origM, origD);
        }

        lastUndo = { logId, prevFields };
        showUndoToast();
    }

    function showUndoToast() {
        clearTimeout(undoTimer);
        const toast = document.getElementById('ttUndoToast');
        const text = document.getElementById('ttUndoText');
        if (!toast) return;
        if (text) text.textContent = '일정을 변경했습니다.';
        toast.style.display = 'flex';
        undoTimer = setTimeout(() => { toast.style.display = 'none'; lastUndo = null; }, UNDO_MS);
    }

    function undoLastChange() {
        if (!lastUndo) return;
        const log = (window.logs || []).find(l => String(l.id) === String(lastUndo.logId));
        if (log) {
            const restored = { ...log, ...lastUndo.prevFields };
            window.saveToLocalStore('logs', restored);
        }
        clearTimeout(undoTimer);
        const toast = document.getElementById('ttUndoToast');
        if (toast) toast.style.display = 'none';
        lastUndo = null;
    }

    // ─── 팝오버(1단계 미리보기) ───
    // 블록 탭 시: 같은 시간대에 겹치는 항목이 여럿이면 먼저 목록으로 보여주고,
    // 단일 항목이면 바로 상세 미리보기(이름/Task No/주소)로 간다.
    function onBlockTap(logId, blockEl, dayIdx) {
        const settings = WT.getSettings();
        const days = WT.weekDays(currentMonday);
        const date = days[dayIdx];
        if (!date) { showPopoverForLog(logId, blockEl); return; }
        const dayBlocks = WT.buildDayBlocks(window.logs || [], date, settings);
        const tapped = dayBlocks.find(b => b.logId === logId);
        if (!tapped) { showPopoverForLog(logId, blockEl); return; }
        const group = dayBlocks.filter(b => b.startMin < tapped.endMin && b.endMin > tapped.startMin);
        if (group.length > 1) showListPopover(group, blockEl);
        else showPopoverForLog(logId, blockEl);
    }

    // 겹치는 시간대의 항목 목록 — 타이틀바는 이름 대신 시간 범위를 보여준다.
    function showListPopover(group, blockEl) {
        ensurePopoverDom();
        const sorted = [...group].sort((a, b) => a.startMin - b.startMin);
        const minStart = Math.min(...sorted.map(b => b.startMin));
        const maxEnd = Math.max(...sorted.map(b => b.endMin));

        const titleEl = document.getElementById('ttPopoverTitle');
        titleEl.textContent = `${WT.toHHMM(minStart)} ~ ${WT.toHHMM(maxEnd)} (${sorted.length}건)`;
        titleEl.classList.remove('tt-copyable');
        titleEl.onclick = null;

        const bodyEl = document.getElementById('ttPopoverBody');
        bodyEl.innerHTML = '';
        bodyEl.classList.add('tt-popover-list');
        sorted.forEach(b => {
            const row = document.createElement('div');
            row.className = 'tt-popover-list-item';
            const label = document.createElement('span');
            label.className = 'tt-popover-list-label' + (b.completed ? ' is-completed' : '');
            label.textContent = b.label;
            const time = document.createElement('span');
            time.className = 'tt-popover-list-time';
            time.textContent = WT.toHHMM(b.startMin);
            row.appendChild(label);
            row.appendChild(time);
            row.addEventListener('click', () => showPopoverForLog(b.logId, blockEl));
            bodyEl.appendChild(row);
        });

        document.getElementById('ttPopoverDetailBtn').style.display = 'none';

        const pop = document.getElementById('ttPopover');
        pop.style.display = 'block';
        positionPopover(pop, blockEl);
    }

    function showPopoverForLog(logId, blockEl) {
        const log = (window.logs || []).find(l => String(l.id) === String(logId));
        if (!log) return;
        ensurePopoverDom();

        const groupCat = WT.groupCatOf(log);
        const title = WT.labelOf(log);

        const titleEl = document.getElementById('ttPopoverTitle');
        titleEl.textContent = title;
        titleEl.classList.add('tt-copyable');
        titleEl.onclick = () => copyToClipboard(title, titleEl);

        const bodyEl = document.getElementById('ttPopoverBody');
        bodyEl.classList.remove('tt-popover-list');
        bodyEl.innerHTML = '';

        const addLine = (labelText, valueText, copyable) => {
            const line = document.createElement('div');
            line.className = 'tt-popover-line';
            const b = document.createElement('b');
            b.textContent = labelText;
            const span = document.createElement('span');
            span.textContent = valueText || '-';
            if (copyable && valueText) {
                span.classList.add('tt-copyable');
                span.onclick = () => copyToClipboard(valueText, span);
            }
            line.appendChild(b);
            line.appendChild(span);
            bodyEl.appendChild(line);
            return line;
        };

        if (groupCat === 'work') {
            addLine('Task No', log.taskNo, true);
            const addrLine = addLine('주소', log.address, true);
            addrLine.classList.add('tt-popover-address');
            if (log.address) addrLine.title = log.address;
            if (log.status) addLine('상태', log.status, false);
        } else if (groupCat === 'commute') {
            addLine(log.cat === 'commute_in' ? '출근' : '퇴근', log.time, false);
            if (log.commuteNote) addLine('메모', log.commuteNote, false);
        } else {
            addLine('메모', log.memo, false);
        }

        const detailBtn = document.getElementById('ttPopoverDetailBtn');
        detailBtn.style.display = '';
        detailBtn.onclick = () => {
            hidePopover();
            window.handleCardClick(log.id, log.cat);
        };

        const pop = document.getElementById('ttPopover');
        pop.style.display = 'block';
        positionPopover(pop, blockEl);
    }

    function positionPopover(pop, anchorEl) {
        const rect = anchorEl.getBoundingClientRect();
        const popW = 220, popH = pop.offsetHeight || 140;
        let left = rect.right + 8;
        let top = rect.top;
        const safeBottom = window.innerHeight - 130; // .footer-nav(하단 고정 오버레이)와 겹치지 않도록
        if (left + popW > window.innerWidth) left = Math.max(4, rect.left - popW - 8);
        if (top + popH > safeBottom) top = Math.max(4, safeBottom - popH);
        pop.style.left = `${left}px`;
        pop.style.top = `${top}px`;
    }

    function hidePopover() {
        const pop = document.getElementById('ttPopover');
        if (pop) pop.style.display = 'none';
    }

    // 메인 화면 아이콘 등, 팝업 밖에서 곧바로 오늘 기준 주간 시간표로 진입한다.
    function goToWeeklyTimetable() {
        userToggled = true;
        const now = new Date();
        window.currentYear = now.getFullYear();
        window.curDay = now.getDate();
        window.openPop(now.getMonth() + 1);
        activate();
    }

    // ─── 외부 훅 ───
    window.toggleTimetableView = toggleTimetableView;
    window.goToWeeklyTimetable = goToWeeklyTimetable;

    window.WorkTimetableUI = {
        activate, deactivate, renderWeek, shiftWeek,
        refresh() { if (active) renderWeek(); },
        isActive() { return active; }
    };

    function installHooks() {
        const originalOpenPop = window.openPop;
        if (typeof originalOpenPop === 'function') {
            window.openPop = function (month) {
                const result = originalOpenPop(month);
                onPopOpened();
                return result;
            };
        }

        const originalRefresh = window.refreshCurrentUI;
        if (typeof originalRefresh === 'function') {
            window.refreshCurrentUI = function () {
                originalRefresh();
                window.WorkTimetableUI.refresh();
            };
        }

        const originalClosePop = window.closePop;
        if (typeof originalClosePop === 'function') {
            window.closePop = function () {
                hidePopover();
                cleanupDrag();
                return originalClosePop();
            };
        }
    }

    installHooks();
})();
