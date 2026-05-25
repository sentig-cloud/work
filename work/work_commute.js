window.handleCommuteFile = async (input) => {
    if(input.files.length === 0) return;
    window.showLoading("사진 처리 중...");
    window.processFileExt(input.files[0], (dataUrl) => {
        if(dataUrl) {
            window.tempCommuteImg = dataUrl;
            document.getElementById('commuteNoPhotoText').style.display = 'none';
            const preview = document.getElementById('commuteImgPreview');
            preview.style.display = 'block';
            preview.src = dataUrl;
            document.getElementById('commuteImgDelBtn').style.display = 'block';
        }
        window.hideLoading();
    });
    input.value = "";
};

window.handleCommuteImg = window.handleCommuteFile;

window.handleCommuteThumbClick = (event) => {
    if (event && event.target && event.target.id === 'commuteImgDelBtn') return;

    if (window.tempCommuteImg) {
        if (window.openImageViewer) window.openImageViewer(0, 'tempCommute');
        return;
    }

    const input = document.getElementById('commuteImgInput');
    if (input) input.click();
};

window.removeCommuteImg = (event) => {
    if (event && event.stopPropagation) event.stopPropagation();
    window.tempCommuteImg = null;
    document.getElementById('commuteNoPhotoText').style.display = 'block';
    document.getElementById('commuteImgPreview').style.display = 'none';
    document.getElementById('commuteImgPreview').src = '';
    document.getElementById('commuteImgDelBtn').style.display = 'none';
};

window.updateOvertime = () => {
    const timeVal = document.getElementById('commuteTime').value;
    const baseVal = document.getElementById('commuteBaseTime').value;
    const otInput = document.getElementById('commuteOvertime');

    if(timeVal.length < 4 || baseVal.length < 4 || !timeVal.includes(':') || !baseVal.includes(':')) {
        otInput.value = `00:00`;
        window.calculatedOvertimeMin = 0;
        return;
    }

    const parseMins = (tStr) => {
        const [h, m] = tStr.split(':').map(Number);
        return h * 60 + m;
    };

    const tMins = parseMins(timeVal);
    const bMins = parseMins(baseVal);

    let diff = 0;
    if (window.currentCommuteType === 'in') diff = bMins - tMins;
    else diff = tMins - bMins;

    if (diff < 0) diff = 0; 
    if (window.isCommuteException) diff = 0; 

    window.calculatedOvertimeMin = diff;

    const hh = String(Math.floor(diff / 60)).padStart(2, '0');
    const mm = String(diff % 60).padStart(2, '0');
    otInput.value = `${hh}:${mm}`;
};

window.updateCommuteDetailByDate = (y, m, d) => {
    const todayLogs = window.logs.filter(l => l.y === y && l.m === m && l.d === d);
    const inLog = todayLogs.find(l => l.cat === 'commute_in');
    const outLog = todayLogs.find(l => l.cat === 'commute_out');
    let calcId = `calc_commute_${y}_${m}_${d}`;
    
    if (inLog && outLog) {
        let diffKm = (parseInt(outLog.km) || 0) - (parseInt(inLog.km) || 0);
        if (diffKm < 0) diffKm = 0;

        const monthLogs = window.logs.filter(l => String(l.y) === String(y) && String(l.m) === String(m));
        let monthlyKm = 0;
        
        for(let day = 1; day <= d; day++) {
            let dIn = monthLogs.find(l => String(l.d) === String(day) && l.cat === 'commute_in');
            let dOut = monthLogs.find(l => String(l.d) === String(day) && l.cat === 'commute_out');
            
            if(dIn && dOut) {
                let dKm = (parseInt(dOut.km) || 0) - (parseInt(dIn.km) || 0); 
                if (dKm > 0) monthlyKm += dKm;
            }
        }

        const formatOt = (min) => {
            if(!min) return "";
            let hStr = String(Math.floor(min / 60)).padStart(2, '0');
            let mStr = String(min % 60).padStart(2, '0');
            // 🌟 [수정 완료] 편집창 오류 방지를 위해 HTML 태그를 없애고 순수 텍스트로만 저장
            return ` (+${hStr}:${mStr})`;
        };

        // 🌟 [수정 완료] 편집창 오류 방지를 위해 [예외] 텍스트도 순수하게 저장
        let inOtStr = inLog.inException ? ` [예외]` : formatOt(inLog.overtimeMin);
        let outOtStr = outLog.outException ? ` [예외]` : formatOt(outLog.overtimeMin);

        let inTimeStr = inLog.time || "-";
        let outTimeStr = outLog.time || "-";

        const days = ['일','월','화','수','목','금','토'];
        const dayStr = days[new Date(y, m - 1, d).getDay()];
        const isDutyToday = todayLogs.some(l => l.cat === 'work' && l.isDuty);
        
        // 🌟 [수정 완료] 당직 역시 순수 텍스트로 저장
        let dutyStr = isDutyToday ? ` - 당직` : "";

        let diffKmStr = Number(diffKm).toLocaleString();
        let monthlyKmStr = Number(monthlyKm).toLocaleString();

        let newMemoStr = `[출/퇴 상세내역]\n📅 ${y}년 ${m}월 ${d}일(${dayStr})${dutyStr}\n🟢 출근 : ${inTimeStr}${inOtStr}\n🔴 퇴근 : ${outTimeStr}${outOtStr}\n🚗 주행: ${diffKmStr}km (누적 ${monthlyKmStr}km)`;

        // 🌟 [수정 완료] 기준 시간을 '출근'에서 '퇴근'으로 변경하여 퇴근 카드 밑에 생성되도록 고정
        let sortTime = outLog.time ? outLog.time + ":01" : "23:59:59";

        if (!window.memoTags) window.memoTags = [];
        if (!window.memoTags.find(t => t.name === '상세내역')) {
            window.memoTags.push({ name: '상세내역', count: 1 });
        }

        let detailLog = window.logs.find(l => l.id === calcId);
        
        if (detailLog) {
            let oldMemo = detailLog.memo || "";
            let customText = "";
            
            let lines = oldMemo.split('\n');
            let customLines = [];
            lines.forEach(line => {
                let l = line.trim();
                if (l.startsWith('[출/퇴 상세내역]') || l.startsWith('📅') || l.startsWith('🟢') || l.startsWith('🔴')) return;
                if (l.startsWith('🚗 주행:') || l.startsWith('오늘 주행:')) {
                    let idx = line.indexOf('km)');
                    if (idx !== -1 && idx + 3 < line.length) {
                        let extra = line.substring(idx + 3).trim();
                        if (extra) customLines.push(extra);
                    }
                    return;
                }
                if (line.length > 0) customLines.push(line);
            });
            
            if (customLines.length > 0) customText = "\n" + customLines.join('\n');
            
            detailLog.memo = newMemoStr + customText;
            detailLog.time = sortTime; 
            
            if(!detailLog.tags) detailLog.tags = [];
            if(!detailLog.tags.includes('상세내역')) detailLog.tags.push('상세내역');
        } else {
            window.logs.push({
                id: calcId, y: y, m: m, d: d, cat: 'memo', tags: ['상세내역'], memo: newMemoStr, time: sortTime
            });
        }
    } else {
        window.logs = window.logs.filter(l => l.id !== calcId);
    }
};

window.saveCommute = () => {
    const timeInput = document.getElementById('commuteTime');
    window.formatTimeInput(timeInput);
    let cTime = timeInput.value || window.getCurrentTimeString();
    
    let kmInput = document.getElementById('commuteKm').value.replace(/[^0-9]/g, '');
    let km = parseInt(kmInput) || 0;
    
    let exceptionText = "";
    let exceptionStatus = null;
    let diffMins = window.calculatedOvertimeMin || 0;
    let note = document.getElementById('commuteNote').value.trim();
    
    if (window.isCommuteException) {
        exceptionText = " [예외 적용됨]";
        exceptionStatus = "예외";
    } else if (diffMins > 0) {
        exceptionStatus = window.currentCommuteType === 'in' ? '조출' : '지연';
        exceptionText = ` [${exceptionStatus} 적용]`;
    }

    const catType = window.currentCommuteType === 'in' ? 'commute_in' : 'commute_out';

    let existingIdx = window.logs.findIndex(l => l.y === window.currentYear && l.m === window.curMonth && l.d === window.curDay && l.cat === catType);
    const existingLog = existingIdx > -1 ? window.logs[existingIdx] : null;
    let newId = existingLog ? existingLog.id : Date.now().toString();
    const nowIso = new Date().toISOString();
    let imgsArr = [];
    if (window.tempCommuteImg) {
        const prevImg = existingLog && existingLog.imgs && existingLog.imgs[0] ? existingLog.imgs[0] : null;
        imgsArr = [{
            id: prevImg && prevImg.src === window.tempCommuteImg ? prevImg.id : 'c_' + Date.now(),
            src: window.tempCommuteImg,
            updatedAt: nowIso
        }];
    }

    const newLog = { 
        id: newId, 
        y: window.currentYear, 
        m: window.curMonth, 
        d: window.curDay, 
        cat: catType, 
        time: cTime,
        inTime: window.currentCommuteType === 'in' ? cTime : null,
        outTime: window.currentCommuteType === 'out' ? cTime : null,
        inResult: window.currentCommuteType === 'in' ? exceptionStatus : null,
        outResult: window.currentCommuteType === 'out' ? exceptionStatus : null,
        inException: window.currentCommuteType === 'in' ? window.isCommuteException : null,
        outException: window.currentCommuteType === 'out' ? window.isCommuteException : null,
        overtimeMin: diffMins,
        commuteNote: note,
        km: km,
        imgs: imgsArr,
        memo: `${window.currentCommuteType === 'in' ? '출근' : '퇴근'} 기록: ${cTime} / ${Number(km).toLocaleString()}km${exceptionText}`,
        personalCheck: existingLog ? (existingLog.personalCheck || null) : null,
        updatedAt: nowIso
    };

    if (window.saveToLocalStore) {
        window.saveToLocalStore('logs', newLog);
    } else {
        if (existingIdx !== -1) window.logs[existingIdx] = newLog;
        else window.logs.push(newLog);
    }

    const beforeDetail = window.logs.find(l => l.id === `calc_commute_${window.currentYear}_${window.curMonth}_${window.curDay}`);
    window.updateCommuteDetailByDate(window.currentYear, window.curMonth, window.curDay);
    const afterDetail = window.logs.find(l => l.id === `calc_commute_${window.currentYear}_${window.curMonth}_${window.curDay}`);
    if (afterDetail) {
        afterDetail.updatedAt = nowIso;
        if (window.markDirty) window.markDirty('logs', afterDetail.id, beforeDetail ? 'upsert' : 'upsert');
    } else if (beforeDetail && window.markDirty) {
        window.markDirty('logs', beforeDetail.id, 'delete');
    }

    if (window.saveLocal) window.saveLocal(`logs:${newId}:commute`);
    window.closeCommuteModal();
};