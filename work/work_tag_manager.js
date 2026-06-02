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

setTimeout(() => {
    const style = document.createElement('style');

    style.textContent = `
        .drag-handle {
            left: 90% !important;
            bottom: 2px !important;
            width: 12px !important;
            height: 12px !important;
            overflow: visible !important;
            touch-action: none;
        }

        .drag-handle::before {
            content: "";
            position: absolute;
            left: 50%;
            top: 50%;
            width: 44px;
            height: 36px;
            transform: translate(-50%, -50%);
        }

        .drag-handle i {
            position: relative;
            z-index: 1;
            pointer-events: none;
        }

        .tag-toggle-off {
            opacity: .52;
            background: #e5e7eb !important;
            color: #64748b !important;
        }
    `;

    document.head.appendChild(style);

    const modal = document.getElementById('tagEditModal');

    modal.innerHTML = `
        <div class="modal-box w95-window" style="max-width:360px;">
            <div class="w95-titlebar">
                <span>항목 편집</span>
                <button type="button" class="w95-btn"
                    onclick="window.closeTagEditModal()">X</button>
            </div>

            <div style="padding:10px; background:var(--w-gray);">
                <div style="display:flex; align-items:center; gap:8px;">
                    <input type="text" id="tagEditInput"
                        class="m-input w95-in"
                        style="flex:1; min-width:0;">

                    <button type="button" class="w95-btn"
                        style="min-width:56px; color:var(--w-blue); font-weight:bold;"
                        onpointerdown="window.startTagSaveDeletePress(event)"
                        onpointerup="window.endTagSaveDeletePress(event)"
                        onpointercancel="window.cancelTagSaveDeletePress()"
                        onpointerleave="window.cancelTagSaveDeletePress()">저/삭</button>
                </div>

                <div style="display:flex; align-items:center; gap:4px; margin-top:10px;">
                    <button type="button" class="w95-btn icon-btn"
                        style="height:28px;"
                        onclick="window.changeTagQty(-1)">-</button>

                    <b id="tagQtyDisplay"
                        style="font-size:1.05rem; min-width:26px; text-align:center;">0</b>

                    <button type="button" class="w95-btn icon-btn"
                        style="height:28px;"
                        onclick="window.changeTagQty(1)">+</button>

                    <button type="button" id="tagNumberToggle"
                        class="w95-btn"
                        style="height:28px; margin-left:10px;"
                        onclick="window.toggleTagSetting('showNumber')">숫자</button>

                    <button type="button" id="tagMonthlyToggle"
                        class="w95-btn"
                        style="height:28px;"
                        onclick="window.toggleTagSetting('includeMonthly')">월별</button>
                </div>
            </div>
        </div>
    `;

    window.closeTagEditModal = () => {
        clearTimeout(window.tagSaveDeleteTimer);

        document.getElementById('tagEditModal').style.display = 'none';

        window.editingTagType = null;
        window.editingTagIndex = -1;
        window.tempTagQty = 0;
    };

    window.handleLongPress = (type, index) => {
        window.openTagEditBox(type, index);
    };

    window.handleClick = (type, index) => {
        const tag = window.getTagArray(type)[index];

        if(!tag) return;

        if(type === 'task') {
            const pos = window.activeTaskTypes.indexOf(tag.name);

            if(pos > -1) {
                window.activeTaskTypes.splice(pos, 1);
            } else {
                window.activeTaskTypes.push(tag.name);
            }

            window.renderTaskTypes();
        } else if(type === 'coworker') {
            const pos = window.selectedCoworkers.indexOf(tag.name);

            if(pos > -1) {
                window.selectedCoworkers.splice(pos, 1);
            } else {
                window.selectedCoworkers.push(tag.name);
            }

            window.renderCoworkers();
        } else if(type === 'status') {
            window.activeStatus =
                window.activeStatus === tag.name ? null : tag.name;

            window.renderStatuses();
        } else if(type === 'equip') {
            if(window.activeEquips[tag.name] > 0) {
                delete window.activeEquips[tag.name];
            } else {
                window.activeEquips[tag.name] = 1;
            }

            window.renderEquips();
        } else {
            window.toggleTagSelection('memoTag', tag.name);
        }
    };

    window.getTagPressEvents = (type, index) => `
        onmousedown="window.startPress(event, '${type}', ${index})"
        onmouseup="window.endPress(event, '${type}', ${index})"
        onmouseleave="window.cancelPress()"
        ontouchstart="window.startPress(event, '${type}', ${index})"
        ontouchend="window.endPress(event, '${type}', ${index})"
        ontouchcancel="window.cancelPress()"
        oncontextmenu="event.preventDefault(); window.openTagEditBox('${type}', ${index});"
    `;

    window.getTagLabel = (tag, count) => {
        return window.isTagNumberEnabled(tag)
            ? `[${Number(count || 0)}] ${tag.name}`
            : tag.name;
    };

    window.renderEquips = () => {
        let html = window.equipments.map((tag, index) => {
            const qty = Number(window.activeEquips[tag.name] || 0);

            return `
                <button type="button"
                    class="w95-btn ${qty > 0 ? 'active-btn' : ''}"
                    ${window.getTagPressEvents('equip', index)}>
                    ${window.getTagLabel(tag, qty)}
                </button>
            `;
        }).join(' ');

        html += `
            <button type="button" class="w95-btn"
                onclick="window.addNewType('equip')"><b>+</b></button>
        `;

        document.getElementById('equipArea').innerHTML = html;
    };

    window.renderTagGroup = (type, areaId, selected) => {
        const arr = window.getTagArray(type);

        arr.sort((a, b) =>
            Number(b.count || 0) - Number(a.count || 0));

        let html = arr.map((tag, index) => `
            <button type="button"
                class="w95-btn ${selected(tag.name) ? 'active-btn' : ''}"
                ${window.getTagPressEvents(type, index)}>
                ${window.getTagLabel(tag, tag.count)}
            </button>
        `).join(' ');

        html += `
            <button type="button" class="w95-btn"
                onclick="window.addNewType('${type}')"><b>+</b></button>
        `;

        document.getElementById(areaId).innerHTML = html;
    };

    window.renderTaskTypes = () => {
        window.renderTagGroup(
            'task',
            'taskTypeArea',
            name => window.activeTaskTypes.includes(name)
        );
    };

    window.renderCoworkers = () => {
        window.renderTagGroup(
            'coworker',
            'coworkerArea',
            name => window.selectedCoworkers.includes(name)
        );
    };

    window.renderStatuses = () => {
        window.renderTagGroup(
            'status',
            'statusArea',
            name => window.activeStatus === name
        );
    };

    window.renderMemoTags = () => {
        const area = document.getElementById('editTagArea');

        if(!area) return;

        window.renderTagGroup(
            'memoTag',
            'editTagArea',
            name => window.activeEditTags.includes(name)
        );
    };

    window.hasInitDragListeners = false;

    window.initWorkDragListeners = () => {
        if(window.hasInitDragListeners) return;

        const container = document.getElementById('workDragContainer');

        if(!container) return;

        let dragEl = null;
        let dragTimeout = null;

        const start = (event) => {
            const handle = event.target.closest('.drag-handle');

            if(!handle) return;

            const item = handle.closest('.drag-item');

            if(!item) return;

            if(event.cancelable) event.preventDefault();

            dragTimeout = setTimeout(() => {
                dragEl = item;
                dragEl.classList.add('dragging');

                if(navigator.vibrate) navigator.vibrate(30);
            }, 200);
        };

        const move = (event) => {
            if(!dragEl) {
                clearTimeout(dragTimeout);
                return;
            }

            if(event.cancelable) event.preventDefault();

            const point = event.touches ? event.touches[0] : event;

            const next = [
                ...container.querySelectorAll('.drag-item:not(.dragging)')
            ].find(item => {
                const rect = item.getBoundingClientRect();

                return point.clientY < rect.top + rect.height / 2;
            });

            if(next) {
                container.insertBefore(dragEl, next);
            } else {
                container.appendChild(dragEl);
            }
        };

        const end = () => {
            clearTimeout(dragTimeout);

            if(!dragEl) return;

            dragEl.classList.remove('dragging');
            dragEl = null;

            localStorage.setItem(
                'wm_work_drag_order',
                JSON.stringify([
                    ...container.querySelectorAll('.drag-item')
                ].map(item => item.dataset.id))
            );
        };

        container.addEventListener('touchstart', start, { passive: false });
        container.addEventListener('touchmove', move, { passive: false });
        container.addEventListener('touchend', end);
        container.addEventListener('touchcancel', end);
        container.addEventListener('mousedown', start);
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', end);

        window.hasInitDragListeners = true;
    };

    window.updateSearchFilters = (targetMonth = null) => {
        const logs = targetMonth
            ? window.logs.filter(log => log.m === targetMonth)
            : window.logs;

        const count = (type, name) => {
            return logs.filter(log => {
                if(type === 'task') {
                    return log.taskType &&
                        log.taskType.split(', ').includes(name);
                }

                if(type === 'manager') {
                    return log.coworkers &&
                        log.coworkers.includes(name);
                }

                if(type === 'status') {
                    return log.status === name;
                }

                if(type === 'equip') {
                    return log.equips &&
                        log.equips[name] !== undefined;
                }

                return log.tags && log.tags.includes(name);
            }).length;
        };

        const fill = (id, title, arr, type) => {
            const select = document.getElementById(id);

            if(!select) return;

            const value = select.value;

            select.innerHTML =
                `<option value="">[ ${title} ]</option>` +
                arr
                    .filter(window.isTagMonthlyEnabled)
                    .map(tag => `
                        <option value="${tag.name}"
                            ${tag.name === value ? 'selected' : ''}>
                            [${count(type, tag.name)}] ${tag.name}
                        </option>
                    `)
                    .join('');
        };

        fill('searchType', '작업유형', window.taskTypes, 'task');
        fill('searchManager', '매니저', window.coworkers, 'manager');
        fill('searchEquip', '장비', window.equipments, 'equip');
        fill('searchStatus', '상태', window.statuses, 'status');
        fill('searchMemoTag', '태그', window.memoTags, 'tag');
    };

    const originalRenderMain = window.renderMain;

    window.renderMain = () => {
        const originalLogs = window.logs;

        window.logs = originalLogs.map(log => {
            if(!log || log.cat !== 'work') return log;

            const copy = { ...log };

            if(copy.taskType) {
                copy.taskType = copy.taskType
                    .split(', ')
                    .filter(name => {
                        const tag = window.taskTypes
                            .find(item => item.name === name);

                        return window.isTagMonthlyEnabled(tag);
                    })
                    .join(', ');
            }

            if(copy.coworkers) {
                copy.coworkers = copy.coworkers
                    .filter(name => {
                        const tag = window.coworkers
                            .find(item => item.name === name);

                        return window.isTagMonthlyEnabled(tag);
                    });
            }

            if(copy.status) {
                const tag = window.statuses
                    .find(item => item.name === copy.status);

                if(!window.isTagMonthlyEnabled(tag)) {
                    copy.status = null;
                }
            }

            return copy;
        });

        try {
            originalRenderMain();
        } finally {
            window.logs = originalLogs;
        }
    };
}, 0);