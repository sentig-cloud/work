// work_enhancements.js (v2 - 그리드 레이아웃 + 그룹화)
(function () {
    "use strict";

    // ─────────────────────────────────────────
    // 유틸
    // ─────────────────────────────────────────
    const esc = (v) => String(v ?? "")
        .replace(/&/g, "&amp;").replace(/</g, "&lt;")
        .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

    const getTagArray = (type) => {
        if (type === "task") return window.taskTypes || [];
        if (type === "coworker") return window.coworkers || [];
        if (type === "equip") return window.equipments || [];
        if (type === "memoTag") return window.memoTags || [];
        return window.statuses || [];
    };

    const getTag = (type, name) => getTagArray(type).find((t) => t.name === name);
    const showsNumber = (tag) => !tag || tag.showNumber !== false;
    const includesMonthly = (tag) => !tag || tag.includeMonthly !== false;
    const getSortCount = (tag) => Number(tag && tag.count) || 0;

    const replaceInList = (list, oldName, newName) =>
        Array.isArray(list) ? list.map((n) => n === oldName ? newName : n) : list;

    const updateLogTagName = (log, type, oldName, newName) => {
        if (!log) return;
        if (type === "task" && log.taskType)
            log.taskType = replaceInList(String(log.taskType).split(", "), oldName, newName).join(", ");
        else if (type === "coworker" && log.coworkers)
            log.coworkers = replaceInList(log.coworkers, oldName, newName);
        else if (type === "status" && log.status === oldName)
            log.status = newName;
        else if (type === "memoTag" && log.tags)
            log.tags = replaceInList(log.tags, oldName, newName);
        else if (type === "equip" && log.equips && Object.prototype.hasOwnProperty.call(log.equips, oldName)) {
            log.equips[newName] = log.equips[oldName];
            delete log.equips[oldName];
        }
    };

    const removeCurrentSelection = (type, name) => {
        if (type === "task") window.activeTaskTypes = (window.activeTaskTypes || []).filter((i) => i !== name);
        if (type === "coworker") window.selectedCoworkers = (window.selectedCoworkers || []).filter((i) => i !== name);
        if (type === "status" && window.activeStatus === name) window.activeStatus = null;
        if (type === "memoTag") window.activeEditTags = (window.activeEditTags || []).filter((i) => i !== name);
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
        const logs = (window.logs || []).filter((l) => l && l.y === window.currentYear && l.m === window.curMonth);
        if (type === "equip") return logs.reduce((s, l) => s + Number(l.equips && l.equips[name] || 0), 0);
        return logs.reduce((s, l) => {
            if (type === "task") return s + (l.taskType && String(l.taskType).split(", ").includes(name) ? 1 : 0);
            if (type === "coworker") return s + (l.coworkers && l.coworkers.includes(name) ? 1 : 0);
            if (type === "status") return s + (l.status === name ? 1 : 0);
            if (type === "memoTag") return s + (l.tags && l.tags.includes(name) ? 1 : 0);
            return s;
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

    // ─────────────────────────────────────────
    // 태그 렌더링
    // ─────────────────────────────────────────
    window.renderTaskTypes = () => {
        window.taskTypes = window.taskTypes || [];
        window.taskTypes.sort((a, b) => getSortCount(b) - getSortCount(a));
        const el = document.getElementById("taskTypeArea");
        if (!el) return;
        el.innerHTML = window.taskTypes.map((t, i) =>
            tagButton("task", t, i, (window.activeTaskTypes || []).includes(t.name))
        ).join("") + `<button type="button" class="w95-btn" onclick="window.addNewType('task')"><b>+</b></button>`;
    };

    window.renderCoworkers = () => {
        window.coworkers = window.coworkers || [];
        window.coworkers.sort((a, b) => getSortCount(b) - getSortCount(a));
        const el = document.getElementById("coworkerArea");
        if (!el) return;
        el.innerHTML = window.coworkers.map((c, i) =>
            tagButton("coworker", c, i, (window.selectedCoworkers || []).includes(c.name))
        ).join("") + `<button type="button" class="w95-btn" onclick="window.addNewType('coworker')"><b>+</b></button>`;
    };

    window.renderStatuses = () => {
        window.statuses = window.statuses || [];
        window.statuses.sort((a, b) => getSortCount(b) - getSortCount(a));
        const el = document.getElementById("statusArea");
        if (!el) return;
        el.innerHTML = window.statuses.map((s, i) =>
            tagButton("status", s, i, window.activeStatus === s.name)
        ).join("") + `<button type="button" class="w95-btn" onclick="window.addNewType('status')"><b>+</b></button>`;
    };

    window.renderEquips = () => {
        window.equipments = window.equipments || [];
        const el = document.getElementById("equipArea");
        if (!el) return;
        el.innerHTML = window.equipments.map((eq, i) => {
            const count = window.activeEquips && window.activeEquips[eq.name] || 0;
            return tagButton("equip", { ...eq, name: count > 0 ? `${eq.name} (${count})` : eq.name, _name: eq.name }, i, count > 0);
        }).join("") + `<button type="button" class="w95-btn" onclick="window.addNewType('equip')"><b>+</b></button>`;
        // 실제 태그 이름 복원
        el.querySelectorAll("[data-tag-name]").forEach((btn, i) => {
            if (window.equipments[i]) btn.dataset.tagName = window.equipments[i].name;
        });
    };

    window.renderMemoTags = () => {
        window.memoTags = window.memoTags || [];
        window.memoTags.sort((a, b) => getSortCount(b) - getSortCount(a));
        const el = document.getElementById("editTagArea");
        if (!el) return;
        el.innerHTML = window.memoTags.map((t, i) => {
            const active = (window.activeEditTags || []).includes(t.name);
            return `<button type="button" class="w95-btn layout-tag-button ${active ? "active-btn" : ""}"
                style="height:30px; white-space:nowrap;"
                onclick="window.toggleTagSelection('memoTag', '${esc(t.name)}')"
                oncontextmenu="event.preventDefault(); window.openTagEditBox('memoTag', ${i});"
                data-tag-type="memoTag" data-tag-name="${esc(t.name)}">${esc(t.name)}</button>`;
        }).join("") + (window.memoTags.length < 5
            ? `<button type="button" class="w95-btn" style="height:30px; width:36px;" onclick="window.addNewType('memoTag')"><b>+</b></button>`
            : "");
    };

    // ─────────────────────────────────────────
    // Undo 스택
    // ─────────────────────────────────────────
    window.workUndoStack = [];
    const snapshotWorkDraft = () => ({
        taskNo: document.getElementById("taskNo")?.value ?? "",
        customerName: document.getElementById("customerName")?.value ?? "",
        address: document.getElementById("workAddress")?.value ?? "",
        content: document.getElementById("workContent")?.value ?? "",
        note: document.getElementById("workNote")?.value ?? "",
        ot: document.getElementById("workOT")?.value ?? "",
        time: document.getElementById("workTime")?.value ?? "",
        date: document.getElementById("workDateInput")?.value ?? ""
    });

    window.updateWorkUndoButton = () => {
        const btn = document.getElementById("workUndoBtn");
        if (btn) btn.disabled = window.workUndoStack.length === 0;
    };

    window.undoWorkDraft = () => {
        if (!window.workUndoStack.length) return;
        const prev = window.workUndoStack.pop();
        if (prev.taskNo !== undefined && document.getElementById("taskNo")) document.getElementById("taskNo").value = prev.taskNo;
        if (prev.customerName !== undefined && document.getElementById("customerName")) document.getElementById("customerName").value = prev.customerName;
        if (prev.address !== undefined && document.getElementById("workAddress")) document.getElementById("workAddress").value = prev.address;
        if (prev.content !== undefined && document.getElementById("workContent")) document.getElementById("workContent").value = prev.content;
        if (prev.note !== undefined && document.getElementById("workNote")) document.getElementById("workNote").value = prev.note;
        if (prev.ot !== undefined && document.getElementById("workOT")) document.getElementById("workOT").value = prev.ot;
        if (prev.time !== undefined && document.getElementById("workTime")) document.getElementById("workTime").value = prev.time;
        if (prev.date !== undefined && document.getElementById("workDateInput")) {
            document.getElementById("workDateInput").value = prev.date;
            if (window.updateWorkDateLabel) window.updateWorkDateLabel();
        }
        window.updateWorkUndoButton();
    };

    const bindDraftFieldUndo = () => {
        const modal = document.getElementById("workModal");
        if (!modal) return;
        let beforeFocus = null;
        modal.addEventListener("focusin", () => {
            if (/^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName)) beforeFocus = snapshotWorkDraft();
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

    // ═══════════════════════════════════════════
    // 레이아웃 엔진 v2
    // ═══════════════════════════════════════════
    const LAYOUT_KEY = "wm_work_layout_v3";
    const GRID_COLS = 4; // 기본 그리드 칸 수

    window.isWorkLayoutMode = false;
    window.workLayoutLongPressed = false;
    window.workLayoutPressTimer = null;

    // 현재 선택된 블록
    let selectedBlock = null;
    // 현재 그룹화 작업에 선택된 블록들
    let groupCandidates = new Set();

    const getContainer = () => document.getElementById("workDragContainer");
    const getAllBlocks = (container) => [...(container || getContainer())?.querySelectorAll(":scope > .drag-item") || []];

    // ─── 레이아웃 저장/복원 ───

    const getBlockLayout = (block) => ({
        cols: Number(block.style.getPropertyValue("--item-cols") || block.dataset.cols || GRID_COLS),
        rows: Number(block.style.getPropertyValue("--item-rows") || block.dataset.rows || 1),
        isGroup: block.classList.contains("is-group-block"),
        groupEnabled: !block.classList.contains("is-group-disabled"),
        groupTitle: block.querySelector(".group-block-titlebar span")?.textContent || "",
        innerOrder: block.classList.contains("is-group-block")
            ? [...block.querySelectorAll(":scope > .group-block-inner > .drag-item")].map(b => b.dataset.id)
            : null
    });

    window.saveWorkLayout = () => {
        const container = getContainer();
        if (!container) return;
        const order = [];
        const blocks = {};
        getAllBlocks(container).forEach(block => {
            const id = block.dataset.id;
            order.push(id);
            blocks[id] = getBlockLayout(block);
        });
        localStorage.setItem(LAYOUT_KEY, JSON.stringify({ version: 3, order, blocks }));
        localStorage.setItem("wm_work_drag_order", JSON.stringify(order));
    };

    window.readWorkLayout = () => {
        try { return JSON.parse(localStorage.getItem(LAYOUT_KEY) || "{}"); } catch { return {}; }
    };

    const setBlockSize = (block, cols, rows) => {
        const c = Math.max(1, Math.min(GRID_COLS, Number(cols) || GRID_COLS));
        const r = Math.max(1, Math.min(20, Number(rows) || 1));
        block.dataset.cols = String(c);
        block.dataset.rows = String(r);
        block.style.setProperty("--item-cols", c);
        block.style.setProperty("--item-rows", r);
    };

    window.applyWorkLayout = () => {
        const container = getContainer();
        if (!container) return;
        const layout = window.readWorkLayout();
        if (Array.isArray(layout.order)) {
            layout.order.forEach(id => {
                const block = container.querySelector(`.drag-item[data-id="${id}"]`);
                if (block) container.appendChild(block);
            });
        }
        getAllBlocks(container).forEach(block => {
            const id = block.dataset.id;
            const saved = layout.blocks && layout.blocks[id];
            setBlockSize(block, saved?.cols ?? GRID_COLS, saved?.rows ?? 1);
        });
        window.ensureBlockHandles();
    };

    // ─── 블록 핸들 주입 ───
    window.ensureBlockHandles = () => {
        const container = getContainer();
        if (!container) return;
        getAllBlocks(container).forEach(block => {
            if (block.querySelector(":scope > .block-move-handle")) return;
            // 이동 핸들
            const moveH = document.createElement("div");
            moveH.className = "block-move-handle";
            moveH.textContent = "O";
            moveH.title = "눌러서 이동";
            block.appendChild(moveH);
            // 리사이즈 핸들
            const resizeH = document.createElement("div");
            resizeH.className = "block-resize-handle";
            resizeH.textContent = "/";
            resizeH.title = "눌러서 크기 조절";
            block.appendChild(resizeH);
            // 선택해제
            const deselBtn = document.createElement("div");
            deselBtn.className = "block-deselect-btn";
            deselBtn.textContent = "✕";
            deselBtn.title = "선택 해제";
            block.appendChild(deselBtn);
        });
    };

    // ─── 블록 선택 ───
    const selectBlock = (block) => {
        if (selectedBlock && selectedBlock !== block) {
            selectedBlock.classList.remove("is-block-selected");
        }
        selectedBlock = block || null;
        if (selectedBlock) selectedBlock.classList.add("is-block-selected");
    };

    const deselectBlock = () => {
        if (selectedBlock) selectedBlock.classList.remove("is-block-selected");
        selectedBlock = null;
    };

    // ─── 레이아웃 모드 진입/해제 ───
    window.setWorkLayoutMode = (enabled) => {
        window.isWorkLayoutMode = !!enabled;
        const modal = document.getElementById("workModal");
        const titlebar = document.getElementById("workModalTitlebar");

        if (window.isWorkLayoutMode) {
            // ── 진입 시: 포커스 강제 해제, 키보드 내리기
            if (document.activeElement && document.activeElement.blur) {
                document.activeElement.blur();
            }
            // 모든 input readonly 설정 (CSS pointer-events 보완)
            const container = document.getElementById("workDragContainer");
            if (container) {
                container.querySelectorAll("input, textarea").forEach(el => {
                    el.dataset.layoutPrevReadonly = el.readOnly ? "1" : "0";
                    el.readOnly = true;
                });
            }
        } else {
            // ── 해제 시: readonly 복원
            const container = document.getElementById("workDragContainer");
            if (container) {
                container.querySelectorAll("input, textarea").forEach(el => {
                    el.readOnly = el.dataset.layoutPrevReadonly === "1";
                    delete el.dataset.layoutPrevReadonly;
                });
            }
        }

        if (modal) modal.classList.toggle("layout-edit-mode", window.isWorkLayoutMode);
        if (titlebar) titlebar.classList.toggle("is-layout-edit", window.isWorkLayoutMode);

        if (!window.isWorkLayoutMode) {
            deselectBlock();
            groupCandidates.clear();
            window.saveWorkLayout();
            window.applyWorkLayout();
        }
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

    // ─── 초기화 ───
    window.resetWorkLayout = () => {
        if (!window.isWorkLayoutMode) return;
        localStorage.removeItem(LAYOUT_KEY);
        localStorage.removeItem("wm_work_drag_order");
        const container = getContainer();
        if (!container) return;
        [...getAllBlocks(container)]
            .sort((a, b) => Number(a.dataset.id) - Number(b.dataset.id))
            .forEach(block => {
                setBlockSize(block, GRID_COLS, 1);
                container.appendChild(block);
            });
    };

    // ═══════════════════════════════════════════
    // 그룹화 / 그룹해제
    // ═══════════════════════════════════════════

    // 그룹 블록 생성
    const createGroupBlock = (title, childBlocks) => {
        const groupId = "grp_" + Date.now();
        const groupBlock = document.createElement("div");
        groupBlock.className = "drag-item is-group-block";
        groupBlock.dataset.id = groupId;
        setBlockSize(groupBlock, GRID_COLS, Math.max(childBlocks.length, 2));

        const titlebar = document.createElement("div");
        titlebar.className = "group-block-titlebar";
        titlebar.innerHTML = `
            <span>${esc(title)}</span>
            <button type="button" class="group-add-btn" onclick="window.addBlockToGroup('${groupId}')">+ 태그</button>
        `;
        groupBlock.appendChild(titlebar);

        const inner = document.createElement("div");
        inner.className = "group-block-inner";
        inner.style.setProperty("--group-cols", GRID_COLS);
        groupBlock.appendChild(inner);

        childBlocks.forEach(block => {
            setBlockSize(block, GRID_COLS, Number(block.dataset.rows) || 1);
            inner.appendChild(block);
        });

        // 핸들 추가
        const moveH = document.createElement("div");
        moveH.className = "block-move-handle";
        moveH.textContent = "O";
        groupBlock.appendChild(moveH);

        const resizeH = document.createElement("div");
        resizeH.className = "block-resize-handle";
        resizeH.textContent = "/";
        groupBlock.appendChild(resizeH);

        const deselBtn = document.createElement("div");
        deselBtn.className = "block-deselect-btn";
        deselBtn.textContent = "✕";
        groupBlock.appendChild(deselBtn);

        return groupBlock;
    };

    // 그룹화 실행
    window.groupSelectedBlocks = () => {
        if (!window.isWorkLayoutMode) return;
        const container = getContainer();
        if (!container) return;

        // 선택된 블록들 수집
        const selected = getAllBlocks(container).filter(b =>
            b.classList.contains("is-block-selected") || groupCandidates.has(b.dataset.id)
        );

        if (selected.length < 1) {
            alert("그룹화할 블록을 먼저 선택해주세요.\n블록을 탭하면 선택됩니다.');");
            return;
        }

        const title = prompt("그룹 이름을 입력하세요.", "새 그룹");
        if (!title) return;

        // v2 groups에도 등록
        if (window.addCustomGroup) {
            window.addCustomGroup(title.trim());
            window.markDirty && window.markDirty("master", "groups", "upsert");
        }

        const groupBlock = createGroupBlock(title.trim(), selected);
        // 첫 번째 선택 블록 위치에 삽입
        if (selected[0].parentElement === container) {
            container.insertBefore(groupBlock, selected[0]);
        } else {
            container.appendChild(groupBlock);
        }

        deselectBlock();
        groupCandidates.clear();
        window.ensureBlockHandles();
        window.saveWorkLayout();
    };

    // 그룹해제 실행
    window.ungroupSelectedBlock = () => {
        if (!window.isWorkLayoutMode) return;
        const container = getContainer();
        if (!container) return;

        const groupBlock = selectedBlock || getAllBlocks(container).find(b => b.classList.contains("is-group-block") && b.classList.contains("is-block-selected"));
        if (!groupBlock || !groupBlock.classList.contains("is-group-block")) {
            alert("그룹 블록을 선택 후 그룹해제를 눌러주세요.");
            return;
        }

        const inner = groupBlock.querySelector(".group-block-inner");
        const childBlocks = inner ? [...inner.querySelectorAll(":scope > .drag-item")] : [];

        // 선택태그 상자 블록은 비활성화, 기본 블록은 독립 유지
        const builtInIds = ["1", "2", "7"]; // 날짜/내용/사진
        childBlocks.forEach(block => {
            const isBuiltIn = builtInIds.includes(block.dataset.id) || !block.dataset.id?.startsWith("grp_tag_");
            if (!isBuiltIn) {
                // 커스텀 태그 블록 → 비활성화
                block.classList.add("is-group-disabled");
                // groups에서도 비활성화
                const groupId = block.dataset.groupId;
                if (groupId && window.getGroupById) {
                    const g = window.getGroupById(groupId);
                    if (g) {
                        g.enabled = false;
                        window.markDirty && window.markDirty("master", "groups", "upsert");
                    }
                }
            }
            setBlockSize(block, GRID_COLS, Number(block.dataset.rows) || 1);
            container.insertBefore(block, groupBlock);
        });

        groupBlock.remove();
        deselectBlock();
        window.ensureBlockHandles();
        window.saveWorkLayout();
    };

    // 그룹에 태그 블록 추가
    window.addBlockToGroup = (groupId) => {
        const groupBlock = getContainer()?.querySelector(`.drag-item[data-id="${groupId}"]`);
        if (!groupBlock) return;

        const name = prompt("새 태그 그룹 이름을 입력하세요.");
        if (!name || !name.trim()) return;

        // v2 groups에 추가
        let newGroup = null;
        if (window.addCustomGroup) {
            newGroup = window.addCustomGroup(name.trim());
            window.markDirty && window.markDirty("master", "groups", "upsert");
            window.saveLocal && window.saveLocal("group-add");
        }

        // 태그 블록 DOM 생성
        const tagBlock = document.createElement("div");
        tagBlock.className = "drag-item w95-in";
        tagBlock.dataset.id = "grp_tag_" + (newGroup ? newGroup.id : Date.now());
        tagBlock.dataset.groupId = newGroup ? newGroup.id : "";
        setBlockSize(tagBlock, GRID_COLS, 1);
        tagBlock.innerHTML = `
            <div class="box-title">${esc(name.trim())}</div>
            <div id="customGroupArea_${newGroup ? newGroup.id : 'tmp'}" class="btn-tag-area"></div>
        `;

        const inner = groupBlock.querySelector(".group-block-inner");
        if (inner) inner.appendChild(tagBlock);

        window.ensureBlockHandles();
        if (newGroup && window.renderCustomGroup) window.renderCustomGroup(newGroup.id);
        window.saveWorkLayout();
    };

    // ═══════════════════════════════════════════
    // 드래그 이동 + 리사이즈 엔진
    // ═══════════════════════════════════════════
    window.hasInitDragListeners = false;
    window.initWorkDragListeners = () => {
        if (window.hasInitDragListeners) return;
        const container = getContainer();
        if (!container) return;

        let dragBlock = null;
        let resizeBlock = null;
        let resizeStart = null;
        let dragTimer = null;
        let pressOrigin = null;
        let activeHandle = null; // 'move' | 'resize'

        const getPoint = (e) => e.touches ? e.touches[0] : e;

        const startMove = (block, point) => {
            dragTimer = setTimeout(() => {
                dragBlock = block;
                dragBlock.classList.add("is-block-dragging");
                if (navigator.vibrate) navigator.vibrate(25);
            }, 250);
        };

        const startResize = (block, point) => {
            resizeBlock = block;
            const containerWidth = container.getBoundingClientRect().width;
            resizeStart = {
                x: point.clientX,
                y: point.clientY,
                cols: Number(block.dataset.cols) || GRID_COLS,
                rows: Number(block.dataset.rows) || 1,
                colWidth: Math.max(1, (containerWidth - (GRID_COLS - 1) * 2) / GRID_COLS),
                rowHeight: 38
            };
            if (navigator.vibrate) navigator.vibrate(15);
        };

        const onStart = (e) => {
            const point = getPoint(e);
            const moveHandle = e.target.closest(".block-move-handle");
            const resizeHandle = e.target.closest(".block-resize-handle");
            const deselBtn = e.target.closest(".block-deselect-btn");

            if (deselBtn) {
                e.preventDefault();
                deselectBlock();
                return;
            }

            if (moveHandle) {
                e.preventDefault();
                const block = moveHandle.closest(".drag-item");
                if (!block) return;
                activeHandle = "move";
                pressOrigin = { x: point.clientX, y: point.clientY };
                selectBlock(block);
                startMove(block, point);
                return;
            }

            if (resizeHandle) {
                e.preventDefault();
                const block = resizeHandle.closest(".drag-item");
                if (!block) return;
                activeHandle = "resize";
                selectBlock(block);
                startResize(block, point);
                return;
            }

            // 레이아웃 모드에서 블록 탭 → 선택
            if (window.isWorkLayoutMode) {
                const block = e.target.closest("#workDragContainer > .drag-item");
                if (block) {
                    pressOrigin = { x: point.clientX, y: point.clientY };
                    // 짧은 탭이면 선택
                    dragTimer = setTimeout(() => {
                        selectBlock(block);
                        dragTimer = null;
                    }, 150);
                }
            }
        };

        const onMove = (e) => {
            const point = getPoint(e);

            if (resizeBlock && resizeStart) {
                if (e.cancelable) e.preventDefault();
                const dCols = Math.round((point.clientX - resizeStart.x) / resizeStart.colWidth);
                const dRows = Math.round((point.clientY - resizeStart.y) / resizeStart.rowHeight);
                setBlockSize(resizeBlock, resizeStart.cols + dCols, resizeStart.rows + dRows);
                return;
            }

            if (dragBlock) {
                if (e.cancelable) e.preventDefault();
                // 드롭 타겟 찾기
                const el = document.elementFromPoint(point.clientX, point.clientY);
                const target = el && el.closest("#workDragContainer > .drag-item:not(.is-block-dragging)");
                container.querySelectorAll(".is-block-drop-target").forEach(b => b.classList.remove("is-block-drop-target"));
                if (target) {
                    target.classList.add("is-block-drop-target");
                    const rect = target.getBoundingClientRect();
                    const before = point.clientY < rect.top + rect.height / 2;
                    container.insertBefore(dragBlock, before ? target : target.nextSibling);
                }
                return;
            }

            // 이동 거리가 크면 탭 취소
            if (pressOrigin && dragTimer) {
                const d = Math.hypot(point.clientX - pressOrigin.x, point.clientY - pressOrigin.y);
                if (d > 8) { clearTimeout(dragTimer); dragTimer = null; }
            }
        };

        const onEnd = () => {
            clearTimeout(dragTimer);
            dragTimer = null;
            container.querySelectorAll(".is-block-drop-target").forEach(b => b.classList.remove("is-block-drop-target"));
            if (dragBlock) dragBlock.classList.remove("is-block-dragging");
            if (dragBlock || resizeBlock) window.saveWorkLayout();
            dragBlock = null;
            resizeBlock = null;
            resizeStart = null;
            pressOrigin = null;
            activeHandle = null;
        };

        // 이벤트 바인딩
        const modal = document.getElementById("workModal");
        if (modal) {
            modal.addEventListener("touchstart", onStart, { passive: false });
            modal.addEventListener("touchmove", onMove, { passive: false });
            modal.addEventListener("touchend", onEnd);
            modal.addEventListener("touchcancel", onEnd);
            modal.addEventListener("mousedown", onStart);
        }
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onEnd);

        window.hasInitDragListeners = true;
    };

    // ═══════════════════════════════════════════
    // 내부 위젯 레이아웃 (기존 inner-layout 유지)
    // ═══════════════════════════════════════════
    const clampWidgetSpan = (v, max) => Math.max(1, Math.min(max, Number(v) || 1));
    const setWidgetSize = (cell, colSpan, rowSpan) => {
        const cols = clampWidgetSpan(colSpan, 6);
        const rows = clampWidgetSpan(rowSpan, 6);
        cell.dataset.widgetCols = String(cols);
        cell.dataset.widgetRows = String(rows);
        cell.style.setProperty("--widget-cols", cols);
        cell.style.setProperty("--widget-rows", rows);
        cell.style.minHeight = `calc((${rows} * 32px) + ((${rows} - 1) * 2px))`;
    };

    const getInnerLayoutSpecs = () => {
        const date = document.getElementById("workDateInput");
        const address = document.getElementById("workAddress");
        const photoGrid = document.getElementById("workPhotoGrid");
        return [
            { key: "1-top", items: [
                ["date", date && date.parentElement, 2, 1],
                ["time", document.getElementById("workTime"), 1, 1],
                ["duty", document.getElementById("workDutyBtn"), 1, 1],
                ["ot", document.getElementById("workOT"), 1, 1],
                ["undo", document.getElementById("workUndoBtn"), 1, 1]
            ]},
            { key: "1-info", items: [
                ["taskNo", document.getElementById("taskNo"), 2, 1],
                ["copy", document.getElementById("workCopyBtn"), 1, 1],
                ["customer", document.getElementById("customerName"), 3, 1]
            ]},
            { key: "1-address", items: [
                ["address", address, 5, 1],
                ["map", address && address.parentElement.querySelector("button"), 1, 1]
            ]},
            { key: "2-text", items: [
                ["content", document.getElementById("workContent"), 6, 3],
                ["note", document.getElementById("workNote"), 6, 1]
            ]},
            { key: "7-photo", items: [
                ["photoGrid", photoGrid, 4, 2],
                ["photoAlbum", document.querySelector('button[onclick*="workPhotoInput"]'), 2, 1],
                ["photoCamera", document.querySelector('button[onclick*="workCamInput"]'), 2, 1]
            ]}
        ];
    };

    window.ensureInnerLayoutObjects = () => {
        getInnerLayoutSpecs().forEach((spec) => {
            const validItems = spec.items.filter((item) => item[1]);
            if (!validItems.length) return;
            const firstEl = validItems[0][1];
            let group = firstEl.closest(".inner-layout-group");
            if (!group) group = firstEl.parentElement;
            group.classList.add("inner-layout-group");
            group.dataset.innerGroup = spec.key;
            group.style.display = "grid";
            group.style.gridTemplateColumns = "repeat(6, minmax(0, 1fr))";
            validItems.forEach(([id, element, colSpan, rowSpan]) => {
                if (!element) return;
                let cell = element.closest(".inner-layout-cell");
                if (!cell || cell.parentElement !== group) {
                    cell = document.createElement("div");
                    cell.className = "inner-layout-cell";
                    if (element.parentElement === group) group.insertBefore(cell, element);
                    else group.appendChild(cell);
                    cell.appendChild(element);
                }
                cell.dataset.innerId = id;
                if (!cell.dataset.widgetCols) setWidgetSize(cell, colSpan, rowSpan);
                if (!cell.querySelector(":scope > .widget-resize-handle")) {
                    const handle = document.createElement("div");
                    handle.className = "widget-resize-handle";
                    handle.title = "끌어서 크기 조절";
                    cell.appendChild(handle);
                }
            });
        });
    };

    // ─── 내부 위젯 드래그/리사이즈 ───
    window.hasInitInnerReorderListeners = false;
    window.initInnerReorderListeners = () => {
        if (window.hasInitInnerReorderListeners) return;
        const modal = document.getElementById("workModal");
        if (!modal) return;

        let selectedCell = null;
        let dragCell = null;
        let dragGroup = null;
        let resizeCell = null;
        let resizeStart = null;
        let pendingResizeCell = null;
        let pendingResizeStart = null;
        let pendingSelectCell = null;
        let pressOrigin = null;
        let timer = null;
        let resizeModeTimer = null;
        let resizeHandleLongPressed = false;

        const selectCell = (cell) => {
            if (selectedCell && selectedCell !== cell) selectedCell.classList.remove("is-widget-selected");
            selectedCell = cell || null;
            if (selectedCell) selectedCell.classList.add("is-widget-selected");
        };

        const start = (event) => {
            if (!window.isWorkLayoutMode) return;
            clearTimeout(timer); clearTimeout(resizeModeTimer);
            resizeHandleLongPressed = false;
            pendingResizeCell = null; pendingResizeStart = null;

            const resizeHandle = event.target.closest(".widget-resize-handle");
            if (resizeHandle && modal.contains(resizeHandle)) {
                pendingSelectCell = null;
                pendingResizeCell = resizeHandle.closest(".inner-layout-cell");
                selectCell(pendingResizeCell);
                const point = event.touches ? event.touches[0] : event;
                const groupRect = pendingResizeCell.parentElement.getBoundingClientRect();
                pendingResizeStart = {
                    x: point.clientX, y: point.clientY,
                    cols: Number(pendingResizeCell.dataset.widgetCols) || 1,
                    rows: Number(pendingResizeCell.dataset.widgetRows) || 1,
                    colWidth: Math.max(1, groupRect.width / 6),
                    rowHeight: 32
                };
                resizeModeTimer = setTimeout(() => {
                    resizeHandleLongPressed = true;
                    dragCell = pendingResizeCell;
                    dragGroup = pendingResizeCell && pendingResizeCell.parentElement;
                    if (dragCell) { selectCell(dragCell); dragCell.classList.add("is-widget-dragging"); }
                    pendingResizeCell = null; pendingResizeStart = null;
                    if (navigator.vibrate) navigator.vibrate(50);
                }, 1500);
                if (event.cancelable) event.preventDefault();
                return;
            }

            const cell = event.target.closest(".inner-layout-cell");
            if (!cell || !modal.contains(cell)) return;
            pendingSelectCell = cell;
            if (event.cancelable) event.preventDefault();
            const point = event.touches ? event.touches[0] : event;
            pressOrigin = { x: point.clientX, y: point.clientY };
            timer = setTimeout(() => {
                dragCell = cell; dragGroup = cell.parentElement;
                selectCell(cell); dragCell.classList.add("is-widget-dragging");
                if (navigator.vibrate) navigator.vibrate(25);
            }, 700);
        };

        const move = (event) => {
            const point = event.touches ? event.touches[0] : event;
            if (pendingResizeCell && pendingResizeStart) {
                if (event.cancelable) event.preventDefault();
                const distance = Math.hypot(point.clientX - pendingResizeStart.x, point.clientY - pendingResizeStart.y);
                if (resizeHandleLongPressed) { pendingResizeCell = null; pendingResizeStart = null; }
                else if (distance > 10) {
                    clearTimeout(resizeModeTimer);
                    resizeCell = pendingResizeCell; resizeStart = pendingResizeStart;
                    pendingResizeCell = null; pendingResizeStart = null;
                } else return;
            }
            if (resizeCell && resizeStart) {
                if (event.cancelable) event.preventDefault();
                const cols = resizeStart.cols + Math.round((point.clientX - resizeStart.x) / resizeStart.colWidth);
                const rows = resizeStart.rows + Math.round((point.clientY - resizeStart.y) / resizeStart.rowHeight);
                setWidgetSize(resizeCell, cols, rows);
                return;
            }
            if (!dragCell || !dragGroup) {
                if (pressOrigin && Math.hypot(point.clientX - pressOrigin.x, point.clientY - pressOrigin.y) > 12) clearTimeout(timer);
                return;
            }
            if (event.cancelable) event.preventDefault();
            const over = document.elementFromPoint(point.clientX, point.clientY);
            const target = over && over.closest(".inner-layout-cell");
            modal.querySelectorAll(".is-widget-drop-target").forEach(i => i.classList.remove("is-widget-drop-target"));
            if (!target || target === dragCell || target.parentElement !== dragGroup) return;
            const rect = target.getBoundingClientRect();
            target.classList.add("is-widget-drop-target");
            const before = point.clientY < rect.top + rect.height / 2 ||
                (Math.abs(point.clientY - (rect.top + rect.height / 2)) < rect.height / 3 && point.clientX < rect.left + rect.width / 2);
            dragGroup.insertBefore(dragCell, before ? target : target.nextSibling);
        };

        const end = () => {
            clearTimeout(timer); clearTimeout(resizeModeTimer);
            modal.querySelectorAll(".is-widget-drop-target").forEach(i => i.classList.remove("is-widget-drop-target"));
            const moved = !!dragCell; const resized = !!resizeCell || resizeHandleLongPressed;
            if (dragCell) dragCell.classList.remove("is-widget-dragging");
            if (dragCell || resizeCell) window.saveWorkLayout();
            if (pendingSelectCell && !moved && !resized) selectCell(pendingSelectCell);
            dragCell = null; dragGroup = null;
            resizeCell = null; resizeStart = null;
            pendingResizeCell = null; pendingResizeStart = null;
            resizeHandleLongPressed = false; pendingSelectCell = null; pressOrigin = null;
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

    // ─── 태그 버튼 클릭 (레이아웃 모드에서 편집) ───
    window.hasInitTagReorderListeners = false;
    window.initTagReorderListeners = () => {
        if (window.hasInitTagReorderListeners) return;
        const modal = document.getElementById("workModal");
        if (!modal) return;
        modal.addEventListener("click", (event) => {
            if (!window.isWorkLayoutMode) return;
            const button = event.target.closest(".layout-tag-button");
            if (!button || !modal.contains(button)) return;
            event.preventDefault(); event.stopPropagation();
            const type = button.dataset.tagType;
            const index = getTagArray(type).findIndex(tag => tag.name === button.dataset.tagName);
            if (index > -1) window.openTagEditBox(type, index);
        }, true);
        window.hasInitTagReorderListeners = true;
    };

    // ─── startPress / endPress / cancelPress 오버라이드 ───
    const originalStartPress = window.startPress;
    const originalEndPress = window.endPress;
    const originalCancelPress = window.cancelPress;
    window.startPress = (...args) => {
        if (window.isWorkEditLocked || window.isWorkLayoutMode) return;
        return originalStartPress && originalStartPress(...args);
    };
    window.endPress = (...args) => {
        if (window.isWorkEditLocked || window.isWorkLayoutMode) return;
        return originalEndPress && originalEndPress(...args);
    };
    window.cancelPress = (...args) => {
        if (window.isWorkLayoutMode) return;
        return originalCancelPress && originalCancelPress(...args);
    };

    // ─── 이벤트 방어 ───
    const isTextEditingTarget = (target) => !!target && (
        target.matches("input, textarea, [contenteditable='true']") ||
        !!target.closest("input, textarea, [contenteditable='true']")
    );
    document.addEventListener("contextmenu", (e) => { if (!isTextEditingTarget(e.target)) e.preventDefault(); });
    document.addEventListener("selectstart", (e) => { if (!isTextEditingTarget(e.target)) e.preventDefault(); });
    document.addEventListener("dragstart", (e) => { if (!isTextEditingTarget(e.target)) e.preventDefault(); });

    // ─── 대시보드 통계 (includeMonthly 필터) ───
    const countAllowed = (type, name) => includesMonthly(getTag(type, name));
    const oldUpdateDashboardStats = window.updateDashboardStats;
    window.updateDashboardStats = () => {
        const originalLogs = window.logs;
        window.logs = (window.logs || []).map((log) => {
            if (!log || log.cat !== "work") return log;
            const copy = { ...log };
            if (copy.taskType) copy.taskType = String(copy.taskType).split(", ").filter(n => countAllowed("task", n)).join(", ");
            if (copy.coworkers) copy.coworkers = copy.coworkers.filter(n => countAllowed("coworker", n));
            if (copy.status && !countAllowed("status", copy.status)) copy.status = null;
            return copy;
        });
        oldUpdateDashboardStats && oldUpdateDashboardStats();
        window.logs = originalLogs;
    };

    const oldRenderMain = window.renderMain;
    window.renderMain = () => {
        const originalLogs = window.logs;
        window.logs = (window.logs || []).filter(log => log && (log.y || 2026) === window.currentYear).map(log => {
            if (!log.status || countAllowed("status", log.status)) return log;
            return { ...log, status: null };
        });
        oldRenderMain && oldRenderMain();
        window.logs = originalLogs;
    };

    // ─── 검색 필터 ───
    const optionLabel = (type, tag, logs) => {
        if (!showsNumber(tag)) return tag.name;
        if (!includesMonthly(tag)) return `[0] ${tag.name}`;
        let count = 0;
        logs.forEach(log => {
            if (type === "task" && log.taskType && String(log.taskType).split(", ").includes(tag.name)) count++;
            if (type === "coworker" && log.coworkers && log.coworkers.includes(tag.name)) count++;
            if (type === "equip" && log.equips) count += Number(log.equips[tag.name] || 0);
            if (type === "status" && log.status === tag.name) count++;
            if (type === "memoTag" && log.tags && log.tags.includes(tag.name)) count++;
        });
        return `[${count}] ${tag.name}`;
    };

    window.updateSearchFilters = (targetMonth = null) => {
        const logs = targetMonth ? (window.logs || []).filter(l => l.m === targetMonth) : (window.logs || []);
        const fill = (id, title, type, tags) => {
            const select = document.getElementById(id);
            if (!select) return;
            const selected = select.value;
            select.innerHTML = `<option value="">[ ${title} ]</option>` +
                (tags || []).map(tag => `<option value="${esc(tag.name)}" ${tag.name === selected ? "selected" : ""}>${esc(optionLabel(type, tag, logs))}</option>`).join("");
        };
        fill("searchType", "작업유형", "task", window.taskTypes);
        fill("searchManager", "매니저", "coworker", window.coworkers);
        fill("searchEquip", "장비", "equip", window.equipments);
        fill("searchStatus", "상태", "status", window.statuses);
        fill("searchMemoTag", "태그", "memoTag", window.memoTags);
    };

    // ─── 초기화 ───
    bindDraftFieldUndo();
    window.initTagReorderListeners();
    window.initInnerReorderListeners();
})();