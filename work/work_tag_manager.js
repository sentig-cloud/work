// work_tag_manager.js (v2 - groups 통합)

window.tempTagQty = 0;
window.tempTagShowNumber = true;
window.tempTagIncludeMonthly = true;
window.tagSaveDeleteTimer = null;
window.tagSaveDeleteLongPressed = false;

// ─── 하위 호환: getTagArray (기존 코드에서 type 문자열로 호출하는 곳 대응) ───
window.getTagArray = function (type) {
    const idMap = {
        task: 'taskTypes',
        coworker: 'coworkers',
        equip: 'equipments',
        memoTag: 'memoTags',
        status: 'statuses'
    };
    const groupId = idMap[type] || type;
    const g = window.getGroupById(groupId);
    return g ? g.tags : [];
};

// type → groupId 변환
window.typeToGroupId = function (type) {
    const idMap = {
        task: 'taskTypes',
        coworker: 'coworkers',
        equip: 'equipments',
        memoTag: 'memoTags',
        status: 'statuses'
    };
    return idMap[type] || type;
};

window.isTagNumberEnabled = (tag) => !tag || tag.showNumber !== false;
window.isTagMonthlyEnabled = (tag) => !tag || tag.includeMonthly !== false;

window.refreshTagToggleButtons = () => {
    const numberBtn = document.getElementById('tagNumberToggle');
    const monthlyBtn = document.getElementById('tagMonthlyToggle');
    if (numberBtn) numberBtn.classList.toggle('tag-toggle-off', !window.tempTagShowNumber);
    if (monthlyBtn) monthlyBtn.classList.toggle('tag-toggle-off', !window.tempTagIncludeMonthly);
};

window.toggleTagSetting = (key) => {
    if (key === 'showNumber') window.tempTagShowNumber = !window.tempTagShowNumber;
    if (key === 'includeMonthly') window.tempTagIncludeMonthly = !window.tempTagIncludeMonthly;
    window.refreshTagToggleButtons();
};

window.changeTagQty = (delta) => {
    window.tempTagQty = Math.max(0, Number(window.tempTagQty || 0) + delta);
    const display = document.getElementById('tagQtyDisplay');
    if (display) display.innerText = window.tempTagQty;
};

window.changeEquipQty = window.changeTagQty;

// ─── 태그 이름 변경 시 기존 로그 일괄 업데이트 ───
window.renameTagInRecords = (records, groupId, oldName, newName) => {
    // 하위 호환: type 문자열도 처리
    const gId = window.typeToGroupId(groupId);

    (records || []).forEach(log => {
        if (gId === 'taskTypes' && log.taskType) {
            log.taskType = log.taskType.split(', ')
                .map(name => name === oldName ? newName : name).join(', ');
        }
        if (gId === 'coworkers' && log.coworkers) {
            log.coworkers = log.coworkers.map(name => name === oldName ? newName : name);
        }
        if (gId === 'statuses' && log.status === oldName) {
            log.status = newName;
        }
        if (gId === 'memoTags' && log.tags) {
            log.tags = log.tags.map(name => name === oldName ? newName : name);
        }
        if (gId === 'equipments' && log.equips && log.equips[oldName] !== undefined) {
            log.equips[newName] = log.equips[oldName];
            if (newName !== oldName) delete log.equips[oldName];
        }
        // 커스텀 그룹
        if (log.customGroups && log.customGroups[gId]) {
            log.customGroups[gId] = log.customGroups[gId].map(name => name === oldName ? newName : name);
        }
    });
};

// ─── 그룹 렌더링 통합 함수 ───
window.renderGroupById = function (groupId) {
    const g = window.getGroupById(groupId);
    if (!g) return;

    // 기존 type 문자열 기반 렌더러 유지 (하위 호환)
    if (groupId === 'taskTypes' && window.renderTaskTypes) return window.renderTaskTypes();
    if (groupId === 'coworkers' && window.renderCoworkers) return window.renderCoworkers();
    if (groupId === 'statuses' && window.renderStatuses) return window.renderStatuses();
    if (groupId === 'equipments' && window.renderEquips) return window.renderEquips();
    if (groupId === 'memoTags' && window.renderMemoTags) return window.renderMemoTags();

    // 커스텀 그룹 렌더링
    if (window.renderCustomGroup) window.renderCustomGroup(groupId);
};

window.renderChangedTagType = (type) => {
    window.renderGroupById(window.typeToGroupId(type));
};

// ─── 태그 편집 저장 ───
window.saveTagEdit = () => {
    if (window.editingTagIndex === -1 || !window.editingTagType) return;

    const groupId = window.typeToGroupId(window.editingTagType);
    const arr = window.getTagArray(window.editingTagType);
    const tag = arr[window.editingTagIndex];
    if (!tag) return;

    const oldName = tag.name;
    const newName = document.getElementById('tagEditInput').value.trim();
    if (!newName) return alert('이름을 입력하세요.');

    if (arr.some((item, index) => index !== window.editingTagIndex && item.name === newName)) {
        return alert('같은 이름의 항목이 이미 있습니다.');
    }

    tag.name = newName;
    tag.count = Number(window.tempTagQty || 0);
    tag.showNumber = window.tempTagShowNumber;
    tag.includeMonthly = window.tempTagIncludeMonthly;

    if (newName !== oldName) {
        window.renameTagInRecords(window.logs, groupId, oldName, newName);
        window.renameTagInRecords(window.trash, groupId, oldName, newName);

        window.activeTaskTypes = window.activeTaskTypes.map(name => name === oldName ? newName : name);
        window.selectedCoworkers = window.selectedCoworkers.map(name => name === oldName ? newName : name);
        window.activeEditTags = window.activeEditTags.map(name => name === oldName ? newName : name);

        if (window.activeStatus === oldName) window.activeStatus = newName;

        if (window.activeEquips[oldName] !== undefined) {
            window.activeEquips[newName] = window.activeEquips[oldName];
            delete window.activeEquips[oldName];
        }

        // 커스텀 그룹 선택 상태
        if (window.activeCustomGroupSelections[groupId]) {
            window.activeCustomGroupSelections[groupId] = window.activeCustomGroupSelections[groupId]
                .map(name => name === oldName ? newName : name);
        }
    }

    if (groupId === 'equipments') {
        if (window.tempTagQty > 0) window.activeEquips[newName] = window.tempTagQty;
        else delete window.activeEquips[newName];
    }

    window.saveLocal('tag-edit');
    window.markDirty('master', 'groups', 'upsert');
    window.renderChangedTagType(window.editingTagType);
    window.closeTagEditModal();
};

// ─── 태그 삭제 ───
window.deleteTagEdit = () => {
    if (window.editingTagIndex === -1 || !window.editingTagType) return;

    const groupId = window.typeToGroupId(window.editingTagType);
    const arr = window.getTagArray(window.editingTagType);
    const tag = arr[window.editingTagIndex];
    if (!tag) return;

    const oldName = tag.name;
    arr.splice(window.editingTagIndex, 1);

    window.activeTaskTypes = window.activeTaskTypes.filter(name => name !== oldName);
    window.selectedCoworkers = window.selectedCoworkers.filter(name => name !== oldName);
    window.activeEditTags = window.activeEditTags.filter(name => name !== oldName);
    if (window.activeStatus === oldName) window.activeStatus = null;
    delete window.activeEquips[oldName];

    if (window.activeCustomGroupSelections[groupId]) {
        window.activeCustomGroupSelections[groupId] =
            window.activeCustomGroupSelections[groupId].filter(name => name !== oldName);
    }

    window.saveLocal('tag-delete');
    window.markDirty('master', 'groups', 'upsert');
    window.closeTagEditModal();
};

window.startTagSaveDeletePress = (event) => {
    if (event) event.preventDefault();
    clearTimeout(window.tagSaveDeleteTimer);
    window.tagSaveDeleteLongPressed = false;
    window.tagSaveDeleteTimer = setTimeout(() => {
        window.tagSaveDeleteLongPressed = true;
        if (navigator.vibrate) navigator.vibrate(40);
        window.deleteTagEdit();
    }, 3000);
};

window.endTagSaveDeletePress = (event) => {
    if (event) event.preventDefault();
    clearTimeout(window.tagSaveDeleteTimer);
    if (!window.tagSaveDeleteLongPressed) window.saveTagEdit();
    window.tagSaveDeleteLongPressed = false;
};

window.cancelTagSaveDeletePress = () => {
    clearTimeout(window.tagSaveDeleteTimer);
};

// ─── 새 태그 추가 ───
window.addNewType = (type) => {
    const groupId = window.typeToGroupId(type);
    const g = window.getGroupById(groupId);

    const titleMap = {
        task: '작업유형', coworker: '매니저',
        equip: '장비/기타', memoTag: '메모 태그', status: '상태'
    };
    const title = g ? g.title : (titleMap[type] || type);
    let name = prompt(`새로운 ${title}을 입력하세요.`);
    if (!name) return;
    name = name.trim();
    if (!name) return;

    const arr = window.getTagArray(type);
    if (!arr.find(tag => tag.name === name)) {
        arr.push({ name, count: 0, showNumber: true, includeMonthly: true });
        window.markDirty('master', 'groups', 'upsert');
        window.saveLocal('tag-add');
    }

    // 선택 상태 업데이트
    if (type === 'coworker') {
        if (!window.selectedCoworkers.includes(name)) window.selectedCoworkers.push(name);
        window.renderCoworkers();
    } else if (type === 'task') {
        if (!window.activeTaskTypes.includes(name)) window.activeTaskTypes.push(name);
        window.renderTaskTypes();
    } else if (type === 'memoTag') {
        if (!window.activeEditTags.includes(name)) window.activeEditTags.push(name);
        window.renderMemoTags();
    } else if (type === 'equip') {
        window.activeEquips[name] = 1;
        window.renderEquips();
    } else if (type === 'status') {
        window.activeStatus = name;
        window.renderStatuses();
    } else {
        // 커스텀 그룹
        if (!window.activeCustomGroupSelections[groupId]) window.activeCustomGroupSelections[groupId] = [];
        if (!window.activeCustomGroupSelections[groupId].includes(name)) {
            window.activeCustomGroupSelections[groupId].push(name);
        }
        window.renderGroupById(groupId);
    }
};

// ─── 그룹 관리 메뉴 (수정 모드 시) ───

// 새 커스텀 그룹 추가
window.promptAddGroup = () => {
    const title = prompt('새 그룹 이름을 입력하세요.');
    if (!title || !title.trim()) return;
    const g = window.addCustomGroup(title.trim());
    window.markDirty('master', 'groups', 'upsert');
    window.saveLocal('group-add');
    // 작업일지 모달 재렌더링
    if (window.renderAllWorkGroups) window.renderAllWorkGroups();
    alert(`"${g.title}" 그룹이 추가됐습니다.`);
};

// 그룹 비활성화/활성화
window.promptToggleGroup = (groupId) => {
    const g = window.getGroupById(groupId);
    if (!g) return;
    const builtIn = ['taskTypes', 'coworkers', 'statuses', 'equipments', 'memoTags'];
    const action = g.enabled ? '비활성화' : '활성화';
    if (!confirm(`"${g.title}" 그룹을 ${action}하시겠습니까?`)) return;
    window.toggleGroupEnabled(groupId);
    window.markDirty('master', 'groups', 'upsert');
    window.saveLocal('group-toggle');
    if (window.renderAllWorkGroups) window.renderAllWorkGroups();
};

// 그룹 삭제
window.promptRemoveGroup = (groupId) => {
    const g = window.getGroupById(groupId);
    if (!g) return;
    const builtIn = window.BUILT_IN_GROUP_IDS || ['taskTypes', 'coworkers', 'statuses', 'equipments', 'memoTags', 'duration'];
    if (builtIn.includes(groupId)) {
        return alert('기본 그룹은 삭제할 수 없습니다.\n비활성화 버튼을 사용해주세요.');
    }
    if (!confirm(`"${g.title}" 그룹을 삭제하시겠습니까?\n기존 기록에서 이 그룹 데이터는 orphan 상태로 남습니다.`)) return;
    window.removeGroup(groupId);
    window.markDirty('master', 'groups', 'upsert');
    window.saveLocal('group-delete');
    if (window.renderAllWorkGroups) window.renderAllWorkGroups();
};

// ─── 태그 선택 (메모태그 / 커스텀 그룹) ───
window.toggleTagSelection = (type, name) => {
    if (window.isWorkEditLocked) return;
    if (type !== 'memoTag') return;

    if (window.editingLogId &&
        window.editingLogId.startsWith('calc_commute_') &&
        name === '상세내역') return;

    if (window.activeEditTags.includes(name)) {
        window.activeEditTags = window.activeEditTags.filter(item => item !== name);
    } else {
        window.activeEditTags.push(name);
    }
    window.renderMemoTags();
};

window.toggleCustomGroupTag = (groupId, name) => {
    if (window.isWorkEditLocked) return;
    const g = window.getGroupById(groupId);
    if (!g) return;

    if (!window.activeCustomGroupSelections[groupId]) {
        window.activeCustomGroupSelections[groupId] = [];
    }

    const sel = window.activeCustomGroupSelections[groupId];
    if (g.selectionMode === 'single') {
        window.activeCustomGroupSelections[groupId] = sel.includes(name) ? [] : [name];
    } else {
        if (sel.includes(name)) {
            window.activeCustomGroupSelections[groupId] = sel.filter(n => n !== name);
        } else {
            sel.push(name);
        }
    }
    window.renderGroupById(groupId);
};

// ─── 태그 편집 박스 열기 ───
window.openTagEditBox = (type, index) => {
    if (window.isWorkEditLocked) return;
    const arr = window.getTagArray(type);
    const tag = arr && arr[index];
    if (!tag) return;

    window.editingTagType = type;
    window.editingTagIndex = index;

    const groupId = window.typeToGroupId(type);
    window.tempTagQty = groupId === 'equipments'
        ? Number(window.activeEquips[tag.name] || tag.count || 0)
        : Number(tag.count || 0);

    window.tempTagShowNumber = window.isTagNumberEnabled(tag);
    window.tempTagIncludeMonthly = window.isTagMonthlyEnabled(tag);

    document.getElementById('tagEditInput').value = tag.name;
    document.getElementById('tagQtyDisplay').innerText = window.tempTagQty;

    window.refreshTagToggleButtons();
    document.getElementById('tagEditModal').style.display = 'flex';

    setTimeout(() => {
        const input = document.getElementById('tagEditInput');
        input.focus();
        input.select();
    }, 100);
};