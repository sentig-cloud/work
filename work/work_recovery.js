// work_recovery.js
// 설정 > 되돌리기 · 복구 > "서버 기록에서 복구"
// 1) 선택태그상자·화면 설정: 서버에 남은 과거 값(보관 기록 + 최근 변경 기록)에서 골라 되돌린다.
// 2) 카드(작업일지): 서버의 하루 한 번 백업에서 지금 없는 카드만 되살린다(지금 있는 카드는 건드리지 않음).
// 3) 백업 파일(.json/.txt)에서 선택태그상자만 가져온다.
// 서버 쪽은 worker.js의 /api/master-history, /api/backups, /api/backup 을 쓴다.

(() => {
    const API = typeof WORK_API_BASE !== 'undefined' ? WORK_API_BASE : 'https://work.sentig335.workers.dev';
    const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const toast = msg => window.showWorkNavigationToast ? window.showWorkNavigationToast(msg) : alert(msg);
    const countTags = groups => (Array.isArray(groups) ? groups : []).reduce((n, g) => n + (Array.isArray(g?.tags) ? g.tags.filter(Boolean).length : 0), 0);
    const fmt = iso => {
        if (!iso) return '-';
        const d = new Date(iso);
        if (isNaN(d)) return String(iso);
        const p = n => String(n).padStart(2, '0');
        return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
    };

    async function getJson(path) {
        const res = await window.fetchWithTimeout(`${API}${path}`, { method: 'GET', headers: { Accept: 'application/json' } }, 20000);
        const text = await res.text();
        if (res.status === 404 && /not found/.test(text)) throw new Error('NEED_WORKER');
        if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 120)}`);
        return text ? JSON.parse(text) : {};
    }
    const errorText = e => e?.message === 'NEED_WORKER'
        ? '서버(worker.js)를 새 버전으로 배포해야 이 기능을 쓸 수 있습니다.'
        : `불러오지 못했습니다: ${esc(e?.message || e)}`;

    // ─── 선택태그상자 · 화면 설정 되돌리기 ───
    let masterItems = [];
    function groupsSummary(groups) {
        if (!Array.isArray(groups)) return '선택태그상자 정보 없음(화면 설정만)';
        return `그룹 ${groups.length}개 · 태그 ${countTags(groups)}개`;
    }
    function groupsDetail(groups) {
        if (!Array.isArray(groups) || !groups.length) return '<div class="rc-empty">선택태그상자 없음</div>';
        return groups.map(g => `<div class="rc-group"><b>${esc(g.title || g.id)}</b> <small>(${(g.tags || []).length})</small><span>${esc((g.tags || []).slice(0, 30).map(t => t?.name).filter(Boolean).join(', '))}${(g.tags || []).length > 30 ? ' …' : ''}</span></div>`).join('');
    }

    async function loadMasterHistory(box) {
        const list = box.querySelector('.rc-master-list');
        list.innerHTML = '<div class="rc-empty">불러오는 중…</div>';
        try {
            const r = await getJson('/api/master-history');
            masterItems = [{ ...r.current, isCurrent: true }, ...(r.items || [])];
            const curTags = countTags(r.current?.groups);
            list.innerHTML = masterItems.map((it, i) => {
                const tags = countTags(it.groups);
                const more = Array.isArray(it.groups) && tags > curTags ? `<em class="rc-more">지금보다 태그 ${tags - curTags}개 많음</em>` : '';
                const src = it.isCurrent ? '지금 서버 값' : it.source === 'history' ? '바뀌기 전 보관본' : '변경 기록';
                return `<div class="rc-item${it.isCurrent ? ' is-current' : ''}" data-idx="${i}">
                    <div class="rc-item-head"><b>${fmt(it.at)}</b><span class="rc-src">${src}</span>${more}</div>
                    <div class="rc-item-sum">${groupsSummary(it.groups)}${it.uiSettings ? ' · 화면 설정 있음' : ''}</div>
                    <div class="rc-item-actions">
                        <button type="button" class="w95-btn" data-rc="detail">자세히</button>
                        ${it.isCurrent ? '' : '<button type="button" class="w95-btn rc-go" data-rc="restore">이 기록으로 되돌리기</button>'}
                    </div>
                    <div class="rc-detail" hidden>${groupsDetail(it.groups)}</div>
                </div>`;
            }).join('') || '<div class="rc-empty">기록이 없습니다.</div>';
        } catch (e) {
            list.innerHTML = `<div class="rc-empty">${errorText(e)}</div>`;
        }
    }

    // groups/uiSettings를 이 기기와 서버에 함께 적용한다(force: 서버의 "태그가 크게 줄면 거부" 보호를 넘긴다)
    async function restoreMaster(groups, uiSettings, label) {
        if (Array.isArray(groups)) {
            window.groups = JSON.parse(JSON.stringify(groups)).filter(Boolean);
            window.ensureDefaultGroups?.();
        }
        if (uiSettings && typeof uiSettings === 'object') window.applyUiSettingsPayload?.(uiSettings);
        window.saveAllLocalOnly?.();
        const master = { clientVersion: 2, uiSettings: window.getUiSettingsPayload(), force: true };
        if (Array.isArray(groups)) {
            Object.assign(master, { groups: window.groups });
            ['taskTypes', 'coworkers', 'statuses', 'equipments', 'memoTags'].forEach(k => { master[k] = window.groups.find(g => g.id === k)?.tags || []; });
        }
        const res = await window.fetchWithTimeout(`${API}/api/patch`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ operations: [], master })
        }, 30000);
        if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 120)}`);
        const result = await res.json().catch(() => ({}));
        if (result.savedAt) window.setSyncStamp?.(result.savedAt);
        window.renderAllWorkGroups?.();
        window.refreshCurrentUI?.();
        window.renderMain?.();
        toast(`${label} 되돌렸습니다`);
    }

    // ─── 카드: 하루 백업에서 빠진 것만 되살리기 ───
    async function loadBackups(box) {
        const list = box.querySelector('.rc-backup-list');
        list.innerHTML = '<div class="rc-empty">불러오는 중…</div>';
        try {
            const r = await getJson('/api/backups');
            const items = r.backups || [];
            list.innerHTML = items.length ? items.map(b => `<div class="rc-item" data-dow="${b.dow}">
                    <div class="rc-item-head"><b>${esc(b.date)}</b><span class="rc-src">하루 백업</span></div>
                    <div class="rc-item-sum">카드 ${b.logs ?? '-'}개 · 그룹 ${b.groups ?? '-'}개 · 태그 ${b.tags ?? '-'}개 <small>(지금 카드 ${(window.logs || []).length}개)</small></div>
                    <div class="rc-item-actions">
                        <button type="button" class="w95-btn rc-go" data-rc="cards">빠진 카드 되살리기</button>
                        <button type="button" class="w95-btn" data-rc="bgroups">이 날 선택태그상자로</button>
                    </div>
                </div>`).join('') : '<div class="rc-empty">아직 백업이 없습니다. 서버를 새 버전으로 배포한 뒤 하루 한 번 자동으로 쌓입니다.</div>';
        } catch (e) {
            list.innerHTML = `<div class="rc-empty">${errorText(e)}</div>`;
        }
    }

    async function restoreCardsFromBackup(dow) {
        const r = await getJson(`/api/backup?dow=${dow}`);
        const backupLogs = Array.isArray(r.data?.logs) ? r.data.logs : [];
        const have = new Set((window.logs || []).map(l => String(l?.id)));
        const trashed = new Set((window.trash || []).map(l => String(l?.id)));
        const missing = backupLogs.filter(l => l && !have.has(String(l.id)));
        const fromTrash = missing.filter(l => trashed.has(String(l.id)));
        if (!missing.length) return alert(`${r.date} 백업에 있던 카드는 지금 모두 있습니다.`);
        const msg = `${r.date} 백업에서 지금 없는 카드 ${missing.length}개를 되살립니다.` + (fromTrash.length ? `\n(그중 ${fromTrash.length}개는 휴지통에 있는 카드라 빼고 되살립니다)` : '') + '\n지금 있는 카드는 바뀌지 않습니다.';
        if (!confirm(msg)) return;
        const revive = missing.filter(l => !trashed.has(String(l.id)));
        revive.forEach(l => window.saveToLocalStore('logs', JSON.parse(JSON.stringify(l))));
        window.refreshCurrentUI?.();
        window.renderMain?.();
        toast(`카드 ${revive.length}개를 되살렸습니다`);
    }

    // ─── 카드 기록으로 선택태그상자 되살리기 ───
    // 카드(작업일지)에는 그룹별로 고른 태그 이름이 남아 있다(customGroups[그룹ID], 작업유형, 매니저, 상태, 장비, 메모 태그).
    // 지금 선택태그상자에 없는 그룹/태그를 찾아 다시 만든다. 그룹 이름(제목)은 카드에 없어서 임시 이름을 붙인다.
    const BUILT_IN_TITLES = { taskTypes: '작업유형', coworkers: '매니저', statuses: '상태', equipments: '장비', memoTags: '메모 태그' };
    let scanResult = [];
    function scanLogs() {
        const usage = {};
        const add = (gid, name) => {
            const n = String(name ?? '').trim();
            if (!n || !gid || gid === 'duration') return;
            (usage[gid] = usage[gid] || new Map()).set(n, (usage[gid].get(n) || 0) + 1);
        };
        (window.logs || []).concat(window.trash || []).forEach(l => {
            if (!l) return;
            if (l.cat === 'work') {
                String(l.taskType || '').split(',').forEach(n => add('taskTypes', n));
                (l.coworkers || []).forEach(n => add('coworkers', n));
                add('statuses', l.status);
                Object.entries(l.equips || {}).forEach(([n, q]) => { if (Number(q) > 0) add('equipments', n); });
                Object.entries(l.customGroups || {}).forEach(([gid, v]) => (Array.isArray(v) ? v : [v]).forEach(n => add(gid, n)));
            } else {
                (l.tags || []).forEach(n => add('memoTags', n));
            }
        });
        const groups = window.groups || [];
        const out = [];
        Object.entries(usage).forEach(([gid, map]) => {
            const g = groups.find(x => x && x.id === gid);
            const have = new Set((g?.tags || []).map(t => t?.name));
            const missing = [...map.entries()].filter(([n]) => !have.has(n)).sort((a, b) => b[1] - a[1]);
            if (!missing.length) return;
            const made = /^grp_(\d{12,})$/.exec(gid);
            const madeAt = made ? new Date(Number(made[1])) : null;
            const guess = BUILT_IN_TITLES[gid] || `복구 그룹${madeAt ? ` (${madeAt.getFullYear()}.${madeAt.getMonth() + 1}.${madeAt.getDate()} 만듦)` : ''}`;
            out.push({ gid, isNew: !g, title: g?.title || guess, missing });
        });
        // 사라진 그룹(새로 만들 것)을 먼저
        return out.sort((a, b) => (b.isNew - a.isNew) || (b.missing.length - a.missing.length));
    }
    function renderScan(box) {
        const list = box.querySelector('.rc-scan-list');
        scanResult = scanLogs();
        if (!scanResult.length) { list.innerHTML = '<div class="rc-empty">카드에 쓰인 그룹·태그는 지금 선택태그상자에 모두 있습니다.</div>'; return; }
        list.innerHTML = scanResult.map((r, i) => `<label class="rc-item rc-scan-item${r.isNew ? ' is-new' : ''}">
                <div class="rc-item-head"><input type="checkbox" data-scan="${i}" checked>
                    ${r.isNew ? `<input type="text" class="w95-in rc-title" data-title="${i}" value="${esc(r.title)}" maxlength="20">` : `<b>${esc(r.title)}</b>`}
                    <span class="rc-src">${r.isNew ? '사라진 그룹 · 새로 만듦' : '빠진 태그 추가'}</span></div>
                <div class="rc-item-sum">태그 ${r.missing.length}개: ${esc(r.missing.slice(0, 25).map(([n, c]) => `${n}(${c})`).join(', '))}${r.missing.length > 25 ? ' …' : ''}</div>
            </label>`).join('') + '<button type="button" class="w95-btn ws-wide-btn rc-go" data-rc="applyScan">고른 것 되살리기</button>';
    }
    async function applyScan(box) {
        const picks = scanResult.filter((_, i) => box.querySelector(`[data-scan="${i}"]`)?.checked);
        if (!picks.length) return alert('되살릴 항목을 고르세요.');
        const groups = JSON.parse(JSON.stringify(window.groups || []));
        let maxOrder = groups.reduce((m, g) => Math.max(m, g?.order ?? 0), 0);
        picks.forEach(r => {
            const i = scanResult.indexOf(r);
            const title = (box.querySelector(`[data-title="${i}"]`)?.value || r.title).trim() || r.title;
            let g = groups.find(x => x && x.id === r.gid);
            if (!g) {
                g = { id: r.gid, title, enabled: true, order: ++maxOrder, selectionMode: 'multi', remember: false, showNumber: true, includeMonthly: true, showCount: false, active: true, tags: [] };
                groups.push(g);
            }
            g.tags = g.tags || [];
            r.missing.forEach(([name]) => g.tags.push({ name }));
        });
        const newCount = picks.filter(r => r.isNew).length;
        const tagCount = picks.reduce((n, r) => n + r.missing.length, 0);
        if (!confirm(`${newCount ? `그룹 ${newCount}개를 새로 만들고 ` : ''}태그 ${tagCount}개를 되살립니다.\n지금 있는 그룹·태그는 지우지 않습니다.`)) return;
        await restoreMaster(groups, null, '선택태그상자');
        renderScan(box);
    }

    // ─── 이 기기에 보관된 이전 선택태그상자 ───
    function localBackups() {
        try { return JSON.parse(localStorage.getItem('wm_groups_local_backups') || '[]') || []; } catch (_) { return []; }
    }
    function renderLocal(box) {
        const list = box.querySelector('.rc-local-list');
        const items = localBackups();
        list.innerHTML = items.length ? items.map((b, i) => `<div class="rc-item" data-local="${i}">
                <div class="rc-item-head"><b>${fmt(b.at)}</b><span class="rc-src">이 기기에 보관됨</span>${countTags(b.groups) > countTags(window.groups) ? `<em class="rc-more">지금보다 태그 ${countTags(b.groups) - countTags(window.groups)}개 많음</em>` : ''}</div>
                <div class="rc-item-sum">${groupsSummary(b.groups)}</div>
                <div class="rc-item-actions"><button type="button" class="w95-btn" data-rc="detail">자세히</button><button type="button" class="w95-btn rc-go" data-rc="restoreLocal">이걸로 되돌리기</button></div>
                <div class="rc-detail" hidden>${groupsDetail(b.groups)}</div>
            </div>`).join('') : '<div class="rc-empty">이 기기에는 보관된 이전 선택태그상자가 없습니다. 사고 뒤 아직 앱을 안 연 다른 기기(휴대폰·PC)에서 이 화면을 열어 보세요.</div>';
    }

    // ─── 백업 파일에서 선택태그상자만 ───
    function findGroupsInFile(obj) {
        const cands = [obj?.data?.groups, obj?.groups, obj?.saved?.data?.groups, obj?.master?.groups];
        return cands.find(g => Array.isArray(g) && g.length) || null;
    }

    function render(box) {
        if (box.dataset.ready) return;
        box.dataset.ready = '1';
        box.innerHTML = `
            <div class="tt-settings-section">
                <div class="tt-settings-label">카드 기록으로 선택태그상자 되살리기</div>
                <div class="ws-desc">카드에 쓰였던 그룹·태그 중 지금 없는 것을 찾아 다시 만듭니다. 사라진 그룹은 이름이 남아 있지 않아 임시 이름이 붙으니, 칸에서 이름을 고쳐 주세요. (태그 색·갯수 같은 세부 설정은 기본값으로 만들어집니다)</div>
                <button type="button" class="w95-btn ws-wide-btn" data-rc="scan">카드 기록 살펴보기</button>
                <div class="rc-list rc-scan-list"></div>
            </div>
            <div class="tt-settings-section">
                <div class="tt-settings-label">이 기기에 보관된 이전 선택태그상자</div>
                <div class="ws-desc">서버 값을 받기 직전, 이 기기의 선택태그상자가 서버보다 많으면 여기 따로 보관됩니다.</div>
                <button type="button" class="w95-btn ws-wide-btn" data-rc="local">보관된 것 보기</button>
                <div class="rc-list rc-local-list"></div>
            </div>
            <div class="tt-settings-section">
                <div class="tt-settings-label">선택태그상자 · 화면 설정</div>
                <div class="ws-desc">서버에 남아 있는 과거 값 목록입니다. 태그가 지금보다 많은 기록을 골라 "되돌리기"를 누르세요.</div>
                <label class="tt-settings-check"><input type="checkbox" id="rcWithUi" checked> 화면 설정(카드 꾸미기·레이아웃·메뉴 등)도 그 기록으로</label>
                <button type="button" class="w95-btn ws-wide-btn" data-rc="loadMaster">기록 불러오기</button>
                <div class="rc-list rc-master-list"></div>
            </div>
            <div class="tt-settings-section">
                <div class="tt-settings-label">카드(작업일지)</div>
                <div class="ws-desc">하루 한 번 서버 백업에서 <b>지금 없는 카드만</b> 되살립니다. 지금 있는 카드는 바뀌지 않습니다.</div>
                <button type="button" class="w95-btn ws-wide-btn" data-rc="loadBackups">백업 목록 불러오기</button>
                <div class="rc-list rc-backup-list"></div>
            </div>
            <div class="tt-settings-section">
                <div class="tt-settings-label">백업 파일에서 선택태그상자만</div>
                <div class="ws-desc">예전에 받아 둔 백업 파일(.json/.txt)이 있으면, 카드는 그대로 두고 선택태그상자만 가져옵니다.</div>
                <button type="button" class="w95-btn ws-wide-btn" data-rc="file">백업 파일 고르기</button>
                <input type="file" class="rc-file" accept=".json,.txt,application/json,text/plain" hidden>
            </div>`;
        box.addEventListener('click', async e => {
            const act = e.target.closest('[data-rc]')?.dataset.rc;
            if (!act) return;
            const item = e.target.closest('.rc-item');
            try {
                if (act === 'scan') renderScan(box);
                else if (act === 'applyScan') await applyScan(box);
                else if (act === 'local') renderLocal(box);
                else if (act === 'restoreLocal') {
                    const b = localBackups()[Number(item.dataset.local)];
                    if (!b) return;
                    if (!confirm(`${fmt(b.at)}에 이 기기에 보관된 선택태그상자(${groupsSummary(b.groups)})로 되돌립니다.\n카드(작업일지)는 바뀌지 않습니다.`)) return;
                    await restoreMaster(b.groups, null, '선택태그상자');
                    renderLocal(box);
                }
                else if (act === 'loadMaster') await loadMasterHistory(box);
                else if (act === 'loadBackups') await loadBackups(box);
                else if (act === 'file') box.querySelector('.rc-file').click();
                else if (act === 'detail') { const d = item.querySelector('.rc-detail'); d.hidden = !d.hidden; }
                else if (act === 'restore') {
                    const it = masterItems[Number(item.dataset.idx)];
                    const withUi = box.querySelector('#rcWithUi').checked;
                    const what = [Array.isArray(it.groups) ? `선택태그상자(${groupsSummary(it.groups)})` : '', withUi && it.uiSettings ? '화면 설정' : ''].filter(Boolean).join(' + ');
                    if (!what) return alert('이 기록에는 되돌릴 내용이 없습니다.');
                    if (!confirm(`${fmt(it.at)} 기록으로 ${what}을(를) 되돌립니다.\n카드(작업일지)는 바뀌지 않습니다.`)) return;
                    await restoreMaster(it.groups, withUi ? it.uiSettings : null, what);
                    await loadMasterHistory(box);
                } else if (act === 'cards') await restoreCardsFromBackup(Number(item.dataset.dow));
                else if (act === 'bgroups') {
                    const r = await getJson(`/api/backup?dow=${Number(item.dataset.dow)}`);
                    const groups = r.data?.groups;
                    if (!Array.isArray(groups) || !groups.length) return alert('이 백업에는 선택태그상자가 없습니다.');
                    if (!confirm(`${r.date} 백업의 선택태그상자(${groupsSummary(groups)})로 되돌립니다.`)) return;
                    await restoreMaster(groups, box.querySelector('#rcWithUi').checked ? r.data.uiSettings : null, '선택태그상자');
                }
            } catch (err) {
                alert(err?.message === 'NEED_WORKER' ? '서버(worker.js)를 새 버전으로 배포해야 합니다.' : `실패: ${err?.message || err}`);
            }
        });
        box.querySelector('.rc-file').addEventListener('change', async e => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            try {
                const obj = JSON.parse(await file.text());
                const groups = findGroupsInFile(obj);
                if (!groups) return alert('이 파일에서 선택태그상자를 찾지 못했습니다.');
                if (!confirm(`파일의 선택태그상자(${groupsSummary(groups)})로 되돌립니다.\n카드(작업일지)는 바뀌지 않습니다.`)) return;
                await restoreMaster(groups, null, '선택태그상자');
            } catch (err) {
                alert(`파일을 읽지 못했습니다: ${err?.message || err}`);
            }
        });
    }

    window.setupRecoveryBox = () => {
        const box = document.getElementById('wmRecoveryBox');
        if (box) render(box);
    };
})();
