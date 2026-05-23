// work_render.js
window.renderMain = () => {
    const grid = document.getElementById('mainGrid');
    if(!grid) return;
    grid.innerHTML = "";
    
    let yWork = 0, yOt = 0, yDuty = 0;
    let yStatuses = {}; 

    for(let i=1; i<=12; i++) {
        let mLogs = window.logs.filter(l => l && l.m === i);
        let mWork = mLogs.filter(l => l.cat === 'work').length;
        
        let mStatuses = {}; 
        mLogs.filter(l => l.cat === 'work').forEach(l => {
            if(l.status) {
                mStatuses[l.status] = (mStatuses[l.status] || 0) + 1;
                yStatuses[l.status] = (yStatuses[l.status] || 0) + 1;
            }
        });

        let mOt = mLogs.reduce((s, c) => {
            if(!c.ot) return s;
            let parts = c.ot.split(':');
            if(parts.length === 2) return s + (parseInt(parts[0]||0)*60 + parseInt(parts[1]||0));
            return s;
        }, 0);
        
        let mDuty = new Set(mLogs.filter(l => l.isDutyLog || l.cat === 'duty' || l.isDuty).map(l => l.d)).size; 
        
        yWork += mWork; yOt += mOt; yDuty += mDuty;
        
        let mStatusStr = Object.entries(mStatuses).filter(e => e[1] > 0).map(e => `${e[0]}:${e[1]}`).join(', ');

        grid.innerHTML += `
            <div class="month-card" onclick="window.openPop(${i})">
                <b style="font-size:1.15rem;">${i}월<span style="font-size:0.85rem; color:var(--w-blue); margin-left:4px;">(${mWork}건)</span></b>
                ${mStatusStr ? `<div class="m-stat" style="color:#0f766e; font-weight:bold; letter-spacing:0; margin-top:2px;">${mStatusStr}</div>` : ''}
                <div class="m-stat" style="margin-top:4px;">🕒 ${Math.floor(mOt/60)}:${(mOt%60).toString().padStart(2,'0')} | 🎖️ ${mDuty}일</div>
            </div>`;
    }
    
    let yStatusStr = Object.entries(yStatuses).filter(e => e[1] > 0).map(e => `${e[0]}:${e[1]}`).join(', ');

    document.getElementById('yearlySummary').innerHTML = `
        [ ${window.currentYear}년 전체 누적 ] 📋 ${yWork}건 | 🕒 ${Math.floor(yOt/60)}:${(yOt%60).toString().padStart(2,'0')} | 🎖️ ${yDuty}일
        ${yStatusStr ? `<br><span style="color:#0f766e;">상태: ${yStatusStr}</span>` : ''}
    `;
    
    window.updateDashboardStats(); 
};

window.updateDashboardStats = () => {
    let cwCounts = {}; let ttCounts = {}; let stCounts = {}; 
    
    window.logs.forEach(l => {
        if (l.cat === 'work') { 
            if (l.taskType) l.taskType.split(', ').forEach(t => { ttCounts[t] = (ttCounts[t] || 0) + 1; });
            if (l.coworkers) l.coworkers.forEach(cw => { cwCounts[cw] = (cwCounts[cw] || 0) + 1; });
            if (l.status) stCounts[l.status] = (stCounts[l.status] || 0) + 1; 
        }
    });
    
    let topCwHtml = Object.entries(cwCounts).sort((a,b)=>b[1]-a[1]).slice(0,5).map(e => `<span class="dashboard-tag">${e[0]}(${e[1]})</span>`).join(' ');
    let topTtHtml = Object.entries(ttCounts).sort((a,b)=>b[1]-a[1]).slice(0,5).map(e => `<span class="dashboard-tag">${e[0]}(${e[1]})</span>`).join(' ');
    
    let stHtml = Object.entries(stCounts).sort((a,b)=>b[1]-a[1]).map(e => {
        let bg = "#dbeafe", border = "#93c5fd", text = "#1e40af"; 
        if(e[0]==='취소') { bg = "#fef2f2"; border = "#fca5a5"; text = "#b91c1c"; } 
        else if(e[0]==='보류') { bg = "#fff7ed"; border = "#fdba74"; text = "#c2410c"; } 
        else if(e[0]==='일정변경') { bg = "#faf5ff"; border = "#d8b4fe"; text = "#7e22ce"; } 
        else if(e[0]==='완료') { bg = "#f0fdf4"; border = "#6ee7b7"; text = "#047857"; } 
        else if(e[0]==='불필요') { bg = "#f4f4f5"; border = "#000000"; text = "#000000"; }
        else if(e[0]==='공사') { bg = "#fefce8"; border = "#eab308"; text = "#ca8a04"; }
        else if(e[0]==='이관') { bg = "#eff6ff"; border = "#3b82f6"; text = "#1d4ed8"; }
        return `<span class="dashboard-tag" style="background:${bg}; border-color:${border}; color:${text};">${e[0]}: ${e[1]}</span>`;
    }).join(' ');

    document.getElementById('dashboardStats').innerHTML = `
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
    const body = document.getElementById('calBody'); body.innerHTML = "";
    let first = new Date(year, month, 1).getDay(), last = new Date(year, month+1, 0).getDate(), html = "<tr>";
    
    for(let i=0; i<first; i++) html += "<td></td>";
    
    for(let d=1; d<=last; d++) {
        let ds = `${year}${String(month+1).padStart(2,'0')}${String(d).padStart(2,'0')}`;
        let dayLogs = window.logs.filter(l => l && l.m === window.curMonth && l.d === d);
        let dayOfWeek = new Date(year, month, d).getDay();
        
        let isHoliday = window.holidays[ds] || dayOfWeek === 0;
        let isSaturday = dayOfWeek === 6;
        let numColor = isHoliday ? "var(--sun)" : (isSaturday ? "var(--sat)" : "var(--w-black)");
        
        let workCount = dayLogs.filter(l => l.cat === 'work').length;
        let otherCount = dayLogs.filter(l => l.cat !== 'work' && l.cat !== 'commute_in' && l.cat !== 'commute_out').length;
        
        let hasDuty = dayLogs.some(l => l.isDutyLog || l.cat === 'duty' || l.isDuty);
        let dayStyle = `color:${numColor}; font-weight:bold; font-size:1rem; flex-shrink:0;`;
        if (hasDuty) {
            dayStyle += ` text-decoration: underline; text-decoration-color: red; text-decoration-thickness: 3px; text-underline-offset: 3px;`;
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

        html += `<td onclick="window.setCurDay(${d})" style="${d===window.curDay?'background:#eff6ff;border:2px solid #000; box-shadow: inset 1px 1px #fff;':''}">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; padding:2px; gap:2px;">
                <span style="${dayStyle}">${d}</span>
                ${holName}
            </div>
            <div style="display:flex; align-items:center; justify-content:center; gap:4px; min-height:18px; margin-top:2px;">
                ${greenDotHtml}
                ${countBadge}
            </div>
        </td>`;
        if((d+first)%7===0) html += "</tr><tr>";
    }
    body.innerHTML = html + "</tr>"; 
    window.updateUI();
};

window.updateUI = () => {
    const list = document.getElementById('logList');
    const dayLogs = window.logs.filter(l => l && l.m === window.curMonth && l.d === window.curDay).sort((a,b) => {
        let ta = a.workTime || a.time || ''; let tb = b.workTime || b.time || '';
        return ta.localeCompare(tb);
    });

    let workIndex = 1;
    list.innerHTML = dayLogs.map(l => window.getLogCardHtml(l, l.cat === 'work' ? workIndex++ : '')).join('');

    let mLogs = window.logs.filter(l => l && l.m === window.curMonth);
    let sumWorkEl = document.getElementById('popSumWork');
    if(sumWorkEl) sumWorkEl.innerText = mLogs.filter(l => l.cat === 'work').length; 
};

window.getLogCardHtml = (l, indexStr = '') => {
    let statusClass = '';
    if(l.status === '완료') statusClass = 'status-completed';
    else if(l.status === '취소') statusClass = 'status-canceled';
    else if(l.status === '보류') statusClass = 'status-pending';
    else if(l.status === '일정변경') statusClass = 'status-rescheduled';
    else if(l.status === '불필요') statusClass = 'status-unnecessary';
    else if(l.status === '공사') statusClass = 'status-construction';
    else if(l.status === '이관') statusClass = 'status-transfer';
    
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
            
            if (innerText.includes('(+')) {
                innerText = innerText.replace(/\(\+([0-9:]+)\)/g, "<span style='color:#dc2626; font-weight:900;'>(+$1)</span>");
            }
            if (innerText.includes('[예외]')) {
                innerText = innerText.replace(/\[예외\]/g, "<span style='color:#dc2626; font-weight:900;'>[예외]</span>");
            }
            if (innerText.includes('당직')) {
                innerText = innerText.replace(/-\s*당직/g, "- <span style='color:#dc2626; font-weight:900;'>당직</span>");
            }
            if (innerText.includes('합산 초과:')) {
                innerText = innerText.replace(/합산 초과:\s*([0-9:]+)/g, "합산 초과: <span style='color:#dc2626; font-weight:900;'>$1</span>");
            }
            
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

    const days = ['일','월','화','수','목','금','토'];
    const logDate = new Date(l.y || window.currentYear, l.m - 1, l.d);
    const dayStr = days[logDate.getDay()];
    const headerDateStr = `${l.y}.${String(l.m).padStart(2,'0')}.${String(l.d).padStart(2,'0')} (${dayStr})`;
    
    let seqHtml = '';
    let workDetailsHtml = '';
    // 🌟 일반 작업일지/메모의 이미지 처리
    let imgsHtml = l.imgs && l.imgs.length > 0 && l.cat !== 'commute_in' && l.cat !== 'commute_out' ? `<div class="log-img-list" style="padding: 0 10px 10px 10px;">${l.imgs.map((i, imgIdx) => `<img src="${i.src}" onclick="event.stopPropagation(); window.openImageViewer(${imgIdx}, 'log', '${l.id}')">`).join('')}</div>` : '';
    
    let bottomManagerHtml = '';
    
    let taskNoHtml = l.taskNo 
        ? `<div class="task-no-btn" onclick="event.stopPropagation(); window.toggleLogOx('${l.id}')">${l.taskNo}</div>` 
        : `<div class="task-no-btn" onclick="event.stopPropagation(); window.toggleLogOx('${l.id}')">O/X</div>`;

    if (isCommuteDetailCard || isCommuteCard || isMemoOrPhoto) {
        taskNoHtml = '';
    }

    if (l.cat === 'work') {
        seqHtml = indexStr ? `<div class="log-seq" style="padding: 8px 12px 0 12px; font-size:1.1rem; color:red; font-weight:bold;">No.${indexStr} <span style="font-size:0.9rem; color:var(--w-black); font-weight:900;">[${l.taskType||'기본'}]</span></div>` : '';
        
        let dutyBadge = l.isDuty ? `<span style="color:red; font-weight:bold; margin-right:4px;">[당직]</span>` : '';
        let statusBadge = l.status ? `<span style="background:var(--w-blue); color:white; padding:1px 4px; font-size:0.75rem; border-radius:2px; margin-right:4px;">${l.status}</span>` : '';

        let detailsHtml = [];
        if(l.address) detailsHtml.push(`<div style="color:#475569; font-size:0.85rem;"><i class="fa-solid fa-map-marker-alt" style="width:16px;"></i> ${l.address}</div>`);
        if(l.customerName) detailsHtml.push(`<div style="color:#6366f1; font-size:0.85rem; font-weight:bold;"><i class="fa-solid fa-user" style="width:16px;"></i> ${l.customerName}</div>`);
        if(l.equips) {
            let eqStr = Object.entries(l.equips).filter(e => e[1] > 0).map(e => `${e[0]} ${e[1]}`).join(', ');
            if(eqStr) detailsHtml.push(`<div style="color:#0f766e; font-size:0.85rem; font-weight:bold;"><i class="fa-solid fa-box" style="width:16px;"></i> ${eqStr}</div>`);
        }
        if(l.ot) detailsHtml.push(`<div style="color:#e11d48; font-size:0.85rem; font-weight:bold;"><i class="fa-solid fa-clock" style="width:16px;"></i> OT ${l.ot}</div>`);
        if(l.note) detailsHtml.push(`<div style="color:#d97706; font-size:0.85rem;"><i class="fa-solid fa-triangle-exclamation" style="width:16px;"></i> ${l.note}</div>`);
        
        if(l.coworkers && l.coworkers.length > 0) {
            bottomManagerHtml = `<div style="color:var(--w-blue); font-size:0.8rem; font-weight:bold;"><i class="fa-solid fa-user-group"></i> ${l.coworkers.join(', ')}</div>`;
        }

        workDetailsHtml = `
            <div class="card-content-zone">
                <div style="display:flex; align-items:center; gap:2px; margin-bottom:6px; flex-wrap:wrap; padding-right:85px;">
                    ${dutyBadge}${statusBadge} 
                    <span style="font-size:1.1rem; font-weight:900; color:var(--w-blue); letter-spacing:0.5px;">${l.workTime || '00:00'}</span>
                    <span style="font-weight:bold; color:#475569; font-size:0.85rem; margin-left:4px;">${headerDateStr}</span>
                </div>
                <div class="log-content">${(l.content||'내용 없음')}</div>
                ${detailsHtml.length > 0 ? `<div style="display:flex; flex-direction:column; background:rgba(255,255,255,0.7); padding:8px 10px; border:1px solid #cbd5e1; border-radius:4px; margin-top:8px; margin-bottom:4px; gap:4px;">${detailsHtml.join('')}</div>` : ''}
            </div>
        `;
    } else if (l.cat === 'commute_in' || l.cat === 'commute_out') {
        let isOut = l.cat === 'commute_out';
        // 🌟 [에러 수정 완료] idx 에러 원천 차단 (무조건 0으로 뷰어 연결)
        let imgH = l.imgs && l.imgs[0] ? `<img src="${l.imgs[0].src}" style="width:50px; height:50px; object-fit:cover; border-radius:4px; border:1px solid #999; margin-right:10px; cursor:zoom-in;" onclick="event.stopPropagation(); window.openImageViewer(0, 'log', '${l.id}')">` : '';
        let cTime = isOut ? l.outTime : l.inTime;
        
        let cColor = '#be185d'; 
        let cTitle = isOut ? '퇴근 기록' : '출근 기록';
        let cIcon = isOut ? 'fa-sign-out-alt' : 'fa-sign-in-alt';
        
        let otMin = l.overtimeMin || 0;
        let otStr = '';
        if(l.inException || l.outException) {
            otStr = '<span style="color:red; font-weight:bold; margin-left:8px;">[예외 적용됨]</span>';
        } else if(otMin > 0) {
            let h = String(Math.floor(otMin / 60)).padStart(2, '0');
            let m = String(otMin % 60).padStart(2, '0');
            otStr = `<span style="color:red; font-weight:bold; margin-left:8px;">(+${h}:${m})</span>`;
        }

        let commuteNoteHtml = l.commuteNote ? `<div style="background:#fce7f3; color:#9d174d; padding:6px 8px; border-radius:4px; font-size:0.85rem; font-weight:bold; margin-top:8px; border:1px solid #f9a8d4; width:100%; box-sizing:border-box;"><i class="fa-solid fa-triangle-exclamation"></i> ${l.commuteNote}</div>` : '';
        
        let kmText = l.km ? ` | 🚗 ${Number(l.km).toLocaleString()}km` : '';

        workDetailsHtml = `
            <div class="card-content-zone" style="display:flex; flex-direction:column; padding: 10px 12px;">
                <div style="display:flex; align-items:center;">
                    ${imgH}
                    <div style="flex:1;">
                        <div style="font-weight:bold; color:${cColor}; font-size:1rem; margin-bottom:4px;"><i class="fa-solid ${cIcon}"></i> ${cTitle} ${kmText}</div>
                        <div style="font-size:0.85rem; color:#475569;">시간: <b style="color:var(--w-blue);">${cTime||'-'}</b> ${otStr}</div>
                    </div>
                </div>
                ${commuteNoteHtml}
            </div>`;
    } else {
        let editTagsHtml = l.tags && l.tags.length > 0 ? `<div style="margin-top:6px; display:flex; gap:4px; flex-wrap:wrap;">${l.tags.map(t=>`<span style="background:#e0e7ff; border:1px solid #818cf8; color:#3730a3; padding:2px 6px; border-radius:4px; font-size:0.75rem; font-weight:bold;"><i class="fa-solid fa-hashtag"></i> ${t}</span>`).join('')}</div>` : '';
        workDetailsHtml = `
            <div class="card-content-zone">
                <div class="log-content">${displayMemo}</div>
                ${editTagsHtml}
            </div>
        `;
    }

    let bottomTimeHtml = (isCommuteDetailCard || isCommuteCard) 
        ? '' 
        : `<div class="log-time" style="padding:0;">${l.m}/${l.d}(${dayStr}) ${l.time||''}</div>`;

    return `
    <div class="log-card w95-out ${cardClass}" style="${cardStyle}" onclick="window.handleCardClick('${l.id}', '${l.cat}')">
        ${oxWatermark}
        <button type="button" class="btn-del w95-btn" onclick="event.stopPropagation(); window.deleteEntry('${l.id}')">X</button>
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

window.renderEquips = () => {
    let html = '';
    window.equipments.forEach((eq, idx) => {
        let count = window.activeEquips[eq.name] || 0;
        let activeCls = count > 0 ? 'active-btn' : '';
        let label = count > 0 ? `${eq.name} (${count})` : eq.name;
        html += `<button type="button" class="w95-btn ${activeCls}" onmousedown="window.startPress(event, 'equip', ${idx})" onmouseup="window.endPress(event, 'equip', ${idx})" onmouseleave="window.cancelPress()" ontouchstart="window.startPress(event, 'equip', ${idx})" ontouchend="window.endPress(event, 'equip', ${idx})" ontouchcancel="window.cancelPress()">${label}</button>`;
    });
    html += `<button type="button" class="w95-btn" onclick="window.addNewType('equip')"><b>+</b></button>`;
    document.getElementById('equipArea').innerHTML = html;
};

window.renderTaskTypes = () => {
    window.taskTypes.sort((a,b) => b.count - a.count);
    let html = window.taskTypes.map((t, idx) => {
        let activeCls = window.activeTaskTypes.includes(t.name) ? 'active-btn' : '';
        return `<button type="button" class="w95-btn ${activeCls}" onmousedown="window.startPress(event, 'task', ${idx})" onmouseup="window.endPress(event, 'task', ${idx})" onmouseleave="window.cancelPress()" ontouchstart="window.startPress(event, 'task', ${idx})" ontouchend="window.endPress(event, 'task', ${idx})" ontouchcancel="window.cancelPress()">[${t.count}] ${t.name}</button>`;
    }).join(' ');
    html += `<button type="button" class="w95-btn" onclick="window.addNewType('task')"><b>+</b></button>`;
    document.getElementById('taskTypeArea').innerHTML = html;
};

window.renderCoworkers = () => {
    window.coworkers.sort((a,b) => b.count - a.count);
    let html = window.coworkers.map((c, idx) => {
        let activeCls = window.selectedCoworkers.includes(c.name) ? 'active-btn' : '';
        return `<button type="button" class="w95-btn ${activeCls}" onmousedown="window.startPress(event, 'coworker', ${idx})" onmouseup="window.endPress(event, 'coworker', ${idx})" onmouseleave="window.cancelPress()" ontouchstart="window.startPress(event, 'coworker', ${idx})" ontouchend="window.endPress(event, 'coworker', ${idx})" ontouchcancel="window.cancelPress()">[${c.count}] ${c.name}</button>`;
    }).join(' ');
    html += `<button type="button" class="w95-btn" onclick="window.addNewType('coworker')"><b>+</b></button>`;
    document.getElementById('coworkerArea').innerHTML = html;
};

window.renderStatuses = () => {
    window.statuses.sort((a,b) => b.count - a.count);
    let html = window.statuses.map((s, idx) => {
        let activeCls = window.activeStatus === s.name ? 'active-btn' : '';
        return `<button type="button" class="w95-btn ${activeCls}" onmousedown="window.startPress(event, 'status', ${idx})" onmouseup="window.endPress(event, 'status', ${idx})" onmouseleave="window.cancelPress()" ontouchstart="window.startPress(event, 'status', ${idx})" ontouchend="window.endPress(event, 'status', ${idx})" ontouchcancel="window.cancelPress()">${s.name}</button>`;
    }).join(' ');
    html += `<button type="button" class="w95-btn" onclick="window.addNewType('status')"><b>+</b></button>`;
    document.getElementById('statusArea').innerHTML = html;
};

window.renderMemoTags = () => {
    if(!window.memoTags) window.memoTags = [];
    window.memoTags.sort((a,b) => b.count - a.count);
    
    let html = window.memoTags.map((t, idx) => {
        let activeCls = window.activeEditTags.includes(t.name) ? 'active-btn' : '';
        return `<button type="button" class="w95-btn ${activeCls}" style="display:inline-flex; align-items:center; justify-content:center; gap:4px; touch-action:manipulation; height:30px; white-space:nowrap; max-width:100%; overflow:hidden; text-overflow:ellipsis;" onclick="window.toggleTagSelection('memoTag', '${t.name}')" oncontextmenu="event.preventDefault(); window.openTagEditBox('memoTag', ${idx});">${t.name}</button>`;
    }).join(' ');
    
    if (window.memoTags.length < 5) {
        html += `<button type="button" class="w95-btn" style="height:30px; width:36px; display:flex; align-items:center; justify-content:center; flex-shrink:0;" onclick="window.addNewType('memoTag')"><b>+</b></button>`;
    }
    
    const targetArea = document.getElementById('editTagArea');
    if (targetArea) targetArea.innerHTML = html;
};

/* 🌟 달력 간이입력기 사진 렌더링 (클릭시 뷰어 연동) */
window.renderTempImgs = () => {
    document.getElementById('previewArea').innerHTML = window.tempImgs.map((img, idx) => `
        <div style="position:relative; width:60px; height:60px; flex-shrink:0;">
            <img src="${img.src}" style="width:100%;height:100%;object-fit:cover;border-radius:8px; cursor:zoom-in;" onclick="window.openImageViewer(${idx}, 'temp')">
            <button type="button" onclick="window.removeTemp('${img.id}')" class="remove-btn" style="position:absolute; top:-6px; right:-6px; width:24px; height:24px; font-size:14px; background:white; border:1px solid #000; border-radius:50%; z-index:10;">×</button>
        </div>
    `).join('');
};

/* 🌟 작업일지 사진 렌더링 (클릭시 뷰어 연동) */
window.renderWorkPhotoGrid = () => {
    const grid = document.getElementById('workPhotoGrid');
    grid.innerHTML = window.workImgs.map((img, idx) => `
        <div class="photo-item">
            <img src="${img.src}" onclick="window.openImageViewer(${idx}, 'work')">
            <button type="button" class="remove-img-btn w95-btn" onclick="window.removeWorkPhoto(${idx})">X</button>
        </div>
    `).join('');
};

/* 🌟 편집 모달 사진 렌더링 (클릭시 뷰어 연동) */
window.renderEditPhotoGrid = () => {
    const log = window.logs.find(l => l.id === window.editingLogId); 
    if(!log || !log.imgs) { document.getElementById('editPhotoGrid').innerHTML = ''; return; }
    document.getElementById('editPhotoGrid').innerHTML = log.imgs.map((img, idx) => `
        <div class="photo-item">
            <img src="${img.src}" onclick="window.openImageViewer(${idx}, 'edit', '${window.editingLogId}')">
            <button type="button" class="remove-img-btn w95-btn" onclick="window.removePhotoFromEdit(${idx})">X</button>
        </div>
    `).join('');
};