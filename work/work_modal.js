// work_modal.js (v2 - groups 통합)

window.openPop = (m) => {
    window.curMonth = m;
    document.getElementById('monthLabel').innerText = m + "월";
    document.getElementById('popupLayer').style.display = 'flex';
    window.renderCal(window.currentYear, m - 1);
};
window.closePop = () => { document.getElementById('popupLayer').style.display = 'none'; window.renderMain(); };

window.openQuickWorkModal = () => {
    let text = document.getElementById('quickInput').value.trim();
    if (!text) { alert("내용을 입력해주세요."); return; }
    let phoneRegex = /(?:0[0-9]{1,2}-[0-9]{3,4}-[0-9]{4}|[0-9]{4}-[0-9]{4}|0[0-9]{8,10})/g;
    let phones = text.match(phoneRegex);
    let address = text; let noteText = "";
    if (phones) { noteText = phones.join(', '); phones.forEach(p => { address = address.replace(p, ''); }); }
    address = address.trim();
    window.openWorkModal();
    if (address) document.getElementById('workAddress').value = address;
    if (noteText) document.getElementById('workNote').value = "연락처: " + noteText;
    document.getElementById('quickInput').value = "";
};

window.toggleDuty = () => {
    window.isWorkDuty = !window.isWorkDuty;
    const dutyBtn = document.getElementById('workDutyBtn');
    if (window.isWorkDuty) { dutyBtn.style.color = 'red'; dutyBtn.classList.add('active-btn'); }
    else { dutyBtn.style.color = 'var(--w-black)'; dutyBtn.classList.remove('active-btn'); }
};

// ─── 시작/종료/총시간 (특수 그룹: 태그 목록이 아니라 workStartTime/workEndTime 두 값만 다룸) ───

// 저장용 최종 총시간 — 시작/종료가 둘 다 있어야 계산됨(로그 저장 시 이것을 사용)
window.computeWorkDurationMin = () => {
    if (!window.workStartTime || !window.workEndTime) return null;
    const toMin = (t) => { const parts = t.split(':').map(Number); return (parts[0] || 0) * 60 + (parts[1] || 0); };
    let diff = toMin(window.workEndTime) - toMin(window.workStartTime);
    if (diff < 0) diff += 24 * 60; // 자정을 넘기는 근무(야간 등) 대응
    return diff;
};

// 화면 표시용 실시간 총시간 — 종료 전이면 "지금"을 임시 종료시각처럼 써서 실시간으로 흐르게 함
window.computeLiveDurationMin = () => {
    if (!window.workStartTime) return null;
    const endRef = window.workEndTime || window.getCurrentTimeString();
    const toMin = (t) => { const parts = t.split(':').map(Number); return (parts[0] || 0) * 60 + (parts[1] || 0); };
    let diff = toMin(endRef) - toMin(window.workStartTime);
    if (diff < 0) diff += 24 * 60;
    return diff;
};

window.renderWorkDuration = () => {
    const startBtn = document.getElementById('workStartBtn');
    const endBtn = document.getElementById('workEndBtn');
    const totalLabel = document.getElementById('workTotalTimeLabel');
    if (startBtn) {
        startBtn.innerText = window.workStartTime ? `시작 ${window.workStartTime}` : '시작';
        startBtn.classList.toggle('active-btn', !!window.workStartTime);
    }
    if (endBtn) {
        endBtn.innerText = window.workEndTime ? `종료 ${window.workEndTime}` : '종료';
        endBtn.classList.toggle('active-btn', !!window.workEndTime);
    }
    if (totalLabel) {
        const liveMin = window.computeLiveDurationMin();
        totalLabel.innerText = liveMin !== null ? window.formatDurationMin(liveMin) : '--:--';
    }
};

// 시작만 찍혀 있고 종료 전이면 총시간이 실시간으로 흐르도록 주기적으로 다시 그림
window.workDurationTimer = null;
window.startWorkDurationTimer = () => {
    window.stopWorkDurationTimer();
    window.workDurationTimer = setInterval(() => {
        if (window.workStartTime && !window.workEndTime) window.renderWorkDuration();
    }, 15000);
};
window.stopWorkDurationTimer = () => {
    clearTimeout(window.workDurationTimer);
    clearInterval(window.workDurationTimer);
    window.workDurationTimer = null;
};

// 시작/종료 버튼: 짧게 탭 = 토글(찍기 ↔ 오작동 대비 취소), 길게 누르면 시간 직접 수정 팝업
window.workDurationPressTimer = null;
window.workDurationLongPressed = false;

window.startDurationPress = (event, which) => {
    // 시작/종료는 기본그룹과 함께 잠금 예외라 잠긴 상태에서도 바로 눌러야 함
    if (event) event.preventDefault();
    window.workDurationLongPressed = false;
    clearTimeout(window.workDurationPressTimer);
    window.workDurationPressTimer = setTimeout(() => {
        window.workDurationLongPressed = true;
        if (navigator.vibrate) navigator.vibrate(30);
        window.openDurationTimeEditModal(which);
    }, 600);
};

window.endDurationPress = (event, which) => {
    if (event) event.preventDefault();
    clearTimeout(window.workDurationPressTimer);
    if (window.workDurationLongPressed) { window.workDurationLongPressed = false; return; }
    window.toggleDurationStamp(which);
};

window.cancelDurationPress = () => {
    clearTimeout(window.workDurationPressTimer);
    window.workDurationLongPressed = false;
};

window.toggleDurationStamp = (which) => {
    window.pushWorkUndo && window.pushWorkUndo();
    if (which === 'start') {
        window.workStartTime = window.workStartTime ? null : window.getCurrentTimeString();
    } else {
        window.workEndTime = window.workEndTime ? null : window.getCurrentTimeString();
    }
    window.renderWorkDuration();
};

// ─── 시작/종료 시간 직접 수정 팝업 (윈95 스타일, 4자리 24시간 입력) ───
window.durationEditTarget = null;

window.openDurationTimeEditModal = (which) => {
    window.durationEditTarget = which;
    const current = which === 'start' ? window.workStartTime : window.workEndTime;
    const input = document.getElementById('durationTimeEditInput');
    input.value = current ? current.replace(':', '') : '';
    document.getElementById('durationTimeEditTitle').innerText = which === 'start' ? '시작 시간 수정' : '종료 시간 수정';
    document.getElementById('durationTimeEditModal').style.display = 'flex';
    setTimeout(() => { input.focus(); input.select(); }, 50);
};

window.closeDurationTimeEditModal = () => {
    document.getElementById('durationTimeEditModal').style.display = 'none';
    window.durationEditTarget = null;
};

window.saveDurationTimeEdit = () => {
    const input = document.getElementById('durationTimeEditInput');
    window.formatTimeInput(input);
    if (!input.value) { alert('시간을 입력하세요.'); return; }
    window.pushWorkUndo && window.pushWorkUndo();
    if (window.durationEditTarget === 'start') window.workStartTime = input.value;
    else if (window.durationEditTarget === 'end') window.workEndTime = input.value;
    window.renderWorkDuration();
    window.closeDurationTimeEditModal();
};

// ─── OT: 당직과 동일하게 작업일지 1개당 켜짐/꺼짐(on/off) — 탭하면 그냥 토글 ───
// 버튼에 표시하는 숫자는 "이번 로그의 OT 값"이 아니라 "이번 달 OT 건수"(다른 태그의 [숫자]처럼).
// 지금 열려있는 로그가 이미 저장된 것이라면 그 로그의 기존 상태를 이번 달 집계에서 빼고,
// 지금 켜져 있는 상태를 다시 더해서 저장 전에도 실시간으로 반영되게 한다.
window.getOTMonthlyCount = () => {
    return (window.logs || []).filter((l) =>
        l && l.cat === 'work' && l.y === window.currentYear && l.m === window.curMonth && Number(l.otCount) > 0
    ).length;
};

window.renderWorkOT = () => {
    const btn = document.getElementById('workOTBtn');
    if (!btn) return;
    const isOn = Number(window.workOTCount) > 0;
    const existingLog = window.currentWorkId ? window.logs.find((l) => l.id === window.currentWorkId) : null;
    const wasOn = existingLog && Number(existingLog.otCount) > 0 ? 1 : 0;
    const displayCount = Math.max(0, window.getOTMonthlyCount() - wasOn + (isOn ? 1 : 0));
    btn.innerText = String(displayCount);
    btn.style.color = isOn ? 'var(--w-blue)' : 'var(--w-black)';
    btn.classList.toggle('active-btn', isOn);
};

// OT는 기본그룹 소속이라 잠금 예외(setWorkEditLocked)라서 여기서 잠금 여부를 따로 막지 않는다
window.toggleOT = () => {
    window.pushWorkUndo && window.pushWorkUndo();
    window.workOTCount = window.workOTCount ? 0 : 1;
    window.renderWorkOT();
};

window.updateWorkDateLabel = () => {
    const dateVal = document.getElementById('workDateInput').value;
    const labelEl = document.getElementById('workDayLabel');
    if (dateVal) {
        const d = new Date(dateVal);
        const days = ['일', '월', '화', '수', '목', '금', '토'];
        const mStr = String(d.getMonth() + 1).padStart(2, '0');
        const dStr = String(d.getDate()).padStart(2, '0');
        labelEl.innerText = `${mStr}.${dStr}(${days[d.getDay()]})`;
        if (d.getDay() === 0) labelEl.style.color = 'red';
        else if (d.getDay() === 6) labelEl.style.color = 'var(--sat)';
        else labelEl.style.color = 'var(--w-blue)';
    } else { labelEl.innerText = ''; }
};

window.applyCustomTitles = () => {
    // v2: groups에서 타이틀 적용
    window.getAllGroupsSorted().forEach(g => {
        const el = document.getElementById('boxTitle_' + g.id);
        if (el) el.innerText = g.title;
        window.applyGroupActiveStyle(g.id);
    });

    // 날짜/시간/당직 등 고정 필드 그룹(basicFields)은 groups 데이터가 아니라 별도 키로 저장
    const basicTitle = localStorage.getItem('wm_basic_group_title');
    if (basicTitle) {
        const basicEl = document.getElementById('boxTitle_basicFields');
        if (basicEl) basicEl.innerText = basicTitle;
    }

    // 내보내기 설정과도 연동
    let saved = localStorage.getItem('wm_export_conf');
    if (saved) {
        try {
            let parsed = JSON.parse(saved);
            if (parsed.customNames) {
                parsed.customNames.forEach(cn => {
                    let el = document.getElementById('boxTitle_' + cn.id);
                    if (el) el.innerText = cn.name;
                });
            }
        } catch (e) { }
    }
};

window.titlePressTimer = null;
window.titleLongPressed = false;

window.startTitlePress = (e, id) => {
    e.preventDefault();
    window.titleLongPressed = false;
    clearTimeout(window.titlePressTimer);
    if (!window.isWorkLayoutMode) return;
    window.titlePressTimer = setTimeout(() => {
        window.titleLongPressed = true;
        if (navigator.vibrate) navigator.vibrate(30);
        window.renameBoxTitle(id);
    }, 600);
};

// 일반 작성에서는 짧은 탭으로 집계 상태가 우발적으로 바뀌지 않게 한다.
window.endTitlePress = (id) => {
    clearTimeout(window.titlePressTimer);
    if (window.titleLongPressed) { window.titleLongPressed = false; return; }
    if (id && !window.isWorkLayoutMode) window.toggleCurrentWorkGroupExcluded(id);
};

window.cancelTitlePress = () => {
    clearTimeout(window.titlePressTimer);
    window.titleLongPressed = false;
};

// 활성=기존 파란색, 비활성=대비되는 빨간색으로 그룹명 색을 바꿔 한눈에 상태를 알 수 있게 함
window.applyGroupActiveStyle = (id) => {
    if (id === 'duration' || id === 'basicFields') return;
    const el = document.getElementById('boxTitle_' + id);
    if (!el) return;
    const logExcluded = !window.isWorkLayoutMode && window.isCurrentWorkGroupExcluded?.(id);
    el.classList.toggle('is-log-excluded', !!logExcluded);
    el.style.color = logExcluded ? '#dc2626' : 'var(--w-blue)';
    el.title = window.isWorkLayoutMode
        ? '길게 눌러 이름 변경'
        : `현재 일지 집계 ${logExcluded ? '제외' : '포함'} · 탭해서 변경`;
};

window.renameBoxTitle = (id) => {
    if (!window.isWorkLayoutMode) return;
    const el = document.getElementById('boxTitle_' + id);
    if (!el) return;
    document.getElementById('titleEditTargetId').value = id;
    document.getElementById('titleEditInput').value = el.innerText;
    const group = window.getGroupById && window.getGroupById(id);
    const builtIn = window.BUILT_IN_GROUP_IDS || ['taskTypes', 'coworkers', 'statuses', 'equipments', 'memoTags', 'duration'];
    const toggleBtn = document.getElementById('cardTitleVisibleBtn');
    window.pendingCardTitleVisible = !!group?.cardTitleVisible;
    if (toggleBtn) {
        toggleBtn.style.display = group && !builtIn.includes(id) ? '' : 'none';
        toggleBtn.classList.toggle('active-btn', window.pendingCardTitleVisible);
        toggleBtn.textContent = window.pendingCardTitleVisible ? '카드 제목 표시' : '카드 제목 숨김';
    }
    document.getElementById('titleEditModal').style.display = 'flex';
    setTimeout(() => { document.getElementById('titleEditInput').focus(); document.getElementById('titleEditInput').select(); }, 50);
};

window.saveBoxTitle = () => {
    const id = document.getElementById('titleEditTargetId').value;
    const newName = document.getElementById('titleEditInput').value.trim();
    if (!newName) return alert("이름을 입력하세요.");

    const el = document.getElementById('boxTitle_' + id);
    if (el) el.innerText = newName;

    // v2: groups 타이틀 업데이트
    const g = window.getGroupById && window.getGroupById(id);
    if (g) {
        g.title = newName;
        const builtIn = window.BUILT_IN_GROUP_IDS || ['taskTypes', 'coworkers', 'statuses', 'equipments', 'memoTags', 'duration'];
        if (!builtIn.includes(id)) g.cardTitleVisible = !!window.pendingCardTitleVisible;
        window.markDirty('master', 'groups', 'upsert');
        window.saveLocal('group-title');
    } else if (id === 'basicFields') {
        // 날짜/시간/당직 등 고정 필드 그룹은 groups 데이터가 아니므로 별도 키에 저장
        localStorage.setItem('wm_basic_group_title', newName);
    }

    // 내보내기 UI 연동
    if (window.WorkExportUI) {
        const uiCol = window.WorkExportUI.columnsMaster.find(c => c.id === id);
        if (uiCol) uiCol.customName = newName;
        window.WorkExportUI.render();
    }

    window.updateUI?.();

    document.getElementById('titleEditModal').style.display = 'none';
};

window.applySavedDragOrder = () => {
    let savedOrder = localStorage.getItem('wm_work_drag_order');
    if (savedOrder) {
        try {
            let orderArr = JSON.parse(savedOrder);
            let container = document.getElementById('workDragContainer');
            if (container) {
                orderArr.forEach(id => {
                    let el = container.querySelector(`.drag-item[data-id="${id}"]`);
                    if (el) container.appendChild(el);
                });
            }
        } catch (e) { }
    }
};

// ─── 그룹 메뉴 (수정 모드에서 초기화 버튼 왼쪽) ───
window.renderGroupMenu = () => {
    const container = document.getElementById('workGroupMenuArea');
    if (!container) return;

    const groups = window.getAllGroupsSorted();
    const builtIn = ['taskTypes', 'coworkers', 'statuses', 'equipments', 'memoTags'];

    let html = `
        <div style="display:flex; gap:4px; flex-wrap:wrap; align-items:center;">
            <button type="button" class="w95-btn" style="font-size:0.75rem; height:28px; color:var(--w-blue); font-weight:bold;"
                onclick="window.promptAddGroup()">
                <i class="fa-solid fa-plus"></i> 그룹
            </button>`;

    groups.forEach(g => {
        const isDisabled = !g.enabled;
        const isCustom = !builtIn.includes(g.id);
        html += `
            <div style="display:inline-flex; align-items:center; gap:2px; background:${isDisabled ? '#e5e7eb' : '#f0fdf4'}; border:1px solid ${isDisabled ? '#9ca3af' : '#6ee7b7'}; border-radius:4px; padding:2px 4px; font-size:0.72rem;">
                <span style="color:${isDisabled ? '#6b7280' : '#065f46'}; ${isDisabled ? 'text-decoration:line-through;' : ''} font-weight:bold;">${g.title}</span>
                <button type="button" class="w95-btn" style="height:20px; width:20px; padding:0; font-size:0.65rem; color:${isDisabled ? '#059669' : '#dc2626'}; min-width:20px;"
                    onclick="window.promptToggleGroup('${g.id}')" title="${isDisabled ? '활성화' : '비활성화'}">
                    ${isDisabled ? '▶' : '■'}
                </button>
                ${isCustom ? `<button type="button" class="w95-btn" style="height:20px; width:20px; padding:0; font-size:0.65rem; color:#dc2626; min-width:20px;"
                    onclick="window.promptRemoveGroup('${g.id}')" title="삭제">✕</button>` : ''}
            </div>`;
    });

    html += `</div>`;
    container.innerHTML = html;
};

// ─── 커스텀 그룹 섹션 동적 생성 (작업일지 모달 내) ───
window.renderCustomGroupSections = () => {
    const container = document.getElementById('customGroupSections');
    const dragContainer = document.getElementById('workDragContainer');
    const builtIn = window.BUILT_IN_GROUP_IDS || ['taskTypes', 'coworkers', 'statuses', 'equipments', 'memoTags', 'duration'];
    const customGroups = window.getAllGroupsSorted().filter(g => !builtIn.includes(g.id));

    // 현재 레이아웃은 별도 customGroupSections 없이 모든 선택상자를 workDragContainer에
    // 같은 레벨로 둔다. 저장된 커스텀 그룹을 매번 그 위치에 복원해야 데이터 삭제/재렌더 후에도
    // 그룹 상자 자체가 사라지지 않는다.
    if (!container && dragContainer) {
        const validIds = new Set(customGroups.map(g => g.id));
        [...dragContainer.querySelectorAll(':scope > .drag-item[data-custom-group="1"]')].forEach(el => {
            if (!validIds.has(el.dataset.groupRef)) el.remove();
        });

        customGroups.forEach(g => {
            const safeTitle = window.escapeHtml ? window.escapeHtml(g.title) : String(g.title || '')
                .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
            let groupEl = dragContainer.querySelector(`:scope > .drag-item[data-group-ref="${g.id}"]`);
            if (g.enabled === false) {
                if (groupEl) groupEl.remove();
                return;
            }
            if (!groupEl) {
                groupEl = document.createElement('div');
                groupEl.className = 'drag-item w95-in';
                groupEl.dataset.id = g.id;
                groupEl.dataset.groupRef = g.id;
                groupEl.dataset.customGroup = '1';
                groupEl.dataset.cols = '4';
                groupEl.dataset.rows = '1';
                groupEl.innerHTML = `
                    <div id="boxTitle_${g.id}" class="box-title" title="탭해서 집계 포함/제외"
                        onmousedown="window.startTitlePress(event, '${g.id}')" onmouseup="window.endTitlePress('${g.id}')" onmouseleave="window.cancelTitlePress()"
                        ontouchstart="window.startTitlePress(event, '${g.id}')" ontouchend="window.endTitlePress('${g.id}')" ontouchcancel="window.cancelTitlePress()">${safeTitle}</div>
                    <div id="customGroupArea_${g.id}" class="btn-tag-area"></div>
                    <div class="drag-handle"><i class="fa-solid fa-circle" style="font-size:5px;"></i></div>`;
                dragContainer.appendChild(groupEl);
            }
            window.renderCustomGroup?.(g.id);
        });
        return;
    }

    if (!container) return;

    if (customGroups.length === 0) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = customGroups.map(g => {
        const isDisabled = !g.enabled;
        if (isDisabled) return ''; // 비활성 그룹은 작업일지에 미표시

        return `
            <div class="drag-item w95-out" data-id="custom_${g.id}" style="margin-bottom:4px;">
                <div style="display:flex; justify-content:space-between; align-items:center; padding:4px 8px; background:var(--w-gray); border-bottom:1px solid var(--w-border);">
                    <b id="boxTitle_${g.id}" class="box-title" style="font-size:0.8rem; color:#7c3aed;"
                        onmousedown="window.startTitlePress(event, '${g.id}')" onmouseup="window.endTitlePress()"
                        ontouchstart="window.startTitlePress(event, '${g.id}')" ontouchend="window.endTitlePress()">${g.title}</b>
                    <span class="drag-handle" style="cursor:grab; padding:0 6px; color:#94a3b8; font-size:1.1rem;">⠿</span>
                </div>
                <div id="customGroupArea_${g.id}" style="padding:6px 8px; display:flex; flex-wrap:wrap; gap:4px;"></div>
            </div>
        `;
    }).join('');

    // 각 커스텀 그룹 태그 렌더링
    customGroups.filter(g => g.enabled !== false).forEach(g => {
        window.renderCustomGroup(g.id);
    });
};

// ─── 작업일지 모달 열기 ───
window.openWorkModal = (id = null) => {
    window.currentWorkId = id;
    window.workImgs = [];
    window.selectedCoworkers = [];
    window.activeStatus = null;
    window.activeEquips = {};
    window.activeCustomGroupSelections = {};
    window.currentWorkExcludedGroups = [];

    let y = window.currentYear, m = window.curMonth, d = window.curDay;
    window.isWorkDuty = false;
    window.workStartTime = null;
    window.workEndTime = null;

    if (id) {
        const log = window.logs.find(l => l.id === id);
        if (!log) return;
        y = log.y || window.currentYear; m = log.m; d = log.d;
        document.getElementById('workTime').value = log.workTime ? log.workTime.replace(':', '') : "";
        document.getElementById('taskNo').value = log.taskNo || "";
        document.getElementById('customerName').value = log.customerName || "";
        window.activeTaskTypes = log.taskType ? log.taskType.split(', ') : [];
        const addrEl = document.getElementById('workAddress'); if (addrEl) addrEl.value = log.address || "";
        document.getElementById('workContent').value = log.content || "";
        document.getElementById('workNote').value = log.note || "";
        window.workOTCount = Number(log.otCount) || 0;
        window.activeStatus = log.status || null;
        if (log.coworkers) window.selectedCoworkers = [...log.coworkers];
        if (log.imgs) window.workImgs = [...log.imgs];
        if (log.equips) window.activeEquips = { ...log.equips };
        window.currentWorkExcludedGroups = Array.isArray(log.excludedGroups) ? [...log.excludedGroups] : [];
        window.isWorkDuty = log.isDuty || false;
        window.workStartTime = log.startTime || null;
        window.workEndTime = log.endTime || null;

        // 커스텀 그룹 선택 복원
        if (log.customGroups) {
            Object.keys(log.customGroups).forEach(gId => {
                window.activeCustomGroupSelections[gId] = [...(log.customGroups[gId] || [])];
            });
        }
    } else {
        document.getElementById('workTime').value = "";
        document.getElementById('taskNo').value = "";
        document.getElementById('customerName').value = "";
        window.activeTaskTypes = [];
        const addrEl = document.getElementById('workAddress'); if (addrEl) addrEl.value = "";
        document.getElementById('workContent').value = "";
        const noteEl = document.getElementById('workNote'); if (noteEl) noteEl.value = "";
        window.workOTCount = 0;
        const todayLogs = window.logs.filter(l => l.y === window.currentYear && l.m === window.curMonth && l.d === window.curDay);
        window.isWorkDuty = todayLogs.some(l => l.cat === 'work' && l.isDuty);

        // 기억(그룹별): 새 작업일지를 열 때, 기억이 켜진 그룹만 마지막 선택값을 그대로 적용
        (window.getActiveGroups ? window.getActiveGroups() : []).forEach(g => {
            if (g.id === 'duration' || !g.remember) return;
            const val = window.getGroupRememberedValue(g.id);
            if (val === undefined) return;
            if (g.id === 'taskTypes') window.activeTaskTypes = Array.isArray(val) ? [...val] : [];
            else if (g.id === 'coworkers') window.selectedCoworkers = Array.isArray(val) ? [...val] : [];
            else if (g.id === 'statuses') window.activeStatus = val || null;
            else if (g.id === 'equipments') window.activeEquips = { ...(val || {}) };
            else window.activeCustomGroupSelections[g.id] = Array.isArray(val) ? [...val] : [];
        });
    }

    const dutyBtn = document.getElementById('workDutyBtn');
    if (window.isWorkDuty) { dutyBtn.style.color = 'red'; dutyBtn.classList.add('active-btn'); }
    else { dutyBtn.style.color = 'var(--w-black)'; dutyBtn.classList.remove('active-btn'); }
    window.renderWorkOT();

    window.updateRememberModeBtn && window.updateRememberModeBtn();
    window.refreshRememberDots && window.refreshRememberDots();

    const editSaveBtn = document.getElementById('workEditSaveBtn');
    if (editSaveBtn) editSaveBtn.style.display = id ? 'block' : 'none';

    document.getElementById('workDateInput').value = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    window.updateWorkDateLabel();

    // 커스텀 그룹 섹션 생성 후 전체 렌더링
    window.renderCustomGroupSections();
    window.renderAllWorkGroups();
    window.renderWorkPhotoGrid();

    window.applySavedDragOrder();
    window.applyCustomTitles();

    document.getElementById('workModal').style.display = 'flex';
    window.initWorkDragListeners();
    if (window.setWorkEditLocked) window.setWorkEditLocked(!!id);
    window.startWorkDurationTimer && window.startWorkDurationTimer();
};

window.closeWorkModal = () => {
    window.stopWorkDurationTimer && window.stopWorkDurationTimer();
    document.getElementById('workModal').style.display = 'none';
    document.getElementById('workAddress').value = "";
    document.getElementById('workNote').value = "";
};

// ─── 드래그 엔진 ───
window.hasInitDragListeners = false;
window.initWorkDragListeners = () => {
    if (window.hasInitDragListeners) return;
    const container = document.getElementById('workDragContainer');
    if (!container) return;

    let dragEl = null;
    let dragTimeout = null;

    const startDrag = (e) => {
        const isHandle = e.target.classList.contains('drag-handle') || e.target.closest('.drag-handle') === e.target;
        if (!isHandle) return;
        dragTimeout = setTimeout(() => {
            dragEl = e.target.closest('.drag-item');
            if (dragEl) { dragEl.classList.add('dragging'); if (navigator.vibrate) navigator.vibrate(30); }
        }, 200);
    };

    const moveDrag = (e) => {
        if (!dragEl) { clearTimeout(dragTimeout); return; }
        e.preventDefault();
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const siblings = [...container.querySelectorAll('.drag-item:not(.dragging)')];
        const nextSibling = siblings.find(sib => {
            const rect = sib.getBoundingClientRect();
            return clientY < rect.top + rect.height / 2;
        });
        if (nextSibling) container.insertBefore(dragEl, nextSibling);
        else container.appendChild(dragEl);
    };

    const endDrag = (e) => {
        clearTimeout(dragTimeout);
        if (!dragEl) return;
        dragEl.classList.remove('dragging');
        dragEl = null;
        const newOrder = [...container.querySelectorAll('.drag-item')].map(i => i.getAttribute('data-id'));
        localStorage.setItem('wm_work_drag_order', JSON.stringify(newOrder));
    };

    container.addEventListener('touchstart', startDrag, { passive: true });
    container.addEventListener('touchmove', moveDrag, { passive: false });
    container.addEventListener('touchend', endDrag);
    container.addEventListener('touchcancel', endDrag);
    container.addEventListener('mousedown', startDrag);
    window.addEventListener('mousemove', moveDrag, { passive: false });
    window.addEventListener('mouseup', endDrag);

    window.hasInitDragListeners = true;
};

// ─── 수정 모드 진입/해제 시 그룹 메뉴 토글 ───
const _origSetWorkEditLocked = window.setWorkEditLocked;
window.setWorkEditLocked = (locked) => {
    if (_origSetWorkEditLocked) _origSetWorkEditLocked(locked);
    // 그룹 메뉴는 수정 모드(locked=false)일 때만 표시
    const menuArea = document.getElementById('workGroupMenuArea');
    if (menuArea) {
        if (!locked) {
            menuArea.style.display = 'flex';
            window.renderGroupMenu();
        } else {
            menuArea.style.display = 'none';
        }
    }
};

// ─── 출퇴근 모달 ───
window.openCommuteModal = (type) => {
    window.currentCommuteType = type;
    window.isCommuteException = false;
    window.calculatedOvertimeMin = 0;
    window.tempCommuteImg = null;
    window.tempCommuteOriginalName = "";
    if (window.removeCommuteImg) window.removeCommuteImg();

    let lastKm = '';
    const lastKmLog = [...window.logs].reverse().find(l => (l.cat === 'commute_in' || l.cat === 'commute_out') && l.km);
    if (lastKmLog) lastKm = lastKmLog.km;

    document.getElementById('commuteTime').value = window.getCurrentTimeString().replace(':', '');
    document.getElementById('commuteKm').value = lastKm;
    document.getElementById('commuteNote').value = '';

    const baseEl = document.getElementById('commuteBaseTime');
    const editBtn = document.getElementById('editBaseTimeBtn');
    baseEl.setAttribute('readonly', true);
    baseEl.style.background = '#e2e8f0';
    baseEl.style.color = '#475569';
    editBtn.classList.remove('active-btn');

    const excBtn = document.getElementById('commuteExceptionBtn');
    excBtn.style.color = '';
    excBtn.classList.remove('active-btn');

    if (type === 'in') {
        document.getElementById('commuteTitle').innerHTML = '<i class="fa-solid fa-sign-in-alt"></i> 출근 기록';
        document.getElementById('commuteBaseTime').value = '09:00';
        document.getElementById('commuteOvertime').value = '00:00';
    } else {
        document.getElementById('commuteTitle').innerHTML = '<i class="fa-solid fa-sign-out-alt"></i> 퇴근 기록';
        document.getElementById('commuteBaseTime').value = '18:00';
        document.getElementById('commuteOvertime').value = '00:00';
    }

    const todayLogs = window.logs.filter(l => l.y === window.currentYear && l.m === window.curMonth && l.d === window.curDay);
    const existingLog = todayLogs.find(l => l.cat === (type === 'in' ? 'commute_in' : 'commute_out'));
    if (existingLog) {
        document.getElementById('commuteTime').value = existingLog.time ? existingLog.time.replace(':', '') : '';
        document.getElementById('commuteKm').value = existingLog.km || lastKm;
        document.getElementById('commuteNote').value = existingLog.commuteNote || '';
        if (existingLog.imgs && existingLog.imgs.length > 0) {
            window.tempCommuteImg = existingLog.imgs[0].src;
            window.tempCommuteOriginalName = existingLog.imgs[0].originalName || "";
            document.getElementById('commuteNoPhotoText').style.display = 'none';
            const preview = document.getElementById('commuteImgPreview');
            preview.style.display = 'block';
            preview.src = window.tempCommuteImg;
            document.getElementById('commuteImgDelBtn').style.display = 'block';
        }
        window.isCommuteException = (type === 'in') ? existingLog.inException : existingLog.outException;
        if (window.isCommuteException) { excBtn.style.color = 'var(--sun)'; excBtn.classList.add('active-btn'); }
    }

    setTimeout(() => {
        window.formatTimeInput(document.getElementById('commuteTime'));
        if (window.updateOvertime) window.updateOvertime();
    }, 50);

    document.getElementById('commuteModal').style.display = 'flex';
};

window.closeCommuteModal = () => { document.getElementById('commuteModal').style.display = 'none'; };

window.toggleEditBaseTime = () => {
    const el = document.getElementById('commuteBaseTime');
    const btn = document.getElementById('editBaseTimeBtn');
    if (el.hasAttribute('readonly')) {
        el.removeAttribute('readonly'); el.style.background = 'var(--w-white)'; el.style.color = 'var(--w-black)'; btn.classList.add('active-btn'); el.focus();
    } else {
        el.setAttribute('readonly', true); el.style.background = '#e2e8f0'; el.style.color = '#475569'; btn.classList.remove('active-btn');
    }
};

window.toggleException = () => {
    window.isCommuteException = !window.isCommuteException;
    const btn = document.getElementById('commuteExceptionBtn');
    if (window.isCommuteException) { btn.style.color = 'var(--sun)'; btn.classList.add('active-btn'); }
    else { btn.style.color = ''; btn.classList.remove('active-btn'); }
    if (window.updateOvertime) window.updateOvertime();
};

// ─── 편집 모달 ───
window.openEditModal = (id) => {
    window.editingLogId = id;
    const log = window.logs.find(l => l.id === id);
    if (!log) return;
    document.getElementById('editMemo').value = log.memo || '';
    window.activeEditTags = log.tags ? [...log.tags] : [];

    if (id.startsWith('calc_commute_')) {
        if (!window.activeEditTags.includes('상세내역')) window.activeEditTags.push('상세내역');
        const g = window.getGroupById('memoTags');
        if (g && !g.tags.find(t => t.name === '상세내역')) {
            g.tags.push({ name: '상세내역', count: 1 });
        }
    }

    if (window.renderEditPhotoGrid) window.renderEditPhotoGrid();
    if (window.renderMemoTags) window.renderMemoTags();
    document.getElementById('editModal').style.display = 'flex';
};

window.closeEditModal = () => {
    document.getElementById('editModal').style.display = 'none';
    window.editingLogId = null;
    window.activeEditTags = [];
};

window.closeTagEditModal = () => {
    document.getElementById('tagEditModal').style.display = 'none';
    window.editingTagType = null;
    window.editingTagIndex = -1;
    window.tempEquipQty = 0;
};

window.closeMapAppModal = () => { document.getElementById('mapAppModal').style.display = 'none'; };

// ─── 검색 ───
window.openSearch = () => {
    document.getElementById('searchLayer').style.display = 'flex';
    document.getElementById('searchInput').value = '';
    document.getElementById('activeFiltersArea').innerHTML = '';
    document.getElementById('searchSummary').style.display = 'none';
    document.getElementById('searchMonth').innerHTML = '<option value="">[ 월 전체 ]</option>' + [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => `<option value="${m}">${m}월</option>`).join('');
    document.getElementById('searchOX').innerHTML = '<option value="">[ O/X ]</option><option value="O">O 표시</option><option value="X">X 표시</option>';
    window.updateSearchFilters(null);
    document.getElementById('searchResultList').innerHTML = '';
};

window.closeSearch = () => { document.getElementById('searchLayer').style.display = 'none'; };

// ─── 휴지통 ───
window.openTrash = () => { document.getElementById('trashLayer').style.display = 'flex'; window.renderTrash(); };
window.closeTrash = () => { document.getElementById('trashLayer').style.display = 'none'; window.renderMain(); };
window.clearTrash = () => {
    if (confirm('휴지통을 모두 비우시겠습니까? 복원할 수 없습니다.')) {
        window.trash = [];
        window.saveLocal();
        window.renderTrash();
    }
};
window.restoreLog = (id) => {
    const log = window.trash.find(t => t.id === id);
    if (log) {
        window.trash = window.trash.filter(t => t.id !== id);
        window.logs.push(log);
        window.saveLocal();
        window.renderTrash();
        alert('항목이 복원되었습니다.');
    }
};

// ─── 이미지 뷰어 ───
window.openImageViewer = (idx, mode, refId = null) => {
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    window.currentViewerMode = mode;
    window.currentViewerRefId = refId;
    let imgArray = [];
    if (mode === 'temp') imgArray = window.tempImgs;
    else if (mode === 'work') imgArray = window.workImgs;
    else if (mode === 'tempCommute') imgArray = window.tempCommuteImg ? [{ src: window.tempCommuteImg, originalName: window.tempCommuteOriginalName || "" }] : [];
    else if (mode === 'log' || mode === 'edit') {
        const log = window.logs.find(l => l.id === refId);
        if (log) imgArray = log.imgs || [];
    }

    window.currentViewerImages = imgArray;
    window.currentViewerIndex = idx;
    if (!imgArray || imgArray.length === 0 || idx < 0 || idx >= imgArray.length) return;

    const vImg = document.getElementById('viewerImg');
    vImg.style.transform = `translate(0px, 0px) scale(1)`;
    vImg.src = imgArray[idx].src;
    document.getElementById('imageViewer').style.display = 'flex';

    const delBtn = document.getElementById('deleteImgBtn');
    if (mode === 'log' || mode === 'tempCommute') delBtn.style.display = 'none';
    else delBtn.style.display = 'inline-flex';
};

window.closeImageViewer = () => {
    document.getElementById('imageViewer').style.display = 'none';
    document.getElementById('viewerImg').src = "";
    window.currentViewerIndex = -1;
};

window.toggleCardTitleVisible = () => {
    window.pendingCardTitleVisible = !window.pendingCardTitleVisible;
    const btn = document.getElementById('cardTitleVisibleBtn');
    if (!btn) return;
    btn.classList.toggle('active-btn', window.pendingCardTitleVisible);
    btn.textContent = window.pendingCardTitleVisible ? '카드 제목 표시' : '카드 제목 숨김';
};

window.toggleCurrentWorkGroupExcluded = (id) => {
    if (!id || id === 'duration' || id === 'basicFields') return;
    window.pushWorkUndo?.();
    const excluded = new Set(window.currentWorkExcludedGroups || []);
    if (excluded.has(id)) excluded.delete(id);
    else excluded.add(id);
    window.currentWorkExcludedGroups = [...excluded];
    window.applyGroupActiveStyle(id);
};
