// work_card_tools.js
// 카드/입력 편의 기능 모음 (모두 메인 설정 > "카드 · 입력"에서 켜고 끈다)
// 1) 복제: 카드를 길게 눌러 선택하면 아래 [복사][공유][취소] 줄에 [복제]가 생긴다. 누르면 복제 줄이 뜨고
//    날짜·시간을 골라 [복제]하거나, 달력의 날짜를 누르면 그 날짜로 바로 복제된다.
// 2) 같은 카드 묶기: 타스크 번호가 같은 작업 카드를 한 묶음으로 접어 보여준다(목록·검색 결과).
// 3) 작업 카드 레이아웃: 기본(자유 배치) / 요약형 / 타임라인형 / 한 줄형.
// 4) 선택태그 상자 "세로 스와이프" 방식: 그룹이 세로로 서고, 그룹 이름을 누른 채 오른쪽으로 밀다가
//    멈추고 떼면 손가락 밑의 태그가 선택된다. 끝까지 길게 밀거나 그룹 이름을 짧게 누르면 집계 제외/포함.
// 5) 입력칸 더블탭 붙여넣기: 커서를 둔 칸을 더블탭하면 클립보드 내용을 커서 자리에 넣는다.
// 설정은 localStorage 'wm_card_tools'에 두고 화면 설정(uiSettings.cardTools)으로 다른 기기와 동기화한다.

(() => {
    const KEY = 'wm_card_tools';
    const DEFAULTS = {
        cardLayout: 'default',
        duplicate: true,
        groupByTaskNo: false,
        doubleTapPaste: true,
        swipeLongExclude: true,
        swipeTitleExclude: true
    };
    const readSettings = () => {
        try { return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) || '{}') || {}) }; }
        catch (_) { return { ...DEFAULTS }; }
    };
    let S = readSettings();

    const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const toast = msg => window.showWorkNavigationToast ? window.showWorkNavigationToast(msg) : alert(msg);
    const logById = id => (window.logs || []).find(l => l && String(l.id) === String(id));
    const rerender = () => {
        if (!Array.isArray(window.logs)) return;
        const pop = document.getElementById('popupLayer');
        if (pop && getComputedStyle(pop).display !== 'none') window.renderCal?.(window.currentYear, window.curMonth - 1);
        const search = document.getElementById('searchLayer');
        if (search && getComputedStyle(search).display !== 'none') window.doSearch?.();
    };

    window.getCardToolsSettings = () => ({ ...S });
    window.setCardToolsSettings = (next = {}) => {
        const prev = JSON.stringify(S);
        S = { ...S, ...next };
        try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (_) {}
        if (prev === JSON.stringify(S)) return;
        applySettings(true);
        window.markDirty?.('master', 'cardTools', 'upsert');
        window.scheduleSync?.();
    };
    // 다른 기기에서 설정이 들어왔을 때(work_sync.js)
    window.applyCardToolsSettings = () => { S = readSettings(); applySettings(true); };

    function applySettings(redraw) {
        document.body.classList.toggle('wm-card-dup-off', !S.duplicate);
        if (!S.duplicate) hideDupBar();
        window.applyTagSwipeMode?.();
        if (redraw) rerender();
    }

    // ═══════════════════════════════════════════
    // 1) 복제
    // ═══════════════════════════════════════════
    let dup = null; // { ids: [...] }
    const pad = n => String(n).padStart(2, '0');
    const toDateValue = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
    const isCommuteLog = l => l.cat === 'commute_in' || l.cat === 'commute_out' || String(l.id || '').startsWith('calc_commute_');
    const logTime = l => (l.cat === 'work' ? l.workTime : l.time) || '';

    function ensureDupBar() {
        let bar = document.getElementById('cardDuplicateBar');
        if (bar) return bar;
        bar = document.createElement('div');
        bar.id = 'cardDuplicateBar';
        bar.className = 'card-duplicate-bar w95-window';
        bar.innerHTML = `
            <div class="cdb-head"><b id="cdbCount">카드 복제</b><span>달력에서 날짜를 누르면 그 날짜로 바로 복제</span></div>
            <div class="cdb-row">
                <input type="date" id="cdbDate" class="w95-in">
                <input type="time" id="cdbTime" class="w95-in">
                <button type="button" class="w95-btn cdb-go" id="cdbGo">복제</button>
                <button type="button" class="w95-btn" id="cdbCancel">취소</button>
            </div>
            <label class="cdb-keep"><input type="checkbox" id="cdbKeepTime"> 원래 시간 그대로</label>`;
        document.body.appendChild(bar);
        const timeEl = bar.querySelector('#cdbTime');
        const keepEl = bar.querySelector('#cdbKeepTime');
        keepEl.addEventListener('change', () => { timeEl.disabled = keepEl.checked; });
        bar.querySelector('#cdbCancel').addEventListener('click', hideDupBar);
        bar.querySelector('#cdbGo').addEventListener('click', () => {
            const v = bar.querySelector('#cdbDate').value;
            const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
            if (!m) return alert('복제할 날짜를 고르세요.');
            duplicateTo(Number(m[1]), Number(m[2]), Number(m[3]));
        });
        return bar;
    }

    function hideDupBar() {
        dup = null;
        document.body.classList.remove('is-card-duplicating');
        const bar = document.getElementById('cardDuplicateBar');
        if (bar) bar.style.display = 'none';
    }

    window.startCardDuplicate = () => {
        const logs = [...(window.selectedCardLogIds || [])].map(logById).filter(Boolean);
        if (!logs.length) return alert('복제할 카드를 선택하세요.');
        const usable = logs.filter(l => !isCommuteLog(l));
        if (!usable.length) return alert('출퇴근 카드는 복제할 수 없습니다.');
        dup = { ids: usable.map(l => String(l.id)) };
        window.closeCardSelectionMode?.();

        const bar = ensureDupBar();
        const first = usable[0];
        const next = new Date(first.y, first.m - 1, first.d + 1);
        bar.querySelector('#cdbDate').value = toDateValue(next.getFullYear(), next.getMonth() + 1, next.getDate());
        const timeEl = bar.querySelector('#cdbTime');
        const keepEl = bar.querySelector('#cdbKeepTime');
        const time = /^\d{2}:\d{2}/.test(logTime(first)) ? logTime(first).slice(0, 5) : '';
        timeEl.value = time;
        // 여러 장이면 각자 원래 시간을 유지하는 게 기본
        keepEl.checked = usable.length > 1 || !time;
        timeEl.disabled = keepEl.checked;
        bar.querySelector('#cdbCount').textContent = `${usable.length}개 카드 복제${usable.length < logs.length ? ' (출퇴근 제외)' : ''}`;
        bar.style.display = 'flex';
        document.body.classList.add('is-card-duplicating');
    };

    function newLogId(used) {
        let n = Date.now();
        while (used.has(String(n))) n++;
        used.add(String(n));
        return String(n);
    }

    function duplicateTo(y, m, d) {
        if (!dup) return;
        const bar = ensureDupBar();
        const keep = bar.querySelector('#cdbKeepTime').checked;
        const time = bar.querySelector('#cdbTime').value;
        const used = new Set((window.logs || []).map(l => String(l?.id)));
        let count = 0;
        dup.ids.forEach(id => {
            const src = logById(id);
            if (!src) return;
            const copy = JSON.parse(JSON.stringify(src));
            copy.id = newLogId(used);
            copy.y = y; copy.m = m; copy.d = d;
            if (copy.cat === 'work') {
                if (!keep && time) copy.workTime = time;
                copy.time = window.getCurrentTimeString?.() || copy.time;
            } else if (!keep && time) {
                copy.time = time;
            }
            copy.personalCheck = null;
            copy.duplicatedFrom = String(src.id);
            delete copy.updatedAt;
            window.saveToLocalStore('logs', copy);
            count++;
        });
        hideDupBar();
        if (!count) return;
        window.currentYear = y;
        window.curMonth = m;
        window.curDay = d;
        const label = document.getElementById('monthLabel');
        if (label) label.innerText = `${m}월`;
        rerender();
        toast(`${count}개 카드를 ${m}/${d}${keep || !time ? '' : ' ' + time}에 복제했습니다`);
    }

    // 복제 줄이 떠 있는 동안 달력 날짜를 누르면 그 날짜로 바로 복제
    document.addEventListener('click', e => {
        if (!dup) return;
        const td = e.target.closest('#calBody td[data-day]');
        if (!td) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        duplicateTo(window.currentYear, window.curMonth, Number(td.dataset.day));
    }, true);

    // ═══════════════════════════════════════════
    // 2) 타스크 번호가 같은 카드 묶기
    // ═══════════════════════════════════════════
    const openTaskGroups = new Set();
    const normTaskNo = v => String(v || '').replace(/\s+/g, '');

    function groupCardsIn(list) {
        if (!list || !S.groupByTaskNo) return;
        const groups = new Map();
        list.querySelectorAll(':scope > .log-card[data-log-cat="work"]').forEach(card => {
            const key = normTaskNo(logById(card.dataset.logId)?.taskNo);
            if (!key) return;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(card);
        });
        groups.forEach((cards, key) => {
            if (cards.length < 2) return;
            const wrap = document.createElement('div');
            wrap.className = 'wm-task-group';
            wrap.dataset.taskNo = key;
            const head = document.createElement('button');
            head.type = 'button';
            head.className = 'w95-btn wm-task-group-head';
            const dates = [...new Set(cards.map(c => { const l = logById(c.dataset.logId); return l ? `${l.m}/${l.d}` : ''; }).filter(Boolean))];
            const paint = () => {
                const isOpen = openTaskGroups.has(key);
                wrap.classList.toggle('is-open', isOpen);
                head.innerHTML = `<i class="fa-solid fa-layer-group"></i><b>${esc(key)}</b><span class="wm-task-group-count">${cards.length}건</span>`
                    + (dates.length > 1 ? `<span class="wm-task-group-dates">${esc(dates.join(' · '))}</span>` : '')
                    + `<span class="wm-task-group-toggle">${isOpen ? '접기 ▴' : '펼치기 ▾'}</span>`;
            };
            head.addEventListener('click', e => {
                e.stopPropagation();
                if (openTaskGroups.has(key)) openTaskGroups.delete(key); else openTaskGroups.add(key);
                paint();
            });
            paint();
            cards[0].before(wrap);
            wrap.append(head, ...cards);
        });
    }

    const origUpdateUI = window.updateUI;
    if (typeof origUpdateUI === 'function') {
        window.updateUI = (...args) => {
            const result = origUpdateUI(...args);
            groupCardsIn(document.getElementById('logList'));
            return result;
        };
    }
    const origDoSearch = window.doSearch;
    if (typeof origDoSearch === 'function') {
        window.doSearch = (...args) => {
            const result = origDoSearch(...args);
            groupCardsIn(document.getElementById('searchResultList'));
            return result;
        };
    }

    // ═══════════════════════════════════════════
    // 3) 작업 카드 레이아웃
    // ═══════════════════════════════════════════
    const STATUS_COLORS = {
        '완료': '#15803d', '취소': '#dc2626', '보류': '#d97706', '일정변경': '#7c3aed',
        '불필요': '#64748b', '공사': '#0369a1', '이관': '#db2777'
    };
    const BUILT_IN = () => window.BUILT_IN_GROUP_IDS || ['taskTypes', 'coworkers', 'statuses', 'equipments', 'memoTags', 'duration'];

    function altWorkCard(l, indexStr, mode) {
        const ex = g => !!window.isLogGroupExcluded?.(l, g);
        const dow = '일월화수목금토'[new Date(l.y, l.m - 1, l.d).getDay()];
        const statusColor = STATUS_COLORS[l.status] || '#1e40af';
        const accent = window.getWorkCardColor?.(l) || (l.status ? statusColor : '#94a3b8');
        const id = esc(l.id);
        const qtyOf = (g, n) => Number(l.tagQuantities?.[g]?.[n] || 1);
        const withQty = (g, names) => names.map(n => qtyOf(g, n) > 1 ? `${n}×${qtyOf(g, n)}` : n);

        const no = `<span class="wmc-no" title="눌러서 O/X" onclick="event.stopPropagation(); window.toggleLogOx('${id}')">${esc(indexStr || '-')}</span>`;
        const time = `<b class="wmc-time">${esc(l.workTime || '--:--')}</b>`;
        const status = l.status && !ex('statuses') ? `<span class="wmc-status" style="--st:${statusColor}">${esc(l.status)}</span>` : '';
        const alerts = (l.isDuty ? '<span class="wmc-alert">당직</span>' : '')
            + (Number(l.otCount) > 0 ? `<span class="wmc-alert">OT${Number(l.otCount) > 1 ? ' ' + Number(l.otCount) : ''}</span>` : '');
        const taskNo = l.taskNo
            ? `<button type="button" class="task-no-btn wmc-taskno" title="눌러서 타스크 번호 복사" onclick="event.stopPropagation(); window.copyLogTaskNo('${id}')">${window.formatTaskNoHtml ? window.formatTaskNoHtml(l.taskNo) : esc(l.taskNo)}</button>`
            : '';
        const del = `<button type="button" class="btn-del w95-btn wmc-del" onclick="event.stopPropagation(); window.deleteEntry('${id}')">X</button>`;
        const types = ex('taskTypes') ? [] : withQty('taskTypes', String(l.taskType || '').split(', ').filter(Boolean));
        const typeHtml = types.map(t => `<span class="wmc-type">${esc(t)}</span>`).join('');
        // 고객명/주소/내용/특이사항은 기존 카드와 같이 저장된 그대로 넣는다(기존 기록의 줄바꿈 태그 유지)
        const customer = l.customerName ? `<span class="wmc-customer"><i class="fa-solid fa-user"></i>${l.customerName}</span>` : '';
        const addr = l.address ? `<div class="wmc-addr"><i class="fa-solid fa-location-dot"></i><span>${l.address}</span></div>` : '';
        const content = l.content ? `<div class="wmc-content">${l.content}</div>` : '';
        const note = l.note ? `<div class="wmc-note"><i class="fa-solid fa-triangle-exclamation"></i> ${l.note}</div>` : '';

        const meta = [];
        if (!ex('coworkers') && (l.coworkers || []).length) meta.push(['fa-user-group', withQty('coworkers', l.coworkers).join(', ')]);
        if (!ex('equipments')) {
            const names = new Set([...Object.keys(l.equips || {}), ...Object.keys(l.tagQuantities?.equipments || {})]);
            const eq = [...names].map(n => [n, Math.max(Number(l.equips?.[n] || 0), Number(l.tagQuantities?.equipments?.[n] || 0))])
                .filter(([, q]) => q > 0).map(([n, q]) => q > 1 ? `${n}×${q}` : n);
            if (eq.length) meta.push(['fa-box', eq.join(', ')]);
        }
        if (l.startTime || l.endTime) {
            const total = l.totalMin && window.formatDurationMin ? ` (${window.formatDurationMin(l.totalMin)})` : '';
            meta.push(['fa-hourglass-half', `${l.startTime || '--:--'}~${l.endTime || '--:--'}${total}`]);
        }
        (window.getActiveGroups?.() || []).filter(g => !BUILT_IN().includes(g.id)).forEach(g => {
            const val = l.customGroups?.[g.id];
            const names = Array.isArray(val) ? val : (val ? [String(val)] : []);
            if (!names.length || ex(g.id)) return;
            meta.push(['fa-tag', `${g.title || '선택태그'}: ${withQty(g.id, names).join(', ')}`]);
        });
        const metaHtml = meta.length ? `<div class="wmc-meta">${meta.map(([ic, t]) => `<span><i class="fa-solid ${ic}"></i>${esc(t)}</span>`).join('')}</div>` : '';
        const imgs = (l.imgs || []).length
            ? `<div class="log-img-list wmc-imgs">${l.imgs.map((img, k) => `<img src="${esc(img.src)}" onclick="event.stopPropagation(); window.openImageViewer(${k}, 'log', '${id}')">`).join('')}</div>`
            : '';
        const ox = l.personalCheck === 'O' || l.personalCheck === 'X'
            ? `<div class="wmc-ox is-${l.personalCheck === 'O' ? 'o' : 'x'}">${l.personalCheck}</div>` : '';
        const date = `<span class="wmc-date">${l.m}/${l.d}(${dow})</span>`;
        const open = `<div class="log-card w95-out card-work wmc wmc-${mode}" data-log-id="${id}" data-log-cat="work" style="--wmc-accent:${accent};" onclick="window.handleCardClick('${id}', 'work')">${ox}`;

        if (mode === 'mini') {
            const title = [types.join(', '), l.customerName ? String(l.customerName).replace(/<[^>]*>/g, '') : ''].filter(Boolean).join(' · ');
            const sub = l.address ? String(l.address).replace(/<[^>]*>/g, '') : '';
            return `${open}<div class="wmc-head">${no}${time}${status}${alerts}<span class="wmc-mini-text"><b>${esc(title || '작업')}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</span>${taskNo}${del}</div></div>`;
        }
        if (mode === 'timeline') {
            return `${open}<div class="wmc-rail">${time}${no}${date}</div>
                <div class="wmc-main">
                    <div class="wmc-head">${status}${typeHtml}${alerts}<span class="wmc-grow"></span>${taskNo}${del}</div>
                    ${customer ? `<div class="wmc-line">${customer}</div>` : ''}${addr}${content}${note}${metaHtml}${imgs}
                </div></div>`;
        }
        return `${open}<div class="wmc-head">${no}${time}${status}${alerts}<span class="wmc-grow"></span>${taskNo}${del}</div>
            <div class="wmc-body">
                ${typeHtml || customer ? `<div class="wmc-line">${typeHtml}${customer}</div>` : ''}${addr}${content}${note}${metaHtml}${imgs}
            </div></div>`;
    }

    const origCardHtml = window.getLogCardHtml;
    window.getLogCardHtml = (l, indexStr = '') => {
        if (l && l.cat === 'work' && ['summary', 'timeline', 'mini'].includes(S.cardLayout)) {
            try { return altWorkCard(l, indexStr, S.cardLayout); }
            catch (error) { console.warn('카드 레이아웃 오류, 기본 카드로 표시:', error); }
        }
        return origCardHtml(l, indexStr);
    };

    // ═══════════════════════════════════════════
    // 4) 선택태그 상자: 세로 스와이프 방식
    // ═══════════════════════════════════════════
    // 실제 그룹 상자는 숨기고, 그 자리에 [그룹 이름 | 태그 띠] 줄들을 만든다. 띠의 태그는 실제 태그 버튼을
    // 따라 그린 대리 버튼이며, 선택은 기존 window.handleClick(type, index)로 처리한다.
    const SWIPE_CLASS = 'tag-swipe-box';
    const getModal = () => document.getElementById('workModal');
    const getContainer = () => document.getElementById('workDragContainer');
    const swipeActive = () => {
        const modal = getModal();
        return !!modal && !!window.isTagSwipeMode?.() && !modal.classList.contains('layout-edit-mode');
    };
    const swipeBoxes = () => [...(getContainer()?.querySelectorAll(':scope > .drag-item[data-group-ref]') || [])]
        .filter(item => item.dataset.groupRef !== 'duration' && !item.classList.contains('is-hidden-in-work')
            && item.querySelector(':scope > .btn-tag-area'));
    const isExcluded = item => !!item.querySelector(':scope > .box-title.is-log-excluded');
    const titleOf = item => (item.querySelector(':scope > .box-title')?.textContent || '').trim() || '그룹';

    let swipeObserver = null;
    let panel = null;

    function getPanel() {
        if (!panel) {
            panel = document.createElement('div');
            panel.className = 'tag-swipe-panel';
            panel.addEventListener('click', onPanelClick);
            panel.addEventListener('pointerdown', onTitleDown);
        }
        return panel;
    }

    function refreshSwipe() {
        const container = getContainer();
        if (!container) return;
        const on = !!window.isTagSwipeMode?.();
        const boxes = on ? swipeBoxes() : [];
        container.querySelectorAll(`:scope > .${SWIPE_CLASS}`).forEach(item => { if (!boxes.includes(item)) item.classList.remove(SWIPE_CLASS); });
        const setCls = (el, cls, on) => { if (el.classList.contains(cls) !== on) el.classList.toggle(cls, on); };
        const p = getPanel();
        if (!boxes.length) { p.remove(); swipeObserver?.takeRecords(); return; }
        boxes.forEach(item => setCls(item, SWIPE_CLASS, true));
        if (p.parentNode !== container || p.nextElementSibling !== boxes[0]) container.insertBefore(p, boxes[0]);

        const locked = !!window.isWorkEditLocked;
        setCls(p, 'is-locked', locked);
        setCls(p, 'no-long-exclude', !S.swipeLongExclude);
        const existing = new Map([...p.querySelectorAll(':scope > .tag-swipe-row')].map(r => [r.dataset.groupRef, r]));
        boxes.forEach((item, i) => {
            const ref = item.dataset.groupRef;
            let row = existing.get(ref);
            existing.delete(ref);
            if (!row) {
                row = document.createElement('div');
                row.className = 'tag-swipe-row';
                row.dataset.groupRef = ref;
                row.innerHTML = '<div class="tag-swipe-title"><span></span><small></small></div><div class="tag-swipe-strip"></div>';
            }
            if (p.children[i] !== row) p.insertBefore(row, p.children[i] || null);
            const buttons = [...item.querySelectorAll(':scope > .btn-tag-area > .layout-tag-button')];
            const excluded = isExcluded(item);
            setCls(row, 'is-excluded', excluded);
            const t = row.querySelector('.tag-swipe-title > span');
            const title = titleOf(item);
            if (t.textContent !== title) t.textContent = title;
            const sm = row.querySelector('.tag-swipe-title > small');
            const smText = excluded ? '제외됨' : '';
            if (sm.textContent !== smText) sm.textContent = smText;
            const strip = row.querySelector('.tag-swipe-strip');
            const sig = buttons.map(b => `${b.dataset.tagType}|${b.dataset.tagIndex}|${b.classList.contains('active-btn') ? 1 : 0}|${b.textContent.trim()}`).join('\n') + `|${excluded}`;
            if (strip.dataset.sig !== sig) {
                strip.dataset.sig = sig;
                strip.innerHTML = buttons.map(b => `<button type="button" class="w95-btn tag-swipe-chip${b.classList.contains('active-btn') ? ' is-active' : ''}" data-tag-type="${esc(b.dataset.tagType)}" data-tag-index="${esc(b.dataset.tagIndex)}">${esc(b.textContent.trim())}</button>`).join('')
                    + (buttons.length ? '' : '<span class="tag-swipe-empty">항목 없음 · 레이아웃 변경 모드에서 추가</span>')
                    + `<span class="tag-swipe-exclude" aria-hidden="true">${excluded ? '포함' : '제외'}</span>`;
            }
        });
        existing.forEach(row => row.remove());
        swipeObserver?.takeRecords();
    }

    function observeSwipe() {
        const container = getContainer();
        if (!container || swipeObserver) return;
        swipeObserver = new MutationObserver(records => {
            if (!window.isTagSwipeMode?.()) return;
            // 우리가 만든 줄 안에서만 바뀐 건 무시
            if (records.every(r => panel && panel.contains(r.target))) return;
            refreshSwipe();
        });
        swipeObserver.observe(container, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class'] });
    }

    window.applyTagSwipeMode = () => {
        const modal = getModal();
        if (!modal) return;
        modal.classList.toggle('tag-swipe-mode', !!window.isTagSwipeMode?.());
        observeSwipe();
        refreshSwipe();
    };

    const toggleExclude = ref => {
        window.toggleCurrentWorkGroupExcluded?.(ref);
        navigator.vibrate?.(25);
    };
    const selectTag = chip => {
        const type = chip.dataset.tagType;
        const index = Number(chip.dataset.tagIndex);
        if (!type || !Number.isInteger(index)) return;
        window.handleClick?.(type, index);
    };

    function onPanelClick(e) {
        if (!swipeActive() || window.isWorkEditLocked) return;
        if (swipeState?.suppressClick) return;
        const chip = e.target.closest('.tag-swipe-chip');
        if (chip) { e.stopPropagation(); selectTag(chip); return; }
    }

    // ─── 그룹 이름을 누른 채 오른쪽으로 밀기 ───
    let swipeState = null; // { row, strip, startX, startY, x, swiping, target, raf, suppressClick }

    function onTitleDown(e) {
        const title = e.target.closest('.tag-swipe-title');
        if (!title || !swipeActive() || window.isWorkEditLocked) return;
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        const row = title.closest('.tag-swipe-row');
        e.preventDefault();
        try { title.setPointerCapture(e.pointerId); } catch (_) {}
        swipeState = { row, title, strip: row.querySelector('.tag-swipe-strip'), startX: e.clientX, startY: e.clientY, x: e.clientX, swiping: false, target: null, raf: 0 };
        title.addEventListener('pointermove', onTitleMove);
        title.addEventListener('pointerup', onTitleUp);
        title.addEventListener('pointercancel', onTitleCancel);
    }

    function hitTest(st) {
        const x = st.x;
        const stripRect = st.strip.getBoundingClientRect();
        if (x < stripRect.left) return null; // 그룹 이름 위로 돌아오면 선택 없음
        const excludeEl = st.strip.querySelector('.tag-swipe-exclude');
        if (S.swipeLongExclude) {
            const r = excludeEl.getBoundingClientRect();
            const atEnd = st.strip.scrollLeft + st.strip.clientWidth >= st.strip.scrollWidth - 2;
            if ((x >= r.left && r.width) || (atEnd && x >= window.innerWidth - 14)) return excludeEl;
        }
        const chips = [...st.strip.querySelectorAll('.tag-swipe-chip')];
        let best = null, bestDist = Infinity;
        chips.forEach(chip => {
            const r = chip.getBoundingClientRect();
            if (r.right < stripRect.left || r.left > stripRect.right) return; // 띠 밖으로 스크롤된 것
            const dist = x < r.left ? r.left - x : x > r.right ? x - r.right : 0;
            if (dist < bestDist) { bestDist = dist; best = chip; }
        });
        return bestDist <= 6 ? best : null;
    }

    function paintTarget(st) {
        const next = hitTest(st);
        if (next === st.target) return;
        st.target?.classList.remove('is-swipe-target');
        st.target = next;
        next?.classList.add('is-swipe-target');
        st.row.classList.toggle('is-exclude-target', !!next?.classList.contains('tag-swipe-exclude'));
        if (next) navigator.vibrate?.(8);
    }

    // 손가락이 띠 오른쪽 끝에 머물면 띠를 자동으로 넘긴다
    function autoScroll() {
        const st = swipeState;
        if (!st || !st.swiping) return;
        const r = st.strip.getBoundingClientRect();
        const edge = Math.min(r.right, window.innerWidth) - 36;
        const max = st.strip.scrollWidth - st.strip.clientWidth;
        if (st.x > edge && st.strip.scrollLeft < max) {
            st.strip.scrollLeft = Math.min(max, st.strip.scrollLeft + Math.max(3, (st.x - edge) / 3));
            paintTarget(st);
        } else if (st.x < r.left + 8 && st.strip.scrollLeft > 0) {
            st.strip.scrollLeft = Math.max(0, st.strip.scrollLeft - 8);
            paintTarget(st);
        }
        st.raf = requestAnimationFrame(autoScroll);
    }

    function onTitleMove(e) {
        const st = swipeState;
        if (!st) return;
        st.x = e.clientX;
        const dx = e.clientX - st.startX, dy = e.clientY - st.startY;
        if (!st.swiping) {
            if (Math.abs(dy) > 14 && Math.abs(dy) > Math.abs(dx)) { endSwipe(); return; }
            if (dx > 12) {
                st.swiping = true;
                st.row.classList.add('is-swiping');
                st.raf = requestAnimationFrame(autoScroll);
            } else return;
        }
        paintTarget(st);
    }

    function onTitleUp() {
        const st = swipeState;
        if (!st) return;
        const ref = st.row.dataset.groupRef;
        if (!st.swiping) {
            if (S.swipeTitleExclude) toggleExclude(ref);
        } else if (st.target?.classList.contains('tag-swipe-exclude')) {
            toggleExclude(ref);
        } else if (st.target) {
            selectTag(st.target);
            navigator.vibrate?.(20);
        }
        endSwipe(true);
    }
    function onTitleCancel() { endSwipe(); }

    function endSwipe(suppressClick = false) {
        const st = swipeState;
        if (!st || !st.row) return;
        cancelAnimationFrame(st.raf);
        st.target?.classList.remove('is-swipe-target');
        st.row.classList.remove('is-swiping', 'is-exclude-target');
        st.title.removeEventListener('pointermove', onTitleMove);
        st.title.removeEventListener('pointerup', onTitleUp);
        st.title.removeEventListener('pointercancel', onTitleCancel);
        swipeState = suppressClick ? { suppressClick: true } : null;
        if (suppressClick) setTimeout(() => { if (swipeState?.suppressClick) swipeState = null; }, 350);
    }

    // 작업일지를 열 때/레이아웃 변경·잠금이 바뀔 때 줄을 다시 맞춘다
    const wrapAfter = (name, fn) => {
        const orig = window[name];
        if (typeof orig !== 'function') return;
        window[name] = (...args) => { const r = orig(...args); fn(); return r; };
    };
    wrapAfter('openWorkModal', () => window.applyTagSwipeMode());
    wrapAfter('setWorkLayoutMode', () => refreshSwipe());
    wrapAfter('setWorkEditLocked', () => refreshSwipe());

    // ═══════════════════════════════════════════
    // 5) 입력칸 더블탭 붙여넣기
    // ═══════════════════════════════════════════
    const PASTE_TYPES = ['text', 'search', 'tel', 'url', ''];
    const pasteTarget = el => {
        if (!el || el.disabled || el.readOnly) return null;
        if (el.tagName === 'TEXTAREA') return el;
        if (el.tagName === 'INPUT' && PASTE_TYPES.includes((el.getAttribute('type') || '').toLowerCase())) return el;
        return null;
    };
    let lastTap = null; // { el, t, x, y, start, end }
    document.addEventListener('pointerup', e => {
        if (!S.doubleTapPaste || e.pointerType === 'mouse') { lastTap = null; return; }
        const el = pasteTarget(e.target);
        if (!el) { lastTap = null; return; }
        const now = Date.now();
        const prev = lastTap;
        if (prev && prev.el === el && now - prev.t < 380 && Math.hypot(e.clientX - prev.x, e.clientY - prev.y) < 30) {
            lastTap = null;
            e.preventDefault();
            pasteInto(el, prev.start, prev.end);
            return;
        }
        // 첫 탭: 커서 위치는 브라우저가 옮긴 뒤(click 시점)에 기억한다
        lastTap = { el, t: now, x: e.clientX, y: e.clientY, start: el.value.length, end: el.value.length };
    }, true);
    const rememberCaret = e => {
        const tap = lastTap;
        if (!tap || tap.el !== e.target) return;
        try { tap.start = tap.el.selectionStart ?? tap.start; tap.end = tap.el.selectionEnd ?? tap.end; } catch (_) {}
    };
    document.addEventListener('click', rememberCaret, true);
    document.addEventListener('focusin', e => setTimeout(() => rememberCaret(e), 0), true);

    async function pasteInto(el, start, end) {
        let text = '';
        try {
            if (!navigator.clipboard?.readText) throw new Error('unsupported');
            text = await navigator.clipboard.readText();
        } catch (_) {
            toast('클립보드를 읽을 수 없습니다(브라우저 권한 확인)');
            return;
        }
        if (!text) { toast('클립보드가 비어 있습니다'); return; }
        if (el.tagName === 'INPUT') text = text.replace(/\r?\n/g, ' ');
        const len = el.value.length;
        const s = Math.max(0, Math.min(len, Number.isInteger(start) ? start : len));
        const en = Math.max(s, Math.min(len, Number.isInteger(end) ? end : s));
        el.focus();
        try { el.setRangeText(text, s, en, 'end'); }
        catch (_) { el.value = el.value.slice(0, s) + text + el.value.slice(en); }
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        navigator.vibrate?.(15);
        toast('붙여넣었습니다');
    }

    // ─── 시작 ───
    const init = () => { applySettings(false); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
