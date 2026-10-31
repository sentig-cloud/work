// work_tag_compact.js
// 작업일지 선택태그 상자 "압축" 표시 방식(메인 설정에서 선택).
// - 평소엔 각 상자에 선택된 태그만 한 줄로 보이고, 상자를 누르면 그 자리에서 모든 태그가 펼쳐진다.
// - 단일 선택 그룹은 하나를 고르면 바로 접히고, 중복 선택 그룹은 계속 펼쳐진 채로 여러 개를 고른 뒤
//   다른 곳을 누르거나(설정: 바깥 누르면 닫기) [확인]을 누르면 접힌다. 선택값 자체는 누르는 즉시
//   반영되므로 접히는 것 = 선택 완료.
// - 레이아웃 변경(수정) 모드에서는 모든 상자를 펼쳐서 보여준다(CSS 참고).
// 태그 버튼/선택 로직은 기존 것을 그대로 쓰고, 여기서는 펼침/접힘만 다룬다.

(() => {
    const MODE_KEY = 'wm_tag_compact_mode';
    const CLOSE_KEY = 'wm_tag_compact_close';
    const EXPANDED_CLASS = 'tag-box-expanded';
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

    function applyMode() {
        const modal = getModal();
        if (!modal) return;
        modal.classList.toggle('tag-compact-mode', window.isTagCompactMode());
        collapseAll();
    }
    window.applyTagCompactMode = applyMode;

    const isActive = () => {
        const modal = getModal();
        return !!modal && window.isTagCompactMode() && !modal.classList.contains('layout-edit-mode');
    };

    // 압축 대상 상자: 태그 영역이 있는 그룹 상자(시작/종료 같은 특수 그룹 제외)
    function tagBoxOf(el) {
        const item = el && el.closest ? el.closest('#workDragContainer .drag-item[data-group-ref]') : null;
        if (!item || item.dataset.groupRef === 'duration' || !item.querySelector('.btn-tag-area')) return null;
        return item;
    }

    function collapse(item) {
        if (!item) return;
        item.classList.remove(EXPANDED_CLASS);
        item.querySelector(':scope > .tag-compact-ok')?.remove();
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
    }

    const expandedItem = () => getModal()?.querySelector(`.drag-item.${EXPANDED_CLASS}`) || null;

    // 눌린 곳이 "접힌 상자의 태그 영역"인지(그러면 펼친다)
    function collapsedAreaTarget(target) {
        if (!isActive() || window.isWorkEditLocked || window.isWorkLayoutMode) return null;
        const item = tagBoxOf(target);
        if (!item || item.classList.contains(EXPANDED_CLASS)) return null;
        return target.closest('.btn-tag-area') ? item : null;
    }

    let press = null;
    document.addEventListener('pointerdown', (e) => {
        press = { x: e.clientX, y: e.clientY, type: e.pointerType, target: e.target, moved: false };
    }, true);
    document.addEventListener('pointermove', (e) => {
        if (press && (Math.abs(e.clientX - press.x) > TAP_SLOP || Math.abs(e.clientY - press.y) > TAP_SLOP)) press.moved = true;
    }, true);

    // 터치: 접힌 상자를 누르면 그 탭은 펼치기에만 쓰고 삼킨다 — 안 그러면 펼쳐지면서 손가락
    // 아래에 새로 나타난 태그가 같은 탭으로 눌려 버린다.
    document.addEventListener('touchend', (e) => {
        if (!press || press.moved || press.type !== 'touch') return;
        const item = collapsedAreaTarget(press.target);
        if (!item) return;
        e.preventDefault();
        expand(item);
        press = null;
    }, { capture: true, passive: false });

    // 마우스: 클릭으로 펼친다
    document.addEventListener('click', (e) => {
        const item = collapsedAreaTarget(e.target);
        if (!item) return;
        e.preventDefault();
        e.stopPropagation();
        expand(item);
    }, true);

    // 펼친 상자 바깥을 누르면 선택 완료로 보고 접는다(설정이 '확인 버튼'이면 안 접음).
    // 누른 대상이 원래 동작을 먼저 끝내도록 살짝 늦게 접는다(접히며 화면이 밀려 엉뚱한 곳이 눌리는 것 방지).
    document.addEventListener('pointerup', (e) => {
        const current = press;
        if (!current || current.moved) return;
        const open = expandedItem();
        if (!open || window.getTagCompactCloseMode() === 'ok') return;
        const modal = getModal();
        if (!modal || !modal.contains(current.target) || open.contains(current.target)) return;
        if (collapsedAreaTarget(current.target)) return; // 다른 상자를 연 경우는 expand()가 처리
        setTimeout(() => { if (open.classList.contains(EXPANDED_CLASS)) collapse(open); }, 350);
    }, true);

    // 단일 선택 그룹은 하나 고르면 바로 접는다
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

    // 작업일지를 새로 열 때는 항상 모두 접힌 상태로 시작
    const origOpenWorkModal = window.openWorkModal;
    if (typeof origOpenWorkModal === 'function') {
        window.openWorkModal = (...args) => {
            const result = origOpenWorkModal(...args);
            applyMode();
            return result;
        };
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyMode);
    else applyMode();
})();
