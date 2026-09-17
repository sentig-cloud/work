// work_utils.js

// Task 번호를 4자리씩 띄어 표시(예: 123456789012 -> "1234 5678 9012"). 저장값 자체는 안 건드리고
// 화면 표시에만 쓴다 — 검색/내보내기는 원래 값을 그대로 써야 하기 때문.
window.formatTaskNo = (taskNo) => {
    const str = String(taskNo == null ? '' : taskNo).trim();
    if (!str) return '';
    return str.replace(/(.{4})(?=.)/g, '$1 ');
};

// 작업일지 입력창에서 타이핑하는 동안에도 4자리씩 실시간으로 띄어준다(숫자만 남기고 재포맷).
// 저장 시점(work_logic.js)에서는 공백을 다시 제거해 저장값은 계속 순수 숫자로 유지한다.
window.formatTaskNoInput = (input) => {
    const caretFromEnd = input.value.length - (input.selectionEnd ?? input.value.length);
    const digits = input.value.replace(/[^0-9]/g, '');
    input.value = window.formatTaskNo(digits);
    const pos = Math.max(0, input.value.length - caretFromEnd);
    if (input.setSelectionRange) input.setSelectionRange(pos, pos);
};

// ─── 초성 검색: "ㄱㄴ" 같은 초성만으로도 "강남" 같은 텍스트를 찾을 수 있게 ───
const CHOSUNG_LIST = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
window.extractChosung = (str) => {
    let result = '';
    for (const ch of String(str == null ? '' : str)) {
        const code = ch.charCodeAt(0);
        result += (code >= 0xAC00 && code <= 0xD7A3) ? CHOSUNG_LIST[Math.floor((code - 0xAC00) / 588)] : ch;
    }
    return result;
};
window.isChosungOnly = (str) => {
    const s = String(str == null ? '' : str).trim();
    return s.length > 0 && [...s].every(ch => CHOSUNG_LIST.includes(ch) || ch === ' ');
};

// 탭(클릭)과 별개로 롱프레스를 인식시키는 공용 헬퍼. 롱프레스가 발동하면 그 뒤에 이어지는
// click 이벤트를 한 번 눌러서 기존 탭 동작(예: 날짜 이동)이 같이 실행되지 않게 막는다.
window.attachLongPress = (el, onLongPress, opts = {}) => {
    if (!el) return;
    const threshold = opts.threshold || 550;
    const slop = opts.slop || 10;
    let timer = null, startX = 0, startY = 0, suppressClick = false;
    const clearTimer = () => { if (timer) { clearTimeout(timer); timer = null; } };
    el.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        if (opts.ignoreSelector && e.target.closest(opts.ignoreSelector)) return;
        startX = e.clientX; startY = e.clientY;
        clearTimer();
        timer = setTimeout(() => {
            timer = null;
            suppressClick = true;
            onLongPress(e);
        }, threshold);
    });
    el.addEventListener('pointermove', (e) => {
        if (!timer) return;
        if (Math.abs(e.clientX - startX) > slop || Math.abs(e.clientY - startY) > slop) clearTimer();
    });
    el.addEventListener('pointerup', clearTimer);
    el.addEventListener('pointercancel', clearTimer);
    el.addEventListener('click', (e) => {
        if (suppressClick) {
            suppressClick = false;
            e.stopPropagation();
            e.preventDefault();
        }
    }, true);
};

// 두 좌표 사이의 직선거리(km) — 동선 요약용 (Haversine 공식)
window.haversineKm = (lat1, lng1, lat2, lng2) => {
    const toRad = deg => deg * Math.PI / 180;
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

window.getCurrentTimeString = () => {
    let now = new Date(); 
    return String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0'); 
};

window.handleTimeInput = (input) => {
    let val = input.value.replace(/[^0-9]/g, ''); 
    if (val.length >= 4) {
        val = val.slice(0, 4);
        let h = Math.min(23, parseInt(val.slice(0, 2) || 0)).toString().padStart(2, '0');
        let m = Math.min(59, parseInt(val.slice(2, 4) || 0)).toString().padStart(2, '0');
        input.value = `${h}:${m}`;
    } else {
        input.value = val; 
    }
};

window.formatTimeInput = (input) => {
    let val = input.value.replace(/[^0-9]/g, ''); 
    if (!val) return;
    if(val.length > 4) val = val.slice(0, 4);
    
    let h = '00', m = '00';
    if(val.length === 1 || val.length === 2) { h = val.padStart(2, '0'); } 
    else if(val.length === 3) { h = '0' + val.slice(0, 1); m = val.slice(1, 3); } 
    else if(val.length === 4) { h = val.slice(0, 2); m = val.slice(2, 4); }
    
    h = Math.min(23, parseInt(h)).toString().padStart(2,'0');
    m = Math.min(59, parseInt(m)).toString().padStart(2,'0');
    input.value = `${h}:${m}`;
};

// 거리(km) 입력창에 천 단위 콤마를 실시간으로 붙여준다 (예: 12345 -> 12,345)
window.formatKmInput = (input) => {
    const caretFromEnd = input.value.length - (input.selectionEnd ?? input.value.length);
    let digits = input.value.replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '');
    input.value = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const pos = Math.max(0, input.value.length - caretFromEnd);
    if (input.setSelectionRange) input.setSelectionRange(pos, pos);
};

// 분(minute) 단위 총시간을 "H:MM" 문자열로 변환 (작업일지 시작/종료 총시간용)
window.formatDurationMin = (min) => {
    const total = Math.max(0, Number(min) || 0);
    const h = Math.floor(total / 60);
    const m = total % 60;
    return `${h}:${String(m).padStart(2, '0')}`;
};