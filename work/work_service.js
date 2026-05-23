// work_service.js 전체 코드 (덮어쓰기용)

window.exportBackupData = () => {
    if (!window.logs || window.logs.length === 0) return alert("백업할 데이터가 없습니다.");
    try {
        const exportData = JSON.stringify({ 
            logs: window.logs, 
            trash: window.trash || [], 
            taskTypes: window.taskTypes || [], 
            coworkers: window.coworkers || [], 
            statuses: window.statuses || [], 
            equipments: window.equipments || [], 
            memoTags: window.memoTags || [] 
        });
        const blob = new Blob([exportData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a'); link.href = url; link.download = `Work_Backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
    } catch(e) { alert("백업 파일 생성 중 오류가 발생했습니다."); }
};

// 🔥 백업 복원 버튼 실행
window.triggerImport = () => {

    const input = document.getElementById('importFile');

    if (!input) {
        alert("❌ importFile 요소를 찾을 수 없습니다.");
        return;
    }

    const ok = confirm(
        "🚨 기존 데이터가 백업 파일 내용으로 덮어쓰기 됩니다.\n\n계속하시겠습니까?"
    );

    if (!ok) return;

    input.click();
};


// 🔥 JSON / TXT 복원
window.importData = (event) => {

    const file = event.target.files[0];

    if (!file) return;

    if (window.showLoading) {
        window.showLoading("백업 파일 읽는 중...");
    }

    const reader = new FileReader();

    reader.onload = (e) => {

        try {

            let text = e.target.result;

            // UTF BOM 제거
            if (text.charCodeAt(0) === 0xFEFF) {
                text = text.slice(1);
            }

            const importedData = JSON.parse(text);

            // data 래핑 대응
            const data = importedData.data
                ? importedData.data
                : importedData;

            // logs 체크
            if (!data || !Array.isArray(data.logs)) {

                if (window.hideLoading) {
                    window.hideLoading();
                }

                alert("❌ 지원하지 않는 백업 파일 형식입니다.");
                return;
            }

            // 🔥 데이터 복원
            window.logs = (data.logs || []).filter(Boolean);

            window.trash =
                (data.trash || []).filter(Boolean);

            window.taskTypes =
                (data.taskTypes || []).filter(Boolean);

            window.coworkers =
                (data.coworkers || []).filter(Boolean);

            window.statuses =
                (data.statuses || []).filter(Boolean);

            window.equipments =
                (data.equipments || []).filter(Boolean);

            window.memoTags =
                (data.memoTags || []).filter(Boolean);


            // 🔥 로컬 저장
            localStorage.setItem(
                'wm_logs',
                JSON.stringify(window.logs)
            );

            localStorage.setItem(
                'wm_trash',
                JSON.stringify(window.trash)
            );

            localStorage.setItem(
                'wm_taskTypes',
                JSON.stringify(window.taskTypes)
            );

            localStorage.setItem(
                'wm_coworkers',
                JSON.stringify(window.coworkers)
            );

            localStorage.setItem(
                'wm_statuses',
                JSON.stringify(window.statuses)
            );

            localStorage.setItem(
                'wm_equipments',
                JSON.stringify(window.equipments)
            );

            localStorage.setItem(
                'wm_memoTags',
                JSON.stringify(window.memoTags)
            );


            // 🔥 UI 새로고침
            if (window.refreshCurrentUI) {

                window.refreshCurrentUI();

            } else {

                if (window.renderMain) {
                    window.renderMain();
                }

                if (window.updateUI) {
                    window.updateUI();
                }
            }

            if (window.hideLoading) {
                window.hideLoading();
            }

            alert(
                `✅ 복원 성공!\n\n총 ${window.logs.length}개의 기록이 복원되었습니다.`
            );

        } catch (err) {

            console.error(err);

            if (window.hideLoading) {
                window.hideLoading();
            }

            alert(
                "❌ JSON 파일 읽기 실패\n\n" +
                "파일이 손상되었거나 형식이 올바르지 않습니다."
            );
        }

        event.target.value = "";
    };


    // 🔥 읽기 실패
    reader.onerror = () => {

        if (window.hideLoading) {
            window.hideLoading();
        }

        alert("❌ 파일 읽기 실패");

        event.target.value = "";
    };


    // 🔥 UTF-8 읽기
    reader.readAsText(file, "UTF-8");
};

window.importData = (event) => {
    const file = event.target.files[0];

    if (!file) return;

    if (window.showLoading) {
        window.showLoading("백업 파일 읽는 중...");
    }

    const reader = new FileReader();

    reader.onload = (e) => {
        try {
            const importedData = JSON.parse(e.target.result);

            const data = importedData.data
                ? importedData.data
                : importedData;

            if (!data || !Array.isArray(data.logs)) {
                alert("❌ 지원하지 않는 백업 파일입니다.");
                return;
            }

            window.logs = (data.logs || []).filter(Boolean);
            window.trash = (data.trash || []).filter(Boolean);
            window.taskTypes = (data.taskTypes || []).filter(Boolean);
            window.coworkers = (data.coworkers || []).filter(Boolean);
            window.statuses = (data.statuses || []).filter(Boolean);
            window.equipments = (data.equipments || []).filter(Boolean);
            window.memoTags = (data.memoTags || []).filter(Boolean);

            localStorage.setItem('wm_logs', JSON.stringify(window.logs));
            localStorage.setItem('wm_trash', JSON.stringify(window.trash));
            localStorage.setItem('wm_taskTypes', JSON.stringify(window.taskTypes));
            localStorage.setItem('wm_coworkers', JSON.stringify(window.coworkers));
            localStorage.setItem('wm_statuses', JSON.stringify(window.statuses));
            localStorage.setItem('wm_equipments', JSON.stringify(window.equipments));
            localStorage.setItem('wm_memoTags', JSON.stringify(window.memoTags));

            if (window.refreshCurrentUI) {
                window.refreshCurrentUI();
            } else if (window.renderMain) {
                window.renderMain();
            }

            alert(`✅ 복원 성공!\n기록 수: ${window.logs.length}개`);

        } catch (err) {
            console.error(err);
            alert("❌ JSON 파일 읽기 실패");
        } finally {
            if (window.hideLoading) {
                window.hideLoading();
            }

            event.target.value = "";
        }
    };

    reader.onerror = () => {
        if (window.hideLoading) {
            window.hideLoading();
        }

        alert("❌ 파일 읽기 실패");
        event.target.value = "";
    };

    reader.readAsText(file, "UTF-8");
};

window.importData = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (window.showLoading) window.showLoading("백업 파일 읽는 중...");

    const reader = new FileReader();

    reader.onload = (e) => {
        try {
            const importedData = JSON.parse(e.target.result);

            const data = importedData.data ? importedData.data : importedData;

            if (!data || !Array.isArray(data.logs)) {
                alert("❌ 지원하지 않는 백업 파일입니다.");
                return;
            }

            window.logs = (data.logs || []).filter(Boolean);
            window.trash = (data.trash || []).filter(Boolean);
            window.taskTypes = (data.taskTypes || window.taskTypes || []).filter(Boolean);
            window.coworkers = (data.coworkers || window.coworkers || []).filter(Boolean);
            window.statuses = (data.statuses || window.statuses || []).filter(Boolean);
            window.equipments = (data.equipments || window.equipments || []).filter(Boolean);
            window.memoTags = (data.memoTags || window.memoTags || []).filter(Boolean);

            if (window.saveLocal) window.saveLocal();
            else {
                localStorage.setItem('wm_logs', JSON.stringify(window.logs));
                localStorage.setItem('wm_trash', JSON.stringify(window.trash));
                localStorage.setItem('wm_taskTypes', JSON.stringify(window.taskTypes));
                localStorage.setItem('wm_coworkers', JSON.stringify(window.coworkers));
                localStorage.setItem('wm_statuses', JSON.stringify(window.statuses));
                localStorage.setItem('wm_equipments', JSON.stringify(window.equipments));
                localStorage.setItem('wm_memoTags', JSON.stringify(window.memoTags));
            }

            if (window.recalculateTagCounts) window.recalculateTagCounts();
            if (window.refreshCurrentUI) window.refreshCurrentUI();
            else if (window.renderMain) window.renderMain();

            alert(`✅ 복원 성공!\n작업/메모 기록: ${window.logs.length}개`);
        } catch (err) {
            console.error(err);
            alert("❌ 복원 실패: JSON 파일을 읽을 수 없습니다.");
        } finally {
            if (window.hideLoading) window.hideLoading();
            event.target.value = "";
        }
    };

    reader.onerror = () => {
        if (window.hideLoading) window.hideLoading();
        alert("❌ 파일 읽기 실패");
        event.target.value = "";
    };

    reader.readAsText(file, "UTF-8");
};
window.triggerImport = () => { if(confirm("🚨 [주의] 기존 데이터가 삭제되고 덮어쓰기 복원이 진행됩니다. 계속하시겠습니까?")) document.getElementById('importFile').click(); };

window.importData = (event) => {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const importedData = JSON.parse(e.target.result);
            if (importedData && importedData.logs) {
                window.logs = importedData.logs.filter(Boolean);
                window.trash = (importedData.trash || []).filter(Boolean);
                window.taskTypes = (importedData.taskTypes || window.taskTypes).filter(Boolean);
                window.coworkers = (importedData.coworkers || window.coworkers).filter(Boolean);
                window.statuses = (importedData.statuses || window.statuses).filter(Boolean);
                window.equipments = (importedData.equipments || window.equipments).filter(Boolean);
                if(window.saveLocal) window.saveLocal(); 
                alert("✅ 데이터 복원 성공!");
            } else alert("❌ 지원하지 않는 파일 형식입니다.");
        } catch(err) { alert("❌ 파일을 읽는 중 오류 발생"); }
    };
    reader.readAsText(file); event.target.value = ""; 
};

// 🌟 스토리지 업로드 핵심 함수
window.uploadToStorage = async (dataUrl) => {
    if(!window.uid || typeof firebase === 'undefined' || !firebase.storage) return dataUrl; 
    try {
        const storageRef = firebase.storage().ref();
        const fileName = `WorkMaster_Images/${window.uid}/img_${Date.now()}_${Math.floor(Math.random()*1000)}.jpg`;
        const fileRef = storageRef.child(fileName);

        const res = await fetch(dataUrl);
        const blob = await res.blob();

        await fileRef.put(blob);
        return await fileRef.getDownloadURL();
    } catch (error) {
        console.error("스토리지 업로드 실패:", error);
        return dataUrl; 
    }
};

window.resizeImage = function(file, callback) {
    const reader = new FileReader();
    reader.onload = e => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width; let height = img.height;
            const MAX_WIDTH = 1200; const MAX_HEIGHT = 1200; 
            if (width > height) { if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; } } 
            else { if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; } }
            canvas.width = width; canvas.height = height;
            canvas.getContext('2d').drawImage(img, 0, 0, width, height);
            callback(canvas.toDataURL('image/jpeg', 0.8)); 
        }
        img.src = e.target.result;
    }
    reader.readAsDataURL(file);
};

window.processFileExt = async function(file, callback) {
    if (file.name.toLowerCase().endsWith('.heic') || file.type === 'image/heic') {
        try {
            if(typeof heic2any !== 'undefined') {
                const convertedBlob = await heic2any({ blob: file, toType: "image/jpeg" });
                const convertedFile = new File([convertedBlob], file.name.replace(/\.heic$/i, '.jpg'), { type: "image/jpeg" });
                window.resizeImage(convertedFile, callback);
            } else {
                alert("HEIC 변환 라이브러리가 없습니다."); callback(null);
            }
        } catch(e) { alert("HEIC 변환 실패."); callback(null); }
    } else {
        window.resizeImage(file, callback);
    }
};

window.handleGeneralFiles = async (input) => {
    if(input.files.length === 0) return;
    if(window.showLoading) window.showLoading("스토리지에 사진 최적화 및 저장 중...");
    let pCount = 0; const tot = input.files.length;
    if(!window.tempImgs) window.tempImgs = [];
    Array.from(input.files).forEach(f => {
        window.processFileExt(f, async (dataUrl) => {
            if(dataUrl) {
                const storageUrl = await window.uploadToStorage(dataUrl);
                window.tempImgs.push({id: 'img_' + Date.now() + Math.random(), src: storageUrl});
            }
            pCount++; 
            if(pCount === tot) { 
                if(window.renderTempImgs) window.renderTempImgs(); 
                if(window.hideLoading) window.hideLoading(); 
            }
        });
    });
    input.value = ""; 
};

window.handleWorkFiles = async (input) => {
    if(input.files.length === 0) return;
    if(window.showLoading) window.showLoading("스토리지에 사진 최적화 및 저장 중...");
    let pCount = 0; const tot = input.files.length;
    if(!window.workImgs) window.workImgs = [];
    Array.from(input.files).forEach(f => {
        window.processFileExt(f, async (dataUrl) => {
            if(dataUrl) {
                const storageUrl = await window.uploadToStorage(dataUrl);
                window.workImgs.push({id: 'w_'+Date.now()+Math.random(), src: storageUrl});
            }
            pCount++;
            if(pCount === tot) { 
                if(window.renderWorkPhotoGrid) window.renderWorkPhotoGrid(); 
                if(window.hideLoading) window.hideLoading(); 
            }
        });
    });
    input.value = "";
};

window.addFilesToEdit = async (input) => { 
    if(!window.logs) return;
    const log = window.logs.find(l => l.id === window.editingLogId); 
    if(!log) return;
    if(!log.imgs) log.imgs = []; 
    if(input.files.length === 0) return;
    if(window.showLoading) window.showLoading("스토리지에 사진 최적화 및 저장 중...");
    let pCount = 0; const tot = input.files.length;
    Array.from(input.files).forEach(f => { 
        window.processFileExt(f, async (dataUrl) => { 
            if(dataUrl) {
                const storageUrl = await window.uploadToStorage(dataUrl);
                log.imgs.push({id: 'e_'+Date.now()+Math.random(), src: storageUrl}); 
            }
            pCount++;
            if(pCount === tot) { 
                if(window.saveToLocalStore) window.saveToLocalStore('logs', log); 
                if(window.renderEditPhotoGrid) window.renderEditPhotoGrid(); 
                if(window.hideLoading) window.hideLoading(); 
            }
        }); 
    }); 
    input.value = "";
};

// 🚀 마이그레이션 실행 도구
window.runStorageMigration = async () => {
    if(!window.uid) return alert("로그인 상태에서만 실행할 수 있습니다.");
    if(!window.logs) return alert("데이터가 아직 로드되지 않았습니다.");
    if(!confirm("기존의 무거운 사진들을 파이어베이스 스토리지로 이전합니다. 계속하시겠습니까?")) return;
    
    let targetLogs = window.logs.filter(l => l.imgs && l.imgs.some(img => img.src && img.src.startsWith('data:image')));
    
    if(targetLogs.length === 0) {
        alert("이전할 데이터가 없습니다. 이미 모두 스토리지에 있습니다!");
        return;
    }
    
    if(window.showLoading) window.showLoading(`최적화 시작 (총 ${targetLogs.length}건 대기 중)...`);
    
    for (let i = 0; i < targetLogs.length; i++) {
        let log = targetLogs[i];
        if(window.showLoading) window.showLoading(`사진 이전 중... (${i+1} / ${targetLogs.length})`);
        
        let isUpdated = false;
        for (let j = 0; j < log.imgs.length; j++) {
            if (log.imgs[j].src && log.imgs[j].src.startsWith('data:image')) {
                try {
                    const newUrl = await window.uploadToStorage(log.imgs[j].src);
                    log.imgs[j].src = newUrl; 
                    isUpdated = true;
                } catch(e) { console.error("업로드 실패:", e); }
            }
        }
        if (isUpdated && window.saveToLocalStore) window.saveToLocalStore('logs', log);
    }
    if (window.saveLocal) window.saveLocal();
    alert("마이그레이션 완료! 데이터베이스가 최적화되었습니다.");
    if(window.hideLoading) window.hideLoading();
};

// 💡 화면 구석에 임시 실행 버튼 만들기 (콘솔창 입력 안 해도 됨)
setTimeout(() => {
    const btn = document.createElement('button');
    btn.innerText = "🚀 스토리지 최적화 실행 (클릭)";
    btn.style.cssText = "position:fixed; bottom:20px; left:20px; z-index:99999; padding:15px; background-color:#ef4444; color:white; font-weight:bold; border:none; border-radius:8px; cursor:pointer; box-shadow: 0 4px 6px rgba(0,0,0,0.3);";
    btn.onclick = () => {
        window.runStorageMigration();
        btn.style.display = 'none'; // 한 번 누르면 사라집니다
    };
    document.body.appendChild(btn);
}, 2000);