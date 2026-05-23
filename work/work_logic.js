// work_logic.js

window.onload = () => { 
    window.renderMain(); 
    window.setupSwipeGesture(); 
    if(window.setupImageViewer) window.setupImageViewer(); 
    if(window.setupFAB) window.setupFAB(); 
    
    let lastFocusId = null;
    document.body.addEventListener('focusin', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            if(lastFocusId !== e.target) {
                setTimeout(() => { e.target.select(); }, 50);
                lastFocusId = e.target;
            }
        }
    });
    document.body.addEventListener('focusout', (e) => {
        if (e.target === lastFocusId) lastFocusId = null;
    });
};

window.syncPressTimer = null;
window.isSyncLongPress = false;
window.startSyncPress = (e) => {
    window.isSyncLongPress = false;
    window.syncPressTimer = setTimeout(() => {
        window.isSyncLongPress = true;
        if(navigator.vibrate) navigator.vibrate(50);
        if(window.forceSync) window.forceSync();
    }, 3000); 
};
window.endSyncPress = (e) => { clearTimeout(window.syncPressTimer); };
window.cancelSyncPress = () => { clearTimeout(window.syncPressTimer); };

window.goToToday = () => {
    let now = new Date();
    window.currentYear = now.getFullYear(); let m = now.getMonth() + 1; let d = now.getDate();
    window.openPop(m); window.setCurDay(d);
};

window.toggleLogOx = (id) => {
    let log = window.logs.find(l => l.id === id);
    if(log) {
        if (log.personalCheck === 'O') log.personalCheck = 'X'; 
        else if (log.personalCheck === 'X') log.personalCheck = null; 
        else log.personalCheck = 'O';
        window.saveToLocalStore('logs', log);
        if(window.updateUI) window.updateUI(); 
    }
};

window.openSpecificMap = (appType) => {
    let addr = document.getElementById('workAddress').value.trim(); 
    if(!addr) { alert("주소를 입력해주세요."); return; }
    localStorage.setItem('wm_default_map', appType); window.closeMapAppModal();
    let url = "";
    if (appType === 'tmap') url = `tmap://search?name=${encodeURIComponent(addr)}`;
    else if (appType === 'naver') url = `nmap://search?query=${encodeURIComponent(addr)}&appname=workmaster`; 
    else if (appType === 'kakaomap') url = `kakaomap://search?q=${encodeURIComponent(addr)}`; 
    
    if(url) window.top.location.href = url; 
};

window.saveGeneralEntry = async () => {
    const memoInput = document.getElementById('memoIn'); const memo = memoInput.value.trim();
    if(!memo && window.tempImgs.length === 0) return;
    let finalImgs = window.tempImgs.map(img => ({ id: img.id, src: img.src }));
    let cat = finalImgs.length > 0 ? 'photo' : 'memo';
    const newLog = { id: Date.now().toString(), y: window.currentYear, m: window.curMonth, d: window.curDay, cat: cat, memo: memo, imgs: finalImgs, time: window.getCurrentTimeString(), personalCheck: null };
    window.saveToLocalStore('logs', newLog);
    memoInput.value = ""; document.getElementById('previewArea').innerHTML = ""; window.tempImgs = [];
};

window.saveWorkLog = async () => {
    try {
        const timeInput = document.getElementById('workTime');
        if (timeInput) window.formatTimeInput(timeInput);
        let workTime = timeInput ? timeInput.value : ''; 
        if(!workTime || workTime.trim() === "") workTime = window.getCurrentTimeString();
        
        const otInput = document.getElementById('workOT');
        if(otInput) window.formatOTInput(otInput);
        
        const taskNo = document.getElementById('taskNo').value; const customerName = document.getElementById('customerName').value.trim();
        let address = ""; const addrEl = document.getElementById('workAddress'); if(addrEl) address = addrEl.value.trim();
        const content = document.getElementById('workContent').value; const note = document.getElementById('workNote').value; const ot = document.getElementById('workOT').value.trim();
        const id = window.currentWorkId || Date.now().toString();
        const dateVal = document.getElementById('workDateInput').value;
        let saveY = window.currentYear, saveM = window.curMonth, saveD = window.curDay;
        
        if(dateVal) { 
            const parts = dateVal.split('-'); 
            if(parts.length === 3) { 
                saveY = parseInt(parts[0], 10); saveM = parseInt(parts[1], 10); saveD = parseInt(parts[2], 10); 
            } 
        }
        
        let existingCheck = null;
        if(window.currentWorkId) { let eLog = window.logs.find(l=>l.id===window.currentWorkId); if(eLog && eLog.personalCheck) existingCheck = eLog.personalCheck; }
        let finalEquips = {}; for (let k in window.activeEquips) { if (window.activeEquips[k] > 0) finalEquips[k] = window.activeEquips[k]; }
        
        const newLog = {
            id, y: saveY, m: saveM, d: saveD, cat: 'work', workTime: workTime, taskNo, customerName, address, taskType: window.activeTaskTypes.join(', '), content, note, ot,
            status: window.activeStatus, personalCheck: existingCheck, coworkers: [...window.selectedCoworkers], equips: finalEquips, imgs: [...window.workImgs],
            time: window.currentWorkId ? window.logs.find(l=>l.id===id).time : window.getCurrentTimeString(),
            isDuty: window.isWorkDuty
        };

        const idx = window.logs.findIndex(l => l.id === id); 
        if(idx > -1) window.logs[idx] = newLog; else window.logs.push(newLog);
        
        window.logs.forEach(l => {
            if(l.y === saveY && l.m === saveM && l.d === saveD && l.cat === 'work') { l.isDuty = window.isWorkDuty; }
        });

        if (saveY !== window.currentYear || saveM !== window.curMonth) {
            window.currentYear = saveY; window.curMonth = saveM; window.curDay = saveD;
            document.getElementById('monthLabel').innerText = window.curMonth + "월";
        } else if (saveD !== window.curDay) { window.curDay = saveD; }

        if(window.updateCommuteDetailByDate) window.updateCommuteDetailByDate(saveY, saveM, saveD);
        window.saveLocal(); 
        window.closeWorkModal();
    } catch(e) { console.error(e); alert("저장 중 오류가 발생했습니다."); }
};

window.saveEditLog = async () => {
    const log = window.logs.find(l => l.id === window.editingLogId); if(!log) return;
    log.memo = document.getElementById('editMemo').value;
    log.tags = [...window.activeEditTags];
    if(log.cat !== 'work') log.cat = (log.imgs && log.imgs.length > 0) ? 'photo' : 'memo';
    window.saveToLocalStore('logs', log); window.closeEditModal();
};

window.handleCardClick = (id, cat) => { if(cat === 'work') window.openWorkModal(id); else window.openEditModal(id); };

window.deleteEntry = async (id) => { 
    const log = window.logs.find(l => l.id === id); 
    if(log) { 
        window.saveToLocalStore('trash', log); 
        window.deleteFromLocalStore('logs', id); 
        
        // 🌟 [수정 완료] 출근이나 퇴근 기록이 삭제되었을 때, 연결된 상세내역(계산 결과지)도 즉시 파기되도록 트리거
        if (log.cat === 'commute_in' || log.cat === 'commute_out') {
            if (window.updateCommuteDetailByDate) {
                window.updateCommuteDetailByDate(log.y, log.m, log.d);
                window.saveLocal(); // 업데이트된 내역을 서버 및 화면에 즉시 동기화
            }
        }
    } 
};

window.handleSelectChange = (selectEl) => {
    if (selectEl.id === 'searchMonth') {
        const selectedMonth = selectEl.value ? parseInt(selectEl.value) : null;
        if(window.updateSearchFilters) window.updateSearchFilters(selectedMonth);
    }
    window.doSearch();
    selectEl.blur(); 
};

window.resetSearchInput = () => {
    const input = document.getElementById('searchInput');
    input.value = "";
    if(window.updateSearchFilters) window.updateSearchFilters(null);
    window.doSearch();
    input.focus();
};

window.resetSearch = () => {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.value = ''; // 검색어 깔끔하게 비우기
    }
    
    // 검색 결과 알림바 숨기기
    const searchResultBar = document.getElementById('searchResultBar');
    if (searchResultBar) {
        searchResultBar.style.display = 'none';
    }
    
    // 키보드 내리기 (모바일 환경)
    if (document.activeElement && document.activeElement.blur) {
        document.activeElement.blur();
    }

    // 메인 화면으로 완벽 복구
    window.renderMain();
};

window.removeFilter = (selectId) => {
    document.getElementById(selectId).value = "";
    if (selectId === 'searchMonth' && window.updateSearchFilters) window.updateSearchFilters(null);
    window.doSearch();
};

window.doSearch = () => {
    const kw = document.getElementById('searchInput').value.trim().toLowerCase(); 
    const sMonth = document.getElementById('searchMonth').value;
    const sType = document.getElementById('searchType').value;
    const sStatus = document.getElementById('searchStatus').value; 
    const sManager = document.getElementById('searchManager').value;
    const sEquip = document.getElementById('searchEquip').value;
    const sTag = document.getElementById('searchMemoTag').value;
    const sOX = document.getElementById('searchOX').value;
    
    const filtersArea = document.getElementById('activeFiltersArea');
    let tagsHtml = [];
    const tagStyle = "padding:2px 6px; font-size:0.75rem; background:#e0e7ff; color:#3730a3; display:inline-flex; align-items:center; gap:4px; font-weight:bold;";
    
    if(sMonth) tagsHtml.push(`<span class="w95-btn" style="${tagStyle}" onclick="window.removeFilter('searchMonth')">${sMonth}월 <i class="fa-solid fa-xmark" style="color:red;"></i></span>`);
    if(sType) tagsHtml.push(`<span class="w95-btn" style="${tagStyle}" onclick="window.removeFilter('searchType')">${sType} <i class="fa-solid fa-xmark" style="color:red;"></i></span>`);
    if(sStatus) tagsHtml.push(`<span class="w95-btn" style="${tagStyle}" onclick="window.removeFilter('searchStatus')">${sStatus} <i class="fa-solid fa-xmark" style="color:red;"></i></span>`);
    if(sManager) tagsHtml.push(`<span class="w95-btn" style="${tagStyle}" onclick="window.removeFilter('searchManager')">${sManager} <i class="fa-solid fa-xmark" style="color:red;"></i></span>`);
    if(sEquip) tagsHtml.push(`<span class="w95-btn" style="${tagStyle}" onclick="window.removeFilter('searchEquip')">${sEquip} <i class="fa-solid fa-xmark" style="color:red;"></i></span>`);
    if(sTag) tagsHtml.push(`<span class="w95-btn" style="${tagStyle}" onclick="window.removeFilter('searchMemoTag')">${sTag} <i class="fa-solid fa-xmark" style="color:red;"></i></span>`);
    if(sOX) tagsHtml.push(`<span class="w95-btn" style="${tagStyle}" onclick="window.removeFilter('searchOX')">${sOX==='O'?'O표시':'X표시'} <i class="fa-solid fa-xmark" style="color:red;"></i></span>`);
    
    filtersArea.innerHTML = tagsHtml.join('');

    const resList = document.getElementById('searchResultList');
    const summaryArea = document.getElementById('searchSummary');
    
    if(!kw && !sMonth && !sType && !sStatus && !sManager && !sEquip && !sTag && !sOX) { 
        resList.innerHTML = ''; summaryArea.style.display = 'none'; return; 
    }
    
    const res = window.logs.filter(l => {
        let matchKw = true;
        if(kw) { 
            let str = (l.memo || '') + (l.content || '') + (l.taskNo || '') + (l.taskType || '') + (l.address || '') + (l.customerName || '') + (l.commuteNote || '') + (l.coworkers ? l.coworkers.join('') : '') + (l.tags ? l.tags.join('') : ''); 
            matchKw = str.toLowerCase().includes(kw); 
        }
        let matchMonth = sMonth ? (l.m === parseInt(sMonth)) : true;
        let matchType = sType ? (l.taskType && l.taskType.includes(sType)) : true; 
        let matchStatus = sStatus ? (l.status === sStatus) : true; 
        let matchManager = sManager ? (l.coworkers && l.coworkers.includes(sManager)) : true;
        let matchEquip = sEquip ? (l.equips && l.equips[sEquip] !== undefined) : true;
        let matchTag = sTag ? (l.tags && l.tags.includes(sTag)) : true;
        let matchOX = sOX ? (l.personalCheck === sOX) : true;
        
        return matchKw && matchMonth && matchType && matchStatus && matchManager && matchEquip && matchTag && matchOX;
    });

    resList.innerHTML = res.map(l => window.getLogCardHtml(l)).join('');

    const counts = { work: 0, memo: 0, photo: 0, commute: 0 };
    res.forEach(l => {
        if(l.cat === 'work') counts.work++;
        else if(l.cat === 'memo') counts.memo++;
        else if(l.cat === 'photo') counts.photo++;
        else if(l.cat === 'commute_in' || l.cat === 'commute_out') counts.commute++;
    });

    if(res.length > 0) {
        let typeStr = [];
        if(counts.work > 0) typeStr.push(`작업 ${counts.work}건`);
        if(counts.memo > 0) typeStr.push(`메모 ${counts.memo}건`);
        if(counts.photo > 0) typeStr.push(`사진 ${counts.photo}건`);
        if(counts.commute > 0) typeStr.push(`출퇴근 ${counts.commute}건`);
        summaryArea.innerHTML = `<span style="color:#475569;">총 ${res.length}건 검색됨</span> <span style="margin-left:8px; font-weight:normal;">(${typeStr.join(', ')})</span>`;
        summaryArea.style.display = 'block';
    } else {
        summaryArea.innerText = "조건에 맞는 기록이 없습니다.";
        summaryArea.style.display = 'block';
    }
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

window.changeViewerImage = (dir) => {
    if (window.currentViewerIndex === -1 || !window.currentViewerImages || window.currentViewerImages.length === 0) return;
    let newIdx = window.currentViewerIndex + dir;
    if (newIdx >= 0 && newIdx < window.currentViewerImages.length) {
        window.openImageViewer(newIdx, window.currentViewerMode, window.currentViewerRefId);
    }
};
window.openEditModal = (id) => { 
    window.editingLogId = id; const log = window.logs.find(l => l.id === id); if(!log) return;
    document.getElementById('editMemo').value = log.memo || '';
    window.activeEditTags = log.tags ? [...log.tags] : [];
    
    // 🌟 [수정 완료] 아이디뿐만 아니라 텍스트에 [출/퇴 상세내역]이 들어가면 무조건 상세내역 태그 활성화
    if ((id && id.startsWith('calc_commute_')) || (log.memo && log.memo.includes('[출/퇴 상세내역]'))) {
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

/* 🌟 오류나던 이미지 로직을 무조건 성공하게 만드는 핵심 철벽 엔진 */
window.safeProcessImage = (file, callback) => {
    if(window.processFileExt) {
        window.processFileExt(file, callback);
    } else {
        const reader = new FileReader();
        reader.onload = (e) => callback(e.target.result);
        reader.readAsDataURL(file);
    }
};

/* 🌟 달력/간이 입력기 사진 처리 (복구 완료) */
window.handleGeneralFiles = (input) => {
    if(!input.files || input.files.length === 0) return;
    if(window.showLoading) window.showLoading("사진 처리 중...");
    let pCount = 0; const tot = input.files.length;
    Array.from(input.files).forEach(f => {
        window.safeProcessImage(f, (dataUrl) => {
            if(dataUrl) window.tempImgs.push({id: 'img_' + Date.now() + Math.random(), src: dataUrl});
            pCount++; 
            if(pCount === tot) { if(window.renderTempImgs) window.renderTempImgs(); if(window.hideLoading) window.hideLoading(); }
        });
    });
    input.value = ""; 
};

/* 🌟 작업일지 내 사진 처리 (복구 완료) */
window.handleWorkFiles = (input) => {
    if(!input.files || input.files.length === 0) return;
    if(window.showLoading) window.showLoading("사진 처리 중...");
    let pCount = 0; const tot = input.files.length;
    Array.from(input.files).forEach(f => {
        window.safeProcessImage(f, (dataUrl) => {
            if(dataUrl) window.workImgs.push({id: 'w_'+Date.now()+Math.random(), src: dataUrl});
            pCount++;
            if(pCount === tot) { if(window.renderWorkPhotoGrid) window.renderWorkPhotoGrid(); if(window.hideLoading) window.hideLoading(); }
        });
    });
    input.value = "";
};

/* 🌟 편집 모달 내 사진 추가 처리 및 저장 로직 (복구 완료) */
window.addFilesToEdit = (input) => { 
    const log = window.logs.find(l => l.id === window.editingLogId); 
    if(!log) return;
    if(!log.imgs) log.imgs = []; 
    if(!input.files || input.files.length === 0) return;
    
    if(window.showLoading) window.showLoading("사진 처리 중...");
    let pCount = 0; const tot = input.files.length;
    Array.from(input.files).forEach(f => {
        window.safeProcessImage(f, (dataUrl) => {
            if(dataUrl) log.imgs.push({id: 'e_'+Date.now()+Math.random(), src: dataUrl});
            pCount++;
            if(pCount === tot) { 
                if(window.renderEditPhotoGrid) window.renderEditPhotoGrid(); 
                if(window.hideLoading) window.hideLoading(); 
            }
        });
    });
    input.value = ""; 
};

/* 🌟 출퇴근 앨범 통합 로직 및 뷰어 연동 */
window.handleCommuteThumbClick = (e) => {
    if(window.tempCommuteImg) {
        window.openImageViewer(0, 'tempCommute');
    } else {
        document.getElementById('commuteImgInput').click();
    }
};

window.handleCommuteImg = (input) => {
    if(input.files.length === 0) return;
    window.safeProcessImage(input.files[0], (dataUrl) => {
        if(dataUrl) {
            window.tempCommuteImg = dataUrl;
            document.getElementById('commuteNoPhotoText').style.display = 'none';
            const preview = document.getElementById('commuteImgPreview');
            preview.style.display = 'block'; preview.src = dataUrl;
            document.getElementById('commuteImgDelBtn').style.display = 'block';
        }
    });
    input.value = "";
};

window.removeCommuteImg = (e) => {
    if(e) e.stopPropagation();
    window.tempCommuteImg = null;
    document.getElementById('commuteNoPhotoText').style.display = 'block';
    document.getElementById('commuteImgPreview').style.display = 'none';
    document.getElementById('commuteImgPreview').src = '';
    document.getElementById('commuteImgDelBtn').style.display = 'none';
};