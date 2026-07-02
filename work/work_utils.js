// work_utils.js
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

window.formatOTInput = (input) => {
    // OT 입력칸도 시간과 완전히 동일한 자동 변환(1430 -> 14:30) 적용 완료
    window.formatTimeInput(input);
};

// 분(minute) 단위 총시간을 "H:MM" 문자열로 변환 (작업일지 시작/종료 총시간용)
window.formatDurationMin = (min) => {
    const total = Math.max(0, Number(min) || 0);
    const h = Math.floor(total / 60);
    const m = total % 60;
    return `${h}:${String(m).padStart(2, '0')}`;
};