// work_enhancements.js
// 임시 2, 3 보강 모듈: 기존 데이터 형식은 유지하고 필요한 UI 동작만 교체한다.
(function () {
    "use strict";

    const deepCopy = (value) => JSON.parse(JSON.stringify(value));
    const esc = (value) => String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    const getTagArray = (type) => {
        if (type === "task") return window.taskTypes || [];
        if (type === "coworker") return window.coworkers || [];
        if (type === "equip") return window.equipments || [];
        if (type === "memoTag") return window.memoTags || [];
        return window.statuses || [];
    };

    const getTag = (type, name) => getTagArray(type).find((tag) => tag.name === name);
    const showsNumber = (tag) => !tag || tag.showNumber !== false;
    const includesMonthly = (tag) => !tag || tag.includeMonthly !== false;
    const getSortCount = (tag) => Number(tag && tag.count) || 0;

    const replaceInList = (list, oldName, newName) => {
        if (!Array.isArray(list)) return list;
        return list.map((name) => name === oldName ? newName : name);
    };

    const updateLogTagName = (log, type, oldName, newName) => {
        if (!log) return;
        if (type === "task" && log.taskType) {
            log.taskType = replaceInList(String(log.taskType).split(", "), oldName, newName).join(", ");
        } else if (type === "coworker" && log.coworkers) {
            log.coworkers = replaceInList(log.coworkers, oldName, newName);
        } else if (type === "status" && log.status === oldName) {
            log.status = newName;
        } else if (type === "memoTag" && log.tags) {
            log.tags = replaceInList(log.tags, oldName, newName);
        } else if (type === "equip" && log.equips && Object.prototype.hasOwnProperty.call(log.equips, oldName)) {
            log.equips[newName] = log.equips[oldName];
            delete log.equips[oldName];
        }
    };

    const removeCurrentSelection = (type, name) => {
        if (type === "task") window.activeTaskTypes = (window.activeTaskTypes || []).filter((item) => item !== name);
        if (type === "coworker") window.selectedCoworkers = (window.selectedCoworkers || []).filter((item) => item !== name);
        if (type === "status" && window.activeStatus === name) window.activeStatus = null;
        if (type === "memoTag") window.activeEditTags = (window.activeEditTags || []).filter((item) => item !== name);
        if (type === "equip" && window.activeEquips) delete window.activeEquips[name];
    };

    const renderTagType = (type) => {
        if (type === "task" && window.renderTaskTypes) window.renderTaskTypes();
        else if (type === "coworker" && window.renderCoworkers) window.renderCoworkers();
        else if (type === "equip" && window.renderEquips) window.renderEquips();
        else if (type === "memoTag" && window.renderMemoTags) window.renderMemoTags();
        else if (window.renderStatuses) window.renderStatuses();
    };

    const getMonthlyCount = (type, name) => {
        const tag = getTag(type, name);
        if (!includesMonthly(tag)) return 0;
        const logs = (window.logs || []).filter((log) =>
            log && log.y === window.currentYear && log.m === window.curMonth
        );
        if (type === "equip") {
            return logs.reduce((sum, log) => sum + Number(log.equips && log.equips[name] || 0), 0);
        }
        return logs.reduce((sum, log) => {
            if (type === "task") return sum + (log.taskType && String(log.taskType).split(", ").includes(name) ? 1 : 0);
            if (type === "coworker") return sum + (log.coworkers && log.coworkers.includes(name) ? 1 : 0);
            if (type === "status") return sum + (log.status === name ? 1 : 0);
            if (type === "memoTag") return sum + (log.tags && log.tags.includes(name) ? 1 : 0);
            return sum;
        }, 0);
    };

    const getTagLabel = (type, tag) => {
        const monthly = showsNumber(tag) ? `[${getMonthlyCount(type, tag.name)}] ` : "";
        const activeQty = type === "equip" ? Number(window.activeEquips && window.activeEquips[tag.name] || 0) : 0;
        return `${monthly}${tag.name}${activeQty > 0 ? ` (${activeQty})` : ""}`;
    };

    const tagButton = (type, tag, index, active) => `
        <button type="button" class="w95-btn ${active ? "active-btn" : ""}"
            onmousedown="window.startPress(event, '${type}', ${index})"
            onmouseup="window.endPress(event, '${type}', ${index})"
            onmouseleave="window.cancelPress()"
            ontouchstart="window.startPress(event, '${type}', ${index})"
            ontouchend="window.endPress(event, '${type}', ${index})"
            ontouchcancel="window.cancelPress()">${esc(getTagLabel(type, tag))}</button>`;

    window.renderTaskTypes = () => {
        window.taskTypes = window.taskTypes || [];
        window.taskTypes.sort((a, b) => getSortCount(b) - getSortCount(a));
        document.getElementById("taskTypeArea").innerHTML =
            window.taskTypes.map((tag, index) => tagButton("task", tag, index, (window.activeTaskTypes || []).includes(tag.name))).join(" ") +
            `<button type="button" class="w95-btn" onclick="window.addNewType('task')"><b>+</b></button>`;
    };

    window.renderCoworkers = () => {
        window.coworkers = window.coworkers || [];
        window.coworkers.sort((a, b) => getSortCount(b) - getSortCount(a));
        document.getElementById("coworkerArea").innerHTML =
            window.coworkers.map((tag, index) => tagButton("coworker", tag, index, (window.selectedCoworkers || []).includes(tag.name))).join(" ") +
            `<button type="button" class="w95-btn" onclick="window.addNewType('coworker')"><b>+</b></button>`;
    };

    window.renderEquips = () => {
        window.equipments = window.equipments || [];
        document.getElementById("equipArea").innerHTML =
            window.equipments.map((tag, index) => tagButton("equip", tag, index, Number(window.activeEquips && window.activeEquips[tag.name] || 0) > 0)).join(" ") +
            `<button type="button" class="w95-btn" onclick="window.addNewType('equip')"><b>+</b></button>`;
    };

    window.renderStatuses = () => {
        window.statuses = window.statuses || [];
        window.statuses.sort((a, b) => getSortCount(b) - getSortCount(a));
        document.getElementById("statusArea").innerHTML =
            window.statuses.map((tag, index) => tagButton("status", tag, index, window.activeStatus === tag.name)).join(" ") +
            `<button type="button" class="w95-btn" onclick="window.addNewType('status')"><b>+</b></button>`;
    };

    window.renderMemoTags = () => {
        window.memoTags = window.memoTags || [];
        window.activeEditTags = window.activeEditTags || [];
        window.memoTags.sort((a, b) => getSortCount(b) - getSortCount(a));
        const area = document.getElementById("editTagArea");
        if (!area) return;
        area.innerHTML = window.memoTags.map((tag, index) =>
            tagButton("memoTag", tag, index, window.activeEditTags.includes(tag.name))
        ).join(" ") + (window.memoTags.length < 5
            ? `<button type="button" class="w95-btn" onclick="window.addNewType('memoTag')"><b>+</b></button>`
            : "");
    };

    window.handleLongPress = (type, index) => window.openTagEditBox(type, index);

    window.handleClick = (type, index) => {
        const tag = getTagArray(type)[index];
        if (!tag) return;
        if (document.activeElement && /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) document.activeElement.blur();
        if (window.pushWorkUndo && type !== "memoTag") window.pushWorkUndo();
        if (type === "task") {
            const indexOf = (window.activeTaskTypes || []).indexOf(tag.name);
            if (indexOf > -1) window.activeTaskTypes.splice(indexOf, 1); else window.activeTaskTypes.push(tag.name);
        } else if (type === "coworker") {
            const indexOf = (window.selectedCoworkers || []).indexOf(tag.name);
            if (indexOf > -1) window.selectedCoworkers.splice(indexOf, 1); else window.selectedCoworkers.push(tag.name);
        } else if (type === "status") {
            window.activeStatus = window.activeStatus === tag.name ? null : tag.name;
        } else if (type === "equip") {
            if (Number(window.activeEquips[tag.name] || 0) > 0) delete window.activeEquips[tag.name];
            else window.activeEquips[tag.name] = 1;
        } else if (type === "memoTag") {
            window.toggleTagSelection("memoTag", tag.name);
        }
        renderTagType(type);
    };

    window.openTagEditBox = (type, index) => {
        const tag = getTagArray(type)[index];
        if (!tag) return;
        window.editingTagType = type;
        window.editingTagIndex = index;
        window.tempTagQty = type === "equip"
            ? Number(window.activeEquips && window.activeEquips[tag.name] || tag.count || 0)
            : Number(tag.count || 0);
        window.tempTagShowCount = tag.showNumber !== false;
        window.tempTagMonthly = tag.includeMonthly !== false;
        document.getElementById("tagEditInput").value = tag.name;
        document.getElementById("tagEditModal").style.display = "flex";
        window.refreshTagEditControls();
        setTimeout(() => document.getElementById("tagEditInput").select(), 80);
    };

    window.refreshTagEditControls = () => {
        const qty = document.getElementById("tagQtyDisplay");
        const numberBtn = document.getElementById("tagShowCountBtn");
        const monthlyBtn = document.getElementById("tagMonthlyBtn");
        if (qty) qty.innerText = String(window.tempTagQty || 0);
        if (numberBtn) numberBtn.className = `w95-btn tag-toggle-btn ${window.tempTagShowCount ? "is-on" : "is-off"}`;
        if (monthlyBtn) monthlyBtn.className = `w95-btn tag-toggle-btn ${window.tempTagMonthly ? "is-on" : "is-off"}`;
    };

    window.changeTagQty = (delta) => {
        window.tempTagQty = Math.max(0, Number(window.tempTagQty || 0) + delta);
        window.refreshTagEditControls();
    };
    window.toggleTagShowCount = () => { window.tempTagShowCount = !window.tempTagShowCount; window.refreshTagEditControls(); };
    window.toggleTagMonthly = () => { window.tempTagMonthly = !window.tempTagMonthly; window.refreshTagEditControls(); };

    window.saveTagEdit = () => {
        const type = window.editingTagType;
        const arr = getTagArray(type);
        const tag = arr[window.editingTagIndex];
        if (!tag) return;
        const newName = document.getElementById("tagEditInput").value.trim();
        if (!newName) return alert("이름을 입력하세요.");
        if (arr.some((item, index) => index !== window.editingTagIndex && item.name === newName)) {
            return alert("같은 이름의 항목이 이미 있습니다.");
        }
        const oldName = tag.name;
        if (window.pushWorkUndo) window.pushWorkUndo();
        if (newName !== oldName) {
            window.activeTaskTypes = replaceInList(window.activeTaskTypes, oldName, newName);
            window.selectedCoworkers = replaceInList(window.selectedCoworkers, oldName, newName);
            window.activeEditTags = replaceInList(window.activeEditTags, oldName, newName);
            if (window.activeStatus === oldName) window.activeStatus = newName;
            if (window.activeEquips && Object.prototype.hasOwnProperty.call(window.activeEquips, oldName)) {
                window.activeEquips[newName] = window.activeEquips[oldName];
                delete window.activeEquips[oldName];
            }
            (window.logs || []).forEach((log) => updateLogTagName(log, type, oldName, newName));
            (window.trash || []).forEach((log) => updateLogTagName(log, type, oldName, newName));
        }
        tag.name = newName;
        tag.count = Number(window.tempTagQty || 0);
        tag.showNumber = window.tempTagShowCount !== false;
        tag.includeMonthly = window.tempTagMonthly !== false;
        if (type === "equip") {
            if (tag.count > 0) window.activeEquips[newName] = tag.count;
            else delete window.activeEquips[newName];
        }
        if (window.saveLocal) window.saveLocal();
        renderTagType(type);
        if (window.renderMain) window.renderMain();
        window.closeTagEditModal();
    };

    window.deleteTagEdit = () => {
        const type = window.editingTagType;
        const arr = getTagArray(type);
        const tag = arr[window.editingTagIndex];
        if (!tag) return;
        if (window.pushWorkUndo) window.pushWorkUndo();
        removeCurrentSelection(type, tag.name);
        // 과거 logs와 trash는 의도적으로 건드리지 않는다.
        arr.splice(window.editingTagIndex, 1);
        if (window.saveLocal) window.saveLocal();
        renderTagType(type);
        if (window.renderMain) window.renderMain();
        window.closeTagEditModal();
    };

    window.addNewType = (type) => {
        const titles = { task: "작업유형", coworker: "매니저", equip: "장비/기타", memoTag: "메모 태그", status: "상태" };
        let name = prompt(`새로운 ${titles[type] || "항목"}을 입력하세요.`);
        if (!name) return;
        name = name.trim();
        const arr = getTagArray(type);
        if (!name || arr.some((item) => item.name === name)) return;
        window.activeTaskTypes = window.activeTaskTypes || [];
        window.selectedCoworkers = window.selectedCoworkers || [];
        window.activeEquips = window.activeEquips || {};
        window.activeEditTags = window.activeEditTags || [];
        arr.push({ name, count: 0, showNumber: true, includeMonthly: true });
        if (type === "task" && !(window.activeTaskTypes || []).includes(name)) window.activeTaskTypes.push(name);
        else if (type === "coworker" && !(window.selectedCoworkers || []).includes(name)) window.selectedCoworkers.push(name);
        else if (type === "equip") window.activeEquips[name] = 1;
        else if (type === "memoTag" && !(window.activeEditTags || []).includes(name)) window.activeEditTags.push(name);
        else if (type === "status") window.activeStatus = name;
        if (window.saveLocal) window.saveLocal();
        renderTagType(type);
    };

    window.startTagSaveDelete = (event) => {
        if (event) event.preventDefault();
        window.tagDeleteTriggered = false;
        const button = document.getElementById("tagSaveDeleteBtn");
        window.tagDeleteTimer = setTimeout(() => {
            window.tagDeleteTriggered = true;
            if (button) button.classList.add("is-arming-delete");
            if (navigator.vibrate) navigator.vibrate(40);
            window.deleteTagEdit();
        }, 3000);
    };
    window.cancelTagSaveDelete = () => {
        clearTimeout(window.tagDeleteTimer);
        const button = document.getElementById("tagSaveDeleteBtn");
        if (button) button.classList.remove("is-arming-delete");
    };
    window.endTagSaveDelete = (event) => {
        if (event) event.preventDefault();
        clearTimeout(window.tagDeleteTimer);
        if (!window.tagDeleteTriggered) window.saveTagEdit();
        window.cancelTagSaveDelete();
    };

    const snapshotWorkDraft = () => {
        const ids = ["workDateInput", "workTime", "taskNo", "customerName", "workAddress", "workContent", "workNote", "workOT"];
        const fields = {};
        ids.forEach((id) => { const el = document.getElementById(id); if (el) fields[id] = el.value; });
        return {
            fields,
            isWorkDuty: !!window.isWorkDuty,
            activeTaskTypes: deepCopy(window.activeTaskTypes || []),
            selectedCoworkers: deepCopy(window.selectedCoworkers || []),
            activeStatus: window.activeStatus || null,
            activeEquips: deepCopy(window.activeEquips || {}),
            workImgs: deepCopy(window.workImgs || []),
            taskTypes: deepCopy(window.taskTypes || []),
            coworkers: deepCopy(window.coworkers || []),
            equipments: deepCopy(window.equipments || []),
            statuses: deepCopy(window.statuses || [])
        };
    };

    window.workUndoStack = [];
    window.updateWorkUndoButton = () => {
        const button = document.getElementById("workUndoBtn");
        if (button) button.disabled = window.workUndoStack.length === 0;
    };
    window.pushWorkUndo = () => {
        const modal = document.getElementById("workModal");
        if (!modal || modal.style.display !== "flex") return;
        const snapshot = snapshotWorkDraft();
        const last = window.workUndoStack[window.workUndoStack.length - 1];
        if (!last || JSON.stringify(last) !== JSON.stringify(snapshot)) {
            window.workUndoStack.push(snapshot);
            if (window.workUndoStack.length > 30) window.workUndoStack.shift();
        }
        window.updateWorkUndoButton();
    };
    window.undoWorkDraft = () => {
        const snapshot = window.workUndoStack.pop();
        if (!snapshot) return;
        const masterBefore = JSON.stringify([window.taskTypes, window.coworkers, window.equipments, window.statuses]);
        Object.entries(snapshot.fields).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el) el.value = value;
        });
        window.isWorkDuty = snapshot.isWorkDuty;
        window.activeTaskTypes = snapshot.activeTaskTypes;
        window.selectedCoworkers = snapshot.selectedCoworkers;
        window.activeStatus = snapshot.activeStatus;
        window.activeEquips = snapshot.activeEquips;
        window.workImgs = snapshot.workImgs;
        window.taskTypes = snapshot.taskTypes;
        window.coworkers = snapshot.coworkers;
        window.equipments = snapshot.equipments;
        window.statuses = snapshot.statuses;
        if (window.updateWorkDateLabel) window.updateWorkDateLabel();
        const duty = document.getElementById("workDutyBtn");
        if (duty) {
            duty.style.color = window.isWorkDuty ? "red" : "var(--w-black)";
            duty.classList.toggle("active-btn", window.isWorkDuty);
        }
        window.renderTaskTypes(); window.renderCoworkers(); window.renderEquips(); window.renderStatuses(); window.renderWorkPhotoGrid();
        if (masterBefore !== JSON.stringify([window.taskTypes, window.coworkers, window.equipments, window.statuses]) && window.saveLocal) window.saveLocal();
        window.updateWorkUndoButton();
    };

    const originalOpenWorkModal = window.openWorkModal;
    window.openWorkModal = (...args) => {
        window.workUndoStack = [];
        const result = originalOpenWorkModal(...args);
        window.updateWorkUndoButton();
        return result;
    };
    const originalCloseWorkModal = window.closeWorkModal;
    window.closeWorkModal = (...args) => {
        window.workUndoStack = [];
        window.updateWorkUndoButton();
        return originalCloseWorkModal(...args);
    };
    const originalToggleDuty = window.toggleDuty;
    window.toggleDuty = (...args) => {
        window.pushWorkUndo();
        return originalToggleDuty(...args);
    };
    const originalHandleWorkFiles = window.handleWorkFiles;
    window.handleWorkFiles = (...args) => {
        window.pushWorkUndo();
        return originalHandleWorkFiles(...args);
    };
    window.removeWorkPhoto = (index) => {
        window.pushWorkUndo();
        window.workImgs.splice(index, 1);
        window.renderWorkPhotoGrid();
    };

    const bindDraftFieldUndo = () => {
        const modal = document.getElementById("workModal");
        if (!modal || modal.dataset.undoBound) return;
        modal.dataset.undoBound = "1";
        let beforeFocus = null;
        modal.addEventListener("focusin", (event) => {
            if (/^(INPUT|TEXTAREA)$/.test(event.target.tagName)) beforeFocus = snapshotWorkDraft();
        });
        modal.addEventListener("change", () => {
            if (!beforeFocus) return;
            const current = snapshotWorkDraft();
            if (JSON.stringify(beforeFocus) !== JSON.stringify(current)) {
                window.workUndoStack.push(beforeFocus);
                if (window.workUndoStack.length > 30) window.workUndoStack.shift();
                window.updateWorkUndoButton();
            }
            beforeFocus = null;
        });
    };

    window.hasInitDragListeners = false;
    window.initWorkDragListeners = () => {
        if (window.hasInitDragListeners) return;
        const container = document.getElementById("workDragContainer");
        if (!container) return;
        let dragEl = null;
        let timer = null;
        const start = (event) => {
            const handle = event.target.closest(".drag-handle");
            if (!handle) return;
            timer = setTimeout(() => {
                dragEl = handle.closest(".drag-item");
                if (dragEl) dragEl.classList.add("dragging");
            }, 200);
        };
        const move = (event) => {
            if (!dragEl) { clearTimeout(timer); return; }
            event.preventDefault();
            const y = event.touches ? event.touches[0].clientY : event.clientY;
            const next = [...container.querySelectorAll(".drag-item:not(.dragging)")].find((item) => {
                const rect = item.getBoundingClientRect();
                return y < rect.top + rect.height / 2;
            });
            if (next) container.insertBefore(dragEl, next); else container.appendChild(dragEl);
        };
        const end = () => {
            clearTimeout(timer);
            if (!dragEl) return;
            dragEl.classList.remove("dragging");
            dragEl = null;
            localStorage.setItem("wm_work_drag_order",
                JSON.stringify([...container.querySelectorAll(".drag-item")].map((item) => item.dataset.id)));
        };
        container.addEventListener("touchstart", start, { passive: true });
        container.addEventListener("touchmove", move, { passive: false });
        container.addEventListener("touchend", end);
        container.addEventListener("mousedown", start);
        container.addEventListener("mousemove", move);
        container.addEventListener("mouseup", end);
        container.addEventListener("mouseleave", end);
        window.hasInitDragListeners = true;
    };

    const countAllowed = (type, name) => includesMonthly(getTag(type, name));
    const oldUpdateDashboardStats = window.updateDashboardStats;
    window.updateDashboardStats = () => {
        const originalLogs = window.logs;
        window.logs = (window.logs || []).map((log) => {
            if (!log || log.cat !== "work") return log;
            const copy = { ...log };
            if (copy.taskType) copy.taskType = String(copy.taskType).split(", ").filter((name) => countAllowed("task", name)).join(", ");
            if (copy.coworkers) copy.coworkers = copy.coworkers.filter((name) => countAllowed("coworker", name));
            if (copy.status && !countAllowed("status", copy.status)) copy.status = null;
            return copy;
        });
        oldUpdateDashboardStats();
        window.logs = originalLogs;
    };

    const oldRenderMain = window.renderMain;
    window.renderMain = () => {
        const originalLogs = window.logs;
        window.logs = (window.logs || []).filter((log) => log && (log.y || 2026) === window.currentYear).map((log) => {
            if (!log.status || countAllowed("status", log.status)) return log;
            return { ...log, status: null };
        });
        oldRenderMain();
        window.logs = originalLogs;
    };

    const optionLabel = (type, tag, logs) => {
        if (!showsNumber(tag)) return tag.name;
        if (!includesMonthly(tag)) return `[0] ${tag.name}`;
        let count = 0;
        logs.forEach((log) => {
            if (type === "task" && log.taskType && String(log.taskType).split(", ").includes(tag.name)) count++;
            if (type === "coworker" && log.coworkers && log.coworkers.includes(tag.name)) count++;
            if (type === "equip" && log.equips) count += Number(log.equips[tag.name] || 0);
            if (type === "status" && log.status === tag.name) count++;
            if (type === "memoTag" && log.tags && log.tags.includes(tag.name)) count++;
        });
        return `[${count}] ${tag.name}`;
    };

    window.updateSearchFilters = (targetMonth = null) => {
        const logs = targetMonth ? (window.logs || []).filter((log) => log.m === targetMonth) : (window.logs || []);
        const fill = (id, title, type, tags) => {
            const select = document.getElementById(id);
            if (!select) return;
            const selected = select.value;
            select.innerHTML = `<option value="">[ ${title} ]</option>` + (tags || []).map((tag) =>
                `<option value="${esc(tag.name)}" ${tag.name === selected ? "selected" : ""}>${esc(optionLabel(type, tag, logs))}</option>`
            ).join("");
        };
        fill("searchType", "작업유형", "task", window.taskTypes);
        fill("searchManager", "매니저", "coworker", window.coworkers);
        fill("searchEquip", "장비", "equip", window.equipments);
        fill("searchStatus", "상태", "status", window.statuses);
        fill("searchMemoTag", "태그", "memoTag", window.memoTags);
    };

    bindDraftFieldUndo();
})();
