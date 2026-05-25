// === 기초 필수 함수 정의 ===
window.getDirtyMap = function () {
    try {
        return JSON.parse(localStorage.getItem("wm_dirty_map") || "{}");
    } catch (e) {
        return {};
    }
};

window.setDirtyMap = function (map) {
    localStorage.setItem("wm_dirty_map", JSON.stringify(map || {}));
};

window.clearDirtyMap = function () {
    localStorage.removeItem("wm_dirty_map");
};

// 🚨 [수정 완료] 중복 정의되어 충돌을 일으키던 startSync 함수를 제거하고 work_sync.js 로 일원화

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

// 🚨 [수정 4] 복원 직후 로컬 타임스탬프를 최신으로 강제 조작
window.importData = (event) => {
    const file = event.target.files[0];

    if (!file) return;

    if (window.showLoading) {
        window.showLoading("백업 파일 읽는 중...");
    }

    const reader = new FileReader();

    reader.onload = async (e) => {
        let data;

        try {
            let text = e.target.result || "";
            if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

            const importedData = JSON.parse(text.trim());

            data =
                importedData?.data ||
                importedData?.saved?.data ||
                importedData?.saved?.saved?.data ||
                importedData?.saved?.saved?.saved?.data ||
                importedData;

            if (!data || !Array.isArray(data.logs)) {
                alert("지원하지 않는 백업 파일입니다. logs 데이터를 찾을 수 없습니다.");
                return;
            }
        } catch (e) {
            console.error("백업 JSON 해석 실패:", e);
            alert("복원 실패: JSON 파일 형식을 읽을 수 없습니다.");
            return;
        }

        try {
            window.logs = (data.logs || []).filter(Boolean);
            window.trash = (data.trash || []).filter(Boolean);
            window.taskTypes = (data.taskTypes || window.taskTypes || []).filter(Boolean);
            window.coworkers = (data.coworkers || window.coworkers || []).filter(Boolean);
            window.statuses = (data.statuses || window.statuses || []).filter(Boolean);
            window.equipments = (data.equipments || window.equipments || []).filter(Boolean);
            window.memoTags = (data.memoTags || window.memoTags || []).filter(Boolean);

            window.saveAllLocalOnly();
            window.markDirty("snapshot", "import", "replace");
            
            // [핵심] 복원 즉시 로컬 동기화 스탬프를 최신 시간으로 강제 지정
            // 이 처리가 없으면 새로고침 시 과거 서버 데이터가 복원된 로컬 데이터를 증발시킵니다.
            if (window.setSyncStamp) {
                window.setSyncStamp(new Date().toISOString());
            }

            if (window.refreshCurrentUI) window.refreshCurrentUI();

            await window.syncNow(true);

            alert(`복원 성공!\n작업/메모 기록: ${window.logs.length}개\n서버에도 반영되었습니다.`);
        } catch (e) {
            console.error("복원 데이터 서버 반영 실패:", e);
            alert("파일은 이 기기에 복원되었습니다.\n하지만 서버 동기화에는 실패했습니다.\n\n" + e.message);
        } finally {
            if (window.hideLoading) window.hideLoading();
            event.target.value = "";
        }
    };

    reader.onerror = () => {
        if (window.hideLoading) window.hideLoading();
        alert("파일 읽기 실패");
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