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
    const getSortCount = (type, tag) => {
        const groupId = window.typeToGroupId(type);
        const monthly = window.groupShowsNumber(groupId)
            ? Number(window.getGroupTagMonthlyCount?.(groupId, tag?.name) || 0)
            : 0;
        return monthly || Number(tag && tag.count) || 0;
    };

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
        // 장비 수량은 현재 일지의 선택값만 표시한다. 마스터 tag.count를 기본 수량처럼 재사용하면
        // 선택하지 않은 장비도 T(2)처럼 보이고 편집창에도 2가 들어가는 오류가 생긴다.
        const countSuffix = window.groupShowsCount(groupId) && baseCount > 0
            ? ` (${baseCount})`
            : "";
        const workQty = Number(window.activeWorkTagQuantities?.[groupId]?.[tag.name] || 1);
        const workQtySuffix = workQty > 1 ? ` × ${workQty}` : '';
        return `${monthly}${tag.name}${countSuffix}${workQtySuffix}`;
    };

    const tagButton = (type, tag, index, active) => `
        <button type="button" class="w95-btn layout-tag-button ${active ? "active-btn" : ""}"
            data-tag-type="${type}" data-tag-index="${index}" data-tag-name="${esc(tag.name)}"
            onmousedown="window.startPress(event,'${type}',${index})"
            onmouseup="window.endPress(event,'${type}',${index})"
            onmouseleave="window.cancelPress()"
            ontouchstart="window.startPress(event,'${type}',${index})"
            ontouchend="window.endPress(event,'${type}',${index})"
            ontouchcancel="window.cancelPress()">${esc(getTagLabel(type, tag))}</button>`;

    // "+" 버튼: 짧게 탭하면 새 항목 추가(기존과 동일), 길게 누르면 그 그룹에서 삭제했던
    // 항목을 다시 불러올 수 있는 복원 목록이 뜬다.
    const addButtonHtml = (type, extraStyle) => `
        <button type="button" class="w95-btn group-add-btn" style="${extraStyle || ""}"
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
        (window.taskTypes = window.taskTypes || []).sort((a, b) => getSortCount("task", b) - getSortCount("task", a));
        const el = document.getElementById("taskTypeArea"); if (!el) return;
        el.innerHTML = window.taskTypes.map((t, i) =>
            tagButton("task", t, i, (window.activeTaskTypes || []).includes(t.name))
        ).join("") + addButtonHtml("task");
    };

    window.renderCoworkers = () => {
        (window.coworkers = window.coworkers || []).sort((a, b) => getSortCount("coworker", b) - getSortCount("coworker", a));
        const el = document.getElementById("coworkerArea"); if (!el) return;
        el.innerHTML = window.coworkers.map((c, i) =>
            tagButton("coworker", c, i, (window.selectedCoworkers || []).includes(c.name))
        ).join("") + addButtonHtml("coworker");
    };

    window.renderStatuses = () => {
        (window.statuses = window.statuses || []).sort((a, b) => getSortCount("status", b) - getSortCount("status", a));
        const el = document.getElementById("statusArea"); if (!el) return;
        el.innerHTML = window.statuses.map((s, i) =>
            tagButton("status", s, i, window.activeStatus === s.name)
        ).join("") + addButtonHtml("status");
    };

    window.renderEquips = () => {
        // 예전엔 여기서 라벨을 직접 만들어서 다른 그룹과 달리 숫자/월별 그룹 설정이 전혀 반영되지
        // 않는 버그가 있었음 — 다른 그룹과 동일하게 tagButton/getTagLabel을 그대로 재사용한다.
        (window.equipments = window.equipments || []).sort((a, b) => getSortCount("equip", b) - getSortCount("equip", a));
        const el = document.getElementById("equipArea"); if (!el) return;
        el.innerHTML = window.equipments.map((eq, i) => {
            const cnt = window.activeEquips && window.activeEquips[eq.name] || 0;
            return tagButton("equip", eq, i, cnt > 0);
        }).join("") + addButtonHtml("equip");
    };

    window.renderMemoTags = () => {
        (window.memoTags = window.memoTags || []).sort((a, b) => getSortCount("memoTag", b) - getSortCount("memoTag", a));
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
    let lastBlockReorderAt = 0, lastBlockReorderPoint = null;
    const REORDER_THROTTLE_MS = 220;
    const REORDER_RELEASE_DISTANCE = 22;

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
        lastBlockReorderPoint = null;
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
        // 가운데 경계에서는 순서를 바꾸지 않는다. 경계에 걸친 손가락의 미세한
        // 흔들림으로 앞/뒤가 연속 교환되는 현상을 막고, 위/아래 35% 영역에서만 확정한다.
        const ratioY = (point.clientY - rect.top) / Math.max(rect.height, 1);
        if (ratioY >= 0.35 && ratioY <= 0.65) return;
        const before = ratioY < 0.35;
        const desiredNext = before ? target : target.nextSibling;
        // 이미 그 자리면 아무것도 하지 않음(불필요한 재배치가 떨림의 절반 이상 원인이었음)
        if (blockDragEl.nextSibling === desiredNext) return;
        const now = Date.now();
        if (now - lastBlockReorderAt < REORDER_THROTTLE_MS) return;
        if (lastBlockReorderPoint && Math.hypot(
            point.clientX - lastBlockReorderPoint.x,
            point.clientY - lastBlockReorderPoint.y
        ) < REORDER_RELEASE_DISTANCE) return;
        lastBlockReorderAt = now;
        lastBlockReorderPoint = { x: point.clientX, y: point.clientY };
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
        if (!window.isOrderMode && !window.isRememberSelectMode && !window.isDeleteGroupMode && !window.isHideGroupMode) return;

        const modal = document.getElementById("workModal");
        if (!modal || !modal.contains(e.target)) return;

        // 숨기기 모드: 데이터와 내보내기 컬럼은 유지하고 작업일지 작성 화면에서만 숨김/복원한다.
        if (window.isHideGroupMode) {
            const groupEl = e.target.closest("#workDragContainer > .drag-item[data-group-ref]");
            const groupId = groupEl?.dataset.groupRef;
            if (groupEl && groupId) {
                e.preventDefault();
                e.stopPropagation();
                const g = window.getGroupById?.(groupId);
                if (g) {
                    g.hiddenInWork = !g.hiddenInWork;
                    window.markDirty?.("master", "groups", "upsert");
                    window.saveLocal?.("group-visibility");
                    window.refreshWorkGroupVisibility?.();
                    if (navigator.vibrate) navigator.vibrate(20);
                }
            }
            return;
        }

        // 삭제 모드: 편집모드를 나갈 때까지 유지되며, 탭한 커스텀 그룹을 바로 삭제한다.
        if (window.isDeleteGroupMode) {
            const groupEl = e.target.closest("#workDragContainer > .drag-item[data-group-ref]");
            if (groupEl) {
                e.preventDefault();
                e.stopPropagation();
                deleteGroupBlock(groupEl);
            }
            return;
        }

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

        // 삭제 의미를 명확히 하기 위해 기존 일지/휴지통의 해당 커스텀 그룹 값과
        // 집계 제외 참조도 함께 정리한다. group-delete 저장은 전체 스냅샷으로 동기화된다.
        [...(window.logs || []), ...(window.trash || [])].forEach(log => {
            if (log?.customGroups && Object.prototype.hasOwnProperty.call(log.customGroups, groupId)) {
                delete log.customGroups[groupId];
                log.updatedAt = new Date().toISOString();
            }
            if (Array.isArray(log?.excludedGroups)) {
                log.excludedGroups = log.excludedGroups.filter(id => id !== groupId);
            }
        });
        if (window.activeCustomGroupSelections) delete window.activeCustomGroupSelections[groupId];

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
        window.markDirty?.('master', 'uiSettings', 'upsert');
        window.scheduleSync?.();
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
            window.isDeleteGroupMode = false;
            window.isHideGroupMode = false;
            window.isOrderMode = false;
            window.isRememberSelectMode = false;
            document.getElementById("workLayoutUngroupBtn")?.classList.remove("active-btn");
            document.getElementById("workLayoutHideBtn")?.classList.remove("active-btn");
            document.getElementById("workLayoutOrderBtn")?.classList.remove("active-btn");
            document.getElementById("workRememberModeBtn")?.classList.remove("active-btn");
            document.getElementById("workModal")?.classList.remove("order-mode", "delete-group-mode", "hide-group-mode");
        }

        modal?.classList.toggle("layout-edit-mode", window.isWorkLayoutMode);
        titlebar?.classList.toggle("is-layout-edit", window.isWorkLayoutMode);
        window.applyCustomTitles?.();
        window.refreshWorkGroupVisibility?.();
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
        groupEl.dataset.customGroup = "1";
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
        // 그룹 정의(wm_groups)와 레이아웃 위치를 동시에 영구 저장하고 서버 동기화를 예약한다.
        if (window.saveLocal) window.saveLocal("group-add");
    };

    window.isDeleteGroupMode = false;
    window.toggleDeleteGroupMode = () => {
        if (!window.isWorkLayoutMode) {
            alert("레이아웃 편집 모드에서 사용하세요.");
            return;
        }
        window.isDeleteGroupMode = !window.isDeleteGroupMode;
        if (window.isDeleteGroupMode) {
            window.isOrderMode = false;
            window.isRememberSelectMode = false;
            window.isHideGroupMode = false;
        }
        deselectBlock();
        document.getElementById("workLayoutUngroupBtn")?.classList.toggle("active-btn", window.isDeleteGroupMode);
        document.getElementById("workLayoutOrderBtn")?.classList.toggle("active-btn", window.isOrderMode);
        document.getElementById("workRememberModeBtn")?.classList.toggle("active-btn", window.isRememberSelectMode);
        document.getElementById("workLayoutHideBtn")?.classList.toggle("active-btn", window.isHideGroupMode);
        document.getElementById("workModal")?.classList.toggle("delete-group-mode", window.isDeleteGroupMode);
        document.getElementById("workModal")?.classList.toggle("hide-group-mode", window.isHideGroupMode);
    };

    // 이전 마크업/호출과의 호환
    window.ungroupSelectedBlock = window.toggleDeleteGroupMode;

    window.isHideGroupMode = false;
    window.toggleHideGroupMode = () => {
        if (!window.isWorkLayoutMode) return;
        window.isHideGroupMode = !window.isHideGroupMode;
        if (window.isHideGroupMode) {
            window.isOrderMode = false;
            window.isRememberSelectMode = false;
            window.isDeleteGroupMode = false;
        }
        deselectBlock();
        document.getElementById("workLayoutHideBtn")?.classList.toggle("active-btn", window.isHideGroupMode);
        document.getElementById("workLayoutUngroupBtn")?.classList.toggle("active-btn", window.isDeleteGroupMode);
        document.getElementById("workLayoutOrderBtn")?.classList.toggle("active-btn", window.isOrderMode);
        document.getElementById("workRememberModeBtn")?.classList.toggle("active-btn", window.isRememberSelectMode);
        document.getElementById("workModal")?.classList.toggle("hide-group-mode", window.isHideGroupMode);
        window.refreshWorkGroupVisibility?.();
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
        if (window.isOrderMode) {
            window.isRememberSelectMode = false;
            window.isDeleteGroupMode = false;
            window.isHideGroupMode = false;
        }
        deselectBlock();
        document.getElementById("workLayoutOrderBtn")?.classList.toggle("active-btn", window.isOrderMode);
        document.getElementById("workLayoutUngroupBtn")?.classList.toggle("active-btn", window.isDeleteGroupMode);
        document.getElementById("workLayoutHideBtn")?.classList.toggle("active-btn", window.isHideGroupMode);
        document.getElementById("workModal")?.classList.toggle("order-mode", window.isOrderMode);
        document.getElementById("workModal")?.classList.toggle("delete-group-mode", window.isDeleteGroupMode);
        document.getElementById("workModal")?.classList.toggle("hide-group-mode", window.isHideGroupMode);
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
        if (window.isRememberSelectMode) {
            window.isOrderMode = false;
            window.isDeleteGroupMode = false;
            window.isHideGroupMode = false;
        }
        deselectBlock();
        document.getElementById("workLayoutOrderBtn")?.classList.toggle("active-btn", window.isOrderMode);
        document.getElementById("workLayoutUngroupBtn")?.classList.toggle("active-btn", window.isDeleteGroupMode);
        document.getElementById("workLayoutHideBtn")?.classList.toggle("active-btn", window.isHideGroupMode);
        document.getElementById("workModal")?.classList.toggle("order-mode", window.isOrderMode);
        document.getElementById("workModal")?.classList.toggle("delete-group-mode", window.isDeleteGroupMode);
        document.getElementById("workModal")?.classList.toggle("hide-group-mode", window.isHideGroupMode);
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

    window.refreshWorkGroupVisibility = () => {
        const editingLayout = !!window.isWorkLayoutMode;
        document.querySelectorAll("#workDragContainer > .drag-item[data-group-ref]").forEach(el => {
            const g = window.getGroupById?.(el.dataset.groupRef);
            const hidden = !!g?.hiddenInWork;
            el.classList.toggle("is-hidden-in-work", hidden);
            el.style.display = hidden && !editingLayout ? "none" : "";
        });
    };

    // ═══════════════════════════════════════════
    // ─── 통합 검색: groups 기반 동적 3열 필터 + 롱탭 편집 ───
    const searchTypeLabels = {
        taskTypes: '작업유형', coworkers: '매니저', statuses: '상태',
        equipments: '장비', memoTags: '태그'
    };
    const searchableGroups = () => (window.getAllGroupsSorted?.() || window.groups || [])
        .filter(g => g && g.id !== 'duration')
        .sort((a, b) => Number(a.searchOrder ?? a.order ?? 999) - Number(b.searchOrder ?? b.order ?? 999));
    const groupSearchValue = (log, groupId) => window.getGroupValueFromLog?.(log, groupId);
    const groupSearchNames = (log, groupId) => {
        const value = groupSearchValue(log, groupId);
        const names = new Set();
        if (groupId === 'equipments') {
            Object.entries(value || {}).forEach(([name, qty]) => {
                if (Number(qty || 0) > 0) names.add(name);
            });
        } else if (Array.isArray(value)) {
            value.filter(Boolean).forEach(name => names.add(String(name)));
        } else if (value) {
            names.add(String(value));
        }
        Object.entries(log?.tagQuantities?.[groupId] || {}).forEach(([name, qty]) => {
            if (Number(qty || 0) > 0) names.add(name);
        });
        return [...names];
    };
    const groupHasSearchValue = (log, groupId, name) => {
        return groupSearchNames(log, groupId).includes(String(name));
    };
    const searchOptionCount = (logs, groupId, name) =>
        (logs || []).reduce((n, log) => n + (groupHasSearchValue(log, groupId, name) ? 1 : 0), 0);
    const searchSelectId = id => `searchGroup_${String(id).replace(/[^a-zA-Z0-9_-]/g, '_')}`;

    window.isSearchEditMode = false;
    window.isSearchOrderMode = false;
    window.selectedSearchGroupIds = new Set();
    window.renderDynamicSearchFilters = (targetMonth = null) => {
        const grid = document.getElementById('searchFilterGrid');
        if (!grid) return;
        const logs = targetMonth
            ? (window.logs || []).filter(l => Number(l.m) === Number(targetMonth))
            : (window.logs || []);
        const oldValues = {};
        grid.querySelectorAll('select[data-search-group]').forEach(el => { oldValues[el.dataset.searchGroup] = el.value; });
        const fixedValues = {
            searchOX: document.getElementById('searchOX')?.value || '',
            searchOT: document.getElementById('searchOT')?.value || '',
            searchDuty: document.getElementById('searchDuty')?.value || ''
        };
        const groups = searchableGroups().filter(g => window.isSearchEditMode || (!g.searchExcluded && !g.searchHidden));
        grid.innerHTML = groups.map(g => {
            const value = oldValues[g.id] || '';
            const title = g.title || searchTypeLabels[g.id] || '선택태그';
            const state = `${g.searchExcluded ? ' is-search-excluded' : ''}${g.searchHidden ? ' is-search-hidden' : ''}${window.selectedSearchGroupIds.has(g.id) ? ' is-search-selected' : ''}`;
            const optionNames = new Set((g.tags || []).map(tag => tag?.name).filter(Boolean));
            logs.forEach(log => groupSearchNames(log, g.id).forEach(name => optionNames.add(name)));
            const options = [...optionNames].map(name => {
                const count = searchOptionCount(logs, g.id, name);
                return `<option value="${esc(name)}" ${value === name ? 'selected' : ''}>[${count}] ${esc(name)}</option>`;
            }).join('');
            return `<div class="search-filter-cell${state}" data-search-group="${esc(g.id)}"><span class="search-order-handle">⠿</span>
                <select id="${searchSelectId(g.id)}" data-search-group="${esc(g.id)}" class="m-input w95-in search-group-select" onchange="window.handleSelectChange(this)">
                    <option value="">[ ${esc(title)} ]</option>${options}
                </select></div>`;
        }).join('') + `<div class="search-filter-cell search-fixed-filter">
            <select id="searchOX" class="m-input w95-in" onchange="window.handleSelectChange(this)">
                <option value="">[ O/X ]</option><option value="O">O 표시</option><option value="X">X 표시</option>
            </select></div><div class="search-filter-cell search-fixed-filter">
            <select id="searchOT" class="m-input w95-in" onchange="window.handleSelectChange(this)">
                <option value="">[ OT ]</option><option value="yes">OT 있음</option><option value="no">OT 없음</option>
            </select></div><div class="search-filter-cell search-fixed-filter">
            <select id="searchDuty" class="m-input w95-in" onchange="window.handleSelectChange(this)">
                <option value="">[ 당직 ]</option><option value="yes">당직 있음</option><option value="no">당직 없음</option>
            </select></div>`;
        Object.entries(fixedValues).forEach(([id, value]) => { const el = document.getElementById(id); if (el) el.value = value; });
    };
    window.updateSearchFilters = (targetMonth = null) => window.renderDynamicSearchFilters(targetMonth);

    const persistSearchLayout = () => {
        const grid = document.getElementById('searchFilterGrid');
        if (!grid) return;
        [...grid.querySelectorAll('.search-filter-cell[data-search-group]')].forEach((cell, index) => {
            const g = window.getGroupById?.(cell.dataset.searchGroup);
            if (g) g.searchOrder = index;
        });
        window.markDirty?.('master', 'groups', 'upsert');
        window.saveLocal?.('search-layout');
    };
    window.toggleSelectedSearchOption = mode => {
        if (window.isSearchOrderMode) return;
        const selected = [...window.selectedSearchGroupIds]
            .map(id => window.getGroupById?.(id)).filter(Boolean);
        if (!selected.length) return alert('먼저 검색 칸을 하나 이상 선택하세요.');
        const key = mode === 'excluded' ? 'searchExcluded' : 'searchHidden';
        const next = !selected.every(g => g[key] === true);
        selected.forEach(g => {
            g[key] = next;
            // 한 칸이 두 상태가 되어 색 의미가 흐려지지 않도록 켤 때는 반대 상태를 해제한다.
            if (next && key === 'searchExcluded') g.searchHidden = false;
            if (next && key === 'searchHidden') g.searchExcluded = false;
        });
        persistSearchLayout();
        const month = Number(document.getElementById('searchMonth')?.value) || null;
        window.renderDynamicSearchFilters(month);
    };
    window.setSearchEditMode = on => {
        window.isSearchEditMode = !!on;
        window.isSearchOrderMode = false;
        window.selectedSearchGroupIds.clear();
        document.getElementById('searchLayer')?.classList.toggle('is-search-edit', !!on);
        document.getElementById('searchLayer')?.classList.remove('is-search-order');
        document.getElementById('searchOrderBtn')?.classList.remove('active-btn');
        const month = Number(document.getElementById('searchMonth')?.value) || null;
        window.renderDynamicSearchFilters(month);
    };
    window.toggleSearchOrderMode = () => {
        if (!window.isSearchEditMode) return;
        window.isSearchOrderMode = !window.isSearchOrderMode;
        window.selectedSearchGroupIds.clear();
        document.getElementById('searchLayer')?.classList.toggle('is-search-order', window.isSearchOrderMode);
        document.getElementById('searchOrderBtn')?.classList.toggle('active-btn', window.isSearchOrderMode);
        const month = Number(document.getElementById('searchMonth')?.value) || null;
        window.renderDynamicSearchFilters(month);
    };
    let searchResetTimer = null, searchResetLong = false, searchResetStart = null;
    window.startSearchResetPress = event => {
        event?.preventDefault(); searchResetLong = false;
        searchResetStart = { x: event.clientX, y: event.clientY };
        clearTimeout(searchResetTimer);
        searchResetTimer = setTimeout(() => {
            searchResetLong = true;
            window.setSearchEditMode(!window.isSearchEditMode);
            navigator.vibrate?.(35);
        }, 700);
    };
    window.moveSearchResetPress = event => {
        if (searchResetStart && Math.hypot(event.clientX - searchResetStart.x, event.clientY - searchResetStart.y) > 14) {
            clearTimeout(searchResetTimer);
        }
    };
    window.cancelSearchResetPress = () => { clearTimeout(searchResetTimer); searchResetStart = null; };
    window.endSearchResetPress = event => {
        event?.preventDefault(); clearTimeout(searchResetTimer); searchResetStart = null;
        if (!searchResetLong) {
            if (window.isSearchEditMode) {
                persistSearchLayout();
                window.setSearchEditMode(false);
            } else window.resetSearchInput?.();
        }
        searchResetLong = false;
    };

    let searchDragCell = null, lastSearchMove = 0;
    const searchGrid = document.getElementById('searchFilterGrid');
    searchGrid?.addEventListener('pointerdown', event => {
        if (!window.isSearchEditMode) return;
        const cell = event.target.closest('.search-filter-cell[data-search-group]');
        if (!cell) return;
        event.preventDefault();
        if (window.isSearchOrderMode) {
            searchDragCell = cell; lastSearchMove = 0;
            cell.setPointerCapture?.(event.pointerId);
            return;
        }
        const id = cell.dataset.searchGroup;
        if (window.selectedSearchGroupIds.has(id)) window.selectedSearchGroupIds.delete(id);
        else window.selectedSearchGroupIds.add(id);
        cell.classList.toggle('is-search-selected', window.selectedSearchGroupIds.has(id));
    });
    searchGrid?.addEventListener('pointermove', event => {
        if (!window.isSearchEditMode || !window.isSearchOrderMode || !searchDragCell) return;
        event.preventDefault();
        if (Date.now() - lastSearchMove < 180) return;
        const over = document.elementFromPoint(event.clientX, event.clientY);
        const target = over?.closest('.search-filter-cell[data-search-group]');
        if (!target || target === searchDragCell || target.parentElement !== searchGrid) return;
        const rect = target.getBoundingClientRect();
        const x = (event.clientX - rect.left) / Math.max(1, rect.width);
        const y = (event.clientY - rect.top) / Math.max(1, rect.height);
        if (x > .35 && x < .65 && y > .35 && y < .65) return;
        const before = y < .35 || (y <= .65 && x < .5);
        searchGrid.insertBefore(searchDragCell, before ? target : target.nextSibling);
        lastSearchMove = Date.now();
    });
    const endSearchDrag = () => { if (searchDragCell) persistSearchLayout(); searchDragCell = null; };
    searchGrid?.addEventListener('pointerup', endSearchDrag);
    searchGrid?.addEventListener('pointercancel', endSearchDrag);

    const closeSearchBase = window.closeSearch;
    window.closeSearch = () => {
        if (window.isSearchEditMode) window.setSearchEditMode(false);
        closeSearchBase?.();
    };

    window.removeFilter = selectId => {
        const el = document.getElementById(selectId); if (el) el.value = '';
        if (selectId === 'searchMonth') window.updateSearchFilters(null);
        window.doSearch();
    };
    const flattenSearchValues = value => {
        if (value == null) return [];
        if (Array.isArray(value)) return value.flatMap(flattenSearchValues);
        if (typeof value === 'object') {
            return Object.entries(value).flatMap(([key, child]) => [key, ...flattenSearchValues(child)]);
        }
        return [String(value)];
    };
    const buildLogKeywordText = log => {
        const dateTokens = log?.y && log?.m && log?.d
            ? [
                `${log.y}-${String(log.m).padStart(2, '0')}-${String(log.d).padStart(2, '0')}`,
                `${log.y}${String(log.m).padStart(2, '0')}${String(log.d).padStart(2, '0')}`,
                `${log.m}월 ${log.d}일`
            ]
            : [];
        return [
            log?.memo, log?.content, log?.note, log?.taskNo, log?.address, log?.customerName,
            log?.commuteNote, log?.taskType, log?.status, log?.workTime, log?.startTime, log?.endTime,
            log?.personalCheck, ...dateTokens,
            ...(Number(log?.otCount || 0) > 0 ? ['OT', `OT ${log.otCount}`] : []),
            ...(log?.isDuty || log?.isDutyLog || log?.cat === 'duty' ? ['당직'] : []),
            ...flattenSearchValues(log?.coworkers),
            ...flattenSearchValues(log?.tags),
            ...flattenSearchValues(log?.equips),
            ...flattenSearchValues(log?.customGroups),
            ...flattenSearchValues(log?.tagQuantities),
            ...(log?.imgs || []).map(image => image?.originalName || '')
        ].filter(Boolean).join(' ').toLowerCase();
    };
    window.doSearch = () => {
        if (window.isSearchEditMode) return;
        const keyword = (document.getElementById('searchInput')?.value || '').trim().toLowerCase();
        const monthValue = document.getElementById('searchMonth')?.value || '';
        const ox = document.getElementById('searchOX')?.value || '';
        const ot = document.getElementById('searchOT')?.value || '';
        const duty = document.getElementById('searchDuty')?.value || '';
        const selections = [...document.querySelectorAll('#searchFilterGrid select[data-search-group]')]
            .filter(el => el.value).map(el => ({ groupId: el.dataset.searchGroup, value: el.value, id: el.id }));
        const filtersArea = document.getElementById('activeFiltersArea');
        const chips = [];
        if (monthValue) chips.push(`<button class="w95-btn" onclick="window.removeFilter('searchMonth')">${monthValue}월 ×</button>`);
        selections.forEach(s => chips.push(`<button class="w95-btn" onclick="window.removeFilter('${s.id}')">${esc(s.value)} ×</button>`));
        if (ox) chips.push(`<button class="w95-btn" onclick="window.removeFilter('searchOX')">${ox} ×</button>`);
        if (ot) chips.push(`<button class="w95-btn" onclick="window.removeFilter('searchOT')">OT ${ot === 'yes' ? '있음' : '없음'} ×</button>`);
        if (duty) chips.push(`<button class="w95-btn" onclick="window.removeFilter('searchDuty')">당직 ${duty === 'yes' ? '있음' : '없음'} ×</button>`);
        filtersArea.innerHTML = chips.join('');
        const resultList = document.getElementById('searchResultList');
        const summary = document.getElementById('searchSummary');
        if (!keyword && !monthValue && !ox && !ot && !duty && !selections.length) { resultList.innerHTML = ''; summary.style.display = 'none'; return; }
        const results = (window.logs || []).filter(log => {
            const keywordText = buildLogKeywordText(log);
            return (!keyword || keywordText.includes(keyword)) &&
                (!monthValue || Number(log.m) === Number(monthValue)) &&
                (!ox || log.personalCheck === ox) &&
                (!ot || (Number(log.otCount || 0) > 0) === (ot === 'yes')) &&
                (!duty || !!(log.isDuty || log.isDutyLog || log.cat === 'duty') === (duty === 'yes')) &&
                selections.every(s => groupHasSearchValue(log, s.groupId, s.value));
        });
        const perDay = {};
        (window.logs || []).filter(l => l?.cat === 'work').forEach(log => {
            const key = `${log.y}-${log.m}-${log.d}`; perDay[key] = perDay[key] || [];
            perDay[key].push(log);
        });
        resultList.innerHTML = results.map(log => {
            const key = `${log.y}-${log.m}-${log.d}`;
            const index = log.cat === 'work' ? (perDay[key] || []).findIndex(x => String(x.id) === String(log.id)) + 1 : '';
            return window.getLogCardHtml(log, index || '');
        }).join('');
        summary.textContent = results.length ? `총 ${results.length}건 검색됨` : '조건에 맞는 기록이 없습니다.';
        summary.style.display = 'block';
    };

    // ─── 카드 다중 선택 / 읽기 쉬운 텍스트 복사 / 시스템 공유(카카오톡 포함) ───
    window.selectedCardLogIds = new Set();
    window.isCardSelectionMode = false;
    const ensureCardSelectionBar = () => {
        let bar = document.getElementById('cardMultiSelectBar');
        if (bar) return bar;
        bar = document.createElement('div');
        bar.id = 'cardMultiSelectBar';
        bar.className = 'card-multi-select-bar w95-window';
        bar.innerHTML = `<b id="cardMultiCount">0개 선택</b>
            <button type="button" class="w95-btn" onclick="window.copySelectedCards()">복사</button>
            <button type="button" class="w95-btn" onclick="window.shareSelectedCards()">공유</button>
            <button type="button" class="w95-btn" onclick="window.closeCardSelectionMode()">취소</button>`;
        document.body.appendChild(bar);
        return bar;
    };
    const paintCardSelection = () => {
        document.querySelectorAll('.log-card[data-log-id]').forEach(card => {
            card.classList.toggle('is-card-multi-selected', window.selectedCardLogIds.has(String(card.dataset.logId)));
        });
        const bar = ensureCardSelectionBar();
        bar.style.display = window.isCardSelectionMode ? 'flex' : 'none';
        const count = document.getElementById('cardMultiCount');
        if (count) count.textContent = `${window.selectedCardLogIds.size}개 선택`;
    };
    const toggleCardSelection = id => {
        const key = String(id);
        if (window.selectedCardLogIds.has(key)) window.selectedCardLogIds.delete(key);
        else window.selectedCardLogIds.add(key);
        paintCardSelection();
    };
    window.closeCardSelectionMode = () => {
        window.isCardSelectionMode = false;
        window.selectedCardLogIds.clear();
        paintCardSelection();
    };
    const selectedCardLogs = () => (window.logs || []).filter(log => window.selectedCardLogIds.has(String(log.id)))
        .sort((a, b) => `${a.y}-${String(a.m).padStart(2,'0')}-${String(a.d).padStart(2,'0')}-${a.workTime || a.time || ''}`
            .localeCompare(`${b.y}-${String(b.m).padStart(2,'0')}-${String(b.d).padStart(2,'0')}-${b.workTime || b.time || ''}`));
    const readableCardText = log => {
        const category = { work:'작업일지', memo:'메모', photo:'사진', commute_in:'출근', commute_out:'퇴근' }[log.cat] || '기록';
        const lines = [`[ ${log.y}년 ${log.m}월 ${log.d}일 · ${category} ]`];
        const add = (label, value) => { if (value !== undefined && value !== null && String(value).trim()) lines.push(`• ${label}:  ( ${value} )`); };
        add('시간', log.workTime || log.time || log.inTime || log.outTime);
        add('작업유형', log.taskType);
        add('상태', log.status);
        add('Task 번호', log.taskNo);
        add('고객명', log.customerName);
        add('주소', log.address);
        add('내용', log.content || log.memo || log.commuteNote);
        if (log.equips) add('장비', Object.entries(log.equips).filter(([,n]) => Number(n) > 0)
            .map(([name,n]) => Number(n) > 1 ? `${name} × ${n}` : name).join(', '));
        add('매니저', (log.coworkers || []).join(', '));
        add('태그', (log.tags || []).join(', '));
        searchableGroups().filter(g => !['taskTypes','coworkers','statuses','equipments','memoTags','duration'].includes(g.id)).forEach(g => {
            const value = log.customGroups?.[g.id];
            add(g.title || '선택태그', Array.isArray(value) ? value.join(', ') : value);
        });
        if (Array.isArray(log.excludedGroups) && log.excludedGroups.length) lines.push('• 집계 제외 항목 있음');
        return lines.join('\n');
    };
    window.getSelectedCardsText = () => selectedCardLogs().map(readableCardText)
        .join('\n\n━━━━━━━━━━━━━━━━━━━━\n\n');
    const writeClipboard = async textValue => {
        if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(textValue);
        const area = document.createElement('textarea');
        area.value = textValue; area.style.position = 'fixed'; area.style.opacity = '0';
        document.body.appendChild(area); area.select(); document.execCommand('copy'); area.remove();
    };
    window.copySelectedCards = async () => {
        const textValue = window.getSelectedCardsText();
        if (!textValue) return alert('복사할 카드를 선택하세요.');
        try { await writeClipboard(textValue); alert(`${window.selectedCardLogIds.size}개 카드를 복사했습니다.`); }
        catch (error) { alert('복사하지 못했습니다. 브라우저의 클립보드 권한을 확인하세요.'); }
    };
    window.shareSelectedCards = async () => {
        const textValue = window.getSelectedCardsText();
        if (!textValue) return alert('공유할 카드를 선택하세요.');
        if (navigator.share) {
            try { await navigator.share({ title:'작업일지', text:textValue }); return; }
            catch (error) { if (error?.name === 'AbortError') return; }
        }
        await window.copySelectedCards();
        alert('공유 기능을 지원하지 않아 복사했습니다. 카카오톡 대화창에 붙여 넣어 주세요.');
    };
    let cardPressTimer = null, cardPressStart = null, cardPressTarget = null, suppressNextCardClick = false;
    document.addEventListener('pointerdown', event => {
        if (event.target.closest('button,a,input,select,textarea,.log-img-list,.task-no-btn,#cardMultiSelectBar')) return;
        const card = event.target.closest('.log-card[data-log-id]');
        if (!card) return;
        cardPressTarget = card;
        cardPressStart = { x:event.clientX, y:event.clientY };
        clearTimeout(cardPressTimer);
        cardPressTimer = setTimeout(() => {
            window.isCardSelectionMode = true;
            suppressNextCardClick = true;
            toggleCardSelection(card.dataset.logId);
            navigator.vibrate?.(35);
        }, 650);
    });
    document.addEventListener('pointermove', event => {
        if (cardPressStart && Math.hypot(event.clientX-cardPressStart.x, event.clientY-cardPressStart.y) > 14) clearTimeout(cardPressTimer);
    });
    const cancelCardPress = () => { clearTimeout(cardPressTimer); cardPressStart = null; cardPressTarget = null; };
    document.addEventListener('pointerup', cancelCardPress);
    document.addEventListener('pointercancel', cancelCardPress);
    document.addEventListener('click', event => {
        const card = event.target.closest('.log-card[data-log-id]');
        if (!card || !window.isCardSelectionMode || event.target.closest('button,.task-no-btn,#cardMultiSelectBar')) return;
        event.preventDefault(); event.stopImmediatePropagation();
        if (suppressNextCardClick) { suppressNextCardClick = false; return; }
        toggleCardSelection(card.dataset.logId);
    }, true);

    // ─── 뒤로가기 보호 / 외부 지도 앱 복귀 ───
    window.showWorkNavigationToast = message => {
        let toast = document.getElementById('workNavigationToast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'workNavigationToast';
            toast.style.cssText = 'position:fixed;left:50%;bottom:84px;transform:translateX(-50%);z-index:10000;background:#000080;color:#fff;border:2px solid #fff;box-shadow:2px 2px 0 #000;padding:8px 12px;font-weight:900;font-size:.82rem;white-space:nowrap;pointer-events:none;';
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.style.display = 'block';
        clearTimeout(window.workNavigationToastTimer);
        window.workNavigationToastTimer = setTimeout(() => { toast.style.display = 'none'; }, 1800);
    };

    let externalLaunch = null;
    const finishExternalLaunch = () => {
        if (!externalLaunch || Date.now() - externalLaunch.startedAt < 350) return;
        externalLaunch.frame?.remove();
        externalLaunch = null;
        window.hideLoading?.();
        window.closeMapAppModal?.();
    };
    window.launchWorkExternalApp = (schemeUrl, fallbackUrl = '', appType = '') => {
        window.hideLoading?.();
        window.closeMapAppModal?.();
        externalLaunch?.frame?.remove();
        const frame = document.createElement('iframe');
        frame.setAttribute('aria-hidden', 'true');
        frame.style.cssText = 'position:fixed;width:1px;height:1px;left:-9999px;top:-9999px;border:0;opacity:0;';
        externalLaunch = { startedAt: Date.now(), frame, hidden: false, appType };
        document.body.appendChild(frame);
        frame.src = schemeUrl;
        setTimeout(() => {
            if (!externalLaunch || externalLaunch.frame !== frame) return;
            if (!externalLaunch.hidden && fallbackUrl) {
                const fallbackWindow = window.open(fallbackUrl, '_blank', 'noopener');
                if (!fallbackWindow) window.showWorkNavigationToast('지도 앱이 없으면 카카오맵 웹을 새 탭에서 열어주세요.');
            }
            setTimeout(finishExternalLaunch, 800);
        }, 1500);
    };
    document.addEventListener('visibilitychange', () => {
        if (!externalLaunch) return;
        if (document.hidden) externalLaunch.hidden = true;
        else finishExternalLaunch();
    });
    window.addEventListener('focus', finishExternalLaunch);
    window.addEventListener('pageshow', finishExternalLaunch);

    const closeTopWorkLayer = () => {
        const visible = id => {
            const el = document.getElementById(id);
            return el && getComputedStyle(el).display !== 'none';
        };
        const actions = [
            ['imageViewer', () => window.closeImageViewer?.()],
            ['durationTimeEditModal', () => window.closeDurationTimeEditModal?.()],
            ['titleEditModal', () => { document.getElementById('titleEditModal').style.display = 'none'; }],
            ['tagRestoreModal', () => window.closeTagRestoreModal?.()],
            ['tagEditModal', () => window.closeTagEditModal?.()],
            ['mapAppModal', () => window.closeMapAppModal?.()],
            ['commuteModal', () => window.closeCommuteModal?.()],
            ['editModal', () => window.closeEditModal?.()],
            ['searchLayer', () => window.closeSearch?.()],
            ['trashLayer', () => window.closeTrash?.()],
            ['popupLayer', () => window.closePop?.()]
        ];
        const match = actions.find(([id]) => visible(id));
        if (!match) return false;
        match[1]();
        return true;
    };

    let allowWorkExit = false;
    let workExitArmedUntil = 0;
    const armWorkHistoryGuard = () => {
        if (history.state?.workMasterGuard) return;
        history.replaceState({ ...(history.state || {}), workMasterRoot: true }, document.title);
        history.pushState({ workMasterGuard: true }, document.title);
    };
    armWorkHistoryGuard();
    window.addEventListener('popstate', () => {
        if (allowWorkExit) return;
        if (closeTopWorkLayer()) {
            history.pushState({ workMasterGuard: true }, document.title);
            window.showWorkNavigationToast('이전 화면으로 돌아왔습니다.');
            return;
        }
        const now = Date.now();
        if (now < workExitArmedUntil) {
            allowWorkExit = true;
            history.back();
            return;
        }
        workExitArmedUntil = now + 2200;
        history.pushState({ workMasterGuard: true }, document.title);
        window.showWorkNavigationToast('한 번 더 뒤로가면 워크를 종료합니다.');
    });
    window.addEventListener('beforeunload', event => {
        const workOpen = document.getElementById('workModal')?.style.display === 'flex';
        if (!allowWorkExit && (workOpen || window.hasDirtyChanges?.())) {
            event.preventDefault();
            event.returnValue = '';
        }
    });

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
        if (window.isWorkEditLocked && !window.isWorkLayoutMode) return;
        if (window.isWorkLayoutMode) {
            const [, type, index] = args;
            clearTimeout(window.pressTimer);
            window.isLongPress = false;
            window.pressTimer = setTimeout(() => {
                window.isLongPress = true;
                window.openTagEditBox?.(type, index);
                navigator.vibrate?.(30);
            }, 600);
            return;
        }
        return origStart?.(...args);
    };
    window.endPress = (...args) => {
        if (window.isWorkEditLocked && !window.isWorkLayoutMode) return;
        if (window.isWorkLayoutMode) {
            clearTimeout(window.pressTimer);
            window.isLongPress = false;
            return;
        }
        return origEnd?.(...args);
    };
    window.cancelPress = (...args) => {
        if (window.isWorkLayoutMode) {
            clearTimeout(window.pressTimer);
            window.isLongPress = false;
            return;
        }
        return origCancel?.(...args);
    };

    // 레이아웃 이동 이벤트가 태그의 기존 mousedown/touchstart를 선점하므로
    // 캡처 단계에서 태그 롱탭을 독립 처리한다. 짧은 탭 선택은 계속 잠근다.
    let layoutTagPressTimer = null;
    let layoutTagPressButton = null;
    let layoutTagPressStart = null;
    const clearLayoutTagPress = () => {
        clearTimeout(layoutTagPressTimer);
        layoutTagPressTimer = null;
        layoutTagPressButton = null;
        layoutTagPressStart = null;
    };
    const getLayoutTagTarget = button => {
        const groupId = button.closest('.drag-item[data-group-ref]')?.dataset.groupRef;
        const typeMap = { taskTypes:'task', coworkers:'coworker', equipments:'equip', statuses:'status', memoTags:'memoTag' };
        const type = button.dataset.tagType || typeMap[groupId] || groupId;
        const area = button.parentElement;
        const buttons = [...(area?.querySelectorAll(':scope > .layout-tag-button') || [])];
        const taggedIndex = Number(button.dataset.tagIndex);
        return { type, index:Number.isInteger(taggedIndex) && taggedIndex >= 0 ? taggedIndex : buttons.indexOf(button) };
    };
    document.addEventListener('pointerdown', event => {
        if (!window.isWorkLayoutMode) return;
        const button = event.target.closest('#workDragContainer .layout-tag-button');
        if (!button) return;
        event.preventDefault();
        event.stopPropagation();
        clearLayoutTagPress();
        layoutTagPressButton = button;
        layoutTagPressStart = { x:event.clientX, y:event.clientY };
        layoutTagPressTimer = setTimeout(() => {
            if (!layoutTagPressButton || !window.isWorkLayoutMode) return;
            const target = getLayoutTagTarget(layoutTagPressButton);
            if (target.type && target.index >= 0) {
                window.isLongPress = true;
                window.openTagEditBox?.(target.type, target.index);
                navigator.vibrate?.(35);
            }
            clearTimeout(layoutTagPressTimer);
            layoutTagPressTimer = null;
            layoutTagPressStart = null;
        }, 650);
    }, true);
    document.addEventListener('pointermove', event => {
        if (!layoutTagPressStart) return;
        if (Math.hypot(event.clientX - layoutTagPressStart.x, event.clientY - layoutTagPressStart.y) > 12) clearLayoutTagPress();
    }, true);
    document.addEventListener('pointerup', event => {
        if (!layoutTagPressButton) return;
        event.preventDefault();
        event.stopPropagation();
        clearLayoutTagPress();
    }, true);
    document.addEventListener('pointercancel', clearLayoutTagPress, true);
    document.addEventListener('click', event => {
        if (!window.isWorkLayoutMode || !event.target.closest('#workDragContainer .layout-tag-button')) return;
        event.preventDefault();
        event.stopImmediatePropagation();
    }, true);

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

    window.updateLegacySearchFilters = (targetMonth = null) => {
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
    window.openWorkTagQuantity = (type, index) => {
        const tag = getTagArray(type)[index];
        if (!tag) return;
        const groupId = window.typeToGroupId(type);
        if (!window.groupShowsCount(groupId)) return alert('편집모드에서 이 그룹의 갯수 옵션을 먼저 켜주세요.');
        window.activeWorkTagQuantities = window.activeWorkTagQuantities || {};
        window.activeWorkTagQuantities[groupId] = window.activeWorkTagQuantities[groupId] || {};
        if (groupId === 'taskTypes' && !(window.activeTaskTypes || []).includes(tag.name)) window.activeTaskTypes.push(tag.name);
        else if (groupId === 'coworkers' && !(window.selectedCoworkers || []).includes(tag.name)) window.selectedCoworkers.push(tag.name);
        else if (groupId === 'statuses') window.activeStatus = tag.name;
        else if (groupId === 'equipments') {
            window.activeEquips = window.activeEquips || {};
            if (Number(window.activeEquips[tag.name] || 0) < 1) window.activeEquips[tag.name] = 1;
        }
        else if (!['equipments','memoTags'].includes(groupId)) {
            window.activeCustomGroupSelections[groupId] = window.activeCustomGroupSelections[groupId] || [];
            if (!window.activeCustomGroupSelections[groupId].includes(tag.name)) window.activeCustomGroupSelections[groupId].push(tag.name);
        }
        let modal = document.getElementById('workTagQuantityModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'workTagQuantityModal';
            modal.className = 'modal-overlay';
            modal.style.zIndex = '2750';
            modal.innerHTML = `<div class="modal-box w95-window" style="max-width:240px"><div class="w95-titlebar"><span id="workQtyTitle">수량 입력</span><button type="button" class="w95-btn" onclick="window.closeWorkTagQuantity()">X</button></div><div class="work-qty-body"><button type="button" class="w95-btn" onclick="window.changeWorkTagQuantity(-1)">−</button><input id="workQtyInput" type="number" min="0" inputmode="numeric" class="m-input w95-in"><button type="button" class="w95-btn" onclick="window.changeWorkTagQuantity(1)">+</button></div></div>`;
            document.body.appendChild(modal);
        }
        window.editingWorkQuantity = { type, index, groupId, name:tag.name };
        document.getElementById('workQtyTitle').textContent = tag.name;
        const currentQty = groupId === 'equipments'
            ? Math.max(Number(window.activeEquips?.[tag.name] || 0), Number(window.activeWorkTagQuantities[groupId][tag.name] || 0), 1)
            : Number(window.activeWorkTagQuantities[groupId][tag.name] || 1);
        document.getElementById('workQtyInput').value = currentQty;
        modal.style.display = 'flex';
    };
    window.changeWorkTagQuantity = delta => {
        const input = document.getElementById('workQtyInput');
        if (input) input.value = Math.max(0, Number(input.value || 0) + delta);
    };
    window.closeWorkTagQuantity = () => {
        const edit = window.editingWorkQuantity;
        const input = document.getElementById('workQtyInput');
        if (edit && input) {
            const qty = Math.max(0, Number(input.value || 0));
            const store = window.activeWorkTagQuantities[edit.groupId];
            if (qty <= 1) delete store[edit.name]; else store[edit.name] = qty;
            if (edit.groupId === 'equipments') {
                window.activeEquips = window.activeEquips || {};
                if (qty > 0) window.activeEquips[edit.name] = qty;
                else delete window.activeEquips[edit.name];
            }
            if (qty === 0) {
                if (edit.groupId === 'taskTypes') window.activeTaskTypes = (window.activeTaskTypes || []).filter(name => name !== edit.name);
                else if (edit.groupId === 'coworkers') window.selectedCoworkers = (window.selectedCoworkers || []).filter(name => name !== edit.name);
                else if (edit.groupId === 'statuses' && window.activeStatus === edit.name) window.activeStatus = null;
                else if (window.activeCustomGroupSelections?.[edit.groupId]) window.activeCustomGroupSelections[edit.groupId] = window.activeCustomGroupSelections[edit.groupId].filter(name => name !== edit.name);
            }
            window.renderChangedTagType(edit.type);
        }
        document.getElementById('workTagQuantityModal').style.display = 'none';
        window.editingWorkQuantity = null;
    };
    window.handleLongPress = (type, index) => {
        if (window.isWorkLayoutMode) window.openTagEditBox(type, index);
        else window.openWorkTagQuantity(type, index);
    };

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
            window.activeEquips = window.activeEquips || {};
            const group = window.getGroupById?.("equipments");
            const selected = Number(window.activeEquips[tag.name] || 0) > 0;
            if (selected) {
                delete window.activeEquips[tag.name];
            } else {
                if (group?.selectionMode === "single") window.activeEquips = {};
                window.activeEquips[tag.name] = 1;
            }
        } else if (type === "memoTag") {
            window.toggleTagSelection("memoTag", tag.name);
        } else if (window.getGroupById?.(type)) {
            // 추가로 만든 선택태그상자도 기본 그룹과 동일하게 짧은 탭 선택 / 롱탭 편집을 지원한다.
            window.toggleCustomGroupTag(type, tag.name);
        }
        window.renderChangedTagType(type);
    };

    window.openTagEditBox = (type, index) => {
        const tag = getTagArray(type)[index];
        if (!tag) return;
        window.editingTagType = type;
        window.editingTagIndex = index;
        window.tempTagQty = Number(tag.count || 0);
        const input = document.getElementById("tagEditInput");
        const modal = document.getElementById("tagEditModal");
        if (!input || !modal) return;
        input.value = tag.name;
        modal.style.display = "flex";
        document.getElementById('tagColorPickerPanel')?.classList.remove('is-open');
        window.refreshTagEditControls();
        setTimeout(() => input.select(), 80);
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
        const numberBtn = document.getElementById("tagShowCountBtn");
        const monthlyBtn = document.getElementById("tagMonthlyBtn");
        const countBtn = document.getElementById("tagCountSuffixBtn");
        const cardDisplayBtn = document.getElementById("tagCardDisplayBtn");
        const cardColorBtn = document.getElementById("tagCardColorBtn");
        const cardColorInput = document.getElementById("tagCardColorInput");
        const dupBtn = document.getElementById("tagDuplicateBtn");
        const groupId = window.typeToGroupId(window.editingTagType);
        const editingTag = getTagArray(window.editingTagType)?.[window.editingTagIndex];
        const paintToggle = (button, on, label, available = true, hint = '') => {
            if (!button) return;
            button.disabled = !available;
            button.style.opacity = available ? '1' : '0.42';
            button.className = `w95-btn tag-toggle-btn ${on && available ? "is-on" : "is-off"}`;
            button.innerText = `${on && available ? '✓' : '□'} ${label}`;
            button.setAttribute('aria-pressed', on && available ? 'true' : 'false');
            button.title = hint || `${label} ${on ? '켜짐' : '꺼짐'}`;
        };
        paintToggle(numberBtn, window.groupShowsNumber(groupId), '숫자', true, '태그 앞에 이번 달 집계 숫자를 표시');
        paintToggle(monthlyBtn, window.groupIncludesMonthly(groupId), '월별', true, '이 그룹을 월별 집계에 포함');
        paintToggle(countBtn, window.groupShowsCount(groupId), '갯수', true,
            '현재 작업일지에서 입력한 수량이 2 이상일 때 표시');
        paintToggle(cardDisplayBtn, !!editingTag?.cardCountVisible, '카드', true,
            '월별 또는 작업 수량이 2 이상일 때 카드에 이름(2) 형식으로 표시');
        if (cardColorBtn && cardColorInput) {
            const savedColor = /^#[0-9a-f]{6}$/i.test(editingTag?.cardColor || '') ? editingTag.cardColor : '#334155';
            cardColorInput.value = savedColor;
            cardColorBtn.style.setProperty('--tag-edit-color', savedColor);
            cardColorBtn.classList.toggle('has-card-color', !!editingTag?.cardColor);
            cardColorBtn.title = '이 항목이 선택된 작업 카드의 기본 배경색 변경';
        }
        if (dupBtn) {
            const toggleable = canToggleSelectionMode(groupId);
            const g = window.getGroupById(groupId);
            paintToggle(dupBtn, !!g && g.selectionMode === "multi", '중복', toggleable,
                toggleable ? '한 그룹에서 여러 항목을 동시에 선택' : '이 그룹은 단일값 또는 수량 방식이라 중복 선택을 지원하지 않음');
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
        if (window.saveLocal) window.saveLocal("group-settings");
        window.renderChangedTagType(window.editingTagType);
    };

    // 수량(+/-)은 태그 하나만의 값이라 즉시 반영 + 바로 저장
    window.changeTagQty = (delta) => {
        const type = window.editingTagType;
        const tag = getTagArray(type)[window.editingTagIndex];
        if (!tag) return;
        window.tempTagQty = Math.max(0, Number(window.tempTagQty || 0) + delta);
        tag.count = window.tempTagQty;
        window.refreshTagEditControls();
        window.markDirty?.("master", "groups", "upsert");
        if (window.saveLocal) window.saveLocal("group-settings");
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
        if (window.saveLocal) window.saveLocal("group-settings");
        window.renderChangedTagType(window.editingTagType);
    };

    window.toggleTagMonthly = () => {
        const groupId = window.typeToGroupId(window.editingTagType);
        const g = window.getGroupById(groupId);
        if (!g) return;
        g.includeMonthly = !window.groupIncludesMonthly(groupId);
        window.refreshTagEditControls();
        window.markDirty?.("master", "groups", "upsert");
        if (window.saveLocal) window.saveLocal("group-settings");
        window.renderChangedTagType(window.editingTagType);
    };

    window.toggleTagShowQty = () => {
        const groupId = window.typeToGroupId(window.editingTagType);
        const g = window.getGroupById(groupId);
        if (!g) return;
        g.showCount = !window.groupShowsCount(groupId);
        window.refreshTagEditControls();
        window.markDirty?.("master", "groups", "upsert");
        if (window.saveLocal) window.saveLocal("group-settings");
        window.renderChangedTagType(window.editingTagType);
    };

    window.toggleTagCardDisplay = () => {
        const tag = getTagArray(window.editingTagType)?.[window.editingTagIndex];
        if (!tag) return;
        tag.cardCountVisible = !tag.cardCountVisible;
        window.refreshTagEditControls();
        window.markDirty?.("master", "groups", "upsert");
        if (window.saveLocal) window.saveLocal("group-settings");
        window.renderChangedTagType(window.editingTagType);
        window.renderMain?.();
    };

    window.toggleTagColorPicker = force => {
        const panel = document.getElementById('tagColorPickerPanel');
        if (!panel) return;
        const open = typeof force === 'boolean' ? force : !panel.classList.contains('is-open');
        panel.classList.toggle('is-open', open);
    };

    window.setTagCardColor = color => {
        const tag = getTagArray(window.editingTagType)?.[window.editingTagIndex];
        if (!tag || !/^#[0-9a-f]{6}$/i.test(color || '')) return;
        tag.cardColor = color;
        window.refreshTagEditControls();
        window.markDirty?.("master", "groups", "upsert");
        if (window.saveLocal) window.saveLocal("group-settings");
        window.renderChangedTagType(window.editingTagType);
        window.renderMain?.();
        window.toggleTagColorPicker(false);
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
        if (!window.isWorkLayoutMode) return;
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
        if (!window.isWorkLayoutMode) return;
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
        let lastCellReorderAt = 0, lastCellReorderPoint = null;
        const REORDER_THROTTLE_MS = 220;
        const REORDER_RELEASE_DISTANCE = 22;

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
            const ratioX = (point.clientX - rect.left) / Math.max(rect.width, 1);
            const ratioY = (point.clientY - rect.top) / Math.max(rect.height, 1);
            // 대상 칸 중앙 30%는 중립 구간이다. 세로로 충분히 넘어갔거나,
            // 같은 줄에서는 좌우로 충분히 넘어갔을 때만 이동을 확정한다.
            let before;
            if (ratioY < 0.35) before = true;
            else if (ratioY > 0.65) before = false;
            else if (ratioX < 0.35) before = true;
            else if (ratioX > 0.65) before = false;
            else return;
            const desiredNext = before ? target : target.nextSibling;
            // 이미 그 자리면 아무것도 하지 않음(불필요한 재배치가 떨림의 절반 이상 원인이었음)
            if (dragCell.nextSibling === desiredNext) return;
            const now = Date.now();
            if (now - lastCellReorderAt < REORDER_THROTTLE_MS) return;
            if (lastCellReorderPoint && Math.hypot(
                point.clientX - lastCellReorderPoint.x,
                point.clientY - lastCellReorderPoint.y
            ) < REORDER_RELEASE_DISTANCE) return;
            lastCellReorderAt = now;
            lastCellReorderPoint = { x: point.clientX, y: point.clientY };
            dragGroup.insertBefore(dragCell, desiredNext);
        };

        const end = () => {
            clearTimeout(resizeModeTimer);
            if (dragCell) dragCell.classList.remove("is-widget-dragging");
            if (resizeCell) resizeCell.classList.remove("is-widget-dragging");
            if (dragCell || resizeCell) window.saveWorkLayout && window.saveWorkLayout();
            dragCell = null; dragGroup = null; resizeCell = null; resizeStart = null;
            pendingResizeCell = null; pendingResizeStart = null;
            lastCellReorderPoint = null;
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

// 작업 카드 내부 칸 순서 편집: 카드 순서/업무 데이터와 분리된 공통 화면 설정이다.
(() => {
    const STORAGE_KEY = 'wm_work_card_section_order';
    const WIDGET_KEY = 'wm_work_card_widget_settings';
    const PRESET_KEY = 'wm_work_card_presets';
    const ACTIVE_PRESET_KEY = 'wm_work_card_active_preset';
    let pressTimer = null;
    let pressCard = null;
    let pressX = 0;
    let pressY = 0;
    let suppressCardId = '';
    let suppressUntil = 0;

    const isIgnoredTarget = target => !!target.closest('button, a, img, input, textarea, select, .log-img-list');
    const closeEditor = () => document.getElementById('workCardLayoutEditor')?.remove();
    const resetDecoration = value => ({ ...(value || {}), titleVisible:false, titleMarker:false, titlePosition:'top', statusMode:false, contentBox:false, fontSize:'normal', emphasis:false, underline:false, italic:false, alignH:'none', alignV:'none', boxStyle:'plain', borderStyle:'none', shadowStyle:'none', color:'', backgroundColor:'', borderColor:'', contentBackgroundColor:'' });
    const migrateStyles = settings => {
        const next = settings && typeof settings === 'object' ? settings : {};
        if (Number(next?.__meta?.styleVersion || 0) >= 6) return next;
        Object.keys(next).forEach(key => { if (key !== '__meta' && next[key] && typeof next[key] === 'object') next[key] = resetDecoration(next[key]); });
        next.__meta = { ...(next.__meta || {}), styleVersion:6 };
        return next;
    };
    const readWidgetSettings = () => { try { const next = migrateStyles(JSON.parse(localStorage.getItem(WIDGET_KEY) || '{}')); localStorage.setItem(WIDGET_KEY, JSON.stringify(next)); return next; } catch (_) { return {}; } };
    const readPresets = () => { try { const presets = JSON.parse(localStorage.getItem(PRESET_KEY) || '{}'); let changed = false; ['1','2','3'].forEach(slot => { if (presets[slot] && Number(presets[slot]?.__meta?.styleVersion || 0) < 6) { presets[slot] = migrateStyles(presets[slot]); changed = true; } }); if (changed) localStorage.setItem(PRESET_KEY, JSON.stringify(presets)); return presets; } catch (_) { return {}; } };
    const queueUiSettingsSync = () => {
        window.markDirty?.('master', 'uiSettings', 'upsert');
        window.scheduleSync?.();
    };
    const commitWidgetSettings = (settings, updatePreset = true) => {
        localStorage.setItem(WIDGET_KEY, JSON.stringify(settings || {}));
        const activePreset = localStorage.getItem(ACTIVE_PRESET_KEY);
        if (updatePreset && ['1','2','3'].includes(activePreset)) {
            const presets = readPresets(); presets[activePreset] = JSON.parse(JSON.stringify(settings || {}));
            localStorage.setItem(PRESET_KEY, JSON.stringify(presets));
        }
        queueUiSettingsSync();
    };
    const writeWidgetSetting = (key, patch) => {
        const settings = readWidgetSettings();
        settings[key] = { ...(settings[key] || {}), ...patch };
        commitWidgetSettings(settings);
        window.updateUI?.();
    };
    const saveEditorOrder = list => {
        const visibleOrder = [...list.querySelectorAll('.card-layout-edit-item')].map(item => item.dataset.key);
        let previous = [];
        try { previous = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch (_) { previous = []; }
        const hiddenKeys = Array.isArray(previous) ? previous.filter(key => !visibleOrder.includes(key)) : [];
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...visibleOrder, ...hiddenKeys]));
        window.updateUI?.();
    };

    const openEditor = card => {
        closeEditor();
        window.closeCardSelectionMode?.();
        const sections = [...card.querySelectorAll('.work-card-subwidget,.work-card-widget')]
            .filter(section => section.classList.contains('work-card-subwidget') || section.dataset.cardSectionKey?.startsWith('custom:'));
        if (!sections.length) return;
        const settings = readWidgetSettings();
        const overlay = document.createElement('div');
        overlay.id = 'workCardLayoutEditor';
        overlay.className = 'card-layout-editor-layer';
        overlay.innerHTML = `<div class="card-layout-editor card-free-editor w95-out" role="dialog" aria-modal="true">
            <div class="w95-titlebar"><span>카드 자유 배치</span><button type="button" class="w95-btn card-layout-close">X</button></div>
            <div class="card-free-toolbar">
                <button type="button" class="w95-btn" data-free-action="size-minus">−</button><button type="button" class="w95-btn is-active" data-free-action="axis">가로</button><button type="button" class="w95-btn" data-free-action="size-plus">＋</button><button type="button" class="w95-btn card-free-preset" data-preset="1">1</button><button type="button" class="w95-btn card-free-preset" data-preset="2">2</button><button type="button" class="w95-btn card-free-preset" data-preset="3">3</button><span class="card-free-toolbar-spacer"></span><button type="button" class="w95-btn card-free-settings-toggle" data-free-action="settings">설정</button>
            </div>
            <div class="card-free-canvas" aria-label="12칸 카드 배치 영역"></div>
            <div class="card-free-object-popup w95-out" role="group" aria-label="선택 객체 표시 설정">
                <div class="card-free-setting-group"><b>표시</b><button type="button" class="w95-btn" data-free-action="title">제목</button><button type="button" class="w95-btn" data-free-action="title-marker">제목 점</button><button type="button" class="w95-btn" data-free-action="title-position">제목: 상단</button><button type="button" class="w95-btn" data-free-action="status">상태</button></div>
                <div class="card-free-setting-group"><b>글자</b><button type="button" class="w95-btn" data-free-action="font">글자 중</button><button type="button" class="w95-btn" data-free-action="emphasis">굵게</button><button type="button" class="w95-btn" data-free-action="underline">밑줄</button><button type="button" class="w95-btn" data-free-action="italic">기울임</button><label class="card-free-color-label">색<input type="color" class="card-free-color" value="#111827" title="글자 색상"></label><div class="card-free-color-palette">${['#111827','#475569','#b91c1c','#c2410c','#a16207','#047857','#0f766e','#0369a1','#1d4ed8','#4338ca','#7c3aed','#be185d'].map(color => `<button type="button" class="card-color-swatch" data-free-action="preset-color" data-color="${color}" style="--swatch:${color}" aria-label="${color}"></button>`).join('')}</div></div>
                <div class="card-free-setting-group"><b>칸 기준 정렬</b><button type="button" class="w95-btn" data-free-action="align-h">칸 가로: 없음</button><button type="button" class="w95-btn" data-free-action="align-v">칸 세로: 없음</button></div>
                <div class="card-free-setting-group card-free-box-settings"><b>상자</b><button type="button" class="w95-btn" data-free-action="content-box">내용 상자</button><label class="card-free-color-label">상자색<input type="color" class="card-free-content-bg-color" value="#e2e8f0" title="내용 상자 색상"></label><button type="button" class="w95-btn" data-free-action="box">외곽: 기본</button><button type="button" class="w95-btn" data-free-action="border">테두리: 없음</button><button type="button" class="w95-btn" data-free-action="shadow">음영: 없음</button><label class="card-free-color-label">배경<input type="color" class="card-free-bg-color" value="#ffffff" title="배경 색상"></label><label class="card-free-color-label">선<input type="color" class="card-free-border-color" value="#334155" title="테두리 색상"></label></div>
                <div class="card-free-setting-group card-free-auto-group"><b>자동 설정</b><button type="button" class="w95-btn" data-free-action="auto-color">선택 색상 자동</button><button type="button" class="w95-btn" data-free-action="auto-all">전체 자동 설정</button></div>
                <div class="card-free-popup-actions"><button type="button" class="w95-btn" data-free-action="reset-style">꾸미기 초기화</button><button type="button" class="w95-btn" data-free-action="close-settings">닫기</button></div>
            </div>
            <div class="card-free-tray"><button type="button" class="w95-btn card-free-store-button" data-free-action="hide">보관</button><div class="card-free-tray-items"></div><button type="button" class="w95-btn card-layout-reset">초기화</button></div>
        </div>`;
        document.body.appendChild(overlay);
        const canvas = overlay.querySelector('.card-free-canvas');
        const tray = overlay.querySelector('.card-free-tray-items');
        const objectPopup = overlay.querySelector('.card-free-object-popup');
        const colorInput = overlay.querySelector('.card-free-color');
        const bgColorInput = overlay.querySelector('.card-free-bg-color');
        const borderColorInput = overlay.querySelector('.card-free-border-color');
        const contentBgColorInput = overlay.querySelector('.card-free-content-bg-color');
        let selected = null;
        let dragged = null;
        let dragStart = null;
        let itemPressStart = null;
        let settingsUnlocked = false;
        let sizeAxis = 'w';
        const activeTouches = new Map();
        let twoFingerY = 0;
        let edgeScrollSpeed = 0;
        let edgeScrollTimer = null;
        let lastDragPoint = null;
        const autoPalette = ['#1d4ed8','#047857','#7c3aed','#b45309','#be123c','#0369a1','#0f766e','#4338ca'];
        const autoColorForKey = key => {
            const fixed = {
                'object:number':'#b91c1c','object:date':'#334155','object:time':'#1d4ed8','object:status':'#065f46',
                'object:taskNo':'#3730a3','object:alerts':'#b91c1c','object:taskType':'#6d28d9','object:content':'#111827',
                'object:note':'#b45309','object:customer':'#0f766e','object:address':'#475569','object:equipment':'#0369a1',
                'object:duration':'#7c3aed','object:manager':'#047857','object:modified':'#64748b','object:images':'#334155'
            };
            if (fixed[key]) return fixed[key];
            const hash = [...String(key)].reduce((sum, char) => ((sum * 31) + char.charCodeAt(0)) >>> 0, 0);
            return autoPalette[hash % autoPalette.length];
        };
        const autoBoxColorForKey = key => ({
            'object:status':'#dcfce7','object:taskNo':'#e0e7ff','object:alerts':'#fee2e2','object:taskType':'#f3e8ff','object:note':'#fef3c7'
        })[key] || '#f1f5f9';
        const applyAutomaticTemplate = () => {
            const centered = new Set(['object:number','object:date','object:time','object:status','object:taskNo','object:alerts','object:duration','object:modified']);
            Object.keys(settings).forEach(key => {
                if (key === '__meta' || key === 'object:delete' || !settings[key] || typeof settings[key] !== 'object') return;
                const preserved = resetDecoration(settings[key]);
                Object.assign(settings[key], preserved, {
                    color:autoColorForKey(key), alignH:centered.has(key) ? 'center' : 'left', alignV:'middle',
                    emphasis:['object:number','object:date','object:time','object:status','object:taskNo','object:alerts'].includes(key),
                    contentBox:false, contentBackgroundColor:'', backgroundColor:'', borderColor:'', boxStyle:'plain', borderStyle:'none', shadowStyle:'none'
                });
            });
            settings.__meta = { ...(settings.__meta || {}), styleVersion:6, autoTemplate:'balanced' };
        };

        const legacySize = (setting, section) => {
            const oldCols = Number(setting.cols || section.dataset.widgetCols || 4);
            const fineGrid = Number(setting.grid) === 12;
            const oldW = Number(setting.w || (oldCols >= 4 ? 6 : oldCols === 2 ? 3 : 2));
            const oldH = Number(setting.h || (setting.height === 'two' ? 2 : 1));
            return {
                w: Math.max(1, Math.min(12, fineGrid ? oldW : oldW * 2)),
                h: Math.max(1, Math.min(8, fineGrid ? oldH : oldH * 2)),
                x: fineGrid ? Number(setting.x || 0) : (Number(setting.x) > 0 ? (Number(setting.x) - 1) * 2 + 1 : 0),
                y: fineGrid ? Number(setting.y || 0) : (Number(setting.y) > 0 ? (Number(setting.y) - 1) * 2 + 1 : 0)
            };
        };
        const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
        const rectOf = item => ({ x:+item.dataset.x, y:+item.dataset.y, w:+item.dataset.w, h:+item.dataset.h });
        const persist = item => {
            const key = item.dataset.key;
            settings[key] = { ...(settings[key] || {}), grid:12, x:+item.dataset.x, y:+item.dataset.y, w:+item.dataset.w, h:+item.dataset.h, hidden:false };
            commitWidgetSettings(settings);
        };
        const place = item => {
            const { x, y, w, h } = rectOf(item);
            item.style.gridColumn = `${x} / span ${w}`;
            item.style.gridRow = `${y} / span ${h}`;
            item.style.setProperty('--zone-line-left', `${-((x - 1) / w * 100)}%`);
            item.style.setProperty('--zone-line-width', `${12 / w * 100}%`);
        };
        const firstSpace = (w, h, ignore = null) => {
            const others = [...canvas.children].filter(item => item !== ignore).map(rectOf);
            for (let y = 1; y < 120; y++) for (let x = 1; x <= 13 - w; x++) {
                const next = { x, y, w, h };
                if (!others.some(other => overlaps(next, other))) return { x, y };
            }
            return { x:1, y:120 };
        };
        const nearestSpace = (w, h, startX, startY, ignore = null) => {
            const others = [...canvas.children].filter(item => item !== ignore).map(rectOf);
            let best = null;
            for (let y = 1; y < 120; y++) for (let x = 1; x <= 13 - w; x++) {
                const next = { x, y, w, h };
                if (others.some(other => overlaps(next, other))) continue;
                const score = Math.abs(y - startY) * 12 + Math.abs(x - startX);
                if (!best || score < best.score) best = { x, y, score };
            }
            return best || firstSpace(w, h, ignore);
        };
        const select = item => {
            selected?.classList.remove('is-selected','is-settings-open');
            selected = item;
            settingsUnlocked = false;
            overlay.classList.remove('is-object-settings');
            overlay.querySelector('[data-free-action="settings"]')?.classList.remove('is-active');
            objectPopup.classList.remove('is-open');
            if (!item) return;
            item.classList.add('is-selected');
            colorInput.value = settings[item.dataset.key]?.color || '#111827';
            bgColorInput.value = settings[item.dataset.key]?.backgroundColor || '#ffffff';
            borderColorInput.value = settings[item.dataset.key]?.borderColor || '#334155';
            contentBgColorInput.value = settings[item.dataset.key]?.contentBackgroundColor || '#e2e8f0';
        };
        const refreshAdvancedState = () => {
            if (!selected) return;
            const setting = settings[selected.dataset.key] || {};
            ['title','title-marker','emphasis','underline','italic','status','content-box'].forEach(action => {
                const key = action === 'title' ? 'titleVisible' : action === 'title-marker' ? 'titleMarker' : action === 'status' ? 'statusMode' : action === 'content-box' ? 'contentBox' : action;
                overlay.querySelector(`[data-free-action="${action}"]`)?.classList.toggle('is-active', !!setting[key]);
            });
            const fontLabels = { tiny:'글자 아주작게', small:'글자 작게', normal:'글자 보통', large:'글자 크게', xlarge:'글자 아주크게', xxlarge:'글자 최대' };
            const fontButton = overlay.querySelector('[data-free-action="font"]');
            if (fontButton) fontButton.textContent = fontLabels[setting.fontSize || 'normal'];
            const positionButton = overlay.querySelector('[data-free-action="title-position"]');
            if (positionButton) positionButton.textContent = setting.titlePosition === 'inline' ? '제목: 앞쪽' : '제목: 상단';
            const hLabels = { none:'칸 가로: 없음', left:'칸 가로: 왼쪽', center:'칸 가로: 가운데', right:'칸 가로: 오른쪽' };
            const vLabels = { none:'칸 세로: 없음', top:'칸 세로: 위', middle:'칸 세로: 가운데', bottom:'칸 세로: 아래' };
            const borderLabels = { default:'테두리: 기본', none:'테두리: 없음', bold:'테두리: 굵게' };
            const hButton = overlay.querySelector('[data-free-action="align-h"]'); if (hButton) hButton.textContent = hLabels[setting.alignH || 'none'];
            const vButton = overlay.querySelector('[data-free-action="align-v"]'); if (vButton) vButton.textContent = vLabels[setting.alignV || 'none'];
            const borderButton = overlay.querySelector('[data-free-action="border"]'); if (borderButton) borderButton.textContent = borderLabels[setting.borderStyle || 'none'];
            const boxLabels = { plain:'박스: 기본', square:'박스: 사각', rounded:'박스: 둥근' };
            const shadowLabels = { none:'음영: 없음', soft:'음영: 보통', strong:'음영: 강하게' };
            const boxButton = overlay.querySelector('[data-free-action="box"]'); if (boxButton) boxButton.textContent = boxLabels[setting.boxStyle || 'plain'];
            const shadowButton = overlay.querySelector('[data-free-action="shadow"]'); if (shadowButton) shadowButton.textContent = shadowLabels[setting.shadowStyle || 'none'];
            selected.style.setProperty('--widget-font-size', { tiny:'.56rem', small:'.66rem', normal:'.78rem', large:'.92rem', xlarge:'1.08rem', xxlarge:'1.28rem' }[setting.fontSize || 'normal']);
        };
        const refreshPreviewTitle = item => {
            if (!item) return;
            const setting = settings[item.dataset.key] || {};
            const previewRoot = item.querySelector('.card-free-preview > *');
            const target = item.dataset.key.startsWith('custom:') ? previewRoot?.querySelector('.work-custom-panel') : previewRoot;
            if (!target) return;
            [...target.children].filter(child => child.classList?.contains('work-card-object-title')).forEach(child => child.remove());
            target.classList.remove('title-position-top','title-position-inline');
            target.classList.add(setting.titlePosition === 'inline' ? 'title-position-inline' : 'title-position-top');
            if (item.dataset.key.startsWith('custom:')) {
                const span = target.querySelector('.work-info-line.custom span');
                span?.querySelector('b')?.remove(); span?.querySelector('.work-custom-title-separator')?.remove();
                if (!setting.titleVisible || !span) return;
                if (setting.titlePosition === 'inline') {
                    const title = document.createElement('b'); title.innerHTML = `${setting.titleMarker ? '<span class="work-card-title-marker" aria-hidden="true"></span>' : ''}${item.dataset.label}`;
                    const separator = document.createElement('span'); separator.className = 'work-custom-title-separator'; separator.textContent = ' : ';
                    span.prepend(separator); span.prepend(title);
                } else {
                    const title = document.createElement('b'); title.className = 'work-card-object-title'; title.innerHTML = `${setting.titleMarker ? '<span class="work-card-title-marker" aria-hidden="true"></span>' : ''}${item.dataset.label}`; target.prepend(title);
                }
                return;
            }
            if (!setting.titleVisible) return;
            const title = document.createElement('b'); title.className = 'work-card-object-title';
            title.innerHTML = `${setting.titleMarker ? '<span class="work-card-title-marker" aria-hidden="true"></span>' : ''}${item.dataset.label}${setting.titlePosition === 'inline' ? ' : ' : ''}`; target.prepend(title);
        };
        const refreshPreviewAlignment = item => {
            if (!item) return;
            const setting = settings[item.dataset.key] || {};
            const target = item.querySelector('.card-free-preview > .work-card-subwidget,.card-free-preview > .work-card-widget');
            if (!target) return;
            [...target.classList].filter(name => name.startsWith('widget-align-h-') || name.startsWith('widget-align-v-')).forEach(name => target.classList.remove(name));
            target.classList.add(`widget-align-h-${setting.alignH || 'none'}`, `widget-align-v-${setting.alignV || 'none'}`);
        };
        const refreshPreviewAppearance = item => {
            if (!item) return;
            const setting = settings[item.dataset.key] || {};
            const target = item.querySelector('.card-free-preview > .work-card-subwidget,.card-free-preview > .work-card-widget');
            if (!target) return;
            ['is-status-mode','has-content-box','is-emphasis','is-underlined','is-italic'].forEach(name => {
                const enabled = name === 'is-status-mode' ? !!setting.statusMode
                    : name === 'has-content-box' ? !!setting.contentBox
                    : name === 'is-emphasis' ? !!setting.emphasis
                    : name === 'is-underlined' ? !!setting.underline : !!setting.italic;
                item.classList.toggle(name, enabled);
                target.classList.toggle(name, enabled);
            });
            [...target.classList].filter(name => name.startsWith('widget-font-')).forEach(name => target.classList.remove(name));
            target.classList.add(`widget-font-${setting.fontSize || 'normal'}`);
            const vars = [
                ['--widget-text-color', setting.color],
                ['--widget-bg-color', setting.backgroundColor],
                ['--widget-border-color', setting.borderColor],
                ['--widget-content-bg', setting.contentBackgroundColor]
            ];
            vars.forEach(([name, value]) => {
                if (value) { item.style.setProperty(name, value); target.style.setProperty(name, value); }
                else { item.style.removeProperty(name); target.style.removeProperty(name); }
            });
            refreshPreviewAlignment(item);
            refreshPreviewTitle(item);
        };
        const positionObjectPopup = item => {
            objectPopup.classList.add('is-open');
            const dock = () => {
                const itemRect = item.getBoundingClientRect();
                const canvasRect = canvas.getBoundingClientRect();
                objectPopup.style.left = `${Math.max(6, canvasRect.left)}px`;
                objectPopup.style.width = `${Math.min(canvasRect.width, window.innerWidth - 12)}px`;
                objectPopup.style.top = `${Math.min(window.innerHeight - 110, itemRect.bottom + 6)}px`;
                objectPopup.style.maxHeight = `${Math.max(100, window.innerHeight - Math.min(window.innerHeight - 110, itemRect.bottom + 6) - 8)}px`;
            };
            requestAnimationFrame(() => {
                const rect = item.getBoundingClientRect();
                if (rect.bottom > window.innerHeight * .58) canvas.scrollTop += rect.bottom - window.innerHeight * .48;
                requestAnimationFrame(dock);
            });
        };
        const addToTray = (key, label) => {
            if ([...tray.children].some(button => button.dataset.key === key)) return;
            const button = document.createElement('button');
            button.type = 'button'; button.className = 'w95-btn card-free-restore'; button.dataset.key = key; button.textContent = label;
            tray.appendChild(button);
        };

        sections.forEach((section, index) => {
            const key = section.dataset.cardSectionKey;
            const setting = settings[key] || {};
            const label = section.dataset.cardSectionLabel || `객체 ${index + 1}`;
            if (setting.hidden) { addToTray(key, label); return; }
            const item = document.createElement('div');
            item.className = 'card-free-item'; item.dataset.key = key; item.dataset.label = label;
            const size = legacySize(setting, section); item.dataset.w = size.w; item.dataset.h = size.h;
            const wanted = size.x > 0 && size.y > 0 ? { x:size.x, y:size.y } : firstSpace(size.w, size.h);
            const wantedRect = { x:Math.max(1, Math.min(13 - size.w, wanted.x)), y:Math.max(1, wanted.y), w:size.w, h:size.h };
            const pos = [...canvas.children].some(other => overlaps(wantedRect, rectOf(other))) ? nearestSpace(size.w, size.h, wantedRect.x, wantedRect.y) : wantedRect;
            item.dataset.x = Math.max(1, Math.min(13 - size.w, pos.x)); item.dataset.y = Math.max(1, pos.y);
            item.innerHTML = `<div class="card-free-preview"></div>`;
            const preview = section.cloneNode(true); preview.classList.remove('is-widget-hidden'); preview.removeAttribute('style');
            preview.classList.remove('widget-font-small','widget-font-normal','widget-font-large','widget-font-xlarge');
            preview.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
            item.querySelector('.card-free-preview').appendChild(preview);
            const titleVisible = !!setting.titleVisible;
            const titlePosition = setting.titlePosition || (key.startsWith('custom:') ? 'inline' : 'top');
            settings[key] = { ...(settings[key] || {}), titleVisible, titleMarker:!!setting.titleMarker, titlePosition, contentBox:!!setting.contentBox, fontSize:setting.fontSize || 'normal', alignH:setting.alignH || 'none', alignV:setting.alignV || 'none', borderStyle:setting.borderStyle || 'none', boxStyle:setting.boxStyle || 'plain', shadowStyle:setting.shadowStyle || 'none' };
            item.classList.toggle('is-title-visible', titleVisible);
            item.classList.toggle('is-emphasis', !!setting.emphasis);
            item.classList.toggle('is-status-mode', !!settings[key].statusMode);
            item.classList.toggle('has-content-box', !!settings[key].contentBox);
            item.dataset.fontSize = settings[key].fontSize;
            item.style.setProperty('--widget-font-size', { tiny:'.56rem', small:'.66rem', normal:'.78rem', large:'.92rem', xlarge:'1.08rem', xxlarge:'1.28rem' }[settings[key].fontSize] || '.78rem');
            item.dataset.alignH = settings[key].alignH; item.dataset.alignV = settings[key].alignV; item.dataset.borderStyle = settings[key].borderStyle;
            item.dataset.boxStyle = settings[key].boxStyle; item.dataset.shadowStyle = settings[key].shadowStyle;
            item.classList.toggle('is-underlined', !!settings[key].underline); item.classList.toggle('is-italic', !!settings[key].italic);
            if (setting.color) item.style.setProperty('--widget-text-color', setting.color);
            if (setting.backgroundColor) item.style.setProperty('--widget-bg-color', setting.backgroundColor);
            if (setting.borderColor) item.style.setProperty('--widget-border-color', setting.borderColor);
            if (setting.contentBackgroundColor) item.style.setProperty('--widget-content-bg', setting.contentBackgroundColor);
            canvas.appendChild(item); place(item); persist(item);
            refreshPreviewAppearance(item);
        });
        const knownLabels = {
            'object:number':'번호', 'object:date':'일자', 'object:time':'시간', 'object:status':'상태',
            'object:taskNo':'타스크번호', 'object:alerts':'OT·당직', 'object:delete':'삭제',
            'object:taskType':'작업유형', 'object:content':'작업내용', 'object:note':'특이사항',
            'object:customer':'고객명', 'object:address':'주소', 'object:equipment':'장비', 'object:duration':'작업시간',
            'object:manager':'매니저', 'object:modified':'수정시간', 'object:images':'사진'
        };
        const restoreTrayItem = restoreButton => {
            const key = restoreButton.dataset.key;
            const setting = settings[key] || {};
            const source = sections.find(section => section.dataset.cardSectionKey === key);
            const label = source?.dataset.cardSectionLabel || restoreButton.textContent || knownLabels[key] || key.replace(/^custom:/, '선택태그 ');
            const previewSource = source?.cloneNode(true) || (() => {
                const blank = document.createElement('div');
                blank.className = 'work-card-subwidget';
                blank.dataset.cardSectionKey = key;
                blank.dataset.cardSectionLabel = label;
                blank.innerHTML = '<div class="work-info-line"><span></span></div>';
                return blank;
            })();
            previewSource.classList.remove('is-widget-hidden');
            previewSource.removeAttribute('style');
            previewSource.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));

            const item = document.createElement('div');
            item.className = 'card-free-item';
            item.dataset.key = key;
            item.dataset.label = label;
            const size = legacySize(setting, previewSource);
            item.dataset.w = size.w;
            item.dataset.h = size.h;
            const pos = firstSpace(size.w, size.h);
            item.dataset.x = pos.x;
            item.dataset.y = pos.y;
            item.innerHTML = '<div class="card-free-preview"></div>';
            item.querySelector('.card-free-preview').appendChild(previewSource);

            settings[key] = {
                ...setting, hidden:false, grid:12, x:pos.x, y:pos.y, w:size.w, h:size.h,
                titleVisible:!!setting.titleVisible,
                titleMarker:!!setting.titleMarker,
                titlePosition:setting.titlePosition || (key.startsWith('custom:') ? 'inline' : 'top'),
                contentBox:!!setting.contentBox,
                fontSize:setting.fontSize || 'normal',
                alignH:setting.alignH || 'none',
                alignV:setting.alignV || 'none',
                borderStyle:setting.borderStyle || 'none',
                boxStyle:setting.boxStyle || 'plain',
                shadowStyle:setting.shadowStyle || 'none'
            };
            item.dataset.fontSize = settings[key].fontSize;
            item.dataset.alignH = settings[key].alignH;
            item.dataset.alignV = settings[key].alignV;
            item.dataset.borderStyle = settings[key].borderStyle;
            item.dataset.boxStyle = settings[key].boxStyle;
            item.dataset.shadowStyle = settings[key].shadowStyle;
            item.style.setProperty('--widget-font-size', { tiny:'.56rem', small:'.66rem', normal:'.78rem', large:'.92rem', xlarge:'1.08rem', xxlarge:'1.28rem' }[settings[key].fontSize] || '.78rem');
            canvas.appendChild(item);
            place(item);
            refreshPreviewAppearance(item);
            persist(item);
            restoreButton.remove();
            select(item);
        };
        Object.entries(settings).forEach(([key, setting]) => {
            if (setting?.hidden && (key.startsWith('object:') || key.startsWith('custom:'))) {
                const source = sections.find(section => section.dataset.cardSectionKey === key);
                addToTray(key, source?.dataset.cardSectionLabel || knownLabels[key] || key.replace(/^custom:/, '선택태그 '));
            }
        });
        const activePreset = localStorage.getItem(ACTIVE_PRESET_KEY);
        overlay.querySelector(`[data-preset="${activePreset}"]`)?.classList.add('is-active');

        const storeSelectedItem = () => {
            if (!selected || !selected.isConnected) return;
            const item = selected;
            const key = item.dataset.key;
            const label = item.dataset.label || knownLabels[key] || key;
            settings[key] = { ...(settings[key] || {}), hidden:true };
            addToTray(key, label);
            item.remove();
            selected = null;
            settingsUnlocked = false;
            overlay.classList.remove('is-object-settings');
            overlay.querySelector('[data-free-action="settings"]')?.classList.remove('is-active');
            objectPopup.classList.remove('is-open');
            commitWidgetSettings(settings);
            window.updateUI?.();
        };

        const finish = () => {
            clearInterval(edgeScrollTimer); edgeScrollTimer = null;
            const items = [...canvas.children];
            items.sort((a,b) => (+a.dataset.y - +b.dataset.y) || (+a.dataset.x - +b.dataset.x)).forEach((item, index, sorted) => {
                if (!sorted.slice(0, index).some(other => overlaps(rectOf(item), rectOf(other)))) return;
                const space = nearestSpace(+item.dataset.w, +item.dataset.h, +item.dataset.x, +item.dataset.y, item);
                item.dataset.x = space.x; item.dataset.y = space.y; place(item);
            });
            const minY = items.length ? Math.min(...items.map(item => +item.dataset.y || 1)) : 1;
            if (minY > 1) items.forEach(item => { item.dataset.y = (+item.dataset.y || 1) - minY + 1; settings[item.dataset.key] = { ...(settings[item.dataset.key] || {}), y:+item.dataset.y }; });
            commitWidgetSettings(settings);
            closeEditor(); window.updateUI?.();
        };
        overlay.addEventListener('click', event => {
            if (event.target === overlay || event.target.closest('.card-layout-close')) return finish();
            const presetButton = event.target.closest('.card-free-preset');
            if (presetButton) {
                const slot = presetButton.dataset.preset; const presets = readPresets();
                localStorage.setItem(ACTIVE_PRESET_KEY, slot);
                if (presets[slot]) {
                    commitWidgetSettings(JSON.parse(JSON.stringify(presets[slot])), false);
                    closeEditor(); window.updateUI?.();
                } else {
                    presets[slot] = JSON.parse(JSON.stringify(settings)); localStorage.setItem(PRESET_KEY, JSON.stringify(presets));
                    overlay.querySelectorAll('.card-free-preset').forEach(button => button.classList.toggle('is-active', button === presetButton));
                    queueUiSettingsSync();
                }
                return;
            }
            if (event.target.closest('.card-layout-reset')) {
                localStorage.removeItem(STORAGE_KEY); commitWidgetSettings({}, true); closeEditor(); window.updateUI?.(); return;
            }
            const restore = event.target.closest('.card-free-restore');
            if (restore) {
                restoreTrayItem(restore);
                return;
            }
            if (event.target.closest('.card-free-store-button')) {
                storeSelectedItem();
                return;
            }
            const item = event.target.closest('.card-free-item');
            if (item) select(item);
            const action = event.target.closest('[data-free-action]')?.dataset.freeAction;
            if (!action || !selected) return;
            if (action === 'settings') {
                settingsUnlocked = !settingsUnlocked;
                overlay.classList.toggle('is-object-settings', settingsUnlocked);
                selected.classList.toggle('is-settings-open', settingsUnlocked);
                event.target.classList.toggle('is-active', settingsUnlocked);
                objectPopup.classList.toggle('is-open', settingsUnlocked);
                if (settingsUnlocked) { refreshAdvancedState(); positionObjectPopup(selected); }
                return;
            }
            if (action === 'close-settings') {
                settingsUnlocked = false; overlay.classList.remove('is-object-settings'); selected.classList.remove('is-settings-open');
                overlay.querySelector('[data-free-action="settings"]')?.classList.remove('is-active'); objectPopup.classList.remove('is-open'); return;
            }
            if (action === 'hide') { storeSelectedItem(); return; }
            if (action === 'axis') { sizeAxis = sizeAxis === 'w' ? 'h' : 'w'; event.target.textContent = sizeAxis === 'w' ? '가로' : '세로'; return; }
            if (['title','title-marker','title-position','emphasis','underline','italic','font','align-h','align-v','box','border','shadow','status','content-box','auto-color','auto-all','reset-style'].includes(action) && !settingsUnlocked) return;
            if (action === 'auto-color') {
                const color = autoColorForKey(selected.dataset.key);
                settings[selected.dataset.key].color = color; colorInput.value = color;
                selected.style.setProperty('--widget-text-color', color);
            }
            if (action === 'preset-color') {
                const color = event.target.closest('[data-color]')?.dataset.color;
                if (color) {
                    settings[selected.dataset.key].color = color;
                    colorInput.value = color;
                    selected.style.setProperty('--widget-text-color', color);
                }
            }
            if (action === 'auto-all') {
                applyAutomaticTemplate(); commitWidgetSettings(settings); finish(); return;
            }
            if (action === 'title') { settings[selected.dataset.key].titleVisible = !settings[selected.dataset.key].titleVisible; selected.classList.toggle('is-title-visible', settings[selected.dataset.key].titleVisible); refreshPreviewTitle(selected); }
            if (action === 'title-marker') { settings[selected.dataset.key].titleMarker = !settings[selected.dataset.key].titleMarker; refreshPreviewTitle(selected); }
            if (action === 'title-position') { settings[selected.dataset.key].titlePosition = settings[selected.dataset.key].titlePosition === 'inline' ? 'top' : 'inline'; refreshPreviewTitle(selected); }
            if (action === 'emphasis') { settings[selected.dataset.key].emphasis = !settings[selected.dataset.key].emphasis; selected.classList.toggle('is-emphasis', settings[selected.dataset.key].emphasis); }
            if (action === 'underline') { settings[selected.dataset.key].underline = !settings[selected.dataset.key].underline; selected.classList.toggle('is-underlined', settings[selected.dataset.key].underline); }
            if (action === 'italic') { settings[selected.dataset.key].italic = !settings[selected.dataset.key].italic; selected.classList.toggle('is-italic', settings[selected.dataset.key].italic); }
            if (action === 'font') {
                const sizes = ['tiny','small','normal','large','xlarge','xxlarge']; const current = settings[selected.dataset.key].fontSize || 'normal';
                settings[selected.dataset.key].fontSize = sizes[(sizes.indexOf(current) + 1) % sizes.length]; selected.dataset.fontSize = settings[selected.dataset.key].fontSize;
            }
            if (action === 'align-h') { const values = ['none','left','center','right']; const current = settings[selected.dataset.key].alignH || 'none'; settings[selected.dataset.key].alignH = values[(values.indexOf(current) + 1) % values.length]; selected.dataset.alignH = settings[selected.dataset.key].alignH; refreshPreviewAlignment(selected); }
            if (action === 'align-v') { const values = ['none','top','middle','bottom']; const current = settings[selected.dataset.key].alignV || 'none'; settings[selected.dataset.key].alignV = values[(values.indexOf(current) + 1) % values.length]; selected.dataset.alignV = settings[selected.dataset.key].alignV; refreshPreviewAlignment(selected); }
            if (action === 'border') { const values = ['default','none','bold']; const current = settings[selected.dataset.key].borderStyle || 'default'; settings[selected.dataset.key].borderStyle = values[(values.indexOf(current) + 1) % values.length]; selected.dataset.borderStyle = settings[selected.dataset.key].borderStyle; }
            if (action === 'box') { const values = ['plain','square','rounded']; const current = settings[selected.dataset.key].boxStyle || 'plain'; settings[selected.dataset.key].boxStyle = values[(values.indexOf(current) + 1) % values.length]; selected.dataset.boxStyle = settings[selected.dataset.key].boxStyle; }
            if (action === 'shadow') { const values = ['none','soft','strong']; const current = settings[selected.dataset.key].shadowStyle || 'none'; settings[selected.dataset.key].shadowStyle = values[(values.indexOf(current) + 1) % values.length]; selected.dataset.shadowStyle = settings[selected.dataset.key].shadowStyle; }
            if (action === 'status') {
                settings[selected.dataset.key].statusMode = !settings[selected.dataset.key].statusMode; selected.classList.toggle('is-status-mode', settings[selected.dataset.key].statusMode);
            }
            if (action === 'content-box') {
                settings[selected.dataset.key].contentBox = !settings[selected.dataset.key].contentBox; selected.classList.toggle('has-content-box', settings[selected.dataset.key].contentBox);
            }
            if (action === 'reset-style') {
                Object.assign(settings[selected.dataset.key], resetDecoration(settings[selected.dataset.key]));
                selected.dataset.fontSize = 'normal'; selected.dataset.alignH = 'none'; selected.dataset.alignV = 'none'; selected.dataset.boxStyle = 'plain'; selected.dataset.borderStyle = 'none'; selected.dataset.shadowStyle = 'none';
                selected.classList.remove('is-title-visible','is-status-mode','has-content-box','is-emphasis','is-underlined','is-italic'); selected.style.removeProperty('--widget-text-color'); selected.style.removeProperty('--widget-bg-color'); selected.style.removeProperty('--widget-border-color'); selected.style.removeProperty('--widget-content-bg'); colorInput.value = '#111827'; bgColorInput.value = '#ffffff'; borderColorInput.value = '#334155'; contentBgColorInput.value = '#e2e8f0'; refreshPreviewTitle(selected);
            }
            if (action === 'size-minus' || action === 'size-plus') {
                const delta = action === 'size-plus' ? 1 : -1;
                const limit = sizeAxis === 'w' ? 12 : 8;
                selected.dataset[sizeAxis] = Math.max(1, Math.min(limit, +selected.dataset[sizeAxis] + delta));
            }
            selected.dataset.x = Math.min(+selected.dataset.x, 13 - +selected.dataset.w);
            const collision = [...canvas.children].some(item => item !== selected && overlaps(rectOf(selected), rectOf(item)));
            if (collision) {
                const space = nearestSpace(+selected.dataset.w, +selected.dataset.h, +selected.dataset.x, +selected.dataset.y, selected);
                selected.dataset.x = space.x; selected.dataset.y = space.y;
            }
            refreshPreviewAppearance(selected);
            place(selected); persist(selected); refreshAdvancedState();
            if (settingsUnlocked) positionObjectPopup(selected);
        });
        colorInput.addEventListener('input', () => {
            if (!selected || !settingsUnlocked) return;
            settings[selected.dataset.key] = { ...(settings[selected.dataset.key] || {}), color:colorInput.value };
            selected.style.setProperty('--widget-text-color', colorInput.value); refreshPreviewAppearance(selected); commitWidgetSettings(settings);
        });
        bgColorInput.addEventListener('input', () => {
            if (!selected || !settingsUnlocked) return;
            settings[selected.dataset.key] = { ...(settings[selected.dataset.key] || {}), backgroundColor:bgColorInput.value };
            selected.style.setProperty('--widget-bg-color', bgColorInput.value); refreshPreviewAppearance(selected); commitWidgetSettings(settings);
        });
        borderColorInput.addEventListener('input', () => {
            if (!selected || !settingsUnlocked) return;
            settings[selected.dataset.key] = { ...(settings[selected.dataset.key] || {}), borderColor:borderColorInput.value };
            selected.style.setProperty('--widget-border-color', borderColorInput.value); refreshPreviewAppearance(selected); commitWidgetSettings(settings);
        });
        contentBgColorInput.addEventListener('input', () => {
            if (!selected || !settingsUnlocked) return;
            settings[selected.dataset.key] = { ...(settings[selected.dataset.key] || {}), contentBackgroundColor:contentBgColorInput.value, contentBox:true };
            selected.classList.add('has-content-box'); selected.style.setProperty('--widget-content-bg', contentBgColorInput.value); refreshPreviewAppearance(selected); commitWidgetSettings(settings); refreshAdvancedState();
        });
        canvas.addEventListener('pointerdown', event => {
            if (event.pointerType === 'touch') activeTouches.set(event.pointerId, event.clientY);
            if (activeTouches.size > 1) {
                dragged?.classList.remove('is-moving'); dragged = null; edgeScrollSpeed = 0; clearInterval(edgeScrollTimer);
                twoFingerY = [...activeTouches.values()].reduce((sum, y) => sum + y, 0) / activeTouches.size;
                return;
            }
            const item = event.target.closest('.card-free-item'); if (!item) return;
            select(item); dragged = item; dragStart = { ...rectOf(item) }; itemPressStart = { x:event.clientX, y:event.clientY };
            lastDragPoint = { x:event.clientX, y:event.clientY }; edgeScrollSpeed = 0; clearInterval(edgeScrollTimer);
            edgeScrollTimer = setInterval(() => {
                if (!dragged || !edgeScrollSpeed || !lastDragPoint) return;
                canvas.scrollTop += edgeScrollSpeed;
                const rect = canvas.getBoundingClientRect();
                dragged.dataset.y = Math.max(1, Math.floor((lastDragPoint.y - rect.top + canvas.scrollTop) / 27) + 1); place(dragged);
            }, 32);
            item.setPointerCapture?.(event.pointerId);
            if (event.cancelable) event.preventDefault();
            event.stopPropagation();
        });
        canvas.addEventListener('pointermove', event => {
            if (event.pointerType === 'touch' && activeTouches.has(event.pointerId)) {
                activeTouches.set(event.pointerId, event.clientY);
                if (activeTouches.size > 1) {
                    const nextY = [...activeTouches.values()].reduce((sum, y) => sum + y, 0) / activeTouches.size;
                    canvas.scrollTop += twoFingerY - nextY; twoFingerY = nextY; return;
                }
            }
            if (!dragged) return;
            if (event.cancelable) event.preventDefault();
            if (itemPressStart && Math.hypot(event.clientX - itemPressStart.x, event.clientY - itemPressStart.y) > 7) {
                dragged.classList.add('is-moving');
            }
            const rect = canvas.getBoundingClientRect();
            const edgeZone = 52;
            lastDragPoint = { x:event.clientX, y:event.clientY };
            edgeScrollSpeed = event.clientY < rect.top + edgeZone ? -12 : event.clientY > rect.bottom - edgeZone ? 12 : 0;
            dragged.dataset.x = Math.max(1, Math.min(13 - +dragged.dataset.w, Math.floor((event.clientX - rect.left) / (rect.width / 12)) + 1));
            dragged.dataset.y = Math.max(1, Math.floor((event.clientY - rect.top + canvas.scrollTop) / 27) + 1); place(dragged);
        });
        const drop = event => {
            if (event?.pointerType === 'touch') activeTouches.delete(event.pointerId);
            if (!dragged) return;
            edgeScrollSpeed = 0; clearInterval(edgeScrollTimer); edgeScrollTimer = null; lastDragPoint = null;
            const hit = [...canvas.children].find(item => item !== dragged && overlaps(rectOf(dragged), rectOf(item)));
            if (hit) { const space = nearestSpace(+dragged.dataset.w, +dragged.dataset.h, +dragged.dataset.x, +dragged.dataset.y, dragged); dragged.dataset.x = space.x; dragged.dataset.y = space.y; place(dragged); }
            dragged.classList.remove('is-moving'); persist(dragged); dragged = null; dragStart = null; itemPressStart = null;
        };
        canvas.addEventListener('pointerup', drop); canvas.addEventListener('pointercancel', drop);
        canvas.addEventListener('scroll', () => {
            if (settingsUnlocked && selected && objectPopup.classList.contains('is-open')) positionObjectPopup(selected);
        }, { passive:true });
    };

    const cancelPress = () => { clearTimeout(pressTimer); pressTimer = null; pressCard = null; };
    document.addEventListener('pointerdown', event => {
        const card = event.target.closest('.log-card[data-log-cat="work"]');
        if (!card || isIgnoredTarget(event.target) || document.getElementById('workCardLayoutEditor')) return;
        cancelPress();
        pressCard = card;
        pressX = event.clientX;
        pressY = event.clientY;
        pressTimer = setTimeout(() => {
            const id = pressCard?.dataset.logId || '';
            if (!pressCard) return;
            suppressCardId = id;
            suppressUntil = Date.now() + 900;
            navigator.vibrate?.(35);
            openEditor(pressCard);
            cancelPress();
        }, 1500);
    }, true);
    document.addEventListener('pointermove', event => {
        if (pressTimer && Math.hypot(event.clientX - pressX, event.clientY - pressY) > 10) cancelPress();
    }, true);
    document.addEventListener('pointerup', cancelPress, true);
    document.addEventListener('pointercancel', cancelPress, true);
    document.addEventListener('click', event => {
        const card = event.target.closest('.log-card[data-log-cat="work"]');
        if (card && card.dataset.logId === suppressCardId && Date.now() < suppressUntil) {
            event.preventDefault();
            event.stopImmediatePropagation();
        }
    }, true);
    document.addEventListener('click', event => {
        const widget = event.target.closest('.work-card-subwidget,.work-card-widget');
        if (!widget || document.getElementById('workCardLayoutEditor') || event.target.closest('button,a,img')) return;
        if (!widget.matches('.widget-height-one,.widget-height-two')) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        widget.classList.toggle('is-widget-expanded');
    }, true);

    const fitCardObjectText = root => requestAnimationFrame(() => {
        const scope = root?.querySelectorAll ? root : document;
        scope.querySelectorAll('.work-card-subwidget').forEach(cell => {
            if (cell.dataset.cardSectionKey === 'object:delete' || !cell.clientWidth || !cell.clientHeight) return;
            cell.style.removeProperty('--widget-fit-font');
            const sample = cell.querySelector(':scope > :not(.work-card-object-title),span,b') || cell;
            let size = parseFloat(getComputedStyle(sample).fontSize) || 12.5;
            while (size > 8 && (cell.scrollWidth > cell.clientWidth + 1 || cell.scrollHeight > cell.clientHeight + 1)) {
                size -= .5; cell.style.setProperty('--widget-fit-font', `${size}px`);
            }
        });
    });
    fitCardObjectText(document);
    new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => {
        if (node.nodeType === 1 && (node.matches?.('.work-card-columns,.card-free-preview') || node.querySelector?.('.work-card-subwidget'))) fitCardObjectText(node);
    }))).observe(document.body, { childList:true, subtree:true });
})();
