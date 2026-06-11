// work_tag_manager.js
window.tempTagQty = 0;
window.tempTagShowNumber = true;
window.tempTagIncludeMonthly = true;
window.tagSaveDeleteTimer = null;
window.tagSaveDeleteLongPressed = false;

window.getTagArray = (type) => {
    if(type === 'task') return window.taskTypes;
    if(type === 'coworker') return window.coworkers;
    if(type === 'equip') return window.equipments;
    if(type === 'memoTag') return window.memoTags;
    return window.statuses;
};

window.isTagNumberEnabled = (tag) => !tag || tag.showNumber !== false;
window.isTagMonthlyEnabled = (tag) => !tag || tag.includeMonthly !== false;

window.refreshTagToggleButtons = () => {
    const numberBtn = document.getElementById('tagNumberToggle');
    const monthlyBtn = document.getElementById('tagMonthlyToggle');
    if(numberBtn) numberBtn.classList.toggle('tag-toggle-off', !window.tempTagShowNumber);
    if(monthlyBtn) monthlyBtn.classList.toggle('tag-toggle-off', !window.tempTagIncludeMonthly);
};

window.toggleTagSetting = (key) => {
    if(key === 'showNumber') window.tempTagShowNumber = !window.tempTagShowNumber;
    if(key === 'includeMonthly') window.tempTagIncludeMonthly = !window.tempTagIncludeMonthly;
    window.refreshTagToggleButtons();
};

window.changeTagQty = (delta) => {
    window.tempTagQty = Math.max(0, Number(window.tempTagQty || 0) + delta);
    const display = document.getElementById('tagQtyDisplay');
    if(display) display.innerText = window.tempTagQty;
};

window.changeEquipQty = window.changeTagQty;

window.renameTagInRecords = (records, type, oldName, newName) => {
    (records || []).forEach(log => {
        if(type === 'task' && log.taskType) {
            log.taskType = log.taskType.split(', ')
                .map(name => name === oldName ? newName : name).join(', ');
        }
        if(type === 'coworker' && log.coworkers) {
            log.coworkers = log.coworkers
                .map(name => name === oldName ? newName : name);
        }
        if(type === 'status' && log.status === oldName) {
            log.status = newName;
        }
        if(type === 'memoTag' && log.tags) {
            log.tags = log.tags.map(name => name === oldName ? newName : name);
        }
        if(type === 'equip' && log.equips &&
            log.equips[oldName] !== undefined) {
            log.equips[newName] = log.equips[oldName];
            if(newName !== oldName) delete log.equips[oldName];
        }
    });
};

window.renderChangedTagType = (type) => {
    if(type === 'task') window.renderTaskTypes();
    else if(type === 'coworker') window.renderCoworkers();
    else if(type === 'equip') window.renderEquips();
    else if(type === 'memoTag') window.renderMemoTags();
    else window.renderStatuses();
};

window.saveTagEdit = () => {
    if(window.editingTagIndex === -1 || !window.editingTagType) return;

    const arr = window.getTagArray(window.editingTagType);
    const tag = arr[window.editingTagIndex];
    if(!tag) return;

    const oldName = tag.name;
    const newName = document.getElementById('tagEditInput').value.trim();
    if(!newName) return alert('이름을 입력하세요.');

    if(arr.some((item, index) =>
        index !== window.editingTagIndex && item.name === newName)) {
        return alert('같은 이름의 항목이 이미 있습니다.');
    }

    tag.name = newName;
    tag.count = Number(window.tempTagQty || 0);
    tag.showNumber = window.tempTagShowNumber;
    tag.includeMonthly = window.tempTagIncludeMonthly;

    if(newName !== oldName) {
        window.renameTagInRecords(
            window.logs, window.editingTagType, oldName, newName
        );
        window.renameTagInRecords(
            window.trash, window.editingTagType, oldName, newName
        );

        window.activeTaskTypes = window.activeTaskTypes
            .map(name => name === oldName ? newName : name);

        window.selectedCoworkers = window.selectedCoworkers
            .map(name => name === oldName ? newName : name);

        window.activeEditTags = window.activeEditTags
            .map(name => name === oldName ? newName : name);

        if(window.activeStatus === oldName) window.activeStatus = newName;

        if(window.activeEquips[oldName] !== undefined) {
            window.activeEquips[newName] = window.activeEquips[oldName];
            delete window.activeEquips[oldName];
        }
    }

    if(window.editingTagType === 'equip') {
        if(window.tempTagQty > 0) {
            window.activeEquips[newName] = window.tempTagQty;
        } else {
            delete window.activeEquips[newName];
        }
    }

    window.saveLocal('tag-edit');
    window.renderChangedTagType(window.editingTagType);
    window.closeTagEditModal();
};

window.deleteTagEdit = () => {
    if(window.editingTagIndex === -1 || !window.editingTagType) return;

    const arr = window.getTagArray(window.editingTagType);
    const tag = arr[window.editingTagIndex];
    if(!tag) return;

    const oldName = tag.name;
    arr.splice(window.editingTagIndex, 1);

    window.activeTaskTypes =
        window.activeTaskTypes.filter(name => name !== oldName);

    window.selectedCoworkers =
        window.selectedCoworkers.filter(name => name !== oldName);

    window.activeEditTags =
        window.activeEditTags.filter(name => name !== oldName);

    if(window.activeStatus === oldName) window.activeStatus = null;
    delete window.activeEquips[oldName];

    window.saveLocal('tag-delete');
    window.closeTagEditModal();
};

window.startTagSaveDeletePress = (event) => {
    if(event) event.preventDefault();

    clearTimeout(window.tagSaveDeleteTimer);
    window.tagSaveDeleteLongPressed = false;

    window.tagSaveDeleteTimer = setTimeout(() => {
        window.tagSaveDeleteLongPressed = true;
        if(navigator.vibrate) navigator.vibrate(40);
        window.deleteTagEdit();
    }, 3000);
};

window.endTagSaveDeletePress = (event) => {
    if(event) event.preventDefault();

    clearTimeout(window.tagSaveDeleteTimer);

    if(!window.tagSaveDeleteLongPressed) {
        window.saveTagEdit();
    }

    window.tagSaveDeleteLongPressed = false;
};

window.cancelTagSaveDeletePress = () => {
    clearTimeout(window.tagSaveDeleteTimer);
};

window.addNewType = (type) => {
    let title = type === 'task'
        ? '작업유형'
        : (type === 'coworker'
            ? '매니저'
            : (type === 'equip'
                ? '장비/기타'
                : (type === 'memoTag' ? '메모 태그' : '상태')));

    let name = prompt(`새로운 ${title}을 입력하세요.`);
    if(!name) return;

    name = name.trim();
    if(!name) return;

    const arr = window.getTagArray(type);

    if(!arr.find(tag => tag.name === name)) {
        arr.push({
            name,
            count: 0,
            showNumber: true,
            includeMonthly: true
        });

        window.saveLocal('tag-add');
    }

    if(type === 'coworker') {
        if(!window.selectedCoworkers.includes(name)) {
            window.selectedCoworkers.push(name);
        }
        window.renderCoworkers();
    } else if(type === 'task') {
        if(!window.activeTaskTypes.includes(name)) {
            window.activeTaskTypes.push(name);
        }
        window.renderTaskTypes();
    } else if(type === 'memoTag') {
        if(!window.activeEditTags.includes(name)) {
            window.activeEditTags.push(name);
        }
        window.renderMemoTags();
    } else if(type === 'equip') {
        window.activeEquips[name] = 1;
        window.renderEquips();
    } else {
        window.activeStatus = name;
        window.renderStatuses();
    }
};

window.toggleTagSelection = (type, name) => {
    if (window.isWorkEditLocked) return;
    if(type !== 'memoTag') return;

    if(window.editingLogId &&
        window.editingLogId.startsWith('calc_commute_') &&
        name === '상세내역') {
        return;
    }

    if(window.activeEditTags.includes(name)) {
        window.activeEditTags =
            window.activeEditTags.filter(item => item !== name);
    } else {
        window.activeEditTags.push(name);
    }

    window.renderMemoTags();
};

window.openTagEditBox = (type, index) => {
    if (window.isWorkEditLocked) return;
    const arr = window.getTagArray(type);
    const tag = arr && arr[index];

    if(!tag) return;

    window.editingTagType = type;
    window.editingTagIndex = index;

    window.tempTagQty = type === 'equip'
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

