// work_tag_manager.js
window.saveTagEdit = () => {
    if(window.editingTagIndex === -1 || !window.editingTagType) return;
    let arr = window.editingTagType === 'task' ? window.taskTypes : (window.editingTagType === 'coworker' ? window.coworkers : (window.editingTagType === 'equip' ? window.equipments : (window.editingTagType === 'memoTag' ? window.memoTags : window.statuses)));
    let newName = document.getElementById('tagEditInput').value.trim();
    if(!newName) return alert('이름을 입력하세요.');
    let oldName = arr[window.editingTagIndex].name;
    
    if(newName !== oldName || (window.editingTagType === 'equip')) {
        // 1. 현재 선택된 필터 UI 업데이트
        if(window.editingTagType === 'task') { let selIdx = window.activeTaskTypes.indexOf(oldName); if(selIdx > -1) window.activeTaskTypes[selIdx] = newName; }
        if(window.editingTagType === 'coworker') { let selIdx = window.selectedCoworkers.indexOf(oldName); if(selIdx > -1) window.selectedCoworkers[selIdx] = newName; }
        if(window.editingTagType === 'status') { if(window.activeStatus === oldName) window.activeStatus = newName; }
        if(window.editingTagType === 'memoTag') { let selIdx = window.activeEditTags.indexOf(oldName); if(selIdx > -1) window.activeEditTags[selIdx] = newName; }
        
        // 🌟 2. [핵심] 기존에 저장된 모든 작업일지(logs) 데이터를 순회하며 옛날 이름을 새 이름으로 강제 변환 (검색 누락 방지)
        window.logs.forEach(l => {
            if (window.editingTagType === 'task' && l.taskType === oldName) l.taskType = newName;
            if (window.editingTagType === 'status' && l.status === oldName) l.status = newName;
            if (window.editingTagType === 'coworker' && l.coworkers) {
                let cIdx = l.coworkers.indexOf(oldName);
                if (cIdx > -1) l.coworkers[cIdx] = newName;
            }
            if (window.editingTagType === 'memoTag' && l.tags) {
                let tIdx = l.tags.indexOf(oldName);
                if (tIdx > -1) l.tags[tIdx] = newName;
            }
            if (window.editingTagType === 'equip' && l.equips && l.equips[oldName] !== undefined) {
                l.equips[newName] = l.equips[oldName];
                delete l.equips[oldName];
            }
        });

        // 3. 마스터 배열 이름 변경 및 저장
        arr[window.editingTagIndex].name = newName;
        window.saveLocal();
        
        // 4. UI 다시 그리기
        if(window.editingTagType === 'task') window.renderTaskTypes();
        if(window.editingTagType === 'coworker') window.renderCoworkers();
        if(window.editingTagType === 'equip') window.renderEquips();
        if(window.editingTagType === 'memoTag') window.renderMemoTags();
        if(window.editingTagType === 'status') window.renderStatuses();
        
        // 5. 검색 중이었다면 검색 결과도 즉시 새로고침
        if (window.doSearch && document.getElementById('searchInput') && document.getElementById('searchInput').value) {
            window.doSearch();
        } else {
            window.renderMain();
        }
    }
    document.getElementById('tagEditBox').style.display = 'none';
};

window.deleteTagEdit = () => {
    if(window.editingTagIndex === -1 || !window.editingTagType) return;
    let arr = window.editingTagType === 'task' ? window.taskTypes : (window.editingTagType === 'coworker' ? window.coworkers : (window.editingTagType === 'equip' ? window.equipments : (window.editingTagType === 'memoTag' ? window.memoTags : window.statuses)));
    let oldName = arr[window.editingTagIndex].name;
    const removeTagFromLogs = (logArray, type, nameToRemove) => {
        logArray.forEach(log => {
            if(log.cat === 'work') {
                if (type === 'task' && log.taskType) { let tasks = log.taskType.split(', ').filter(t => t !== nameToRemove); log.taskType = tasks.join(', '); }
                else if (type === 'coworker' && log.coworkers) log.coworkers = log.coworkers.filter(c => c !== nameToRemove);
                else if (type === 'status' && log.status === nameToRemove) log.status = null;
                else if (type === 'equip' && log.equips) delete log.equips[nameToRemove];
            } else {
                if (type === 'memoTag' && log.tags) log.tags = log.tags.filter(t => t !== nameToRemove);
            }
        });
    };
    removeTagFromLogs(window.logs, window.editingTagType, oldName); removeTagFromLogs(window.trash, window.editingTagType, oldName);
    if(window.editingTagType === 'task') window.activeTaskTypes = window.activeTaskTypes.filter(n => n !== oldName);
    if(window.editingTagType === 'coworker') window.selectedCoworkers = window.selectedCoworkers.filter(n => n !== oldName);
    if(window.editingTagType === 'status' && window.activeStatus === oldName) window.activeStatus = null;
    if(window.editingTagType === 'memoTag') window.activeEditTags = window.activeEditTags.filter(n => n !== oldName);
    if(window.editingTagType === 'equip') delete window.activeEquips[oldName];
    arr.splice(window.editingTagIndex, 1); window.saveLocal();
    if(window.editingTagType === 'task') window.renderTaskTypes(); else if(window.editingTagType === 'coworker') window.renderCoworkers(); else if(window.editingTagType === 'equip') window.renderEquips(); else if(window.editingTagType === 'memoTag') window.renderMemoTags(); else window.renderStatuses();
    window.closeTagEditModal(); 
};

window.addNewType = (type) => {
    let title = type === 'task' ? '작업유형' : (type === 'coworker' ? '매니저' : (type === 'equip' ? '장비/기타' : (type === 'memoTag' ? '메모 태그' : '상태')));
    let name = prompt(`새로운 ${title}을 입력하세요.`); if(!name) return; name = name.trim();
    let arr = type === 'task' ? window.taskTypes : (type === 'coworker' ? window.coworkers : (type === 'equip' ? window.equipments : (type === 'memoTag' ? window.memoTags : window.statuses)));
    if(!arr.find(x => x.name === name)) { if(type === 'equip') arr.push({name}); else arr.push({name, count: 0}); window.saveLocal(); }
    if (type === 'coworker') { if(!window.selectedCoworkers.includes(name)) window.selectedCoworkers.push(name); window.renderCoworkers(); } 
    else if (type === 'task') { if(!window.activeTaskTypes.includes(name)) window.activeTaskTypes.push(name); window.renderTaskTypes(); } 
    else if (type === 'memoTag') { 
        if(!window.activeEditTags.includes(name)) window.activeEditTags.push(name); 
        window.renderMemoTags(); 
    }
    else if (type === 'equip') { window.activeEquips[name] = 1; window.renderEquips(); } 
    else { window.activeStatus = name; window.renderStatuses(); }
};

window.toggleTagSelection = (type, name) => {
    if (type === 'memoTag') {
        // 🌟 출퇴근 상세내역 편집 시, '상세내역' 태그 클릭(해제) 무시
        if(window.editingLogId && window.editingLogId.startsWith('calc_commute_') && name === '상세내역') {
            return;
        }
        if(window.activeEditTags.includes(name)) {
            window.activeEditTags = window.activeEditTags.filter(n => n !== name);
        } else {
            window.activeEditTags.push(name);
        }
        window.renderMemoTags();
    }
};

window.openTagEditBox = (type, idx) => {
    window.editingTagType = type; window.editingTagIndex = idx;
    let arr = [];
    if(type === 'memoTag') arr = window.memoTags;
    else if(type === 'task') arr = window.taskTypes;
    else if(type === 'coworker') arr = window.coworkers;
    else if(type === 'equip') arr = window.equipments;
    else if(type === 'status') arr = window.statuses;
    
    if(arr && arr[idx]) {
        document.getElementById('tagEditInput').value = arr[idx].name;
        if(document.getElementById('equipQtyContainer')) document.getElementById('equipQtyContainer').style.display = (type === 'equip') ? 'flex' : 'none';
        document.getElementById('tagEditModal').style.display = 'flex';
    }
};