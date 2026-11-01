// work_keyboard.js
// PC(마우스/키보드 환경)에서 작업일지 단축키: Enter = 저장, Esc = 취소.
// - 한글 입력 조합 중의 Enter는 글자 확정이므로 무시한다.
// - 여러 줄 칸(작업 내용 등)에서 줄바꿈은 Shift+Enter.
// - 태그 드롭다운이 열려 있으면 Esc는 드롭다운만 닫는다.
// - 레이아웃 변경 모드에서는 Esc = 레이아웃 변경 끝내기, Enter는 동작 없음.
// - 작업일지 위에 다른 창(지도 앱 선택, 태그 수정, 사진 보기 등)이 떠 있으면 그 창을 방해하지 않는다.

(() => {
    const isPcPointer = () => window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;

    const isShown = (el) => !!el && getComputedStyle(el).display !== 'none';

    const workModalOpen = () => isShown(document.getElementById('workModal'));

    // 작업일지 말고 다른 창이 떠 있는지
    const otherOverlayOpen = () => [...document.querySelectorAll('.modal-overlay, #imageViewer')]
        .some(el => el.id !== 'workModal' && isShown(el));

    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== 'Escape') return;
        if (e.isComposing || e.keyCode === 229 || e.repeat) return;
        if (!isPcPointer() || !workModalOpen() || otherOverlayOpen()) return;
        const modal = document.getElementById('workModal');
        const target = e.target;
        // 작업일지 밖(다른 팝업의 입력칸 등)에서 누른 키는 건드리지 않는다
        if (target && target !== document.body && !modal.contains(target)) return;

        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            if (window.closeTagCompactPanel?.()) return;
            if (window.isWorkLayoutMode) { window.setWorkLayoutMode?.(false); return; }
            window.closeWorkModal?.();
            return;
        }

        // Enter
        if (window.isWorkLayoutMode) return;
        if (e.ctrlKey || e.altKey || e.metaKey) return;
        if (target?.tagName === 'TEXTAREA' && e.shiftKey) return; // 줄바꿈
        if (target?.tagName === 'SELECT') return;
        // 포커스가 버튼(방금 누른 태그 등)에 있으면 Enter가 그 버튼을 한 번 더 누르는 대신 저장한다
        e.preventDefault();
        e.stopPropagation();
        // 시간 칸처럼 칸을 벗어날 때 값을 정리하는 입력이 있으므로 먼저 포커스를 빼서 그 처리를 끝낸다
        if (target && typeof target.blur === 'function' && target !== document.body) target.blur();
        window.closeTagCompactPanel?.();
        document.getElementById('workSaveBtn')?.click();
    }, true);
})();
