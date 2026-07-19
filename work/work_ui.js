// work_ui.js

window.showLoading = (msg) => { document.getElementById('loadingText').innerText = msg; document.getElementById('loadingLayer').style.display = 'flex'; };
window.hideLoading = () => { document.getElementById('loadingLayer').style.display = 'none'; };

window.setCurDay = (d) => { window.curDay = d; window.renderCal(window.currentYear, window.curMonth - 1); };

window.setupSwipeGesture = () => {
    let _os_sX = 0, _os_sY = 0, _os_isSwipe = false, _os_sTime = 0;
    
    document.addEventListener('touchstart', e => {
        if(e.target.closest('.log-img-list') || e.target.closest('.photo-edit-grid') || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
        _os_sX = e.touches[0].clientX; _os_sY = e.touches[0].clientY; _os_sTime = Date.now(); _os_isSwipe = true;
    }, {passive: true});
    
    document.addEventListener('touchmove', e => {
        if(!_os_isSwipe) return;
        let dx = e.touches[0].clientX - _os_sX; let dy = e.touches[0].clientY - _os_sY;
        if(Math.abs(dy) > Math.abs(dx) * 1.5 || Math.abs(dy) > 50) _os_isSwipe = false; 
    }, {passive: true});
    
    document.addEventListener('touchend', e => {
        if(!_os_isSwipe) return;
        if (Date.now() - _os_sTime > 500) { _os_isSwipe = false; return; }
        let dx = e.changedTouches[0].clientX - _os_sX;
        
        if (Math.abs(dx) > 60) {
            const direction = dx < 0 ? 'next' : 'prev'; 
            if(window.parent && window.parent !== window) {
                window.parent.postMessage({ type: 'os_swipe', dir: direction === 'next' ? 'left' : 'right' }, '*');
                window.parent.postMessage({ type: 'swipe', direction: direction === 'next' ? 'left' : 'right' }, '*');
            } else { 
                if (direction === 'next') window.currentYear++; else window.currentYear--; window.renderMain(); 
            }
        }
        _os_isSwipe = false;
    }, {passive: true});
};

// 🚨 이동식 연두색 버튼 (오늘 날짜 이동) 복원 로직
window.setupFAB = () => {
    const fab = document.getElementById('fabToday');
    if (!fab) return;
    const fabPositionKey = 'wm_fab_today_position';

    // 작은 픽셀 로봇을 마스코트처럼 움직인다. 버튼을 다시 초기화해도 행동 타이머는 하나만 유지한다.
    const robot = fab.querySelector('.today-robot');
    if (robot && !fab.dataset.expressionTimerStarted) {
        fab.dataset.expressionTimerStarted = '1';
        const stateClasses = [
            'face-happy', 'face-surprised', 'face-sleepy', 'face-wink', 'face-cry',
            'action-walk', 'action-hop', 'action-spin', 'action-dance', 'action-sneak'
        ];
        const clearRobotState = () => robot.classList.remove(...stateClasses);
        const modalIsBusy = () => document.getElementById('workModal')?.style.display === 'flex'
            || document.getElementById('tagEditModal')?.style.display === 'flex';

        const runRobotAction = () => {
            if (document.hidden || fab.dataset.userTouching === '1' || modalIsBusy()) {
                window.setTimeout(runRobotAction, 3500);
                return;
            }

            clearRobotState();
            const actions = ['walk', 'happy', 'cry', 'hop', 'spin', 'dance', 'wink', 'sleepy', 'sneak'];
            const action = actions[Math.floor(Math.random() * actions.length)];
            let duration = 1800;

            if (action === 'walk' || action === 'sneak') {
                const rect = fab.getBoundingClientRect();
                const maxLeft = Math.max(4, window.innerWidth - fab.offsetWidth - 4);
                const maxTop = Math.max(4, window.innerHeight - fab.offsetHeight - 4);
                const range = action === 'walk' ? 110 : 65;
                const targetLeft = Math.min(maxLeft, Math.max(4, rect.left + (Math.random() * range * 2 - range)));
                const targetTop = Math.min(maxTop, Math.max(4, rect.top + (Math.random() * 50 - 25)));
                fab.style.right = 'auto';
                fab.style.bottom = 'auto';
                fab.style.left = `${rect.left}px`;
                fab.style.top = `${rect.top}px`;
                robot.classList.add(action === 'walk' ? 'action-walk' : 'action-sneak');
                duration = action === 'walk' ? 2700 : 3300;
                requestAnimationFrame(() => {
                    fab.style.transition = `left ${duration}ms steps(10,end), top ${duration}ms linear`;
                    fab.style.left = `${targetLeft}px`;
                    fab.style.top = `${targetTop}px`;
                });
            } else {
                const classMap = {
                    happy: 'face-happy', cry: 'face-cry', hop: 'action-hop', spin: 'action-spin',
                    dance: 'action-dance', wink: 'face-wink', sleepy: 'face-sleepy'
                };
                robot.classList.add(classMap[action]);
                if (action === 'happy') robot.classList.add('action-hop');
                duration = action === 'sleepy' ? 3200 : (action === 'cry' ? 2600 : 1900);
            }

            window.setTimeout(() => {
                clearRobotState();
                fab.style.transition = '0.2s';
                window.setTimeout(runRobotAction, 2200 + Math.floor(Math.random() * 4200));
            }, duration);
        };
        window.setTimeout(runRobotAction, 1400);
    }

    let isDragging = false;
    let isTouching = false;
    let isTodayLongPress = false;
    let todayPressTimer = null;

    let startX = 0;
    let startY = 0;
    let initialX = 0;
    let initialY = 0;

    try {
        const savedPosition = JSON.parse(localStorage.getItem(fabPositionKey) || 'null');
        if (
            savedPosition &&
            Number.isFinite(savedPosition.left) &&
            Number.isFinite(savedPosition.top)
        ) {
            const maxLeft = Math.max(0, window.innerWidth - fab.offsetWidth);
            const maxTop = Math.max(0, window.innerHeight - fab.offsetHeight);
            fab.style.left = `${Math.min(Math.max(0, savedPosition.left), maxLeft)}px`;
            fab.style.top = `${Math.min(Math.max(0, savedPosition.top), maxTop)}px`;
            fab.style.right = 'auto';
            fab.style.bottom = 'auto';
        }
    } catch (error) {
        localStorage.removeItem(fabPositionKey);
    }

    const clearTodayPressTimer = () => {
        clearTimeout(todayPressTimer);
        todayPressTimer = null;
    };

    const startPress = (clientX, clientY) => {
        fab.dataset.userTouching = '1';
        isDragging = false;
        isTouching = true;
        isTodayLongPress = false;

        startX = clientX;
        startY = clientY;
        initialX = fab.offsetLeft;
        initialY = fab.offsetTop;

        fab.style.transition = 'none';

        clearTodayPressTimer();

        todayPressTimer = setTimeout(() => {
            isTodayLongPress = true;

            if (navigator.vibrate) navigator.vibrate(50);
            if (window.forceSync) window.forceSync();
        }, 1500);
    };

    const movePress = (clientX, clientY, e) => {
        if (!isTouching) return;

        let dx = clientX - startX;
        let dy = clientY - startY;

        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
            isDragging = true;
            clearTodayPressTimer();
        }

        if (isDragging) {
            if (e && e.cancelable) e.preventDefault();

            fab.style.left = `${initialX + dx}px`;
            fab.style.top = `${initialY + dy}px`;
            fab.style.right = 'auto';
            fab.style.bottom = 'auto';
        }
    };

    const endPress = (e) => {
        clearTodayPressTimer();

        isTouching = false;
        fab.style.transition = '0.2s';

        if (!isDragging && !isTodayLongPress && (!e || e.type !== 'touchcancel')) {
            window.goToToday();
        } else if (isDragging) {
            localStorage.setItem(fabPositionKey, JSON.stringify({
                left: fab.offsetLeft,
                top: fab.offsetTop
            }));
        }

        setTimeout(() => {
            isDragging = false;
            isTodayLongPress = false;
            fab.dataset.userTouching = '0';
        }, 100);
    };

    fab.addEventListener('touchstart', e => {
        startPress(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });

    fab.addEventListener('touchmove', e => {
        movePress(e.touches[0].clientX, e.touches[0].clientY, e);
    }, { passive: false });

    fab.addEventListener('touchend', endPress);
    fab.addEventListener('touchcancel', endPress);

    fab.addEventListener('mousedown', e => {
        e.preventDefault();
        startPress(e.clientX, e.clientY);
    });

    document.addEventListener('mousemove', e => {
        movePress(e.clientX, e.clientY, e);
    });

    document.addEventListener('mouseup', e => {
        if (isTouching) endPress(e);
    });
};

window.startPress = (e, type, index) => {
    if (window.isWorkEditLocked) return;
    if(e) e.preventDefault(); window.isLongPress = false;
    window.pressTimer = setTimeout(() => { window.isLongPress = true; window.handleLongPress(type, index); }, 600);
};

window.endPress = (e, type, index) => {
    if (window.isWorkEditLocked) return;
    if(e) e.preventDefault(); clearTimeout(window.pressTimer);
    if (!window.isLongPress) { let now = Date.now(); if (now - window.lastClickTime < 300) return; window.lastClickTime = now; window.handleClick(type, index); }
    window.isLongPress = false;
};

window.cancelPress = () => { clearTimeout(window.pressTimer); window.isLongPress = false; };

window.handleLongPress = (type, index) => {
    if (window.isWorkEditLocked) return;
    window.editingTagType = type; window.editingTagIndex = index;
    let arr = type === 'task' ? window.taskTypes : (type === 'coworker' ? window.coworkers : (type === 'equip' ? window.equipments : window.statuses));
    let tagName = arr[index].name; 
    let inputEl = document.getElementById('tagEditInput');
    
    inputEl.value = tagName;
    if (type === 'equip') {
        document.getElementById('equipQtyContainer').style.display = 'flex'; window.tempEquipQty = window.activeEquips[tagName] || 0; document.getElementById('equipQtyDisplay').innerText = window.tempEquipQty;
    } else { document.getElementById('equipQtyContainer').style.display = 'none'; }
    
    document.getElementById('tagEditModal').style.display = 'flex';
    setTimeout(() => { inputEl.focus(); inputEl.select(); }, 100);
};

window.changeEquipQty = (delta) => { window.tempEquipQty = Math.max(0, window.tempEquipQty + delta); document.getElementById('equipQtyDisplay').innerText = window.tempEquipQty; };

window.handleClick = (type, index) => {
    if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) document.activeElement.blur();
    let arr = type === 'task' ? window.taskTypes : (type === 'coworker' ? window.coworkers : (type === 'equip' ? window.equipments : window.statuses));
    let item = arr[index];
    if (type === 'task') { const sIdx = window.activeTaskTypes.indexOf(item.name); if (sIdx > -1) window.activeTaskTypes.splice(sIdx, 1); else window.activeTaskTypes.push(item.name); window.renderTaskTypes(); } 
    else if (type === 'coworker') { const sIdx = window.selectedCoworkers.indexOf(item.name); if (sIdx > -1) window.selectedCoworkers.splice(sIdx, 1); else window.selectedCoworkers.push(item.name); window.renderCoworkers(); } 
    else if (type === 'status') { if (window.activeStatus === item.name) window.activeStatus = null; else window.activeStatus = item.name; window.renderStatuses(); } 
    else if (type === 'equip') { if (window.activeEquips[item.name] > 0) { window.activeEquips[item.name] = 0; delete window.activeEquips[item.name]; } else window.activeEquips[item.name] = 1; window.renderEquips(); }
};

window.startMapPress = (e) => { if(e) e.preventDefault(); window.mapPressTimer = Date.now(); };
window.endMapPress = (e) => {
    if(e) e.preventDefault(); let pressDuration = Date.now() - window.mapPressTimer; let now = Date.now();
    if(now - window.mapLastClickTime < 300) return; window.mapLastClickTime = now;
    if (pressDuration >= 600) { let defaultMap = localStorage.getItem('wm_default_map') || 'naver'; window.openSpecificMap(defaultMap); } else document.getElementById('mapAppModal').style.display = 'flex';
};
window.cancelMapPress = () => { window.mapPressTimer = 0; };

window.toggleMicFor = (e, inputId, btnId) => {
    if(e) e.preventDefault();
    if(window.isMicOn && window.activeInputId === inputId) window.stopMic();
    else { if(window.isMicOn) window.stopMic(); window.startMicFor(inputId, btnId); }
};

window.startMicFor = (inputId, btnId) => {
    if (!('webkitSpeechRecognition' in window)) return alert("해당 브라우저에서 음성 인식을 지원하지 않습니다.");
    if (window.globalRecognition) { try { window.globalRecognition.abort(); } catch(err){} }

    window.globalRecognition = new webkitSpeechRecognition();
    window.globalRecognition.lang = 'ko-KR'; window.globalRecognition.continuous = true; window.globalRecognition.interimResults = false; 

    window.globalRecognition.onresult = (evt) => {
        let finalTranscript = '';
        for (let i = evt.resultIndex; i < evt.results.length; ++i) { if (evt.results[i].isFinal) finalTranscript += evt.results[i][0].transcript + ' '; }
        if (finalTranscript.trim() !== '') { let targetInput = document.getElementById(inputId); targetInput.value = (targetInput.value + " " + finalTranscript).trim(); }
    };
    window.globalRecognition.onend = window.stopMicUI;
    // 예전엔 실패 이유를 그냥 버리고 조용히 꺼버려서, 마이크 버튼이 눌렀다가 바로 꺼지기만 하고
    // 왜 안 되는지 전혀 알 수 없었음(특히 마이크 권한이 막힌 경우가 흔한 원인) — 원인을 알려준다.
    window.globalRecognition.onerror = (evt) => {
        console.warn('음성 인식 오류:', evt && evt.error);
        if (evt && (evt.error === 'not-allowed' || evt.error === 'service-not-allowed')) {
            alert('마이크 권한이 없어 음성 인식을 시작할 수 없습니다. 브라우저(또는 이 화면을 띄운 앱)의 마이크 권한을 확인해주세요.');
        } else if (evt && evt.error && evt.error !== 'aborted' && evt.error !== 'no-speech') {
            alert('음성 인식 중 오류가 발생했습니다: ' + evt.error);
        }
        window.stopMicUI();
    };
    try {
        window.globalRecognition.start();
    } catch (err) {
        console.warn('음성 인식 시작 실패:', err);
        window.stopMicUI();
        return;
    }
    window.isMicOn = true; window.activeInputId = inputId; window.activeMicBtnId = btnId;
    let btn = document.getElementById(btnId); btn.classList.add('active-btn'); btn.style.color = 'var(--sun)';
};

window.stopMicUI = () => {
    window.isMicOn = false;
    if(window.activeMicBtnId) { let btn = document.getElementById(window.activeMicBtnId); if(btn) { btn.classList.remove('active-btn'); btn.style.color = ''; } }
    window.activeMicBtnId = null; window.activeInputId = null;
}
window.stopMic = () => { if(window.isMicOn && window.globalRecognition) window.globalRecognition.stop(); window.stopMicUI(); };

window.setupImageViewer = () => {
    const viewerImgArea = document.getElementById('viewerImgArea');
    const vImg = document.getElementById('viewerImg');
    if (!viewerImgArea || !vImg) return;

    let viewerScale = 1; let viewerPointX = 0; let viewerPointY = 0; let viewerPanning = false; let viewerStart = { x: 0, y: 0 }; let viewerDistance = 0;

    viewerImgArea.addEventListener('touchstart', e => {
        e.preventDefault();
        if (e.touches.length === 2) { viewerDistance = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); } 
        else if (e.touches.length === 1) { viewerPanning = true; viewerStart = { x: e.touches[0].clientX - viewerPointX, y: e.touches[0].clientY - viewerPointY }; }
    });

    viewerImgArea.addEventListener('touchmove', e => {
        e.preventDefault();
        if (e.touches.length === 2) {
            let dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
            viewerScale = Math.min(Math.max(1, viewerScale * (dist / viewerDistance)), 5); viewerDistance = dist;
            vImg.style.transform = `translate(${viewerPointX}px, ${viewerPointY}px) scale(${viewerScale})`;
        } else if (e.touches.length === 1 && viewerPanning) {
            viewerPointX = e.touches[0].clientX - viewerStart.x; viewerPointY = e.touches[0].clientY - viewerStart.y;
            vImg.style.transform = `translate(${viewerPointX}px, ${viewerPointY}px) scale(${viewerScale})`;
        }
    });

    viewerImgArea.addEventListener('touchend', e => {
        if (e.touches.length < 2) viewerDistance = 0;
        if (e.touches.length === 0) {
            viewerPanning = false;
            if (viewerScale === 1 && Math.abs(viewerPointX) > 60) {
                if (viewerPointX > 60) window.changeViewerImage(-1); else if (viewerPointX < -60) window.changeViewerImage(1);
                viewerPointX = 0; vImg.style.transform = `translate(0px, 0px) scale(1)`;
            }
        }
    });

    let lastTap = 0;
    viewerImgArea.addEventListener('touchend', e => {
        let currentTime = new Date().getTime(); let tapLength = currentTime - lastTap;
        if (tapLength < 300 && tapLength > 0 && e.touches.length === 0) { viewerScale = 1; viewerPointX = 0; viewerPointY = 0; vImg.style.transform = `translate(0px, 0px) scale(1)`; e.preventDefault(); }
        lastTap = currentTime;
    });
};
