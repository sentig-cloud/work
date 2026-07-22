// work_render.js (v2 - groups 통합)

window.renderMain = () => {
    const grid = document.getElementById('mainGrid');
    if (!grid) return;
    grid.innerHTML = "";

    let yWork = 0, yOt = 0, yDuty = 0;
    let yStatuses = {};

    if (!window.logs) window.logs = [];

    for (let i = 1; i <= 12; i++) {
        let mLogs = window.logs.filter(l => l && l.m === i);
        let mWork = mLogs.filter(l => l.cat === 'work').length;

        let mStatuses = {};
        mLogs.filter(l => l.cat === 'work').forEach(l => {
            if (!window.isLogGroupExcluded(l, 'statuses') && l.status) {
                mStatuses[l.status] = (mStatuses[l.status] || 0) + 1;
                yStatuses[l.status] = (yStatuses[l.status] || 0) + 1;
            }
        });

        // OT는 이제 시간이 아니라 갯수 — 그냥 개수를 더한다(옛 시간 데이터인 log.ot는 집계에서 제외)
        let mOt = mLogs.reduce((s, c) => s + (Number(c.otCount) || 0), 0);

        let mDuty = new Set(mLogs.filter(l => l.isDutyLog || l.cat === 'duty' || l.isDuty).map(l => l.d)).size;

        yWork += mWork; yOt += mOt; yDuty += mDuty;

        let mStatusStr = Object.entries(mStatuses).filter(e => e[1] > 0).map(e => `${e[0]}:${e[1]}`).join(', ');

        grid.innerHTML += `
            <div class="month-card" onclick="window.openPop(${i})">
                <b style="font-size:1.15rem;">${i}월<span style="font-size:0.85rem; color:var(--w-blue); margin-left:4px;">(${mWork}건)</span></b>
                ${mStatusStr ? `<div class="m-stat" style="color:#0f766e; font-weight:bold; letter-spacing:0; margin-top:2px;">${mStatusStr}</div>` : ''}
                <div class="m-stat" style="margin-top:4px;">🕒 OT ${mOt}회 | 🎖️ ${mDuty}일</div>
            </div>`;
    }

    let yStatusStr = Object.entries(yStatuses).filter(e => e[1] > 0).map(e => `${e[0]}:${e[1]}`).join(', ');

    document.getElementById('yearlySummary').innerHTML = `
        [ ${window.currentYear}년 전체 누적 ] 📋 ${yWork}건 | 🕒 OT ${yOt}회 | 🎖️ ${yDuty}일
        ${yStatusStr ? `<br><span style="color:#0f766e;">상태: ${yStatusStr}</span>` : ''}
    `;

    window.updateDashboardStats();
};

window.updateDashboardStats = () => {
    const dashboardStats = document.getElementById('dashboardStats');
    if (!dashboardStats) return;

    let cwCounts = {}, ttCounts = {}, stCounts = {};

    window.logs.forEach(l => {
        if (l.cat === 'work') {
            if (!window.isLogGroupExcluded(l, 'taskTypes') && l.taskType) l.taskType.split(', ').forEach(t => { ttCounts[t] = (ttCounts[t] || 0) + 1; });
            if (!window.isLogGroupExcluded(l, 'coworkers') && l.coworkers) l.coworkers.forEach(cw => { cwCounts[cw] = (cwCounts[cw] || 0) + 1; });
            if (!window.isLogGroupExcluded(l, 'statuses') && l.status) stCounts[l.status] = (stCounts[l.status] || 0) + 1;
        }
    });

    let topCwHtml = Object.entries(cwCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(e => `<span class="dashboard-tag">${e[0]}(${e[1]})</span>`).join(' ');
    let topTtHtml = Object.entries(ttCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(e => `<span class="dashboard-tag">${e[0]}(${e[1]})</span>`).join(' ');

    let stHtml = Object.entries(stCounts).sort((a, b) => b[1] - a[1]).map(e => {
        let bg = "#dbeafe", border = "#93c5fd", text = "#1e40af";
        if (e[0] === '취소') { bg = "#fef2f2"; border = "#fca5a5"; text = "#b91c1c"; }
        else if (e[0] === '보류') { bg = "#fff7ed"; border = "#fdba74"; text = "#c2410c"; }
        else if (e[0] === '일정변경') { bg = "#faf5ff"; border = "#d8b4fe"; text = "#7e22ce"; }
        else if (e[0] === '완료') { bg = "#f0fdf4"; border = "#6ee7b7"; text = "#047857"; }
        else if (e[0] === '불필요') { bg = "#f4f4f5"; border = "#000000"; text = "#000000"; }
        else if (e[0] === '공사') { bg = "#fefce8"; border = "#eab308"; text = "#ca8a04"; }
        else if (e[0] === '이관') { bg = "#eff6ff"; border = "#3b82f6"; text = "#1d4ed8"; }
        return `<span class="dashboard-tag" style="background:${bg}; border-color:${border}; color:${text};">${e[0]}: ${e[1]}</span>`;
    }).join(' ');

    dashboardStats.innerHTML = `
        <div style="margin-bottom:6px; display:flex; flex-wrap:wrap; gap:4px; align-items:center;">
            <b style="color:#0f766e; margin-right:4px;">[상태]</b> ${stHtml || '<span style="color:#888; font-size:0.75rem;">기록 없음</span>'}
        </div>
        <div style="margin-bottom:6px; display:flex; flex-wrap:wrap; gap:4px; align-items:center;">
            <b style="color:var(--w-blue); margin-right:4px;">[작업]</b> ${topTtHtml || '<span style="color:#888; font-size:0.75rem;">기록 없음</span>'}
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:4px; align-items:center;">
            <b style="color:var(--w-black); margin-right:4px;">[매니저]</b> ${topCwHtml || '<span style="color:#888; font-size:0.75rem;">기록 없음</span>'}
        </div>
    `;
};

window.renderCal = (year, month) => {
    const body = document.getElementById('calBody');
    body.innerHTML = "";
    let first = new Date(year, month, 1).getDay();
    let last = new Date(year, month + 1, 0).getDate();
    let html = "<tr>";

    for (let i = 0; i < first; i++) html += "<td></td>";

    for (let d = 1; d <= last; d++) {
        let ds = `${year}${String(month + 1).padStart(2, '0')}${String(d).padStart(2, '0')}`;
        let dayLogs = window.logs.filter(l => l && l.y === year && l.m === month + 1 && l.d === d);
        let dayOfWeek = new Date(year, month, d).getDay();

        let isHoliday = window.holidays[ds] || dayOfWeek === 0;
        let isSaturday = dayOfWeek === 6;
        let numColor = isHoliday ? "var(--sun)" : (isSaturday ? "var(--sat)" : "var(--w-black)");

        let workCount = dayLogs.filter(l => l.cat === 'work').length;
        // 출·퇴근 한 쌍에서 자동 생성되는 상세 메모는 기록/내보내기에는 남기되
        // 달력의 일반 일정 건수에는 포함하지 않는다.
        let otherCount = dayLogs.filter(l =>
            l.cat !== 'work' && l.cat !== 'commute_in' && l.cat !== 'commute_out' &&
            !String(l.id || '').startsWith('calc_commute_')
        ).length;

        let hasDuty = dayLogs.some(l => l.isDutyLog || l.cat === 'duty' || l.isDuty);
        let hasOT = dayLogs.some(l => Number(l.otCount) > 0);
        let dayStyle = `color:${numColor}; font-weight:bold; font-size:1rem; flex-shrink:0;`;
        // 당직=빨간 밑줄, OT=파란 밑줄 — 하루에 둘 다 있으면 기존에 있던 당직 표시를 우선한다
        if (hasDuty) {
            dayStyle += ` text-decoration: underline; text-decoration-color: red; text-decoration-thickness: 3px; text-underline-offset: 3px;`;
        } else if (hasOT) {
            dayStyle += ` text-decoration: underline; text-decoration-color: var(--w-blue); text-decoration-thickness: 3px; text-underline-offset: 3px;`;
        }

        let countBadge = '';
        if (workCount > 0) {
            countBadge = `<div class="work-count-badge">${workCount}건</div>`;
        } else if (otherCount > 0) {
            countBadge = `<div class="work-count-badge" style="background:var(--w-dark-gray);">${otherCount}건</div>`;
        }

        let holName = window.holidays[ds] ? `<div class="hol-name">${window.holidays[ds]}</div>` : '';

        let hasIn = dayLogs.some(l => l.cat === 'commute_in' && l.inTime);
        let hasOut = dayLogs.some(l => l.cat === 'commute_out' && l.outTime);
        let greenDotHtml = (hasIn && hasOut) ? `<div style="width:6px; height:6px; background-color:#10b981; border-radius:50%; box-shadow:0 1px 2px rgba(0,0,0,0.3);"></div>` : '';

        html += `<td onclick="window.setCurDay(${d})" style="${d === window.curDay ? 'background:#eff6ff;border:2px solid #000; box-shadow: inset 1px 1px #fff;' : ''}">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; padding:2px; gap:2px;">
                <span style="${dayStyle}">${d}</span>
                ${holName}
            </div>
            <div style="display:flex; align-items:center; justify-content:center; gap:4px; min-height:18px; margin-top:2px;">
                ${greenDotHtml}
                ${countBadge}
            </div>
        </td>`;
        if ((d + first) % 7 === 0) html += "</tr><tr>";
    }
    body.innerHTML = html + "</tr>";
    window.updateUI();
};

window.updateUI = () => {
    const list = document.getElementById('logList');
    const dayLogs = window.logs.filter(l =>
        l &&
        l.y === window.currentYear &&
        l.m === window.curMonth &&
        l.d === window.curDay
    ).sort((a, b) => {
        let ta = a.workTime || a.time || '';
        let tb = b.workTime || b.time || '';
        return ta.localeCompare(tb);
    });

    let workIndex = 1;
    list.innerHTML = dayLogs.map(l => window.getLogCardHtml(l, l.cat === 'work' ? workIndex++ : '')).join('');

    let mLogs = window.logs.filter(l => l && l.y === window.currentYear && l.m === window.curMonth);
    let sumWorkEl = document.getElementById('popSumWork');
    const monthWorkLogs = mLogs.filter(l => l.cat === 'work');
    if (sumWorkEl) sumWorkEl.innerText = monthWorkLogs.length;
    const completedWorkEl = document.getElementById('popCompletedWork');
    if (completedWorkEl) completedWorkEl.innerText = monthWorkLogs.filter(l => !window.isLogGroupExcluded(l, 'statuses') && l.status === '완료').length;

    let commuteOtEl = document.getElementById('popCommuteOt');
    if (commuteOtEl) {
        const commuteOtMin = mLogs.reduce((sum, log) => {
            if (!log || (log.cat !== 'commute_in' && log.cat !== 'commute_out')) return sum;
            if (log.inException || log.outException) return sum;
            return sum + (Number(log.overtimeMin) || 0);
        }, 0);
        commuteOtEl.innerText = `출퇴근 초과 ${Math.floor(commuteOtMin / 60)}시 ${commuteOtMin % 60}분`;
    }
};

window.getWorkCardSectionOrder = (availableKeys = []) => {
    let saved = [];
    try { saved = JSON.parse(localStorage.getItem('wm_work_card_section_order') || '[]'); } catch (_) { saved = []; }
    if (!Array.isArray(saved)) saved = [];
    return [...saved.filter(key => availableKeys.includes(key)), ...availableKeys.filter(key => !saved.includes(key))];
};
window.getWorkCardWidgetSettings = () => {
    try { return JSON.parse(localStorage.getItem('wm_work_card_widget_settings') || '{}'); } catch (_) { return {}; }
};

window.getLogCardHtml = (l, indexStr = '') => {
    const excludedCardStyle = (groupId) => window.isLogGroupExcluded?.(l, groupId)
        ? 'color:#dc2626 !important; text-decoration:line-through; text-decoration-color:#dc2626; text-decoration-thickness:2px;'
        : '';
    let statusClass = '';
    if (l.status === '완료') statusClass = 'status-completed';
    else if (l.status === '취소') statusClass = 'status-canceled';
    else if (l.status === '보류') statusClass = 'status-pending';
    else if (l.status === '일정변경') statusClass = 'status-rescheduled';
    else if (l.status === '불필요') statusClass = 'status-unnecessary';
    else if (l.status === '공사') statusClass = 'status-construction';
    else if (l.status === '이관') statusClass = 'status-transfer';

    let cardClass = `card-${l.cat} ${statusClass}`;
    let cardStyle = '';
    let displayMemo = l.memo;

    let isCommuteDetailCard = l.cat === 'memo' && l.memo && l.memo.includes('[출/퇴 상세내역]');
    let isCommuteCard = l.cat === 'commute_in' || l.cat === 'commute_out';
    let isMemoOrPhoto = l.cat === 'memo' || l.cat === 'photo';

    if (isCommuteDetailCard) {
        cardStyle = 'background: linear-gradient(135deg, #fef08a 0%, #fde047 100%); border: 2px solid #eab308; box-shadow: 0 4px 6px rgba(0,0,0,0.15); margin: 12px 0; z-index: 10; position: relative;';
        let safeMemo = l.memo.replace(/<br\s*\/?>/gi, '\n');
        safeMemo = safeMemo.replace(/<span[^>]*>/gi, '').replace(/<\/span>/gi, '');
        let parts = safeMemo.split('\n').map(p => p.trim()).filter(p => p !== '');
        displayMemo = `<div style="display:flex; flex-direction:column; gap:6px;"><div style="font-size:1.1rem; font-weight:900; color:#854d0e;"><i class="fa-solid fa-bolt" style="color:#ca8a04;"></i> 출/퇴 상세내역</div>${parts.slice(1).map(p => {
            let innerText = p;
            if (innerText.includes('(+')) innerText = innerText.replace(/\(\+([0-9:]+)\)/g, "<span style='color:#dc2626; font-weight:900;'>(+$1)</span>");
            if (innerText.includes('[예외]')) innerText = innerText.replace(/\[예외\]/g, "<span style='color:#dc2626; font-weight:900;'>[예외]</span>");
            if (innerText.includes('당직')) innerText = innerText.replace(/-\s*당직/g, "- <span style='color:#dc2626; font-weight:900;'>당직</span>");
            if (innerText.includes('합산 초과:')) innerText = innerText.replace(/합산 초과:\s*([0-9:]+)/g, "합산 초과: <span style='color:#dc2626; font-weight:900;'>$1</span>");
            return `<div style="background:rgba(255,255,255,0.85); padding:6px 10px; border-radius:6px; font-weight:bold; color:#1f2937; font-size:0.95rem; border: 1px solid #fde047;">${innerText}</div>`;
        }).join('')}</div>`;
    } else if (isCommuteCard) {
        cardStyle = 'background: #fdf2f8 !important; border: 2px solid #db2777 !important; box-shadow: inset 1px 1px #fbcfe8 !important; padding: 0;';
    }

    let oxWatermark = '';
    if (l.personalCheck === 'O' || l.personalCheck === 'X') {
        let markColor = l.personalCheck === 'O' ? '#10b981' : '#ef4444';
        oxWatermark = `<div style="position: absolute; bottom: 12px; right: 20px; font-size: 5.5rem; color: ${markColor}; font-weight: 900; opacity: 0.15; pointer-events: none; user-select: none; z-index: 20; transform: rotate(-15deg);">${l.personalCheck}</div>`;
    }

    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const logDate = new Date(l.y || window.currentYear, l.m - 1, l.d);
    const dayStr = days[logDate.getDay()];
    const headerDateStr = `${l.y}.${String(l.m).padStart(2, '0')}.${String(l.d).padStart(2, '0')} (${dayStr})`;

    let seqHtml = '';
    let workDetailsHtml = '';
    let imgsHtml = l.imgs && l.imgs.length > 0 && l.cat !== 'commute_in' && l.cat !== 'commute_out'
        ? `<div class="log-img-list" style="padding: 0 10px 10px 10px;">${l.imgs.map((i, imgIdx) => `<img src="${i.src}" onclick="event.stopPropagation(); window.openImageViewer(${imgIdx}, 'log', '${l.id}')">`).join('')}</div>`
        : '';

    let bottomManagerHtml = '';

    let taskNoHtml = l.taskNo
        ? `<div class="task-no-btn" onclick="event.stopPropagation(); window.toggleLogOx('${l.id}')">${l.taskNo}</div>`
        : `<div class="task-no-btn" onclick="event.stopPropagation(); window.toggleLogOx('${l.id}')">O/X</div>`;

    if (isCommuteDetailCard || isCommuteCard || isMemoOrPhoto) taskNoHtml = '';

    if (l.cat === 'work') {
        const formatWorkQtyNames = (names, groupId) => (names || []).map(name => {
            const qty = Number(l.tagQuantities?.[groupId]?.[name] || 1);
            return qty > 1 ? `${name} × ${qty}` : name;
        }).join(', ');
        seqHtml = '';
        taskNoHtml = '';
        const dutyBadge = l.isDuty ? `<span class="work-alert-badge">당직</span>` : '';
        const otBadge = Number(l.otCount) > 0 ? `<span class="work-alert-badge">OT${Number(l.otCount) > 1 ? ` ${Number(l.otCount)}` : ''}</span>` : '';
        const statusStickerClass = ({
            '완료': 'sticker-completed', '취소': 'sticker-canceled', '보류': 'sticker-pending',
            '일정변경': 'sticker-rescheduled', '불필요': 'sticker-unnecessary',
            '공사': 'sticker-construction', '이관': 'sticker-transfer'
        })[l.status] || 'sticker-default';
        const statusBadge = l.status
            ? `<span class="work-status-sticker ${statusStickerClass}" style="${excludedCardStyle('statuses')}">${l.status}</span>`
            : `<span class="work-status-sticker is-empty">상태 없음</span>`;
        const inlineTaskNo = l.taskNo
            ? `<button type="button" class="task-no-btn work-task-no" onclick="event.stopPropagation(); window.toggleLogOx('${l.id}')">${l.taskNo}</button>`
            : `<button type="button" class="task-no-btn work-task-no" onclick="event.stopPropagation(); window.toggleLogOx('${l.id}')">O/X</button>`;

        let customerDetails = [];
        let workDetails = [];
        let customDetails = [];
        const getFreeWidgetLayout = (setting, defaultCols = 4) => {
            const legacyCols = Math.max(1, Math.min(4, Number(setting.cols || defaultCols)));
            const legacyWidth = legacyCols >= 4 ? 6 : legacyCols === 2 ? 3 : 2;
            const fineGrid = Number(setting.grid) === 12;
            const w = Math.max(1, Math.min(12, fineGrid ? Number(setting.w || legacyWidth * 2) : Number(setting.w || legacyWidth) * 2));
            const h = Math.max(1, Math.min(8, fineGrid ? Number(setting.h || 2) : Number(setting.h || (setting.height === 'two' ? 2 : 1)) * 2));
            const hasPosition = Number(setting.x) > 0 && Number(setting.y) > 0;
            const rawX = fineGrid ? Number(setting.x || 1) : ((Number(setting.x || 1) - 1) * 2 + 1);
            const rawY = fineGrid ? Number(setting.y || 1) : ((Number(setting.y || 1) - 1) * 2 + 1);
            const x = Math.max(1, Math.min(13 - w, rawX));
            const y = Math.max(1, rawY);
            return { w, h, x, y, hasPosition };
        };
        const freeWidgetStyle = (setting, defaultCols = 4) => {
            const layout = getFreeWidgetLayout(setting, defaultCols);
            const color = /^#[0-9a-f]{6}$/i.test(setting.color || '') ? setting.color : '';
            const placement = layout.hasPosition
                ? `grid-column:${layout.x} / span ${layout.w};grid-row:${layout.y} / span ${layout.h};`
                : `grid-column:span ${layout.w};grid-row:span ${layout.h};`;
            return `${placement}${color ? `--widget-text-color:${color};` : ''}`;
        };
        const makeCardObject = (key, label, inner, defaultCols = 4) => {
            const setting = window.getWorkCardWidgetSettings()[`object:${key}`] || {};
            const layout = getFreeWidgetLayout(setting, defaultCols);
            const titlePosition = setting.titlePosition === 'inline' ? 'inline' : 'top';
            const title = setting.titleVisible ? `<b class="work-card-object-title">${label}${titlePosition === 'inline' ? ' : ' : ''}</b>` : '';
            const fontSize = ['small','normal','large','xlarge'].includes(setting.fontSize) ? setting.fontSize : 'normal';
            return `<div class="work-card-subwidget title-position-${titlePosition} widget-font-${fontSize}${setting.emphasis ? ' is-emphasis' : ''}${setting.statusMode ? ' is-status-mode' : ''}${setting.hidden ? ' is-widget-hidden' : ''}" data-widget-w="${layout.w}" data-widget-h="${layout.h}" data-card-section-key="object:${key}" data-card-section-label="${label}" style="${freeWidgetStyle(setting, defaultCols)}">${title}${inner}</div>`;
        };
        const sortCardObjects = items => {
            const order = window.getWorkCardSectionOrder(items.map(html => html.match(/data-card-section-key="([^"]+)"/)?.[1]).filter(Boolean));
            return [...items].sort((a,b) => order.indexOf(a.match(/data-card-section-key="([^"]+)"/)?.[1]) - order.indexOf(b.match(/data-card-section-key="([^"]+)"/)?.[1]));
        };
        workDetails.push(makeCardObject('number','번호',`<div class="work-card-number">No.${indexStr || '-'}</div>`,2));
        workDetails.push(makeCardObject('date','일자',`<div class="work-card-core-value work-card-core-date">${headerDateStr}</div>`,3));
        workDetails.push(makeCardObject('time','시간',`<div class="work-card-core-value work-card-core-time">${l.workTime || '00:00'}</div>`,2));
        workDetails.push(makeCardObject('status','상태',`<div class="work-card-status-only">${statusBadge}</div>`,2));
        workDetails.push(makeCardObject('taskNo','타스크번호',inlineTaskNo,2));
        if (dutyBadge || otBadge) workDetails.push(makeCardObject('alerts','OT·당직',`<div class="work-card-alerts">${dutyBadge}${otBadge}</div>`,2));
        workDetails.push(makeCardObject('delete','삭제',`<button type="button" class="btn-del work-card-delete-object w95-btn" onclick="event.stopPropagation(); window.deleteEntry('${l.id}')">X</button>`,1));
        workDetails.push(makeCardObject('taskType','작업유형',`<div class="work-info-line task-type" style="${excludedCardStyle('taskTypes')}"><i class="fa-solid fa-screwdriver-wrench"></i><span>${formatWorkQtyNames(String(l.taskType || '기본').split(', '), 'taskTypes')}</span></div>`,2));
        workDetails.push(makeCardObject('content','작업내용',`<div class="work-info-line work-content-line"><i class="fa-solid fa-clipboard"></i><span>${l.content || '내용 없음'}</span></div>`));
        if (l.note) workDetails.push(makeCardObject('note','특이사항',`<div class="work-info-line note"><i class="fa-solid fa-triangle-exclamation"></i><span>${l.note}</span></div>`));
        if (l.customerName) customerDetails.push(makeCardObject('customer','고객명',`<div class="work-info-line customer"><i class="fa-solid fa-user"></i><span>${l.customerName}</span></div>`,2));
        if (l.address) customerDetails.push(makeCardObject('address','주소',`<div class="work-info-line address"><i class="fa-solid fa-map-marker-alt"></i><span>${l.address}</span></div>`));
        if (l.equips) {
            let eqStr = Object.entries(l.equips).filter(e => e[1] > 0)
                .map(e => Number(e[1]) > 1 ? `${e[0]} ${e[1]}` : e[0]).join(', ');
            if (eqStr) customerDetails.push(makeCardObject('equipment','장비',`<div class="work-info-line equipment" style="${excludedCardStyle('equipments')}"><i class="fa-solid fa-box"></i><span>${eqStr}</span></div>`,2));
        }

        // 시작/종료/총시간 (특수 그룹 — 태그 목록이 아니라 log.startTime/endTime/totalMin에 직접 저장)
        if (l.startTime || l.endTime) {
            const totalStr = l.totalMin ? window.formatDurationMin(l.totalMin) : '--:--';
            workDetails.push(makeCardObject('duration','작업시간',`<div class="work-info-line duration"><i class="fa-solid fa-hourglass-half"></i><span>${l.startTime || '--:--'}~${l.endTime || '--:--'} (${totalStr})</span></div>`,2));
        }

        // 커스텀 그룹 값 카드에 표시
        const customGroups = window.getActiveGroups().filter(g =>
            !(window.BUILT_IN_GROUP_IDS || ['taskTypes', 'coworkers', 'statuses', 'equipments', 'memoTags', 'duration']).includes(g.id)
        );
        const customCardPalette = [
            ['#7c3aed','#f5f3ff'], ['#c2410c','#fff7ed'], ['#0369a1','#f0f9ff'],
            ['#047857','#ecfdf5'], ['#be123c','#fff1f2'], ['#a16207','#fefce8'],
            ['#4338ca','#eef2ff'], ['#0f766e','#f0fdfa']
        ];
        customGroups.forEach((g, groupIndex) => {
            const val = l.customGroups && l.customGroups[g.id];
            if (val && (Array.isArray(val) ? val.length > 0 : val)) {
                const quantities = l.tagQuantities && l.tagQuantities[g.id] || {};
                const valStr = Array.isArray(val) ? val.map(name => Number(quantities[name] || 1) > 1 ? `${name} × ${Number(quantities[name])}` : name).join(', ') : String(val);
                const safeGroupTitle = String(g.title || '선택태그').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                const palette = customCardPalette[groupIndex % customCardPalette.length];
                const customWidgetSetting = window.getWorkCardWidgetSettings()[`custom:${g.id}`] || {};
                const customTitleVisible = typeof customWidgetSetting.titleVisible === 'boolean' ? customWidgetSetting.titleVisible : !!g.cardTitleVisible;
                const customTitlePosition = customWidgetSetting.titlePosition === 'top' ? 'top' : 'inline';
                customDetails.push({
                    key: `custom:${g.id}`,
                    label: g.title || '선택태그',
                    html: `<aside class="work-custom-panel work-card-section title-position-${customTitlePosition}" style="--custom-accent:${palette[0]};--custom-bg:${palette[1]};" data-card-section-key="custom:${g.id}" data-card-section-label="${safeGroupTitle}">${customTitleVisible && customTitlePosition === 'top' ? `<b class="work-card-object-title">${safeGroupTitle}</b>` : ''}<div class="work-info-line custom" style="${excludedCardStyle(g.id)}"><i class="fa-solid fa-tag"></i><span>${customTitleVisible && customTitlePosition === 'inline' ? `<b>${safeGroupTitle}</b><span class="work-custom-title-separator"> : </span>` : ''}${valStr}</span></div></aside>`
                });
            }
        });

        if (l.coworkers && l.coworkers.length > 0) {
            workDetails.push(makeCardObject('manager','매니저',`<div class="work-info-line manager" style="${excludedCardStyle('coworkers')}"><i class="fa-solid fa-user-group"></i><span>${formatWorkQtyNames(l.coworkers, 'coworkers')}</span></div>`,3));
        }
        workDetails.push(makeCardObject('modified','수정시간',`<div class="log-time work-card-modified">${l.m}/${l.d}(${dayStr}) ${l.time || ''}</div>`,3));
        if (l.imgs && l.imgs.length > 0) {
            workDetails.push(makeCardObject('images','사진',`<div class="log-img-list work-card-images">${l.imgs.map((i, imgIdx) => `<img src="${i.src}" onclick="event.stopPropagation(); window.openImageViewer(${imgIdx}, 'log', '${l.id}')">`).join('')}</div>`));
            imgsHtml = '';
        }

        const allStandardObjects = [
            ...workDetails.map(html => ({ html, origin:'work' })),
            ...customerDetails.map(html => ({ html, origin:'customer' }))
        ];
        const objectContainer = item => {
            const key = item.html.match(/data-card-section-key="([^"]+)"/)?.[1];
            return window.getWorkCardWidgetSettings()[key]?.container || item.origin;
        };
        workDetails = allStandardObjects.filter(item => objectContainer(item) === 'work').map(item => item.html);
        customerDetails = allStandardObjects.filter(item => objectContainer(item) === 'customer').map(item => item.html);

        const cardSections = [
            { key: 'work', html: `<section class="work-main-panel work-card-section" data-card-section-key="work" data-card-section-label="작업정보">${sortCardObjects(workDetails).join('')}</section>` },
            { key: 'customer', html: `<aside class="work-customer-panel work-card-section" data-card-section-key="customer" data-card-section-label="고객정보">${customerDetails.length ? sortCardObjects(customerDetails).join('') : '<div class="work-info-empty">등록 정보 없음</div>'}</aside>` },
            ...customDetails
        ];
        const orderedCardSections = window.getWorkCardSectionOrder(cardSections.map(section => section.key))
            .map(key => cardSections.find(section => section.key === key)).filter(Boolean);

        workDetailsHtml = `
            <div class="card-content-zone work-card-layout">
                <div class="work-card-columns${customDetails.length ? ' has-custom-column' : ''}">${orderedCardSections.map(section => {
                    const setting = window.getWorkCardWidgetSettings()[section.key] || {};
                    const isContainer = section.key === 'work' || section.key === 'customer';
                    const layout = getFreeWidgetLayout(setting, 4);
                    const fontSize = ['small','normal','large','xlarge'].includes(setting.fontSize) ? setting.fontSize : 'normal';
                    return `<div class="work-card-widget widget-font-${fontSize}${isContainer ? ' is-container-widget' : ''}${setting.emphasis ? ' is-emphasis' : ''}${setting.statusMode ? ' is-status-mode' : ''}${setting.hidden ? ' is-widget-hidden' : ''}" data-widget-w="${layout.w}" data-widget-h="${layout.h}" data-card-section-key="${section.key}" data-card-section-label="${section.label || section.key}" style="${isContainer ? '' : freeWidgetStyle(setting, 4)}">${section.html}</div>`;
                }).join('')}</div>
            </div>
        `;
        bottomManagerHtml = '';
    } else if (l.cat === 'commute_in' || l.cat === 'commute_out') {
        let isOut = l.cat === 'commute_out';
        let imgH = l.imgs && l.imgs[0] ? `<img src="${l.imgs[0].src}" style="width:50px; height:50px; object-fit:cover; border-radius:4px; border:1px solid #999; margin-right:10px; cursor:zoom-in;" onclick="event.stopPropagation(); window.openImageViewer(0, 'log', '${l.id}')">` : '';
        let cTime = isOut ? l.outTime : l.inTime;
        let cColor = '#be185d';
        let cTitle = isOut ? '퇴근 기록' : '출근 기록';
        let cIcon = isOut ? 'fa-sign-out-alt' : 'fa-sign-in-alt';
        let otMin = l.overtimeMin || 0;
        let otStr = '';
        if (l.inException || l.outException) {
            otStr = '<span style="color:red; font-weight:bold; margin-left:8px;">[예외 적용됨]</span>';
        } else if (otMin > 0) {
            let h = String(Math.floor(otMin / 60)).padStart(2, '0');
            let m = String(otMin % 60).padStart(2, '0');
            otStr = `<span style="color:red; font-weight:bold; margin-left:8px;">(+${h}:${m})</span>`;
        }
        let commuteNoteHtml = l.commuteNote ? `<div style="background:#fce7f3; color:#9d174d; padding:6px 8px; border-radius:4px; font-size:0.85rem; font-weight:bold; margin-top:8px; border:1px solid #f9a8d4; width:100%; box-sizing:border-box;"><i class="fa-solid fa-triangle-exclamation"></i> ${l.commuteNote}</div>` : '';

        const sameDayCommutes = (window.logs || []).filter(log =>
            log && log.y === l.y && log.m === l.m && log.d === l.d &&
            (log.cat === 'commute_in' || log.cat === 'commute_out')
        );
        const inLog = sameDayCommutes.find(log => log.cat === 'commute_in');
        const outLog = sameDayCommutes.find(log => log.cat === 'commute_out');
        const currentKm = Number(l.km || 0);
        const driveKm = inLog && outLog ? Math.max(0, Number(outLog.km || 0) - Number(inLog.km || 0)) : 0;
        const monthDriveKm = (window.logs || []).reduce((sum, log) => {
            if (!log || log.cat !== 'commute_out' || log.y !== l.y || log.m !== l.m) return sum;
            const dayInLog = (window.logs || []).find(item =>
                item && item.cat === 'commute_in' && item.y === log.y && item.m === log.m && item.d === log.d
            );
            if (!dayInLog) return sum;
            return sum + Math.max(0, Number(log.km || 0) - Number(dayInLog.km || 0));
        }, 0);

        const kmSummaryHtml = currentKm ? `
            <div style="display:flex; flex-wrap:wrap; gap:4px; margin-top:6px; font-size:0.82rem; font-weight:bold;">
                <span style="background:#fff; border:1px solid #f9a8d4; color:#9d174d; padding:2px 6px;">현재 ${currentKm.toLocaleString()}km</span>
                <span style="background:#fff; border:1px solid #f9a8d4; color:#9d174d; padding:2px 6px;">당일 ${driveKm.toLocaleString()}km</span>
                <span style="background:#fff; border:1px solid #f9a8d4; color:#9d174d; padding:2px 6px;">총 ${monthDriveKm.toLocaleString()}km</span>
            </div>` : '';

        workDetailsHtml = `
            <div class="card-content-zone" style="display:flex; flex-direction:column; padding: 10px 12px;">
                <div style="display:flex; align-items:center;">
                    ${imgH}
                    <div style="flex:1;">
                        <div style="font-weight:bold; color:${cColor}; font-size:1rem; margin-bottom:4px;"><i class="fa-solid ${cIcon}"></i> ${cTitle}</div>
                        <div style="font-size:0.85rem; color:#475569;">시간: <b style="color:var(--w-blue);">${cTime || '-'}</b> ${otStr}</div>
                        ${kmSummaryHtml}
                    </div>
                </div>
                ${commuteNoteHtml}
            </div>`;
    } else {
        let editTagsHtml = l.tags && l.tags.length > 0
            ? `<div style="margin-top:6px; display:flex; gap:4px; flex-wrap:wrap;">${l.tags.map(t => `<span style="background:#e0e7ff; border:1px solid #818cf8; color:#3730a3; padding:2px 6px; border-radius:4px; font-size:0.75rem; font-weight:bold;"><i class="fa-solid fa-hashtag"></i> ${t}</span>`).join('')}</div>`
            : '';
        workDetailsHtml = `
            <div class="card-content-zone">
                <div class="log-content">${displayMemo}</div>
                ${editTagsHtml}
            </div>
        `;
    }

    let bottomTimeHtml = (isCommuteDetailCard || isCommuteCard || l.cat === 'work')
        ? ''
        : `<div class="log-time" style="padding:0;">${l.m}/${l.d}(${dayStr}) ${l.time || ''}</div>`;

    return `
    <div class="log-card w95-out ${cardClass}" data-log-id="${l.id}" data-log-cat="${l.cat}" style="${cardStyle}" onclick="window.handleCardClick('${l.id}', '${l.cat}')">
        ${oxWatermark}
        ${l.cat === 'work' ? '' : `<button type="button" class="btn-del w95-btn" onclick="event.stopPropagation(); window.deleteEntry('${l.id}')">X</button>`}
        ${taskNoHtml}
        ${seqHtml}
        ${workDetailsHtml}
        ${imgsHtml}
        ${(bottomManagerHtml || bottomTimeHtml) ? `
        <div style="display:flex; justify-content:space-between; align-items:flex-end; padding: 0 12px 10px 12px;">
            ${bottomManagerHtml}
            ${bottomTimeHtml}
        </div>` : ''}
    </div>`;
};

window.renderTrash = () => {
    const list = document.getElementById('trashList');
    if (!list) return;

    const escapeHtml = (value) => String(value ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

    const items = [...(window.trash || [])].filter(Boolean)
        .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));

    if (items.length === 0) {
        list.innerHTML = '<div style="padding:24px; text-align:center; color:#64748b; font-weight:bold;">휴지통이 비어 있습니다.</div>';
        return;
    }

    const categoryNames = { work: '작업일지', memo: '메모', photo: '사진', commute_in: '출근', commute_out: '퇴근' };

    list.innerHTML = items.map((log) => {
        const encodedId = encodeURIComponent(String(log.id));
        const title = categoryNames[log.cat] || log.cat || '기록';
        const summary = log.content || log.memo || log.commuteNote || log.address || '내용 없음';
        const thumbnail = log.imgs && log.imgs[0] && log.imgs[0].src
            ? `<img src="${escapeHtml(log.imgs[0].src)}" alt="" style="width:48px; height:48px; object-fit:cover; border:1px solid #94a3b8; flex-shrink:0;">`
            : '';

        return `
            <div class="w95-out" style="margin-bottom:8px; padding:8px; background:#fff;">
                <div style="display:flex; gap:8px; align-items:flex-start;">
                    ${thumbnail}
                    <div style="flex:1; min-width:0;">
                        <div style="font-weight:bold; color:var(--w-blue);">
                            ${escapeHtml(`${log.y || '-'}년 ${log.m || '-'}월 ${log.d || '-'}일 · ${title}`)}
                        </div>
                        <div style="margin-top:4px; color:#475569; font-size:0.85rem; white-space:pre-wrap; word-break:break-word;">
                            ${escapeHtml(summary)}
                        </div>
                    </div>
                </div>
                <div style="display:flex; gap:6px; margin-top:8px;">
                    <button type="button" class="w95-btn" style="flex:1; color:var(--w-blue); font-weight:bold;"
                        onclick="window.restoreLog(decodeURIComponent('${encodedId}'))">복원</button>
                    <button type="button" class="w95-btn" style="flex:1; color:#dc2626; font-weight:bold;"
                        onclick="window.deleteTrashPermanently(decodeURIComponent('${encodedId}'))">영구 삭제</button>
                </div>
            </div>`;
    }).join('');
};

// ─── 개별 그룹 렌더링 (v2 통합) ───

window.renderEquips = () => {
    const g = window.getGroupById('equipments');
    const equipments = g ? g.tags : [];
    let html = '';
    equipments.forEach((eq, idx) => {
        let count = window.activeEquips[eq.name] || 0;
        let activeCls = count > 0 ? 'active-btn' : '';
        let label = count > 0 ? `${eq.name} (${count})` : eq.name;
        html += `<button type="button" class="w95-btn ${activeCls}" onmousedown="window.startPress(event, 'equip', ${idx})" onmouseup="window.endPress(event, 'equip', ${idx})" onmouseleave="window.cancelPress()" ontouchstart="window.startPress(event, 'equip', ${idx})" ontouchend="window.endPress(event, 'equip', ${idx})" ontouchcancel="window.cancelPress()">${label}</button>`;
    });
    html += `<button type="button" class="w95-btn" onclick="window.addNewType('equip')"><b>+</b></button>`;
    const el = document.getElementById('equipArea');
    if (el) el.innerHTML = html;
};

window.renderTaskTypes = () => {
    const g = window.getGroupById('taskTypes');
    const taskTypes = g ? [...g.tags].sort((a, b) => b.count - a.count) : [];
    let html = taskTypes.map((t, idx) => {
        let activeCls = window.activeTaskTypes.includes(t.name) ? 'active-btn' : '';
        return `<button type="button" class="w95-btn ${activeCls}" onmousedown="window.startPress(event, 'task', ${idx})" onmouseup="window.endPress(event, 'task', ${idx})" onmouseleave="window.cancelPress()" ontouchstart="window.startPress(event, 'task', ${idx})" ontouchend="window.endPress(event, 'task', ${idx})" ontouchcancel="window.cancelPress()">[${t.count}] ${t.name}</button>`;
    }).join(' ');
    html += `<button type="button" class="w95-btn" onclick="window.addNewType('task')"><b>+</b></button>`;
    const el = document.getElementById('taskTypeArea');
    if (el) el.innerHTML = html;
};

window.renderCoworkers = () => {
    const g = window.getGroupById('coworkers');
    const coworkers = g ? [...g.tags].sort((a, b) => b.count - a.count) : [];
    let html = coworkers.map((c, idx) => {
        let activeCls = window.selectedCoworkers.includes(c.name) ? 'active-btn' : '';
        return `<button type="button" class="w95-btn ${activeCls}" onmousedown="window.startPress(event, 'coworker', ${idx})" onmouseup="window.endPress(event, 'coworker', ${idx})" onmouseleave="window.cancelPress()" ontouchstart="window.startPress(event, 'coworker', ${idx})" ontouchend="window.endPress(event, 'coworker', ${idx})" ontouchcancel="window.cancelPress()">[${c.count}] ${c.name}</button>`;
    }).join(' ');
    html += `<button type="button" class="w95-btn" onclick="window.addNewType('coworker')"><b>+</b></button>`;
    const el = document.getElementById('coworkerArea');
    if (el) el.innerHTML = html;
};

window.renderStatuses = () => {
    const g = window.getGroupById('statuses');
    const statuses = g ? [...g.tags].sort((a, b) => b.count - a.count) : [];
    let html = statuses.map((s, idx) => {
        let activeCls = window.activeStatus === s.name ? 'active-btn' : '';
        return `<button type="button" class="w95-btn ${activeCls}" onmousedown="window.startPress(event, 'status', ${idx})" onmouseup="window.endPress(event, 'status', ${idx})" onmouseleave="window.cancelPress()" ontouchstart="window.startPress(event, 'status', ${idx})" ontouchend="window.endPress(event, 'status', ${idx})" ontouchcancel="window.cancelPress()">${s.name}</button>`;
    }).join(' ');
    html += `<button type="button" class="w95-btn" onclick="window.addNewType('status')"><b>+</b></button>`;
    const el = document.getElementById('statusArea');
    if (el) el.innerHTML = html;
};

window.renderMemoTags = () => {
    const g = window.getGroupById('memoTags');
    const memoTags = g ? [...g.tags].sort((a, b) => b.count - a.count) : [];

    let html = memoTags.map((t, idx) => {
        let activeCls = window.activeEditTags.includes(t.name) ? 'active-btn' : '';
        return `<button type="button" class="w95-btn ${activeCls}" style="display:inline-flex; align-items:center; justify-content:center; gap:4px; touch-action:manipulation; height:30px; white-space:nowrap; max-width:100%; overflow:hidden; text-overflow:ellipsis;" onclick="window.toggleTagSelection('memoTag', '${t.name}')" oncontextmenu="event.preventDefault(); window.openTagEditBox('memoTag', ${idx});">${t.name}</button>`;
    }).join(' ');

    if (memoTags.length < 5) {
        html += `<button type="button" class="w95-btn" style="height:30px; width:36px; display:flex; align-items:center; justify-content:center; flex-shrink:0;" onclick="window.addNewType('memoTag')"><b>+</b></button>`;
    }

    const targetArea = document.getElementById('editTagArea');
    if (targetArea) targetArea.innerHTML = html;
};

// ─── 커스텀 그룹 렌더링 ───
window.renderCustomGroup = (groupId) => {
    const g = window.getGroupById(groupId);
    if (!g) return;
    const el = document.getElementById(`customGroupArea_${groupId}`);
    if (!el) return;

    const sel = window.activeCustomGroupSelections[groupId] || [];
    const tags = g.tags.sort((a, b) => {
        const bm = window.groupShowsNumber(groupId) ? window.getGroupTagMonthlyCount(groupId, b.name) : 0;
        const am = window.groupShowsNumber(groupId) ? window.getGroupTagMonthlyCount(groupId, a.name) : 0;
        return (bm || Number(b.count) || 0) - (am || Number(a.count) || 0);
    });
    const showNumber = window.groupShowsNumber(groupId);
    const showCount = window.groupShowsCount(groupId);

    let html = tags.map((t, idx) => {
        let activeCls = sel.includes(t.name) ? 'active-btn' : '';
        const safeName = window.escapeHtml ? window.escapeHtml(t.name) : String(t.name || '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        // 0은 표시하지 않는다(시인성 확보)
        const monthlyCount = window.getGroupTagMonthlyCount(groupId, t.name);
        const numberPrefix = (showNumber && monthlyCount > 0) ? `[${monthlyCount}] ` : '';
        const baseCount = Number(t.count) || 0;
        const countSuffix = (showCount && baseCount > 0) ? ` (${baseCount})` : '';
        return `<button type="button" class="w95-btn layout-tag-button ${activeCls}"
            onmousedown="window.startPress(event,'${groupId}',${idx})"
            onmouseup="window.endPress(event,'${groupId}',${idx})"
            onmouseleave="window.cancelPress()"
            ontouchstart="window.startPress(event,'${groupId}',${idx})"
            ontouchend="window.endPress(event,'${groupId}',${idx})"
            ontouchcancel="window.cancelPress()"
        >${numberPrefix}${safeName}${countSuffix}</button>`;
    }).join(' ');
    html += window.buildAddButtonHtml(groupId);
    el.innerHTML = html;
};

// ─── 작업일지 모달: 모든 그룹 렌더링 ───
window.renderAllWorkGroups = () => {
    window.renderTaskTypes();
    window.renderCoworkers();
    window.renderStatuses();
    window.renderEquips();

    window.renderWorkDuration && window.renderWorkDuration();

    // 커스텀 그룹
    const customGroups = window.getActiveGroups().filter(g =>
        !(window.BUILT_IN_GROUP_IDS || ['taskTypes', 'coworkers', 'statuses', 'equipments', 'memoTags', 'duration']).includes(g.id)
    );
    customGroups.forEach(g => window.renderCustomGroup(g.id));
};

// ─── 사진 렌더링 ───
window.renderTempImgs = () => {
    document.getElementById('previewArea').innerHTML = window.tempImgs.map((img, idx) => `
        <div style="position:relative; width:60px; height:60px; flex-shrink:0;">
            <img src="${img.src}" style="width:100%;height:100%;object-fit:cover;border-radius:8px; cursor:zoom-in;" onclick="window.openImageViewer(${idx}, 'temp')">
            <button type="button" onclick="window.removeTemp('${img.id}')" class="remove-btn" style="position:absolute; top:-6px; right:-6px; width:24px; height:24px; font-size:14px; background:white; border:1px solid #000; border-radius:50%; z-index:10;">×</button>
        </div>
    `).join('');
};

window.renderWorkPhotoGrid = () => {
    const grid = document.getElementById('workPhotoGrid');
    if (!grid) return;
    grid.innerHTML = window.workImgs.map((img, idx) => `
        <div class="photo-item">
            <img src="${img.src}" onclick="window.openImageViewer(${idx}, 'work')">
            <button type="button" class="remove-img-btn w95-btn" onclick="window.removeWorkPhoto(${idx})">X</button>
        </div>
    `).join('');
};

window.renderEditPhotoGrid = () => {
    const log = window.logs.find(l => l.id === window.editingLogId);
    if (!log || !log.imgs) { document.getElementById('editPhotoGrid').innerHTML = ''; return; }
    document.getElementById('editPhotoGrid').innerHTML = log.imgs.map((img, idx) => `
        <div class="photo-item">
            <img src="${img.src}" onclick="window.openImageViewer(${idx}, 'edit', '${window.editingLogId}')">
            <button type="button" class="remove-img-btn w95-btn" onclick="window.removePhotoFromEdit(${idx})">X</button>
        </div>
    `).join('');
};

// ─── 검색 필터 업데이트 (v2 groups 기반) ───
window.updateSearchFilters = (targetMonth = null) => {
    const filteredLogs = targetMonth ? window.logs.filter(l => l.m === targetMonth) : window.logs;
    const getCount = (type, name) => filteredLogs.filter(l => {
        const groupId = { task: 'taskTypes', manager: 'coworkers', status: 'statuses', equip: 'equipments', tag: 'memoTags' }[type];
        if (groupId && window.isLogGroupExcluded(l, groupId)) return false;
        if (type === 'task') return l.taskType && l.taskType.includes(name);
        if (type === 'manager') return l.coworkers && l.coworkers.includes(name);
        if (type === 'status') return l.status === name;
        if (type === 'equip') return l.equips && l.equips[name] !== undefined;
        if (type === 'tag') return l.tags && l.tags.includes(name);
        return false;
    }).length;

    const sType = document.getElementById('searchType');
    const curTypeVal = sType ? sType.value : '';
    if (sType) sType.innerHTML = '<option value="">[ 작업유형 ]</option>' + window.taskTypes.map(t => `<option value="${t.name}" ${t.name === curTypeVal ? 'selected' : ''}>[${getCount('task', t.name)}] ${t.name}</option>`).join('');

    const sManager = document.getElementById('searchManager');
    const curManagerVal = sManager ? sManager.value : '';
    if (sManager) sManager.innerHTML = '<option value="">[ 매니저 ]</option>' + window.coworkers.map(c => `<option value="${c.name}" ${c.name === curManagerVal ? 'selected' : ''}>[${getCount('manager', c.name)}] ${c.name}</option>`).join('');

    const sEquip = document.getElementById('searchEquip');
    const curEquipVal = sEquip ? sEquip.value : '';
    if (sEquip) sEquip.innerHTML = '<option value="">[ 장비 ]</option>' + window.equipments.map(e => `<option value="${e.name}" ${e.name === curEquipVal ? 'selected' : ''}>[${getCount('equip', e.name)}] ${e.name}</option>`).join('');

    const sStatus = document.getElementById('searchStatus');
    const curStatusVal = sStatus ? sStatus.value : '';
    if (sStatus) sStatus.innerHTML = '<option value="">[ 상태 ]</option>' + window.statuses.map(s => `<option value="${s.name}" ${s.name === curStatusVal ? 'selected' : ''}>[${getCount('status', s.name)}] ${s.name}</option>`).join('');

    const sTag = document.getElementById('searchMemoTag');
    const curTagVal = sTag ? sTag.value : '';
    if (sTag) sTag.innerHTML = '<option value="">[ 태그 ]</option>' + window.memoTags.map(t => `<option value="${t.name}" ${t.name === curTagVal ? 'selected' : ''}>[${getCount('tag', t.name)}] ${t.name}</option>`).join('');
};
