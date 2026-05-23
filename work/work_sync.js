// work_sync.js 전체 코드 (요금 원천 차단 및 로컬 전용 모드)

setTimeout(() => {
    if (window.isInitialLoad) {
        window.isInitialLoad = false;
        if(window.renderMain) window.renderMain();
    }
}, 3000);

// 로그인 상태는 확인하지만, 데이터베이스 동기화는 절대 하지 않습니다.
firebase.auth().onAuthStateChanged(user => {
    const syncStatusEl = document.getElementById('sync-status');
    if (user) {
        window.uid = user.uid;
        if(syncStatusEl) { 
            syncStatusEl.textContent = "● Local (요금 차단됨)"; 
            syncStatusEl.classList.replace('text-gray-500', 'text-blue-500'); 
        }
        window.isInitialLoad = false;
        if(window.renderMain) window.renderMain();
    } else {
        if(syncStatusEl) { 
            syncStatusEl.textContent = "● Offline"; 
            syncStatusEl.classList.replace('text-green-500', 'text-gray-500'); 
        }
        window.isInitialLoad = false;
        if(window.renderMain) window.renderMain();
    }
});

window.refreshCurrentUI = function() {
    const popupLayer = document.getElementById('popupLayer');
    const isPopupOpen = popupLayer && popupLayer.style.display === 'flex';
    const isSearchOpen = document.getElementById('searchLayer') && document.getElementById('searchLayer').style.display === 'flex';
    const isTrashOpen = document.getElementById('trashLayer') && document.getElementById('trashLayer').style.display === 'flex';

    if(window.renderMain) window.renderMain(); 
    if (isPopupOpen) {
        if(window.renderCal) window.renderCal(window.currentYear, window.curMonth - 1);
        if(window.updateUI) window.updateUI();
    }
    if (isSearchOpen && window.doSearch) window.doSearch();
    if (isTrashOpen && window.renderTrash) window.renderTrash();
};

// 🛑 서버 다운로드 원천 차단 (120MB 통신 방지)
window.startSync = async function(uid) {
    try {
        const res = await fetch("/api/load", {
            method: "GET",
            headers: { "Accept": "application/json" }
        });

        if (!res.ok) {
            console.warn("서버 복원 실패:", res.status);
            window.isInitialLoad = false;
            if (window.renderMain) window.renderMain();
            return;
        }

        const result = await res.json();

        if (result && result.saved && result.saved.data) {
            window.applyServerData(result.saved.data);
        } else if (result && result.data) {
            window.applyServerData(result.data);
        } else {
            window.isInitialLoad = false;
            if (window.renderMain) window.renderMain();
        }
    } catch (e) {
        console.warn("서버 복원 실패, 로컬 데이터로 실행:", e);
        window.isInitialLoad = false;
        if (window.renderMain) window.renderMain();
    }
};

// 🛑 수동 강제 동기화 버튼 클릭 시 차단 안내
window.forceSync = async function() {
    try {
        if (window.showLoading) window.showLoading("서버 동기화 중...");

        await window.saveToServer(true);

        if (window.hideLoading) window.hideLoading();
        alert("✅ 서버 동기화 완료!");
    } catch (e) {
        if (window.hideLoading) window.hideLoading();
        alert("❌ 서버 동기화 실패: " + e.message);
    }
};

// 화면 UI 강제 갱신용
window.forceSync = async function() {
    try {
        if (window.showLoading) window.showLoading("서버 동기화 중...");

        await window.saveToServer(true);

        if (window.hideLoading) window.hideLoading();
        alert("✅ 서버 동기화 완료!");
    } catch (e) {
        if (window.hideLoading) window.hideLoading();
        alert("❌ 서버 동기화 실패: " + e.message);
    }
};

window.recalculateTagCounts = function() {
    window.taskTypes.forEach(t => t.count = 0);
    window.coworkers.forEach(c => c.count = 0);
    window.statuses.forEach(s => s.count = 0);
    window.memoTags.forEach(t => t.count = 0);

    window.logs.forEach(l => {
        if (l.cat === 'work') {
            if (l.taskType) l.taskType.split(', ').forEach(ttName => { let t = window.taskTypes.find(x => x.name === ttName); if(t) t.count++; else window.taskTypes.push({name: ttName, count: 1}); });
            if (l.coworkers) l.coworkers.forEach(cwName => { let c = window.coworkers.find(x => x.name === cwName); if(c) c.count++; else window.coworkers.push({name: cwName, count: 1}); });
            if (l.status) { let s = window.statuses.find(x => x.name === l.status); if(s) s.count++; else window.statuses.push({name: l.status, count: 1}); }
        } else {
            if (l.tags) l.tags.forEach(tagName => { let t = window.memoTags.find(x => x.name === tagName); if(t) t.count++; else window.memoTags.push({name: tagName, count: 1}); });
        }
    });
};

// 서버 전송 없이 로컬(기기 내부)에만 저장합니다.
window.saveLocal = function() {
    window.recalculateTagCounts();

    try {
        localStorage.setItem('wm_logs', JSON.stringify(window.logs));
        localStorage.setItem('wm_trash', JSON.stringify(window.trash));
        localStorage.setItem('wm_taskTypes', JSON.stringify(window.taskTypes));
        localStorage.setItem('wm_coworkers', JSON.stringify(window.coworkers));
        localStorage.setItem('wm_statuses', JSON.stringify(window.statuses));
        localStorage.setItem('wm_equipments', JSON.stringify(window.equipments));
        localStorage.setItem('wm_memoTags', JSON.stringify(window.memoTags));
    } catch (e) {
        console.error("로컬 저장 오류:", e);
    }

    window.refreshCurrentUI();

    if (window.saveToServer) {
        window.saveToServer(false);
    }
};

// 🛑 서버 업로드 원천 차단
window.saveToServer = async function(showError = false) {
    try {
        const payload = {
            savedAt: new Date().toISOString(),
            app: "work",
            data: {
                logs: window.logs || [],
                trash: window.trash || [],
                taskTypes: window.taskTypes || [],
                coworkers: window.coworkers || [],
                statuses: window.statuses || [],
                equipments: window.equipments || [],
                memoTags: window.memoTags || []
            }
        };

        const res = await fetch("/api/save", {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            throw new Error("서버 응답 오류: " + res.status);
        }

        return await res.json();
    } catch (e) {
        console.warn("서버 저장 실패, 로컬 저장은 유지됨:", e);
        if (showError) throw e;
        return null;
    }
};

window.saveToLocalStore = function(colName, data) {
    if (colName === 'logs') { 
        const idx = window.logs.findIndex(l => l.id === data.id); 
        if (idx !== -1) window.logs[idx] = data; else window.logs.push(data); 
    } else if (colName === 'trash') { 
        const idx = window.trash.findIndex(t => t.id === data.id); 
        if (idx !== -1) window.trash[idx] = data; else window.trash.push(data); 
    }
    window.saveLocal();
};

window.deleteFromLocalStore = function(colName, id) {
    if (colName === 'logs') window.logs = window.logs.filter(l => l.id !== id);
    else if (colName === 'trash') window.trash = window.trash.filter(t => t.id !== id);
    window.saveLocal();
};