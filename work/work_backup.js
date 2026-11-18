// work_backup.js
// 설정 > 내보내기 · 백업 > "서버 백업"
// - 전체 백업: 작업일지(카드)·휴지통·선택태그상자·화면 설정 전부 + 이 기기 설정
// - 설정 백업: 선택태그상자·화면 설정 + 이 기기 설정
// - 서버에 보관(최근 30개) + 하루 자동 백업 목록, 백업 내용 보기, 파일로 받기, 복원, 지우기
// - 백업 파일(.json) 열어보기 → 내용 보기, 서버에 올리기
// 서버는 worker.js의 /api/manual-backup(s), /api/manual-backup/{upload,delete,restore}, /api/backups 를 쓴다.

(() => {
    const API = typeof WORK_API_BASE !== 'undefined' ? WORK_API_BASE : 'https://work.sentig335.workers.dev';
    const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const toast = msg => window.showWorkNavigationToast ? window.showWorkNavigationToast(msg) : alert(msg);
    const countTags = groups => (Array.isArray(groups) ? groups : []).reduce((n, g) => n + (Array.isArray(g?.tags) ? g.tags.filter(Boolean).length : 0), 0);
    const pad = n => String(n).padStart(2, '0');
    const fmt = iso => {
        const d = new Date(iso);
        return isNaN(d) ? String(iso || '-') : `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };
    const sizeText = n => (n > 1048576 ? `${(n / 1048576).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1024))}KB`);

    // 이 기기에만 저장되는 설정(wm_로 시작). 데이터·동기화·로그인·캐시는 뺀다.
    const LOCAL_EXCLUDE = ['wm_logs', 'wm_trash', 'wm_groups', 'wm_dirty_map', 'wm_auth', 'wm_sync_updated_at', 'wm_push_seq',
        'wm_local_rev', 'wm_geocode_cache', 'wm_vision_ocr_usage', 'wm_groups_local_backups', 'wm_migrated_v2'];
    window.getLocalSettingsSnapshot = () => {
        const out = {};
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith('wm_') && !LOCAL_EXCLUDE.includes(k)) out[k] = localStorage.getItem(k);
        }
        return out;
    };

    async function call(method, path, body) {
        const res = await window.fetchWithTimeout(`${API}${path}`, {
            method, headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: body ? JSON.stringify(body) : undefined
        }, 60000);
        const text = await res.text();
        if (res.status === 404 && /not found/.test(text)) throw new Error('NEED_WORKER');
        const data = text ? JSON.parse(text) : {};
        if (!res.ok || data.ok === false) throw new Error(data.error || `${res.status}`);
        return data;
    }
    const errText = e => (e?.message === 'NEED_WORKER' ? '서버(worker.js)를 새 버전으로 배포해야 이 기능을 쓸 수 있습니다.' : `실패: ${e?.message || e}`);
    // 서버로 아직 안 보낸 변경이 있으면 먼저 보낸다(백업·복원이 최신 상태를 기준으로 하도록)
    async function flushPending() {
        if (window.hasDirtyChanges?.()) await window.syncNow?.(true);
    }

    // ─── 백업 파일 받기 ───
    function download(backup) {
        const d = new Date(backup.createdAt || Date.now());
        const name = `work_backup_${backup.kind === 'settings' ? 'settings' : 'full'}_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}.json`;
        const blob = new Blob([JSON.stringify(backup, null, 1)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = name;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        toast(`${name} 받는 중`);
    }

    // 여러 형식의 백업 파일을 { kind, label, createdAt, data, localSettings } 로 맞춘다
    function normalizeFile(obj, fileName) {
        if (obj && obj.data && (obj.kind === 'full' || obj.kind === 'settings')) return { ...obj, source: obj.source || 'file' };
        const data = window.extractLegacyData ? window.extractLegacyData(obj) : (obj?.data || obj?.saved?.data || obj);
        if (!data || typeof data !== 'object') return null;
        const isFull = Array.isArray(data.logs);
        if (!isFull && !Array.isArray(data.groups)) return null;
        return { kind: isFull ? 'full' : 'settings', label: fileName || '파일', createdAt: obj?.savedAt || obj?.createdAt || null, source: 'file', data, localSettings: obj?.localSettings || {} };
    }

    // ═══════════════════════════════════════════
    // 백업 보기 창
    // ═══════════════════════════════════════════
    const CAT = { work: '작업', memo: '메모', photo: '사진', commute_in: '출근', commute_out: '퇴근' };
    let viewing = null;
    function ensureViewer() {
        let el = document.getElementById('bkViewer');
        if (el) return el;
        el = document.createElement('div');
        el.id = 'bkViewer';
        el.className = 'modal-overlay';
        el.style.zIndex = '2720';
        el.innerHTML = `<div class="modal-box w95-window bkv-box">
                <div class="w95-titlebar"><span id="bkvTitle">백업 보기</span><button type="button" class="w95-btn" data-bkv="close">X</button></div>
                <div class="bkv-summary" id="bkvSummary"></div>
                <div class="bkv-tabs" id="bkvTabs"></div>
                <div class="bkv-body" id="bkvBody"></div>
                <div class="modal-footer bkv-footer" id="bkvFooter"></div>
            </div>`;
        document.body.appendChild(el);
        el.addEventListener('click', async e => {
            const act = e.target.closest('[data-bkv]')?.dataset.bkv;
            if (!act) {
                const row = e.target.closest('.bkv-row');
                if (row) { const d = row.querySelector('.bkv-row-detail'); if (d) d.hidden = !d.hidden; }
                return;
            }
            if (act === 'close') el.style.display = 'none';
            else if (act.startsWith('tab:')) showTab(act.slice(4));
            else if (act === 'download') download(viewing);
            else if (act === 'more') { cardLimit += 300; showTab('cards'); }
            else if (act === 'upload') {
                try {
                    const r = await call('POST', '/api/manual-backup/upload', { kind: viewing.kind, label: viewing.label, data: viewing.data, localSettings: viewing.localSettings });
                    toast('서버에 백업으로 올렸습니다');
                    el.style.display = 'none';
                    refreshList(document.getElementById('wmBackupBox'));
                    return r;
                } catch (err) { alert(errText(err)); }
            }
        });
        el.addEventListener('input', e => { if (e.target.matches('#bkvSearch, #bkvMonth')) { cardLimit = 300; renderCards(); } });
        el.addEventListener('change', e => { if (e.target.matches('#bkvMonth')) { cardLimit = 300; renderCards(); } });
        return el;
    }

    let cardLimit = 300;
    function logLine(l) {
        const when = `${l.y || '?'}.${l.m || '?'}.${l.d || '?'} ${l.workTime || l.time || l.inTime || l.outTime || ''}`;
        const main = l.cat === 'work' ? [l.customerName, l.address].filter(Boolean).join(' · ') : String(l.memo || l.commuteNote || '').replace(/<[^>]*>/g, ' ').slice(0, 60);
        const tail = [l.taskNo ? `#${String(l.taskNo).replace(/\s+/g, '')}` : '', l.status || '', l.taskType || ''].filter(Boolean).join(' · ');
        const detail = Object.entries(l).filter(([k]) => !['id', 'updatedAt'].includes(k)).map(([k, v]) => {
            let val = v;
            if (k === 'imgs') val = `${(v || []).length}장`;
            else if (v && typeof v === 'object') val = JSON.stringify(v);
            return `<div><b>${esc(k)}</b> ${esc(String(val ?? ''))}</div>`;
        }).join('');
        return `<div class="bkv-row"><div class="bkv-row-main"><span class="bkv-when">${esc(when)}</span><span class="bkv-cat cat-${esc(l.cat)}">${esc(CAT[l.cat] || l.cat || '')}</span><span class="bkv-text">${esc(main || '(내용 없음)')}</span></div>${tail ? `<div class="bkv-row-sub">${esc(tail)}</div>` : ''}<div class="bkv-row-detail" hidden>${detail}</div></div>`;
    }
    function renderCards() {
        const body = document.getElementById('bkvBody');
        const logs = (viewing.data.logs || []).filter(Boolean);
        const q = (document.getElementById('bkvSearch')?.value || '').trim().toLowerCase();
        const month = document.getElementById('bkvMonth')?.value || '';
        const list = logs.filter(l => (!month || `${l.y}-${pad(l.m)}` === month) && (!q || JSON.stringify(l).toLowerCase().includes(q)))
            .sort((a, b) => `${b.y}-${pad(b.m)}-${pad(b.d)} ${b.workTime || b.time || ''}`.localeCompare(`${a.y}-${pad(a.m)}-${pad(a.d)} ${a.workTime || a.time || ''}`));
        const box = body.querySelector('.bkv-card-list');
        box.innerHTML = `<div class="bkv-count">${list.length}건${list.length > cardLimit ? ` 중 ${cardLimit}건 표시` : ''}</div>` + list.slice(0, cardLimit).map(logLine).join('')
            + (list.length > cardLimit ? '<button type="button" class="w95-btn ws-wide-btn" data-bkv="more">더 보기</button>' : '') + (list.length ? '' : '<div class="bkv-empty">조건에 맞는 카드가 없습니다.</div>');
    }
    function showTab(tab) {
        document.querySelectorAll('#bkvTabs [data-bkv]').forEach(b => b.classList.toggle('is-on', b.dataset.bkv === `tab:${tab}`));
        const body = document.getElementById('bkvBody');
        const d = viewing.data || {};
        if (tab === 'cards') {
            const months = [...new Set((d.logs || []).filter(Boolean).map(l => `${l.y}-${pad(l.m)}`))].sort().reverse();
            body.innerHTML = `<div class="bkv-filter"><input type="search" id="bkvSearch" class="w95-in" placeholder="검색(고객명·주소·타스크…)"><select id="bkvMonth" class="w95-in"><option value="">전체 기간</option>${months.map(m => `<option value="${m}">${m.replace('-', '년 ')}월</option>`).join('')}</select></div><div class="bkv-card-list"></div>`;
            renderCards();
        } else if (tab === 'groups') {
            const groups = (d.groups || []).filter(Boolean);
            body.innerHTML = groups.length ? groups.map(g => `<div class="bkv-group"><b>${esc(g.title || g.id)}</b> <small>${(g.tags || []).length}개</small><div>${(g.tags || []).filter(Boolean).map(t => `<span class="bkv-tag">${esc(t.name)}</span>`).join('') || '<em>태그 없음</em>'}</div></div>`).join('') : '<div class="bkv-empty">선택태그상자 없음</div>';
        } else if (tab === 'settings') {
            const ui = d.uiSettings || {};
            const local = viewing.localSettings || {};
            const row = (k, v) => { const s = typeof v === 'string' ? v : JSON.stringify(v, null, 1); return `<details class="bkv-set"><summary><b>${esc(k)}</b> <small>${sizeText(s.length)}</small></summary><pre>${esc(s.length > 20000 ? s.slice(0, 20000) + '\n…' : s)}</pre></details>`; };
            body.innerHTML = `<div class="bkv-sub">서버에 같이 저장되는 화면 설정 (${Object.keys(ui).length})</div>${Object.entries(ui).map(([k, v]) => row(k, v)).join('') || '<div class="bkv-empty">없음</div>'}
                <div class="bkv-sub">이 기기 설정 (${Object.keys(local).length})</div>${Object.entries(local).map(([k, v]) => row(k, v)).join('') || '<div class="bkv-empty">없음</div>'}`;
        }
    }
    function openViewer(backup, { fromFile = false } = {}) {
        viewing = backup;
        cardLimit = 300;
        const el = ensureViewer();
        const d = backup.data || {};
        const logs = (d.logs || []).filter(Boolean);
        const dates = logs.map(l => `${l.y}-${pad(l.m)}-${pad(l.d)}`).filter(s => !s.includes('undefined')).sort();
        document.getElementById('bkvTitle').textContent = backup.kind === 'settings' ? '설정 백업 보기' : '전체 백업 보기';
        document.getElementById('bkvSummary').innerHTML = `<div><b>${esc(backup.label || (backup.kind === 'settings' ? '설정 백업' : '전체 백업'))}</b> <small>${esc(fmt(backup.createdAt))}</small></div>
            <div class="bkv-stats">${backup.kind === 'full' ? `<span>카드 ${logs.length}</span><span>휴지통 ${(d.trash || []).length}</span>` : ''}<span>그룹 ${(d.groups || []).length}</span><span>태그 ${countTags(d.groups)}</span><span>설정 ${Object.keys(d.uiSettings || {}).length + Object.keys(backup.localSettings || {}).length}</span>${dates.length ? `<span>기간 ${dates[0]} ~ ${dates[dates.length - 1]}</span>` : ''}</div>`;
        const tabs = [backup.kind === 'full' ? ['cards', `카드 ${logs.length}`] : null, ['groups', `선택태그상자 ${(d.groups || []).length}`], ['settings', '설정']].filter(Boolean);
        document.getElementById('bkvTabs').innerHTML = tabs.map(([t, l]) => `<button type="button" class="w95-btn" data-bkv="tab:${t}">${l}</button>`).join('');
        document.getElementById('bkvFooter').innerHTML = `<button type="button" class="w95-btn" data-bkv="download">파일로 받기</button>${fromFile ? '<button type="button" class="w95-btn bkv-go" data-bkv="upload">서버에 백업으로 올리기</button>' : ''}<button type="button" class="w95-btn" data-bkv="close">닫기</button>`;
        el.style.display = 'flex';
        showTab(tabs[0][0]);
    }
    window.openBackupViewer = openViewer;

    // ═══════════════════════════════════════════
    // 설정 화면의 서버 백업 칸
    // ═══════════════════════════════════════════
    const SOURCE_LABEL = { manual: '직접', file: '올린 파일', auto: '복원 전 자동', daily: '하루 자동' };
    async function refreshList(box) {
        if (!box) return;
        const list = box.querySelector('.bk-list');
        list.innerHTML = '<div class="bkv-empty">불러오는 중…</div>';
        try {
            const [manual, daily] = await Promise.all([
                call('GET', '/api/manual-backups'),
                call('GET', '/api/backups').catch(() => ({ backups: [] }))
            ]);
            const items = [
                ...(manual.backups || []).map(b => ({ ...b, ref: { id: b.id } })),
                ...(daily.backups || []).map(b => ({ kind: 'full', source: 'daily', label: `하루 자동 백업 ${b.date}`, createdAt: b.backupAt, logs: b.logs, groups: b.groups, tags: b.tags, ref: { dow: b.dow } }))
            ].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
            list.innerHTML = items.length ? items.map((b, i) => `<div class="bk-item kind-${b.kind}" data-i="${i}">
                    <div class="bk-head"><span class="bk-kind">${b.kind === 'settings' ? '설정' : '전체'}</span><b>${esc(b.label || (b.kind === 'settings' ? '설정 백업' : '전체 백업'))}</b><span class="bk-src">${SOURCE_LABEL[b.source] || ''}</span></div>
                    <div class="bk-sum">${esc(fmt(b.createdAt))} · ${b.kind === 'full' ? `카드 ${b.logs ?? '-'} · ` : ''}그룹 ${b.groups ?? '-'} · 태그 ${b.tags ?? '-'}${b.size ? ` · ${sizeText(b.size)}` : ''}</div>
                    <div class="bk-actions">
                        <button type="button" class="w95-btn" data-bk="view">보기</button>
                        <button type="button" class="w95-btn" data-bk="file">파일로 받기</button>
                        <button type="button" class="w95-btn bk-go" data-bk="restoreMenu">복원</button>
                        ${b.ref.id ? '<button type="button" class="w95-btn bk-del" data-bk="delete">지우기</button>' : ''}
                    </div>
                    <div class="bk-restore" hidden>
                        ${b.kind === 'full' ? `<button type="button" class="w95-btn" data-bk="restore:merge">빠진 카드만 되살리기</button>
                        <button type="button" class="w95-btn" data-bk="restore:settings">설정만 되돌리기</button>
                        <button type="button" class="w95-btn bk-danger" data-bk="restore:full">전체를 이 백업으로 바꾸기</button>` : '<button type="button" class="w95-btn" data-bk="restore:settings">설정 되돌리기</button>'}
                    </div>
                </div>`).join('') : '<div class="bkv-empty">서버에 백업이 없습니다. 위에서 만들어 보세요.</div>';
            list._items = items;
        } catch (e) {
            list.innerHTML = `<div class="bkv-empty">${esc(errText(e))}</div>`;
        }
    }

    async function fetchBackup(ref) {
        const q = ref.id ? `id=${encodeURIComponent(ref.id)}` : `dow=${ref.dow}`;
        return (await call('GET', `/api/manual-backup?${q}`)).backup;
    }

    async function restore(item, mode) {
        const name = `${item.label || '백업'} (${fmt(item.createdAt)})`;
        const msg = {
            merge: `${name}에서 지금 없는 카드만 되살립니다.\n지금 있는 카드·설정은 바뀌지 않습니다.`,
            settings: `${name}의 선택태그상자·화면 설정·이 기기 설정으로 되돌립니다.\n카드(작업일지)는 바뀌지 않습니다.`,
            full: `${name}으로 전체를 바꿉니다.\n지금 카드·휴지통·선택태그상자·설정이 모두 이 백업 내용으로 바뀝니다.\n(바꾸기 전 지금 상태는 "복원 전 자동 백업"으로 서버에 남습니다)`
        }[mode];
        if (!confirm(msg)) return;
        if (mode === 'full' && !confirm('정말 전체를 바꿀까요? 이 백업 이후에 만든 카드는 사라집니다(복원 전 자동 백업에는 남음).')) return;
        await flushPending();
        const r = await call('POST', '/api/manual-backup/restore', { ...item.ref, mode });
        // 이 기기 설정도 백업 값으로(전체·설정 복원일 때)
        if (mode !== 'merge') {
            try {
                const b = await fetchBackup(item.ref);
                Object.entries(b.localSettings || {}).forEach(([k, v]) => { if (k.startsWith('wm_') && !LOCAL_EXCLUDE.includes(k)) localStorage.setItem(k, v); });
            } catch (_) { /* 기기 설정이 없는 백업 */ }
        }
        localStorage.removeItem('wm_sync_updated_at'); // 다시 열 때 서버 전체를 받도록
        alert(mode === 'merge' ? `카드 ${r.added}개를 되살렸습니다. 화면을 새로 불러옵니다.` : '복원했습니다. 화면을 새로 불러옵니다.');
        // window.wmReloadPage: 테스트에서 새로고침 대신 다른 동작을 넣을 수 있게
        if (typeof window.wmReloadPage === 'function') window.wmReloadPage(); else location.reload();
    }

    function render(box) {
        if (box.dataset.ready) return;
        box.dataset.ready = '1';
        box.innerHTML = `
            <div class="tt-settings-section">
                <div class="tt-settings-label">새 백업 만들기 <small>서버에 보관 · 최근 30개</small></div>
                <input type="text" class="w95-in bk-label" maxlength="40" placeholder="메모(선택) 예: 11월 정리 전" autocomplete="off">
                <div class="ws-btn-row">
                    <button type="button" class="w95-btn bk-make" data-bk="make:full"><i class="fa-solid fa-database"></i> 전체 백업</button>
                    <button type="button" class="w95-btn bk-make" data-bk="make:settings"><i class="fa-solid fa-sliders"></i> 설정 백업</button>
                </div>
                <div class="ws-desc"><b>전체</b>: 작업일지(카드)·휴지통·선택태그상자·화면 설정·이 기기 설정 전부<br><b>설정</b>: 선택태그상자·화면 설정·이 기기 설정 (카드 제외)<br>사진 파일은 서버 사진 저장소에 따로 있어 백업에는 주소만 들어갑니다.</div>
            </div>
            <div class="tt-settings-section">
                <div class="tt-settings-label">서버에 있는 백업</div>
                <button type="button" class="w95-btn ws-wide-btn" data-bk="refresh">목록 불러오기</button>
                <div class="bk-list"></div>
            </div>
            <div class="tt-settings-section">
                <div class="tt-settings-label">백업 파일 열어보기</div>
                <div class="ws-desc">받아 둔 백업 파일(.json)의 내용을 볼 수 있고, 서버에 백업으로 올릴 수 있습니다. (ZIP 백업은 위의 "백업 복원"으로)</div>
                <button type="button" class="w95-btn ws-wide-btn" data-bk="openFile">백업 파일 고르기</button>
                <input type="file" class="bk-file" accept=".json,.txt,application/json,text/plain" hidden>
            </div>`;
        box.addEventListener('click', async e => {
            const act = e.target.closest('[data-bk]')?.dataset.bk;
            if (!act) return;
            const itemEl = e.target.closest('.bk-item');
            const item = itemEl ? box.querySelector('.bk-list')._items?.[Number(itemEl.dataset.i)] : null;
            const btn = e.target.closest('button');
            try {
                if (act.startsWith('make:')) {
                    const kind = act.slice(5);
                    btn.disabled = true;
                    await flushPending();
                    const r = await call('POST', '/api/manual-backup', { kind, label: box.querySelector('.bk-label').value.trim(), localSettings: window.getLocalSettingsSnapshot() });
                    box.querySelector('.bk-label').value = '';
                    toast(`${kind === 'settings' ? '설정' : '전체'} 백업을 서버에 만들었습니다${r.backup?.logs != null ? ` (카드 ${r.backup.logs}개)` : ''}`);
                    await refreshList(box);
                } else if (act === 'refresh') await refreshList(box);
                else if (act === 'openFile') box.querySelector('.bk-file').click();
                else if (act === 'view') openViewer(await fetchBackup(item.ref));
                else if (act === 'file') download(await fetchBackup(item.ref));
                else if (act === 'restoreMenu') { const m = itemEl.querySelector('.bk-restore'); m.hidden = !m.hidden; }
                else if (act.startsWith('restore:')) await restore(item, act.slice(8));
                else if (act === 'delete') {
                    if (!confirm(`"${item.label || '백업'}" (${fmt(item.createdAt)}) 백업을 서버에서 지웁니다.`)) return;
                    await call('POST', '/api/manual-backup/delete', { id: item.ref.id });
                    await refreshList(box);
                }
            } catch (err) {
                alert(errText(err));
            } finally {
                if (btn) btn.disabled = false;
            }
        });
        box.querySelector('.bk-file').addEventListener('change', async e => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            try {
                const obj = JSON.parse((await file.text()).replace(/^﻿/, ''));
                const backup = normalizeFile(obj, file.name);
                if (!backup) return alert('이 파일에서 백업 내용을 찾지 못했습니다.');
                openViewer(backup, { fromFile: true });
            } catch (err) {
                alert(`파일을 읽지 못했습니다: ${err?.message || err}`);
            }
        });
    }

    window.setupBackupBox = () => {
        const box = document.getElementById('wmBackupBox');
        if (box) render(box);
    };
})();
