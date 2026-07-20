// work_service.js
// Work Master - ZIP backup, restore and R2 helpers

const WORK_BACKUP_API_BASE = "https://work.sentig335.workers.dev";

window.syncPaused = false;
window.pendingRestoreFailures = [];
window.lastBackupFailures = [];

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

window.showBackupProgress = function (text) {
  if (window.showLoading) {
    window.showLoading(text);
  }
};

window.hideBackupProgress = function () {
  if (window.hideLoading) {
    window.hideLoading();
  }
};

window.formatBackupDate = function () {
  const now = new Date();

  const date =
    `${now.getFullYear()}-` +
    `${String(now.getMonth() + 1).padStart(2, "0")}-` +
    `${String(now.getDate()).padStart(2, "0")}`;

  const time =
    `${String(now.getHours()).padStart(2, "0")}` +
    `${String(now.getMinutes()).padStart(2, "0")}`;

  return `${date}_${time}`;
};

window.safeBackupName = function (value) {
  return String(value || "unknown")
    .replace(/[\\/:*?"<>|#%&{}$!'@+=`~]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 90);
};

window.getImageExtensionFromBlob = function (blob) {
  const type = String(blob?.type || "").toLowerCase();

  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "image/gif") return "gif";

  return "jpg";
};

window.loadJSZip = async function () {
  if (window.JSZip) {
    return window.JSZip;
  }

  await new Promise((resolve, reject) => {
    const existing = document.getElementById("workMasterJSZip");

    if (existing) {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = "workMasterJSZip";
    script.src =
      "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";

    script.onload = resolve;
    script.onerror = () =>
      reject(new Error("ZIP 라이브러리를 불러오지 못했습니다."));

    document.head.appendChild(script);
  });

  if (!window.JSZip) {
    throw new Error("ZIP 라이브러리를 사용할 수 없습니다.");
  }

  return window.JSZip;
};

window.downloadBlob = async function (blob, fileName) {
  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: fileName,
        types: [
          {
            description: "Work Master backup",
            accept: {
              "application/zip": [".zip"],
              "text/plain": [".txt"],
            },
          },
        ],
      });

      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (e) {
      if (e.name === "AbortError") return;
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
};

window.downloadTextLog = async function (title, lines) {
  const text = [
    `[${title}]`,
    `생성 시간: ${new Date().toLocaleString("ko-KR")}`,
    "",
    ...lines,
  ].join("\n");

  const blob = new Blob([text], {
    type: "text/plain;charset=utf-8",
  });

  await window.downloadBlob(
    blob,
    `WorkMaster_${window.safeBackupName(title)}_${window.formatBackupDate()}.txt`
  );
};

window.getMasterBackupData = function () {
  return {
    groups: window.groups || [],
    // v1 하위 호환 (구버전 복원 파일과의 호환을 위해 유지)
    taskTypes: window.taskTypes || [],
    coworkers: window.coworkers || [],
    statuses: window.statuses || [],
    equipments: window.equipments || [],
    memoTags: window.memoTags || [],
  };
};

window.getSelectedBackupLogs = function () {
  const mode = document.getElementById("backupScope").value;
  const year = Number(document.getElementById("backupYear").value);
  const month = Number(document.getElementById("backupMonth").value);

  if (mode === "all") {
    return (window.logs || []).filter(Boolean);
  }

  if (mode === "year") {
    return (window.logs || []).filter(
      (log) => Number(log.y) === year
    );
  }

  return (window.logs || []).filter(
    (log) =>
      Number(log.y) === year &&
      Number(log.m) === month
  );
};

window.getBackupScopeLabel = function () {
  const mode = document.getElementById("backupScope").value;
  const year = document.getElementById("backupYear").value;
  const month = document.getElementById("backupMonth").value;

  if (mode === "all") return "ALL";
  if (mode === "year") return year;

  return `${year}-${String(month).padStart(2, "0")}`;
};

window.createImageBackupPath = function (log, image, blob) {
  const date =
    `${log.y || "unknown"}-` +
    `${String(log.m || "00").padStart(2, "0")}-` +
    `${String(log.d || "00").padStart(2, "0")}`;

  const category = window.safeBackupName(log.cat || "log");
  const logId = window.safeBackupName(log.id || "log");
  const imageId = window.safeBackupName(image.id || "image");
  const extension = window.getImageExtensionFromBlob(blob);

  return `images/${date}_${category}_${logId}_${imageId}.${extension}`;
};

window.fetchBackupImage = async function (src) {
  const response = await fetch(src);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return await response.blob();
};

window.startZipBackup = async function () {
  const logs = window.getSelectedBackupLogs();

  if (logs.length === 0) {
    alert("선택한 범위에 백업할 기록이 없습니다.");
    return;
  }

  window.syncPaused = true;
  window.lastBackupFailures = [];

  try {
    const JSZip = await window.loadJSZip();
    const zip = new JSZip();
    const clonedLogs = JSON.parse(JSON.stringify(logs));
    const sourceEntries = new Map();

    for (const log of clonedLogs) {
      for (const image of log.imgs || []) {
        if (!image?.src) continue;

        if (!sourceEntries.has(image.src)) {
          sourceEntries.set(image.src, {
            sourceUrl: image.src,
            log,
            image,
          });
        }
      }
    }

    const entries = Array.from(sourceEntries.values());
    const manifest = [];

    for (let index = 0; index < entries.length; index++) {
      const entry = entries[index];

      window.showBackupProgress(
        `전체백업 중... 사진 ${index + 1} / ${entries.length}`
      );

      try {
        const blob = await window.fetchBackupImage(entry.sourceUrl);
        const zipPath = window.createImageBackupPath(
          entry.log,
          entry.image,
          blob
        );

        zip.file(zipPath, blob);

        manifest.push({
          sourceUrl: entry.sourceUrl,
          zipPath,
          originalName: entry.image.originalName || zipPath.split("/").pop() || "",
          logId: entry.log.id,
          imageId: entry.image.id,
          date: `${entry.log.y}-${entry.log.m}-${entry.log.d}`,
          category: entry.log.cat || "log",
          size: blob.size,
          contentType: blob.type || "application/octet-stream",
        });
      } catch (e) {
        window.lastBackupFailures.push({
          sourceUrl: entry.sourceUrl,
          originalName: entry.image.originalName || "",
          logId: entry.log.id,
          imageId: entry.image.id,
          date: `${entry.log.y}-${entry.log.m}-${entry.log.d}`,
          category: entry.log.cat || "log",
          error: e.message,
        });
      }
    }

    const scope = window.getBackupScopeLabel();

    const backup = {
      schemaVersion: 1,
      app: "work_master",
      exportedAt: new Date().toISOString(),
      syncUpdatedAt: window.getSyncStamp
        ? window.getSyncStamp()
        : null,
      backupScope: scope,
      counts: {
        logs: clonedLogs.length,
        photoReferences: entries.length,
        includedPhotos: manifest.length,
        failedPhotos: window.lastBackupFailures.length,
      },
      images: manifest,
      failures: window.lastBackupFailures,
      data: {
        logs: clonedLogs,
        ...window.getMasterBackupData(),
      },
    };

    const logLines = [
      `백업 범위: ${scope}`,
      `활성 기록: ${clonedLogs.length}`,
      `사진 참조: ${entries.length}`,
      `사진 포함 성공: ${manifest.length}`,
      `사진 누락: ${window.lastBackupFailures.length}`,
      "",
      "[사진 누락 목록]",
      ...window.lastBackupFailures.map(
        (failure, index) =>
          `${index + 1}. 날짜=${failure.date}, 종류=${failure.category}, ` +
          `카드ID=${failure.logId}, 사진ID=${failure.imageId}, ` +
          `URL=${failure.sourceUrl}, 오류=${failure.error}`
      ),
    ];

    zip.file("backup.json", JSON.stringify(backup, null, 2));
    zip.file("backup_log.txt", logLines.join("\n"));

    window.showBackupProgress("ZIP 파일 생성 중...");

    const blob = await zip.generateAsync({
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: {
        level: 6,
      },
    });

    await window.downloadBlob(
      blob,
      `WorkMaster_Backup_${scope}_${window.formatBackupDate()}.zip`
    );

    window.closeBackupDialog();

    alert(
      `ZIP 백업 완료\n\n` +
      `기록: ${clonedLogs.length}개\n` +
      `사진 성공: ${manifest.length}개\n` +
      `사진 누락: ${window.lastBackupFailures.length}개`
    );

    if (
      window.lastBackupFailures.length > 0 &&
      confirm("누락 사진 목록을 TXT 파일로 내려받으시겠습니까?")
    ) {
      await window.downloadTextLog("BackupLog", logLines);
    }
  } catch (e) {
    console.error("ZIP 백업 실패:", e);
    alert("ZIP 백업 실패: " + e.message);
  } finally {
    window.syncPaused = false;
    window.hideBackupProgress();

    if (window.hasDirtyChanges && window.hasDirtyChanges()) {
      window.scheduleSync();
    }
  }
};

window.uploadBackupBlob = async function (blob, originalName = "") {
  const response = await fetch(
    `${WORK_BACKUP_API_BASE}/api/upload`,
    {
      method: "POST",
      headers: {
        "Content-Type": blob.type || "image/jpeg",
        "X-Original-Name": encodeURIComponent(originalName || ""),
      },
      body: blob,
    }
  );

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} / ${text}`);
  }

  const result = text ? JSON.parse(text) : {};

  if (!result.ok || !result.url) {
    throw new Error("사진 업로드 URL이 없습니다.");
  }

  return result.url;
};

window.mergeMasterList = function (localList, backupList) {
  const map = new Map();

  for (const item of localList || []) {
    if (item?.name) map.set(item.name, item);
  }

  for (const item of backupList || []) {
    if (item?.name) map.set(item.name, item);
  }

  return Array.from(map.values());
};

window.mergeMasterGroups = function (localGroups, backupGroups) {
  const merged = (localGroups || []).filter(Boolean).map((g) => ({ ...g }));
  const byId = new Map(merged.map((g) => [g.id, g]));

  for (const incoming of (backupGroups || []).filter(Boolean)) {
    const existing = byId.get(incoming.id);

    if (!existing) {
      const clone = { ...incoming };
      merged.push(clone);
      byId.set(clone.id, clone);
    } else {
      existing.tags = window.mergeMasterList(existing.tags, incoming.tags);
    }
  }

  return merged;
};

window.applyRestoredData = function (data, mode) {
  const incomingLogs = (data.logs || []).filter(Boolean);
  const hasGroups = Array.isArray(data.groups) && data.groups.length > 0;

  if (mode === "replace") {
    window.logs = incomingLogs;

    if (hasGroups) {
      window.groups = data.groups.filter(Boolean);
    } else {
      // v1 백업(구버전) 호환: groups가 없으면 개별 필드로 복원
      window.taskTypes = data.taskTypes || window.taskTypes || [];
      window.coworkers = data.coworkers || window.coworkers || [];
      window.statuses = data.statuses || window.statuses || [];
      window.equipments = data.equipments || window.equipments || [];
      window.memoTags = data.memoTags || window.memoTags || [];
    }
  } else {
    const logMap = new Map();

    for (const log of window.logs || []) {
      if (log?.id) logMap.set(String(log.id), log);
    }

    for (const log of incomingLogs) {
      if (log?.id) logMap.set(String(log.id), log);
    }

    window.logs = Array.from(logMap.values());

    if (hasGroups) {
      window.groups = window.mergeMasterGroups(window.groups, data.groups);
    } else {
      // v1 백업(구버전) 호환: groups가 없으면 개별 필드로 병합
      window.taskTypes = window.mergeMasterList(
        window.taskTypes,
        data.taskTypes
      );

      window.coworkers = window.mergeMasterList(
        window.coworkers,
        data.coworkers
      );

      window.statuses = window.mergeMasterList(
        window.statuses,
        data.statuses
      );

      window.equipments = window.mergeMasterList(
        window.equipments,
        data.equipments
      );

      window.memoTags = window.mergeMasterList(
        window.memoTags,
        data.memoTags
      );
    }
  }

  const activeIds = new Set(
    (window.logs || []).map((log) => String(log.id))
  );

  const beforeCount = (window.trash || []).length;

  window.trash = (window.trash || []).filter(
    (log) => !activeIds.has(String(log.id))
  );

  return beforeCount - window.trash.length;
};

window.persistRestoredData = async function () {
  window.saveAllLocalOnly();
  window.markDirty("snapshot", "restore", "replace");

  const result = await window.saveFullSnapshot();

  if (result?.savedAt) {
    window.setSyncStamp(result.savedAt);
  }

  window.clearDirtyMap();
  window.refreshCurrentUI();
};

window.retryRestoreFailures = async function () {
  const retryable = window.pendingRestoreFailures.filter(
    (failure) => failure.blob
  );

  if (retryable.length === 0) {
    alert("다시 업로드할 수 있는 사진이 없습니다.");
    return;
  }

  const remaining = [];

  for (let index = 0; index < retryable.length; index++) {
    const failure = retryable[index];

    window.showBackupProgress(
      `실패 사진 재시도 중... ${index + 1} / ${retryable.length}`
    );

    try {
      const retryName = failure.originalName || String(failure.zipPath || "").split("/").pop() || "";
      const url = await window.uploadBackupBlob(failure.blob, retryName);

      for (const log of window.logs || []) {
        for (const image of log.imgs || []) {
          if (image.src === failure.sourceUrl) {
            image.src = url;
          }
        }
      }
    } catch (e) {
      remaining.push({
        ...failure,
        error: e.message,
      });
    }
  }

  window.pendingRestoreFailures = remaining;

  try {
    await window.persistRestoredData();
  } finally {
    window.hideBackupProgress();
  }

  alert(
    `재시도 완료\n\n` +
    `남은 실패 사진: ${remaining.length}개`
  );
};

window.createRestoreLogLines = function (failures, conflictCount) {
  return [
    `사진 복원 실패: ${failures.length}`,
    `휴지통 충돌 정리: ${conflictCount}`,
    "",
    "[사진 복원 실패 목록]",
    ...failures.map(
      (failure, index) =>
        `${index + 1}. ZIP파일=${failure.zipPath || "없음"}, ` +
        `카드ID=${failure.logId || "없음"}, ` +
        `사진ID=${failure.imageId || "없음"}, ` +
        `기존URL=${failure.sourceUrl || "없음"}, ` +
        `오류=${failure.error}`
    ),
  ];
};

window.restoreZipFile = async function (file) {
  const JSZip = await window.loadJSZip();
  const zip = await JSZip.loadAsync(file);
  const backupEntry = zip.file("backup.json");

  if (!backupEntry) {
    throw new Error("ZIP 내부에 backup.json이 없습니다.");
  }

  const backup = JSON.parse(await backupEntry.async("string"));

  if (!backup?.data || !Array.isArray(backup.data.logs)) {
    throw new Error("backup.json에서 logs 데이터를 찾을 수 없습니다.");
  }

  const mergeMode = confirm(
    `ZIP 백업을 불러옵니다.\n\n` +
    `범위: ${backup.backupScope || "알 수 없음"}\n` +
    `기록: ${backup.data.logs.length}개\n` +
    `사진: ${(backup.images || []).length}개\n\n` +
    `확인: 병합 복원\n취소: 전체 교체 선택`
  );

  let mode = "merge";

  if (!mergeMode) {
    const replaceConfirmed = confirm(
      "현재 활성 기록을 ZIP 내용으로 교체하시겠습니까?\n\n" +
      "휴지통은 유지됩니다.\n" +
      "월별 ZIP이라면 다른 월 기록이 사라질 수 있습니다."
    );

    if (!replaceConfirmed) return;

    mode = "replace";
  }

  const urlMap = new Map();
  const originalNameMap = new Map();
  const failures = [];
  const images = backup.images || [];

  for (let index = 0; index < images.length; index++) {
    const imageInfo = images[index];

    window.showBackupProgress(
      `ZIP 사진 복원 중... ${index + 1} / ${images.length}`
    );

    const imageEntry = zip.file(imageInfo.zipPath);

    if (!imageEntry) {
      failures.push({
        ...imageInfo,
        error: "ZIP 내부 사진 파일 누락",
      });

      continue;
    }

    const blob = await imageEntry.async("blob");

    try {
      const restoreName = imageInfo.originalName || String(imageInfo.zipPath || "").split("/").pop() || "";
      const newUrl = await window.uploadBackupBlob(blob, restoreName);
      urlMap.set(imageInfo.sourceUrl, newUrl);
      originalNameMap.set(imageInfo.sourceUrl, restoreName);
    } catch (e) {
      failures.push({
        ...imageInfo,
        blob,
        error: e.message,
      });
    }
  }

  const restoredData = JSON.parse(JSON.stringify(backup.data));

  for (const log of restoredData.logs || []) {
    for (const image of log.imgs || []) {
      if (urlMap.has(image.src)) {
        if (!image.originalName) image.originalName = originalNameMap.get(image.src) || "";
        image.src = urlMap.get(image.src);
      }
    }
  }

  const conflictCount = window.applyRestoredData(restoredData, mode);

  window.pendingRestoreFailures = failures;

  await window.persistRestoredData();

  const logLines = window.createRestoreLogLines(
    failures,
    conflictCount
  );

  alert(
    `ZIP 복원 완료\n\n` +
    `기록: ${restoredData.logs.length}개\n` +
    `사진 업로드 성공: ${images.length - failures.length}개\n` +
    `사진 업로드 실패: ${failures.length}개\n` +
    `휴지통 충돌 정리: ${conflictCount}개`
  );

  if (
    failures.some((failure) => failure.blob) &&
    confirm("실패한 사진만 다시 업로드하시겠습니까?")
  ) {
    await window.retryRestoreFailures();
  }

  if (
    window.pendingRestoreFailures.length > 0 &&
    confirm("남은 실패 사진 목록을 TXT 파일로 내려받으시겠습니까?")
  ) {
    await window.downloadTextLog("RestoreLog", logLines);
  }
};

window.extractLegacyData = function (imported) {
  return (
    imported?.data ||
    imported?.saved?.data ||
    imported?.saved?.saved?.data ||
    imported?.saved?.saved?.saved?.data ||
    imported
  );
};

window.restoreJsonFile = async function (file) {
  const text = await file.text();
  const imported = JSON.parse(text.replace(/^\uFEFF/, "").trim());
  const data = window.extractLegacyData(imported);

  if (!data || !Array.isArray(data.logs)) {
    throw new Error("JSON 파일에서 logs 데이터를 찾을 수 없습니다.");
  }

  const mergeMode = confirm(
    `JSON 백업을 불러옵니다.\n\n` +
    `기록: ${data.logs.length}개\n\n` +
    `확인: 병합 복원\n취소: 전체 교체 선택`
  );

  let mode = "merge";

  if (!mergeMode) {
    const replaceConfirmed = confirm(
      "현재 활성 기록을 JSON 내용으로 교체하시겠습니까?\n\n" +
      "휴지통은 유지됩니다."
    );

    if (!replaceConfirmed) return;

    mode = "replace";
  }

  const conflictCount = window.applyRestoredData(data, mode);

  await window.persistRestoredData();

  alert(
    `JSON 복원 완료\n\n` +
    `기록: ${data.logs.length}개\n` +
    `휴지통 충돌 정리: ${conflictCount}개`
  );
};

window.triggerImport = function () {
  const input = document.getElementById("importFile");

  if (!input) {
    alert("복원 파일 선택창을 찾을 수 없습니다.");
    return;
  }

  input.accept = ".zip,.json,application/zip,application/json";
  input.value = "";
  input.click();
};

window.importData = async function (event) {
  const file = event.target.files?.[0];

  if (!file) return;

  window.syncPaused = true;
  window.showBackupProgress("복원 파일 확인 중...");

  try {
    const lowerName = file.name.toLowerCase();

    if (lowerName.endsWith(".zip")) {
      await window.restoreZipFile(file);
    } else if (lowerName.endsWith(".json")) {
      await window.restoreJsonFile(file);
    } else {
      throw new Error("ZIP 또는 JSON 파일만 선택할 수 있습니다.");
    }
  } catch (e) {
    console.error("복원 실패:", e);
    alert("복원 실패: " + e.message);
  } finally {
    window.syncPaused = false;
    window.hideBackupProgress();
    event.target.value = "";

    if (window.hasDirtyChanges && window.hasDirtyChanges()) {
      window.scheduleSync();
    }
  }
};

window.exportBackupData = function () {
  window.openBackupDialog();
};

window.uploadFileToR2 = async function (blob, originalName = "") {
  return await window.uploadBackupBlob(blob, originalName);
};

window.resizeImage = function (file, callback) {
  const reader = new FileReader();

  reader.onload = (event) => {
    const image = new Image();

    image.onload = () => {
      const canvas = document.createElement("canvas");
      const maxWidth = 1200;
      const maxHeight = 1200;

      let width = image.width;
      let height = image.height;

      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(
          maxWidth / width,
          maxHeight / height
        );

        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0, width, height);

      canvas.toBlob(
        async (blob) => {
          try {
            const url = await window.uploadFileToR2(blob);
            callback(url);
          } catch (e) {
            console.error("사진 업로드 실패:", e);
            alert("사진 업로드 실패");
            callback(null);
          }
        },
        "image/jpeg",
        0.75
      );
    };

    image.onerror = () => {
      alert("이미지 파일을 읽을 수 없습니다.");
      callback(null);
    };

    image.src = event.target.result;
  };

  reader.onerror = () => {
    alert("파일 읽기 실패");
    callback(null);
  };

  reader.readAsDataURL(file);
};

window.processFileExt = async function (file, callback) {
  const name = String(file.name || "").toLowerCase();

  if (name.endsWith(".heic") || file.type === "image/heic") {
    try {
      if (typeof heic2any === "undefined") {
        throw new Error("HEIC 변환 라이브러리가 없습니다.");
      }

      const convertedBlob = await heic2any({
        blob: file,
        toType: "image/jpeg",
      });

      const convertedFile = new File(
        [convertedBlob],
        name.replace(/\.heic$/i, ".jpg"),
        {
          type: "image/jpeg",
        }
      );

      window.resizeImage(convertedFile, callback);
    } catch (e) {
      console.error(e);
      alert("HEIC 변환 실패");
      callback(null);
    }

    return;
  }

  window.resizeImage(file, callback);
};

window.updateBackupScopeControls = function () {
  const scope = document.getElementById("backupScope").value;
  const year = document.getElementById("backupYear");
  const month = document.getElementById("backupMonth");

  year.disabled = scope === "all";
  month.disabled = scope !== "month";
};

window.openBackupDialog = function () {
  document.getElementById("backupDialog").style.display = "flex";
  document.getElementById("backupYear").value = window.currentYear;
  document.getElementById("backupMonth").value = window.curMonth;
  document.getElementById("backupScope").value = "month";
  window.updateBackupScopeControls();
};

window.closeBackupDialog = function () {
  document.getElementById("backupDialog").style.display = "none";
};

window.installBackupUI = function () {
  const toolbar = document.querySelector(".header-right-tools");
  const importButton = toolbar?.querySelector(
    'button[onclick*="triggerImport"]'
  );

  if (toolbar && importButton && !document.getElementById("zipBackupBtn")) {
    const button = document.createElement("button");

    button.type = "button";
    button.id = "zipBackupBtn";
    button.className = "w95-btn icon-btn";
    button.title = "선택형 ZIP 백업";
    button.onclick = window.openBackupDialog;

    button.innerHTML =
      '<i class="fa-solid fa-file-arrow-down" style="color:#2563eb;"></i>';

    toolbar.insertBefore(button, importButton);
  }

  if (!document.getElementById("backupDialog")) {
    const dialog = document.createElement("div");

    dialog.id = "backupDialog";
    dialog.className = "modal-overlay";
    dialog.style.display = "none";
    dialog.style.zIndex = "5000";

    dialog.innerHTML = `
      <div class="modal-box w95-window" style="max-width:320px;">
        <div class="w95-titlebar">
          <span>ZIP 백업</span>
          <button type="button" class="w95-btn" onclick="window.closeBackupDialog()">X</button>
        </div>
        <div style="padding:10px; display:flex; flex-direction:column; gap:8px;">
          <label>
            범위
            <select id="backupScope" class="m-input w95-in" onchange="window.updateBackupScopeControls()">
              <option value="all">전체</option>
              <option value="year">연도별</option>
              <option value="month" selected>월별</option>
            </select>
          </label>
          <label>
            연도
            <input id="backupYear" class="m-input w95-in" type="number" min="2000" max="2100">
          </label>
          <label>
            월
            <select id="backupMonth" class="m-input w95-in">
              ${Array.from({ length: 12 }, (_, index) =>
                `<option value="${index + 1}">${index + 1}월</option>`
              ).join("")}
            </select>
          </label>
          <div style="font-size:0.8rem; color:#475569;">
            휴지통은 포함하지 않습니다. 사진은 ZIP 내부 images 폴더에 저장합니다.
          </div>
          <div style="display:flex; gap:6px; justify-content:flex-end;">
            <button type="button" class="w95-btn" onclick="window.closeBackupDialog()">취소</button>
            <button type="button" class="w95-btn" onclick="window.startZipBackup()">백업 시작</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(dialog);
  }

  const input = document.getElementById("importFile");

  if (input) {
    input.accept = ".zip,.json,application/zip,application/json";
  }
};

window.installTrashSafety = function () {
  window.clearTrash = function () {
    if (!confirm("휴지통을 모두 비우시겠습니까? 복원할 수 없습니다.")) {
      return;
    }

    const ids = (window.trash || []).map((item) => item.id);

    window.trash = [];

    for (const id of ids) {
      window.markDirty("trash", id, "delete");
    }

    window.saveAllLocalOnly();
    window.scheduleSync();

    if (window.renderTrash) {
      window.renderTrash();
    }
  };

  window.restoreLog = function (id) {
    const log = (window.trash || []).find(
      (item) => String(item.id) === String(id)
    );

    if (!log) return;

    window.deleteFromLocalStore("trash", id);
    window.saveToLocalStore("logs", log);

    if (window.renderTrash) {
      window.renderTrash();
    }

    alert("항목이 복원되었습니다.");
  };
};

window.installSyncPauseGuard = function () {
  if (!window.scheduleSync || window.syncPauseGuardInstalled) {
    return;
  }

  window.syncPauseGuardInstalled = true;

  const originalScheduleSync = window.scheduleSync;
  const originalPullRemoteChanges = window.pullRemoteChanges;

  window.scheduleSync = function (...args) {
    if (window.syncPaused) return;
    return originalScheduleSync.apply(this, args);
  };

  if (originalPullRemoteChanges) {
    window.pullRemoteChanges = function (...args) {
      if (window.syncPaused) return Promise.resolve(false);
      return originalPullRemoteChanges.apply(this, args);
    };
  }
};

window.installWorkServiceEnhancements = function () {
  window.installBackupUI();
  window.installTrashSafety();
  window.installSyncPauseGuard();
};

window.addEventListener("load", () => {
  setTimeout(window.installWorkServiceEnhancements, 0);
});
