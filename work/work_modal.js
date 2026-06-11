// work_modal.js

window.openPop = (m) => { 
    window.curMonth = m; 
    document.getElementById('monthLabel').innerText = m + "월"; 
    document.getElementById('popupLayer').style.display = 'flex'; 
    window.renderCal(window.currentYear, m-1); 
};
window.closePop = () => { document.getElementById('popupLayer').style.display = 'none'; window.renderMain(); };

window.openQuickWorkModal = () => {
    let text = document.getElementById('quickInput').value.trim();
    if(!text) { alert("내용을 입력해주세요."); return; }
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
    if(window.isWorkDuty) { dutyBtn.style.color = 'red'; dutyBtn.classList.add('active-btn'); } 
    else { dutyBtn.style.color = 'var(--w-black)'; dutyBtn.classList.remove('active-btn'); }
};

window.updateWorkDateLabel = () => {
    const dateVal = document.getElementById('workDateInput').value;
    const labelEl = document.getElementById('workDayLabel');
    if (dateVal) {
        const d = new Date(dateVal);
        const days = ['일','월','화','수','목','금','토'];
        const mStr = String(d.getMonth()+1).padStart(2,'0');
        const dStr = String(d.getDate()).padStart(2,'0');
        // 🚨 연도 제외하고 월.일(요일) 포맷으로 극한 압축
        labelEl.innerText = `${mStr}.${dStr}(${days[d.getDay()]})`; 
        
        if (d.getDay() === 0) labelEl.style.color = 'red';
        else if (d.getDay() === 6) labelEl.style.color = 'var(--sat)';
        else labelEl.style.color = 'var(--w-blue)';
    } else { labelEl.innerText = ''; }
};

// 🚨 타이틀 동기화 (내보내기 UI 연동)
window.applyCustomTitles = () => {
    let saved = localStorage.getItem('workExportConfig');
    if(saved) {
        try {
            let parsed = JSON.parse(saved);
            if(parsed.master) {
                parsed.master.forEach(c => {
                    let el = document.getElementById('boxTitle_' + c.id);
                    if(el) el.innerText = c.customName;
                });
            }
        } catch(e){}
    }
};

window.titlePressTimer = null;
window.startTitlePress = (e, id) => {
    e.preventDefault();
    window.titlePressTimer = setTimeout(() => {
        if(navigator.vibrate) navigator.vibrate(30);
        window.renameBoxTitle(id);
    }, 600); // 0.6초 롱탭
};
window.endTitlePress = () => { clearTimeout(window.titlePressTimer); };

window.renameBoxTitle = (id) => {
    let el = document.getElementById('boxTitle_' + id);
    if(!el) return;
    document.getElementById('titleEditTargetId').value = id;
    document.getElementById('titleEditInput').value = el.innerText;
    document.getElementById('titleEditModal').style.display = 'flex';
    setTimeout(() => { document.getElementById('titleEditInput').focus(); document.getElementById('titleEditInput').select(); }, 50);
};

window.saveBoxTitle = () => {
    let id = document.getElementById('titleEditTargetId').value;
    let newName = document.getElementById('titleEditInput').value.trim();
    if(!newName) return alert("이름을 입력하세요.");
    
    let el = document.getElementById('boxTitle_' + id);
    if(el) el.innerText = newName;
    
    let saved = localStorage.getItem('workExportConfig');
    let parsed = null;
    if(saved) { try { parsed = JSON.parse(saved); } catch(e){} }
    if(!parsed) parsed = { order: [], master: window.WorkExportUI ? window.WorkExportUI.columnsMaster : [] };
    
    if(parsed.master) {
        let col = parsed.master.find(c => c.id === id);
        if(col) col.customName = newName;
        localStorage.setItem('workExportConfig', JSON.stringify(parsed));
    }
    
    if(window.WorkExportUI) {
        let uiCol = window.WorkExportUI.columnsMaster.find(c => c.id === id);
        if(uiCol) uiCol.customName = newName;
        window.WorkExportUI.render();
    }
    document.getElementById('titleEditModal').style.display = 'none';
};

window.applySavedDragOrder = () => {
    let savedOrder = localStorage.getItem('wm_work_drag_order');
    if(savedOrder) {
        try {
            let orderArr = JSON.parse(savedOrder);
            let container = document.getElementById('workDragContainer');
            if(container) {
                orderArr.forEach(id => {
                    let el = container.querySelector(`.drag-item[data-id="${id}"]`);
                    if(el) container.appendChild(el);
                });
            }
        } catch(e){}
    }
};

window.openWorkModal = (id = null) => { 
    window.currentWorkId = id; window.workImgs = []; window.selectedCoworkers = []; window.activeStatus = null; window.activeEquips = {}; 
    let y = window.currentYear, m = window.curMonth, d = window.curDay;
    window.isWorkDuty = false;

    if (id) {
        const log = window.logs.find(l => l.id === id);
        if (!log) return;
        y = log.y || window.currentYear; m = log.m; d = log.d;
        document.getElementById('workTime').value = log.workTime ? log.workTime.replace(':','') : "";
        document.getElementById('taskNo').value = log.taskNo || "";
        document.getElementById('customerName').value = log.customerName || "";
        window.activeTaskTypes = log.taskType ? log.taskType.split(', ') : [];
        const addrEl = document.getElementById('workAddress'); if(addrEl) addrEl.value = log.address || "";
        document.getElementById('workContent').value = log.content || "";
        document.getElementById('workNote').value = log.note || "";
        document.getElementById('workOT').value = log.ot || "";
        window.activeStatus = log.status || null;
        if(log.coworkers) window.selectedCoworkers = [...log.coworkers];
        if(log.imgs) window.workImgs = [...log.imgs];
        if(log.equips) window.activeEquips = {...log.equips}; 
        window.isWorkDuty = log.isDuty || false;
    } else {
        document.getElementById('workTime').value = ""; 
        document.getElementById('taskNo').value = "";
        document.getElementById('customerName').value = "";
        window.activeTaskTypes = [];
        const addrEl = document.getElementById('workAddress'); if(addrEl) addrEl.value = "";
        document.getElementById('workContent').value = "";
        const noteEl = document.getElementById('workNote'); if(noteEl) noteEl.value = "";
        document.getElementById('workOT').value = "";
        const todayLogs = window.logs.filter(l => l.y === window.currentYear && l.m === window.curMonth && l.d === window.curDay);
        window.isWorkDuty = todayLogs.some(l => l.cat === 'work' && l.isDuty);
    }
    
    const dutyBtn = document.getElementById('workDutyBtn');
    if(window.isWorkDuty) { dutyBtn.style.color = 'red'; dutyBtn.classList.add('active-btn'); } 
    else { dutyBtn.style.color = 'var(--w-black)'; dutyBtn.classList.remove('active-btn'); }

    const editSaveBtn = document.getElementById('workEditSaveBtn');
    if (editSaveBtn) {
        editSaveBtn.style.display = id ? 'block' : 'none';
    }

    document.getElementById('workDateInput').value = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    window.updateWorkDateLabel();
    window.renderTaskTypes(); window.renderStatuses(); window.renderCoworkers(); window.renderEquips(); window.renderWorkPhotoGrid();
    
    window.applySavedDragOrder(); 
    window.applyCustomTitles();   
    
    document.getElementById('workModal').style.display = 'flex'; 
    window.initWorkDragListeners(); 
};

// 취소 버튼 누르면 깔끔하게 초기화 후 닫힘
window.closeWorkModal = () => { document.getElementById('workModal').style.display = 'none'; document.getElementById('workAddress').value = ""; document.getElementById('workNote').value = ""; };

// 🚨 이동점 0.2초 롱탭 방어 드래그 엔진
// 🚨 오직 이동점(핸들) 영역 자체를 눌러야만 작동하는 철벽 방어 드래그 엔진
window.hasInitDragListeners = false;
window.initWorkDragListeners = () => {
    if(window.hasInitDragListeners) return;
    const container = document.getElementById('workDragContainer');
    if(!container) return;

    let dragEl = null;
    let dragTimeout = null;

    const startDrag = (e) => {
        // [수정 핵심] closest 대신 target 검사를 하여 정확히 .drag-handle 영역(줄이 아닌 점)을 눌렀을 때만 작동
        const isHandle = e.target.classList.contains('drag-handle') || e.target.closest('.drag-handle') === e.target;
        if(!isHandle) return; 
        
        // 이동점을 터치했을 때도 실수 방지를 위해 0.2초 딜레이 유지
        dragTimeout = setTimeout(() => {
            dragEl = e.target.closest('.drag-item');
            if (dragEl) {
                dragEl.classList.add('dragging');
                if(navigator.vibrate) navigator.vibrate(30);
            }
        }, 200); 
    };

    const moveDrag = (e) => {
        if(!dragEl) { 
            clearTimeout(dragTimeout); 
            return; 
        } // 핸들이 눌리기 전 스크롤이 발생하면 취소하여 본래 스크롤 보장
        
        e.preventDefault(); 
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        
        const siblings = [...container.querySelectorAll('.drag-item:not(.dragging)')];
        const nextSibling = siblings.find(sib => {
            const rect = sib.getBoundingClientRect();
            return clientY < rect.top + rect.height / 2;
        });
        
        if(nextSibling) container.insertBefore(dragEl, nextSibling);
        else container.appendChild(dragEl);
    };

    const endDrag = (e) => {
        clearTimeout(dragTimeout);
        if(!dragEl) return;
        dragEl.classList.remove('dragging');
        dragEl = null;
        
        const newOrder = [...container.querySelectorAll('.drag-item')].map(i => i.getAttribute('data-id'));
        localStorage.setItem('wm_work_drag_order', JSON.stringify(newOrder));
    };

    // 이벤트 리스너 바인딩
    container.addEventListener('touchstart', startDrag, {passive: true});
    container.addEventListener('touchmove', moveDrag, {passive: false});
    container.addEventListener('touchend', endDrag);
    container.addEventListener('touchcancel', endDrag);

    container.addEventListener('mousedown', startDrag);
    window.addEventListener('mousemove', moveDrag, {passive: false});
    window.addEventListener('mouseup', endDrag);

    window.hasInitDragListeners = true;
};

window.openCommuteModal = (type) => { /* 출퇴근 모달 (기존 코드 생략 없이 완전 구동) */
    window.currentCommuteType = type; window.isCommuteException = false; window.calculatedOvertimeMin = 0; window.tempCommuteImg = null;
    if(window.removeCommuteImg) window.removeCommuteImg();
    
    let lastKm = '';
    const lastKmLog = [...window.logs].reverse().find(l => (l.cat === 'commute_in' || l.cat === 'commute_out') && l.km);
    if (lastKmLog) lastKm = lastKmLog.km;
    
    document.getElementById('commuteTime').value = window.getCurrentTimeString().replace(':','');
    document.getElementById('commuteKm').value = lastKm; 
    document.getElementById('commuteNote').value = '';
    
    const baseEl = document.getElementById('commuteBaseTime'); const editBtn = document.getElementById('editBaseTimeBtn');
    baseEl.setAttribute('readonly', true); baseEl.style.background = '#e2e8f0'; baseEl.style.color = '#475569'; editBtn.classList.remove('active-btn');
    const excBtn = document.getElementById('commuteExceptionBtn'); excBtn.style.color = ''; excBtn.classList.remove('active-btn');
    
    if (type === 'in') {
        document.getElementById('commuteTitle').innerHTML = '<i class="fa-solid fa-sign-in-alt"></i> 출근 기록';
        document.getElementById('commuteBaseTime').value = '09:00'; document.getElementById('commuteOvertime').value = '00:00';
    } else {
        document.getElementById('commuteTitle').innerHTML = '<i class="fa-solid fa-sign-out-alt"></i> 퇴근 기록';
        document.getElementById('commuteBaseTime').value = '18:00'; document.getElementById('commuteOvertime').value = '00:00';
    }

    const todayLogs = window.logs.filter(l => l.y === window.currentYear && l.m === window.curMonth && l.d === window.curDay);
    const existingLog = todayLogs.find(l => l.cat === (type === 'in' ? 'commute_in' : 'commute_out'));
    if (existingLog) {
        document.getElementById('commuteTime').value = existingLog.time ? existingLog.time.replace(':', '') : '';
        document.getElementById('commuteKm').value = existingLog.km || lastKm;
        document.getElementById('commuteNote').value = existingLog.commuteNote || '';
        if (existingLog.imgs && existingLog.imgs.length > 0) {
            window.tempCommuteImg = existingLog.imgs[0].src;
            document.getElementById('commuteNoPhotoText').style.display = 'none';
            const preview = document.getElementById('commuteImgPreview'); preview.style.display = 'block'; preview.src = window.tempCommuteImg;
            document.getElementById('commuteImgDelBtn').style.display = 'block';
        }
        window.isCommuteException = (type === 'in') ? existingLog.inException : existingLog.outException;
        if(window.isCommuteException) { excBtn.style.color = 'var(--sun)'; excBtn.classList.add('active-btn'); }
    }
    setTimeout(() => { window.formatTimeInput(document.getElementById('commuteTime')); if(window.updateOvertime) window.updateOvertime(); }, 50);
    document.getElementById('commuteModal').style.display = 'flex';
};
window.closeCommuteModal = () => { document.getElementById('commuteModal').style.display = 'none'; };

window.toggleEditBaseTime = () => {
    const el = document.getElementById('commuteBaseTime'); const btn = document.getElementById('editBaseTimeBtn');
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
    if(window.updateOvertime) window.updateOvertime();
};

window.openEditModal = (id) => { 
    window.editingLogId = id; const log = window.logs.find(l => l.id === id); if(!log) return;
    document.getElementById('editMemo').value = log.memo || '';
    window.activeEditTags = log.tags ? [...log.tags] : [];
    
    // 🌟 상세내역 카드를 클릭해 편집 모달 진입 시 "상세내역" 태그박스 상시 자동 선택/활성화 강제화
    if (id.startsWith('calc_commute_')) {
        if (!window.activeEditTags.includes('상세내역')) {
            window.activeEditTags.push('상세내역');
        }
        if(!window.memoTags || !window.memoTags.find(t => t.name === '상세내역')) {
            if(!window.memoTags) window.memoTags = [];
            window.memoTags.push({name: '상세내역', count: 1});
        }
    }
    
    if (window.renderEditPhotoGrid) window.renderEditPhotoGrid(); 
    if (window.renderMemoTags) window.renderMemoTags();
    document.getElementById('editModal').style.display = 'flex'; 
};
window.closeEditModal = () => { document.getElementById('editModal').style.display = 'none'; window.editingLogId = null; window.activeEditTags = []; };

window.closeTagEditModal = () => { document.getElementById('tagEditModal').style.display = 'none'; window.editingTagType = null; window.editingTagIndex = -1; window.tempEquipQty = 0; };
window.closeMapAppModal = () => { document.getElementById('mapAppModal').style.display = 'none'; };

// 검색 및 기타 유지
window.updateSearchFilters = (targetMonth = null) => {
    const filteredLogs = targetMonth ? window.logs.filter(l => l.m === targetMonth) : window.logs;
    const getCount = (type, name) => {
        return filteredLogs.filter(l => {
            if (type === 'task') return l.taskType && l.taskType.includes(name);
            if (type === 'manager') return l.coworkers && l.coworkers.includes(name);
            if (type === 'status') return l.status === name;
            if (type === 'equip') return l.equips && l.equips[name] !== undefined;
            if (type === 'tag') return l.tags && l.tags.includes(name);
            return false;
        }).length;
    };
    const sType = document.getElementById('searchType'); const curTypeVal = sType.value;
    sType.innerHTML = '<option value="">[ 작업유형 ]</option>' + window.taskTypes.map(t => `<option value="${t.name}" ${t.name===curTypeVal?'selected':''}>[${getCount('task', t.name)}] ${t.name}</option>`).join('');
    const sManager = document.getElementById('searchManager'); const curManagerVal = sManager.value;
    sManager.innerHTML = '<option value="">[ 매니저 ]</option>' + window.coworkers.map(c => `<option value="${c.name}" ${c.name===curManagerVal?'selected':''}>[${getCount('manager', c.name)}] ${c.name}</option>`).join('');
    const sEquip = document.getElementById('searchEquip'); const curEquipVal = sEquip.value;
    sEquip.innerHTML = '<option value="">[ 장비 ]</option>' + window.equipments.map(e => `<option value="${e.name}" ${e.name===curEquipVal?'selected':''}>[${getCount('equip', e.name)}] ${e.name}</option>`).join('');
    const sStatus = document.getElementById('searchStatus'); const curStatusVal = sStatus.value;
    sStatus.innerHTML = '<option value="">[ 상태 ]</option>' + window.statuses.map(s => `<option value="${s.name}" ${s.name===curStatusVal?'selected':''}>[${getCount('status', s.name)}] ${s.name}</option>`).join('');
    const sTag = document.getElementById('searchMemoTag'); const curTagVal = sTag.value;
    sTag.innerHTML = '<option value="">[ 태그 ]</option>' + window.memoTags.map(t => `<option value="${t.name}" ${t.name===curTagVal?'selected':''}>[${getCount('tag', t.name)}] ${t.name}</option>`).join('');
};

window.openSearch = () => {
    document.getElementById('searchLayer').style.display = 'flex'; 
    document.getElementById('searchInput').value = '';
    document.getElementById('activeFiltersArea').innerHTML = ''; 
    document.getElementById('searchSummary').style.display = 'none';
    document.getElementById('searchMonth').innerHTML = '<option value="">[ 월 전체 ]</option>' + [1,2,3,4,5,6,7,8,9,10,11,12].map(m => `<option value="${m}">${m}월</option>`).join('');
    document.getElementById('searchOX').innerHTML = '<option value="">[ O/X ]</option><option value="O">O 표시</option><option value="X">X 표시</option>';
    window.updateSearchFilters(null); document.getElementById('searchResultList').innerHTML = '';
};

window.closeSearch = () => { document.getElementById('searchLayer').style.display = 'none'; };

window.openTrash = () => { document.getElementById('trashLayer').style.display = 'flex'; window.renderTrash(); };
window.closeTrash = () => { document.getElementById('trashLayer').style.display = 'none'; window.renderMain(); };
window.clearTrash = () => { if(confirm('휴지통을 모두 비우시겠습니까? 복원할 수 없습니다.')) { window.trash = []; window.saveLocal(); window.renderTrash(); } };
window.restoreLog = (id) => { 
    const log = window.trash.find(t => t.id === id); 
    if(log) { window.trash = window.trash.filter(t => t.id !== id); window.logs.push(log); window.saveLocal(); window.renderTrash(); alert('항목이 복원되었습니다.'); } 
};

window.openImageViewer = (idx, mode, refId = null) => {
    if(document.activeElement && document.activeElement.blur) document.activeElement.blur();
    window.currentViewerMode = mode; window.currentViewerRefId = refId;
    let imgArray = [];
    if (mode === 'temp') imgArray = window.tempImgs;
    else if (mode === 'work') imgArray = window.workImgs;
    else if (mode === 'tempCommute') imgArray = window.tempCommuteImg ? [{src: window.tempCommuteImg}] : [];
    else if (mode === 'log' || mode === 'edit') { const log = window.logs.find(l => l.id === refId); if (log) imgArray = log.imgs || []; }
    
    window.currentViewerImages = imgArray; window.currentViewerIndex = idx;
    if (!imgArray || imgArray.length === 0 || idx < 0 || idx >= imgArray.length) return;
    
    const vImg = document.getElementById('viewerImg');
    vImg.style.transform = `translate(0px, 0px) scale(1)`; vImg.src = imgArray[idx].src;
    document.getElementById('imageViewer').style.display = 'flex';
    
    const delBtn = document.getElementById('deleteImgBtn');
    if (mode === 'log' || mode === 'tempCommute') delBtn.style.display = 'none'; else delBtn.style.display = 'inline-flex';
};
window.closeImageViewer = () => { document.getElementById('imageViewer').style.display = 'none'; document.getElementById('viewerImg').src = ""; window.currentViewerIndex = -1; };
