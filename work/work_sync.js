window.syncNow = async function (showError = false) {
    if (window.syncInProgress) {
        window.pendingSyncAfterCurrent = true;
        return null;
    }

    const dirty = window.getDirtyMap();
    const hasDirty = Object.keys(dirty).length > 0;

    window.syncInProgress = true;

    try {
        let serverResult = null;
        let serverData = null;

        // 1. 내가 방금 수정한 최신 로컬 상태 백업
        const localSnapshot = window.touchAllDirtyItems(dirty, window.cloneSyncSnapshot());

        try {
            // 2. 무조건 서버 최신 데이터 끌어오기 (핵심 에러 해결 구간)
            serverResult = await window.loadFromServer();
            serverData = window.getServerData(serverResult);
        } catch (e) {
            console.warn("서버 최신본 다운로드 실패:", e);
            if (showError && !hasDirty) throw e; 
        }

        // 3. 서버에 데이터가 있다면 로컬과 병합 (서버 최신 우선)
        if (serverData) {
            const cleanedServerData = window.applyDirtyDeletesToServerData(serverData, dirty);
            window.applyServerData(cleanedServerData, true); // 로컬 + 서버 병합
            window.restoreLocalDirtyItems(localSnapshot, dirty); // 방금 내가 수정한 건 유지
            window.saveAllLocalOnly(); // 병합 완료본 로컬 저장
        }

        // 4. 로컬에서 서버로 보낼(업로드할) 내역이 없다면 여기까지만 하고 깔끔하게 종료
        if (!hasDirty && !showError) {
            window.clearDirtyMap();
            return { status: 'pulled_only' };
        }

        // 5. 로컬에서 변경된 내역이 있다면 서버로 업로드 (POST)
        const stamp = window.setSyncStamp();
        const payload = {
            savedAt: stamp,
            syncUpdatedAt: stamp,
            app: "work",
            dirty,
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

        const res = await fetch(`${WORK_API_BASE}/api/save`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Accept": "application/json" },
            body: JSON.stringify(payload)
        });

        const text = await res.text();
        if (!res.ok) throw new Error(`서버 저장 실패: ${res.status} / ${text}`);

        const result = text ? JSON.parse(text) : {};
        window.clearDirtyMap();
        return result;

    } catch (e) {
        console.warn("동기화 실패:", e);
        if (showError) throw e;
        return null;
    } finally {
        window.syncInProgress = false;
        if (window.pendingSyncAfterCurrent) {
            window.pendingSyncAfterCurrent = false;
            window.scheduleSync();
        }
    }
};

window.forceSync = async function () {
    // 팝업을 통해 유저에게 통제권 부여
    const mode = confirm("서버 동기화를 진행합니다.\n\n[확인] 자동 양방향 동기화 (권장)\n[취소] 내 로컬 데이터를 지우고 서버 데이터로 강제 덮어쓰기");
    
    try {
        if (window.showLoading) window.showLoading("서버와 통신 중...");
        
        if (mode) {
            // 일반 양방향 병합
            await window.syncNow(true);
            alert("✅ 자동 동기화 완료!");
        } else {
            // 강제 다운로드 (서버 -> 로컬 완전 덮어쓰기)
            const serverResult = await window.loadFromServer();
            const serverData = window.getServerData(serverResult);
            if (serverData) {
                window.applyServerData(serverData, false); // merge=false 옵션으로 로컬 날리고 덮어씀
                window.clearDirtyMap();
                alert("✅ 서버 데이터로 강제 복원 완료!");
            } else {
                alert("❌ 서버에 가져올 데이터가 없습니다.");
            }
        }
        
        if (window.hideLoading) window.hideLoading();
        if (window.refreshCurrentUI) window.refreshCurrentUI();
    } catch (e) {
        if (window.hideLoading) window.hideLoading();
        alert("❌ 통신 실패: " + e.message);
    }
};