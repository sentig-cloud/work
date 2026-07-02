// work_enhancements.js (v3 - 개별 객체 선택 + w95 스타일 패널)
(function () {
    "use strict";

    // ═══════════════════════════════════════════
    // 유틸
    // ═══════════════════════════════════════════
    const esc = (v) => String(v ?? "")
        .replace(/&/g, "&amp;").replace(/</g, "&lt;")
        .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

    // 커스텀 그룹(예: "그룹+"로 만든 선택 태그 상자)까지 포함해 groupId를 올바르게 해석하는
    // work_tag_manager.js의 window.getTagArray로 위임한다. 예전엔 여기서 5개 고정 타입만 다뤄서
    // 커스텀 그룹 id가 들어오면 무조건 "status"로 취급해 엉뚱한 그룹에 태그가 추가/삭제되던 버그가 있었음.
    const getTagArray = (type) => (window.getTagArray ? window.getTagArray(type) : []);

    const getTag = (type, name) => getTagArray(type).find((t) => t.name === name);
    const showsNumber = (tag) => !tag || tag.showNumber !== false;
    const includesMonthly = (tag) => !tag || tag.includeMonthly !== false;
    const getSortCount = (tag) => Number(tag && tag.count) || 0;

    const replaceInList = (list, old, neu) =>
        Array.isArray(list) ? list.map((n) => n === old ? neu : n) : list;

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
        const qty = type === "equip" ? Number(window.activeEquips && window.activeEquips[tag.name] || 0) : 0;
        return `${monthly}${tag.name}${qty > 0 ? ` (${qty})` : ""}`;
    };

    const tagButton = (type, tag, index, active) => `
        <button type="button" class="w95-btn layout-tag-button ${active ? "active-btn" : ""}"
            data-tag-type="${type}" data-tag-name="${esc(tag.name)}"
            onmousedown="window.startPress(event,'${type}',${index})"
            onmouseup="window.endPress(event,'${type}',${index})"
            onmouseleave="window.cancelPress()"
            ontouchstart="window.startPress(event,'${type}',${index})"
            ontouchend="window.endPress(event,'${type}',${index})"
            ontouchcancel="window.cancelPress()">${esc(getTagLabel(type, tag))}</button>`;

    // ═══════════════════════════════════════════
    // 태그 렌더링
    // ═══════════════════════════════════════════
    window.renderTaskTypes = () => {
        (window.taskTypes = window.taskTypes || []).sort((a, b) => getSortCount(b) - getSortCount(a));
        const el = document.getElementById("taskTypeArea"); if (!el) return;
        el.innerHTML = window.taskTypes.map((t, i) =>
            tagButton("task", t, i, (window.activeTaskTypes || []).includes(t.name))
        ).join("") + `<button type="button" class="w95-btn" onclick="window.addNewType('task')"><b>+</b></button>`;
    };

    window.renderCoworkers = () => {
        (window.coworkers = window.coworkers || []).sort((a, b) => getSortCount(b) - getSortCount(a));
        const el = document.getElementById("coworkerArea"); if (!el) return;
        el.innerHTML = window.coworkers.map((c, i) =>
            tagButton("coworker", c, i, (window.selectedCoworkers || []).includes(c.name))
        ).join("") + `<button type="button" class="w95-btn" onclick="window.addNewType('coworker')"><b>+</b></button>`;
    };

    window.renderStatuses = () => {
        (window.statuses = window.statuses || []).sort((a, b) => getSortCount(b) - getSortCount(a));
        const el = document.getElementById("statusArea"); if (!el) return;
        el.innerHTML = window.statuses.map((s, i) =>
            tagButton("status", s, i, window.activeStatus === s.name)
        ).join("") + `<button type="button" class="w95-btn" onclick="window.addNewType('status')"><b>+</b></button>`;
    };

    window.renderEquips = () => {
        const el = document.getElementById("equipArea"); if (!el) return;
        el.innerHTML = (window.equipments || []).map((eq, i) => {
            const cnt = window.activeEquips && window.activeEquips[eq.name] || 0;
            return `<button type="button" class="w95-btn layout-tag-button ${cnt > 0 ? "active-btn" : ""}"
                data-tag-type="equip" data-tag-name="${esc(eq.name)}"
                onmousedown="window.startPress(event,'equip',${i})"
                onmouseup="window.endPress(event,'equip',${i})"
                onmouseleave="window.cancelPress()"
                ontouchstart="window.startPress(event,'equip',${i})"
                ontouchend="window.endPress(event,'equip',${i})"
                ontouchcancel="window.cancelPress()">${esc(cnt > 0 ? `${eq.name} (${cnt})` : eq.name)}</button>`;
        }).join("") + `<button type="button" class="w95-btn" onclick="window.addNewType('equip')"><b>+</b></button>`;
    };

    window.renderMemoTags = () => {
        (window.memoTags = window.memoTags || []).sort((a, b) => getSortCount(b) - getSortCount(a));
        const el = document.getElementById("editTagArea"); if (!el) return;
        el.innerHTML = window.memoTags.map((t, i) => {
            const active = (window.activeEditTags || []).includes(t.name);
            return `<button type="button" class="w95-btn layout-tag-button ${active ? "active-btn" : ""}"
                style="height:30px;white-space:nowrap;"
                onclick="window.toggleTagSelection('memoTag','${esc(t.name)}')"
                oncontextmenu="event.preventDefault();window.openTagEditBox('memoTag',${i});"
                data-tag-type="memoTag" data-tag-name="${esc(t.name)}">${esc(t.name)}</button>`;
        }).join("") + (window.memoTags.length < 5
            ? `<button type="button" class="w95-btn" style="height:30px;width:36px;" onclick="window.addNewType('memoTag')"><b>+</b></button>`
            : "");
    };

    // ═══════════════════════════════════════════
    // Undo 스택
    // ═══════════════════════════════════════════
    window.workUndoStack = [];

    window.updateWorkUndoButton = () => {
        const btn = document.getElementById("workUndoBtn");
        if (btn) btn.disabled = !window.workUndoStack.length;
    };

    // undoWorkDraft가 기대하는 스냅샷 모양({fields, isWorkDuty, ...})은 아래 snapshotWorkDraftFull()이 정의함.
    // 이전에는 여기서 별도의 간단한 snap()을 만들어 다른 모양({taskNo, address, ...} 평면 객체)으로
    // 스택에 바로 push했는데, undoWorkDraft()는 항상 snapshot.fields를 읽으므로 이 모양의 항목을
    // pop하면 fields가 undefined라 TypeError로 조용히 실패했다 — 이게 "되돌리기가 전혀 안 먹는다"의 원인.
    // 텍스트 입력 변경 감지도 동일한 snapshotWorkDraftFull()을 쓰도록 통일해서 스택 모양을 일치시킴.
    const bindDraftFieldUndo = () => {
        const modal = document.getElementById("workModal"); if (!modal) return;
        let before = null;
        modal.addEventListener("focusin", () => {
            if (/^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName)) before = snapshotWorkDraftFull();
        });
        modal.addEventListener("change", () => {
            if (!before) return;
            const cur = snapshotWorkDraftFull();
            if (JSON.stringify(before) !== JSON.stringify(cur)) {
                window.workUndoStack.push(before);
                if (window.workUndoStack.length > 30) window.workUndoStack.shift();
                window.updateWorkUndoButton();
            }
            before = null;
        });
    };

    // ═══════════════════════════════════════════
    // 레이아웃 엔진 v3
    // 개별 객체(버튼/input/섹션) 단위 선택·이동·리사이즈
    // ═══════════════════════════════════════════
    const LAYOUT_KEY = "wm_work_layout_v3";
    const GRID_COLS = 4;

    window.isWorkLayoutMode = false;
    window.workLayoutLongPressed = false;
    window.workLayoutPressTimer = null;

    // 현재 선택된 블록 정보: { el, type: 'section'|'group' }
    let selectedBlock = null;

    const getContainer = () => document.getElementById("workDragContainer");
    const getAllSections = (c) => [...(c || getContainer())?.querySelectorAll(":scope > .drag-item") || []];

    // ═══════════════════════════════════════════
    // 선택 오버레이: 클릭하면 이동/리사이즈 핸들 표시
    // (CSS의 .block-overlay/.block-move-handle/.block-resize-handle는
    //  이미 준비돼 있었으나 v3에서 사용되지 않고 있었음 — 여기서 연결)
    // ═══════════════════════════════════════════
    const BLOCK_SELECTED_CLASS = "is-block-selected";

    // 선택 표시는 오직 주황 사각 테두리(.is-block-selected, CSS)뿐 —
    // 이동은 순서 모드에서 선택된 영역을 직접 드래그해서 한다(별도 손잡이 버튼 없음).
    const selectBlock = (el, type) => {
        if (selectedBlock && selectedBlock.el !== el) {
            selectedBlock.el.classList.remove(BLOCK_SELECTED_CLASS);
        }
        selectedBlock = { el, type };
        el.classList.add(BLOCK_SELECTED_CLASS);
    };

    const deselectBlock = () => {
        if (selectedBlock) selectedBlock.el.classList.remove(BLOCK_SELECTED_CLASS);
        selectedBlock = null;
    };

    // ─── 드래그 대상 범위: 모든 블록은 최상위 컨테이너에 나란히 있다 ───
    const getDragScope = () => getContainer();

    // ═══════════════════════════════════════════
    // 이동 핸들 드래그 (⠿) — 눌러서 그대로 끌면 이동
    // ═══════════════════════════════════════════
    let blockDragEl = null, blockDragParent = null;

    // 순서 모드에서 이미 선택된(주황 사각) 블록의 몸체를 바로 누르면 그대로 끌어서 이동 —
    // 별도 손잡이 아이콘 없이 "누르고 있는 대상을 다른 대상 쪽으로 밀어넣는" 자연스러운 방식.
    const startBlockMove = (e) => {
        if (!window.isWorkLayoutMode || !window.isOrderMode) return;
        const el = e.target.closest(".drag-item.is-block-selected");
        if (!el || !selectedBlock || selectedBlock.el !== el) return;
        e.preventDefault();
        e.stopPropagation();
        blockDragEl = el;
        blockDragParent = getDragScope(el);
        el.classList.add("is-block-dragging");
        if (navigator.vibrate) navigator.vibrate(25);
    };

    const moveBlockMove = (e) => {
        if (!blockDragEl || !blockDragParent) return;
        e.preventDefault();
        const point = e.touches ? e.touches[0] : e;
        const over = document.elementFromPoint(point.clientX, point.clientY);
        const target = over && over.closest(".drag-item");
        document.querySelectorAll(".is-block-drop-target").forEach(i => i.classList.remove("is-block-drop-target"));
        if (!target || target === blockDragEl || target.parentElement !== blockDragParent) return;
        const rect = target.getBoundingClientRect();
        target.classList.add("is-block-drop-target");
        // 위/아래로 쌓인 블록이므로 세로 위치 기준으로 앞/뒤를 정한다
        const before = point.clientY < rect.top + rect.height / 2;
        blockDragParent.insertBefore(blockDragEl, before ? target : target.nextSibling);
    };

    // 블록(그룹) 이동 종료 후, groups[] 배열 순서도 화면 순서에 맞춰 동기화 —
    // 내보내기(엑셀/CSV)의 커스텀 그룹 컬럼 순서가 이 배열 순서를 그대로 따라간다.
    window.syncGroupOrderFromLayout = () => {
        const container = getContainer();
        if (!container || !window.groups) return;
        const domGroupIds = [...container.querySelectorAll(":scope > .drag-item[data-group-ref]")]
            .map(el => el.dataset.groupRef);
        if (!domGroupIds.length) return;
        const domIndex = new Map(domGroupIds.map((id, i) => [id, i]));
        window.groups.sort((a, b) => {
            const ai = domIndex.has(a.id) ? domIndex.get(a.id) : Infinity;
            const bi = domIndex.has(b.id) ? domIndex.get(b.id) : Infinity;
            return ai - bi;
        });
        window.groups.forEach((g, i) => { if (domIndex.has(g.id)) g.order = domIndex.get(g.id); });
        window.markDirty?.("master", "groups", "upsert");
    };

    const endBlockMove = () => {
        document.querySelectorAll(".is-block-drop-target").forEach(i => i.classList.remove("is-block-drop-target"));
        if (blockDragEl) {
            blockDragEl.classList.remove("is-block-dragging");
            window.syncGroupOrderFromLayout();
            window.saveWorkLayout();
            if (window.saveLocal) window.saveLocal("group-reorder");
        }
        blockDragEl = null; blockDragParent = null;
    };

    // ═══════════════════════════════════════════
    // 그룹(블록) 크기는 자동 — 리사이즈 핸들 없음(위 이동 핸들만 존재)
    // ═══════════════════════════════════════════
    // 탭 → 선택(핸들 표시) / 배경·✕ 탭 → 선택 해제
    // ═══════════════════════════════════════════
    let blockJustDragged = false;

    const onBlockTap = (e) => {
        if (!window.isWorkLayoutMode) return;
        if (blockJustDragged) { blockJustDragged = false; return; }

        // 날짜/시간/주소/작업내용 등 개별 필드는 별도의 inner-layout 드래그 시스템이 전담
        // (그룹 배경을 탭해도 상위 섹션 전체가 선택되지 않도록 그룹 범위 전체를 제외) —
        // 단, "순서" 모드일 때는 객체 선택을 막고 그룹(블록) 전체 선택만 허용해야 하므로 이 예외를 건너뛴다.
        if (!window.isOrderMode && (e.target.closest(".inner-layout-cell") || e.target.closest(".inner-layout-group"))) return;

        const modal = document.getElementById("workModal");
        if (!modal || !modal.contains(e.target)) return;

        // 이름 수정을 위한 롱탭은 box-title 자신의 핸들러가 처리 — 여기서는 선택만 담당
        const sec = e.target.closest("#workDragContainer > .drag-item");
        if (sec) {
            e.preventDefault();
            e.stopPropagation();
            selectBlock(sec, "section");
            return;
        }

        // 빈 배경 탭 → 선택 해제
        deselectBlock();
    };

    // ─── 그룹 삭제 (그룹- = 해당 커스텀 태그 상자 그룹을 완전히 삭제) ───
    // 작업유형/매니저 등 기본 그룹도 화면 순서 동기화를 위해 data-group-ref를 갖고 있지만,
    // 기본 그룹은 삭제 대상이 아니므로 removeGroup()이 실제로 지웠을 때만 화면에서도 제거한다.
    const deleteGroupBlock = (groupEl) => {
        const groupId = groupEl.dataset.groupRef || groupEl.dataset.id;
        const g = groupId && window.getGroupById ? window.getGroupById(groupId) : null;
        const label = g ? g.title : "이 그룹";
        if (!confirm(`"${label}" 그룹을 삭제하시겠습니까?\n그룹 안의 선택 항목도 함께 삭제됩니다.`)) return;

        const removed = groupId && window.removeGroup ? window.removeGroup(groupId) : false;
        if (!removed) {
            alert("기본 제공 그룹은 삭제할 수 없습니다.");
            return;
        }
        window.markDirty?.("master", "groups", "upsert");

        groupEl.remove();
        deselectBlock();
        window.saveWorkLayout();
        if (window.saveLocal) window.saveLocal("group-delete");
    };

    // ═══════════════════════════════════════════
    // 레이아웃 저장/복원
    // ═══════════════════════════════════════════
    const setBlockSize = (block, cols, rows) => {
        const c = Math.max(1, Math.min(GRID_COLS, Number(cols) || GRID_COLS));
        const r = Math.max(1, Math.min(20, Number(rows) || 1));
        block.dataset.cols = String(c);
        block.dataset.rows = String(r);
        block.style.setProperty("--item-cols", c);
        block.style.setProperty("--item-rows", r);
    };

    const clampWidgetSpan = (v, max) => Math.max(1, Math.min(max, Number(v) || 1));
    const setWidgetSize = (cell, colSpan, rowSpan) => {
        const c = clampWidgetSpan(colSpan, 6);
        const r = clampWidgetSpan(rowSpan, 6);
        cell.dataset.widgetCols = String(c);
        cell.dataset.widgetRows = String(r);
        cell.style.setProperty("--widget-cols", c);
        cell.style.setProperty("--widget-rows", r);
        // .inner-layout-group의 gap이 0이라 줄 사이 여백이 없는데, 예전엔 줄마다 +2px씩
        // 더 얹어서 실제 grid 트랙(32px*줄수)보다 커져 작업내용/특이사항 같은 여러 줄 칸이
        // 칸 경계를 넘치던 버그가 있었음 — 실제 트랙 크기와 정확히 맞춘다.
        cell.style.minHeight = `calc(${r} * 32px)`;
    };
    // 좌표는 더 이상 직접 계산하지 않는다 — grid-auto-flow: dense(CSS)가
    // DOM 순서 + 각 칸의 span(크기)만으로 빈틈없이 자동 배치해준다(아이폰 홈화면 방식).

    window.saveWorkLayout = () => {
        const container = getContainer(); if (!container) return;
        const order = [], blocks = {};
        getAllSections(container).forEach(block => {
            order.push(block.dataset.id);
            // obj-wrap 순서도 저장
            const objOrder = [...block.querySelectorAll(":scope > .work-obj-wrap")].map(w => w.dataset.objId);
            const objSizes = {};
            block.querySelectorAll(":scope > .work-obj-wrap").forEach(w => {
                if (w.dataset.objCols || w.dataset.objRows) {
                    objSizes[w.dataset.objId] = {
                        cols: Number(w.dataset.objCols || 1),
                        rows: Number(w.dataset.objRows || 1)
                    };
                }
            });
            blocks[block.dataset.id] = {
                cols: Number(block.dataset.cols || GRID_COLS),
                rows: Number(block.dataset.rows || 1),
                isGroup: block.classList.contains("is-group-block"),
                groupEnabled: !block.classList.contains("is-group-disabled"),
                objOrder: objOrder.length ? objOrder : undefined,
                objSizes: Object.keys(objSizes).length ? objSizes : undefined
            };
        });
        const innerOrder = {}, widgets = {};
        document.querySelectorAll(".inner-layout-group").forEach(group => {
            const key = group.dataset.innerGroup;
            widgets[key] = {};
            innerOrder[key] = [...group.querySelectorAll(":scope > .inner-layout-cell")].map(cell => {
                widgets[key][cell.dataset.innerId] = {
                    colSpan: clampWidgetSpan(cell.dataset.widgetCols, 6),
                    rowSpan: clampWidgetSpan(cell.dataset.widgetRows, 6)
                };
                return cell.dataset.innerId;
            });
        });
        localStorage.setItem(LAYOUT_KEY, JSON.stringify({ version: 3, order, blocks, innerOrder, widgets }));
        localStorage.setItem("wm_work_drag_order", JSON.stringify(order));
    };

    window.readWorkLayout = () => {
        try { return JSON.parse(localStorage.getItem(LAYOUT_KEY) || "{}"); } catch { return {}; }
    };

    window.applyWorkLayout = () => {
        const container = getContainer(); if (!container) return;
        window.ensureInnerLayoutObjects();
        const layout = window.readWorkLayout();
        if (Array.isArray(layout.order)) {
            layout.order.forEach(id => {
                const block = container.querySelector(`.drag-item[data-id="${id}"]`);
                if (block) container.appendChild(block);
            });
        }
        getAllSections(container).forEach(block => {
            const saved = layout.blocks?.[block.dataset.id];
            setBlockSize(block, saved?.cols ?? GRID_COLS, saved?.rows ?? 1);
        });
        // obj-wrap 순서/크기 복원
        getAllSections(container).forEach(block => {
            const saved = layout.blocks?.[block.dataset.id];
            if (!saved) return;
            // 순서 복원
            if (Array.isArray(saved.objOrder)) {
                saved.objOrder.forEach(objId => {
                    const wrap = block.querySelector(`:scope > .work-obj-wrap[data-obj-id="${objId}"]`);
                    if (wrap) block.appendChild(wrap);
                });
            }
            // 크기 복원
            if (saved.objSizes) {
                Object.entries(saved.objSizes).forEach(([objId, size]) => {
                    const wrap = block.querySelector(`:scope > .work-obj-wrap[data-obj-id="${objId}"]`);
                    if (!wrap) return;
                    wrap.dataset.objCols = size.cols;
                    wrap.dataset.objRows = size.rows;
                    wrap.style.setProperty("--obj-cols", size.cols);
                    if (size.rows > 1) {
                        wrap.style.minHeight = `${size.rows * 30 + (size.rows-1)*2}px`;
                        const inner = wrap.querySelector("input, textarea");
                        if (inner) inner.style.height = `${size.rows * 30}px`;
                    }
                });
            }
        });

        // inner widget 크기/순서 복원
        document.querySelectorAll(".inner-layout-group").forEach(group => {
            const key = group.dataset.innerGroup;
            const order = layout.innerOrder?.[key];
            if (Array.isArray(order)) {
                order.forEach(id => {
                    const cell = group.querySelector(`:scope > .inner-layout-cell[data-inner-id="${id}"]`);
                    if (cell) group.appendChild(cell);
                });
            }
            const ws = layout.widgets?.[key];
            [...group.querySelectorAll(":scope > .inner-layout-cell")].forEach(cell => {
                const s = ws?.[cell.dataset.innerId];
                setWidgetSize(cell, s?.colSpan || cell.dataset.widgetCols, s?.rowSpan || cell.dataset.widgetRows);
            });
        });
    };

    // ─── inner-layout 객체 주입 ───
    // 날짜/시간/당직/OT/되돌리기, Task번호/복사/고객명, 주소/지도, 작업내용/특이사항은
    // 전부 하나의 입력 그룹(1-fields)으로 취급 — 간격 없이 붙어서 표시되고,
    // 각 객체는 개별적으로 롱탭 이동 / 드래그 리사이즈가 가능하다.
    window.ensureInnerLayoutObjects = () => {
        const specs = [
            // 칸 높이가 객체마다 제각각이던 것을 정리: 날짜/시간/당직 등 작은 필드·버튼들은
            // 전부 2줄(64px) 높이로 통일 — 특이사항(1줄, 32px)보다는 높고 작업내용(3줄, 96px)보다는 낮다.
            { key: "1-fields", items: [
                ["date", document.getElementById("workDateInput")?.parentElement, 2, 2],
                ["time", document.getElementById("workTime"), 1, 2],
                ["duty", document.getElementById("workDutyBtn"), 1, 2],
                ["ot", document.getElementById("workOT"), 2, 2],
                ["taskNo", document.getElementById("taskNo"), 2, 2],
                ["copy", document.getElementById("workCopyBtn"), 1, 2],
                ["customer", document.getElementById("customerName"), 3, 2],
                ["address", document.getElementById("workAddress"), 4, 2],
                // 이전 selector(주소 래퍼 안에서 button 검색)는 항상 null이었음(지도 버튼은 별도 래퍼).
                // 버튼 자신의 속성으로 직접 찾아야 이 함수가 여러 번 호출돼 버튼이 이미 칸 안으로
                // 옮겨진 뒤에도(부모가 바뀐 뒤에도) 계속 같은 버튼을 다시 찾을 수 있다.
                ["map", document.querySelector('button[onmousedown*="startMapPress"]'), 1, 2],
                ["undo", document.getElementById("workUndoBtn"), 1, 2],
                // 작업내용/특이사항: 날짜·Task 블록과 같은 그룹에 고정 — 항상 붙어서 표시
                ["content", document.getElementById("workContent"), 6, 3],
                ["note", document.getElementById("workNote"), 6, 1]
            ]},
            { key: "7-photo", items: [
                ["photoGrid", document.getElementById("workPhotoGrid"), 4, 2],
                ["photoAlbum", document.querySelector('button[onclick*="workPhotoInput"]'), 2, 1],
                ["photoCamera", document.querySelector('button[onclick*="workCamInput"]'), 2, 1]
            ]}
        ];

        specs.forEach(spec => {
            const validItems = spec.items.filter(item => item[1]);
            if (!validItems.length) return;
            const firstEl = validItems[0][1];
            let group = firstEl.closest(".inner-layout-group") || firstEl.parentElement;
            group.classList.add("inner-layout-group");
            group.dataset.innerGroup = spec.key;
            // 주의: cssText += 는 date 래퍼에 이미 있던 inline "display:flex"와 충돌해
            // grid가 적용되지 않는 버그가 있었음(각 칸이 flex로 동일폭 분할되어 겹쳐 보이던 원인).
            // 개별 속성으로 직접 지정해 항상 grid가 적용되도록 함.
            group.style.display = "grid";
            group.style.gridTemplateColumns = "repeat(6, minmax(0, 1fr))";
            // dense: 빈칸을 자동으로 메꿔서 항상 빈 공간 없이 채워짐(아이폰 홈화면 아이콘처럼)
            group.style.gridAutoFlow = "row dense";
            validItems.forEach(([id, el, cs, rs]) => {
                if (!el) return;
                let cell = el.closest(".inner-layout-cell");
                if (!cell || cell.parentElement !== group) {
                    cell = document.createElement("div");
                    cell.className = "inner-layout-cell";
                    if (el.parentElement === group) group.insertBefore(cell, el);
                    else group.appendChild(cell);
                    cell.appendChild(el);
                }
                cell.dataset.innerId = id;
                if (!cell.dataset.widgetCols) setWidgetSize(cell, cs, rs);
                // 손잡이 하나만 사용: 탭하면 선택되고, 그 위 점을 롱탭하면 이동, 바로 드래그하면 크기 조절
                if (!cell.querySelector(":scope > .widget-resize-handle")) {
                    const h = document.createElement("div");
                    h.className = "widget-resize-handle";
                    h.title = "드래그=크기 조절 / 길게 눌렀다 드래그=이동";
                    cell.appendChild(h);
                }
            });
        });

        // 내용이 다른 곳으로 옮겨지고 남은 빈 work-obj-wrap은 숨김
        // (그대로 두면 빈 칸이 그대로 자리를 차지해서 목록 사이에 빈 줄이 보임)
        // 주의: inner-layout-group으로 재사용된 wrap(예: 날짜 칸)은 grid 컨테이너이므로
        // 여기서 display를 건드리면 방금 지정한 "display:grid"가 지워져 버림 — 반드시 제외.
        getContainer()?.querySelectorAll(".work-obj-wrap").forEach(wrap => {
            if (wrap.classList.contains("inner-layout-group")) return;
            wrap.style.display = wrap.children.length === 0 ? "none" : "";
        });
    };

    // ═══════════════════════════════════════════
    // 레이아웃 모드 진입/해제
    // ═══════════════════════════════════════════
    window.setWorkLayoutMode = (enabled) => {
        window.isWorkLayoutMode = !!enabled;
        const modal = document.getElementById("workModal");
        const titlebar = document.getElementById("workModalTitlebar");

        if (window.isWorkLayoutMode) {
            if (document.activeElement?.blur) document.activeElement.blur();
            const container = getContainer();
            container?.querySelectorAll("input, textarea").forEach(el => {
                el.dataset.prevRo = el.readOnly ? "1" : "0";
                el.readOnly = true;
            });
        } else {
            const container = getContainer();
            container?.querySelectorAll("input, textarea").forEach(el => {
                el.readOnly = el.dataset.prevRo === "1";
                delete el.dataset.prevRo;
            });
            deselectBlock();
            window.saveWorkLayout();
            window.applyWorkLayout();
        }

        modal?.classList.toggle("layout-edit-mode", window.isWorkLayoutMode);
        titlebar?.classList.toggle("is-layout-edit", window.isWorkLayoutMode);
    };

    // 예전엔 2000ms + onpointerleave(버튼 사각형을 살짝만 벗어나도 취소)라서
    // 2초 내내 손가락을 완벽히 고정해야 했고, 미세한 떨림에도 자꾸 취소돼 "롱탭이 안 먹는다"는
    // 문제가 있었음. 시간을 1.2초로 줄이고, 취소 기준을 "버튼 밖으로 나가면"이 아니라
    // "처음 누른 지점에서 일정 거리 이상 움직이면"으로 바꿔 훨씬 관대하게 했다.
    window.workLayoutPressOrigin = null;
    window.startWorkLayoutPress = (event) => {
        if (event) event.preventDefault();
        clearTimeout(window.workLayoutPressTimer);
        window.workLayoutLongPressed = false;
        const point = event.touches ? event.touches[0] : event;
        window.workLayoutPressOrigin = point ? { x: point.clientX, y: point.clientY } : null;
        const btn = document.getElementById("workLayoutModeBtn");
        if (btn) btn.classList.add("is-layout-pressing");
        window.workLayoutPressTimer = setTimeout(() => {
            window.workLayoutLongPressed = true;
            window.setWorkLayoutMode(true);
            document.getElementById("workLayoutModeBtn")?.classList.remove("is-layout-pressing");
            if (navigator.vibrate) navigator.vibrate(40);
        }, 1200);
    };

    window.moveWorkLayoutPress = (event) => {
        if (!window.workLayoutPressOrigin) return;
        const point = event.touches ? event.touches[0] : event;
        if (!point) return;
        const dist = Math.hypot(point.clientX - window.workLayoutPressOrigin.x, point.clientY - window.workLayoutPressOrigin.y);
        if (dist > 24) window.cancelWorkLayoutPress();
    };

    window.endWorkLayoutPress = (event) => {
        if (event) event.preventDefault();
        clearTimeout(window.workLayoutPressTimer);
        window.workLayoutPressOrigin = null;
        document.getElementById("workLayoutModeBtn")?.classList.remove("is-layout-pressing");
        if (!window.workLayoutLongPressed && window.isWorkLayoutMode) window.setWorkLayoutMode(false);
        window.workLayoutLongPressed = false;
    };

    window.cancelWorkLayoutPress = () => {
        clearTimeout(window.workLayoutPressTimer);
        window.workLayoutPressOrigin = null;
        document.getElementById("workLayoutModeBtn")?.classList.remove("is-layout-pressing");
    };

    window.resetWorkLayout = () => {
        if (!window.isWorkLayoutMode) return;
        localStorage.removeItem(LAYOUT_KEY);
        localStorage.removeItem("wm_work_drag_order");
        const container = getContainer(); if (!container) return;
        [...getAllSections(container)]
            .sort((a, b) => Number(a.dataset.id) - Number(b.dataset.id))
            .forEach(block => { setBlockSize(block, GRID_COLS, 1); container.appendChild(block); });
        // 순서(드래그로 바뀐 DOM 순서)와 크기를 모두 원래대로 되돌리기 위해,
        // 각 칸의 내용물을 그룹 밖으로 꺼내고 빈 칸은 제거 — 다시 만들 때 spec 선언 순서로 재생성된다
        container.querySelectorAll(".inner-layout-cell").forEach(cell => {
            const group = cell.parentElement;
            while (cell.firstChild) {
                if (cell.firstChild.classList?.contains("widget-resize-handle")) { cell.firstChild.remove(); continue; }
                group.insertBefore(cell.firstChild, cell);
            }
            cell.remove();
        });
        window.ensureInnerLayoutObjects();
    };

    // ─── 그룹 추가 (타이틀바 버튼) ───
    window.groupSelectedBlocks = () => {
        if (!window.isWorkLayoutMode) return;
        const title = prompt("새 그룹 이름을 입력하세요.", "새 그룹");
        if (!title?.trim()) return;

        const container = getContainer(); if (!container) return;

        // v2 groups 등록 (id를 먼저 확정한 뒤 DOM에 반영)
        let g = null;
        if (window.addCustomGroup) {
            g = window.addCustomGroup(title.trim());
            window.markDirty?.("master", "groups", "upsert");
        }
        const groupId = g ? g.id : ("grp_" + Date.now());

        // 기존 작업유형/매니저 등 기본 그룹과 완전히 동일한 마크업(w95-in + box-title + btn-tag-area)을 사용해
        // 새로 만든 그룹도 디자인이 똑같고, 이름 수정(길게 눌러 변경)도 동일하게 동작한다.
        const groupEl = document.createElement("div");
        groupEl.className = "drag-item w95-in";
        groupEl.dataset.id = groupId;
        groupEl.dataset.groupRef = groupId;
        setBlockSize(groupEl, GRID_COLS, 1);

        groupEl.innerHTML = `
            <div id="boxTitle_${esc(groupId)}" class="box-title" title="길게 눌러 이름 변경"
                onmousedown="window.startTitlePress(event, '${esc(groupId)}')" onmouseup="window.endTitlePress()" onmouseleave="window.endTitlePress()"
                ontouchstart="window.startTitlePress(event, '${esc(groupId)}')" ontouchend="window.endTitlePress()" ontouchcancel="window.endTitlePress()"
                >${esc(title.trim())}</div>
            <div id="customGroupArea_${esc(groupId)}" class="btn-tag-area"></div>
            <div class="drag-handle"><i class="fa-solid fa-circle" style="font-size:5px;"></i></div>
        `;

        // 선택된 섹션이 있으면 그 위치에, 없으면 맨 아래
        const selSection = selectedBlock?.type === "section" ? selectedBlock.el : null;
        if (selSection && selSection.parentElement === container) {
            container.insertBefore(groupEl, selSection.nextSibling);
        } else {
            container.appendChild(groupEl);
        }

        // 선택 태그를 추가할 수 있는 초기 상태(+ 버튼만 있는 빈 상자)로 즉시 렌더링
        if (window.renderCustomGroup) window.renderCustomGroup(groupId);

        deselectBlock();
        window.saveWorkLayout();
    };

    window.ungroupSelectedBlock = () => {
        if (!window.isWorkLayoutMode) {
            alert("레이아웃 편집 모드에서 사용하세요.");
            return;
        }
        if (!selectedBlock || !selectedBlock.el.dataset.groupRef) {
            alert("삭제할 그룹(선택 태그 상자)을 탭해서 선택한 뒤 그룹- 을 누르세요.");
            return;
        }
        deleteGroupBlock(selectedBlock.el);
    };

    // ─── 순서 모드 토글 ───
    // 켜면: 객체(칸) 선택은 막히고 그룹(블록) 전체만 선택 가능 — 그 상태에서 이동(⠿)만 허용.
    // 꺼지면: 원래대로 객체 단위 선택/이동/리사이즈로 복귀.
    window.isOrderMode = false;
    window.toggleOrderMode = () => {
        if (!window.isWorkLayoutMode) {
            alert("레이아웃 편집 모드에서 사용하세요.");
            return;
        }
        window.isOrderMode = !window.isOrderMode;
        deselectBlock();
        document.getElementById("workLayoutOrderBtn")?.classList.toggle("active-btn", window.isOrderMode);
        document.getElementById("workModal")?.classList.toggle("order-mode", window.isOrderMode);
    };

    // ═══════════════════════════════════════════
    // 이벤트 리스너 초기화
    // ═══════════════════════════════════════════
    window.hasInitDragListeners = false;
    window.initWorkDragListeners = () => {
        if (window.hasInitDragListeners) return;
        const modal = document.getElementById("workModal");
        if (!modal) return;

        // 이동 핸들(⠿) 누르기 시작 — 그룹(블록) 크기는 자동이라 리사이즈 핸들 없음
        modal.addEventListener("touchstart", startBlockMove, { passive: false });
        modal.addEventListener("mousedown", startBlockMove);

        const onBlockPointerMove = (e) => {
            if (blockDragEl) { moveBlockMove(e); return; }
        };
        const onBlockPointerEnd = () => {
            if (blockDragEl) { blockJustDragged = true; endBlockMove(); }
        };

        modal.addEventListener("touchmove", onBlockPointerMove, { passive: false });
        window.addEventListener("mousemove", onBlockPointerMove);
        modal.addEventListener("touchend", onBlockPointerEnd);
        modal.addEventListener("touchcancel", onBlockPointerEnd);
        window.addEventListener("mouseup", onBlockPointerEnd);

        // 탭/클릭 → 선택(핸들 표시) / 배경 탭 → 선택 해제 (드래그 종료 판정 이후에 등록)
        modal.addEventListener("touchend", onBlockTap, { passive: false });
        modal.addEventListener("click", onBlockTap);

        window.hasInitDragListeners = true;
    };

    window.hasInitTagReorderListeners = false;
    window.initTagReorderListeners = () => {
        if (window.hasInitTagReorderListeners) return;
        // 레이아웃 모드 탭은 onBlockTap에서 통합 처리
        window.hasInitTagReorderListeners = true;
    };

    // initInnerReorderListeners: 완전판은 아래에서 정의

    // startPress/endPress/cancelPress 오버라이드
    const origStart = window.startPress;
    const origEnd = window.endPress;
    const origCancel = window.cancelPress;
    window.startPress = (...args) => {
        if (window.isWorkEditLocked || window.isWorkLayoutMode) return;
        return origStart?.(...args);
    };
    window.endPress = (...args) => {
        if (window.isWorkEditLocked || window.isWorkLayoutMode) return;
        return origEnd?.(...args);
    };
    window.cancelPress = (...args) => {
        if (window.isWorkLayoutMode) return;
        return origCancel?.(...args);
    };

    // 이벤트 방어
    const isText = (t) => !!t && (t.matches("input,textarea,[contenteditable='true']") || !!t.closest("input,textarea,[contenteditable='true']"));
    document.addEventListener("contextmenu", (e) => { if (!isText(e.target)) e.preventDefault(); });
    document.addEventListener("selectstart", (e) => { if (!isText(e.target)) e.preventDefault(); });
    document.addEventListener("dragstart", (e) => { if (!isText(e.target)) e.preventDefault(); });

    // ─── 대시보드 통계 ───
    const countAllowed = (type, name) => includesMonthly(getTag(type, name));
    const oldUpdateDash = window.updateDashboardStats;
    window.updateDashboardStats = () => {
        const orig = window.logs;
        window.logs = (orig || []).map(log => {
            if (!log || log.cat !== "work") return log;
            const copy = { ...log };
            if (copy.taskType) copy.taskType = String(copy.taskType).split(", ").filter(n => countAllowed("task", n)).join(", ");
            if (copy.coworkers) copy.coworkers = copy.coworkers.filter(n => countAllowed("coworker", n));
            if (copy.status && !countAllowed("status", copy.status)) copy.status = null;
            return copy;
        });
        oldUpdateDash?.();
        window.logs = orig;
    };

    const oldRenderMain = window.renderMain;
    window.renderMain = () => {
        const orig = window.logs;
        window.logs = (orig || []).filter(l => l && (l.y || 2026) === window.currentYear).map(l => {
            if (!l.status || countAllowed("status", l.status)) return l;
            return { ...l, status: null };
        });
        oldRenderMain?.();
        window.logs = orig;
    };

    // ─── 검색 필터 ───
    const optionLabel = (type, tag, logs) => {
        if (!showsNumber(tag)) return tag.name;
        if (!includesMonthly(tag)) return `[0] ${tag.name}`;
        let count = 0;
        logs.forEach(l => {
            if (type === "task" && l.taskType && String(l.taskType).split(", ").includes(tag.name)) count++;
            if (type === "coworker" && l.coworkers && l.coworkers.includes(tag.name)) count++;
            if (type === "equip" && l.equips) count += Number(l.equips[tag.name] || 0);
            if (type === "status" && l.status === tag.name) count++;
            if (type === "memoTag" && l.tags && l.tags.includes(tag.name)) count++;
        });
        return `[${count}] ${tag.name}`;
    };

    window.updateSearchFilters = (targetMonth = null) => {
        const logs = targetMonth ? (window.logs || []).filter(l => l.m === targetMonth) : (window.logs || []);
        const fill = (id, title, type, tags) => {
            const el = document.getElementById(id); if (!el) return;
            const sel = el.value;
            el.innerHTML = `<option value="">[ ${title} ]</option>` +
                (tags || []).map(t => `<option value="${esc(t.name)}" ${t.name === sel ? "selected" : ""}>${esc(optionLabel(type, t, logs))}</option>`).join("");
        };
        fill("searchType", "작업유형", "task", window.taskTypes);
        fill("searchManager", "매니저", "coworker", window.coworkers);
        fill("searchEquip", "장비", "equip", window.equipments);
        fill("searchStatus", "상태", "status", window.statuses);
        fill("searchMemoTag", "태그", "memoTag", window.memoTags);
    };

    // ─── CSS: 선택 표시 ───
    const styleEl = document.createElement("style");
    styleEl.textContent = `
        .is-obj-selected {
            outline: 2px solid #f59e0b !important;
            outline-offset: 1px;
            box-shadow: 0 0 0 3px rgba(245,158,11,0.25) !important;
            position: relative;
            z-index: 15;
        }
        .is-obj-selected.layout-tag-button {
            outline-offset: 0;
        }
    `;
    document.head.appendChild(styleEl);


    // ═══════════════════════════════════════════
    // 태그 편집 (원본 유지)
    // ═══════════════════════════════════════════
    window.handleLongPress = (type, index) => window.openTagEditBox(type, index);

    window.handleClick = (type, index) => {
        if (window.isWorkEditLocked) return;
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
            if (Number(window.activeEquips && window.activeEquips[tag.name] || 0) > 0) delete window.activeEquips[tag.name];
            else window.activeEquips[tag.name] = 1;
        } else if (type === "memoTag") {
            window.toggleTagSelection("memoTag", tag.name);
        }
        window.renderChangedTagType(type);
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
            (window.logs || []).forEach((log) => {
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
            });
            (window.trash || []).forEach((log) => {
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
            });
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
        window.renderChangedTagType(type);
        if (window.renderMain) window.renderMain();
        window.closeTagEditModal();
    };

    window.deleteTagEdit = () => {
        const type = window.editingTagType;
        const arr = getTagArray(type);
        const tag = arr[window.editingTagIndex];
        if (!tag) return;
        if (window.pushWorkUndo) window.pushWorkUndo();
        if (type === "task") window.activeTaskTypes = (window.activeTaskTypes || []).filter((i) => i !== tag.name);
        if (type === "coworker") window.selectedCoworkers = (window.selectedCoworkers || []).filter((i) => i !== tag.name);
        if (type === "status" && window.activeStatus === tag.name) window.activeStatus = null;
        if (type === "memoTag") window.activeEditTags = (window.activeEditTags || []).filter((i) => i !== tag.name);
        if (type === "equip" && window.activeEquips) delete window.activeEquips[tag.name];
        arr.splice(window.editingTagIndex, 1);
        if (window.saveLocal) window.saveLocal();
        window.renderChangedTagType(type);
        if (window.renderMain) window.renderMain();
        window.closeTagEditModal();
    };

    window.addNewType = (type) => {
        const titles = { task: "작업유형", coworker: "매니저", equip: "장비/기타", memoTag: "메모 태그", status: "상태" };
        const customGroup = titles[type] ? null : (window.getGroupById && window.getGroupById(type));
        const title = titles[type] || (customGroup ? customGroup.title : "항목");
        let name = prompt(`새로운 ${title}을 입력하세요.`);
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
        else {
            // 커스텀 그룹: 선택 상태에도 반영
            if (!window.activeCustomGroupSelections) window.activeCustomGroupSelections = {};
            if (!window.activeCustomGroupSelections[type]) window.activeCustomGroupSelections[type] = [];
            if (!window.activeCustomGroupSelections[type].includes(name)) window.activeCustomGroupSelections[type].push(name);
        }
        if (window.saveLocal) window.saveLocal();
        window.renderChangedTagType(type);
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

    // ═══════════════════════════════════════════
    // Undo 스택 (완전판 - 태그/이미지/당직 포함)
    // ═══════════════════════════════════════════
    const snapshotWorkDraftFull = () => {
        const ids = ["workDateInput", "workTime", "taskNo", "customerName", "workAddress", "workContent", "workNote", "workOT"];
        const fields = {};
        ids.forEach((id) => { const el = document.getElementById(id); if (el) fields[id] = el.value; });
        return {
            fields,
            isWorkDuty: !!window.isWorkDuty,
            activeTaskTypes: JSON.parse(JSON.stringify(window.activeTaskTypes || [])),
            selectedCoworkers: JSON.parse(JSON.stringify(window.selectedCoworkers || [])),
            activeStatus: window.activeStatus || null,
            activeEquips: JSON.parse(JSON.stringify(window.activeEquips || {})),
            workImgs: JSON.parse(JSON.stringify(window.workImgs || [])),
            taskTypes: JSON.parse(JSON.stringify(window.taskTypes || [])),
            coworkers: JSON.parse(JSON.stringify(window.coworkers || [])),
            equipments: JSON.parse(JSON.stringify(window.equipments || [])),
            statuses: JSON.parse(JSON.stringify(window.statuses || []))
        };
    };

    window.pushWorkUndo = () => {
        const modal = document.getElementById("workModal");
        if (!modal || modal.style.display !== "flex") return;
        const snapshot = snapshotWorkDraftFull();
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
        window.renderTaskTypes && window.renderTaskTypes();
        window.renderCoworkers && window.renderCoworkers();
        window.renderEquips && window.renderEquips();
        window.renderStatuses && window.renderStatuses();
        window.renderWorkPhotoGrid && window.renderWorkPhotoGrid();
        if (masterBefore !== JSON.stringify([window.taskTypes, window.coworkers, window.equipments, window.statuses]) && window.saveLocal) window.saveLocal();
        window.updateWorkUndoButton();
    };

    // ═══════════════════════════════════════════
    // openWorkModal / closeWorkModal 오버라이드
    // ═══════════════════════════════════════════
    const _origOpenWorkModal = window.openWorkModal;
    window.openWorkModal = (...args) => {
        window.workUndoStack = [];
        const result = _origOpenWorkModal && _origOpenWorkModal(...args);
        window.applyWorkLayout && window.applyWorkLayout();
        window.ensureInnerLayoutObjects && window.ensureInnerLayoutObjects();
        window.setWorkLayoutMode(false);
        window.updateWorkUndoButton();
        return result;
    };

    const _origCloseWorkModal = window.closeWorkModal;
    window.closeWorkModal = (...args) => {
        window.workUndoStack = [];
        if (window.isWorkLayoutMode) window.setWorkLayoutMode(false);
        window.updateWorkUndoButton();
        return _origCloseWorkModal && _origCloseWorkModal(...args);
    };

    const _origToggleDuty = window.toggleDuty;
    window.toggleDuty = (...args) => {
        window.pushWorkUndo && window.pushWorkUndo();
        return _origToggleDuty && _origToggleDuty(...args);
    };

    const _origHandleWorkFiles = window.handleWorkFiles;
    window.handleWorkFiles = (...args) => {
        window.pushWorkUndo && window.pushWorkUndo();
        return _origHandleWorkFiles && _origHandleWorkFiles(...args);
    };

    window.removeWorkPhoto = (index) => {
        window.pushWorkUndo && window.pushWorkUndo();
        if (window.workImgs) window.workImgs.splice(index, 1);
        window.renderWorkPhotoGrid && window.renderWorkPhotoGrid();
    };

    window.ensureWorkResizeHandles = () => {};

    // ═══════════════════════════════════════════
    // initInnerReorderListeners (원본 완전 복원)
    // ═══════════════════════════════════════════
    window.hasInitInnerReorderListeners = false;
    window.initInnerReorderListeners = () => {
        if (window.hasInitInnerReorderListeners) return;
        const modal = document.getElementById("workModal");
        if (!modal) return;

        let selectedCell = null, dragCell = null, dragGroup = null;
        let resizeCell = null, resizeStart = null;
        let pendingResizeCell = null, pendingResizeStart = null;
        let resizeHandleLongPressed = false, resizeModeTimer = null;

        const selectCell = (cell) => {
            if (selectedCell && selectedCell !== cell) selectedCell.classList.remove("is-widget-selected");
            selectedCell = cell || null;
            if (selectedCell) selectedCell.classList.add("is-widget-selected");
        };

        const clampW = (v, max) => Math.max(1, Math.min(max, Number(v) || 1));
        const setWSize = (cell, cs, rs) => {
            const c = clampW(cs, 6), r = clampW(rs, 6);
            cell.dataset.widgetCols = String(c); cell.dataset.widgetRows = String(r);
            cell.style.setProperty("--widget-cols", c); cell.style.setProperty("--widget-rows", r);
            cell.style.minHeight = `calc(${r} * 32px)`; // gap:0이므로 실제 grid 트랙 크기와 정확히 일치시킴
        };

        // 손잡이 없이 칸 몸체를 탭하면 그냥 선택만 한다(이동/크기조절은 반드시 가운데 점에서만).
        const start = (event) => {
            if (!window.isWorkLayoutMode) return;
            // 순서 모드에서는 객체(칸) 단위 선택/이동/리사이즈를 막고 그룹(블록) 선택만 허용
            if (window.isOrderMode) return;
            clearTimeout(resizeModeTimer);
            resizeHandleLongPressed = false; pendingResizeCell = null; pendingResizeStart = null;
            const resizeHandle = event.target.closest(".widget-resize-handle");
            if (resizeHandle && modal.contains(resizeHandle)) {
                pendingResizeCell = resizeHandle.closest(".inner-layout-cell");
                selectCell(pendingResizeCell);
                const point = event.touches ? event.touches[0] : event;
                const groupRect = pendingResizeCell.parentElement.getBoundingClientRect();
                pendingResizeStart = {
                    x: point.clientX, y: point.clientY,
                    cols: Number(pendingResizeCell.dataset.widgetCols) || 1,
                    rows: Number(pendingResizeCell.dataset.widgetRows) || 1,
                    colWidth: Math.max(1, groupRect.width / 6), rowHeight: 32
                };
                // 예전엔 1500ms 동안 10px 이내로 완벽히 고정해야 이동모드로 넘어갔는데,
                // 그정도로 오래 손가락을 떨지 않고 버티는 게 사실상 불가능해서 항상 크기조절로만
                // 빠졌음(이동모드 진입 실패) — 시간을 줄이고 허용 오차를 넉넉하게 늘림.
                resizeModeTimer = setTimeout(() => {
                    resizeHandleLongPressed = true;
                    dragCell = pendingResizeCell; dragGroup = pendingResizeCell && pendingResizeCell.parentElement;
                    if (dragCell) { selectCell(dragCell); dragCell.classList.add("is-widget-dragging"); }
                    pendingResizeCell = null; pendingResizeStart = null;
                    if (navigator.vibrate) navigator.vibrate(50);
                }, 700);
                if (event.cancelable) event.preventDefault();
                return;
            }
            // 손잡이가 아닌 칸 본문 탭 → 선택만(이동/리사이즈 없음)
            const cell = event.target.closest(".inner-layout-cell");
            if (!cell || !modal.contains(cell)) return;
            if (event.cancelable) event.preventDefault();
            selectCell(cell);
        };

        const move = (event) => {
            const point = event.touches ? event.touches[0] : event;
            if (pendingResizeCell && pendingResizeStart) {
                if (event.cancelable) event.preventDefault();
                const dist = Math.hypot(point.clientX - pendingResizeStart.x, point.clientY - pendingResizeStart.y);
                if (resizeHandleLongPressed) { pendingResizeCell = null; pendingResizeStart = null; }
                else if (dist > 20) {
                    clearTimeout(resizeModeTimer);
                    resizeCell = pendingResizeCell; resizeStart = pendingResizeStart;
                    resizeCell.classList.add("is-widget-dragging"); // 크기 조절 중에도 전환 지연 없이 즉시 반응
                    pendingResizeCell = null; pendingResizeStart = null;
                } else return;
            }
            if (resizeCell && resizeStart) {
                if (event.cancelable) event.preventDefault();
                // grid-auto-flow:dense가 겹침을 알아서 막아주므로 크기만 바꾸면 나머지는 자동 재배치된다
                const cols = resizeStart.cols + Math.round((point.clientX - resizeStart.x) / resizeStart.colWidth);
                const rows = resizeStart.rows + Math.round((point.clientY - resizeStart.y) / resizeStart.rowHeight);
                setWSize(resizeCell, cols, rows);
                return;
            }
            if (!dragCell || !dragGroup) return;
            if (event.cancelable) event.preventDefault();
            // 커서 아래 가장 가까운 칸의 앞/뒤로 순서를 옮긴다 — 실제 화면 좌표는
            // grid-auto-flow:dense가 빈틈없이 자동으로 다시 계산해준다(아이폰 홈화면 방식)
            const over = document.elementFromPoint(point.clientX, point.clientY);
            let target = over && over.closest(".inner-layout-cell");
            if (target && (target === dragCell || target.parentElement !== dragGroup)) target = null;
            if (!target) {
                const groupRect = dragGroup.getBoundingClientRect();
                if (point.clientX < groupRect.left || point.clientX > groupRect.right ||
                    point.clientY < groupRect.top - 40 || point.clientY > groupRect.bottom + 40) {
                    return;
                }
                let nearest = null, nearestDist = Infinity;
                [...dragGroup.querySelectorAll(":scope > .inner-layout-cell")].forEach((cell) => {
                    if (cell === dragCell) return;
                    const r = cell.getBoundingClientRect();
                    const dist = Math.hypot(point.clientX - (r.left + r.width / 2), point.clientY - (r.top + r.height / 2));
                    if (dist < nearestDist) { nearestDist = dist; nearest = cell; }
                });
                target = nearest;
            }
            if (!target || target === dragCell || target.parentElement !== dragGroup) return;
            const rect = target.getBoundingClientRect();
            const before = point.clientY < rect.top + rect.height / 2 ||
                (Math.abs(point.clientY - (rect.top + rect.height / 2)) < rect.height / 3 && point.clientX < rect.left + rect.width / 2);
            dragGroup.insertBefore(dragCell, before ? target : target.nextSibling);
        };

        const end = () => {
            clearTimeout(resizeModeTimer);
            if (dragCell) dragCell.classList.remove("is-widget-dragging");
            if (resizeCell) resizeCell.classList.remove("is-widget-dragging");
            if (dragCell || resizeCell) window.saveWorkLayout && window.saveWorkLayout();
            dragCell = null; dragGroup = null; resizeCell = null; resizeStart = null;
            pendingResizeCell = null; pendingResizeStart = null;
            resizeHandleLongPressed = false;
        };

        modal.addEventListener("touchstart", start, { passive: false });
        modal.addEventListener("touchmove", move, { passive: false });
        modal.addEventListener("touchend", end);
        modal.addEventListener("touchcancel", end);
        modal.addEventListener("mousedown", start);
        modal.addEventListener("click", (event) => {
            if (!window.isWorkLayoutMode) return;
            if (!event.target.closest(".inner-layout-cell")) return;
            event.preventDefault(); event.stopPropagation();
        }, true);
        window.addEventListener("mousemove", move);
        window.addEventListener("mouseup", end);
        window.hasInitInnerReorderListeners = true;
    };

    // ─── 초기화 ───
    bindDraftFieldUndo();
    window.initTagReorderListeners();
    window.initInnerReorderListeners();
})();