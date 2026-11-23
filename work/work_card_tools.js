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
        groupByTaskNo: true,
        doubleTapPaste: true,
        swipeLongExclude: true,
        swipeTitleExclude: true,
        swipePreview: true,
        // 메인 화면
        mainView: 'classic',      // classic | detail | summary
        mainCols: 'auto',         // auto | 2 | 3 | 4
        mainYearTotal: true,
        mainYearStatus: true,
        mainHighlight: false,
        // 화면 · 디자인
        uiRefresh: true,
        fontScale: 'normal',      // normal | large | xlarge
        fontFamily: 'classic',    // classic | system
        // 신규 기능
        labMainGear: true,
        labNextJob: false,
        labCalToday: true,
        labBigTouch: false,
        // 글 넣기
        importSkipDup: true
    };
    // "되돌리기"로 돌아갈 예전 모양(동작 기능은 건드리지 않는다)
    const LEGACY_LOOK = {
        mainView: 'classic', mainCols: 'auto', mainYearTotal: true, mainYearStatus: true, mainHighlight: false,
        cardLayout: 'default', uiRefresh: false, fontScale: 'normal', fontFamily: 'classic',
        labNextJob: false, labCalToday: false, labBigTouch: false, swipePreview: false
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
    window.copyCardField = async (event, id, field) => {
        const names = { address: ['copyAddress', '주소'], note: ['copyNote', '특이사항'], content: ['copyContent', '작업내용'], customerName: ['copyCustomer', '고객명'] };
        const entry = names[field];
        const value = logById(id)?.[field];
        if (!entry || !S[entry[0]] || !value) return;
        event.stopPropagation();
        const holder = document.createElement('div');
        holder.innerHTML = String(value).replace(/<br\s*\/?\s*>/gi, '\n');
        const text = holder.textContent || '';
        try {
            if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(text);
            else {
                const input = document.createElement('textarea');
                input.value = text; input.style.position = 'fixed'; input.style.opacity = '0';
                document.body.appendChild(input); input.select();
                const ok = document.execCommand('copy'); input.remove();
                if (!ok) throw new Error('copy failed');
            }
            toast(`${entry[1]}을(를) 복사했습니다.`);
        } catch (_) { alert('복사하지 못했습니다. 클립보드 권한을 확인하세요.'); }
    };
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
        const root = document.documentElement;
        root.classList.toggle('wm-font-large', S.fontScale === 'large');
        root.classList.toggle('wm-font-xlarge', S.fontScale === 'xlarge');
        document.body.classList.toggle('wm-font-system', S.fontFamily === 'system');
        document.body.classList.toggle('wm-ui-refresh', !!S.uiRefresh);
        document.body.classList.toggle('wm-big-touch', !!S.labBigTouch);
        document.body.classList.add('wm-main-gear'); // 보일지 말지는 메뉴 버튼 설정이 정한다
        ensureMainGear();
        applyMenus();
        if (redraw) { rerender(); if (Array.isArray(window.logs)) window.renderMain?.(); }
    }
    window.resetCardToolsLook = () => window.setCardToolsSettings({ ...LEGACY_LOOK });

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

    const dateKeyOf = l => `${l.y}-${String(l.m).padStart(2, '0')}-${String(l.d).padStart(2, '0')}`;
    const currentDateKey = () => dateKeyOf({ y: window.currentYear, m: window.curMonth, d: window.curDay });
    const dateLabelOf = l => `${Number(l.y) !== Number(window.currentYear) ? `${l.y}년 ` : ''}${l.m}/${l.d}(${'일월화수목금토'[new Date(l.y, l.m - 1, l.d).getDay()]})`;
    // 그 날짜 안에서의 작업 순번(카드의 No.)
    const dayIndexOf = l => {
        const same = (window.logs || []).filter(x => x && x.cat === 'work' && x.y === l.y && x.m === l.m && x.d === l.d)
            .sort((a, b) => String(a.workTime || a.time || '').localeCompare(String(b.workTime || b.time || '')));
        return same.findIndex(x => String(x.id) === String(l.id)) + 1 || '';
    };

    // 타스크 번호(=받는 글의 가입번호)가 같은 작업 카드를 한 묶음으로.
    // - 보고 있는 날짜의 카드가 맨 앞, 그 뒤로 다른 날짜 카드(최근 날짜부터)
    // - otherDays: 목록에 없는 다른 날짜의 같은 타스크 카드도 묶음 안에 불러온다(날짜 목록용)
    function groupCardsIn(list, { otherDays = false } = {}) {
        if (!list || !S.groupByTaskNo) return;
        const groups = new Map();
        list.querySelectorAll(':scope > .log-card[data-log-cat="work"]').forEach(card => {
            const key = normTaskNo(logById(card.dataset.logId)?.taskNo);
            if (!key) return;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(card);
        });
        const today = currentDateKey();
        const byRecent = (a, b) => dateKeyOf(b).localeCompare(dateKeyOf(a)) || String(a.workTime || '').localeCompare(String(b.workTime || ''));
        groups.forEach((cards, key) => {
            const shown = new Set(cards.map(c => String(c.dataset.logId)));
            const extra = otherDays
                ? (window.logs || []).filter(l => l && l.cat === 'work' && normTaskNo(l.taskNo) === key && !shown.has(String(l.id))).sort(byRecent)
                : [];
            const total = cards.length + extra.length;
            if (total < 2) return;
            // 보고 있는 날짜 먼저, 나머지는 최근 날짜부터
            cards.sort((a, b) => {
                const la = logById(a.dataset.logId), lb = logById(b.dataset.logId);
                const ca = la && dateKeyOf(la) === today ? 1 : 0, cb = lb && dateKeyOf(lb) === today ? 1 : 0;
                return (cb - ca) || (la && lb ? byRecent(la, lb) : 0);
            });
            const wrap = document.createElement('div');
            wrap.className = 'wm-task-group';
            wrap.dataset.taskNo = key;
            const head = document.createElement('button');
            head.type = 'button';
            head.className = 'w95-btn wm-task-group-head';
            const allLogs = [...cards.map(c => logById(c.dataset.logId)).filter(Boolean), ...extra];
            const dates = [...new Set(allLogs.map(l => `${l.m}/${l.d}`))];
            const paint = () => {
                const isOpen = openTaskGroups.has(key);
                wrap.classList.toggle('is-open', isOpen);
                head.innerHTML = `<i class="fa-solid fa-layer-group"></i><b>${esc(key)}</b><span class="wm-task-group-count">${total}건</span>`
                    + (extra.length ? `<span class="wm-task-group-other">다른 날 ${extra.length}</span>` : '')
                    // 다른 날짜는 묶음 안의 날짜 띠로 보여주므로, 다른 날짜를 불러오지 않는 목록(검색)에서만 날짜를 나열한다
                    + (!extra.length && dates.length > 1 ? `<span class="wm-task-group-dates">${esc(dates.join(' · '))}</span>` : '')
                    + `<span class="wm-task-group-toggle">${isOpen ? '접기 ▴' : '펼치기 ▾'}</span>`;
            };
            head.addEventListener('click', e => {
                e.stopPropagation();
                if (openTaskGroups.has(key)) openTaskGroups.delete(key); else openTaskGroups.add(key);
                paint();
            });
            paint();
            cards[0].before(wrap);
            cards[0].classList.add('wm-task-group-first');
            wrap.append(head, ...cards);
            if (extra.length) {
                const holder = document.createElement('div');
                holder.innerHTML = extra.map(l => `<div class="wm-task-other-date">${esc(dateLabelOf(l))}</div>${window.getLogCardHtml(l, dayIndexOf(l))}`).join('');
                holder.querySelectorAll(':scope > .log-card').forEach(c => c.classList.add('wm-task-other-card'));
                wrap.append(...holder.childNodes);
            }
        });
    }

    const origUpdateUI = window.updateUI;
    if (typeof origUpdateUI === 'function') {
        window.updateUI = (...args) => {
            const result = origUpdateUI(...args);
            groupCardsIn(document.getElementById('logList'), { otherDays: true });
            markNextJob();
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
        const customer = l.customerName ? `<span class="wmc-customer" onclick="window.copyCardField(event, '${id}', 'customerName')"><i class="fa-solid fa-user"></i>${l.customerName}</span>` : '';
        const addr = l.address ? `<div class="wmc-addr" onclick="window.copyCardField(event, '${id}', 'address')"><i class="fa-solid fa-location-dot"></i><span>${l.address}</span></div>` : '';
        const content = l.content ? `<div class="wmc-content" onclick="window.copyCardField(event, '${id}', 'content')">${l.content}</div>` : '';
        const note = l.note ? `<div class="wmc-note" onclick="window.copyCardField(event, '${id}', 'note')"><i class="fa-solid fa-triangle-exclamation"></i> ${l.note}</div>` : '';

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
            const heading = /^복구\s*그룹(?:\s*\(|$)/.test(g.title || '') ? '' : `${g.title || '선택태그'}: `;
            meta.push(['fa-tag', `${heading}${withQty(g.id, names).join(', ')}`]);
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
            return `${open}<div class="wmc-head">${no}${time}${status}${alerts}<span class="wmc-mini-text"><b>${esc(title || '작업')}</b>${sub ? `<small onclick="window.copyCardField(event, '${id}', 'address')">${esc(sub)}</small>` : ''}</span>${taskNo}${del}</div></div>`;
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
        updatePreview(st);
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
                updatePreview(st);
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
        hidePreview();
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

    // ─── 스와이프 중 선택될 태그를 화면 가운데 위에 크게 표시 ───
    function ensurePreview() {
        let el = document.getElementById('tagSwipePreview');
        if (!el) {
            el = document.createElement('div');
            el.id = 'tagSwipePreview';
            el.setAttribute('aria-live', 'polite');
            el.innerHTML = '<small></small><b></b><em></em>';
            document.body.appendChild(el);
        }
        return el;
    }
    function updatePreview(st) {
        if (!S.swipePreview || !st?.row || !st.swiping) { hidePreview(); return; }
        const el = ensurePreview();
        const group = st.row.querySelector('.tag-swipe-title > span')?.textContent || '';
        const t = st.target;
        let main, sub, kind;
        if (!t) { main = '—'; sub = '여기서 놓으면 선택 안 함'; kind = 'none'; }
        else if (t.classList.contains('tag-swipe-exclude')) {
            main = t.textContent === '포함' ? '집계 포함' : '집계 제외';
            sub = `놓으면 ${main}`; kind = 'exclude';
        } else {
            const active = t.classList.contains('is-active');
            main = t.textContent; sub = active ? '놓으면 선택 해제' : '놓으면 선택'; kind = active ? 'off' : 'on';
        }
        el.querySelector('small').textContent = group;
        el.querySelector('b').textContent = main;
        el.querySelector('em').textContent = sub;
        el.dataset.kind = kind;
        el.classList.add('is-show');
    }
    function hidePreview() { document.getElementById('tagSwipePreview')?.classList.remove('is-show'); }

    // ═══════════════════════════════════════════
    // 6) 메인 화면(1~12월) 표시 형식 · 전체 누적
    // ═══════════════════════════════════════════
    // 기존 renderMain이 연도/상태 필터를 건 로그로 updateDashboardStats를 부르므로, 그 순간의 로그를 받아 쓴다.
    let capturing = false, capturedYearLogs = null;
    const origDash = window.updateDashboardStats;
    window.updateDashboardStats = (...args) => {
        if (capturing) capturedYearLogs = window.logs;
        return origDash?.(...args);
    };
    const prevRenderMain = window.renderMain;
    if (typeof prevRenderMain === 'function') {
        window.renderMain = (...args) => {
            capturing = true; capturedYearLogs = null;
            let result;
            try { result = prevRenderMain(...args); } finally { capturing = false; }
            try { decorateMain(capturedYearLogs || (window.logs || []).filter(l => l && (l.y || 2026) === window.currentYear)); }
            catch (error) { console.warn('메인 표시 형식 오류:', error); }
            return result;
        };
    }

    function monthStats(logs, m) {
        const ml = logs.filter(l => l && Number(l.m) === m);
        const work = ml.filter(l => l.cat === 'work');
        const statuses = {};
        work.forEach(l => { if (l.status && !window.isLogGroupExcluded?.(l, 'statuses')) statuses[l.status] = (statuses[l.status] || 0) + 1; });
        return {
            work: work.length,
            done: statuses['완료'] || 0,
            statuses,
            ot: ml.reduce((s, c) => s + (Number(c.otCount) || 0), 0),
            duty: new Set(ml.filter(l => l.isDutyLog || l.cat === 'duty' || l.isDuty).map(l => l.d)).size,
            commute: new Set(ml.filter(l => l.cat === 'commute_in' && l.inTime).map(l => l.d)).size
        };
    }
    const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
    const statusChip = (name, n) => `<span class="wm-st-chip" style="--st:${STATUS_COLORS[name] || '#1e40af'}">${esc(name)} ${n}</span>`;

    function decorateMain(yearLogs) {
        const grid = document.getElementById('mainGrid');
        if (!grid) return;
        const mode = ['detail', 'summary'].includes(S.mainView) ? S.mainView : 'classic';
        const cols = ['2', '3', '4'].includes(String(S.mainCols)) ? Number(S.mainCols) : (mode === 'summary' ? 4 : 3);
        grid.dataset.view = mode;
        grid.style.setProperty('--main-cols', cols);
        grid.classList.toggle('wm-main-cols', mode !== 'classic' || String(S.mainCols) !== 'auto');
        const now = new Date();
        const isThisYear = Number(window.currentYear) === now.getFullYear();
        const stats = Array.from({ length: 12 }, (_, i) => monthStats(yearLogs, i + 1));

        if (mode !== 'classic') {
            grid.innerHTML = stats.map((st, i) => {
                const m = i + 1;
                const cls = `month-card wm-mc wm-mc-${mode}${st.work ? '' : ' is-empty'}`;
                if (mode === 'summary') {
                    return `<div class="${cls}" onclick="window.openPop(${m})"><b class="wm-mc-month">${m}월</b><span class="wm-mc-big">${st.work}</span><small>${st.work ? `완료 ${st.done}` : '&nbsp;'}</small></div>`;
                }
                if (!st.work) return `<div class="${cls}" onclick="window.openPop(${m})"><div class="wm-mc-top"><b class="wm-mc-month">${m}월</b><span class="wm-mc-count">0<small>건</small></span></div><div class="wm-mc-none">기록 없음</div></div>`;
                const others = Object.entries(st.statuses).filter(([n]) => n !== '완료').sort((a, b) => b[1] - a[1]).slice(0, 3);
                return `<div class="${cls}" onclick="window.openPop(${m})">
                    <div class="wm-mc-top"><b class="wm-mc-month">${m}월</b><span class="wm-mc-count">${st.work}<small>건</small></span></div>
                    <div class="wm-mc-bar" title="완료율"><i style="width:${pct(st.done, st.work)}%"></i></div>
                    <div class="wm-mc-pct">완료 ${st.done} · ${pct(st.done, st.work)}%</div>
                    <div class="wm-mc-st">${others.map(([n, c]) => statusChip(n, c)).join('')}</div>
                    <div class="wm-mc-foot"><span>OT ${st.ot}</span><span>당직 ${st.duty}</span><span>출근 ${st.commute}</span></div>
                </div>`;
            }).join('');
        }
        if (S.mainHighlight && isThisYear) grid.children[now.getMonth()]?.classList.add('is-current-month');

        const summary = document.getElementById('yearlySummary');
        if (!summary) return;
        summary.hidden = S.mainYearTotal === false;
        if (S.mainYearTotal === false || (mode === 'classic' && S.mainYearStatus !== false)) return; // 기본 모양 그대로
        const total = stats.reduce((a, s) => ({ work: a.work + s.work, done: a.done + s.done, ot: a.ot + s.ot, duty: a.duty + s.duty }), { work: 0, done: 0, ot: 0, duty: 0 });
        const yearStatuses = {};
        stats.forEach(s => Object.entries(s.statuses).forEach(([n, c]) => { yearStatuses[n] = (yearStatuses[n] || 0) + c; }));
        const statusHtml = S.mainYearStatus !== false
            ? Object.entries(yearStatuses).sort((a, b) => b[1] - a[1]).map(([n, c]) => statusChip(n, c)).join('') : '';
        summary.innerHTML = `<div class="wm-year">
            <b class="wm-year-title">${esc(window.currentYear)}년 누적</b>
            <span class="wm-year-item"><em>작업</em>${total.work}건</span>
            <span class="wm-year-item"><em>완료율</em>${pct(total.done, total.work)}%</span>
            <span class="wm-year-item"><em>OT</em>${total.ot}회</span>
            <span class="wm-year-item"><em>당직</em>${total.duty}일</span>
            ${statusHtml ? `<div class="wm-year-status">${statusHtml}</div>` : ''}
        </div>`;
    }

    // ═══════════════════════════════════════════
    // 7) 신규 기능
    // ═══════════════════════════════════════════
    // 메인 화면 설정 버튼
    function ensureMainGear() {
        const tools = document.querySelector('#mainHeader .header-right-tools');
        if (!tools || document.getElementById('wmMainGearBtn')) return;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.id = 'wmMainGearBtn';
        btn.className = 'w95-btn icon-btn wm-main-gear-btn';
        btn.title = '설정';
        btn.innerHTML = '<i class="fa-solid fa-gear"></i>';
        btn.addEventListener('click', () => window.openMainSettings ? window.openMainSettings() : alert('설정을 불러오지 못했습니다.'));
        tools.appendChild(btn);
    }

    // 오늘 목록에서 다음 작업 표시
    let lastNextJobKey = '';
    function markNextJob() {
        if (!S.labNextJob) return;
        const now = new Date();
        if (Number(window.currentYear) !== now.getFullYear() || Number(window.curMonth) !== now.getMonth() + 1 || Number(window.curDay) !== now.getDate()) return;
        const hhmm = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
        const skip = ['완료', '취소', '불필요', '이관'];
        const next = (window.logs || [])
            .filter(l => l && l.cat === 'work' && Number(l.y) === now.getFullYear() && Number(l.m) === now.getMonth() + 1 && Number(l.d) === now.getDate())
            .filter(l => /^\d{2}:\d{2}/.test(l.workTime || '') && l.workTime.slice(0, 5) >= hhmm && !skip.includes(l.status))
            .sort((a, b) => a.workTime.localeCompare(b.workTime))[0];
        if (!next) return;
        const card = document.querySelector(`#logList .log-card[data-log-id="${CSS.escape(String(next.id))}"]`);
        if (!card) return;
        card.classList.add('wm-next-job');
        if (!card.querySelector('.wm-next-badge')) card.insertAdjacentHTML('afterbegin', '<span class="wm-next-badge">다음</span>');
        const key = `${hhmm.slice(0, 2)}|${next.id}`;
        if (key !== lastNextJobKey) {
            lastNextJobKey = key;
            requestAnimationFrame(() => card.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
        }
    }

    // 달력에 오늘 표시
    const origRenderCal = window.renderCal;
    if (typeof origRenderCal === 'function') {
        window.renderCal = (year, month, ...rest) => {
            const result = origRenderCal(year, month, ...rest);
            const now = new Date();
            if (S.labCalToday && Number(year) === now.getFullYear() && Number(month) === now.getMonth()) {
                document.querySelector(`#calBody td[data-day="${now.getDate()}"]`)?.classList.add('wm-cal-today');
            }
            return result;
        };
    }

    // ═══════════════════════════════════════════
    // 8) 메뉴 버튼 배치 (설정 > 메뉴 버튼)
    // ═══════════════════════════════════════════
    // 메인 윗줄과 달력 윗줄의 버튼을 "보일 것 + 순서"로 정한다. 기존 버튼 요소를 그대로 옮기므로 기능은 그대로다.
    const MENU_ITEMS = {
        main: {
            search:     { label: '검색',     icon: 'fa-magnifying-glass', find: () => document.querySelector('#mainHeader button[onclick*="openSearch"]') },
            trash:      { label: '휴지통',   icon: 'fa-trash-can',        find: () => document.querySelector('#mainHeader button[onclick*="openTrash"]') },
            weekly:     { label: '주간',     icon: 'fa-table-cells',      find: () => document.querySelector('#mainHeader button[onclick*="goToWeeklyTimetable"]') },
            photo:      { label: '사진 넣기', icon: 'fa-images',          find: () => document.querySelector('#mainHeader button[onclick*="openPhotoInsert"]') },
            textImport: { label: '글 넣기',  icon: 'fa-file-lines',       make: () => window.openTextImport?.() },
            spacer:     { label: '빈칸',     icon: 'fa-arrows-left-right', spacer: true },
            zip:        { label: 'ZIP 백업', icon: 'fa-file-arrow-down',  find: () => document.getElementById('zipBackupBtn') },
            import:     { label: '백업 복원', icon: 'fa-file-import',     find: () => document.querySelector('#mainHeader button[onclick*="triggerImport"]') },
            export:     { label: '엑셀',     icon: 'fa-file-excel',       find: () => document.querySelector('#mainHeader button[onclick*="WorkExportUI"]') },
            settings:   { label: '설정',     icon: 'fa-gear',             find: () => document.getElementById('wmMainGearBtn') }
        },
        cal: {
            weekly:     { label: '주간',     icon: 'fa-table-cells',      find: () => document.getElementById('timetableToggleBtn') },
            photo:      { label: '사진 넣기', icon: 'fa-images',          find: () => document.querySelector('#popupLayer .pop-nav button[onclick*="openPhotoInsert"]') },
            textImport: { label: '글 넣기',  icon: 'fa-file-lines',       find: () => document.getElementById('textImportBtn') },
            search:     { label: '검색',     icon: 'fa-magnifying-glass', find: () => document.querySelector('#popupLayer .pop-nav button[onclick*="openSearch"]') },
            export:     { label: '엑셀',     icon: 'fa-file-excel',       make: () => window.WorkExportUI ? window.WorkExportUI.open() : alert('내보내기 모듈이 로드되지 않았습니다.') },
            settings:   { label: '설정',     icon: 'fa-gear',             make: () => window.openMainSettings?.() }
        }
    };
    // 지금까지의 배치를 기본값으로 둔다(설정 버튼은 예전 "메인 설정 버튼"을 껐으면 뺀다)
    const MENU_DEFAULTS = {
        main: ['search', 'trash', 'weekly', 'photo', 'spacer', 'zip', 'import', 'export', 'settings'],
        cal: ['weekly', 'photo', 'textImport', 'search']
    };
    const menuListOf = bar => {
        const saved = S[bar === 'main' ? 'menuMain' : 'menuCal'];
        const valid = Array.isArray(saved) ? saved.filter(id => MENU_ITEMS[bar][id]) : null;
        if (valid) return [...new Set(valid)];
        const def = [...MENU_DEFAULTS[bar]];
        return bar === 'main' && S.labMainGear === false ? def.filter(id => id !== 'settings') : def;
    };
    window.getMenuItems = bar => MENU_ITEMS[bar];
    window.getMenuDefaults = bar => [...MENU_DEFAULTS[bar]];
    window.getMenuList = bar => menuListOf(bar);

    function menuElement(bar, id, scope) {
        const item = MENU_ITEMS[bar][id];
        let el = scope.querySelector(`[data-menu-id="${id}"]`) || item.find?.();
        if (!el && (item.make || item.spacer)) {
            el = document.createElement(item.spacer ? 'div' : 'button');
            if (item.spacer) el.className = 'wm-menu-spacer';
            else {
                el.type = 'button';
                el.className = 'w95-btn icon-btn';
                el.title = item.label;
                el.innerHTML = `<i class="fa-solid ${item.icon}"></i>`;
                el.addEventListener('click', item.make);
            }
        }
        if (el) el.dataset.menuId = id;
        return el;
    }

    // ─── 메뉴 꾸미기: 표시 방식·크기·모양(줄마다) + 버튼별 이름·색 ───
    const MENU_STYLE_DEFAULT = { display: 'icon', size: 'md', shape: 'classic' };
    const MENU_STYLE_CHOICES = {
        display: [['icon', '아이콘'], ['both', '아이콘+글자'], ['text', '글자']],
        size: [['sm', '작게'], ['md', '보통'], ['lg', '크게']],
        shape: [['classic', '기본'], ['round', '둥근'], ['flat', '납작']]
    };
    const MENU_COLORS = ['', '#000080', '#dc2626', '#16a34a', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#111827'];
    const menuStyleOf = bar => {
        const s = { ...MENU_STYLE_DEFAULT, ...(S.menuStyle?.[bar] || {}) };
        Object.keys(MENU_STYLE_CHOICES).forEach(k => { if (!MENU_STYLE_CHOICES[k].some(([v]) => v === s[k])) s[k] = MENU_STYLE_DEFAULT[k]; });
        return s;
    };
    const menuCustomOf = bar => {
        const raw = S.menuCustom?.[bar];
        const out = {};
        if (raw && typeof raw === 'object') Object.entries(raw).forEach(([id, v]) => {
            if (!MENU_ITEMS[bar][id] || !v || typeof v !== 'object') return;
            const label = String(v.label || '').trim().slice(0, 8);
            const color = /^#[0-9a-f]{6}$/i.test(v.color || '') ? v.color : '';
            if (label || color) out[id] = { label, color };
        });
        return out;
    };
    const labelOf = (bar, id, custom) => custom?.[id]?.label || MENU_ITEMS[bar][id].label;
    const styleClasses = st => `wm-mb-d-${st.display} wm-mb-s-${st.size} wm-mb-sh-${st.shape}`;
    const setStyleClasses = (el, st) => {
        [...el.classList].filter(c => /^wm-mb-(d|s|sh)-/.test(c)).forEach(c => el.classList.remove(c));
        styleClasses(st).split(' ').forEach(c => el.classList.add(c));
    };
    // 버튼에 글자(이름)와 색을 입힌다
    function decorateButton(el, label, color) {
        if (el.classList.contains('wm-menu-spacer')) return;
        let span = el.querySelector(':scope > .wm-mb-label');
        if (!span) { span = document.createElement('span'); span.className = 'wm-mb-label'; el.appendChild(span); }
        if (span.textContent !== label) span.textContent = label;
        el.classList.toggle('has-mb-color', !!color);
        if (color) el.style.setProperty('--mb-color', color); else el.style.removeProperty('--mb-color');
    }

    function applyMenuBar(bar) {
        const scope = bar === 'main' ? document.getElementById('mainHeader') : document.querySelector('#popupLayer .pop-nav');
        const holder = bar === 'main' ? scope?.querySelector('.toolbar-group') : scope?.querySelector('.pop-nav-tools');
        if (!scope || !holder) return;
        const list = menuListOf(bar);
        const custom = menuCustomOf(bar);
        Object.keys(MENU_ITEMS[bar]).forEach(id => {
            const el = menuElement(bar, id, scope);
            if (!el) return;
            const shown = list.includes(id);
            el.classList.toggle('wm-menu-hidden', !shown);
            if (!shown && el.parentNode !== holder) holder.appendChild(el);
            decorateButton(el, labelOf(bar, id, custom), custom[id]?.color || '');
        });
        list.forEach(id => { const el = menuElement(bar, id, scope); if (el) holder.appendChild(el); });
        scope.classList.add('wm-menu-custom');
        setStyleClasses(scope, menuStyleOf(bar));
    }

    let menuReady = false;
    function applyMenus() {
        if (!menuReady) return; // 페이지 로드 뒤(ZIP 백업 버튼이 생긴 뒤)부터 옮긴다
        if (!document.getElementById('zipBackupBtn')) window.installBackupUI?.();
        ensureMainGear();
        applyMenuBar('main');
        applyMenuBar('cal');
    }
    window.applyMenus = applyMenus;
    window.addEventListener('load', () => setTimeout(() => { menuReady = true; applyMenus(); }, 60));

    // ─── 설정 화면의 메뉴 편집기 ───
    // 위 줄(보이는 버튼): 두 개를 차례로 누르면 자리 바꿈 / 하나 고르고 [숨기기] / 고른 버튼은 이름·색 꾸미기
    // 아래 줄(숨긴 버튼): 누르면 맨 뒤에 추가, 위에서 하나를 골라 둔 상태면 그 자리와 바꿈
    // [순서대로 다시 고르기]: 위 줄을 비우고, 아래에서 보일 순서대로 누른다
    // 꾸미기: 표시 방식·크기·모양을 고르면 미리보기에 바로 보인다(저장해야 실제 반영)
    const editors = {};
    function chipHtml(bar, id, ed, cls = '') {
        const it = MENU_ITEMS[bar][id];
        const color = ed.custom[id]?.color;
        return `<button type="button" class="wm-me-chip ${cls}" data-id="${id}"${color ? ` style="--mb-color:${color}"` : ''}><i class="fa-solid ${it.icon}"></i><span>${esc(labelOf(bar, id, ed.custom))}</span></button>`;
    }
    function previewHtml(bar, ed) {
        return ed.list.map(id => {
            const it = MENU_ITEMS[bar][id];
            if (it.spacer) return '<span class="wm-menu-spacer"></span>';
            const color = ed.custom[id]?.color;
            return `<span class="w95-btn icon-btn${color ? ' has-mb-color' : ''}" data-menu-id="${id}"${color ? ` style="--mb-color:${color}"` : ''}><i class="fa-solid ${it.icon}"></i><span class="wm-mb-label">${esc(labelOf(bar, id, ed.custom))}</span></span>`;
        }).join('') || '<span class="wm-me-empty">보이는 버튼이 없습니다</span>';
    }
    function ensureEditorExtras(root, bar) {
        if (root.querySelector('.wm-me-deco')) return;
        const segs = Object.entries(MENU_STYLE_CHOICES).map(([key, opts]) => `
            <div class="wm-me-deco-row"><span>${{ display: '표시', size: '크기', shape: '모양' }[key]}</span>
                <div class="ws-seg">${opts.map(([v, t]) => `<label><input type="radio" name="wmMenu_${bar}_${key}" value="${v}" data-mstyle="${key}"><span>${t}</span></label>`).join('')}</div>
            </div>`).join('');
        root.insertAdjacentHTML('afterbegin', `<div class="wm-me-label">미리보기</div><div class="wm-me-preview"></div>`);
        root.insertAdjacentHTML('beforeend', `
            <div class="wm-me-deco">
                <div class="wm-me-label">꾸미기 (이 줄 전체)</div>
                ${segs}
                <div class="wm-me-item" hidden>
                    <div class="wm-me-label wm-me-item-title"></div>
                    <div class="wm-me-deco-row"><span>이름</span><input type="text" class="w95-in wm-me-name" maxlength="8" placeholder="기본 이름" autocomplete="off"></div>
                    <div class="wm-me-deco-row"><span>색</span><div class="wm-me-colors">${MENU_COLORS.map(c => `<button type="button" class="wm-me-color${c ? '' : ' is-none'}" data-color="${c}" title="${c || '원래 색'}"${c ? ` style="background:${c}"` : ''}>${c ? '' : '원래'}</button>`).join('')}</div></div>
                </div>
            </div>`);
        root.addEventListener('change', e => {
            const key = e.target.dataset.mstyle;
            if (!key) return;
            editors[bar].style[key] = e.target.value;
            paintEditor(bar);
        });
        root.querySelector('.wm-me-name').addEventListener('input', e => {
            const ed = editors[bar];
            if (ed.sel === null) return;
            const id = ed.list[ed.sel];
            ed.custom[id] = { ...(ed.custom[id] || {}), label: e.target.value.trim().slice(0, 8) };
            paintEditor(bar, { keepName: true });
        });
    }
    function paintEditor(bar, { keepName = false } = {}) {
        const ed = editors[bar];
        const root = ed?.root;
        if (!root) return;
        const hidden = Object.keys(MENU_ITEMS[bar]).filter(id => !ed.list.includes(id));
        root.querySelector('.wm-me-shown').innerHTML = ed.list.length
            ? ed.list.map((id, i) => chipHtml(bar, id, ed, ed.sel === i ? 'is-sel' : '').replace('<button', `<button data-pos="${i}"`)).join('')
            : '<span class="wm-me-empty">아래에서 보일 순서대로 누르세요</span>';
        root.querySelector('.wm-me-pool').innerHTML = hidden.length ? hidden.map(id => chipHtml(bar, id, ed)).join('') : '<span class="wm-me-empty">모두 보이는 중</span>';
        root.querySelector('[data-me="hide"]').disabled = ed.sel === null;
        const selId = ed.sel !== null ? ed.list[ed.sel] : null;
        root.querySelector('.wm-me-hint').textContent = selId
            ? `"${labelOf(bar, selId, ed.custom)}" 선택됨 · 바꿀 자리를 누르거나, 아래 버튼을 누르면 그 자리에 들어갑니다`
            : '버튼 두 개를 차례로 누르면 자리가 바뀝니다 · 하나를 누르면 이름·색을 바꿀 수 있습니다';
        // 미리보기
        const pv = root.querySelector('.wm-me-preview');
        pv.className = `wm-me-preview ${styleClasses(ed.style)}`;
        pv.innerHTML = previewHtml(bar, ed);
        root.querySelectorAll('input[data-mstyle]').forEach(r => { r.checked = ed.style[r.dataset.mstyle] === r.value; });
        // 고른 버튼 꾸미기
        const item = root.querySelector('.wm-me-item');
        const canDecorate = selId && !MENU_ITEMS[bar][selId].spacer;
        item.hidden = !canDecorate;
        if (canDecorate) {
            item.querySelector('.wm-me-item-title').textContent = `"${MENU_ITEMS[bar][selId].label}" 버튼 꾸미기`;
            const name = item.querySelector('.wm-me-name');
            if (!keepName) name.value = ed.custom[selId]?.label || '';
            name.placeholder = MENU_ITEMS[bar][selId].label;
            const color = ed.custom[selId]?.color || '';
            item.querySelectorAll('.wm-me-color').forEach(b => b.classList.toggle('is-on', b.dataset.color === color));
        }
    }
    function setupEditor(root) {
        const bar = root.dataset.bar;
        editors[bar] = { root, list: menuListOf(bar), sel: null, style: menuStyleOf(bar), custom: menuCustomOf(bar) };
        ensureEditorExtras(root, bar);
        root.addEventListener('click', e => {
            const ed = editors[bar];
            const act = e.target.closest('[data-me]')?.dataset.me;
            const colorBtn = e.target.closest('.wm-me-color');
            const chip = e.target.closest('.wm-me-chip');
            if (colorBtn) {
                if (ed.sel === null) return;
                const id = ed.list[ed.sel];
                ed.custom[id] = { ...(ed.custom[id] || {}), color: colorBtn.dataset.color };
                paintEditor(bar, { keepName: true });
                return;
            }
            if (act === 'hide' && ed.sel !== null) { ed.list.splice(ed.sel, 1); ed.sel = null; }
            else if (act === 'restart') { ed.list = []; ed.sel = null; }
            else if (act === 'default') { ed.list = [...MENU_DEFAULTS[bar]]; ed.style = { ...MENU_STYLE_DEFAULT }; ed.custom = {}; ed.sel = null; }
            else if (chip && chip.dataset.pos !== undefined) {
                const pos = Number(chip.dataset.pos);
                if (ed.sel === null) ed.sel = pos;
                else if (ed.sel === pos) ed.sel = null;
                else { [ed.list[ed.sel], ed.list[pos]] = [ed.list[pos], ed.list[ed.sel]]; ed.sel = null; }
            } else if (chip) {
                if (ed.sel !== null) { ed.list[ed.sel] = chip.dataset.id; ed.sel = null; }
                else ed.list.push(chip.dataset.id);
            } else return;
            paintEditor(bar);
        });
    }
    window.loadMenuEditors = () => {
        document.querySelectorAll('#ttSettingsModal .wm-me[data-bar]').forEach(root => {
            const bar = root.dataset.bar;
            if (!editors[bar] || editors[bar].root !== root) setupEditor(root);
            Object.assign(editors[bar], { list: menuListOf(bar), sel: null, style: menuStyleOf(bar), custom: menuCustomOf(bar) });
            paintEditor(bar);
        });
    };
    window.readMenuEditors = () => {
        const out = {};
        if (editors.main) out.menuMain = [...editors.main.list];
        if (editors.cal) out.menuCal = [...editors.cal.list];
        if (editors.main || editors.cal) {
            const clean = c => Object.fromEntries(Object.entries(c || {}).filter(([, v]) => v && (v.label || v.color)));
            out.menuStyle = { main: { ...(editors.main?.style || menuStyleOf('main')) }, cal: { ...(editors.cal?.style || menuStyleOf('cal')) } };
            out.menuCustom = { main: clean(editors.main?.custom || menuCustomOf('main')), cal: clean(editors.cal?.custom || menuCustomOf('cal')) };
        }
        return out;
    };

    // ─── 시작 ───
    const init = () => {
        applySettings(false);
        // 주의: 여기(앱 시작)에서는 절대 서버로 보낼 변경 표시를 만들지 않는다.
        // 예전에 여기서 설정을 저장했더니, 서버 데이터를 받기 전에 이 기기의 오래된 선택태그상자·레이아웃이
        // 서버로 올라가 덮어쓰는 사고가 났다. 타스크 묶기 기본값은 DEFAULTS(groupByTaskNo: true)로 충분하다.
        if (!S.groupTaskNoOnV2) {
            S.groupByTaskNo = true; S.groupTaskNoOnV2 = true;
            try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (_) {}
        }
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
