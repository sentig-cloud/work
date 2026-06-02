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
        <button type="button" class="w95-btn layout-tag-button ${active ? "active-btn" : ""}"
            data-tag-type="${type}" data-tag-name="${esc(tag.name)}"
            onmousedown="window.startPress(event, '${type}', ${index})"
            onmouseup="window.endPress(event, '${type}', ${index})"
            onmouseleave="window.cancelPress()"
            ontouchstart="window.startPress(event, '${type}', ${index})"
            ontouchend="window.endPress(event, '${type}', ${index})"
            ontouchcancel="window.cancelPress()">${esc(getTagLabel(type, tag))}</button>`;

    window.renderTaskTypes = () => {
        window.taskTypes = window.taskTypes || [];
        document.getElementById("taskTypeArea").innerHTML =
            window.taskTypes.map((tag, index) => tagButton("task", tag, index, (window.activeTaskTypes || []).includes(tag.name))).join(" ") +
            `<button type="button" class="w95-btn" onclick="window.addNewType('task')"><b>+</b></button>`;
    };

    window.renderCoworkers = () => {
        window.coworkers = window.coworkers || [];
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
        document.getElementById("statusArea").innerHTML =
            window.statuses.map((tag, index) => tagButton("status", tag, index, window.activeStatus === tag.name)).join(" ") +
            `<button type="button" class="w95-btn" onclick="window.addNewType('status')"><b>+</b></button>`;
    };

    window.renderMemoTags = () => {
        window.memoTags = window.memoTags || [];
        window.activeEditTags = window.activeEditTags || [];
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
        window.applyWorkLayout();
        window.ensureWorkResizeHandles();
        window.setWorkLayoutMode(false);
        window.updateWorkUndoButton();
        return result;
    };
    const originalCloseWorkModal = window.closeWorkModal;
    window.closeWorkModal = (...args) => {
        window.workUndoStack = [];
        if (window.isWorkLayoutMode) window.setWorkLayoutMode(false);
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

    const WORK_LAYOUT_KEY = "wm_work_layout_v2";
    const DEFAULT_WORK_LAYOUT_HEIGHT = 0;
    const MAX_WORK_LAYOUT_HEIGHT = 150;
    window.isWorkLayoutMode = false;
    window.workLayoutLongPressed = false;
    window.workLayoutPressTimer = null;

    const getWorkLayoutContainer = () => document.getElementById("workDragContainer");
    const getLayoutViewportHeight = () => {
        const scroll = document.querySelector("#workModal .modal-content-scroll");
        return Math.max(1, scroll ? scroll.clientHeight : window.innerHeight);
    };
    const getMinLayoutHeight = (item) => item && item.dataset.id === "2" ? 18 : 10;
    const clampLayoutHeight = (item, value) => {
        if (!value) return DEFAULT_WORK_LAYOUT_HEIGHT;
        return Math.max(getMinLayoutHeight(item), Math.min(MAX_WORK_LAYOUT_HEIGHT, Number(value) || DEFAULT_WORK_LAYOUT_HEIGHT));
    };
    const getWorkLayoutItems = () => {
        const container = getWorkLayoutContainer();
        return container ? [...container.querySelectorAll(".drag-item")] : [];
    };

    const getInnerLayoutSpecs = () => {
        const date = document.getElementById("workDateInput");
        const address = document.getElementById("workAddress");
        return [
            {
                key: "1-top", axis: "x",
                items: [
                    ["date", date && date.parentElement, 2],
                    ["time", document.getElementById("workTime"), 1],
                    ["duty", document.getElementById("workDutyBtn"), 0],
                    ["ot", document.getElementById("workOT"), 1],
                    ["undo", document.getElementById("workUndoBtn"), 0]
                ]
            },
            {
                key: "1-info", axis: "x",
                items: [
                    ["taskNo", document.getElementById("taskNo"), 1],
                    ["customer", document.getElementById("customerName"), 1]
                ]
            },
            {
                key: "1-address", axis: "x",
                items: [
                    ["address", address, 1],
                    ["map", document.querySelector('.inner-layout-cell[data-inner-id="map"] > button') || (address && address.parentElement.querySelector("button")), 0]
                ]
            },
            {
                key: "2-text", axis: "y",
                items: [
                    ["content", document.getElementById("workContent"), 1],
                    ["note", document.getElementById("workNote"), 1]
                ]
            }
        ];
    };

    window.ensureInnerLayoutObjects = () => {
        getInnerLayoutSpecs().forEach((spec) => {
            const validItems = spec.items.filter((item) => item[1]);
            if (validItems.length === 0) return;
            const firstElement = validItems[0][1];
            let group = firstElement.closest(".inner-layout-group");
            if (!group) group = firstElement.parentElement;
            group.classList.add("inner-layout-group");
            group.dataset.innerGroup = spec.key;
            group.dataset.innerAxis = spec.axis;
            validItems.forEach(([id, element, flex]) => {
                let cell = element.closest(".inner-layout-cell");
                if (!cell || cell.parentElement !== group) {
                    cell = document.createElement("div");
                    cell.className = "inner-layout-cell";
                    group.insertBefore(cell, element);
                    cell.appendChild(element);
                }
                cell.dataset.innerId = id;
                cell.style.flex = flex === 0 ? "0 0 auto" : `${flex} 1 0`;
                if (!cell.querySelector(":scope > .inner-move-handle")) {
                    const handle = document.createElement("div");
                    handle.className = "inner-move-handle";
                    handle.title = "길게 누른 뒤 끌어 칸 이동";
                    cell.appendChild(handle);
                }
            });
        });
    };

    window.readWorkLayout = () => {
        try {
            return JSON.parse(localStorage.getItem(WORK_LAYOUT_KEY) || "{}");
        } catch (error) {
            console.warn("레이아웃 설정 읽기 실패:", error);
            return {};
        }
    };

    window.saveWorkLayout = () => {
        const items = getWorkLayoutItems();
        const heights = {};
        const innerOrder = {};
        items.forEach((item) => {
            heights[item.dataset.id] = clampLayoutHeight(item, parseFloat(item.dataset.layoutHeight || DEFAULT_WORK_LAYOUT_HEIGHT));
        });
        document.querySelectorAll(".inner-layout-group").forEach((group) => {
            innerOrder[group.dataset.innerGroup] = [...group.querySelectorAll(":scope > .inner-layout-cell")]
                .map((cell) => cell.dataset.innerId);
        });
        const layout = { order: items.map((item) => item.dataset.id), heights, innerOrder };
        localStorage.setItem(WORK_LAYOUT_KEY, JSON.stringify(layout));
        // 예전 순서 설정과도 호환한다.
        localStorage.setItem("wm_work_drag_order", JSON.stringify(layout.order));
    };

    window.applyWorkLayout = () => {
        const container = getWorkLayoutContainer();
        if (!container) return;
        window.ensureInnerLayoutObjects();
        const layout = window.readWorkLayout();
        if (Array.isArray(layout.order)) {
            layout.order.forEach((id) => {
                const item = container.querySelector(`.drag-item[data-id="${id}"]`);
                if (item) container.appendChild(item);
            });
        }
        getWorkLayoutItems().forEach((item) => {
            const height = clampLayoutHeight(item, layout.heights && layout.heights[item.dataset.id]);
            item.dataset.layoutHeight = String(height);
            item.style.width = "100%";
            item.style.maxWidth = "100%";
            item.style.alignSelf = "flex-start";
            item.style.height = height ? `${Math.round(getLayoutViewportHeight() * height / 100)}px` : "";
            item.style.overflow = height ? "auto" : "";
        });
        document.querySelectorAll(".inner-layout-group").forEach((group) => {
            const order = layout.innerOrder && layout.innerOrder[group.dataset.innerGroup];
            if (!Array.isArray(order)) return;
            order.forEach((id) => {
                const cell = group.querySelector(`:scope > .inner-layout-cell[data-inner-id="${id}"]`);
                if (cell) group.appendChild(cell);
            });
        });
    };

    window.ensureWorkResizeHandles = () => {
        getWorkLayoutItems().forEach((item) => {
            if (item.querySelector(":scope > .work-resize-handle")) return;
            const handle = document.createElement("div");
            handle.className = "work-resize-handle";
            handle.title = "위아래로 끌어 칸 높이 조절";
            item.appendChild(handle);
        });
    };

    window.setWorkLayoutMode = (enabled) => {
        window.isWorkLayoutMode = !!enabled;
        const modal = document.getElementById("workModal");
        const titlebar = document.getElementById("workModalTitlebar");
        if (modal) modal.classList.toggle("layout-edit-mode", window.isWorkLayoutMode);
        if (titlebar) titlebar.classList.toggle("is-layout-edit", window.isWorkLayoutMode);
        window.ensureWorkResizeHandles();
        if (!window.isWorkLayoutMode) window.saveWorkLayout();
    };

    window.startWorkLayoutPress = (event) => {
        if (event) event.preventDefault();
        clearTimeout(window.workLayoutPressTimer);
        window.workLayoutLongPressed = false;
        const button = document.getElementById("workLayoutModeBtn");
        if (button) button.classList.add("is-layout-pressing");
        window.workLayoutPressTimer = setTimeout(() => {
            window.workLayoutLongPressed = true;
            window.setWorkLayoutMode(true);
            if (button) button.classList.remove("is-layout-pressing");
            if (navigator.vibrate) navigator.vibrate(40);
        }, 2000);
    };

    window.endWorkLayoutPress = (event) => {
        if (event) event.preventDefault();
        clearTimeout(window.workLayoutPressTimer);
        const button = document.getElementById("workLayoutModeBtn");
        if (button) button.classList.remove("is-layout-pressing");
        if (!window.workLayoutLongPressed && window.isWorkLayoutMode) window.setWorkLayoutMode(false);
        window.workLayoutLongPressed = false;
    };
    window.cancelWorkLayoutPress = () => {
        clearTimeout(window.workLayoutPressTimer);
        const button = document.getElementById("workLayoutModeBtn");
        if (button) button.classList.remove("is-layout-pressing");
    };

    window.resetWorkLayout = () => {
        if (!window.isWorkLayoutMode) return;
        localStorage.removeItem(WORK_LAYOUT_KEY);
        localStorage.removeItem("wm_work_drag_order");
        const container = getWorkLayoutContainer();
        if (!container) return;
        [...getWorkLayoutItems()].sort((a, b) => Number(a.dataset.id) - Number(b.dataset.id)).forEach((item) => {
            item.dataset.layoutHeight = String(DEFAULT_WORK_LAYOUT_HEIGHT);
            item.style.width = "100%";
            item.style.height = "";
            item.style.overflow = "";
            container.appendChild(item);
        });
        document.querySelectorAll(".inner-layout-group").forEach((group) => {
            [...group.querySelectorAll(":scope > .inner-layout-cell")]
                .sort((a, b) => a.dataset.innerId.localeCompare(b.dataset.innerId))
                .forEach((cell) => group.appendChild(cell));
        });
        // 기본 순서는 객체화 정의 순서로 다시 적용한다.
        getInnerLayoutSpecs().forEach((spec) => {
            const group = document.querySelector(`.inner-layout-group[data-inner-group="${spec.key}"]`);
            if (!group) return;
            spec.items.forEach(([id]) => {
                const cell = group.querySelector(`:scope > .inner-layout-cell[data-inner-id="${id}"]`);
                if (cell) group.appendChild(cell);
            });
        });
        window.saveWorkLayout();
    };

    window.hasInitDragListeners = false;
    window.initWorkDragListeners = () => {
        if (window.hasInitDragListeners) return;
        const container = getWorkLayoutContainer();
        if (!container) return;
        let dragEl = null;
        let dragTimer = null;
        let resizeEl = null;
        let resizeViewportHeight = 0;

        const start = (event) => {
            if (!window.isWorkLayoutMode) return;
            const resizeHandle = event.target.closest(".work-resize-handle");
            if (resizeHandle) {
                resizeEl = resizeHandle.closest(".drag-item");
                resizeViewportHeight = getLayoutViewportHeight();
                if (event.cancelable) event.preventDefault();
                return;
            }
            const dragHandle = event.target.closest(".drag-handle");
            if (!dragHandle) return;
            if (event.cancelable) event.preventDefault();
            dragTimer = setTimeout(() => {
                dragEl = dragHandle.closest(".drag-item");
                if (dragEl) dragEl.classList.add("dragging");
            }, 300);
        };

        const move = (event) => {
            if (!window.isWorkLayoutMode) return;
            const point = event.touches ? event.touches[0] : event;
            if (resizeEl) {
                if (event.cancelable) event.preventDefault();
                const top = resizeEl.getBoundingClientRect().top;
                const height = clampLayoutHeight(resizeEl, ((point.clientY - top) / resizeViewportHeight) * 100);
                resizeEl.dataset.layoutHeight = String(Math.round(height * 10) / 10);
                resizeEl.style.height = `${Math.round(resizeViewportHeight * height / 100)}px`;
                resizeEl.style.overflow = "auto";
                return;
            }
            if (!dragEl) {
                clearTimeout(dragTimer);
                return;
            }
            if (event.cancelable) event.preventDefault();
            const next = [...container.querySelectorAll(".drag-item:not(.dragging)")].find((item) => {
                const rect = item.getBoundingClientRect();
                return point.clientY < rect.top + rect.height / 2;
            });
            if (next) container.insertBefore(dragEl, next); else container.appendChild(dragEl);
        };

        const end = () => {
            clearTimeout(dragTimer);
            if (dragEl) dragEl.classList.remove("dragging");
            if (dragEl || resizeEl) window.saveWorkLayout();
            dragEl = null;
            resizeEl = null;
        };

        container.addEventListener("touchstart", start, { passive: false });
        container.addEventListener("touchmove", move, { passive: false });
        container.addEventListener("touchend", end);
        container.addEventListener("touchcancel", end);
        container.addEventListener("mousedown", start);
        window.addEventListener("mousemove", move);
        window.addEventListener("mouseup", end);
        window.hasInitDragListeners = true;
    };

    const isTextEditingTarget = (target) => !!target && (
        target.matches("input, textarea, [contenteditable='true']") ||
        !!target.closest("input, textarea, [contenteditable='true']")
    );

    document.addEventListener("contextmenu", (event) => {
        if (!isTextEditingTarget(event.target)) event.preventDefault();
    });
    document.addEventListener("selectstart", (event) => {
        if (!isTextEditingTarget(event.target)) event.preventDefault();
    });
    document.addEventListener("dragstart", (event) => {
        if (!isTextEditingTarget(event.target)) event.preventDefault();
    });

    const originalStartPress = window.startPress;
    const originalEndPress = window.endPress;
    const originalCancelPress = window.cancelPress;
    window.startPress = (...args) => {
        if (window.isWorkLayoutMode) return;
        return originalStartPress(...args);
    };
    window.endPress = (...args) => {
        if (window.isWorkLayoutMode) return;
        return originalEndPress(...args);
    };
    window.cancelPress = (...args) => {
        if (window.isWorkLayoutMode) return;
        return originalCancelPress(...args);
    };

    window.hasInitTagReorderListeners = false;
    window.initTagReorderListeners = () => {
        if (window.hasInitTagReorderListeners) return;
        const modal = document.getElementById("workModal");
        if (!modal) return;
        let pendingTagButton = null;
        let tagButtonEl = null;
        let tagArea = null;
        let tagType = null;
        let tagTimer = null;

        const start = (event) => {
            if (!window.isWorkLayoutMode) return;
            const button = event.target.closest(".layout-tag-button");
            if (!button || !modal.contains(button)) return;
            if (event.cancelable) event.preventDefault();
            pendingTagButton = button;
            tagTimer = setTimeout(() => {
                tagButtonEl = button;
                tagArea = button.parentElement;
                tagType = button.dataset.tagType;
                tagButtonEl.classList.add("is-tag-dragging");
                if (navigator.vibrate) navigator.vibrate(25);
            }, 450);
        };

        const move = (event) => {
            if (!tagButtonEl || !tagArea) return;
            if (event.cancelable) event.preventDefault();
            const point = event.touches ? event.touches[0] : event;
            const over = document.elementFromPoint(point.clientX, point.clientY);
            const target = over && over.closest(".layout-tag-button");
            if (!target || target === tagButtonEl || target.parentElement !== tagArea || target.dataset.tagType !== tagType) return;
            const rect = target.getBoundingClientRect();
            const before = point.clientX < rect.left + rect.width / 2;
            tagArea.insertBefore(tagButtonEl, before ? target : target.nextSibling);
        };

        const end = () => {
            clearTimeout(tagTimer);
            if (!tagButtonEl || !tagArea || !tagType) {
                if (pendingTagButton && window.isWorkLayoutMode) {
                    const type = pendingTagButton.dataset.tagType;
                    const index = getTagArray(type).findIndex((tag) => tag.name === pendingTagButton.dataset.tagName);
                    if (index > -1) window.openTagEditBox(type, index);
                }
                pendingTagButton = null;
                return;
            }
            tagButtonEl.classList.remove("is-tag-dragging");
            const orderedNames = [...tagArea.querySelectorAll(`.layout-tag-button[data-tag-type="${tagType}"]`)]
                .map((button) => button.dataset.tagName);
            const arr = getTagArray(tagType);
            const byName = new Map(arr.map((tag) => [tag.name, tag]));
            arr.splice(0, arr.length, ...orderedNames.map((name) => byName.get(name)).filter(Boolean));
            if (window.saveLocal) window.saveLocal("tag-order");
            renderTagType(tagType);
            tagButtonEl = null;
            pendingTagButton = null;
            tagArea = null;
            tagType = null;
        };

        modal.addEventListener("touchstart", start, { passive: false });
        modal.addEventListener("touchmove", move, { passive: false });
        modal.addEventListener("touchend", end);
        modal.addEventListener("touchcancel", end);
        modal.addEventListener("mousedown", start);
        window.addEventListener("mousemove", move);
        window.addEventListener("mouseup", end);
        window.hasInitTagReorderListeners = true;
    };

    window.hasInitInnerReorderListeners = false;
    window.initInnerReorderListeners = () => {
        if (window.hasInitInnerReorderListeners) return;
        const modal = document.getElementById("workModal");
        if (!modal) return;
        let cell = null;
        let group = null;
        let timer = null;

        const start = (event) => {
            if (!window.isWorkLayoutMode) return;
            const handle = event.target.closest(".inner-move-handle");
            if (!handle || !modal.contains(handle)) return;
            if (event.cancelable) event.preventDefault();
            timer = setTimeout(() => {
                cell = handle.closest(".inner-layout-cell");
                group = cell && cell.parentElement;
                if (cell) cell.classList.add("is-inner-dragging");
                if (navigator.vibrate) navigator.vibrate(25);
            }, 400);
        };

        const move = (event) => {
            if (!cell || !group) return;
            if (event.cancelable) event.preventDefault();
            const point = event.touches ? event.touches[0] : event;
            const over = document.elementFromPoint(point.clientX, point.clientY);
            const target = over && over.closest(".inner-layout-cell");
            if (!target || target === cell || target.parentElement !== group) return;
            const rect = target.getBoundingClientRect();
            const before = group.dataset.innerAxis === "y"
                ? point.clientY < rect.top + rect.height / 2
                : point.clientX < rect.left + rect.width / 2;
            group.insertBefore(cell, before ? target : target.nextSibling);
        };

        const end = () => {
            clearTimeout(timer);
            if (!cell) return;
            cell.classList.remove("is-inner-dragging");
            window.saveWorkLayout();
            cell = null;
            group = null;
        };

        modal.addEventListener("touchstart", start, { passive: false });
        modal.addEventListener("touchmove", move, { passive: false });
        modal.addEventListener("touchend", end);
        modal.addEventListener("touchcancel", end);
        modal.addEventListener("mousedown", start);
        window.addEventListener("mousemove", move);
        window.addEventListener("mouseup", end);
        window.hasInitInnerReorderListeners = true;
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
    window.initTagReorderListeners();
    window.initInnerReorderListeners();
})();
