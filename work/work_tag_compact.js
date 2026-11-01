// work_tag_compact.js
// 작업일지 "선택태그 상자 그룹" 태그상자 표시 방식(메인 설정에서 선택).
// - 작업유형, 상태, 장비 … 각 그룹이 태그상자 하나가 되어 한 줄에 이어서(넘치면 다음 줄로) 보인다.
//   아무것도 안 골랐으면 그룹 이름(점선 상자), 고르면 그 상자 이름이 선택한 태그 이름(진한 상자)으로 바뀐다.
// - 상자를 누르면 그 상자 밑에 말풍선이 열리고 그 그룹의 태그들이 나온다. 말풍선은 줄 안에 끼어들어서
//   뒤쪽 상자들은 말풍선 아래 줄로 밀려난다. 닫히면 말풍선은 사라진다.
// - 단일 선택 그룹은 하나 고르면 바로 닫힌다. 중복 선택 그룹은 [확인]/[취소] — 취소는 말풍선을 연 뒤
//   바꾼 선택을 되돌린다. 다른 곳을 누르면(설정: 바깥 누르면 닫기) 확인으로 본다.
// - X를 길게 눌러 들어가는 레이아웃 변경 모드에서는 기존 상자 모양 그대로 보여준다(CSS 참고).
// 태그 버튼/선택 로직은 기존 것을 그대로 쓴다: 말풍선을 여는 동안 그룹의 태그 영역(.btn-tag-area)을
// 말풍선 안으로 잠시 옮겼다가 닫을 때 제자리로 돌려놓는다(렌더 함수들은 id로 찾으므로 그대로 동작).

(() => {
    const MODE_KEY = 'wm_tag_compact_mode';
    const CLOSE_KEY = 'wm_tag_compact_close';
    const BOX_CLASS = 'tag-compact-box';

    window.isTagCompactMode = () => localStorage.getItem(MODE_KEY) === '1';
    window.getTagCompactCloseMode = () => localStorage.getItem(CLOSE_KEY) === 'ok' ? 'ok' : 'outside';

    window.setTagCompactSettings = (compact, closeMode) => {
        const prev = `${localStorage.getItem(MODE_KEY)}|${localStorage.getItem(CLOSE_KEY)}`;
        localStorage.setItem(MODE_KEY, compact ? '1' : '0');
        localStorage.setItem(CLOSE_KEY, closeMode === 'ok' ? 'ok' : 'outside');
        applyMode();
        // 다른 기기에도 같은 표시 방식이 적용되도록 화면 설정(uiSettings)과 함께 서버로 보낸다.
        if (prev !== `${localStorage.getItem(MODE_KEY)}|${localStorage.getItem(CLOSE_KEY)}`) {
            window.markDirty?.('master', 'tagCompact', 'upsert');
            window.scheduleSync?.();
        }
    };

    const getModal = () => document.getElementById('workModal');
    const getContainer = () => document.getElementById('workDragContainer');

    const isActive = () => {
        const modal = getModal();
        return !!modal && window.isTagCompactMode() && !modal.classList.contains('layout-edit-mode');
    };

    // 태그상자로 바꿀 그룹: 태그 영역이 있는 그룹 상자(시작/종료 같은 특수 그룹, 숨긴 그룹 제외)
    const tagBoxes = () => [...(getContainer()?.querySelectorAll(':scope > .drag-item[data-group-ref]') || [])]
        .filter(item => item.dataset.groupRef !== 'duration' && !item.classList.contains('is-hidden-in-work')
            && (item.querySelector(':scope > .btn-tag-area') || open?.item === item));

    let open = null; // { item, chip, bubble, area, placeholder, snapshot, undoLen }

    const areaOf = (item) => item.querySelector(':scope > .btn-tag-area') || (open?.item === item ? open.area : null);
    const groupTitleOf = (item) => (item.querySelector(':scope > .box-title')?.textContent || '').trim() || '그룹';

    // ─── 태그상자 줄 ───
    let observer = null;
    function getRow() {
        const container = getContainer();
        if (!container) return null;
        let row = container.querySelector(':scope > .tag-chip-row');
        if (!row) {
            row = document.createElement('div');
            row.className = 'tag-chip-row';
            row.addEventListener('click', onRowClick);
        }
        return row;
    }

    function refreshAll() {
        const container = getContainer();
        if (!container) return;
        const row = getRow();
        const boxes = tagBoxes();
        boxes.forEach(item => { if (!item.classList.contains(BOX_CLASS)) item.classList.add(BOX_CLASS); });
        // 줄은 첫 그룹 상자 자리에 둔다(레이아웃 순서를 바꾸면 따라간다)
        if (boxes.length) {
            if (row.nextElementSibling !== boxes[0] || row.parentNode !== container) container.insertBefore(row, boxes[0]);
        } else if (row.parentNode) {
            row.remove();
        }

        const locked = !!window.isWorkEditLocked;
        const existing = new Map([...row.querySelectorAll(':scope > .tag-chip')].map(c => [c.dataset.groupRef, c]));
        const seq = []; // 줄 안에 있어야 할 순서(열린 말풍선은 그 상자 바로 뒤)
        boxes.forEach(item => {
            const ref = item.dataset.groupRef;
            let chip = existing.get(ref);
            existing.delete(ref);
            if (!chip) {
                chip = document.createElement('button');
                chip.type = 'button';
                chip.className = 'w95-btn tag-chip';
                chip.dataset.groupRef = ref;
            }
            const area = areaOf(item);
            const names = area ? [...area.querySelectorAll('.active-btn')].map(b => b.textContent.trim()).filter(Boolean) : [];
            const title = groupTitleOf(item);
            const text = names.length ? names.join(', ') : title;
            if (chip.textContent !== text) chip.textContent = text;
            const tip = names.length ? `${title}: ${names.join(', ')}` : `${title} · 눌러서 선택`;
            if (chip.title !== tip) chip.title = tip;
            const excluded = !!item.querySelector(':scope > .box-title.is-log-excluded');
            setClass(chip, 'has-value', names.length > 0);
            setClass(chip, 'is-excluded', excluded);
            setClass(chip, 'is-open', open?.item === item);
            setClass(chip, 'is-locked', locked);
            seq.push(chip);
            if (open?.item === item) { open.chip = chip; seq.push(open.bubble); }
        });
        existing.forEach(chip => chip.remove());
        seq.forEach((node, i) => { if (row.children[i] !== node) row.insertBefore(node, row.children[i] || null); });
        if (open) refreshBubbleHead();
        if (open) positionArrow();
        observer?.takeRecords(); // 방금 우리가 바꾼 것 때문에 다시 불리지 않게
    }

    function setClass(el, cls, on) {
        if (el.classList.contains(cls) !== on) el.classList.toggle(cls, on);
    }

    function observe() {
        const container = getContainer();
        if (!container || observer) return;
        // 태그가 다시 그려지거나 선택/이름/집계 상태가 바뀌면 상자 이름을 갱신한다
        observer = new MutationObserver(() => refreshAll());
        observer.observe(container, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class'] });
    }

    function applyMode() {
        const modal = getModal();
        if (!modal) return;
        closeBubble('confirm');
        modal.classList.toggle('tag-compact-mode', window.isTagCompactMode());
        observe();
        refreshAll();
    }
    window.applyTagCompactMode = applyMode;

    // ─── 말풍선 ───
    const isSingleSelect = (type) => {
        if (type === 'status' || type === 'statuses') return true;
        const groupId = window.typeToGroupId ? window.typeToGroupId(type) : type;
        if (groupId === 'statuses') return true;
        const g = window.getGroupById?.(groupId);
        return !!g && g.selectionMode === 'single';
    };

    const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
    const SELECTION_KEYS = ['activeTaskTypes', 'selectedCoworkers', 'activeStatus', 'activeEquips', 'activeCustomGroupSelections', 'activeWorkTagQuantities'];

    function openBubble(chip) {
        const item = tagBoxes().find(b => b.dataset.groupRef === chip.dataset.groupRef);
        const area = item && item.querySelector(':scope > .btn-tag-area');
        if (!item || !area) return;
        closeBubble('confirm');

        const placeholder = document.createElement('span');
        placeholder.className = 'tag-area-placeholder';
        placeholder.hidden = true;
        area.before(placeholder);

        const bubble = document.createElement('div');
        bubble.className = 'tag-chip-bubble';
        bubble.innerHTML = `<div class="tag-chip-bubble-arrow"></div>
            <div class="tag-chip-bubble-head"><span class="tag-chip-bubble-title"></span><span class="tag-chip-bubble-excl"></span></div>`;
        bubble.appendChild(area);
        const multi = !isSingleSelect(item.dataset.groupRef);
        if (multi) {
            const actions = document.createElement('div');
            actions.className = 'tag-chip-bubble-actions';
            actions.innerHTML = `<button type="button" class="w95-btn" data-act="ok">확인</button><button type="button" class="w95-btn" data-act="cancel">취소</button>`;
            actions.addEventListener('click', (e) => {
                const act = e.target.closest('[data-act]')?.dataset.act;
                if (act) { e.stopPropagation(); closeBubble(act === 'cancel' ? 'cancel' : 'confirm'); }
            });
            bubble.appendChild(actions);
        }
        // 그룹 이름을 누르면 기존처럼 이 일지의 집계 포함/제외가 바뀐다
        bubble.querySelector('.tag-chip-bubble-head').addEventListener('click', (e) => {
            e.stopPropagation();
            window.toggleCurrentWorkGroupExcluded?.(item.dataset.groupRef);
        });

        const snapshot = {};
        SELECTION_KEYS.forEach(k => { snapshot[k] = clone(window[k]); });
        open = { item, chip, bubble, area, placeholder, snapshot, undoLen: (window.workUndoStack || []).length };
        chip.after(bubble);
        refreshAll();
        requestAnimationFrame(() => bubble.scrollIntoView({ block: 'nearest' }));
    }

    function refreshBubbleHead() {
        const head = open.bubble.querySelector('.tag-chip-bubble-head');
        const excluded = !!open.item.querySelector(':scope > .box-title.is-log-excluded');
        const title = groupTitleOf(open.item);
        const t = head.querySelector('.tag-chip-bubble-title');
        const x = head.querySelector('.tag-chip-bubble-excl');
        if (t.textContent !== title) t.textContent = title;
        const xt = excluded ? '집계 제외됨 · 눌러서 포함' : '';
        if (x.textContent !== xt) x.textContent = xt;
        setClass(head, 'is-excluded', excluded);
    }

    // 말풍선 꼬리가 누른 상자 가운데를 가리키게
    function positionArrow() {
        const arrow = open.bubble.querySelector('.tag-chip-bubble-arrow');
        const left = open.chip.offsetLeft + open.chip.offsetWidth / 2 - open.bubble.offsetLeft;
        const px = `${Math.max(10, Math.min(left, open.bubble.offsetWidth - 10))}px`;
        if (arrow.style.left !== px) arrow.style.left = px;
    }

    // mode: 'confirm'(선택 유지) | 'cancel'(말풍선 연 뒤 바꾼 선택 되돌리기)
    function closeBubble(mode) {
        if (!open) return false;
        const state = open;
        open = null;
        if (mode === 'cancel') {
            SELECTION_KEYS.forEach(k => { window[k] = state.snapshot[k]; });
            if (Array.isArray(window.workUndoStack) && window.workUndoStack.length > state.undoLen) {
                window.workUndoStack.length = state.undoLen;
                window.updateWorkUndoButton?.();
            }
        }
        // 태그 영역을 원래 그룹 상자로 돌려놓는다(그 사이 상자가 다시 만들어졌으면 버린다)
        if (state.placeholder.isConnected) state.placeholder.replaceWith(state.area);
        else state.area.remove();
        state.placeholder.remove();
        if (mode === 'cancel') window.renderAllWorkGroups?.();
        state.bubble.remove();
        refreshAll();
        return true;
    }
    // Esc/Enter에서 사용: 열린 말풍선을 닫았으면 true (revert=true면 취소)
    window.closeTagCompactPanel = (revert = false) => closeBubble(revert ? 'cancel' : 'confirm');

    function onRowClick(e) {
        const chip = e.target.closest('.tag-chip');
        if (!chip || !isActive() || window.isWorkEditLocked || window.isWorkLayoutMode) return;
        e.stopPropagation();
        if (open?.chip === chip) closeBubble('confirm');
        else openBubble(chip);
    }

    // 말풍선 바깥을 누르면 확인으로 보고 닫는다(설정이 '확인 버튼'이면 안 닫음).
    // 누른 대상이 원래 동작을 먼저 끝내도록 살짝 늦게 닫는다.
    let press = null;
    document.addEventListener('pointerdown', (e) => { press = { x: e.clientX, y: e.clientY, target: e.target }; }, true);
    document.addEventListener('pointerup', (e) => {
        const p = press;
        press = null;
        if (!p || !open || window.getTagCompactCloseMode() === 'ok') return;
        if (Math.abs(e.clientX - p.x) > 10 || Math.abs(e.clientY - p.y) > 10) return; // 스크롤
        const modal = getModal();
        if (!modal || !modal.contains(p.target)) return;
        if (open.bubble.contains(p.target) || p.target.closest('.tag-chip')) return; // 상자 누름은 onRowClick이 처리
        const state = open;
        setTimeout(() => { if (open === state) closeBubble('confirm'); }, 350);
    }, true);

    window.addEventListener('resize', () => { if (open) positionArrow(); });

    // 단일 선택 그룹은 하나 고르면 바로 닫는다
    const origHandleClick = window.handleClick;
    if (typeof origHandleClick === 'function') {
        window.handleClick = (type, index, ...rest) => {
            const result = origHandleClick(type, index, ...rest);
            if (open && isSingleSelect(type)) {
                const state = open;
                setTimeout(() => { if (open === state) closeBubble('confirm'); }, 180);
            }
            return result;
        };
    }

    // 작업일지를 새로 열 때는 항상 말풍선 없이 시작
    const origOpenWorkModal = window.openWorkModal;
    if (typeof origOpenWorkModal === 'function') {
        window.openWorkModal = (...args) => {
            closeBubble('confirm');
            const result = origOpenWorkModal(...args);
            applyMode();
            return result;
        };
    }

    // 레이아웃 변경에 들어가기 전에 태그 영역을 제자리로 돌려놓는다
    const origSetLayoutMode = window.setWorkLayoutMode;
    if (typeof origSetLayoutMode === 'function') {
        window.setWorkLayoutMode = (...args) => {
            closeBubble('confirm');
            const result = origSetLayoutMode(...args);
            refreshAll();
            return result;
        };
    }

    const origSetLocked = window.setWorkEditLocked;
    if (typeof origSetLocked === 'function') {
        window.setWorkEditLocked = (...args) => {
            const result = origSetLocked(...args);
            if (window.isWorkEditLocked) closeBubble('confirm');
            refreshAll();
            return result;
        };
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyMode);
    else applyMode();
})();
