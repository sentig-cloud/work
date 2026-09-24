// work_photo_insert.js
// 사진을 먼저 골라두고, 검색으로 대상 로그를 찾아 나중에 끼워 넣는 방식.
// 기존 이미지 처리 파이프라인(window.safeProcessImage)과 저장 파이프라인
// (window.saveToLocalStore)을 그대로 재사용한다. 새 컬렉션/스키마 없음.

(() => {
    // window.piPendingImgs: {id, src, originalName, originalPreserved, updatedAt}[]
    // 전역에 둬야 work_logic.js의 openImageViewer('pendingInsert' 모드)가 같은 배열을 보고
    // 확대/삭제 등 기존 사진 뷰어 기능을 그대로 재사용할 수 있다.
    window.piPendingImgs = window.piPendingImgs || [];

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
            <div class="pi-mode-tabs">
                <button type="button" class="w95-btn pi-mode-tab is-active" id="piModeSearchBtn"><i class="fa-solid fa-magnifying-glass"></i> 검색</button>
                <button type="button" class="w95-btn pi-mode-tab" id="piModeDateBtn"><i class="fa-solid fa-calendar-day"></i> 날짜로 찾기</button>
            </div>
            <div class="pi-search-bar" id="piSearchBar">
                <input type="text" id="piSearchInput" class="m-input w95-in" placeholder="고객명 / 주소 / 작업유형 / Task No 검색...">
                <button type="button" class="w95-btn icon-btn" id="piAddMoreBtn" title="사진 더 담기"><i class="fa-solid fa-plus"></i></button>
            </div>
            <div class="pi-date-bar" id="piDateBar" style="display:none;">
                <button type="button" class="w95-btn icon-btn" id="piDatePrevBtn"><i class="fa-solid fa-chevron-left"></i></button>
                <input type="date" id="piDateInput" class="m-input w95-in">
                <button type="button" class="w95-btn icon-btn" id="piDateNextBtn"><i class="fa-solid fa-chevron-right"></i></button>
            </div>
            <div id="piResultList" class="list-area" style="margin:0; border:none;"></div>
        `;
        document.body.appendChild(layer);

        document.getElementById('piCloseTitlebar').addEventListener('click', close);
        document.getElementById('piSearchInput').addEventListener('input', () => renderResults());
        document.getElementById('piAddMoreBtn').addEventListener('click', () => document.getElementById('piFileInput').click());
        document.getElementById('piModeSearchBtn').addEventListener('click', () => setMode('search'));
        document.getElementById('piModeDateBtn').addEventListener('click', () => setMode('date'));
        document.getElementById('piDateInput').addEventListener('change', () => renderResults());
        document.getElementById('piDatePrevBtn').addEventListener('click', () => shiftDate(-1));
        document.getElementById('piDateNextBtn').addEventListener('click', () => shiftDate(1));
    }

    // ─── 검색 / 날짜로 찾기 모드 전환 ───
    let piMode = 'search';
    function setMode(mode) {
        piMode = mode;
        document.getElementById('piModeSearchBtn').classList.toggle('is-active', mode === 'search');
        document.getElementById('piModeDateBtn').classList.toggle('is-active', mode === 'date');
        document.getElementById('piSearchBar').style.display = mode === 'search' ? 'flex' : 'none';
        document.getElementById('piDateBar').style.display = mode === 'date' ? 'flex' : 'none';
        if (mode === 'date' && !document.getElementById('piDateInput').value) {
            document.getElementById('piDateInput').value = toDateInputValue(new Date());
        }
        renderResults();
    }
    function toDateInputValue(date) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }
    function shiftDate(deltaDays) {
        const dateInput = document.getElementById('piDateInput');
        // new Date("YYYY-MM-DD")는 UTC 자정으로 해석돼 타임존에 따라 하루 밀릴 수 있어
        // 연/월/일을 직접 분리해서 로컬 날짜로 만든다(다른 화면의 날짜 입력 처리 방식과 동일).
        let current;
        if (dateInput.value) {
            const [yy, mm, dd] = dateInput.value.split('-').map(Number);
            current = new Date(yy, mm - 1, dd);
        } else {
            current = new Date();
        }
        current.setDate(current.getDate() + deltaDays);
        dateInput.value = toDateInputValue(current);
        renderResults();
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
                    window.piPendingImgs.push({
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
        window.piPendingImgs = window.piPendingImgs.filter(img => img.id !== id);
        renderPendingStrip();
        if (window.piPendingImgs.length === 0) close();
    }

    function renderPendingStrip() {
        const strip = document.getElementById('piPendingStrip');
        if (!strip) return;
        if (window.piPendingImgs.length === 0) {
            strip.innerHTML = `<div class="pi-empty-hint">담긴 사진이 없습니다.</div>`;
            return;
        }
        strip.innerHTML = `<div class="pi-pending-count">담은 사진 ${window.piPendingImgs.length}장 · 탭하면 확대, 아래에서 넣을 곳을 찾으세요</div>
            <div class="pi-pending-thumbs">${window.piPendingImgs.map((img, idx) => `
                <div class="pi-thumb">
                    <img src="${img.src}" data-idx="${idx}">
                    <button type="button" class="pi-thumb-del" data-img-id="${img.id}">×</button>
                </div>
            `).join('')}</div>`;
        strip.querySelectorAll('.pi-thumb img').forEach(img => {
            img.addEventListener('click', () => window.openImageViewer(Number(img.dataset.idx), 'pendingInsert'));
        });
        strip.querySelectorAll('.pi-thumb-del').forEach(btn => {
            btn.addEventListener('click', () => removePending(btn.dataset.imgId));
        });
    }
    window.renderPiPendingStrip = renderPendingStrip;

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
        // 출퇴근은 보통 이름/내용이 없어서 검색어로 찾기 어렵다 — 시간이라도 붙여서 구분되게 한다.
        if ((log.cat === 'commute_in' || log.cat === 'commute_out') && log.time) {
            return `${CAT_LABEL[log.cat]} ${log.time}`;
        }
        return CAT_LABEL[log.cat] || '(내용없음)';
    }

    function buildResultRowHtml(log) {
        const dateStr = `${log.y}.${String(log.m).padStart(2, '0')}.${String(log.d).padStart(2, '0')}(${days[new Date(log.y, log.m - 1, log.d).getDay()]})`;
        const timeStr = log.workTime || log.time || '';
        const imgCount = (log.imgs || []).length;
        return `<div class="pi-result-row" data-log-id="${escapeHtml(log.id)}">
            <div class="pi-result-main">
                <div class="pi-result-date">${dateStr}${timeStr ? ` ${escapeHtml(timeStr)}` : ''} <span class="pi-result-cat">[${CAT_LABEL[log.cat] || log.cat}]</span></div>
                <div class="pi-result-label">${escapeHtml(labelOf(log))}</div>
            </div>
            <div class="pi-result-meta">${imgCount > 0 ? `사진 ${imgCount}장` : ''}</div>
            <button type="button" class="w95-btn pi-insert-btn" data-log-id="${escapeHtml(log.id)}">추가</button>
        </div>`;
    }

    function renderResultRows(results, emptyMessage) {
        const listEl = document.getElementById('piResultList');
        if (!listEl) return;
        if (results.length === 0) {
            listEl.innerHTML = `<div class="pi-empty-hint" style="padding:16px; text-align:center;">${emptyMessage}</div>`;
            return;
        }
        listEl.innerHTML = results.map(buildResultRowHtml).join('');
        listEl.querySelectorAll('.pi-insert-btn').forEach(btn => {
            btn.addEventListener('click', () => insertInto(btn.dataset.logId));
        });
    }

    function renderSearchResults() {
        const keyword = (document.getElementById('piSearchInput')?.value || '').trim().toLowerCase();
        const keywordIsChosung = !!keyword && window.isChosungOnly(keyword);
        let results = (window.logs || []).filter(Boolean);
        if (keyword) results = results.filter(log => {
            const text = searchText(log);
            return text.includes(keyword) || (keywordIsChosung && window.extractChosung(text).includes(keyword));
        });
        results = results.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))).slice(0, 80);
        renderResultRows(results, keyword ? '검색 결과가 없습니다.' : '최근 기록이 없습니다. 검색어를 입력해보세요.');
    }

    // 날짜로 찾기 — 출퇴근처럼 검색어로는 잘 안 잡히는 카드도 날짜만 알면 바로 고를 수 있다.
    // 그날 실제로 등록된 카드만 나오므로, 출근/퇴근 기록이 없는 날은 자연히 선택지에 없다.
    function renderDateResults() {
        const dateInput = document.getElementById('piDateInput');
        const value = dateInput?.value;
        if (!value) { renderResultRows([], '날짜를 선택해주세요.'); return; }
        const [yy, mm, dd] = value.split('-').map(Number);
        const results = (window.logs || [])
            .filter(l => l && Number(l.y) === yy && Number(l.m) === mm && Number(l.d) === dd)
            .sort((a, b) => String(a.workTime || a.time || '').localeCompare(String(b.workTime || b.time || '')));
        renderResultRows(results, '이 날짜에 등록된 카드가 없습니다.');
    }

    function renderResults() {
        if (!document.getElementById('piResultList')) return;
        if (piMode === 'date') renderDateResults();
        else renderSearchResults();
    }

    function insertInto(logId) {
        const log = (window.logs || []).find(l => String(l.id) === String(logId));
        if (!log || window.piPendingImgs.length === 0) return;

        if (!log.imgs) log.imgs = [];
        const now = new Date().toISOString();
        window.piPendingImgs.forEach(img => log.imgs.push({ ...img, updatedAt: now }));
        log.updatedAt = now;
        if (log.cat === 'memo' || log.cat === 'photo') log.cat = 'photo';

        window.saveToLocalStore('logs', log);

        const count = window.piPendingImgs.length;
        window.piPendingImgs = [];
        close();
        showInsertedToast(count, log);
    }

    // 일반 안내 토스트(showWorkNavigationToast)는 pointer-events:none인 공용 요소라
    // 탭으로 이동시키는 용도로는 못 쓴다 — 전용 클릭 가능 토스트를 따로 둔다.
    function ensureInsertedToastDom() {
        if (document.getElementById('piInsertedToast')) return;
        const toast = document.createElement('div');
        toast.id = 'piInsertedToast';
        toast.className = 'pi-inserted-toast';
        toast.style.display = 'none';
        document.body.appendChild(toast);
    }

    function showInsertedToast(count, log) {
        ensureInsertedToastDom();
        const toast = document.getElementById('piInsertedToast');
        toast.textContent = `사진 ${count}장을 ${labelOf(log)}에 추가했습니다 · 이동`;
        toast.style.display = 'block';
        toast.onclick = () => {
            clearTimeout(window.__piToastTimer);
            toast.style.display = 'none';
            window.handleCardClick(log.id, log.cat);
        };
        clearTimeout(window.__piToastTimer);
        window.__piToastTimer = setTimeout(() => { toast.style.display = 'none'; }, 4000);
    }

    window.openPhotoInsert = openPicker;
})();
