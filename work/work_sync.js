// work_sync.js

const WORK_API_BASE = "https://work.sentig335.workers.dev";

setTimeout(() => {
    if (window.isInitialLoad) {
        window.isInitialLoad = false;
        if (window.renderMain) window.renderMain();
    }
}, 3000);

window.refreshCurrentUI = function () {
    const popupLayer = document.getElementById("popupLayer");
    const isPopupOpen = popupLayer && popupLayer.style.display === "flex";
    const isSearchOpen = document.getElementById("searchLayer") && document.getElementById("searchLayer").style.display === "flex";
    const isTrashOpen = document.getElementById("trashLayer") && document.getElementById("trashLayer").style.display === "flex";

    if (window.renderMain) window.renderMain();

    if (isPopupOpen) {
        if (window.renderCal) window.renderCal(window.currentYear, window.curMonth - 1);
        if (window.updateUI) window.updateUI();
    }

    if (isSearchOpen && window.doSearch) window.doSearch();
    if (isTrashOpen && window.renderTrash) window.renderTrash();
};

window.recalculateTagCounts = function () {
    if (!window.taskTypes) window.taskTypes = [];
    if (!window.coworkers) window.coworkers = [];
    if (!window.statuses) window.statuses = [];
    if (!window.memoTags) window.memoTags = [];

    window.taskTypes.forEach(t => t.count = 0);
    window.coworkers.forEach(c => c.count = 0);
    window.statuses.forEach(s => s.count = 0);
    window.memoTags.forEach(t => t.count = 0);

    (window.logs || []).forEach(l => {
        if (l.cat === "work") {
            if (l.taskType) {
                l.taskType.split(", ").forEach(name => {
                    let item = window.taskTypes.find(x => x.name === name);
                    if (item) item.count++;
                    else window.taskTypes.push({ name, count: 1 });
                });
            }

            if (l.coworkers) {
                l.coworkers.forEach(name => {
                    let item = window.coworkers.find(x => x.name === name);
                    if (item) item.count++;
                    else window.coworkers.push({ name, count: 1 });
                });
            }

            if (l.status) {
                let item = window.statuses.find(x => x.name === l.status);
                if (item) item.count++;
                else window.statuses.push({ name: l.status, count: 1 });
            }
        }

        if (l.tags) {
            l.tags.forEach(name => {
                let item = window.memoTags.find(x => x.name === name);
                if (item) item.count++;
                else window.memoTags.push({ name, count: 1 });
            });
        }
    });
};

window.saveLocal = function () {
    if (!window.logs) window.logs = [];
    if (!window.trash) window.trash = [];

    window.recalculateTagCounts();

    localStorage.setItem("wm_logs", JSON.stringify(window.logs));
    localStorage.setItem("wm_trash", JSON.stringify(window.trash));
    localStorage.setItem("wm_taskTypes", JSON.stringify(window.taskTypes || []));
    localStorage.setItem("wm_coworkers", JSON.stringify(window.coworkers || []));
    localStorage.setItem("wm_statuses", JSON.stringify(window.statuses || []));
    localStorage.setItem("wm_equipments", JSON.stringify(window.equipments || []));
    localStorage.setItem("wm_memoTags", JSON.stringify(window.memoTags || []));

    if (window.refreshCurrentUI) window.refreshCurrentUI();

    window.saveToServer(false);
};

window.saveToLocalStore = function (colName, data) {
    if (!window.logs) window.logs = [];
    if (!window.trash) window.trash = [];

    if (colName === "logs") {
        const idx = window.logs.findIndex(l => l.id === data.id);
        if (idx >= 0) window.logs[idx] = data;
        else window.logs.push(data);
    }

    if (colName === "trash") {
        const idx = window.trash.findIndex(l => l.id === data.id);
        if (idx >= 0) window.trash[idx] = data;
        else window.trash.push(data);
    }

    window.saveLocal();
};

window.deleteFromLocalStore = function (colName, id) {
    if (colName === "logs") {
        window.logs = (window.logs || []).filter(l => l.id !== id);
    }

    if (colName === "trash") {
        window.trash = (window.trash || []).filter(l => l.id !== id);
    }

    window.saveLocal();
};

window.applyServerData = function (data) {
    if (!data || !Array.isArray(data.logs)) return false;

    window.logs = (data.logs || []).filter(Boolean);
    window.trash = (data.trash || []).filter(Boolean);
    window.taskTypes = (data.taskTypes || []).filter(Boolean);
    window.coworkers = (data.coworkers || []).filter(Boolean);
    window.statuses = (data.statuses || []).filter(Boolean);
    window.equipments = (data.equipments || []).filter(Boolean);
    window.memoTags = (data.memoTags || []).filter(Boolean);

    localStorage.setItem("wm_logs", JSON.stringify(window.logs));
    localStorage.setItem("wm_trash", JSON.stringify(window.trash));
    localStorage.setItem("wm_taskTypes", JSON.stringify(window.taskTypes));
    localStorage.setItem("wm_coworkers", JSON.stringify(window.coworkers));
    localStorage.setItem("wm_statuses", JSON.stringify(window.statuses));
    localStorage.setItem("wm_equipments", JSON.stringify(window.equipments));
    localStorage.setItem("wm_memoTags", JSON.stringify(window.memoTags));

    window.isInitialLoad = false;
    window.refreshCurrentUI();

    return true;
};

window.startSync = async function () {
    try {
        const res = await fetch(`${WORK_API_BASE}/api/load`, {
            method: "GET",
            headers: {
                "Accept": "application/json"
            }
        });

        if (!res.ok) throw new Error("서버 응답 오류: " + res.status);

        const result = await res.json();

        if (result && result.saved && result.saved.data) {
            window.applyServerData(result.saved.data);
        } else if (result && result.data) {
            window.applyServerData(result.data);
        } else {
            window.isInitialLoad = false;
            if (window.renderMain) window.renderMain();
        }

        console.log("✅ 서버 데이터 불러오기 완료", result);

    } catch (e) {
        console.warn("서버 복원 실패, 로컬 데이터로 실행:", e);
        window.isInitialLoad = false;
        if (window.renderMain) window.renderMain();
    }
};

window.saveToServer = async function (showError = false) {
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

        const res = await fetch(`${WORK_API_BASE}/api/save`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error("서버 응답 오류: " + res.status);

        const result = await res.json();
        console.log("✅ 서버 저장 완료", result);
        return result;

    } catch (e) {
        console.warn("서버 저장 실패, 로컬 저장은 유지됨:", e);
        if (showError) throw e;
        return null;
    }
};

window.forceSync = async function () {
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

if (typeof firebase !== "undefined" && firebase.auth) {
    firebase.auth().onAuthStateChanged(() => {
        window.startSync();
    });
} else {
    window.startSync();
}