// work_text_import.js
// "글 넣기": 추출앱 등에서 받은 작업 글을 붙여넣어 작업일지를 일괄 등록한다.
//
// 받는 글 형식(대략):
//   [업무보조] 11/17 23:24 · 2건        ← 제목 줄(넣지 않음)
//   [1]                                  ← 건 구분
//   이름: 김태훈
//   주소: 경상남도 통영시 무전동 1034-3 로운빌딩 1층
//   가입번호: 530068007941              ← 실제로는 타스크 번호(12자리)
//   타스크 번호: (없음)
//   TLI 번호: TLI-261113-003857
// - 여러 글을 이어 붙여도 되고, [n] 없이 "이름:"이 다시 나오면 새 건으로 본다.
// - 이름→고객명, 주소→주소, 가입번호/타스크 번호→타스크 번호(먼저 나온 값), TLI 번호→작업내용 맨 앞.
// - 그 밖의 "항목: 값" 줄과 형식 밖 줄은 특이사항에 붙인다.
// - 추출앱 연동: 주소 뒤에 #import=<글을 encodeURIComponent 한 값> 을 붙여 열면 이 창이 그 글로 열린다.

(() => {
    const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const pad = n => String(n).padStart(2, '0');
    const toast = msg => window.showWorkNavigationToast ? window.showWorkNavigationToast(msg) : alert(msg);
    const opt = () => window.getCardToolsSettings?.() || {};

    // ─── 파싱 ───
    // 위에서부터 차례로 본다. 번호·주소·연락처를 먼저 걸러야 "가입자번호", "고객주소" 같은 것이 이름으로 가지 않는다.
    const KEY_MAP = [
        [/tli/, 'tli'],
        // 받는 글의 "가입번호"는 실제로 타스크 번호(12자리)다
        [/^(가입|타스크|task)(번호|no)?$/, 'taskNo'],
        [/주소/, 'address'],
        [/(연락처|전화|휴대폰|핸드폰|폰번호)/, 'phone'],
        [/(번호|no$|id$|코드)/, null],          // 그 밖의 번호류는 이름이 아니다(특이사항으로)
        [/^(작업내용|내용|메모)$/, 'content'],
        [/^(시간|방문시간|작업시간)$/, 'time'],
        // 이름 계열 단어가 들어 있으면 고객명: 이름·성명·성함·고객(명)·계약자·가입자·상호·명의자·신청자·수령인·사용자·업체명
        [/(이름|성명|성함|고객|계약자|가입자|상호|명의자?|신청자|신청인|수령인|사용자|업체명|대표자)/, 'name']
    ];
    const normLabel = label => String(label).replace(/[\s()[\]{}<>/·・,._\-*#]+/g, '').toLowerCase();
    const keyOf = label => {
        // 띄어쓰기·괄호·기호는 빼고 비교한다: "이름(가입자)" → "이름가입자", "고객 명" → "고객명"
        const hit = KEY_MAP.find(([re]) => re.test(normLabel(label)));
        return hit ? hit[1] : null;
    };
    // 콜론 없이 "이름 홍길동" / "상호 ○○상회" 처럼 온 줄
    const NO_COLON_LABEL = /^(이름|성명|성함|고객명?|계약자명?|가입자명?|상호명?|명의자|신청자|수령인|업체명|주소|가입번호|타스크\s*번호|TLI\s*번호|연락처)\s+(\S.*)$/i;
    const isEmptyValue = v => /^\(?\s*(없음|미정|해당없음|-|n\/a)?\s*\)?$/i.test(String(v).trim());

    window.parseWorkImportText = text => {
        const entries = [];
        let cur = null;
        const start = () => { cur = { name: '', address: '', taskNo: '', tli: '', phone: '', content: '', time: '', extra: [], nameLabels: [] }; entries.push(cur); };
        String(text || '').replace(/\r/g, '').split('\n').forEach(raw => {
            // 메신저에서 복사하면 섞여 오는 보이지 않는 문자는 지우고, 특수 공백·다른 모양의 콜론은 보통 것으로 바꾼다
            const line = raw
                .replace(/[\u200b-\u200f\u202a-\u202e\u2060-\u2064\ufeff\u00ad]/g, '')
                .replace(/[\u00a0\u2000-\u200a\u202f\u205f\u3000]/g, ' ')
                .replace(/[\u2236\ua789\ufe55\ufe13]/g, ':')
                .trim();
            if (!line) return;
            if (/^\[\s*\d+\s*\]$/.test(line) || /^\d+\s*[.)]$/.test(line) || /^[-=━─]{3,}$/.test(line)) { cur = null; return; }
            if (/^\[[^\]]*[^\d\s\]][^\]]*\]/.test(line)) { cur = null; return; } // [업무보조] … 제목 줄
            // 글머리표(- • · * ▶ ■ ○ 등)는 떼고 본다
            const body = line.replace(/^[-•·*▶▷►■□◆◇○●※]+\s*/, '');
            const m = body.match(/^([^:：]{1,15}?)\s*[:：]\s*(.*)$/) || body.match(NO_COLON_LABEL);
            if (!m) { if (cur) cur.extra.push(line); return; }
            const key = keyOf(m[1]);
            const value = isEmptyValue(m[2]) ? '' : m[2].trim();
            // [n] 없이 이어진 글: 같은 이름표(예: "이름")가 다시 나오면 새 건.
            // "상호"와 "이름"처럼 다른 이름표는 한 건 안에서 합친다(○○상회 홍길동).
            const label = normLabel(m[1]);
            if (!cur || (key === 'name' && cur.nameLabels.includes(label))) start();
            if (key === 'name') cur.nameLabels.push(label);
            if (key === 'taskNo') { if (!cur.taskNo) cur.taskNo = value; } // 가입번호·타스크 번호 중 먼저 나온 값
            else if (key) cur[key] = cur[key] ? `${cur[key]} ${value}`.trim() : value;
            else if (value) cur.extra.push(`${m[1].trim()}: ${value}`);
        });
        return entries.filter(e => e.name || e.address || e.tli || e.taskNo);
    };

    // ─── 작업일지로 바꾸기 ───
    function toLog(e, y, m, d, fallbackTime, id) {
        const tli = (e.tli || '').replace(/\s+/g, '');
        const contentParts = [tli, e.content].filter(Boolean);
        const noteParts = [e.phone ? `연락처 ${e.phone}` : '', ...e.extra].filter(Boolean);
        const time = /^\d{1,2}:\d{2}/.test(e.time) ? e.time.replace(/^(\d):/, '0$1:').slice(0, 5) : fallbackTime;
        const sameDayDuty = (window.logs || []).some(l => l && l.cat === 'work' && l.y === y && l.m === m && l.d === d && l.isDuty);
        return {
            id, y, m, d, cat: 'work',
            workTime: time || '',
            taskNo: (e.taskNo || '').replace(/\s+/g, ''),
            customerName: e.name,
            address: e.address,
            taskType: '',
            content: contentParts.join('\n'),
            note: noteParts.join('\n'),
            otCount: 0,
            status: null,
            personalCheck: null,
            coworkers: [],
            equips: {},
            imgs: [],
            time: window.getCurrentTimeString?.() || '',
            isDuty: sameDayDuty,
            startTime: null, endTime: null, totalMin: null,
            customGroups: {},
            tagQuantities: {},
            excludedGroups: [],
            importedFrom: 'text'
        };
    }

    // 같은 날짜에 이미 같은 작업이 있는지(타스크 번호·TLI 또는 고객명+주소)
    function findDuplicate(e, y, m, d) {
        const norm = v => String(v || '').replace(/\s+/g, '');
        return (window.logs || []).find(l => {
            if (!l || l.cat !== 'work' || l.y !== y || l.m !== m || l.d !== d) return false;
            const text = norm(`${l.content || ''} ${l.note || ''}`);
            if (e.taskNo && norm(l.taskNo) === norm(e.taskNo)) return true;
            if (e.tli && text.includes(norm(e.tli))) return true;
            return !!e.name && !!e.address && norm(l.customerName) === norm(e.name) && norm(l.address) === norm(e.address);
        });
    }

    // ─── 화면 ───
    let parsed = [];
    function ensureModal() {
        let modal = document.getElementById('textImportModal');
        if (modal) return modal;
        modal = document.createElement('div');
        modal.id = 'textImportModal';
        modal.className = 'modal-overlay';
        modal.style.zIndex = '2700';
        modal.innerHTML = `
            <div class="modal-box w95-window ti-box">
                <div class="w95-titlebar"><span><i class="fa-solid fa-file-lines"></i> 글 넣기 · 작업 일괄 등록</span><button type="button" class="w95-btn" data-act="close">X</button></div>
                <div class="ti-body">
                    <div class="ti-row">
                        <label class="ti-field"><span>넣을 날짜</span><input type="date" id="tiDate" class="w95-in"></label>
                        <label class="ti-field"><span>시간 <small>(비우면 없음)</small></span><input type="time" id="tiTime" class="w95-in"></label>
                    </div>
                    <div class="ti-paste-head">
                        <b>받은 글</b>
                        <button type="button" class="w95-btn" data-act="clip"><i class="fa-solid fa-paste"></i> 클립보드에서</button>
                        <button type="button" class="w95-btn" data-act="clear">지우기</button>
                    </div>
                    <textarea id="tiText" class="w95-in" spellcheck="false" placeholder="[업무보조] 11/17 · 2건&#10;&#10;[1]&#10;이름: 홍길동&#10;주소: 경남 통영시 ...&#10;가입번호(타스크): 5300...&#10;타스크 번호: (없음)&#10;TLI 번호: TLI-261113-003857&#10;&#10;여러 글을 이어 붙여도 됩니다."></textarea>
                    <div class="ti-list-head"><b id="tiCount">인식된 작업 0건</b><label><input type="checkbox" id="tiAll" checked> 전체 선택</label></div>
                    <div id="tiList" class="ti-list"></div>
                </div>
                <div class="modal-footer ti-footer">
                    <button type="button" class="w95-btn ti-go" data-act="save" id="tiSave">넣기</button>
                    <button type="button" class="w95-btn" data-act="close">취소</button>
                </div>
            </div>`;
        document.body.appendChild(modal);
        let timer = null;
        const text = modal.querySelector('#tiText');
        text.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(refresh, 200); });
        modal.querySelector('#tiDate').addEventListener('change', refresh);
        modal.querySelector('#tiAll').addEventListener('change', e => {
            modal.querySelectorAll('#tiList input[type="checkbox"]').forEach(c => { c.checked = e.target.checked; });
            updateSaveLabel();
        });
        modal.querySelector('#tiList').addEventListener('change', updateSaveLabel);
        modal.addEventListener('click', async e => {
            const act = e.target.closest('[data-act]')?.dataset.act;
            if (act === 'close') closeModal();
            else if (act === 'clear') { text.value = ''; refresh(); text.focus(); }
            else if (act === 'save') saveAll();
            else if (act === 'clip') {
                try {
                    const clip = await navigator.clipboard.readText();
                    if (!clip) return toast('클립보드가 비어 있습니다');
                    text.value = text.value.trim() ? `${text.value.trim()}\n\n${clip}` : clip;
                    refresh();
                } catch (_) { toast('클립보드를 읽을 수 없습니다. 칸을 길게 눌러 붙여넣어 주세요'); }
            }
        });
        return modal;
    }

    const selectedDate = () => {
        const v = document.getElementById('tiDate')?.value || '';
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
        return m ? { y: +m[1], m: +m[2], d: +m[3] } : null;
    };

    function refresh() {
        const modal = ensureModal();
        parsed = window.parseWorkImportText(modal.querySelector('#tiText').value);
        const date = selectedDate();
        const skipDup = opt().importSkipDup !== false;
        modal.querySelector('#tiCount').textContent = `인식된 작업 ${parsed.length}건`;
        modal.querySelector('#tiList').innerHTML = parsed.length ? parsed.map((e, i) => {
            const dup = date ? findDuplicate(e, date.y, date.m, date.d) : null;
            const lines = [
                e.address ? `<span class="ti-addr">${esc(e.address)}</span>` : '',
                [e.tli ? `<span class="ti-tli">${esc(e.tli)}</span>` : '', e.taskNo ? `타스크 ${esc(e.taskNo)}` : ''].filter(Boolean).join(' · '),
                e.extra.length ? `<span class="ti-extra">+ ${esc(e.extra.join(' / '))}</span>` : ''
            ].filter(Boolean).map(t => `<div>${t}</div>`).join('');
            return `<label class="ti-item${dup ? ' is-dup' : ''}"><input type="checkbox" data-idx="${i}" ${dup && skipDup ? '' : 'checked'}>
                <span class="ti-item-body"><b><em>${i + 1}</em>${esc(e.name || '(이름 없음)')}${dup ? '<i class="ti-dup">이미 있음</i>' : ''}</b>${lines}</span></label>`;
        }).join('') : '<div class="ti-empty">붙여넣은 글에서 작업을 찾지 못했습니다.<br>"이름:", "주소:" 같은 줄이 있는지 확인해 주세요.</div>';
        modal.querySelector('#tiAll').checked = true;
        updateSaveLabel();
    }

    function updateSaveLabel() {
        const n = document.querySelectorAll('#tiList input[type="checkbox"]:checked').length;
        const btn = document.getElementById('tiSave');
        if (btn) { btn.textContent = n ? `${n}건 넣기` : '넣기'; btn.disabled = !n; }
    }

    function saveAll() {
        const date = selectedDate();
        if (!date) return alert('넣을 날짜를 고르세요.');
        const picks = [...document.querySelectorAll('#tiList input[type="checkbox"]:checked')].map(c => parsed[Number(c.dataset.idx)]).filter(Boolean);
        if (!picks.length) return alert('넣을 작업을 선택하세요.');
        const time = document.getElementById('tiTime').value || '';
        const used = new Set((window.logs || []).map(l => String(l?.id)));
        let base = Date.now();
        picks.forEach(e => {
            while (used.has(String(base))) base++;
            const id = String(base); used.add(id);
            window.saveToLocalStore('logs', toLog(e, date.y, date.m, date.d, time, id));
        });
        closeModal();
        window.currentYear = date.y; window.curMonth = date.m; window.curDay = date.d;
        const label = document.getElementById('monthLabel');
        if (label) label.innerText = `${date.m}월`;
        const pop = document.getElementById('popupLayer');
        if (pop && getComputedStyle(pop).display !== 'none') window.renderCal?.(date.y, date.m - 1);
        else window.openPop?.(date.m);
        toast(`${date.m}/${date.d}에 ${picks.length}건 넣었습니다`);
    }

    function closeModal() {
        const modal = document.getElementById('textImportModal');
        if (modal) modal.style.display = 'none';
    }

    window.openTextImport = (initialText = '') => {
        const modal = ensureModal();
        const y = window.currentYear || new Date().getFullYear();
        const m = window.curMonth || new Date().getMonth() + 1;
        const d = window.curDay || new Date().getDate();
        modal.querySelector('#tiDate').value = `${y}-${pad(m)}-${pad(d)}`;
        modal.querySelector('#tiTime').value = '';
        const text = modal.querySelector('#tiText');
        text.value = initialText || '';
        modal.style.display = 'flex';
        refresh();
        if (!initialText) setTimeout(() => text.focus(), 50);
    };

    // ─── 추출앱 연동: #import=<글> 또는 ?import=<글> 로 열면 바로 글 넣기 창 ───
    function takeImportParam() {
        const read = src => { const m = /(?:^|[#?&])import=([^&]*)/.exec(src); return m ? m[1] : null; };
        const raw = read(location.hash) ?? read(location.search);
        if (raw === null) return null;
        let text = '';
        try { text = decodeURIComponent(raw.replace(/\+/g, ' ')); } catch (_) { text = raw; }
        history.replaceState(history.state, document.title, location.pathname); // 새로고침 때 다시 넣지 않도록
        return text;
    }
    const pending = takeImportParam();
    if (pending) {
        // 로그인 후 앱이 보일 때까지 기다렸다가 연다
        let tries = 0;
        const wait = setInterval(() => {
            const app = document.getElementById('app-container');
            if ((app && app.style.display !== 'none' && Array.isArray(window.logs)) || ++tries > 240) {
                clearInterval(wait);
                if (tries <= 240) window.openTextImport(pending);
            }
        }, 500);
    }
})();
