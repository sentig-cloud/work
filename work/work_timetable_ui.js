// work_timetable_ui.js
// 주간 시간표 뷰 — 렌더링/드래그/팝오버/설정 패널.
// window.logs / window.saveToLocalStore / window.openWorkModal / window.openEditModal 등
// 기존 파이프라인을 그대로 재사용하고, 새 렌더러만 추가한다.
//
// 표시 모델: 정시(hour) 단위 행 × 요일 열의 표. 각 칸 안에 그 시간대(예: 15:00~15:59)
// 일정들을 시간순으로 세로로 쌓는다(겹침 레인 없음). 칸 높이는 CSS flex가 내용물에 맞춰
// 자동으로 늘어나므로 별도 픽셀 계산이 필요 없다.

(() => {
    const WT = window.WorkTimetable;
    const MOVE_SLOP_PX = 10; // 롱프레스 완성 전에 이만큼 움직이면 스크롤 의도로 본다
    const LONG_PRESS_MS = 420; // 이만큼 눌러야 드래그 이동이 시작된다(그 전엔 스크롤 우선)
    const UNDO_MS = 3000;
    const BASE_MIN_HOUR = 9;  // 기본 표시 범위 시작: 09시
    const BASE_MAX_HOUR = 18; // 기본 표시 범위 끝: 18시
    const HOUR_STEP_PX = { small: 24, medium: 32, large: 44 }; // 표시 범위 밖으로 끌 때 시간당 픽셀(대략)

    let active = false;
    let userToggled = false;
    let currentMonday = null;
    let dragCtx = null;
    let longPressTimer = null;
    let suppressNextClick = false;
    let undoStack = [];
    let redoStack = [];
    let undoTimer = null;

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

    // 09~18시를 기본으로 하되, 그 범위를 벗어나는 일정이 있으면 정시 단위로 넓힌다.
    function computeHourRange(days, settings) {
        let minHour = BASE_MIN_HOUR, maxHour = BASE_MAX_HOUR;
        days.forEach(d => {
            WT.buildDayBlocks(window.logs || [], d, settings).forEach(b => {
                if (b.hour < minHour) minHour = b.hour;
                if (b.hour > maxHour) maxHour = b.hour;
            });
        });
        minHour = Math.max(0, minHour);
        maxHour = Math.min(23, maxHour);
        const hours = [];
        for (let h = minHour; h <= maxHour; h++) hours.push(h);
        return hours;
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
                <span id="ttWeekLabel" class="tt-week-label" title="탭하면 이번 주로 이동"></span>
                <button type="button" class="w95-btn icon-btn" id="ttNextWeekBtn" title="다음 주"><i class="fa-solid fa-chevron-right"></i></button>
                <button type="button" class="w95-btn icon-btn" id="ttUndoNavBtn" style="margin-left:auto;" title="되돌리기" disabled><i class="fa-solid fa-rotate-left"></i></button>
                <button type="button" class="w95-btn icon-btn" id="ttRedoNavBtn" title="다시 실행" disabled><i class="fa-solid fa-rotate-right"></i></button>
                <button type="button" class="w95-btn icon-btn" id="ttSettingsBtn" title="시간표 설정"><i class="fa-solid fa-gear"></i></button>
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
        document.getElementById('ttWeekLabel').addEventListener('click', goToCurrentWeek);
        document.getElementById('ttSettingsBtn').addEventListener('click', openSettingsModal);
        document.getElementById('ttUndoBtn').addEventListener('click', performUndo);
        document.getElementById('ttUndoNavBtn').addEventListener('click', performUndo);
        document.getElementById('ttRedoNavBtn').addEventListener('click', performRedo);

        const body = document.getElementById('ttBody');
        body.addEventListener('pointerdown', onBodyPointerDown);
        body.addEventListener('click', onBodyClick);
    }

    // 빈 칸(일정이 없는 시간대)을 탭하면 그 날짜·시간으로 바로 작업일지/출퇴근/메모를 시작할 수 있다.
    function onBodyClick(e) {
        if (suppressNextClick) { suppressNextClick = false; return; }
        if (e.target.closest('.tt-chip')) return; // 칩 탭은 포인터 로직(onChipTap)이 이미 처리
        const cellEl = e.target.closest('.tt-hour-cell');
        if (!cellEl) return;
        const dayIdx = Number(cellEl.dataset.dayIdx);
        const hour = Number(cellEl.dataset.hour);
        const days = WT.weekDays(currentMonday);
        const date = days[dayIdx];
        if (!date) return;
        showQuickAddPopover(date, hour, cellEl);
    }

    function showQuickAddPopover(date, hour, anchorEl) {
        ensurePopoverDom();
        const timeDigits = `${String(hour).padStart(2, '0')}00`;
        const dow = (date.getDay() + 6) % 7; // getDay: 0=일 → WT.DAY_LABELS는 월=0 시작

        const titleEl = document.getElementById('ttPopoverTitle');
        titleEl.textContent = `${WT.DAY_LABELS[dow]}(${date.getDate()}일) ${String(hour).padStart(2, '0')}:00`;
        titleEl.classList.remove('tt-copyable');
        titleEl.onclick = null;

        const applyDateContext = () => {
            window.currentYear = date.getFullYear();
            window.curMonth = date.getMonth() + 1;
            window.curDay = date.getDate();
        };

        const bodyEl = document.getElementById('ttPopoverBody');
        bodyEl.innerHTML = '';
        bodyEl.classList.add('tt-popover-list');

        const addAction = (label, handler) => {
            const row = document.createElement('div');
            row.className = 'tt-popover-list-item';
            const span = document.createElement('span');
            span.className = 'tt-popover-list-label';
            span.textContent = label;
            row.appendChild(span);
            row.addEventListener('click', () => { hidePopover(); applyDateContext(); handler(); });
            bodyEl.appendChild(row);
        };

        addAction('작업일지 작성', () => {
            window.openWorkModal();
            const timeInput = document.getElementById('workTime');
            if (timeInput) timeInput.value = timeDigits;
        });
        addAction('출근 기록', () => {
            window.openCommuteModal('in');
            const timeInput = document.getElementById('commuteTime');
            if (timeInput) timeInput.value = timeDigits;
        });
        addAction('퇴근 기록', () => {
            window.openCommuteModal('out');
            const timeInput = document.getElementById('commuteTime');
            if (timeInput) timeInput.value = timeDigits;
        });
        addAction('메모 입력', () => {
            const memoInput = document.getElementById('memoIn');
            if (memoInput) memoInput.focus();
        });

        document.getElementById('ttPopoverDetailBtn').style.display = 'none';
        const pop = document.getElementById('ttPopover');
        pop.style.display = 'block';
        positionPopover(pop, anchorEl);
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
            if (popEl.contains(e.target) || e.target.closest('.tt-chip')) return;
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
            <div class="modal-box w95-window ws-box">
                <div class="w95-titlebar ws-titlebar">
                    <button type="button" class="w95-btn ws-back" id="ttSettingsBackBtn" title="메뉴로" hidden><i class="fa-solid fa-chevron-left"></i></button>
                    <span id="ttSettingsTitle">설정</span>
                    <button type="button" class="w95-btn" id="ttSettingsCloseBtn">X</button>
                </div>
                <div class="ws-search-row">
                    <i class="fa-solid fa-magnifying-glass"></i>
                    <input type="search" id="ttSettingsSearch" class="w95-in" placeholder="설정 검색 (예: 복제, 스와이프, 글자)" autocomplete="off" spellcheck="false">
                </div>
                <div class="tt-settings-body ws-body" id="ttSettingsBody">
                    <nav class="ws-menu" id="ttSettingsMenu">
                        <button type="button" class="ws-menu-item" data-go="main"><i class="fa-solid fa-house"></i><span><b>메인 화면</b><small>월별 표시 형식 · 칸 배치 · 전체 누적</small></span><em>›</em></button>
                        <button type="button" class="ws-menu-item" data-go="card"><i class="fa-solid fa-id-card"></i><span><b>작업 카드</b><small>카드 레이아웃 · 복제 · 같은 타스크 묶기</small></span><em>›</em></button>
                        <button type="button" class="ws-menu-item" data-go="input"><i class="fa-solid fa-tags"></i><span><b>작업일지 입력</b><small>선택태그 상자 방식 · 스와이프 · 붙여넣기 · 글 넣기</small></span><em>›</em></button>
                        <button type="button" class="ws-menu-item" data-go="menu"><i class="fa-solid fa-grip"></i><span><b>메뉴 버튼</b><small>윗줄 버튼 고르기 · 순서 · 꾸미기(크기·모양·이름·색)</small></span><em>›</em></button>
                        <button type="button" class="ws-menu-item" data-go="look"><i class="fa-solid fa-palette"></i><span><b>화면 · 디자인</b><small>디자인 개선 · 글자 크기 · 글꼴</small></span><em>›</em></button>
                        <button type="button" class="ws-menu-item" data-go="timetable"><i class="fa-solid fa-table-cells"></i><span><b>주간 시간표</b><small>표시 항목 · 기본 화면 · 크기 · 격자</small></span><em>›</em></button>
                        <button type="button" class="ws-menu-item" data-go="map"><i class="fa-solid fa-route"></i><span><b>지도 · 동선</b><small>기본 지도 앱 · 동선 관리</small></span><em>›</em></button>
                        <button type="button" class="ws-menu-item" data-go="auto"><i class="fa-solid fa-camera"></i><span><b>자동 인식</b><small>출퇴근 사진 OCR</small></span><em>›</em></button>
                        <button type="button" class="ws-menu-item is-new" data-go="labs"><i class="fa-solid fa-flask"></i><span><b>신규 기능</b><small>직접 만든 편의 기능 · 하나씩 켜고 끄기</small></span><em>›</em></button>
                        <button type="button" class="ws-menu-item" data-go="data"><i class="fa-solid fa-file-excel"></i><span><b>내보내기 · 백업</b><small>엑셀 내보내기 · ZIP 백업 · 백업 복원</small></span><em>›</em></button>
                        <button type="button" class="ws-menu-item" data-go="account"><i class="fa-solid fa-user-shield"></i><span><b>계정</b><small>접속 기록 · 계정 전환 · 로그아웃</small></span><em>›</em></button>
                        <button type="button" class="ws-menu-item" data-go="reset"><i class="fa-solid fa-rotate-left"></i><span><b>되돌리기</b><small>이번에 추가된 화면 설정을 원래대로</small></span><em>›</em></button>
                    </nav>

                    <div class="tt-settings-group" data-page="main">
                        <div class="tt-settings-group-title"><i class="fa-solid fa-house"></i> 메인 화면 (1~12월)</div>
                        <div class="tt-settings-section">
                            <div class="tt-settings-label">표시 형식</div>
                            <label class="tt-settings-check"><input type="radio" name="ttMainView" id="ttOptMainViewClassic" value="classic"> 기본 <small>지금까지의 모양</small></label>
                            <label class="tt-settings-check"><input type="radio" name="ttMainView" id="ttOptMainViewDetail" value="detail"> 상세 <small>건수 · 완료율 막대 · 상태 · OT/당직/출근일</small></label>
                            <label class="tt-settings-check"><input type="radio" name="ttMainView" id="ttOptMainViewSummary" value="summary"> 요약 <small>월마다 건수만 크게</small></label>
                        </div>
                        <div class="tt-settings-section">
                            <div class="tt-settings-label">한 줄에 놓을 달 수</div>
                            <div class="ws-seg">
                                <label><input type="radio" name="ttMainCols" id="ttOptMainColsAuto" value="auto"><span>자동</span></label>
                                <label><input type="radio" name="ttMainCols" id="ttOptMainCols2" value="2"><span>2</span></label>
                                <label><input type="radio" name="ttMainCols" id="ttOptMainCols3" value="3"><span>3</span></label>
                                <label><input type="radio" name="ttMainCols" id="ttOptMainCols4" value="4"><span>4</span></label>
                            </div>
                            <div class="ws-desc">자동: 기본·상세는 3칸, 요약은 4칸</div>
                        </div>
                        <div class="tt-settings-section">
                            <div class="tt-settings-label">전체 누적</div>
                            <label class="tt-settings-check"><input type="checkbox" id="ttOptMainYearTotal"> 아래에 올해 전체 누적 표시</label>
                            <label class="tt-settings-check"><input type="checkbox" id="ttOptMainYearStatus"> 누적에 상태별 건수도 표시</label>
                        </div>
                        <div class="tt-settings-section">
                            <div class="tt-settings-label">이번 달</div>
                            <label class="tt-settings-check"><input type="checkbox" id="ttOptMainHighlight"> 이번 달 칸을 테두리로 강조</label>
                        </div>
                    </div>

                    <div class="tt-settings-group" data-page="card">
                        <div class="tt-settings-group-title"><i class="fa-solid fa-id-card"></i> 작업 카드</div>
                        <div class="tt-settings-section">
                            <div class="tt-settings-label">카드 레이아웃</div>
                            <label class="tt-settings-check"><input type="radio" name="ttCardLayout" id="ttOptCardLayoutDefault" value="default"> 기본 <small>카드 꾸미기 자유 배치</small></label>
                            <label class="tt-settings-check"><input type="radio" name="ttCardLayout" id="ttOptCardLayoutSummary" value="summary"> 요약형 <small>시간·상태·타스크 한 줄 + 고객/주소/내용</small></label>
                            <label class="tt-settings-check"><input type="radio" name="ttCardLayout" id="ttOptCardLayoutTimeline" value="timeline"> 타임라인형 <small>왼쪽 시간 줄기 + 오른쪽 내용</small></label>
                            <label class="tt-settings-check"><input type="radio" name="ttCardLayout" id="ttOptCardLayoutMini" value="mini"> 한 줄형 <small>가장 작게, 눌러서 열기</small></label>
                        </div>
                        <div class="tt-settings-section">
                            <div class="tt-settings-label">카드를 길게 눌러 선택했을 때</div>
                            <label class="tt-settings-check"><input type="checkbox" id="ttOptCardDuplicate"> 복제 버튼 <small>날짜·시간을 골라 복제, 달력 날짜를 눌러도 복제</small></label>
                        </div>
                        <div class="tt-settings-section">
                            <div class="tt-settings-label">같은 카드 묶기</div>
                            <label class="tt-settings-check"><input type="checkbox" id="ttOptCardGroupTaskNo"> 타스크 번호(가입번호)가 같은 카드를 한 묶음으로 <small>다른 날짜 카드도 함께 묶고, 보고 있는 날짜 카드를 맨 앞에</small></label>
                        </div>
                    </div>

                    <div class="tt-settings-group" data-page="input">
                        <div class="tt-settings-group-title"><i class="fa-solid fa-tags"></i> 선택태그 상자</div>
                        <div class="tt-settings-section">
                            <div class="tt-settings-label">표시 방식</div>
                            <label class="tt-settings-check"><input type="radio" name="ttTagBoxMode" id="ttOptTagBoxExpanded" value="expanded"> 전부 펼침 <small>모든 그룹의 태그를 펼쳐서 선택</small></label>
                            <label class="tt-settings-check"><input type="radio" name="ttTagBoxMode" id="ttOptTagBoxCompact" value="compact"> 순차 배열 <small>그룹 이름 상자를 누르면 말풍선으로 펼침</small></label>
                            <label class="tt-settings-check"><input type="radio" name="ttTagBoxMode" id="ttOptTagBoxSwipe" value="swipe"> 세로 스와이프 <small>그룹 이름을 누른 채 오른쪽으로 밀다가 떼면 선택</small></label>
                        </div>
                        <div class="tt-settings-section">
                            <div class="tt-settings-label">세로 스와이프</div>
                            <label class="tt-settings-check"><input type="checkbox" id="ttOptSwipePreview"> 밀고 있는 태그를 화면 가운데 위에 크게 표시</label>
                            <label class="tt-settings-check"><input type="checkbox" id="ttOptSwipeLongExclude"> 끝까지 길게 밀면 그 그룹 집계 제외/포함</label>
                            <label class="tt-settings-check"><input type="checkbox" id="ttOptSwipeTitleExclude"> 그룹 이름을 짧게 누르면 집계 제외/포함</label>
                        </div>
                        <div class="tt-settings-section">
                            <div class="tt-settings-label">순차 배열 · 중복 선택 그룹 닫기</div>
                            <label class="tt-settings-check"><input type="radio" name="ttTagBoxClose" id="ttOptTagBoxCloseOutside" value="outside"> 다른 곳을 누르면 확인으로 닫기</label>
                            <label class="tt-settings-check"><input type="radio" name="ttTagBoxClose" id="ttOptTagBoxCloseOk" value="ok"> 확인/취소 버튼으로만 닫기</label>
                        </div>
                    </div>
                    <div class="tt-settings-group" data-page="input">
                        <div class="tt-settings-group-title"><i class="fa-solid fa-keyboard"></i> 입력칸</div>
                        <div class="tt-settings-section">
                            <label class="tt-settings-check"><input type="checkbox" id="ttOptDoubleTapPaste"> 커서를 둔 칸을 더블탭하면 붙여넣기</label>
                        </div>
                    </div>
                    <div class="tt-settings-group" data-page="input">
                        <div class="tt-settings-group-title"><i class="fa-solid fa-file-lines"></i> 글 넣기 (받은 작업 글 일괄 등록)</div>
                        <div class="ws-desc ws-desc-box">달력 위 <b>글 넣기</b> 버튼 → 날짜 지정 → 받은 글 붙여넣기 → 넣기. 제목 줄은 빼고, 이름→고객명, 주소→주소, 가입번호(12자리)·타스크 번호→타스크 번호, TLI 번호→작업내용 맨 앞에 들어갑니다.</div>
                        <div class="tt-settings-section">
                            <label class="tt-settings-check"><input type="checkbox" id="ttOptImportSkipDup"> 같은 날짜에 이미 있는 작업은 처음부터 선택 해제 <small>타스크 번호·TLI 번호, 또는 고객명+주소가 같으면 "이미 있음"</small></label>
                        </div>
                    </div>

                    <div class="tt-settings-group" data-page="menu">
                        <div class="tt-settings-group-title"><i class="fa-solid fa-grip"></i> 메인 윗줄</div>
                        <div class="ws-desc ws-desc-box">1~12월 화면 맨 위 버튼입니다. <b>빈칸</b>을 넣으면 그 뒤 버튼들이 오른쪽 끝으로 붙습니다.</div>
                        <div class="wm-me" data-bar="main">
                            <div class="wm-me-label">보이는 버튼 (왼쪽부터 이 순서)</div>
                            <div class="wm-me-shown"></div>
                            <div class="wm-me-hint"></div>
                            <div class="wm-me-actions">
                                <button type="button" class="w95-btn" data-me="hide">숨기기</button>
                                <button type="button" class="w95-btn" data-me="restart">순서대로 다시 고르기</button>
                                <button type="button" class="w95-btn" data-me="default">기본값</button>
                            </div>
                            <div class="wm-me-label">숨긴 버튼 (누르면 맨 뒤에 추가)</div>
                            <div class="wm-me-pool"></div>
                        </div>
                    </div>
                    <div class="tt-settings-group" data-page="menu">
                        <div class="tt-settings-group-title"><i class="fa-solid fa-grip"></i> 달력 윗줄</div>
                        <div class="ws-desc ws-desc-box">달력 화면 맨 위 "11월" 오른쪽 버튼입니다. ("11월"은 누르면 뒤로가기라 항상 맨 앞)</div>
                        <div class="wm-me" data-bar="cal">
                            <div class="wm-me-label">보이는 버튼 (왼쪽부터 이 순서)</div>
                            <div class="wm-me-shown"></div>
                            <div class="wm-me-hint"></div>
                            <div class="wm-me-actions">
                                <button type="button" class="w95-btn" data-me="hide">숨기기</button>
                                <button type="button" class="w95-btn" data-me="restart">순서대로 다시 고르기</button>
                                <button type="button" class="w95-btn" data-me="default">기본값</button>
                            </div>
                            <div class="wm-me-label">숨긴 버튼 (누르면 맨 뒤에 추가)</div>
                            <div class="wm-me-pool"></div>
                        </div>
                    </div>
                    <div class="tt-settings-group" data-page="look">
                        <div class="tt-settings-group-title"><i class="fa-solid fa-palette"></i> 화면 · 디자인</div>
                        <div class="tt-settings-section">
                            <div class="tt-settings-label">디자인</div>
                            <label class="tt-settings-check"><input type="checkbox" id="ttOptUiRefresh"> 개선된 디자인 <small>또렷한 글씨·여백·비율 정리 (끄면 예전 모양)</small></label>
                        </div>
                        <div class="tt-settings-section">
                            <div class="tt-settings-label">글자 크기 (앱 전체)</div>
                            <div class="ws-seg">
                                <label><input type="radio" name="ttFontScale" id="ttOptFontNormal" value="normal"><span>보통</span></label>
                                <label><input type="radio" name="ttFontScale" id="ttOptFontLarge" value="large"><span>크게</span></label>
                                <label><input type="radio" name="ttFontScale" id="ttOptFontXLarge" value="xlarge"><span>아주 크게</span></label>
                            </div>
                        </div>
                        <div class="tt-settings-section">
                            <div class="tt-settings-label">글꼴</div>
                            <div class="ws-seg">
                                <label><input type="radio" name="ttFontFamily" id="ttOptFontClassic" value="classic"><span>윈도우95</span></label>
                                <label><input type="radio" name="ttFontFamily" id="ttOptFontSystem" value="system"><span>읽기 쉬운 고딕</span></label>
                            </div>
                        </div>
                    </div>

                    <div class="tt-settings-group" data-page="timetable">
                        <div class="tt-settings-group-title"><i class="fa-solid fa-table-cells"></i> 주간 시간표</div>
                        <div class="tt-settings-section">
                            <div class="tt-settings-label">표시할 항목</div>
                            <label class="tt-settings-check"><input type="checkbox" id="ttOptCatWork"> 작업</label>
                            <label class="tt-settings-check"><input type="checkbox" id="ttOptCatCommute"> 출퇴근</label>
                            <label class="tt-settings-check"><input type="checkbox" id="ttOptCatMemo"> 메모/사진</label>
                        </div>
                        <div class="tt-settings-section">
                            <div class="tt-settings-label">달 화면을 열면 먼저 보일 화면</div>
                            <label class="tt-settings-check"><input type="radio" name="ttDefaultView" id="ttOptViewMonth" value="month"> 월간 달력</label>
                            <label class="tt-settings-check"><input type="radio" name="ttDefaultView" id="ttOptViewTimetable" value="timetable"> 주간 시간표</label>
                        </div>
                    </div>
                    <div class="tt-settings-group" data-page="timetable">
                        <div class="tt-settings-group-title"><i class="fa-solid fa-eye"></i> 시간표 시인성</div>
                        <div class="tt-settings-section">
                            <div class="tt-settings-label">표시 크기 (시간/줄/글씨)</div>
                            <div class="ws-seg">
                                <label><input type="radio" name="ttScale" id="ttOptScaleSmall" value="small"><span>작게</span></label>
                                <label><input type="radio" name="ttScale" id="ttOptScaleMedium" value="medium"><span>보통</span></label>
                                <label><input type="radio" name="ttScale" id="ttOptScaleLarge" value="large"><span>크게</span></label>
                            </div>
                        </div>
                        <div class="tt-settings-section">
                            <div class="tt-settings-label">긴 이름</div>
                            <label class="tt-settings-check"><input type="radio" name="ttLongName" id="ttOptLongNameWrap" value="wrap"> 줄바꿈 <small>칸 높이가 늘어남</small></label>
                            <label class="tt-settings-check"><input type="radio" name="ttLongName" id="ttOptLongNameEllipsis" value="ellipsis"> 말줄임 <small>한 줄, ...</small></label>
                        </div>
                        <div class="tt-settings-section">
                            <div class="tt-settings-label">격자 무늬</div>
                            <div class="ws-seg">
                                <label><input type="radio" name="ttGridPattern" id="ttOptGridPatternNone" value="none"><span>없음</span></label>
                                <label><input type="radio" name="ttGridPattern" id="ttOptGridPatternChecker" value="checker"><span>바둑판</span></label>
                            </div>
                        </div>
                    </div>

                    <div class="tt-settings-group" data-page="map">
                        <div class="tt-settings-group-title"><i class="fa-solid fa-diamond-turn-right"></i> 지도 · 내비게이션</div>
                        <div class="tt-settings-section">
                            <div class="tt-settings-label">기본 지도 앱 <small>길게 눌러 바로 이동할 때</small></div>
                            <div class="ws-seg">
                                <label><input type="radio" name="ttDefaultMap" id="ttOptMapTmap" value="tmap"><span>T맵</span></label>
                                <label><input type="radio" name="ttDefaultMap" id="ttOptMapNaver" value="naver"><span>네이버</span></label>
                                <label><input type="radio" name="ttDefaultMap" id="ttOptMapKakao" value="kakaomap"><span>카카오</span></label>
                            </div>
                        </div>
                    </div>
                    <div class="tt-settings-group" data-page="map">
                        <div class="tt-settings-group-title"><i class="fa-solid fa-route"></i> 동선 관리</div>
                        <div class="tt-settings-section">
                            <label class="tt-settings-check"><input type="checkbox" id="ttOptGeoRouteEnabled"> 켜기 <small>날짜를 길게 누르면 동선 관리 팝업</small></label>
                        </div>
                        <div class="tt-settings-section">
                            <div class="tt-settings-label">지도에 표시할 내 위치 아이콘</div>
                            <div class="tt-settings-icon-row" id="ttGeoRouteLocIconRow"></div>
                        </div>
                        <div class="tt-settings-section">
                            <div class="tt-settings-label">글자 크기</div>
                            <div class="ws-seg">
                                <label><input type="radio" name="ttGeoRouteScale" id="ttOptGeoRouteScaleSmall" value="small"><span>작게</span></label>
                                <label><input type="radio" name="ttGeoRouteScale" id="ttOptGeoRouteScaleMedium" value="medium"><span>보통</span></label>
                                <label><input type="radio" name="ttGeoRouteScale" id="ttOptGeoRouteScaleLarge" value="large"><span>크게</span></label>
                            </div>
                        </div>
                    </div>

                    <div class="tt-settings-group" data-page="auto">
                        <div class="tt-settings-group-title"><i class="fa-solid fa-camera"></i> 자동 인식</div>
                        <div class="tt-settings-section">
                            <div class="tt-settings-label">구글 비전(OCR) — 출퇴근 사진에서 시간/거리 자동 인식</div>
                            <label class="tt-settings-check"><input type="checkbox" id="ttOptVisionOcr"> 켜기 <small>서버에 API 키 설정 필요</small></label>
                            <div id="ttVisionOcrUsage" class="tt-settings-usage"></div>
                        </div>
                    </div>

                    <div class="tt-settings-group" data-page="labs">
                        <div class="tt-settings-group-title"><i class="fa-solid fa-flask"></i> 신규 기능</div>
                        <div class="ws-desc ws-desc-box">직접 만든 편의 기능입니다. 마음에 들지 않으면 하나씩 끄면 원래대로 돌아갑니다.</div>
                        <div class="tt-settings-section">
                            <label class="tt-settings-check"><input type="checkbox" id="ttOptLabNextJob"> 다음 작업 표시</label>
                            <div class="ws-desc">오늘 목록에서 지금 시각 이후 가장 가까운 작업(완료·취소 제외)에 "다음" 표시를 달고 그 카드로 스크롤합니다.</div>
                        </div>
                        <div class="tt-settings-section">
                            <label class="tt-settings-check"><input type="checkbox" id="ttOptLabCalToday"> 달력에 오늘 표시</label>
                            <div class="ws-desc">달력에서 오늘 날짜에 주황 테두리와 "오늘" 글씨를 붙여, 다른 날짜를 보고 있어도 오늘이 어딘지 바로 보입니다.</div>
                        </div>
                        <div class="tt-settings-section">
                            <label class="tt-settings-check"><input type="checkbox" id="ttOptLabBigTouch"> 터치 영역 크게</label>
                            <div class="ws-desc">버튼·태그·입력칸의 높이를 키워 장갑을 끼거나 이동 중에도 잘 눌리게 합니다.</div>
                        </div>
                    </div>

                    <div class="tt-settings-group" data-page="data">
                        <div class="tt-settings-group-title"><i class="fa-solid fa-file-excel"></i> 내보내기 · 백업</div>
                        <div class="tt-settings-section">
                            <button type="button" class="w95-btn ws-wide-btn ws-data-btn" data-data-act="export"><i class="fa-solid fa-file-excel" style="color:#10b981;"></i> 엑셀 내보내기</button>
                            <div class="ws-desc">작업일지·출퇴근을 엑셀 파일로 내보냅니다. (메인 윗줄 초록 엑셀 버튼과 같음)</div>
                        </div>
                        <div class="tt-settings-section">
                            <button type="button" class="w95-btn ws-wide-btn ws-data-btn" data-data-act="backup"><i class="fa-solid fa-file-arrow-down" style="color:#2563eb;"></i> ZIP 백업</button>
                            <div class="ws-desc">기간을 골라 사진까지 ZIP으로 백업합니다.</div>
                        </div>
                        <div class="tt-settings-section">
                            <button type="button" class="w95-btn ws-wide-btn ws-data-btn" data-data-act="import"><i class="fa-solid fa-file-import" style="color:#dc2626;"></i> 백업 복원</button>
                            <div class="ws-desc">백업 파일(.json/.txt/.zip)을 불러와 복원합니다.</div>
                        </div>
                    </div>

                    <div class="tt-settings-group" data-page="account">
                        <div class="tt-settings-group-title"><i class="fa-solid fa-user-shield"></i> 계정</div>
                        <div class="tt-settings-section">
                            <div class="tt-settings-label" id="ttAccountEmailLabel"></div>
                            <button type="button" class="w95-btn ws-wide-btn" id="ttAccessLogBtn">접속 기록 보기</button>
                            <div class="ws-btn-row">
                                <button type="button" class="w95-btn" id="ttSwitchAccountBtn">계정 전환</button>
                                <button type="button" class="w95-btn" id="ttLogoutBtn">로그아웃</button>
                            </div>
                        </div>
                    </div>

                    <div class="tt-settings-group" data-page="reset">
                        <div class="tt-settings-group-title"><i class="fa-solid fa-rotate-left"></i> 되돌리기</div>
                        <div class="ws-desc ws-desc-box">화면 모양 설정(메인 화면 표시 형식·전체 누적·작업 카드 레이아웃·디자인·글자 크기·글꼴·신규 기능)을 예전 상태로 돌립니다. 복제·묶기·붙여넣기·스와이프 같은 동작 기능과 선택태그 상자 방식, 주간 시간표, 지도 설정은 그대로 둡니다. (메인 설정 버튼은 남겨 둡니다)</div>
                        <button type="button" class="w95-btn ws-wide-btn ws-danger" id="ttSettingsResetBtn">예전 모양으로 되돌리기</button>
                    </div>
                    <div class="ws-empty" id="ttSettingsEmpty" hidden>찾는 설정이 없습니다.</div>
                </div>
                <div class="modal-footer ws-footer">
                    <button type="button" class="w95-btn" id="ttSettingsSaveBtn">저장</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        document.getElementById('ttSettingsCloseBtn').addEventListener('click', closeSettingsModal);
        document.getElementById('ttSettingsSaveBtn').addEventListener('click', saveSettingsFromModal);
        document.getElementById('ttAccessLogBtn').addEventListener('click', () => window.showAccessLog?.());
        document.getElementById('ttSwitchAccountBtn').addEventListener('click', () => {
            if (confirm('현재 계정에서 로그아웃하고 다른 계정으로 로그인할까요?')) window.wmLogout?.(true);
        });
        document.getElementById('ttLogoutBtn').addEventListener('click', () => {
            if (confirm('로그아웃할까요?')) window.wmLogout?.(false);
        });
        setupSettingsMenu(modal);
    }

    // ─── 설정 메뉴: 첫 화면은 메뉴 목록, 누르면 그 메뉴의 설정만, 검색하면 전체에서 찾기 ───
    const SETTINGS_PAGE_TITLES = { menu:'메뉴 버튼', data:'내보내기 · 백업', main:'메인 화면', card:'작업 카드', input:'작업일지 입력', look:'화면 · 디자인', timetable:'주간 시간표', map:'지도 · 동선', auto:'자동 인식', labs:'신규 기능', account:'계정', reset:'되돌리기' };
    function showSettingsPage(page) {
        const modal = document.getElementById('ttSettingsModal');
        if (!modal) return;
        const search = document.getElementById('ttSettingsSearch');
        if (search) search.value = '';
        modal.dataset.page = page || '';
        modal.querySelectorAll('.tt-settings-section, .tt-settings-group').forEach(el => { el.hidden = false; });
        modal.querySelectorAll('.tt-settings-group[data-page]').forEach(g => { g.hidden = !page || g.dataset.page !== page; });
        document.getElementById('ttSettingsMenu').hidden = !!page;
        document.getElementById('ttSettingsBackBtn').hidden = !page;
        document.getElementById('ttSettingsEmpty').hidden = true;
        document.getElementById('ttSettingsTitle').textContent = page ? SETTINGS_PAGE_TITLES[page] || '설정' : '설정';
        document.getElementById('ttSettingsBody').scrollTop = 0;
    }
    function filterSettings(query) {
        const modal = document.getElementById('ttSettingsModal');
        const q = String(query || '').trim().toLowerCase().replace(/s+/g, '');
        if (!q) { showSettingsPage(modal.dataset.page || ''); return; }
        document.getElementById('ttSettingsMenu').hidden = true;
        document.getElementById('ttSettingsBackBtn').hidden = false;
        document.getElementById('ttSettingsTitle').textContent = '검색';
        let any = false;
        const norm = el => (el.textContent || '').toLowerCase().replace(/s+/g, '');
        modal.querySelectorAll('.tt-settings-group[data-page]').forEach(g => {
            const titleHit = norm(g.querySelector('.tt-settings-group-title') || g).includes(q);
            let groupAny = false;
            g.querySelectorAll('.tt-settings-section').forEach(sec => {
                const hit = titleHit || norm(sec).includes(q);
                sec.hidden = !hit; groupAny = groupAny || hit;
            });
            if (!g.querySelector('.tt-settings-section')) groupAny = titleHit;
            g.hidden = !groupAny; any = any || groupAny;
        });
        document.getElementById('ttSettingsEmpty').hidden = any;
    }
    function setupSettingsMenu(modal) {
        modal.querySelector('#ttSettingsMenu').addEventListener('click', e => {
            const item = e.target.closest('[data-go]');
            if (item) showSettingsPage(item.dataset.go);
        });
        document.getElementById('ttSettingsBackBtn').addEventListener('click', () => showSettingsPage(''));
        // 내보내기 · 백업: 설정 창을 닫고 기존 기능을 그대로 연다
        modal.addEventListener('click', e => {
            const act = e.target.closest('[data-data-act]')?.dataset.dataAct;
            if (!act) return;
            closeSettingsModal();
            if (act === 'export') { if (window.WorkExportUI) window.WorkExportUI.open(); else alert('내보내기 모듈이 로드되지 않았습니다.'); }
            else if (act === 'backup') { if (window.openBackupDialog) window.openBackupDialog(); else alert('백업 기능을 불러오지 못했습니다.'); }
            else if (act === 'import') window.triggerImport?.();
        });
        document.getElementById('ttSettingsSearch').addEventListener('input', e => filterSettings(e.target.value));
        document.getElementById('ttSettingsResetBtn').addEventListener('click', () => {
            if (!confirm('화면 모양 설정을 예전 상태로 되돌릴까요?')) return;
            window.resetCardToolsLook?.();
            fillCardToolsFields();
            alert('예전 모양으로 되돌렸습니다.');
        });
    }
    window.openMainSettings = () => openSettingsModal();


    // 카드·화면 설정(work_card_tools.js 저장소) ↔ 설정 화면 입력칸
    function fillCardToolsFields() {
        const c = window.getCardToolsSettings?.() || {};
        const check = (id, on) => { const el = document.getElementById(id); if (el) el.checked = !!on; };
        const radio = (name, value, fallback) => {
            const el = document.querySelector(`input[name="${name}"][value="${value}"]`) || document.querySelector(`input[name="${name}"][value="${fallback}"]`);
            if (el) el.checked = true;
        };
        radio('ttCardLayout', c.cardLayout, 'default');
        radio('ttMainView', c.mainView, 'classic');
        radio('ttMainCols', c.mainCols, 'auto');
        radio('ttFontScale', c.fontScale, 'normal');
        radio('ttFontFamily', c.fontFamily, 'classic');
        check('ttOptImportSkipDup', c.importSkipDup !== false);
        check('ttOptCardDuplicate', c.duplicate !== false);
        check('ttOptCardGroupTaskNo', c.groupByTaskNo);
        check('ttOptDoubleTapPaste', c.doubleTapPaste !== false);
        check('ttOptSwipeLongExclude', c.swipeLongExclude !== false);
        check('ttOptSwipeTitleExclude', c.swipeTitleExclude !== false);
        check('ttOptSwipePreview', c.swipePreview !== false);
        check('ttOptMainYearTotal', c.mainYearTotal !== false);
        check('ttOptMainYearStatus', c.mainYearStatus !== false);
        check('ttOptMainHighlight', c.mainHighlight);
        check('ttOptUiRefresh', c.uiRefresh);
        window.loadMenuEditors?.();
        check('ttOptLabNextJob', c.labNextJob);
        check('ttOptLabCalToday', c.labCalToday);
        check('ttOptLabBigTouch', c.labBigTouch);
    }
    function readCardToolsFields() {
        const val = (name, fallback) => document.querySelector(`input[name="${name}"]:checked`)?.value || fallback;
        const on = id => !!document.getElementById(id)?.checked;
        return {
            cardLayout: val('ttCardLayout', 'default'),
            mainView: val('ttMainView', 'classic'),
            mainCols: val('ttMainCols', 'auto'),
            fontScale: val('ttFontScale', 'normal'),
            fontFamily: val('ttFontFamily', 'classic'),
            importSkipDup: on('ttOptImportSkipDup'),
            duplicate: on('ttOptCardDuplicate'),
            groupByTaskNo: on('ttOptCardGroupTaskNo'),
            doubleTapPaste: on('ttOptDoubleTapPaste'),
            swipeLongExclude: on('ttOptSwipeLongExclude'),
            swipeTitleExclude: on('ttOptSwipeTitleExclude'),
            swipePreview: on('ttOptSwipePreview'),
            mainYearTotal: on('ttOptMainYearTotal'),
            mainYearStatus: on('ttOptMainYearStatus'),
            mainHighlight: on('ttOptMainHighlight'),
            uiRefresh: on('ttOptUiRefresh'),
            labNextJob: on('ttOptLabNextJob'),
            labCalToday: on('ttOptLabCalToday'),
            labBigTouch: on('ttOptLabBigTouch'),
            ...(window.readMenuEditors?.() || {})
        };
    }

    function openSettingsModal() {
        ensureSettingsModalDom();
        const s = WT.getSettings();
        document.getElementById('ttOptCatWork').checked = !!s.categories.work;
        document.getElementById('ttOptCatCommute').checked = !!s.categories.commute;
        document.getElementById('ttOptCatMemo').checked = !!s.categories.memo;
        document.getElementById(s.defaultView === 'timetable' ? 'ttOptViewTimetable' : 'ttOptViewMonth').checked = true;
        document.getElementById(`ttOptScale${s.scale.charAt(0).toUpperCase()}${s.scale.slice(1)}`).checked = true;
        document.getElementById(s.longNameMode === 'ellipsis' ? 'ttOptLongNameEllipsis' : 'ttOptLongNameWrap').checked = true;
        document.getElementById(s.gridPattern === 'checker' ? 'ttOptGridPatternChecker' : 'ttOptGridPatternNone').checked = true;
        document.getElementById('ttOptVisionOcr').checked = !!window.isVisionOcrEnabled?.();
        window.refreshVisionOcrUsageDisplay?.();
        const defaultMap = localStorage.getItem('wm_default_map') || 'naver';
        const mapOptIds = { tmap: 'ttOptMapTmap', naver: 'ttOptMapNaver', kakaomap: 'ttOptMapKakao' };
        document.getElementById(mapOptIds[defaultMap] || 'ttOptMapNaver').checked = true;

        const emailLabel = document.getElementById('ttAccountEmailLabel');
        if (emailLabel) {
            if (window.wmAuthEmail) {
                const expText = window.wmAuthExp ? new Date(window.wmAuthExp).toLocaleDateString('ko-KR') : '';
                emailLabel.textContent = `현재 로그인: ${window.wmAuthEmail}${expText ? ` (만료: ${expText})` : ''}`;
            } else {
                emailLabel.textContent = '';
            }
        }

        document.getElementById('ttOptGeoRouteEnabled').checked = !!window.isGeoRouteEnabled?.();
        const iconRow = document.getElementById('ttGeoRouteLocIconRow');
        if (iconRow && window.GEO_ROUTE_LOC_ICONS) {
            const current = window.getGeoRouteLocIcon?.() || window.GEO_ROUTE_LOC_ICONS[0];
            iconRow.innerHTML = window.GEO_ROUTE_LOC_ICONS.map(icon =>
                `<button type="button" class="w95-btn tt-icon-choice-btn${icon === current ? ' is-active' : ''}" data-icon="${icon}">${icon}</button>`
            ).join('');
            iconRow.querySelectorAll('.tt-icon-choice-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    iconRow.querySelectorAll('.tt-icon-choice-btn').forEach(b => b.classList.remove('is-active'));
                    btn.classList.add('is-active');
                    iconRow.dataset.selected = btn.dataset.icon;
                });
            });
            iconRow.dataset.selected = current;
        }
        const geoScaleIds = { small: 'ttOptGeoRouteScaleSmall', medium: 'ttOptGeoRouteScaleMedium', large: 'ttOptGeoRouteScaleLarge' };
        document.getElementById(geoScaleIds[window.getGeoRouteFontScale?.() || 'medium']).checked = true;
        document.getElementById(window.isTagSwipeMode?.() ? 'ttOptTagBoxSwipe' : window.isTagCompactMode?.() ? 'ttOptTagBoxCompact' : 'ttOptTagBoxExpanded').checked = true;
        fillCardToolsFields();
        showSettingsPage('');
        document.getElementById(window.getTagCompactCloseMode?.() === 'ok' ? 'ttOptTagBoxCloseOk' : 'ttOptTagBoxCloseOutside').checked = true;
        document.getElementById('ttSettingsModal').style.display = 'flex';
    }
    function closeSettingsModal() {
        const modal = document.getElementById('ttSettingsModal');
        if (modal) modal.style.display = 'none';
    }
    function saveSettingsFromModal() {
        const scaleEl = document.querySelector('input[name="ttScale"]:checked');
        const viewEl = document.querySelector('input[name="ttDefaultView"]:checked');
        const longNameEl = document.querySelector('input[name="ttLongName"]:checked');
        const gridPatternEl = document.querySelector('input[name="ttGridPattern"]:checked');
        WT.saveSettings({
            categories: {
                work: document.getElementById('ttOptCatWork').checked,
                commute: document.getElementById('ttOptCatCommute').checked,
                memo: document.getElementById('ttOptCatMemo').checked
            },
            defaultView: viewEl ? viewEl.value : 'month',
            scale: scaleEl ? scaleEl.value : 'medium',
            longNameMode: longNameEl ? longNameEl.value : 'wrap',
            gridPattern: gridPatternEl ? gridPatternEl.value : 'none'
        });
        window.setVisionOcrEnabled?.(document.getElementById('ttOptVisionOcr').checked);
        const defaultMapEl = document.querySelector('input[name="ttDefaultMap"]:checked');
        if (defaultMapEl) localStorage.setItem('wm_default_map', defaultMapEl.value);

        window.setGeoRouteEnabled?.(document.getElementById('ttOptGeoRouteEnabled').checked);
        const iconRow = document.getElementById('ttGeoRouteLocIconRow');
        if (iconRow?.dataset.selected) window.setGeoRouteLocIcon?.(iconRow.dataset.selected);
        const geoScaleEl = document.querySelector('input[name="ttGeoRouteScale"]:checked');
        if (geoScaleEl) window.setGeoRouteFontScale?.(geoScaleEl.value);
        const tagBoxModeEl = document.querySelector('input[name="ttTagBoxMode"]:checked');
        const tagBoxCloseEl = document.querySelector('input[name="ttTagBoxClose"]:checked');
        window.setCardToolsSettings?.(readCardToolsFields());
        const tagBoxMode = tagBoxModeEl?.value === 'swipe' ? 'swipe' : tagBoxModeEl?.value === 'compact';
        window.setTagCompactSettings?.(tagBoxMode, tagBoxCloseEl?.value === 'ok' ? 'ok' : 'outside');

        closeSettingsModal();
        if (active) { applyScaleClass(); renderWeek(); }
    }

    // ─── 활성화/비활성화 ───
    function computeBaseMonday() {
        const y = window.currentYear;
        const m = window.curMonth;
        const d = Math.min(window.curDay || 1, daysInMonthOf(y, m));
        return WT.mondayOf(new Date(y, m - 1, d));
    }

    function applyScaleClass() {
        const area = document.getElementById('timetableArea');
        if (!area) return;
        const settings = WT.getSettings();
        area.classList.remove('tt-scale-small', 'tt-scale-medium', 'tt-scale-large');
        area.classList.add(`tt-scale-${settings.scale}`);
        area.classList.toggle('tt-longname-ellipsis', settings.longNameMode === 'ellipsis');
    }

    function activate() {
        ensureAreaDom();
        ensurePopoverDom();
        currentMonday = computeBaseMonday();
        active = true;
        document.getElementById('popContentArea')?.classList.add('timetable-mode');
        const toggleBtn = document.getElementById('timetableToggleBtn');
        if (toggleBtn) toggleBtn.classList.add('active-btn');
        applyScaleClass();
        updateUndoRedoButtons();
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

    // 주 범위 표시("2026.09.14 ~ 09.20")를 탭하면 오늘이 속한 주로 바로 이동한다.
    function goToCurrentWeek() {
        currentMonday = WT.mondayOf(new Date());
        renderWeek();
    }

    // ─── 렌더링 ───
    function renderWeek() {
        if (!active) return;
        ensureAreaDom();
        applyScaleClass();
        const settings = WT.getSettings();
        const days = WT.weekDays(currentMonday);
        const today = new Date();
        const hours = computeHourRange(days, settings);

        const label = `${days[0].getFullYear()}.${String(days[0].getMonth() + 1).padStart(2, '0')}.${String(days[0].getDate()).padStart(2, '0')} ~ ${String(days[6].getMonth() + 1).padStart(2, '0')}.${String(days[6].getDate()).padStart(2, '0')}`;
        const weekLabelEl = document.getElementById('ttWeekLabel');
        if (weekLabelEl) weekLabelEl.textContent = label;

        // 헤더 (요일/날짜 색상은 공휴일·주말 기준, 탭하면 그 월의 달력 해당 날짜로 이동)
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
                const date = days[Number(el.dataset.dayIdx)];
                el.addEventListener('click', () => onDayHeaderClick(date));
                window.attachLongPress?.(el, () => {
                    window.openGeoRouteModal?.(date.getFullYear(), date.getMonth() + 1, date.getDate());
                });
            });
        }

        // 정시 행 × 요일 칸 — 각 칸 안에 그 시간대 일정을 시간순으로 세로로 쌓는다.
        const checker = settings.gridPattern === 'checker';
        const rowsHtml = hours.map((hour, rowIdx) => {
            const cellsHtml = days.map((d, dayIdx) => {
                const blocks = WT.buildDayBlocks(window.logs || [], d, settings).filter(b => b.hour === hour);
                const chipsHtml = blocks.map(renderChipHtml).join('');
                const tileClass = checker && (rowIdx + dayIdx) % 2 === 1 ? ' is-tile-dark' : '';
                return `<div class="tt-hour-cell${tileClass}" data-day-idx="${dayIdx}" data-hour="${hour}">${chipsHtml}</div>`;
            }).join('');
            return `<div class="tt-hour-row" data-hour="${hour}">
                <div class="tt-hour-label">${String(hour).padStart(2, '0')}:00</div>
                ${cellsHtml}
            </div>`;
        }).join('');

        const body = document.getElementById('ttBody');
        if (body) body.innerHTML = rowsHtml;

        // 09시가 기본으로 화면 맨 위에 오도록 — 그보다 이른 일정이 있어 범위가 늘어난 만큼만 스크롤이 생긴다.
        const scrollEl = document.getElementById('ttScroll');
        const baseRow = body ? body.querySelector(`.tt-hour-row[data-hour="${BASE_MIN_HOUR}"]`) : null;
        if (scrollEl) scrollEl.scrollTop = baseRow ? baseRow.offsetTop : 0;
    }

    function onDayHeaderClick(date) {
        window.currentYear = date.getFullYear();
        window.curMonth = date.getMonth() + 1;
        window.curDay = date.getDate();
        const monthLabelEl = document.getElementById('monthLabel');
        if (monthLabelEl) monthLabelEl.innerText = `${window.curMonth}월`;
        if (window.renderCal) window.renderCal(window.currentYear, window.curMonth - 1);
        deactivate(); // 시간표를 끄고 월간 달력 + 해당 날짜 목록으로 전환한다.
    }

    function renderChipHtml(b) {
        const classes = ['tt-chip', `cat-${b.cat}`, `group-${b.groupCat}`];
        if (b.completed) classes.push('is-completed');
        if (b.canceled) classes.push('is-canceled');
        // 월간 카드와 같은 색(태그의 cardColor)을 골랐으면 그 색으로 덮어써서 두 화면을 맞춘다.
        let colorStyle = '';
        if (b.cardColor) {
            classes.push('has-custom-color');
            colorStyle = ` style="background-color:${b.cardColor}; border-color:${b.cardColor};"`;
        }
        return `<div class="${classes.join(' ')}" data-log-id="${escapeHtml(b.logId)}"${colorStyle}>
            <span class="tt-chip-label">${escapeHtml(b.label)}</span>
        </div>`;
    }

    // ─── 드래그(이동) ───
    // 칩을 누르면 바로 드래그하지 않는다 — 롱프레스(LONG_PRESS_MS)를 완성해야 드래그가 시작되고,
    // 그 전에 손가락이 MOVE_SLOP_PX 이상 움직이면 스크롤 의도로 보고 우리가 직접 스크롤을 대신 처리한다
    // (칩에 touch-action:none이 걸려 있어 브라우저 기본 스크롤이 안 먹으므로).
    function onBodyPointerDown(e) {
        const chipEl = e.target.closest('.tt-chip');
        if (!chipEl) return;

        const logId = chipEl.dataset.logId;
        const log = (window.logs || []).find(l => String(l.id) === String(logId));
        if (!log) return;

        const cellEl = chipEl.closest('.tt-hour-cell');
        const origDayIdx = cellEl ? Number(cellEl.dataset.dayIdx) : 0;
        const origHour = cellEl ? Number(cellEl.dataset.hour) : 0;
        const originRect = chipEl.getBoundingClientRect();

        dragCtx = {
            phase: 'pending', // 'pending' → 'dragging' | 'scrolling'
            logId,
            cat: log.cat,
            groupCat: WT.groupCatOf(log),
            origDayIdx,
            origHour,
            originX: originRect.left + originRect.width / 2,
            originY: originRect.top + originRect.height / 2,
            startClientX: e.clientX,
            startClientY: e.clientY,
            lastClientY: e.clientY,
            scrollEl: document.getElementById('ttScroll'),
            moved: 0,
            chipEl
        };

        try { chipEl.setPointerCapture(e.pointerId); } catch (_) { /* noop */ }

        window.addEventListener('pointermove', onBodyPointerMove);
        window.addEventListener('pointerup', onBodyPointerUp, { once: true });
        window.addEventListener('pointercancel', onBodyPointerCancel, { once: true });

        clearTimeout(longPressTimer);
        longPressTimer = setTimeout(activateDrag, LONG_PRESS_MS);
        e.preventDefault();
    }

    function activateDrag() {
        if (!dragCtx || dragCtx.phase !== 'pending') return;
        dragCtx.phase = 'dragging';
        dragCtx.chipEl.classList.add('is-dragging');
        if (navigator.vibrate) { try { navigator.vibrate(15); } catch (_) { /* noop */ } }
        ensureDragIndicatorDom();
        ensureDragTrajectoryDom();
    }

    function ensureDragIndicatorDom() {
        if (document.getElementById('ttDragIndicator')) return;
        const ind = document.createElement('div');
        ind.id = 'ttDragIndicator';
        ind.className = 'tt-drag-indicator';
        ind.style.display = 'none';
        document.body.appendChild(ind);
    }

    // 드래그 중인 칩이 시작 지점에서 현재 포인터 위치까지 이동한 궤적을 선으로 보여준다.
    function ensureDragTrajectoryDom() {
        if (document.getElementById('ttDragTrajectory')) return;
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.id = 'ttDragTrajectory';
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '100%');
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.id = 'ttDragTrajectoryLine';
        line.setAttribute('stroke', '#111827');
        line.setAttribute('stroke-width', '2');
        line.setAttribute('stroke-dasharray', '5 4');
        line.setAttribute('stroke-linecap', 'round');
        svg.appendChild(line);
        const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        dot.id = 'ttDragTrajectoryOrigin';
        dot.setAttribute('r', '5');
        dot.setAttribute('fill', '#111827');
        svg.appendChild(dot);
        document.body.appendChild(svg);
    }

    // 표시 중인 행 범위를 벗어나 위/아래로 끌면(예: 09시 위쪽, 18시 아래쪽) 실제 칸이 없어도
    // 정시 단위로 계속 확장해서 시간을 고를 수 있게 한다. 요일은 첫 행의 칸 가로 폭을 기준으로 계산한다.
    function resolveDragTarget(clientX, clientY) {
        const body = document.getElementById('ttBody');
        const rows = body ? Array.from(body.querySelectorAll('.tt-hour-row')) : [];
        if (!rows.length) return { dayIdx: dragCtx.origDayIdx, hour: dragCtx.origHour };

        const firstRow = rows[0], lastRow = rows[rows.length - 1];
        const firstRect = firstRow.getBoundingClientRect();
        const lastRect = lastRow.getBoundingClientRect();
        const firstHour = Number(firstRow.dataset.hour);
        const lastHour = Number(lastRow.dataset.hour);
        const unit = HOUR_STEP_PX[WT.getSettings().scale] || 32;

        let hour;
        if (clientY < firstRect.top) {
            hour = Math.max(0, firstHour - Math.ceil((firstRect.top - clientY) / unit));
        } else if (clientY > lastRect.bottom) {
            hour = Math.min(23, lastHour + Math.ceil((clientY - lastRect.bottom) / unit));
        } else {
            const row = rows.find(r => {
                const rc = r.getBoundingClientRect();
                return clientY >= rc.top && clientY < rc.bottom;
            }) || lastRow;
            hour = Number(row.dataset.hour);
        }

        const refCells = Array.from(firstRow.querySelectorAll('.tt-hour-cell'));
        let dayIdx = dragCtx.origDayIdx;
        if (refCells.length) {
            const firstCellRect = refCells[0].getBoundingClientRect();
            const lastCellRect = refCells[refCells.length - 1].getBoundingClientRect();
            if (clientX < firstCellRect.left) dayIdx = 0;
            else if (clientX >= lastCellRect.right) dayIdx = refCells.length - 1;
            else {
                const hit = refCells.find(cell => {
                    const r = cell.getBoundingClientRect();
                    return clientX >= r.left && clientX < r.right;
                });
                if (hit) dayIdx = Number(hit.dataset.dayIdx);
            }
        }

        return { dayIdx, hour };
    }

    // "자석" 효과 — 지금 놓으면 들어갈 칸을 하이라이트한다. 범위 밖 시간이면 가장 가까운 가장자리 행을 비춘다.
    function highlightDropTarget(dayIdx, hour) {
        document.querySelectorAll('.tt-hour-cell.is-drag-target').forEach(el => el.classList.remove('is-drag-target'));
        const body = document.getElementById('ttBody');
        const rows = body ? Array.from(body.querySelectorAll('.tt-hour-row')) : [];
        if (!rows.length) return;
        const hours = rows.map(r => Number(r.dataset.hour));
        const clampedHour = Math.min(Math.max(hour, hours[0]), hours[hours.length - 1]);
        const row = rows.find(r => Number(r.dataset.hour) === clampedHour);
        const cell = row ? row.querySelector(`.tt-hour-cell[data-day-idx="${dayIdx}"]`) : null;
        if (cell) cell.classList.add('is-drag-target');
    }

    function onBodyPointerMove(e) {
        if (!dragCtx) return;
        const deltaX = e.clientX - dragCtx.startClientX;
        const deltaY = e.clientY - dragCtx.startClientY;
        dragCtx.moved = Math.max(dragCtx.moved, Math.abs(deltaX), Math.abs(deltaY));

        if (dragCtx.phase === 'pending') {
            if (dragCtx.moved <= MOVE_SLOP_PX) return; // 아직 판단 대기(롱프레스 타이머가 결정)
            // 롱프레스가 끝나기 전에 움직였다 — 스크롤 의도로 보고 여기서부터 우리가 대신 스크롤한다.
            clearTimeout(longPressTimer);
            dragCtx.phase = 'scrolling';
        }

        if (dragCtx.phase === 'scrolling') {
            const dy = e.clientY - dragCtx.lastClientY;
            if (dragCtx.scrollEl) dragCtx.scrollEl.scrollTop -= dy;
            dragCtx.lastClientY = e.clientY;
            return;
        }

        // phase === 'dragging'
        const target = resolveDragTarget(e.clientX, e.clientY);
        dragCtx.previewDayIdx = target.dayIdx;
        dragCtx.previewHour = target.hour;
        highlightDropTarget(target.dayIdx, target.hour);

        const days = WT.weekDays(currentMonday);
        const targetDate = days[target.dayIdx];
        const ind = document.getElementById('ttDragIndicator');
        if (ind && targetDate) {
            ind.style.display = 'block';
            ind.style.left = `${e.clientX + 14}px`;
            ind.style.top = `${e.clientY + 14}px`;
            ind.textContent = `${WT.DAY_LABELS[target.dayIdx]}(${targetDate.getDate()}일) ${String(target.hour).padStart(2, '0')}:00`;
        }

        const svg = document.getElementById('ttDragTrajectory');
        const line = document.getElementById('ttDragTrajectoryLine');
        const dot = document.getElementById('ttDragTrajectoryOrigin');
        if (svg && line) {
            svg.style.display = 'block';
            line.setAttribute('x1', dragCtx.originX);
            line.setAttribute('y1', dragCtx.originY);
            line.setAttribute('x2', e.clientX);
            line.setAttribute('y2', e.clientY);
            if (dot) { dot.setAttribute('cx', dragCtx.originX); dot.setAttribute('cy', dragCtx.originY); }
        }
    }

    function onBodyPointerCancel() {
        cleanupDrag();
    }

    function onBodyPointerUp() {
        const ctx = dragCtx;
        cleanupDrag();
        if (!ctx) return;
        // 칩 위에서 시작된 포인터 조작이 끝난 직후 뒤따라오는 네이티브 click(마우스 입력 등)이
        // 그 자리의 빈 칸 빠른입력 메뉴를 오작동시키지 않도록 한 번 무시한다.
        suppressNextClick = true;

        if (ctx.phase === 'pending') {
            onChipTap(ctx.logId, ctx.chipEl);
            return;
        }
        if (ctx.phase !== 'dragging') return; // 스크롤이었던 경우 — 이미 스크롤 처리됨, 커밋 없음

        if (ctx.previewDayIdx == null) return;
        const dayChanged = ctx.previewDayIdx !== ctx.origDayIdx;
        const hourChanged = ctx.previewHour !== ctx.origHour;
        if (!dayChanged && !hourChanged) return;

        const days = WT.weekDays(currentMonday);
        const targetDate = days[ctx.previewDayIdx];
        commitMove(ctx, dayChanged ? targetDate : null);
    }

    function cleanupDrag() {
        clearTimeout(longPressTimer);
        window.removeEventListener('pointermove', onBodyPointerMove);
        if (dragCtx && dragCtx.chipEl) dragCtx.chipEl.classList.remove('is-dragging');
        const ind = document.getElementById('ttDragIndicator');
        if (ind) ind.style.display = 'none';
        const svg = document.getElementById('ttDragTrajectory');
        if (svg) svg.style.display = 'none';
        document.querySelectorAll('.tt-hour-cell.is-drag-target').forEach(el => el.classList.remove('is-drag-target'));
        dragCtx = null;
    }

    function buildMovePatch(ctx, log) {
        const newStartMin = ctx.previewHour * 60; // 정시(:00)로 옮긴다 — 칸 단위 이동이므로 분은 버린다.
        if (ctx.cat === 'work') {
            const s = WT.toMin(log.startTime), e = WT.toMin(log.endTime);
            if (s !== null && e !== null && e > s) {
                const duration = e - s;
                return {
                    startTime: WT.toHHMM(newStartMin),
                    endTime: WT.toHHMM(Math.min(24 * 60 - 1, newStartMin + duration)),
                    workTime: WT.toHHMM(newStartMin)
                };
            }
            return { workTime: WT.toHHMM(newStartMin) };
        }
        if (ctx.cat === 'commute_in') { const t = WT.toHHMM(newStartMin); return { time: t, inTime: t }; }
        if (ctx.cat === 'commute_out') { const t = WT.toHHMM(newStartMin); return { time: t, outTime: t }; }
        return { time: WT.toHHMM(newStartMin) };
    }

    function commitMove(ctx, targetDate) {
        const log = (window.logs || []).find(l => String(l.id) === String(ctx.logId));
        if (!log) return;
        const patch = buildMovePatch(ctx, log);

        const trackedFields = ['y', 'm', 'd', 'startTime', 'endTime', 'workTime', 'time', 'inTime', 'outTime'];
        const before = {};
        trackedFields.forEach(f => { before[f] = log[f]; });

        const updated = { ...log, ...patch };
        if (targetDate) {
            updated.y = targetDate.getFullYear();
            updated.m = targetDate.getMonth() + 1;
            updated.d = targetDate.getDate();
        }
        const after = {};
        trackedFields.forEach(f => { after[f] = updated[f]; });

        applyLogFields(ctx.logId, after, before);

        undoStack.push({ logId: ctx.logId, before, after });
        redoStack = [];
        updateUndoRedoButtons();
        showUndoToast();
    }

    // fields를 로그에 반영해 저장하고, 출퇴근이면 관련 상세메모도 갱신한다.
    // prevFields가 주어지면(되돌리기 등으로 날짜가 바뀔 수 있는 경우) 이전 날짜도 함께 갱신한다.
    function applyLogFields(logId, fields, prevFieldsForCommuteRefresh) {
        const log = (window.logs || []).find(l => String(l.id) === String(logId));
        if (!log) return;
        const cat = log.cat;
        const origY = log.y, origM = log.m, origD = log.d;
        const updated = { ...log, ...fields };
        window.saveToLocalStore('logs', updated);

        if ((cat === 'commute_in' || cat === 'commute_out') && window.updateCommuteDetailByDate) {
            window.updateCommuteDetailByDate(updated.y, updated.m, updated.d);
            const prevY = prevFieldsForCommuteRefresh?.y ?? origY;
            const prevM = prevFieldsForCommuteRefresh?.m ?? origM;
            const prevD = prevFieldsForCommuteRefresh?.d ?? origD;
            if (prevY !== updated.y || prevM !== updated.m || prevD !== updated.d) {
                window.updateCommuteDetailByDate(prevY, prevM, prevD);
            }
        }
    }

    function updateUndoRedoButtons() {
        const undoBtn = document.getElementById('ttUndoNavBtn');
        const redoBtn = document.getElementById('ttRedoNavBtn');
        if (undoBtn) undoBtn.disabled = undoStack.length === 0;
        if (redoBtn) redoBtn.disabled = redoStack.length === 0;
    }

    function showUndoToast() {
        clearTimeout(undoTimer);
        const toast = document.getElementById('ttUndoToast');
        const text = document.getElementById('ttUndoText');
        if (!toast) return;
        if (text) text.textContent = '일정을 변경했습니다.';
        toast.style.display = 'flex';
        undoTimer = setTimeout(() => { toast.style.display = 'none'; }, UNDO_MS);
    }

    function performUndo() {
        if (undoStack.length === 0) return;
        const entry = undoStack.pop();
        applyLogFields(entry.logId, entry.before, entry.after);
        redoStack.push(entry);
        updateUndoRedoButtons();
        clearTimeout(undoTimer);
        const toast = document.getElementById('ttUndoToast');
        if (toast) toast.style.display = 'none';
    }

    function performRedo() {
        if (redoStack.length === 0) return;
        const entry = redoStack.pop();
        applyLogFields(entry.logId, entry.after, entry.before);
        undoStack.push(entry);
        updateUndoRedoButtons();
    }

    // ─── 팝오버(1단계 미리보기) ───
    // 같은 칸(같은 요일·시간대)에 2건 이상 있으면 작은 칩을 각각 정확히 누르기 어려우므로
    // 먼저 목록 팝업으로 보여주고, 거기서 하나를 골라야 상세 미리보기로 들어간다.
    function onChipTap(logId, chipEl) {
        const cellEl = chipEl.closest('.tt-hour-cell');
        const siblingChips = cellEl ? cellEl.querySelectorAll('.tt-chip') : null;
        if (!cellEl || !siblingChips || siblingChips.length <= 1) {
            showPopoverForLog(logId, chipEl);
            return;
        }
        const dayIdx = Number(cellEl.dataset.dayIdx);
        const hour = Number(cellEl.dataset.hour);
        const days = WT.weekDays(currentMonday);
        const date = days[dayIdx];
        if (!date) { showPopoverForLog(logId, chipEl); return; }
        const blocks = WT.buildDayBlocks(window.logs || [], date, WT.getSettings()).filter(b => b.hour === hour);
        if (blocks.length <= 1) { showPopoverForLog(logId, chipEl); return; }
        showListPopover(blocks, chipEl);
    }

    // 겹치는 시간대의 항목 목록 — 타이틀바는 이름 대신 시간대를 보여준다.
    function showListPopover(blocks, anchorEl) {
        ensurePopoverDom();
        const sorted = [...blocks].sort((a, b) => a.startMin - b.startMin);
        const hour = sorted[0].hour;

        const titleEl = document.getElementById('ttPopoverTitle');
        titleEl.textContent = `${String(hour).padStart(2, '0')}:00대 (${sorted.length}건)`;
        titleEl.classList.remove('tt-copyable');
        titleEl.onclick = null;

        const bodyEl = document.getElementById('ttPopoverBody');
        bodyEl.innerHTML = '';
        bodyEl.classList.add('tt-popover-list');
        sorted.forEach(b => {
            const row = document.createElement('div');
            row.className = 'tt-popover-list-item';
            const label = document.createElement('span');
            label.className = 'tt-popover-list-label' + (b.completed ? ' is-completed' : '') + (b.canceled ? ' is-canceled' : '');
            label.textContent = b.label;
            const time = document.createElement('span');
            time.className = 'tt-popover-list-time';
            time.textContent = WT.toHHMM(b.startMin);
            row.appendChild(label);
            row.appendChild(time);
            row.addEventListener('click', () => showPopoverForLog(b.logId, anchorEl));
            bodyEl.appendChild(row);
        });

        document.getElementById('ttPopoverDetailBtn').style.display = 'none';

        const pop = document.getElementById('ttPopover');
        pop.style.display = 'block';
        positionPopover(pop, anchorEl);
    }

    function showPopoverForLog(logId, anchorEl) {
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

        const addLine = (labelText, valueText, copyable, copyText) => {
            const line = document.createElement('div');
            line.className = 'tt-popover-line';
            const b = document.createElement('b');
            b.textContent = labelText;
            const span = document.createElement('span');
            span.textContent = valueText || '-';
            if (copyable && valueText) {
                span.classList.add('tt-copyable');
                span.onclick = () => copyToClipboard(copyText || valueText, span);
            }
            line.appendChild(b);
            line.appendChild(span);
            bodyEl.appendChild(line);
            return line;
        };

        if (groupCat === 'work') {
            addLine('타스크 번호', window.formatTaskNo?.(log.taskNo) || log.taskNo, true, String(log.taskNo || '').replace(/\s+/g, ''));
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
        positionPopover(pop, anchorEl);
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
