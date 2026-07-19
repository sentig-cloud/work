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

    // 숫자 표시/월별 집계 포함 여부는 태그 하나하나가 아니라 "그룹 전체" 설정이다 —
    // 편집창에서 하나를 켜고 끄면 그 그룹에 속한 모든 태그에 똑같이 적용된다.
    const showsNumber = (type) => window.groupShowsNumber(window.typeToGroupId(type));
    const includesMonthly = (type) => window.groupIncludesMonthly(window.typeToGroupId(type));
    const getSortCount = (tag) => Number(tag && tag.count) || 0;

    const replaceInList = (list, old, neu) =>
        Array.isArray(list) ? list.map((n) => n === old ? neu : n) : list;

    const getMonthlyCount = (type, name) => window.getGroupTagMonthlyCount(window.typeToGroupId(type), name);

    const getTagLabel = (type, tag) => {
        const groupId = window.typeToGroupId(type);
        // 0은 표시하지 않는다(시인성 확보) — [숫자]가 켜져 있어도 이번 달 집계가 0이면 그냥 생략
        const monthlyCount = getMonthlyCount(type, tag.name);
        const monthly = (showsNumber(type) && monthlyCount > 0) ? `[${monthlyCount}] ` : "";
        const qty = type === "equip" ? Number(window.activeEquips && window.activeEquips[tag.name] || 0) : 0;
        // 장비는 실제 선택된 수량이 있으면 그걸 우선 보여주고, 없으면 그룹의 "갯수" 설정을 따른다(0이면 생략)
        const baseCount = Number(tag.count) || 0;
        const countSuffix = qty > 0 ? ` (${qty})` : (window.groupShowsCount(groupId) && baseCount > 0 ? ` (${baseCount})` : "");
        return `${monthly}${tag.name}${countSuffix}`;
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

    // "+" 버튼: 짧게 탭하면 새 항목 추가(기존과 동일), 길게 누르면 그 그룹에서 삭제했던
    // 항목을 다시 불러올 수 있는 복원 목록이 뜬다.
    const addButtonHtml = (type, extraStyle) => `
        <button type="button" class="w95-btn" style="${extraStyle || ""}"
            onmousedown="window.startAddPress(event,'${type}')"
            onmouseup="window.endAddPress(event,'${type}')"
            onmouseleave="window.cancelAddPress()"
            ontouchstart="window.startAddPress(event,'${type}')"
            ontouchend="window.endAddPress(event,'${type}')"
            ontouchcancel="window.cancelAddPress()"><b>+</b></button>`;
    // work_render.js의 renderCustomGroup(다른 스코프)에서도 동일한 +버튼을 쓰기 위해 공개
    window.buildAddButtonHtml = addButtonHtml;

    // ═══════════════════════════════════════════
    // 태그 렌더링
    // ═══════════════════════════════════════════
    window.renderTaskTypes = () => {
        (window.taskTypes = window.taskTypes || []).sort((a, b) => getSortCount(b) - getSortCount(a));
        const el = document.getElementById("taskTypeArea"); if (!el) return;
        el.innerHTML = window.taskTypes.map((t, i) =>
            tagButton("task", t, i, (window.activeTaskTypes || []).includes(t.name))
        ).join("") + addButtonHtml("task");
    };

    window.renderCoworkers = () => {
        (window.coworkers = window.coworkers || []).sort((a, b) => getSortCount(b) - getSortCount(a));
        const el = document.getElementById("coworkerArea"); if (!el) return;
        el.innerHTML = window.coworkers.map((c, i) =>
            tagButton("coworker", c, i, (window.selectedCoworkers || []).includes(c.name))
        ).join("") + addButtonHtml("coworker");
    };

    window.renderStatuses = () => {
        (window.statuses = window.statuses || []).sort((a, b) => getSortCount(b) - getSortCount(a));
        const el = document.getElementById("statusArea"); if (!el) return;
        el.innerHTML = window.statuses.map((s, i) =>
            tagButton("status", s, i, window.activeStatus === s.name)
        ).join("") + addButtonHtml("status");
    };

    window.renderEquips = () => {
        // 예전엔 여기서 라벨을 직접 만들어서 다른 그룹과 달리 숫자/월별 그룹 설정이 전혀 반영되지
        // 않는 버그가 있었음 — 다른 그룹과 동일하게 tagButton/getTagLabel을 그대로 재사용한다.
        (window.equipments = window.equipments || []).sort((a, b) => getSortCount(b) - getSortCount(a));
        const el = document.getElementById("equipArea"); if (!el) return;
        el.innerHTML = window.equipments.map((eq, i) => {
            const cnt = window.activeEquips && window.activeEquips[eq.name] || 0;
            return tagButton("equip", eq, i, cnt > 0);
        }).join("") + addButtonHtml("equip");
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
            ? addButtonHtml("memoTag", "height:30px;width:36px;")
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
    // 마지막으로 순서를 바꾼 시각 — 매 pointermove마다(초당 수십 번) DOM을 재배치하면
    // 두 후보 자리 사이를 오가며 파르르 떠는 것처럼 보였음. 아이폰 홈화면 아이콘 재배치처럼
    // 일정 간격(아래 REORDER_THROTTLE_MS)마다만 자리를 바꿔서 CSS transition이 끊기지 않고
    // 끝까지 재생되도록 한다.
    let lastBlockReorderAt = 0;
    const REORDER_THROTTLE_MS = 140;

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
        lastBlockReorderAt = 0;
        if (navigator.vibrate) navigator.vibrate(25);
    };

    const moveBlockMove = (e) => {
        if (!blockDragEl || !blockDragParent) return;
        e.preventDefault();
        const point = e.touches ? e.touches[0] : e;
        const over = document.elementFromPoint(point.clientX, point.clientY);
        const target = over && over.closest(".drag-item");
        if (!target || target === blockDragEl || target.parentElement !== blockDragParent) return;
        const rect = target.getBoundingClientRect();
        // 위/아래로 쌓인 블록이므로 세로 위치 기준으로 앞/뒤를 정한다
        const before = point.clientY < rect.top + rect.height / 2;
        const desiredNext = before ? target : target.nextSibling;
        // 이미 그 자리면 아무것도 하지 않음(불필요한 재배치가 떨림의 절반 이상 원인이었음)
        if (blockDragEl.nextSibling === desiredNext) return;
        const now = Date.now();
        if (now - lastBlockReorderAt < REORDER_THROTTLE_MS) return;
        lastBlockReorderAt = now;
        document.querySelectorAll(".is-block-drop-target").forEach(i => i.classList.remove("is-block-drop-target"));
        target.classList.add("is-block-drop-target");
        blockDragParent.insertBefore(blockDragEl, desiredNext);
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

        // 순서 모드도 기억 선택 모드도 아니면 그룹(블록) 탭은 아무 동작도 하지 않는다 —
        // 개별 객체(칸) 선택/이동/리사이즈는 initInnerReorderListeners가 별도로 계속 담당한다.
        if (!window.isOrderMode && !window.isRememberSelectMode) return;

        const modal = document.getElementById("workModal");
        if (!modal || !modal.contains(e.target)) return;

        // 기억 선택 모드: 탭한 그룹의 기억 on/off만 토글하고 끝(이동/하이라이트 없음)
        if (window.isRememberSelectMode) {
            const groupEl = e.target.closest("#workDragContainer > .drag-item[data-group-ref]");
            if (groupEl && groupEl.dataset.groupRef !== "duration") {
                e.preventDefault();
                e.stopPropagation();
                window.toggleGroupRemember(groupEl.dataset.groupRef);
            }
            return;
        }

        // 여기부터는 순서 모드: 기존 그룹(블록) 선택/이동 로직
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

    // CSS의 ".inner-layout-cell > textarea { height:100% !important }"만으로는
    // 일부 모바일 브라우저(특히 iOS Safari)에서 flex 컨테이너 안 textarea가 퍼센트 높이를
    // 제대로 채우지 못하는 알려진 렌더링 버그가 있어서, 작업내용처럼 여러 줄(rowSpan>1)인
    // 칸은 칸만 커지고 실제 textarea는 그대로라 가운데 리사이즈 점만 뚝 떨어져 보였음 —
    // 퍼센트 계산에 기대지 않고 실제 컨트롤에 px 높이를 인라인 !important로 직접 박아서
    // 브라우저 퍼센트 해석 차이와 무관하게 항상 칸 크기만큼 자라도록 함.
    const applyCellChildHeight = (cell, rows) => {
        const child = cell.querySelector(":scope > input, :scope > textarea, :scope > button, :scope > div:not(.widget-resize-handle)");
        if (!child) return;
        // 36px = 한 줄 grid 트랙, 4px = 칸 padding(상하 2px씩) — 칸 전체 높이에서
        // padding을 뺀 나머지(32px, 태그 버튼과 동일)가 실제 컨트롤 높이.
        const px = Math.max(20, rows * 36 - 4);
        child.style.setProperty("height", `${px}px`, "important");
    };

    const setWidgetSize = (cell, colSpan, rowSpan) => {
        const c = clampWidgetSpan(colSpan, 6);
        const r = clampWidgetSpan(rowSpan, 6);
        cell.dataset.widgetCols = String(c);
        cell.dataset.widgetRows = String(r);
        cell.style.setProperty("--widget-cols", c);
        cell.style.setProperty("--widget-rows", r);
        // .inner-layout-group의 gap이 0이라 줄 사이 여백이 없는데, 예전엔 줄마다 +2px씩
        // 더 얹어서 실제 grid 트랙(36px*줄수)보다 커져 작업내용/특이사항 같은 여러 줄 칸이
        // 칸 경계를 넘치던 버그가 있었음 — 실제 트랙 크기와 정확히 맞춘다(work_style.css 참고).
        cell.style.minHeight = `calc(${r} * 36px)`;
        applyCellChildHeight(cell, r);
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
            // 날짜/시간/당직 등 작은 필드·버튼들은 전부 1줄(36px, work_style.css의
            // grid-auto-rows 참고)로 통일 — 칸 안의 입력창/버튼은 셀 padding(상하 2px)을
            // 뺀 32px로 작업유형/매니저 등 선택 태그 버튼(.w95-btn) 높이와 일치한다.
            { key: "1-fields", items: [
                ["date", document.getElementById("workDateInput")?.parentElement, 2, 1],
                ["time", document.getElementById("workTime"), 1, 1],
                ["duty", document.getElementById("workDutyBtn"), 1, 1],
                ["ot", document.getElementById("workOTBtn"), 2, 1],
                ["taskNo", document.getElementById("taskNo"), 2, 1],
                ["copy", document.getElementById("workCopyBtn"), 1, 1],
                ["customer", document.getElementById("customerName"), 3, 1],
                ["address", document.getElementById("workAddress"), 4, 1],
                // 이전 selector(주소 래퍼 안에서 button 검색)는 항상 null이었음(지도 버튼은 별도 래퍼).
                // 버튼 자신의 속성으로 직접 찾아야 이 함수가 여러 번 호출돼 버튼이 이미 칸 안으로
                // 옮겨진 뒤에도(부모가 바뀐 뒤에도) 계속 같은 버튼을 다시 찾을 수 있다.
                ["map", document.querySelector('button[onmousedown*="startMapPress"]'), 1, 1],
                ["undo", document.getElementById("workUndoBtn"), 1, 1],
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
        window.applyCustomTitles?.();
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
                onmousedown="window.startTitlePress(event, '${esc(groupId)}')" onmouseup="window.endTitlePress('${esc(groupId)}')" onmouseleave="window.cancelTitlePress()"
                ontouchstart="window.startTitlePress(event, '${esc(groupId)}')" ontouchend="window.endTitlePress('${esc(groupId)}')" ontouchcancel="window.cancelTitlePress()"
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
    // 기억 모드와는 동시에 켤 수 없다(그룹을 탭했을 때 이동인지 기억 토글인지 모호해지므로).
    window.isOrderMode = false;
    window.toggleOrderMode = () => {
        if (!window.isWorkLayoutMode) {
            alert("레이아웃 편집 모드에서 사용하세요.");
            return;
        }
        window.isOrderMode = !window.isOrderMode;
        if (window.isOrderMode) window.isRememberSelectMode = false;
        deselectBlock();
        document.getElementById("workLayoutOrderBtn")?.classList.toggle("active-btn", window.isOrderMode);
        document.getElementById("workModal")?.classList.toggle("order-mode", window.isOrderMode);
        window.updateRememberModeBtn();
    };

    // ─── 기억 선택 모드 토글 ───
    // 켜면(순서와 동일한 방식): 그룹(블록)을 탭할 때마다 "그 그룹만" 기억 켜짐/꺼짐이 토글된다
    // (이동은 하지 않음). 기억이 켜진 그룹은 새 작업일지를 열 때 마지막 선택값을 자동 적용하고,
    // 제목 줄 오른쪽에 초록 점으로 표시한다. 순서 모드와는 동시에 켤 수 없다.
    window.isRememberSelectMode = false;
    window.toggleRememberSelectMode = () => {
        if (!window.isWorkLayoutMode) {
            alert("레이아웃 편집 모드에서 사용하세요.");
            return;
        }
        window.isRememberSelectMode = !window.isRememberSelectMode;
        if (window.isRememberSelectMode) window.isOrderMode = false;
        deselectBlock();
        document.getElementById("workLayoutOrderBtn")?.classList.toggle("active-btn", window.isOrderMode);
        document.getElementById("workModal")?.classList.toggle("order-mode", window.isOrderMode);
        window.updateRememberModeBtn();
    };

    window.updateRememberModeBtn = () => {
        document.getElementById("workRememberModeBtn")?.classList.toggle("active-btn", !!window.isRememberSelectMode);
    };

    // duration(시작/종료)은 태그 선택 그룹이 아니므로 기억 대상에서 제외
    window.toggleGroupRemember = (groupId) => {
        if (groupId === "duration") return;
        const g = window.getGroupById && window.getGroupById(groupId);
        if (!g) return;
        g.remember = !g.remember;
        window.markDirty?.("master", "groups", "upsert");
        if (window.saveLocal) window.saveLocal("group-remember");
        window.refreshRememberDots();
        if (navigator.vibrate) navigator.vibrate(20);
    };

    // 각 그룹 상자(제목이 있는 .drag-item)에 기억 on/off에 따라 점 표시 클래스를 갱신
    window.refreshRememberDots = () => {
        (window.groups || []).forEach(g => {
            const el = document.querySelector(`#workDragContainer > .drag-item[data-group-ref="${g.id}"]`);
            if (el) el.classList.toggle("has-remember", !!g.remember && g.id !== "duration");
        });
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
    const countAllowed = (type) => includesMonthly(type);
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
        if (!showsNumber(type)) return tag.name;
        if (!includesMonthly(type)) return `[0] ${tag.name}`;
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
        if (type === "task" || type === "coworker") {
            // 그룹의 selectionMode(단일/중복)에 따라 동작이 달라진다 — "중복" 토글로 전환 가능
            const listKey = type === "task" ? "activeTaskTypes" : "selectedCoworkers";
            const groupId = window.typeToGroupId(type);
            const g = window.getGroupById(groupId);
            const current = window[listKey] || [];
            if (g && g.selectionMode === "single") {
                window[listKey] = current.includes(tag.name) ? [] : [tag.name];
            } else {
                const indexOf = current.indexOf(tag.name);
                if (indexOf > -1) current.splice(indexOf, 1); else current.push(tag.name);
                window[listKey] = current;
            }
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
        document.getElementById("tagEditInput").value = tag.name;
        document.getElementById("tagEditModal").style.display = "flex";
        window.refreshTagEditControls();
        setTimeout(() => document.getElementById("tagEditInput").select(), 80);
    };

    // 상태는 앱 전체(카드/내보내기/검색/대시보드)가 "값 하나"라는 전제로 만들어져 있어서
    // 중복(다중선택) 토글 대상에서 제외한다 — 장비(qty)/메모태그(tag)는 selectionMode 자체가
    // single/multi가 아니므로 자연히 제외됨.
    const canToggleSelectionMode = (groupId) => {
        if (groupId === "statuses") return false;
        const g = window.getGroupById(groupId);
        return !!g && (g.selectionMode === "single" || g.selectionMode === "multi");
    };

    window.refreshTagEditControls = () => {
        const qty = document.getElementById("tagQtyDisplay");
        const numberBtn = document.getElementById("tagShowCountBtn");
        const monthlyBtn = document.getElementById("tagMonthlyBtn");
        const countBtn = document.getElementById("tagCountSuffixBtn");
        const dupBtn = document.getElementById("tagDuplicateBtn");
        const groupId = window.typeToGroupId(window.editingTagType);
        if (qty) qty.innerText = String(window.tempTagQty || 0);
        if (numberBtn) numberBtn.className = `w95-btn tag-toggle-btn ${window.groupShowsNumber(groupId) ? "is-on" : "is-off"}`;
        if (monthlyBtn) monthlyBtn.className = `w95-btn tag-toggle-btn ${window.groupIncludesMonthly(groupId) ? "is-on" : "is-off"}`;
        if (countBtn) countBtn.className = `w95-btn tag-toggle-btn ${window.groupShowsCount(groupId) ? "is-on" : "is-off"}`;
        if (dupBtn) {
            const toggleable = canToggleSelectionMode(groupId);
            const g = window.getGroupById(groupId);
            dupBtn.disabled = !toggleable;
            dupBtn.style.opacity = toggleable ? "1" : "0.4";
            dupBtn.className = `w95-btn tag-toggle-btn ${toggleable && g && g.selectionMode === "multi" ? "is-on" : "is-off"}`;
        }
    };

    // "중복": 그룹의 selectionMode를 single↔multi로 전환 — 상태/장비/메모태그는 대상 제외(위 참고)
    window.toggleGroupSelectionMode = () => {
        const groupId = window.typeToGroupId(window.editingTagType);
        if (!canToggleSelectionMode(groupId)) return;
        const g = window.getGroupById(groupId);
        g.selectionMode = g.selectionMode === "multi" ? "single" : "multi";
        // 단일 모드로 바꿀 때 이미 여러 개가 선택돼 있으면 첫 번째만 남긴다
        if (g.selectionMode === "single") {
            const current = window.getGroupSelection(groupId);
            if (Array.isArray(current) && current.length > 1) {
                window.setGroupSelection(groupId, [current[0]]);
            }
        }
        window.refreshTagEditControls();
        window.markDirty?.("master", "groups", "upsert");
        if (window.saveLocal) window.saveLocal();
        window.renderChangedTagType(window.editingTagType);
    };

    // 수량(+/-)은 태그 하나만의 값이라 즉시 반영 + 바로 저장
    window.changeTagQty = (delta) => {
        const type = window.editingTagType;
        const tag = getTagArray(type)[window.editingTagIndex];
        if (!tag) return;
        window.tempTagQty = Math.max(0, Number(window.tempTagQty || 0) + delta);
        tag.count = window.tempTagQty;
        if (type === "equip") {
            window.activeEquips = window.activeEquips || {};
            if (window.tempTagQty > 0) window.activeEquips[tag.name] = window.tempTagQty;
            else delete window.activeEquips[tag.name];
        }
        window.refreshTagEditControls();
        window.markDirty?.("master", "groups", "upsert");
        if (window.saveLocal) window.saveLocal();
        window.renderChangedTagType(type);
    };

    // 숫자 표시/월별 집계는 태그가 아니라 "그룹" 설정 — 켜고 끄면 그 그룹 전체에 바로 적용되고 저장됨
    window.toggleTagShowCount = () => {
        const groupId = window.typeToGroupId(window.editingTagType);
        const g = window.getGroupById(groupId);
        if (!g) return;
        g.showNumber = !window.groupShowsNumber(groupId);
        window.refreshTagEditControls();
        window.markDirty?.("master", "groups", "upsert");
        if (window.saveLocal) window.saveLocal();
        window.renderChangedTagType(window.editingTagType);
    };

    window.toggleTagMonthly = () => {
        const groupId = window.typeToGroupId(window.editingTagType);
        const g = window.getGroupById(groupId);
        if (!g) return;
        g.includeMonthly = !window.groupIncludesMonthly(groupId);
        window.refreshTagEditControls();
        window.markDirty?.("master", "groups", "upsert");
        if (window.saveLocal) window.saveLocal();
        window.renderChangedTagType(window.editingTagType);
    };

    // "갯수": 그룹 전체 설정 — 켜면 태그 이름 뒤에 (개수)가 붙는다(장비의 실사용 수량 표시와는 별개)
    window.toggleTagShowQty = () => {
        const groupId = window.typeToGroupId(window.editingTagType);
        const g = window.getGroupById(groupId);
        if (!g) return;
        g.showCount = !window.groupShowsCount(groupId);
        window.refreshTagEditControls();
        window.markDirty?.("master", "groups", "upsert");
        if (window.saveLocal) window.saveLocal();
        window.renderChangedTagType(window.editingTagType);
    };

    // 이름은 텍스트 입력이라 즉시 저장이 어려우므로, 포커스가 빠지거나(blur) 엔터를 누르면 그 순간 반영+저장
    window.commitTagNameEdit = () => {
        const type = window.editingTagType;
        if (!type) return; // 모달이 이미 닫힌 뒤 뒤늦게 blur가 들어오는 경우 대비
        const arr = getTagArray(type);
        const tag = arr[window.editingTagIndex];
        if (!tag) return;
        const input = document.getElementById("tagEditInput");
        const newName = input.value.trim();

        if (!newName || newName === tag.name) {
            input.value = tag.name;
            return;
        }
        if (arr.some((item, index) => index !== window.editingTagIndex && item.name === newName)) {
            alert("같은 이름의 항목이 이미 있습니다.");
            input.value = tag.name;
            return;
        }

        const oldName = tag.name;
        const groupId = window.typeToGroupId(type);
        if (window.pushWorkUndo) window.pushWorkUndo();

        window.activeTaskTypes = replaceInList(window.activeTaskTypes, oldName, newName);
        window.selectedCoworkers = replaceInList(window.selectedCoworkers, oldName, newName);
        window.activeEditTags = replaceInList(window.activeEditTags, oldName, newName);
        if (window.activeStatus === oldName) window.activeStatus = newName;
        if (window.activeEquips && Object.prototype.hasOwnProperty.call(window.activeEquips, oldName)) {
            window.activeEquips[newName] = window.activeEquips[oldName];
            delete window.activeEquips[oldName];
        }
        if (window.activeCustomGroupSelections && window.activeCustomGroupSelections[groupId]) {
            window.activeCustomGroupSelections[groupId] = replaceInList(window.activeCustomGroupSelections[groupId], oldName, newName);
        }

        // groupId 기반 공용 접근자를 써서 기본 그룹/커스텀 그룹 모두 동일하게 이름 치환
        [window.logs, window.trash].forEach((collection) => {
            (collection || []).forEach((log) => {
                if (!log) return;
                const val = window.getGroupValueFromLog(log, groupId);
                if (groupId === "equipments") {
                    if (val && Object.prototype.hasOwnProperty.call(val, oldName)) {
                        val[newName] = val[oldName];
                        delete val[oldName];
                    }
                } else if (Array.isArray(val)) {
                    if (val.includes(oldName)) window.setGroupValueToLog(log, groupId, replaceInList(val, oldName, newName));
                } else if (val === oldName) {
                    window.setGroupValueToLog(log, groupId, newName);
                }
            });
        });

        tag.name = newName;
        window.markDirty?.("master", "groups", "upsert");
        if (window.saveLocal) window.saveLocal();
        window.renderChangedTagType(type);
        if (window.renderMain) window.renderMain();
    };

    window.deleteTagEdit = () => {
        const type = window.editingTagType;
        const arr = getTagArray(type);
        const tag = arr[window.editingTagIndex];
        if (!tag) return;
        if (!confirm(`"${tag.name}" 항목을 삭제하시겠습니까?`)) return;
        if (window.pushWorkUndo) window.pushWorkUndo();
        if (type === "task") window.activeTaskTypes = (window.activeTaskTypes || []).filter((i) => i !== tag.name);
        if (type === "coworker") window.selectedCoworkers = (window.selectedCoworkers || []).filter((i) => i !== tag.name);
        if (type === "status" && window.activeStatus === tag.name) window.activeStatus = null;
        if (type === "memoTag") window.activeEditTags = (window.activeEditTags || []).filter((i) => i !== tag.name);
        if (type === "equip" && window.activeEquips) delete window.activeEquips[tag.name];
        const groupId = window.typeToGroupId(type);
        if (window.activeCustomGroupSelections && window.activeCustomGroupSelections[groupId]) {
            window.activeCustomGroupSelections[groupId] = window.activeCustomGroupSelections[groupId].filter((i) => i !== tag.name);
        }
        arr.splice(window.editingTagIndex, 1);

        // 삭제된 태그 보관 — "+" 버튼을 길게 눌러 나중에 복원할 수 있게 그룹당 최근 20개까지 보관.
        // 같은 이름을 다시 삭제하면 오래된 기록 대신 최신 것으로 교체한다.
        const g = window.getGroupById(groupId);
        if (g) {
            g.deletedTags = (g.deletedTags || []).filter((dt) => dt.name !== tag.name);
            g.deletedTags.unshift({ name: tag.name, count: tag.count || 0 });
            if (g.deletedTags.length > 20) g.deletedTags.length = 20;
        }

        window.markDirty?.("master", "groups", "upsert");
        if (window.saveLocal) window.saveLocal();
        window.renderChangedTagType(type);
        if (window.renderMain) window.renderMain();
        window.closeTagEditModal();
    };

    // ─── "+" 버튼: 짧게 탭=추가, 길게 누르면 삭제했던 항목 복원 목록 ───
    window.addPressTimer = null;
    window.addPressLongPressed = false;

    window.startAddPress = (event, type) => {
        if (event) event.preventDefault();
        window.addPressLongPressed = false;
        clearTimeout(window.addPressTimer);
        window.addPressTimer = setTimeout(() => {
            window.addPressLongPressed = true;
            if (navigator.vibrate) navigator.vibrate(30);
            window.openTagRestoreModal(type);
        }, 600);
    };

    window.endAddPress = (event, type) => {
        if (event) event.preventDefault();
        clearTimeout(window.addPressTimer);
        if (window.addPressLongPressed) { window.addPressLongPressed = false; return; }
        window.addNewType(type);
    };

    window.cancelAddPress = () => {
        clearTimeout(window.addPressTimer);
        window.addPressLongPressed = false;
    };

    window.editingRestoreType = null;

    window.openTagRestoreModal = (type) => {
        const groupId = window.typeToGroupId(type);
        const g = window.getGroupById(groupId);
        const deleted = (g && g.deletedTags) || [];
        if (deleted.length === 0) {
            alert("삭제된 항목이 없습니다.");
            return;
        }
        window.editingRestoreType = type;
        const listEl = document.getElementById("tagRestoreList");
        listEl.innerHTML = deleted.map((dt, idx) => `
            <button type="button" class="w95-btn" style="display:flex; justify-content:space-between; align-items:center;" onclick="window.restoreDeletedTag(${idx})">
                <span>${esc(dt.name)}</span><span style="color:var(--w-blue); font-weight:bold;">복원</span>
            </button>
        `).join("");
        document.getElementById("tagRestoreModal").style.display = "flex";
    };

    window.closeTagRestoreModal = () => {
        document.getElementById("tagRestoreModal").style.display = "none";
        window.editingRestoreType = null;
    };

    window.restoreDeletedTag = (idx) => {
        const type = window.editingRestoreType;
        const groupId = window.typeToGroupId(type);
        const g = window.getGroupById(groupId);
        if (!g || !g.deletedTags) return;
        const entry = g.deletedTags[idx];
        if (!entry) return;

        const arr = getTagArray(type);
        if (arr.some((t) => t.name === entry.name)) {
            alert(`"${entry.name}" 항목이 이미 있습니다.`);
            return;
        }

        arr.push({ name: entry.name, count: entry.count || 0 });
        g.deletedTags.splice(idx, 1);
        window.markDirty?.("master", "groups", "upsert");
        if (window.saveLocal) window.saveLocal();
        window.renderChangedTagType(type);
        window.closeTagRestoreModal();
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
        arr.push({ name, count: 0 });
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

    // ═══════════════════════════════════════════
    // Undo 스택 (완전판 - 태그/이미지/당직 포함)
    // ═══════════════════════════════════════════
    const snapshotWorkDraftFull = () => {
        const ids = ["workDateInput", "workTime", "taskNo", "customerName", "workAddress", "workContent", "workNote"];
        const fields = {};
        ids.forEach((id) => { const el = document.getElementById(id); if (el) fields[id] = el.value; });
        return {
            fields,
            isWorkDuty: !!window.isWorkDuty,
            workOTCount: Number(window.workOTCount) || 0,
            workStartTime: window.workStartTime || null,
            workEndTime: window.workEndTime || null,
            activeTaskTypes: JSON.parse(JSON.stringify(window.activeTaskTypes || [])),
            selectedCoworkers: JSON.parse(JSON.stringify(window.selectedCoworkers || [])),
            activeStatus: window.activeStatus || null,
            activeEquips: JSON.parse(JSON.stringify(window.activeEquips || {})),
            currentWorkExcludedGroups: JSON.parse(JSON.stringify(window.currentWorkExcludedGroups || [])),
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
        window.workOTCount = Number(snapshot.workOTCount) || 0;
        window.workStartTime = snapshot.workStartTime || null;
        window.workEndTime = snapshot.workEndTime || null;
        window.activeTaskTypes = snapshot.activeTaskTypes;
        window.selectedCoworkers = snapshot.selectedCoworkers;
        window.activeStatus = snapshot.activeStatus;
        window.activeEquips = snapshot.activeEquips;
        window.currentWorkExcludedGroups = snapshot.currentWorkExcludedGroups || [];
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
        window.renderWorkDuration && window.renderWorkDuration();
        window.renderWorkOT && window.renderWorkOT();
        window.renderTaskTypes && window.renderTaskTypes();
        window.renderCoworkers && window.renderCoworkers();
        window.renderEquips && window.renderEquips();
        window.renderStatuses && window.renderStatuses();
        window.renderWorkPhotoGrid && window.renderWorkPhotoGrid();
        window.applyCustomTitles?.();
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
        // move()에서 매 pointermove마다 재배치하면 두 후보 자리 사이를 오가며 파르르 떠는 것처럼
        // 보였음 — 아이폰 홈화면 아이콘처럼 일정 간격(REORDER_THROTTLE_MS)마다만 자리를 바꿔서
        // CSS transition이 끊기지 않고 끝까지 재생되게 한다.
        let lastCellReorderAt = 0;
        const REORDER_THROTTLE_MS = 140;

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
            cell.style.minHeight = `calc(${r} * 36px)`; // gap:0이므로 실제 grid 트랙 크기(36px)와 정확히 일치시킴
            applyCellChildHeight(cell, r); // 드래그로 칸을 늘릴 때 실제 입력창/버튼도 즉시 같이 늘어나게 함
        };

        // 손잡이 없이 칸 몸체를 탭하면 그냥 선택만 한다(이동/크기조절은 반드시 가운데 점에서만).
        const start = (event) => {
            if (!window.isWorkLayoutMode) return;
            // 순서/기억 선택 모드에서는 객체(칸) 단위 선택/이동/리사이즈를 막고 그룹(블록) 탭만 허용
            if (window.isOrderMode || window.isRememberSelectMode) return;
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
                    colWidth: Math.max(1, groupRect.width / 6), rowHeight: 36
                };
                // 예전엔 1500ms 동안 10px 이내로 완벽히 고정해야 이동모드로 넘어갔는데,
                // 그정도로 오래 손가락을 떨지 않고 버티는 게 사실상 불가능해서 항상 크기조절로만
                // 빠졌음(이동모드 진입 실패) — 시간을 줄이고 허용 오차를 넉넉하게 늘림.
                resizeModeTimer = setTimeout(() => {
                    resizeHandleLongPressed = true;
                    dragCell = pendingResizeCell; dragGroup = pendingResizeCell && pendingResizeCell.parentElement;
                    if (dragCell) { selectCell(dragCell); dragCell.classList.add("is-widget-dragging"); }
                    pendingResizeCell = null; pendingResizeStart = null;
                    lastCellReorderAt = 0;
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
            const desiredNext = before ? target : target.nextSibling;
            // 이미 그 자리면 아무것도 하지 않음(불필요한 재배치가 떨림의 절반 이상 원인이었음)
            if (dragCell.nextSibling === desiredNext) return;
            const now = Date.now();
            if (now - lastCellReorderAt < REORDER_THROTTLE_MS) return;
            lastCellReorderAt = now;
            dragGroup.insertBefore(dragCell, desiredNext);
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
