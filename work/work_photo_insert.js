// work_photo_insert.js
// 사진을 먼저 골라두고, 검색으로 대상 로그를 찾아 나중에 끼워 넣는 방식.
// 기존 이미지 처리 파이프라인(window.safeProcessImage)과 저장 파이프라인
// (window.saveToLocalStore)을 그대로 재사용한다. 새 컬렉션/스키마 없음.

(() => {
    let pendingImgs = []; // {id, src, originalName, originalPreserved, updatedAt}

    function escapeHtml(str) {
        return String(str == null ? '' : str).replace(/[&<>"']/g, ch => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[ch]));
    }

    // ─── DOM 준비 (최초 1회) ───
    function ensureDom() {
        if (document.getElementById('photoInsertLayer')) return;

        const input = document.createElement('input');
        input.type = 'file';
        input.id = 'piFileInput';
        input.multiple = true;
        input.accept = 'image/*, .heic, .HEIC';
        input.hidden = true;
        input.addEventListener('change', () => onFilesSelected(input));
        document.body.appendChild(input);

        const layer = document.createElement('div');
        layer.id = 'photoInsertLayer';
        layer.className = 'layer';
        layer.innerHTML = `
            <div class="w95-titlebar" style="padding:10px; cursor:pointer;" id="piCloseTitlebar">
                <span><i class="fa-solid fa-chevron-left" style="margin-right:8px;"></i> 사진 넣을 곳 찾기</span>
            </div>
            <div class="pi-pending-strip" id="piPendingStrip"></div>
            <div class="pi-search-bar">
                <input type="text" id="piSearchInput" class="m-input w95-in" placeholder="고객명 / 주소 / 작업유형 / Task No 검색...">
                <button type="button" class="w95-btn icon-btn" id="piAddMoreBtn" title="사진 더 담기"><i class="fa-solid fa-plus"></i></button>
            </div>
            <div id="piResultList" class="list-area" style="margin:0; border:none;"></div>
        `;
        document.body.appendChild(layer);

        document.getElementById('piCloseTitlebar').addEventListener('click', close);
        document.getElementById('piSearchInput').addEventListener('input', () => renderResults());
        document.getElementById('piAddMoreBtn').addEventListener('click', () => document.getElementById('piFileInput').click());
    }

    // ─── 진입 ───
    function openPicker() {
        ensureDom();
        document.getElementById('piFileInput').click();
    }

    function onFilesSelected(input) {
        if (!input.files || input.files.length === 0) return;
        if (window.showLoading) window.showLoading('사진 처리 중...');

        const files = Array.from(input.files);
        let completed = 0;

        files.forEach(file => {
            window.safeProcessImage(file, (dataUrl, imageMeta = {}) => {
                if (dataUrl) {
                    pendingImgs.push({
                        id: `pi_${Date.now()}_${Math.random()}`,
                        src: dataUrl,
                        originalName: imageMeta.originalName || file.name || '',
                        originalPreserved: imageMeta.originalPreserved !== false,
                        updatedAt: new Date().toISOString()
                    });
                }
                completed++;
                if (completed === files.length) {
                    if (window.hideLoading) window.hideLoading();
                    input.value = '';
                    renderPendingStrip();
                    show();
                }
            });
        });
    }

    function show() {
        ensureDom();
        document.getElementById('photoInsertLayer').style.display = 'flex';
        renderPendingStrip();
        renderResults();
    }

    function close() {
        const layer = document.getElementById('photoInsertLayer');
        if (layer) layer.style.display = 'none';
    }

    function removePending(id) {
        pendingImgs = pendingImgs.filter(img => img.id !== id);
        renderPendingStrip();
        if (pendingImgs.length === 0) close();
    }

    function renderPendingStrip() {
        const strip = document.getElementById('piPendingStrip');
        if (!strip) return;
        if (pendingImgs.length === 0) {
            strip.innerHTML = `<div class="pi-empty-hint">담긴 사진이 없습니다.</div>`;
            return;
        }
        strip.innerHTML = `<div class="pi-pending-count">담은 사진 ${pendingImgs.length}장 · 아래에서 넣을 곳을 찾으세요</div>
            <div class="pi-pending-thumbs">${pendingImgs.map(img => `
                <div class="pi-thumb">
                    <img src="${img.src}">
                    <button type="button" class="pi-thumb-del" data-img-id="${img.id}">×</button>
                </div>
            `).join('')}</div>`;
        strip.querySelectorAll('.pi-thumb-del').forEach(btn => {
            btn.addEventListener('click', () => removePending(btn.dataset.imgId));
        });
    }

    // ─── 대상 검색 ───
    const CAT_LABEL = { work: '작업', commute_in: '출근', commute_out: '퇴근', memo: '메모', photo: '사진' };
    const days = ['일', '월', '화', '수', '목', '금', '토'];

    function searchText(log) {
        return [log.customerName, log.address, log.taskType, log.taskNo, log.content, log.note, log.memo, log.commuteNote]
            .filter(Boolean).join(' ').toLowerCase();
    }

    function labelOf(log) {
        if (log.customerName && String(log.customerName).trim()) return String(log.customerName).trim();
        if (log.taskType) {
            const first = String(log.taskType).split(',')[0].trim();
            if (first) return first;
        }
        if (log.memo) return String(log.memo).slice(0, 20);
        return CAT_LABEL[log.cat] || '(내용없음)';
    }

    function renderResults() {
        const listEl = document.getElementById('piResultList');
        if (!listEl) return;
        const keyword = (document.getElementById('piSearchInput')?.value || '').trim().toLowerCase();

        let results = (window.logs || []).filter(Boolean);
        if (keyword) results = results.filter(log => searchText(log).includes(keyword));
        results = results.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))).slice(0, 80);

        if (results.length === 0) {
            listEl.innerHTML = `<div class="pi-empty-hint" style="padding:16px; text-align:center;">${keyword ? '검색 결과가 없습니다.' : '최근 기록이 없습니다. 검색어를 입력해보세요.'}</div>`;
            return;
        }

        listEl.innerHTML = results.map(log => {
            const dateStr = `${log.y}.${String(log.m).padStart(2, '0')}.${String(log.d).padStart(2, '0')}(${days[new Date(log.y, log.m - 1, log.d).getDay()]})`;
            const imgCount = (log.imgs || []).length;
            return `<div class="pi-result-row" data-log-id="${escapeHtml(log.id)}">
                <div class="pi-result-main">
                    <div class="pi-result-date">${dateStr} <span class="pi-result-cat">[${CAT_LABEL[log.cat] || log.cat}]</span></div>
                    <div class="pi-result-label">${escapeHtml(labelOf(log))}</div>
                </div>
                <div class="pi-result-meta">${imgCount > 0 ? `사진 ${imgCount}장` : ''}</div>
                <button type="button" class="w95-btn pi-insert-btn" data-log-id="${escapeHtml(log.id)}">추가</button>
            </div>`;
        }).join('');

        listEl.querySelectorAll('.pi-insert-btn').forEach(btn => {
            btn.addEventListener('click', () => insertInto(btn.dataset.logId));
        });
    }

    function insertInto(logId) {
        const log = (window.logs || []).find(l => String(l.id) === String(logId));
        if (!log || pendingImgs.length === 0) return;

        if (!log.imgs) log.imgs = [];
        const now = new Date().toISOString();
        pendingImgs.forEach(img => log.imgs.push({ ...img, updatedAt: now }));
        log.updatedAt = now;
        if (log.cat === 'memo' || log.cat === 'photo') log.cat = 'photo';

        window.saveToLocalStore('logs', log);

        const count = pendingImgs.length;
        pendingImgs = [];
        close();
        const message = `사진 ${count}장을 추가했습니다.`;
        if (window.showWorkNavigationToast) window.showWorkNavigationToast(message);
        else alert(message);
    }

    window.openPhotoInsert = openPicker;
})();
