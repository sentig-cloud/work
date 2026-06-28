// work_enhancements.js (v3 - 개별 객체 선택 + w95 스타일 패널)
(function () {
    "use strict";

    // ═══════════════════════════════════════════
    // 유틸
    // ═══════════════════════════════════════════
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
    const snap = () => ({
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
        if (btn) btn.disabled = !window.workUndoStack.length;
    };

    // undoWorkDraft: 완전판은 아래에서 정의

    const bindDraftFieldUndo = () => {
        const modal = document.getElementById("workModal"); if (!modal) return;
        let before = null;
        modal.addEventListener("focusin", () => {
            if (/^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName)) before = snap();
        });
        modal.addEventListener("change", () => {
            if (!before) return;
            const cur = snap();
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

    // 현재 선택된 객체 정보
    // { el, type: 'section'|'widget'|'tag-btn', parent, isResizable }
    let selected = null;
    let objPanel = null; // w95 스타일 팝업

    const getContainer = () => document.getElementById("workDragContainer");
    const getAllSections = (c) => [...(c || getContainer())?.querySelectorAll(":scope > .drag-item") || []];

    // ─── 객체 타입 판별 ───
    // work-obj-wrap: drag-item 안의 개별 input/button 래퍼
    // tag-btn: 선택태그 버튼
    // section: drag-item 블록 전체
    // group: 그룹 블록
    const getObjType = (el) => {
        if (!el) return null;
        // 1. work-obj-wrap (개별 input/button)
        if (el.classList.contains("work-obj-wrap")) return "obj";
        const wrap = el.closest(".work-obj-wrap");
        if (wrap) return "obj";
        // 2. 태그 버튼
        if (el.classList.contains("layout-tag-button")) return "tag-btn";
        const tagBtn = el.closest(".layout-tag-button");
        if (tagBtn) return "tag-btn";
        // 3. 그룹 블록
        if (el.classList.contains("is-group-block")) return "group";
        const grp = el.closest(".is-group-block");
        if (grp && !el.closest(".group-block-inner")) return "group";
        // 4. drag-item 섹션
        if (el.classList.contains("drag-item")) return "section";
        const sec = el.closest("#workDragContainer > .drag-item");
        if (sec) return "section";
        return null;
    };

    // 실제 대상 요소 반환
    const getObjEl = (el) => {
        if (!el) return null;
        if (el.classList.contains("work-obj-wrap")) return el;
        const wrap = el.closest(".work-obj-wrap");
        if (wrap) return wrap;
        if (el.classList.contains("layout-tag-button")) return el;
        const tagBtn = el.closest(".layout-tag-button");
        if (tagBtn) return tagBtn;
        if (el.classList.contains("is-group-block")) return el;
        const grp = el.closest(".is-group-block");
        if (grp && !el.closest(".group-block-inner")) return grp;
        if (el.classList.contains("drag-item")) return el;
        return el.closest("#workDragContainer > .drag-item");
    };

    // 리사이즈 가능 여부
    const isResizable = (el, type) => {
        if (type === "tag-btn") return false;
        if (type === "obj") {
            // 태그 영역(btn-tag-area)은 리사이즈 없음
            if (el.querySelector(".btn-tag-area")) return false;
            return true;
        }
        return true;
    };

    // obj 레이블
    const getObjLabel = (el, type) => {
        if (type === "obj") return el.dataset.objLabel || el.dataset.objId || "객체";
        if (type === "tag-btn") return `태그: ${el.dataset.tagName || el.textContent.trim().slice(0,10)}`;
        if (type === "group") return el.querySelector(".group-title-text")?.textContent || "그룹";
        if (type === "section") return el.querySelector(".box-title")?.textContent || `블록 ${el.dataset.id||""}`;
        return "객체";
    };

    // ─── 선택 표시 ───
    const SELECTED_CLASS = "is-obj-selected";
    const clearSelected = () => {
        document.querySelectorAll("." + SELECTED_CLASS).forEach(el => el.classList.remove(SELECTED_CLASS));
        selected = null;
    };

    const markSelected = (el) => {
        clearSelected();
        el.classList.add(SELECTED_CLASS);
    };

    // ─── w95 스타일 패널 ───
    const W95_PANEL_ID = "layoutObjPanel";

    const removePanel = () => {
        const old = document.getElementById(W95_PANEL_ID);
        if (old) old.remove();
        objPanel = null;
    };

    const buildPanel = (el, type) => {
        removePanel();

        const canResize = isResizable(el, type);
        const isGroup = type === "group";
        const isTagBtn = type === "tag-btn";

        // 제목
        let title = getObjLabel(el, type);
        if (type === "obj") title = el.dataset.objLabel || el.dataset.objId || "객체";

        // 그룹 목록 (이동 대상)
        const groups = getAllSections().filter(s => s.classList.contains("is-group-block"));
        const groupOptions = groups.length
            ? groups.map(g => {
                const gTitle = g.querySelector(".group-title-text")?.textContent || g.dataset.id;
                return `<option value="${esc(g.dataset.id)}">${esc(gTitle)}</option>`;
            }).join("")
            : "";

        // 현재 크기
        const curCols = Number(el.dataset.cols || el.dataset.widgetCols || GRID_COLS);
        const curRows = Number(el.dataset.rows || el.dataset.widgetRows || 1);

        // 패널 HTML (w95 스타일)
        const panel = document.createElement("div");
        panel.id = W95_PANEL_ID;
        panel.className = "w95-window";
        panel.style.cssText = `
            position:fixed; z-index:9500; min-width:180px; max-width:220px;
            display:flex; flex-direction:column;
            border: 2px solid; border-color: #fff #000 #000 #fff;
            box-shadow: 3px 3px 6px rgba(0,0,0,0.5);
        `;

        panel.innerHTML = `
            <div class="w95-titlebar" style="padding:3px 6px; font-size:0.8rem; display:flex; justify-content:space-between; align-items:center; gap:4px;">
                <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;" title="${esc(title)}">${esc(title)}</span>
                <button type="button" class="w95-btn" id="objPanelClose"
                    style="width:18px;height:18px;padding:0;font-size:0.75rem;flex-shrink:0;line-height:1;">✕</button>
            </div>
            <div style="padding:6px;display:flex;flex-direction:column;gap:5px;background:var(--w-gray);">

                ${/* 이동 버튼 */""}
                <div style="display:flex;gap:4px;">
                    <button type="button" class="w95-btn" id="objPanelMoveUp"
                        style="flex:1;height:28px;font-size:0.8rem;"
                        title="위로 이동">▲ 위</button>
                    <button type="button" class="w95-btn" id="objPanelMoveDown"
                        style="flex:1;height:28px;font-size:0.8rem;"
                        title="아래로 이동">▼ 아래</button>
                </div>

                ${/* 그룹으로 이동 (그룹 있을 때만) */groups.length && !isGroup ? `
                <div style="display:flex;gap:4px;align-items:center;">
                    <select id="objPanelGroupSel" class="w95-in m-input"
                        style="flex:1;height:26px;font-size:0.78rem;padding:0 3px;">
                        <option value="">그룹 선택…</option>
                        ${groupOptions}
                    </select>
                    <button type="button" class="w95-btn" id="objPanelMoveToGroup"
                        style="height:26px;padding:0 6px;font-size:0.78rem;color:var(--w-blue);font-weight:bold;">→</button>
                </div>` : ""}

                ${/* 크기 조절 (리사이즈 가능한 것만) */canResize ? `
                <div style="border-top:1px solid var(--w-dark-gray);padding-top:5px;">
                    <div style="font-size:0.72rem;color:#555;margin-bottom:3px;font-weight:bold;">크기 조절</div>
                    <div style="display:flex;align-items:center;gap:3px;margin-bottom:3px;">
                        <span style="font-size:0.72rem;width:22px;">가로</span>
                        <button type="button" class="w95-btn" data-action="cols-" style="width:24px;height:24px;padding:0;font-size:0.9rem;">−</button>
                        <span id="objPanelCols" style="width:20px;text-align:center;font-size:0.85rem;font-weight:bold;">${curCols}</span>
                        <button type="button" class="w95-btn" data-action="cols+" style="width:24px;height:24px;padding:0;font-size:0.9rem;">＋</button>
                        <span style="font-size:0.7rem;color:#888;">/ ${GRID_COLS}칸</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:3px;">
                        <span style="font-size:0.72rem;width:22px;">세로</span>
                        <button type="button" class="w95-btn" data-action="rows-" style="width:24px;height:24px;padding:0;font-size:0.9rem;">−</button>
                        <span id="objPanelRows" style="width:20px;text-align:center;font-size:0.85rem;font-weight:bold;">${curRows}</span>
                        <button type="button" class="w95-btn" data-action="rows+" style="width:24px;height:24px;padding:0;font-size:0.9rem;">＋</button>
                        <span style="font-size:0.7rem;color:#888;">줄</span>
                    </div>
                </div>` : `
                <div style="font-size:0.72rem;color:#888;text-align:center;padding:2px 0;">
                    ℹ 태그는 글자 수에 따라 자동 크기
                </div>`}

                ${/* 그룹 전용 버튼 */isGroup ? `
                <div style="border-top:1px solid var(--w-dark-gray);padding-top:5px;display:flex;flex-direction:column;gap:3px;">
                    <button type="button" class="w95-btn" id="objPanelAddTag"
                        style="height:26px;font-size:0.78rem;color:#059669;font-weight:bold;">
                        + 선택태그 추가</button>
                    <button type="button" class="w95-btn" id="objPanelRenameGroup"
                        style="height:26px;font-size:0.78rem;">이름 변경</button>
                    <button type="button" class="w95-btn" id="objPanelUngroup"
                        style="height:26px;font-size:0.78rem;color:#dc2626;font-weight:bold;">그룹해제</button>
                </div>` : ""}

            </div>
        `;

        document.body.appendChild(panel);
        objPanel = panel;

        // 위치 계산
        positionPanel(el);

        // ─── 이벤트 바인딩 ───

        panel.querySelector("#objPanelClose")?.addEventListener("click", (e) => {
            e.stopPropagation();
            closeObjPanel();
        });

        // 위/아래 이동
        panel.querySelector("#objPanelMoveUp")?.addEventListener("click", () => moveObj(el, type, "up"));
        panel.querySelector("#objPanelMoveDown")?.addEventListener("click", () => moveObj(el, type, "down"));

        // 그룹으로 이동
        panel.querySelector("#objPanelMoveToGroup")?.addEventListener("click", () => {
            const sel = panel.querySelector("#objPanelGroupSel");
            const groupId = sel?.value;
            if (!groupId) return;
            moveObjToGroup(el, type, groupId);
        });

        // 크기 +/-
        panel.querySelectorAll("[data-action]").forEach(btn => {
            btn.addEventListener("click", () => {
                const action = btn.dataset.action;
                adjustObjSize(el, type, action);
                // 표시 업데이트
                const c = Number(el.dataset.cols || el.dataset.widgetCols || GRID_COLS);
                const r = Number(el.dataset.rows || el.dataset.widgetRows || 1);
                const colsEl = panel.querySelector("#objPanelCols");
                const rowsEl = panel.querySelector("#objPanelRows");
                if (colsEl) colsEl.textContent = c;
                if (rowsEl) rowsEl.textContent = r;
            });
        });

        // 그룹 전용
        panel.querySelector("#objPanelAddTag")?.addEventListener("click", () => addTagToGroup(el));
        panel.querySelector("#objPanelRenameGroup")?.addEventListener("click", () => renameGroup(el));
        panel.querySelector("#objPanelUngroup")?.addEventListener("click", () => ungroupBlock(el));
    };

    const positionPanel = (anchorEl) => {
        if (!objPanel) return;
        const rect = anchorEl.getBoundingClientRect();
        const pw = objPanel.offsetWidth || 200;
        const ph = objPanel.offsetHeight || 220;
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        let left = rect.left + rect.width / 2 - pw / 2;
        let top = rect.bottom + 8;

        if (left < 6) left = 6;
        if (left + pw > vw - 6) left = vw - pw - 6;
        if (top + ph > vh - 6) top = rect.top - ph - 8;
        if (top < 6) top = 6;

        objPanel.style.left = left + "px";
        objPanel.style.top = top + "px";
    };

    const closeObjPanel = () => {
        if (objPanel) {
            objPanel.classList.remove("is-visible");
            objPanel.classList.remove("is-obj-panel-open");
        }
        removePanel();
        clearSelected();
    };

    // ─── 객체 탭 → 패널 표시 ───
    const onObjTap = (e) => {
        if (!window.isWorkLayoutMode) return;
        if (objPanel && objPanel.contains(e.target)) return;

        // 패널이 열려있으면 닫기
        if (objPanel && objPanel.classList.contains("is-obj-panel-open")) {
            closeObjPanel();
            return;
        }

        const modal = document.getElementById("workModal");
        if (!modal || !modal.contains(e.target)) return;

        let el = null, type = null;

        // 우선순위: work-obj-wrap > tag-btn > group titlebar > section
        // 1. work-obj-wrap (개별 input/button 래퍼) - 최우선
        const wrap = e.target.closest(".work-obj-wrap");
        if (wrap && modal.contains(wrap)) {
            el = wrap; type = "obj";
        }
        // 2. 태그 버튼
        if (!el) {
            const tagBtn = e.target.closest(".layout-tag-button");
            if (tagBtn && modal.contains(tagBtn)) { el = tagBtn; type = "tag-btn"; }
        }
        // 3. 그룹 타이틀바 탭 → 그룹 선택
        if (!el) {
            const grpTitle = e.target.closest(".group-block-titlebar");
            if (grpTitle) {
                const grp = grpTitle.closest(".is-group-block");
                if (grp) { el = grp; type = "group"; }
            }
        }
        // 4. drag-item 섹션 배경 탭 (위 해당 없을 때)
        if (!el) {
            const sec = e.target.closest("#workDragContainer > .drag-item");
            if (sec && !e.target.closest(".work-obj-wrap") && !e.target.closest(".btn-tag-area")) {
                el = sec; type = "section";
            }
        }

        if (!el || !type) return;

        e.preventDefault();
        e.stopPropagation();

        markSelected(el);
        selected = { el, type };
        buildPanel(el, type);
    };

    // ─── 위/아래 이동 ───
    const moveObj = (el, type, dir) => {
        if (type === "section" || type === "group") {
            const container = getContainer();
            if (!container) return;
            const siblings = getAllSections(container);
            const idx = siblings.indexOf(el);
            if (dir === "up" && idx > 0) container.insertBefore(el, siblings[idx - 1]);
            else if (dir === "down" && idx < siblings.length - 1) container.insertBefore(el, siblings[idx + 2] || null);
        } else if (type === "obj") {
            // work-obj-wrap: 같은 drag-item 안에서 이동
            const parent = el.parentElement;
            if (!parent) return;
            const siblings = [...parent.querySelectorAll(":scope > .work-obj-wrap")];
            const idx = siblings.indexOf(el);
            if (dir === "up" && idx > 0) parent.insertBefore(el, siblings[idx - 1]);
            else if (dir === "down" && idx < siblings.length - 1) parent.insertBefore(el, siblings[idx + 2] || null);
        } else if (type === "tag-btn") {
            const area = el.parentElement;
            if (!area) return;
            const btns = [...area.querySelectorAll(".layout-tag-button")];
            const idx = btns.indexOf(el);
            if (dir === "up" && idx > 0) area.insertBefore(el, btns[idx - 1]);
            else if (dir === "down" && idx < btns.length - 1) area.insertBefore(el, btns[idx + 2] || null);
        }
        window.saveWorkLayout();
        positionPanel(el);
    };

    // ─── 그룹으로 이동 ───
    const moveObjToGroup = (el, type, groupId) => {
        const container = getContainer();
        const groupBlock = container?.querySelector(`.drag-item[data-id="${groupId}"]`);
        if (!groupBlock) return;
        const inner = groupBlock.querySelector(".group-block-inner");
        if (!inner) return;

        if (type === "section") {
            inner.appendChild(el);
        } else if (type === "obj") {
            // work-obj-wrap을 그룹 내로 이동
            // 먼저 임시 섹션 블록을 만들어서 감싸기
            const secId = "moved_" + Date.now();
            let wrapper = document.createElement("div");
            wrapper.className = "drag-item w95-out";
            wrapper.dataset.id = secId;
            wrapper.style.cssText = "--item-cols:4;--item-rows:1;";
            wrapper.appendChild(el);
            inner.appendChild(wrapper);
        } else if (type === "tag-btn") {
            inner.appendChild(el);
        }

        window.saveWorkLayout();
        positionPanel(el);
    };

    // ─── 크기 조절 (+/-) ───
    const adjustObjSize = (el, type, action) => {
        if (type === "section" || type === "group") {
            let c = Number(el.dataset.cols || GRID_COLS);
            let r = Number(el.dataset.rows || 1);
            if (action === "cols+") c = Math.min(GRID_COLS, c + 1);
            else if (action === "cols-") c = Math.max(1, c - 1);
            else if (action === "rows+") r = Math.min(20, r + 1);
            else if (action === "rows-") r = Math.max(1, r - 1);
            setBlockSize(el, c, r);
        } else if (type === "obj") {
            // work-obj-wrap: flex-grow / height 조절
            let cols = Number(el.dataset.objCols || 1);
            let rows = Number(el.dataset.objRows || 1);
            const parent = el.closest(".drag-item");
            const totalCols = parent ? GRID_COLS : 4;
            if (action === "cols+") cols = Math.min(totalCols, cols + 1);
            else if (action === "cols-") cols = Math.max(1, cols - 1);
            else if (action === "rows+") rows = Math.min(6, rows + 1);
            else if (action === "rows-") rows = Math.max(1, rows - 1);
            el.dataset.objCols = cols;
            el.dataset.objRows = rows;
            el.style.setProperty("--obj-cols", cols);
            el.style.setProperty("--obj-rows", rows);
            // 높이 적용
            const baseH = 30;
            el.style.minHeight = rows > 1 ? `${rows * baseH + (rows-1)*2}px` : "";
            // 내부 input/textarea 높이도 조절
            const inner = el.querySelector("input, textarea");
            if (inner && rows > 1) inner.style.height = `${rows * baseH}px`;
        }
        window.saveWorkLayout();
    };

    // ─── 그룹에 선택태그 추가 ───
    const addTagToGroup = (groupEl) => {
        const name = prompt("새 선택태그 그룹 이름을 입력하세요.");
        if (!name?.trim()) return;

        let newGroup = null;
        if (window.addCustomGroup) {
            newGroup = window.addCustomGroup(name.trim());
            window.markDirty?.("master", "groups", "upsert");
            window.saveLocal?.("group-add");
        }

        const tagSection = document.createElement("div");
        tagSection.className = "drag-item w95-in";
        tagSection.dataset.id = "grp_tag_" + (newGroup ? newGroup.id : Date.now());
        tagSection.dataset.groupId = newGroup ? newGroup.id : "";
        setBlockSize(tagSection, GRID_COLS, 1);
        tagSection.innerHTML = `
            <div class="box-title">${esc(name.trim())}</div>
            <div id="customGroupArea_${newGroup ? newGroup.id : "tmp"}" class="btn-tag-area"></div>
        `;

        const inner = groupEl.querySelector(".group-block-inner");
        if (inner) inner.appendChild(tagSection);

        if (newGroup && window.renderCustomGroup) window.renderCustomGroup(newGroup.id);
        window.saveWorkLayout();
        closeObjPanel();
    };

    // ─── 그룹 이름 변경 ───
    const renameGroup = (groupEl) => {
        const titleEl = groupEl.querySelector(".group-title-text");
        const old = titleEl?.textContent || "";
        const neu = prompt("그룹 이름을 입력하세요.", old);
        if (!neu?.trim() || neu.trim() === old) return;
        if (titleEl) titleEl.textContent = neu.trim();

        // groups 데이터도 업데이트
        const g = window.getGroupById?.(groupEl.dataset.groupRef);
        if (g) {
            g.title = neu.trim();
            window.markDirty?.("master", "groups", "upsert");
            window.saveLocal?.("group-title");
        }
        window.saveWorkLayout();
    };

    // ─── 그룹해제 ───
    const ungroupBlock = (groupEl) => {
        if (!confirm("그룹을 해제하시겠습니까?\n커스텀 태그 상자는 비활성화됩니다.")) return;
        const container = getContainer();
        if (!container) return;

        const inner = groupEl.querySelector(".group-block-inner");
        const children = inner ? [...inner.querySelectorAll(":scope > .drag-item")] : [];
        const builtInIds = ["1", "2", "3", "4", "5", "6", "7"];

        children.forEach(block => {
            const isBuiltIn = builtInIds.includes(block.dataset.id);
            const isCustomTag = block.dataset.id?.startsWith("grp_tag_");
            if (isCustomTag) {
                block.classList.add("is-group-disabled");
                const gId = block.dataset.groupId;
                if (gId && window.getGroupById) {
                    const g = window.getGroupById(gId);
                    if (g) { g.enabled = false; window.markDirty?.("master", "groups", "upsert"); }
                }
            }
            setBlockSize(block, GRID_COLS, Number(block.dataset.rows) || 1);
            container.insertBefore(block, groupEl);
        });

        groupEl.remove();
        closeObjPanel();
        window.saveWorkLayout();
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
        cell.style.minHeight = `calc((${r} * 32px) + ((${r} - 1) * 2px))`;
    };

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
    window.ensureInnerLayoutObjects = () => {
        const specs = [
            { key: "1-top", items: [
                ["date", document.getElementById("workDateInput")?.parentElement, 2, 1],
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
                ["address", document.getElementById("workAddress"), 5, 1],
                ["map", document.getElementById("workAddress")?.parentElement?.querySelector("button"), 1, 1]
            ]},
            { key: "2-text", items: [
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
            group.style.cssText += ";display:grid;grid-template-columns:repeat(6,minmax(0,1fr));";
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
                if (!cell.querySelector(":scope > .widget-resize-handle")) {
                    const h = document.createElement("div");
                    h.className = "widget-resize-handle";
                    cell.appendChild(h);
                }
            });
        });
    };

    window.ensureBlockHandles = () => {}; // v3에서는 패널로 대체

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
            closeObjPanel();
            window.saveWorkLayout();
            window.applyWorkLayout();
        }

        modal?.classList.toggle("layout-edit-mode", window.isWorkLayoutMode);
        titlebar?.classList.toggle("is-layout-edit", window.isWorkLayoutMode);
    };

    window.startWorkLayoutPress = (event) => {
        if (event) event.preventDefault();
        clearTimeout(window.workLayoutPressTimer);
        window.workLayoutLongPressed = false;
        const btn = document.getElementById("workLayoutModeBtn");
        if (btn) btn.classList.add("is-layout-pressing");
        window.workLayoutPressTimer = setTimeout(() => {
            window.workLayoutLongPressed = true;
            window.setWorkLayoutMode(true);
            document.getElementById("workLayoutModeBtn")?.classList.remove("is-layout-pressing");
            if (navigator.vibrate) navigator.vibrate(40);
        }, 2000);
    };

    window.endWorkLayoutPress = (event) => {
        if (event) event.preventDefault();
        clearTimeout(window.workLayoutPressTimer);
        document.getElementById("workLayoutModeBtn")?.classList.remove("is-layout-pressing");
        if (!window.workLayoutLongPressed && window.isWorkLayoutMode) window.setWorkLayoutMode(false);
        window.workLayoutLongPressed = false;
    };

    window.cancelWorkLayoutPress = () => {
        clearTimeout(window.workLayoutPressTimer);
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
        window.ensureInnerLayoutObjects();
    };

    // ─── 그룹 추가 (타이틀바 버튼) ───
    window.groupSelectedBlocks = () => {
        if (!window.isWorkLayoutMode) return;
        const title = prompt("새 그룹 이름을 입력하세요.", "새 그룹");
        if (!title?.trim()) return;

        const container = getContainer(); if (!container) return;
        const groupId = "grp_" + Date.now();
        const groupEl = document.createElement("div");
        groupEl.className = "drag-item is-group-block";
        groupEl.dataset.id = groupId;
        groupEl.dataset.groupRef = groupId;
        setBlockSize(groupEl, GRID_COLS, 2);

        groupEl.innerHTML = `
            <div class="group-block-titlebar w95-titlebar" style="font-size:0.8rem;padding:3px 6px;">
                <span class="group-title-text">${esc(title.trim())}</span>
            </div>
            <div class="group-block-inner" style="--group-cols:${GRID_COLS};padding:2px;display:grid;grid-template-columns:repeat(${GRID_COLS},minmax(0,1fr));gap:2px;"></div>
        `;

        // 선택된 섹션이 있으면 그 위치에, 없으면 맨 아래
        const selSection = selected?.type === "section" ? selected.el : null;
        if (selSection && selSection.parentElement === container) {
            container.insertBefore(groupEl, selSection.nextSibling);
        } else {
            container.appendChild(groupEl);
        }

        // v2 groups 등록
        if (window.addCustomGroup) {
            const g = window.addCustomGroup(title.trim());
            if (g) groupEl.dataset.groupRef = g.id;
            window.markDirty?.("master", "groups", "upsert");
        }

        closeObjPanel();
        window.saveWorkLayout();
    };

    window.ungroupSelectedBlock = () => {
        if (!window.isWorkLayoutMode) {
            alert("레이아웃 편집 모드에서 사용하세요.");
            return;
        }
        if (!selected || selected.type !== "group") {
            alert("그룹 블록을 탭해서 선택한 뒤 그룹해제를 누르세요.");
            return;
        }
        ungroupBlock(selected.el);
    };

    // ═══════════════════════════════════════════
    // 이벤트 리스너 초기화
    // ═══════════════════════════════════════════
    window.hasInitDragListeners = false;
    window.initWorkDragListeners = () => {
        if (window.hasInitDragListeners) return;
        const modal = document.getElementById("workModal");
        if (!modal) return;

        // 탭/클릭 → 객체 선택 패널
        modal.addEventListener("touchend", onObjTap, { passive: false });
        modal.addEventListener("click", onObjTap);

        window.hasInitDragListeners = true;
    };

    window.hasInitTagReorderListeners = false;
    window.initTagReorderListeners = () => {
        if (window.hasInitTagReorderListeners) return;
        // 레이아웃 모드 탭은 onObjTap에서 통합 처리
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

    // ─── CSS: 선택 표시 (is-obj-selected) ───
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
        #${W95_PANEL_ID} .w95-btn:active {
            border-color: var(--w-black) var(--w-white) var(--w-white) var(--w-black);
            box-shadow: inset 1px 1px var(--w-dark-gray);
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
        if (type === "task") window.activeTaskTypes = (window.activeTaskTypes || []).filter((i) => i !== tag.name);
        if (type === "coworker") window.selectedCoworkers = (window.selectedCoworkers || []).filter((i) => i !== tag.name);
        if (type === "status" && window.activeStatus === tag.name) window.activeStatus = null;
        if (type === "memoTag") window.activeEditTags = (window.activeEditTags || []).filter((i) => i !== tag.name);
        if (type === "equip" && window.activeEquips) delete window.activeEquips[tag.name];
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
        let pendingSelectCell = null, pressOrigin = null;
        let timer = null, resizeModeTimer = null, resizeHandleLongPressed = false;

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
            cell.style.minHeight = `calc((${r} * 32px) + ((${r} - 1) * 2px))`;
        };

        const start = (event) => {
            if (!window.isWorkLayoutMode) return;
            clearTimeout(timer); clearTimeout(resizeModeTimer);
            resizeHandleLongPressed = false; pendingResizeCell = null; pendingResizeStart = null;
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
                    colWidth: Math.max(1, groupRect.width / 6), rowHeight: 32
                };
                resizeModeTimer = setTimeout(() => {
                    resizeHandleLongPressed = true;
                    dragCell = pendingResizeCell; dragGroup = pendingResizeCell && pendingResizeCell.parentElement;
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
                const dist = Math.hypot(point.clientX - pendingResizeStart.x, point.clientY - pendingResizeStart.y);
                if (resizeHandleLongPressed) { pendingResizeCell = null; pendingResizeStart = null; }
                else if (dist > 10) {
                    clearTimeout(resizeModeTimer);
                    resizeCell = pendingResizeCell; resizeStart = pendingResizeStart;
                    pendingResizeCell = null; pendingResizeStart = null;
                } else return;
            }
            if (resizeCell && resizeStart) {
                if (event.cancelable) event.preventDefault();
                setWSize(resizeCell,
                    resizeStart.cols + Math.round((point.clientX - resizeStart.x) / resizeStart.colWidth),
                    resizeStart.rows + Math.round((point.clientY - resizeStart.y) / resizeStart.rowHeight));
                return;
            }
            if (!dragCell || !dragGroup) {
                if (pressOrigin && Math.hypot(point.clientX - pressOrigin.x, point.clientY - pressOrigin.y) > 12) clearTimeout(timer);
                return;
            }
            if (event.cancelable) event.preventDefault();
            const over = document.elementFromPoint(point.clientX, point.clientY);
            const target = over && over.closest(".inner-layout-cell");
            modal.querySelectorAll(".is-widget-drop-target").forEach((i) => i.classList.remove("is-widget-drop-target"));
            if (!target || target === dragCell || target.parentElement !== dragGroup) return;
            const rect = target.getBoundingClientRect();
            target.classList.add("is-widget-drop-target");
            const before = point.clientY < rect.top + rect.height / 2 ||
                (Math.abs(point.clientY - (rect.top + rect.height / 2)) < rect.height / 3 && point.clientX < rect.left + rect.width / 2);
            dragGroup.insertBefore(dragCell, before ? target : target.nextSibling);
        };

        const end = () => {
            clearTimeout(timer); clearTimeout(resizeModeTimer);
            modal.querySelectorAll(".is-widget-drop-target").forEach((i) => i.classList.remove("is-widget-drop-target"));
            const moved = !!dragCell, resized = !!resizeCell || resizeHandleLongPressed;
            if (dragCell) dragCell.classList.remove("is-widget-dragging");
            if (dragCell || resizeCell) window.saveWorkLayout && window.saveWorkLayout();
            if (pendingSelectCell && !moved && !resized) selectCell(pendingSelectCell);
            dragCell = null; dragGroup = null; resizeCell = null; resizeStart = null;
            pendingResizeCell = null; pendingResizeStart = null;
            resizeHandleLongPressed = false; pendingSelectCell = null; pressOrigin = null;
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