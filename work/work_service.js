window.uploadToStorage = async (dataUrl) => {
    return dataUrl;
};

window.resizeImage = function(file, callback) {
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

            canvas.width = width;
            canvas.height = height;

            canvas.getContext('2d').drawImage(img, 0, 0, width, height);

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

window.processFileExt = async function(file, callback) {
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
        } catch(e) {
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

    if (window.showLoading) window.showLoading("사진 최적화 중...");

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
                if (window.renderTempImgs) window.renderTempImgs();
                if (window.hideLoading) window.hideLoading();
            }
        });
    });

    input.value = "";
};

window.handleWorkFiles = async (input) => {
    if (!input.files || input.files.length === 0) return;

    if (window.showLoading) window.showLoading("사진 최적화 중...");

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
                if (window.renderWorkPhotoGrid) window.renderWorkPhotoGrid();
                if (window.hideLoading) window.hideLoading();
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

    if (window.showLoading) window.showLoading("사진 최적화 중...");

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

                if (window.renderEditPhotoGrid) window.renderEditPhotoGrid();
                if (window.hideLoading) window.hideLoading();
            }
        });
    });

    input.value = "";
};

window.runStorageMigration = async () => {
    alert("Firebase Storage 마이그레이션은 제거되었습니다. 현재는 로컬 + Cloudflare KV 동기화 방식입니다.");
};