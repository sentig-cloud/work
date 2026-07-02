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
window.startTitlePress = (e, id) => {
    e.preventDefault();
    window.titlePressTimer = setTimeout(() => {
        if (navigator.vibrate) navigator.vibrate(30);
        window.renameBoxTitle(id);
    }, 600);
};
window.endTitlePress = () => { clearTimeout(window.titlePressTimer); };

window.renameBoxTitle = (id) => {
    const el = document.getElementById('boxTitle_' + id);
    if (!el) return;
    document.getElementById('titleEditTargetId').value = id;
    document.getElementById('titleEditInput').value = el.innerText;
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
    if (!container) return;

    const builtIn = ['taskTypes', 'coworkers', 'statuses', 'equipments', 'memoTags'];
    const customGroups = window.getAllGroupsSorted().filter(g => !builtIn.includes(g.id));

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

    let y = window.currentYear, m = window.curMonth, d = window.curDay;
    window.isWorkDuty = false;

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
        document.getElementById('workOT').value = log.ot || "";
        window.activeStatus = log.status || null;
        if (log.coworkers) window.selectedCoworkers = [...log.coworkers];
        if (log.imgs) window.workImgs = [...log.imgs];
        if (log.equips) window.activeEquips = { ...log.equips };
        window.isWorkDuty = log.isDuty || false;

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
        document.getElementById('workOT').value = "";
        const todayLogs = window.logs.filter(l => l.y === window.currentYear && l.m === window.curMonth && l.d === window.curDay);
        window.isWorkDuty = todayLogs.some(l => l.cat === 'work' && l.isDuty);
    }

    const dutyBtn = document.getElementById('workDutyBtn');
    if (window.isWorkDuty) { dutyBtn.style.color = 'red'; dutyBtn.classList.add('active-btn'); }
    else { dutyBtn.style.color = 'var(--w-black)'; dutyBtn.classList.remove('active-btn'); }

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
};

window.closeWorkModal = () => {
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
    else if (mode === 'tempCommute') imgArray = window.tempCommuteImg ? [{ src: window.tempCommuteImg }] : [];
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