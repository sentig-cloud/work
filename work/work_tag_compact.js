// work_tag_compact.js
// 작업일지 "선택태그 상자 그룹" 압축 표시 방식(메인 설정에서 선택).
// - 평소엔 각 그룹(작업유형, 상태, 작업 구분 …)이 버튼 하나로 보인다: 위에 그룹 이름, 아래에 선택된 이름.
// - 버튼을 누르면 그 버튼 바로 밑에 그룹의 모든 태그가 드롭다운처럼 펼쳐진다.
// - 단일 선택 그룹은 하나를 고르면 바로 닫히고, 중복 선택 그룹은 열린 채로 여러 개를 고른 뒤
//   다른 곳을 누르거나(설정: 바깥 누르면 닫기) [확인]을 누르면 닫힌다. 선택값 자체는 누르는 즉시
//   반영되므로 닫히는 것 = 선택 완료.
// - X를 길게 눌러 들어가는 레이아웃 변경 모드에서는 기존처럼 모든 상자를 펼쳐서 보여준다(CSS 참고).
// 태그 버튼/선택 로직은 기존 것을 그대로 쓰고, 여기서는 버튼 표시와 드롭다운 열기/닫기만 다룬다.

(() => {
    const MODE_KEY = 'wm_tag_compact_mode';
    const CLOSE_KEY = 'wm_tag_compact_close';
    const EXPANDED_CLASS = 'tag-box-expanded';
    const BOX_CLASS = 'tag-compact-box';
    const TAP_SLOP = 10;

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

    // 압축 대상 상자: 태그 영역이 있는 그룹 상자(시작/종료 같은 특수 그룹 제외)
    function tagBoxOf(el) {
        const item = el && el.closest ? el.closest('#workDragContainer > .drag-item[data-group-ref]') : null;
        if (!item || item.dataset.groupRef === 'duration' || !item.querySelector(':scope > .btn-tag-area')) return null;
        return item;
    }

    // ─── 버튼에 보이는 "선택된 이름" ───
    function refreshSummary(item) {
        let summary = item.querySelector(':scope > .tag-compact-summary');
        if (!summary) {
            summary = document.createElement('div');
            summary.className = 'tag-compact-summary';
            const title = item.querySelector(':scope > .box-title');
            if (title) title.after(summary); else item.prepend(summary);
        }
        const names = [...item.querySelectorAll(':scope > .btn-tag-area .active-btn')]
            .map(b => b.textContent.trim()).filter(Boolean);
        const locked = getModal()?.classList.contains('work-edit-locked');
        const text = names.length ? names.join(', ') : (locked ? '선택 없음' : '눌러서 선택');
        // 값이 같을 때 다시 쓰면 MutationObserver가 또 불려 무한 반복되므로 바뀐 경우만 쓴다
        if (summary.textContent !== text) summary.textContent = text;
        if (summary.classList.contains('is-empty') !== !names.length) summary.classList.toggle('is-empty', !names.length);
        if (summary.title !== names.join(', ')) summary.title = names.join(', ');
    }

    function refreshAll() {
        getContainer()?.querySelectorAll(':scope > .drag-item[data-group-ref]').forEach(item => {
            if (!tagBoxOf(item)) return;
            if (!item.classList.contains(BOX_CLASS)) item.classList.add(BOX_CLASS);
            refreshSummary(item);
        });
        const open = expandedItem();
        if (open) positionPanel(open);
    }
    const queueRefresh = () => Promise.resolve().then(refreshAll);

    // 태그가 다시 그려지거나 선택이 바뀌면(클래스 변경) 버튼 글자를 갱신한다.
    function observe() {
        const container = getContainer();
        if (!container || container.dataset.tagCompactObserved) return;
        container.dataset.tagCompactObserved = '1';
        new MutationObserver((records) => {
            // 우리가 넣은 요약 글자 변경은 무시(무한 반복 방지)
            if (records.every(r => r.target.classList?.contains('tag-compact-summary')
                || r.target.parentElement?.classList?.contains('tag-compact-summary'))) return;
            refreshAll();
        }).observe(container, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
    }

    function applyMode() {
        const modal = getModal();
        if (!modal) return;
        modal.classList.toggle('tag-compact-mode', window.isTagCompactMode());
        observe();
        refreshAll();
        collapseAll();
    }
    window.applyTagCompactMode = applyMode;

    const isActive = () => {
        const modal = getModal();
        return !!modal && window.isTagCompactMode() && !modal.classList.contains('layout-edit-mode');
    };

    // ─── 드롭다운(버튼 밑에 펼쳐지는 태그 목록) ───
    const panelOf = (item) => item.querySelector(':scope > .btn-tag-area');

    // 드롭다운은 버튼 폭이 아니라 작업일지 전체 폭으로, 버튼 바로 밑에 띄운다.
    function positionPanel(item) {
        const panel = panelOf(item);
        const container = getContainer();
        if (!panel || !container) return;
        const itemRect = item.getBoundingClientRect();
        const contRect = container.getBoundingClientRect();
        panel.style.left = `${contRect.left - itemRect.left - 2}px`;
        panel.style.width = `${contRect.width}px`;
        const ok = item.querySelector(':scope > .tag-compact-ok');
        if (ok) {
            ok.style.left = panel.style.left;
            ok.style.width = panel.style.width;
            ok.style.top = `${panel.offsetTop + panel.offsetHeight}px`;
        }
    }

    let panelResizeObserver = null;

    function collapse(item) {
        if (!item) return;
        item.classList.remove(EXPANDED_CLASS);
        item.querySelector(':scope > .tag-compact-ok')?.remove();
        const panel = panelOf(item);
        if (panel) { panel.style.left = ''; panel.style.width = ''; }
        panelResizeObserver?.disconnect();
    }

    function collapseAll(except = null) {
        getModal()?.querySelectorAll(`.drag-item.${EXPANDED_CLASS}`).forEach(item => {
            if (item !== except) collapse(item);
        });
    }

    function expand(item) {
        collapseAll(item);
        item.classList.add(EXPANDED_CLASS);
        if (!item.querySelector(':scope > .tag-compact-ok')) {
            const ok = document.createElement('button');
            ok.type = 'button';
            ok.className = 'w95-btn tag-compact-ok';
            ok.textContent = '확인';
            ok.addEventListener('click', (e) => { e.stopPropagation(); collapse(item); });
            item.appendChild(ok);
        }
        positionPanel(item);
        const panel = panelOf(item);
        if (panel && window.ResizeObserver) {
            panelResizeObserver = panelResizeObserver || new ResizeObserver(() => {
                const open = expandedItem();
                if (open) positionPanel(open);
            });
            panelResizeObserver.disconnect();
            panelResizeObserver.observe(panel);
        }
        // 아래쪽 그룹이면 펼친 목록이 화면 밖에 있을 수 있어 보이도록 살짝 스크롤
        requestAnimationFrame(() => {
            (item.querySelector(':scope > .tag-compact-ok') || panel)?.scrollIntoView({ block: 'nearest' });
        });
    }

    const expandedItem = () => getModal()?.querySelector(`.drag-item.${EXPANDED_CLASS}`) || null;

    // Esc 등에서 쓰기 위해 공개: 열려 있던 드롭다운을 닫았으면 true
    window.closeTagCompactPanel = () => {
        const open = expandedItem();
        if (!open) return false;
        collapse(open);
        return true;
    };

    // 눌린 곳이 "그룹 버튼"(드롭다운 목록/확인 버튼/그룹 이름 제외)인지.
    // 그룹 이름은 기존처럼 탭하면 집계 포함/제외가 바뀌므로 건드리지 않는다.
    function headerTarget(target) {
        if (!isActive() || window.isWorkEditLocked || window.isWorkLayoutMode) return null;
        const item = tagBoxOf(target);
        if (!item) return null;
        if (target.closest('.btn-tag-area, .tag-compact-ok, .box-title')) return null;
        return item;
    }
    const toggle = (item) => item.classList.contains(EXPANDED_CLASS) ? collapse(item) : expand(item);

    let press = null;
    document.addEventListener('pointerdown', (e) => {
        press = { x: e.clientX, y: e.clientY, type: e.pointerType, target: e.target, moved: false };
    }, true);
    document.addEventListener('pointermove', (e) => {
        if (press && (Math.abs(e.clientX - press.x) > TAP_SLOP || Math.abs(e.clientY - press.y) > TAP_SLOP)) press.moved = true;
    }, true);

    // 터치: 버튼 탭을 여기서 처리하고 뒤따르는 click은 막는다(두 번 토글되는 것 방지)
    document.addEventListener('touchend', (e) => {
        if (!press || press.moved || press.type !== 'touch') return;
        const item = headerTarget(press.target);
        if (!item) return;
        e.preventDefault();
        toggle(item);
        press = null;
    }, { capture: true, passive: false });

    // 마우스: 클릭으로 열고 닫는다
    document.addEventListener('click', (e) => {
        const item = headerTarget(e.target);
        if (!item) return;
        e.preventDefault();
        e.stopPropagation();
        toggle(item);
    }, true);

    // 펼친 그룹 바깥을 누르면 선택 완료로 보고 닫는다(설정이 '확인 버튼'이면 안 닫음).
    // 누른 대상이 원래 동작을 먼저 끝내도록 살짝 늦게 닫는다.
    document.addEventListener('pointerup', (e) => {
        const current = press;
        if (!current || current.moved) return;
        const open = expandedItem();
        if (!open || window.getTagCompactCloseMode() === 'ok') return;
        const modal = getModal();
        if (!modal || !modal.contains(current.target) || open.contains(current.target)) return;
        if (headerTarget(current.target)) return; // 다른 그룹 버튼을 누른 경우는 expand()가 처리
        setTimeout(() => { if (open.classList.contains(EXPANDED_CLASS)) collapse(open); }, 350);
    }, true);

    window.addEventListener('resize', () => {
        const open = expandedItem();
        if (open) positionPanel(open);
    });

    // 단일 선택 그룹은 하나 고르면 바로 닫는다
    const isSingleSelect = (type) => {
        if (type === 'status') return true;
        const groupId = window.typeToGroupId ? window.typeToGroupId(type) : type;
        if (groupId === 'statuses') return true;
        const g = window.getGroupById?.(groupId);
        return !!g && g.selectionMode === 'single';
    };
    const origHandleClick = window.handleClick;
    if (typeof origHandleClick === 'function') {
        window.handleClick = (type, index, ...rest) => {
            const result = origHandleClick(type, index, ...rest);
            if (isActive() && isSingleSelect(type)) {
                const open = expandedItem();
                if (open) setTimeout(() => collapse(open), 180);
            }
            return result;
        };
    }

    // 작업일지를 새로 열 때는 항상 모두 닫힌 상태로 시작
    const origOpenWorkModal = window.openWorkModal;
    if (typeof origOpenWorkModal === 'function') {
        window.openWorkModal = (...args) => {
            const result = origOpenWorkModal(...args);
            applyMode();
            return result;
        };
    }

    // 잠금 상태가 바뀌면 빈 그룹 문구('눌러서 선택'/'선택 없음')를 바꾸고 열린 목록을 닫는다
    const origSetLocked = window.setWorkEditLocked;
    if (typeof origSetLocked === 'function') {
        window.setWorkEditLocked = (...args) => {
            const result = origSetLocked(...args);
            if (window.isWorkEditLocked) collapseAll();
            queueRefresh();
            return result;
        };
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyMode);
    else applyMode();
})();
