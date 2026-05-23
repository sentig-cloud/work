window.cloneSyncSnapshot = function () {
    return {
        logs: JSON.parse(JSON.stringify(window.logs || [])),
        trash: JSON.parse(JSON.stringify(window.trash || [])),
        taskTypes: JSON.parse(JSON.stringify(window.taskTypes || [])),
        coworkers: JSON.parse(JSON.stringify(window.coworkers || [])),
        statuses: JSON.parse(JSON.stringify(window.statuses || [])),
        equipments: JSON.parse(JSON.stringify(window.equipments || [])),
        memoTags: JSON.parse(JSON.stringify(window.memoTags || []))
    };
};

window.touchAllDirtyItems = function (dirty, snapshot) {
    const now = new Date().toISOString();

    Object.keys(dirty || {}).forEach(colName => {
        if (!Array.isArray(snapshot[colName])) return;

        Object.keys(dirty[colName] || {}).forEach(id => {
            const itemDirty = dirty[colName][id];
            if (!itemDirty || itemDirty.action === "delete") return;

            const item = snapshot[colName].find(v => String(v.id) === String(id));
            if (item && typeof item === "object") {
                item.updatedAt = item.updatedAt || now;
            }
        });
    });

    return snapshot;
};

window.applyDirtyDeletesToServerData = function (serverData, dirty) {
    if (!serverData || !dirty) return serverData;

    const nextData = JSON.parse(JSON.stringify(serverData));

    Object.keys(dirty).forEach(colName => {
        if (!Array.isArray(nextData[colName])) return;

        Object.keys(dirty[colName] || {}).forEach(id => {
            const itemDirty = dirty[colName][id];

            if (itemDirty && itemDirty.action === "delete") {
                nextData[colName] = nextData[colName].filter(item => String(item.id) !== String(id));
            }
        });
    });

    return nextData;
};

window.restoreLocalDirtyItems = function (snapshot, dirty) {
    Object.keys(dirty || {}).forEach(colName => {
        if (!Array.isArray(window[colName]) || !Array.isArray(snapshot[colName])) return;

        Object.keys(dirty[colName] || {}).forEach(id => {
            const itemDirty = dirty[colName][id];

            if (itemDirty && itemDirty.action === "delete") {
                window[colName] = window[colName].filter(item => String(item.id) !== String(id));
                return;
            }

            const localItem = snapshot[colName].find(item => String(item.id) === String(id));
            if (!localItem) return;

            const idx = window[colName].findIndex(item => String(item.id) === String(id));

            if (idx >= 0) window[colName][idx] = localItem;
            else window[colName].push(localItem);
        });
    });
};

window.syncNow = async function (showError = false) {
    if (window.syncInProgress) {
        window.pendingSyncAfterCurrent = true;
        return null;
    }

    const dirty = window.getDirtyMap();
    const hasDirty = Object.keys(dirty).length > 0;

    if (!hasDirty && !showError) return null;

    window.syncInProgress = true;

    try {
        let serverResult = null;
        let serverData = null;

        const localSnapshot = window.touchAllDirtyItems(dirty, window.cloneSyncSnapshot());

        try {
            serverResult = await window.loadFromServer();
            serverData = window.getServerData(serverResult);
        } catch (e) {
            console.warn("서버 병합용 데이터 불러오기 실패, 현재 로컬 기준 저장:", e);
        }

        if (serverData) {
            const cleanedServerData = window.applyDirtyDeletesToServerData(serverData, dirty);
            window.applyServerData(cleanedServerData, true);
            window.restoreLocalDirtyItems(localSnapshot, dirty);
            window.saveAllLocalOnly();
        }

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
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify(payload)
        });

        const text = await res.text();

        if (!res.ok) {
            throw new Error(`서버 저장 실패: ${res.status} / ${text}`);
        }

        const result = text ? JSON.parse(text) : {};

        window.clearDirtyMap();
        console.log("자동 동기화 완료", result);

        return result;
    } catch (e) {
        console.warn("서버 저장 실패, 로컬 저장 유지:", e);
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