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