// work_service.js
// Firebase Storage 제거 버전
// JSON 백업/복원 + 이미지 압축 로컬 저장

window.startSync = async function () {
    try {
        console.log("서버 데이터 강제 동기화 시작...");
        const res = await fetch(`${WORK_API_BASE}/api/load`, {
            method: "GET",
            headers: { "Accept": "application/json" }
        });
        
        if (!res.ok) throw new Error("서버 응답 오류");
        
        const json = await res.json();
        // 서버 데이터 구조에 맞게 파싱
        const serverData = json.saved ? json.saved.data : json.data;
        
        if (serverData) {
            window.applyServerData(serverData, false); // false를 주면 서버 데이터로 로컬을 완전 덮어씁니다.
            console.log("동기화 성공! 서버 데이터가 로컬에 반영되었습니다.");
        }
    } catch (e) {
        console.error("동기화 실패:", e);
        // 서버 통신이 안 될 때만 로컬 데이터를 유지
        window.saveAllLocalOnly(); 
    }
    if (window.renderMain) window.renderMain();
}

window.exportBackupData = () => {
    if (!window.logs || window.logs.length === 0) {
        return alert("백업할 데이터가 없습니다.");
    }

    try {
        const exportData = JSON.stringify({
            app: "work",
            exportedAt: new Date().toISOString(),
            data: {
                logs: window.logs || [],
                trash: window.trash || [],
                taskTypes: window.taskTypes || [],
                coworkers: window.coworkers || [],
                statuses: window.statuses || [],
                equipments: window.equipments || [],
                memoTags: window.memoTags || []
            }
        });

        const blob = new Blob([exportData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `Work_Backup_${new Date().toISOString().split('T')[0]}.json`;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        URL.revokeObjectURL(url);
    } catch (e) {
        console.error(e);
        alert("백업 파일 생성 중 오류가 발생했습니다.");
    }
};

window.triggerImport = () => {
    const input = document.getElementById('importFile');

    if (!input) {
        alert("복원 파일 선택창(importFile)이 없습니다.");
        return;
    }

    if (confirm("🚨 기존 데이터가 백업 파일 내용으로 덮어쓰기 됩니다. 계속할까요?")) {
        input.click();
    }
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
            let text = e.target.result || "";

            if (text.charCodeAt(0) === 0xFEFF) {
                text = text.slice(1);
            }

            const importedData = JSON.parse(text);
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

            if (window.saveAllLocalOnly) {
                window.saveAllLocalOnly();
            } else {
                localStorage.setItem('wm_logs', JSON.stringify(window.logs));
                localStorage.setItem('wm_trash', JSON.stringify(window.trash));
                localStorage.setItem('wm_taskTypes', JSON.stringify(window.taskTypes));
                localStorage.setItem('wm_coworkers', JSON.stringify(window.coworkers));
                localStorage.setItem('wm_statuses', JSON.stringify(window.statuses));
                localStorage.setItem('wm_equipments', JSON.stringify(window.equipments));
                localStorage.setItem('wm_memoTags', JSON.stringify(window.memoTags));
            }

            if (window.markDirty) {
                window.markDirty("snapshot", "import", "replace");
            }

            if (window.scheduleSync) {
                window.scheduleSync();
            }

            if (window.recalculateTagCounts) {
                window.recalculateTagCounts();
            }

            if (window.refreshCurrentUI) {
                window.refreshCurrentUI();
            } else if (window.renderMain) {
                window.renderMain();
            }

            alert(`✅ 복원 성공!\n작업/메모 기록: ${window.logs.length}개`);
        } catch (err) {
            console.error(err);
            alert("❌ 복원 실패: JSON 파일을 읽을 수 없습니다.");
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

window.uploadToStorage = async (dataUrl) => {
    return dataUrl;
};

window.resizeImage = function (file, callback) {
    const reader = new FileReader();

    reader.onload = e => {
        const img = new Image();

        img.onload = () => {
            const canvas = document.createElement('canvas');

            let width = img.width;
            let height = img.height;

            const MAX_WIDTH = 1200;
            const MAX_HEIGHT = 1200;

            if (width > height) {
                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }
            } else {
                if (height > MAX_HEIGHT) {
                    width *= MAX_HEIGHT / height;
                    height = MAX_HEIGHT;
                }
            }

            canvas.width = Math.round(width);
            canvas.height = Math.round(height);

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            callback(canvas.toDataURL('image/jpeg', 0.75));
        };

        img.onerror = () => {
            alert("이미지 파일을 읽을 수 없습니다.");
            callback(null);
        };

        img.src = e.target.result;
    };

    reader.onerror = () => {
        alert("파일 읽기 실패");
        callback(null);
    };

    reader.readAsDataURL(file);
};

window.processFileExt = async function (file, callback) {
    const name = (file.name || "").toLowerCase();

    if (name.endsWith('.heic') || file.type === 'image/heic') {
        try {
            if (typeof heic2any !== 'undefined') {
                const convertedBlob = await heic2any({
                    blob: file,
                    toType: "image/jpeg"
                });

                const convertedFile = new File(
                    [convertedBlob],
                    name.replace(/\.heic$/i, '.jpg'),
                    { type: "image/jpeg" }
                );

                window.resizeImage(convertedFile, callback);
            } else {
                alert("HEIC 변환 라이브러리가 없습니다.");
                callback(null);
            }
        } catch (e) {
            console.error(e);
            alert("HEIC 변환 실패");
            callback(null);
        }

        return;
    }

    window.resizeImage(file, callback);
};

window.handleGeneralFiles = async (input) => {
    if (!input.files || input.files.length === 0) return;

    if (window.showLoading) {
        window.showLoading("사진 최적화 중...");
    }

    let done = 0;
    const files = Array.from(input.files);
    const total = files.length;

    if (!window.tempImgs) window.tempImgs = [];

    files.forEach(file => {
        window.processFileExt(file, (dataUrl) => {
            if (dataUrl) {
                window.tempImgs.push({
                    id: 'img_' + Date.now() + '_' + Math.random(),
                    src: dataUrl,
                    updatedAt: new Date().toISOString()
                });
            }

            done++;

            if (done === total) {
                if (window.renderTempImgs) {
                    window.renderTempImgs();
                }

                if (window.hideLoading) {
                    window.hideLoading();
                }
            }
        });
    });

    input.value = "";
};

window.handleWorkFiles = async (input) => {
    if (!input.files || input.files.length === 0) return;

    if (window.showLoading) {
        window.showLoading("사진 최적화 중...");
    }

    let done = 0;
    const files = Array.from(input.files);
    const total = files.length;

    if (!window.workImgs) window.workImgs = [];

    files.forEach(file => {
        window.processFileExt(file, (dataUrl) => {
            if (dataUrl) {
                window.workImgs.push({
                    id: 'w_' + Date.now() + '_' + Math.random(),
                    src: dataUrl,
                    updatedAt: new Date().toISOString()
                });
            }

            done++;

            if (done === total) {
                if (window.renderWorkPhotoGrid) {
                    window.renderWorkPhotoGrid();
                }

                if (window.hideLoading) {
                    window.hideLoading();
                }
            }
        });
    });

    input.value = "";
};

window.addFilesToEdit = async (input) => {
    const log = window.logs.find(l => l.id === window.editingLogId);

    if (!log) return;
    if (!input.files || input.files.length === 0) return;

    if (!log.imgs) log.imgs = [];

    if (window.showLoading) {
        window.showLoading("사진 최적화 중...");
    }

    let done = 0;
    const files = Array.from(input.files);
    const total = files.length;

    files.forEach(file => {
        window.processFileExt(file, (dataUrl) => {
            if (dataUrl) {
                log.imgs.push({
                    id: 'e_' + Date.now() + '_' + Math.random(),
                    src: dataUrl,
                    updatedAt: new Date().toISOString()
                });
            }

            done++;

            if (done === total) {
                log.updatedAt = new Date().toISOString();

                if (window.saveToLocalStore) {
                    window.saveToLocalStore('logs', log);
                } else if (window.saveLocal) {
                    window.saveLocal();
                }

                if (window.renderEditPhotoGrid) {
                    window.renderEditPhotoGrid();
                }

                if (window.hideLoading) {
                    window.hideLoading();
                }
            }
        });
    });

    input.value = "";
};

window.runStorageMigration = async () => {
    alert("Firebase Storage 마이그레이션은 제거되었습니다. 현재는 로컬 + Cloudflare KV 동기화 방식입니다.");
};