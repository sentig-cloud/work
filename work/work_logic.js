// work_logic.js

window.onload = () => {
    window.renderMain();
    window.setupSwipeGesture();

    if (window.setupImageViewer) {
        window.setupImageViewer();
    }

    if (window.setupFAB) {
        window.setupFAB();
    }

    let lastFocusId = null;

    document.body.addEventListener("focusin", (e) => {
        if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
            if (lastFocusId !== e.target) {
                setTimeout(() => {
                    e.target.select();
                }, 50);

                lastFocusId = e.target;
            }
        }
    });

    document.body.addEventListener("focusout", (e) => {
        if (e.target === lastFocusId) {
            lastFocusId = null;
        }
    });
};

window.syncPressTimer = null;
window.isSyncLongPress = false;

window.startSyncPress = () => {
    window.isSyncLongPress = false;
    clearTimeout(window.syncPressTimer);

    window.syncPressTimer = setTimeout(() => {
        window.isSyncLongPress = true;

        if (navigator.vibrate) {
            navigator.vibrate(50);
        }

        if (window.forceSync) {
            window.forceSync();
        }
    }, 3000);
};

window.endSyncPress = () => {
    clearTimeout(window.syncPressTimer);
};

window.cancelSyncPress = () => {
    clearTimeout(window.syncPressTimer);
};

window.goToToday = async () => {
    if (window.syncFromServerIfSafe) {
        if (window.showLoading) {
            window.showLoading("최신 데이터 확인 중...");
        }

        await window.syncFromServerIfSafe("today");

        if (window.hideLoading) {
            window.hideLoading();
        }
    }

    const now = new Date();

    window.currentYear = now.getFullYear();
    window.openPop(now.getMonth() + 1);
    window.setCurDay(now.getDate());
};

window.toggleLogOx = (id) => {
    const log = window.logs.find((item) => item.id === id);

    if (!log) {
        return;
    }

    if (log.personalCheck === "O") {
        log.personalCheck = "X";
    } else if (log.personalCheck === "X") {
        log.personalCheck = null;
    } else {
        log.personalCheck = "O";
    }

    window.saveToLocalStore("logs", log);

    if (window.updateUI) {
        window.updateUI();
    }
};

window.openSpecificMap = (appType) => {
    const address = document.getElementById("workAddress").value.trim();

    if (!address) {
        alert("주소를 입력해주세요.");
        return;
    }

    localStorage.setItem("wm_default_map", appType);
    window.closeMapAppModal();

    const encodedAddress = encodeURIComponent(address);
    let url = "";
    let fallbackUrl = "";

    if (appType === "tmap") {
        url = `tmap://search?name=${encodedAddress}`;
    } else if (appType === "naver") {
        url = `nmap://search?query=${encodedAddress}&appname=workmaster`;
    } else if (appType === "kakaomap") {
        url = `kakaomap://search?q=${encodedAddress}`;
        fallbackUrl = `https://map.kakao.com/link/search/${encodedAddress}`;
    }

    if (url) {
        const openedAt = Date.now();
        window.top.location.href = url;

        if (fallbackUrl) {
            setTimeout(() => {
                if (Date.now() - openedAt < 1800 && !document.hidden) {
                    window.top.location.href = fallbackUrl;
                }
            }, 1200);
        }
    }
};

window.saveGeneralEntry = async () => {
    const memoInput = document.getElementById("memoIn");
    const memo = memoInput.value.trim();

    if (!memo && window.tempImgs.length === 0) {
        return;
    }

    const now = new Date().toISOString();
    const finalImgs = window.tempImgs.map((img) => ({
        id: img.id,
        src: img.src,
        originalName: img.originalName || "",
        updatedAt: img.updatedAt || now
    }));

    const newLog = {
        id: Date.now().toString(),
        y: window.currentYear,
        m: window.curMonth,
        d: window.curDay,
        cat: finalImgs.length > 0 ? "photo" : "memo",
        memo,
        imgs: finalImgs,
        time: window.getCurrentTimeString(),
        personalCheck: null,
        updatedAt: now
    };

    window.saveToLocalStore("logs", newLog);

    memoInput.value = "";
    document.getElementById("previewArea").innerHTML = "";
    window.tempImgs = [];
};

window.getWorkDraftText = () => {
    const date = document.getElementById("workDateInput")?.value || "";
    const time = document.getElementById("workTime")?.value || "";
    const taskNo = document.getElementById("taskNo")?.value.trim() || "";
    const customerName = document.getElementById("customerName")?.value.trim() || "";
    const address = document.getElementById("workAddress")?.value.trim() || "";
    const content = document.getElementById("workContent")?.value.trim() || "";
    const note = document.getElementById("workNote")?.value.trim() || "";
    const otCount = Number(window.workOTCount) || 0;
    const equips = Object.entries(window.activeEquips || {})
        .filter((entry) => Number(entry[1]) > 0)
        .map((entry) => `${entry[0]} ${entry[1]}`)
        .join(", ");

    return [
        "[작업일지]",
        date ? `일자: ${date}` : "",
        time ? `시간: ${time}` : "",
        taskNo ? `Task: ${taskNo}` : "",
        customerName ? `고객명: ${customerName}` : "",
        address ? `주소: ${address}` : "",
        (window.activeTaskTypes || []).length ? `작업유형: ${window.activeTaskTypes.join(", ")}` : "",
        window.activeStatus ? `상태: ${window.activeStatus}` : "",
        (window.selectedCoworkers || []).length ? `매니저: ${window.selectedCoworkers.join(", ")}` : "",
        equips ? `장비: ${equips}` : "",
        content ? `내용: ${content}` : "",
        note ? `특이사항: ${note}` : "",
        otCount ? "OT: O" : "",
        window.isWorkDuty ? "당직: O" : "",
        (window.workStartTime || window.workEndTime)
            ? `시작/종료: ${window.workStartTime || "--:--"} ~ ${window.workEndTime || "--:--"}` +
              (window.computeWorkDurationMin && window.computeWorkDurationMin() !== null
                  ? ` (${window.formatDurationMin(window.computeWorkDurationMin())})`
                  : "")
            : ""
    ].filter(Boolean).join("\n");
};

window.copyWorkDraft = async () => {
    const text = window.getWorkDraftText();

    if (!text.trim()) {
        alert("복사할 작업일지 내용이 없습니다.");
        return;
    }

    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
        } else {
            const textarea = document.createElement("textarea");
            textarea.value = text;
            textarea.style.position = "fixed";
            textarea.style.left = "-9999px";
            document.body.appendChild(textarea);
            textarea.focus();
            textarea.select();
            document.execCommand("copy");
            document.body.removeChild(textarea);
        }

        alert("작업일지 내용을 복사했습니다.");
    } catch (error) {
        console.error(error);
        alert("복사에 실패했습니다. 브라우저 권한을 확인해주세요.");
    }
};

window.isWorkEditLocked = false;

window.setWorkEditLocked = (locked) => {
    window.isWorkEditLocked = !!locked;
    const modal = document.getElementById("workModal");
    if (modal) {
        modal.classList.toggle("work-edit-locked", window.isWorkEditLocked);
        modal.classList.toggle("work-new-mode", !window.currentWorkId);
    }

    const editButton = document.getElementById("workEditSaveBtn");

    if (editButton) editButton.style.display = window.currentWorkId ? (window.isWorkEditLocked ? "block" : "none") : "none";
    // 저장 버튼은 잠금 여부와 상관없이 항상 눌러야 한다 — 기본그룹/시작·종료는 잠긴 상태에서도
    // 바로 수정할 수 있는 예외라서, 그 값만 바꾼 뒤 곧바로 저장할 수 있어야 하기 때문.

    const editableRoot = document.getElementById("workDragContainer");
    if (!editableRoot) return;

    // 기본그룹(날짜/시간/Task번호/고객명/주소/작업내용/특이사항 등)과 시작/종료(특수 기능)는
    // "수정" 버튼 없이도 바로 고칠 수 있는 잠금 예외 — 사진 찍듯 바로바로 눌러야 하는 항목이라
    // 매번 수정 버튼부터 누르게 하면 타이밍을 놓치기 쉬움.
    const basicGroupEl = editableRoot.querySelector('.drag-item[data-id="1"]');
    const durationGroupEl = editableRoot.querySelector('.drag-item[data-group-ref="duration"]');
    const isLockExempt = (element) =>
        (basicGroupEl && basicGroupEl.contains(element)) ||
        (durationGroupEl && durationGroupEl.contains(element));

    editableRoot.querySelectorAll("input, textarea, select, button").forEach((element) => {
        if (element.id === "workCopyBtn" || isLockExempt(element)) {
            element.disabled = false;
            if (element.matches("input, textarea")) element.readOnly = false;
            element.classList.remove("work-locked-control");
            return;
        }

        if (element.matches("input[type='text'], input[type='date'], textarea")) {
            element.readOnly = window.isWorkEditLocked;
        }

        if (element.matches("button, input[type='file']")) {
            element.disabled = window.isWorkEditLocked;
        }

        element.classList.toggle("work-locked-control", window.isWorkEditLocked);
    });
};

window.unlockWorkEdit = () => {
    window.setWorkEditLocked(false);
    const firstInput = document.getElementById("workContent") || document.getElementById("taskNo");
    if (firstInput && firstInput.focus) firstInput.focus();
};

window.saveWorkLog = async () => {
    try {
        // 잠금 상태여도 저장은 막지 않는다 — 기본그룹/시작·종료는 잠금 예외라 그 값만
        // 바로 고쳐서 저장할 수 있어야 하고, 잠긴 나머지 항목은 화면에서 아예 못 바꾸므로 안전하다.

        const timeInput = document.getElementById("workTime");

        if (timeInput) {
            window.formatTimeInput(timeInput);
        }

        let workTime = timeInput ? timeInput.value : "";

        if (!workTime || workTime.trim() === "") {
            workTime = window.getCurrentTimeString();
        }

        const taskNo = document.getElementById("taskNo").value;
        const customerName = document.getElementById("customerName").value.trim();
        const addressElement = document.getElementById("workAddress");
        const address = addressElement ? addressElement.value.trim() : "";
        const content = document.getElementById("workContent").value;
        const note = document.getElementById("workNote").value;
        const otCount = Number(window.workOTCount) || 0;
        const id = window.currentWorkId || Date.now().toString();
        const dateValue = document.getElementById("workDateInput").value;

        let saveY = window.currentYear;
        let saveM = window.curMonth;
        let saveD = window.curDay;

        if (dateValue) {
            const parts = dateValue.split("-");

            if (parts.length === 3) {
                saveY = parseInt(parts[0], 10);
                saveM = parseInt(parts[1], 10);
                saveD = parseInt(parts[2], 10);
            }
        }

        const existingLog = window.currentWorkId
            ? window.logs.find((log) => log.id === window.currentWorkId)
            : null;

        const existingCheck = existingLog ? existingLog.personalCheck || null : null;
        const originalTime = existingLog
            ? existingLog.time
            : window.getCurrentTimeString();

        const finalEquips = {};

        for (const key in window.activeEquips) {
            if (window.activeEquips[key] > 0) {
                finalEquips[key] = window.activeEquips[key];
            }
        }

        const newLog = {
            id,
            y: saveY,
            m: saveM,
            d: saveD,
            cat: "work",
            workTime,
            taskNo,
            customerName,
            address,
            taskType: window.activeTaskTypes.join(", "),
            content,
            note,
            // OT는 시간(HH:MM)이 아니라 갯수로 관리한다 — 기존 시간 데이터(log.ot)는 건드리지 않고
            // 새 필드(otCount)로 분리해서, 옛 기록을 갯수로 잘못 해석하는 일이 없게 한다.
            otCount,
            status: window.activeStatus,
            personalCheck: existingCheck,
            coworkers: [...window.selectedCoworkers],
            equips: finalEquips,
            imgs: [...window.workImgs],
            time: originalTime,
            isDuty: window.isWorkDuty,
            startTime: window.workStartTime || null,
            endTime: window.workEndTime || null,
            totalMin: window.computeWorkDurationMin ? window.computeWorkDurationMin() : null,
            updatedAt: new Date().toISOString(),
            // v2: 커스텀 그룹 선택값 저장
            customGroups: window.activeCustomGroupSelections
                ? { ...window.activeCustomGroupSelections }
                : undefined,
            // 그룹별 집계 포함/제외는 이 작업일지에만 적용한다.
            excludedGroups: [...(window.currentWorkExcludedGroups || [])],
            includedGroups: [...(window.currentWorkIncludedGroups || [])]
        };

        const index = window.logs.findIndex((log) => log.id === id);

        if (index >= 0) {
            window.logs[index] = newLog;
        } else {
            window.logs.push(newLog);
        }

        window.logs.forEach((log) => {
            if (
                log.y === saveY &&
                log.m === saveM &&
                log.d === saveD &&
                log.cat === "work"
            ) {
                log.isDuty = window.isWorkDuty;
            }
        });

        if (saveY !== window.currentYear || saveM !== window.curMonth) {
            window.currentYear = saveY;
            window.curMonth = saveM;
            window.curDay = saveD;
            document.getElementById("monthLabel").innerText = `${window.curMonth}월`;
        } else if (saveD !== window.curDay) {
            window.curDay = saveD;
        }

        if (window.updateCommuteDetailByDate) {
            window.updateCommuteDetailByDate(saveY, saveM, saveD);
        }

        // 기억이 켜진 그룹만, 이번에 선택한 값을 다음 새 작업일지를 위해 그룹별로 저장
        (window.getActiveGroups ? window.getActiveGroups() : []).forEach(g => {
            if (g.id === 'duration' || !g.remember) return;
            let val;
            if (g.id === 'taskTypes') val = [...window.activeTaskTypes];
            else if (g.id === 'coworkers') val = [...window.selectedCoworkers];
            else if (g.id === 'statuses') val = window.activeStatus;
            else if (g.id === 'equipments') val = { ...window.activeEquips };
            else val = [...(window.activeCustomGroupSelections[g.id] || [])];
            window.saveGroupRememberedValue(g.id, val);
        });

        window.saveLocal(`work:${id}`);
        window.closeWorkModal();
    } catch (e) {
        console.error(e);
        alert("저장 중 오류가 발생했습니다.");
    }
};

window.saveEditLog = async () => {
    const log = window.logs.find((item) => item.id === window.editingLogId);

    if (!log) {
        return;
    }

    log.memo = document.getElementById("editMemo").value;
    log.tags = [...window.activeEditTags];
    log.updatedAt = new Date().toISOString();

    if (log.cat !== "work") {
        log.cat = log.imgs && log.imgs.length > 0 ? "photo" : "memo";
    }

    window.saveToLocalStore("logs", log);
    window.closeEditModal();
};

window.handleCardClick = (id, cat) => {
    if (cat === "work") {
        window.openWorkModal(id);
    } else {
        window.openEditModal(id);
    }
};

window.deleteEntry = async (id) => {
    const log = window.logs.find((item) => item.id === id);

    if (!log) {
        return;
    }

    window.saveToLocalStore("trash", log);
    window.deleteFromLocalStore("logs", id);

    if (log.cat === "commute_in" || log.cat === "commute_out") {
        if (window.updateCommuteDetailByDate) {
            window.updateCommuteDetailByDate(log.y, log.m, log.d);
            window.saveLocal(`commute-delete:${id}`);
        }
    }
};

window.deleteTrashPermanently = (id) => {
    const item = (window.trash || []).find(
        (log) => String(log.id) === String(id)
    );

    if (!item) return;
    if (!confirm("이 항목을 영구 삭제하시겠습니까? 복원할 수 없습니다.")) return;

    window.deleteFromLocalStore("trash", id);

    if (window.renderTrash) {
        window.renderTrash();
    }
};

window.handleSelectChange = (selectElement) => {
    if (selectElement.id === "searchMonth") {
        const selectedMonth = selectElement.value
            ? parseInt(selectElement.value, 10)
            : null;

        if (window.updateSearchFilters) {
            window.updateSearchFilters(selectedMonth);
        }
    }

    window.doSearch();
    selectElement.blur();
};

window.resetSearchInput = () => {
    const input = document.getElementById("searchInput");

    input.value = "";

    if (window.updateSearchFilters) {
        window.updateSearchFilters(null);
    }

    window.doSearch();
    input.focus();
};

window.resetSearch = () => {
    const searchInput = document.getElementById("searchInput");
    const searchResultBar = document.getElementById("searchResultBar");

    if (searchInput) {
        searchInput.value = "";
    }

    if (searchResultBar) {
        searchResultBar.style.display = "none";
    }

    if (document.activeElement && document.activeElement.blur) {
        document.activeElement.blur();
    }

    window.renderMain();
};

window.removeFilter = (selectId) => {
    document.getElementById(selectId).value = "";

    if (selectId === "searchMonth" && window.updateSearchFilters) {
        window.updateSearchFilters(null);
    }

    window.doSearch();
};

window.doSearch = () => {
    const keyword = document.getElementById("searchInput").value.trim().toLowerCase();
    const searchMonth = document.getElementById("searchMonth").value;
    const searchType = document.getElementById("searchType").value;
    const searchStatus = document.getElementById("searchStatus").value;
    const searchManager = document.getElementById("searchManager").value;
    const searchEquip = document.getElementById("searchEquip").value;
    const searchTag = document.getElementById("searchMemoTag").value;
    const searchOx = document.getElementById("searchOX").value;

    const filtersArea = document.getElementById("activeFiltersArea");
    const resultList = document.getElementById("searchResultList");
    const summaryArea = document.getElementById("searchSummary");
    const tagsHtml = [];

    const tagStyle =
        "padding:2px 6px; font-size:0.75rem; background:#e0e7ff; color:#3730a3; display:inline-flex; align-items:center; gap:4px; font-weight:bold;";

    if (searchMonth) {
        tagsHtml.push(`<span class="w95-btn" style="${tagStyle}" onclick="window.removeFilter('searchMonth')">${searchMonth}월 <i class="fa-solid fa-xmark" style="color:red;"></i></span>`);
    }

    if (searchType) {
        tagsHtml.push(`<span class="w95-btn" style="${tagStyle}" onclick="window.removeFilter('searchType')">${searchType} <i class="fa-solid fa-xmark" style="color:red;"></i></span>`);
    }

    if (searchStatus) {
        tagsHtml.push(`<span class="w95-btn" style="${tagStyle}" onclick="window.removeFilter('searchStatus')">${searchStatus} <i class="fa-solid fa-xmark" style="color:red;"></i></span>`);
    }

    if (searchManager) {
        tagsHtml.push(`<span class="w95-btn" style="${tagStyle}" onclick="window.removeFilter('searchManager')">${searchManager} <i class="fa-solid fa-xmark" style="color:red;"></i></span>`);
    }

    if (searchEquip) {
        tagsHtml.push(`<span class="w95-btn" style="${tagStyle}" onclick="window.removeFilter('searchEquip')">${searchEquip} <i class="fa-solid fa-xmark" style="color:red;"></i></span>`);
    }

    if (searchTag) {
        tagsHtml.push(`<span class="w95-btn" style="${tagStyle}" onclick="window.removeFilter('searchMemoTag')">${searchTag} <i class="fa-solid fa-xmark" style="color:red;"></i></span>`);
    }

    if (searchOx) {
        const label = searchOx === "O" ? "O표시" : "X표시";
        tagsHtml.push(`<span class="w95-btn" style="${tagStyle}" onclick="window.removeFilter('searchOX')">${label} <i class="fa-solid fa-xmark" style="color:red;"></i></span>`);
    }

    filtersArea.innerHTML = tagsHtml.join("");

    if (
        !keyword &&
        !searchMonth &&
        !searchType &&
        !searchStatus &&
        !searchManager &&
        !searchEquip &&
        !searchTag &&
        !searchOx
    ) {
        resultList.innerHTML = "";
        summaryArea.style.display = "none";
        return;
    }

    const results = window.logs.filter((log) => {
        let keywordMatch = true;

        if (keyword) {
            const text =
                (log.memo || "") +
                (log.content || "") +
                (log.taskNo || "") +
                (log.taskType || "") +
                (log.address || "") +
                (log.customerName || "") +
                (log.commuteNote || "") +
                (log.coworkers ? log.coworkers.join("") : "") +
                (log.tags ? log.tags.join("") : "");

            keywordMatch = text.toLowerCase().includes(keyword);
        }

        const monthMatch = searchMonth ? log.m === parseInt(searchMonth, 10) : true;
        const typeMatch = searchType ? log.taskType && log.taskType.includes(searchType) : true;
        const statusMatch = searchStatus ? log.status === searchStatus : true;
        const managerMatch = searchManager ? log.coworkers && log.coworkers.includes(searchManager) : true;
        const equipmentMatch = searchEquip ? log.equips && log.equips[searchEquip] !== undefined : true;
        const tagMatch = searchTag ? log.tags && log.tags.includes(searchTag) : true;
        const oxMatch = searchOx ? log.personalCheck === searchOx : true;

        return (
            keywordMatch &&
            monthMatch &&
            typeMatch &&
            statusMatch &&
            managerMatch &&
            equipmentMatch &&
            tagMatch &&
            oxMatch
        );
    });

    const workIndexByDate = {};
    (window.logs || [])
        .filter((log) => log && log.cat === "work")
        .sort((a, b) => {
            const dateA = `${a.y || ""}-${String(a.m || "").padStart(2, "0")}-${String(a.d || "").padStart(2, "0")}`;
            const dateB = `${b.y || ""}-${String(b.m || "").padStart(2, "0")}-${String(b.d || "").padStart(2, "0")}`;
            if (dateA !== dateB) return dateA.localeCompare(dateB);
            return String(a.workTime || a.time || "").localeCompare(String(b.workTime || b.time || ""));
        })
        .forEach((log) => {
            const key = `${log.y}-${log.m}-${log.d}`;
            workIndexByDate[key] = workIndexByDate[key] || {};
            workIndexByDate[key][String(log.id)] = Object.keys(workIndexByDate[key]).length + 1;
        });

    resultList.innerHTML = results.map((log) => {
        const key = `${log.y}-${log.m}-${log.d}`;
        const indexStr = log.cat === "work" && workIndexByDate[key]
            ? workIndexByDate[key][String(log.id)] || ""
            : "";
        return window.getLogCardHtml(log, indexStr);
    }).join("");

    const counts = {
        work: 0,
        memo: 0,
        photo: 0,
        commute: 0
    };

    results.forEach((log) => {
        if (log.cat === "work") {
            counts.work++;
        } else if (log.cat === "memo") {
            counts.memo++;
        } else if (log.cat === "photo") {
            counts.photo++;
        } else if (log.cat === "commute_in" || log.cat === "commute_out") {
            counts.commute++;
        }
    });

    if (results.length > 0) {
        const typeText = [];

        if (counts.work > 0) typeText.push(`작업 ${counts.work}건`);
        if (counts.memo > 0) typeText.push(`메모 ${counts.memo}건`);
        if (counts.photo > 0) typeText.push(`사진 ${counts.photo}건`);
        if (counts.commute > 0) typeText.push(`출퇴근 ${counts.commute}건`);

        summaryArea.innerHTML =
            `<span style="color:#475569;">총 ${results.length}건 검색됨</span>` +
            `<span style="margin-left:8px; font-weight:normal;">(${typeText.join(", ")})</span>`;

        summaryArea.style.display = "block";
    } else {
        summaryArea.innerText = "조건에 맞는 기록이 없습니다.";
        summaryArea.style.display = "block";
    }
};

window.openImageViewer = (index, mode, refId = null) => {
    if (document.activeElement && document.activeElement.blur) {
        document.activeElement.blur();
    }

    window.currentViewerMode = mode;
    window.currentViewerRefId = refId;

    let imageArray = [];

    if (mode === "temp") {
        imageArray = window.tempImgs;
    } else if (mode === "work") {
        imageArray = window.workImgs;
    } else if (mode === "tempCommute") {
        imageArray = window.tempCommuteImg ? [{ src: window.tempCommuteImg }] : [];
    } else if (mode === "log" || mode === "edit") {
        const log = window.logs.find((item) => item.id === refId);

        if (log) {
            imageArray = log.imgs || [];
        }
    }

    window.currentViewerImages = imageArray;
    window.currentViewerIndex = index;

    if (!imageArray || imageArray.length === 0 || index < 0 || index >= imageArray.length) {
        return;
    }

    const viewerImage = document.getElementById("viewerImg");
    viewerImage.style.transform = "translate(0px, 0px) scale(1)";
    viewerImage.src = imageArray[index].src;

    document.getElementById("imageViewer").style.display = "flex";

    const deleteButton = document.getElementById("deleteImgBtn");

    if (mode === "log" || mode === "tempCommute") {
        deleteButton.style.display = "none";
    } else {
        deleteButton.style.display = "inline-flex";
    }
};

window.closeImageViewer = () => {
    document.getElementById("imageViewer").style.display = "none";
    document.getElementById("viewerImg").src = "";
    window.currentViewerIndex = -1;
};

window.changeViewerImage = (direction) => {
    if (
        window.currentViewerIndex === -1 ||
        !window.currentViewerImages ||
        window.currentViewerImages.length === 0
    ) {
        return;
    }

    const nextIndex = window.currentViewerIndex + direction;

    if (nextIndex >= 0 && nextIndex < window.currentViewerImages.length) {
        window.openImageViewer(
            nextIndex,
            window.currentViewerMode,
            window.currentViewerRefId
        );
    }
};

window.downloadViewerImage = async () => {
    const image =
        window.currentViewerImages &&
        window.currentViewerImages[window.currentViewerIndex];

    if (!image || !image.src) {
        alert("다운로드할 사진이 없습니다.");
        return;
    }

    const downloadButton = document.getElementById("downloadImgBtn");
    if (downloadButton) downloadButton.disabled = true;

    try {
        const response = await fetch(image.src);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const blob = await response.blob();
        const mimeExtension = {
            "image/jpeg": "jpg",
            "image/png": "png",
            "image/webp": "webp",
            "image/gif": "gif",
            "image/heic": "heic",
            "image/heif": "heif"
        };
        const sourcePath = String(image.src).split("?")[0];
        const sourceMatch = sourcePath.match(/\.([a-zA-Z0-9]{2,5})$/);
        const extension = mimeExtension[blob.type] || (sourceMatch ? sourceMatch[1].toLowerCase() : "jpg");
        const defaultBaseName = "image";
        const defaultFileName = `${defaultBaseName}.${extension}`;

        if (window.showSaveFilePicker) {
            try {
                const handle = await window.showSaveFilePicker({
                    suggestedName: defaultFileName,
                    excludeAcceptAllOption: true,
                    types: [{
                        description: "사진",
                        accept: {
                            [blob.type || "image/jpeg"]: [`.${extension}`]
                        }
                    }]
                });
                const writable = await handle.createWritable();
                await writable.write(blob);
                await writable.close();
                return;
            } catch (error) {
                if (error.name === "AbortError") return;
                console.warn("파일 저장 창 사용 실패:", error);
            }
        }

        const requestedName = prompt(
            `저장할 파일명을 입력하세요. 확장자 .${extension}는 자동으로 붙습니다.`,
            defaultBaseName
        );
        if (!requestedName) return;
        const safeRequestedName = String(requestedName)
            .replace(/\.[a-zA-Z0-9]{2,5}$/i, "")
            .replace(/[\\/:*?"<>|]/g, "_")
            .trim();
        if (!safeRequestedName) return;
        const fileName = `${safeRequestedName}.${extension}`;
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = objectUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (error) {
        console.error("사진 다운로드 실패:", error);
        alert("사진 다운로드에 실패했습니다. 저장소의 다운로드 권한을 확인해주세요.");
    } finally {
        if (downloadButton) downloadButton.disabled = false;
    }
};

window.openEditModal = (id) => {
    window.editingLogId = id;

    const log = window.logs.find((item) => item.id === id);

    if (!log) {
        return;
    }

    document.getElementById("editMemo").value = log.memo || "";
    window.activeEditTags = log.tags ? [...log.tags] : [];

    if (
        (id && id.startsWith("calc_commute_")) ||
        (log.memo && log.memo.includes("[출/퇴 상세내역]"))
    ) {
        if (!window.activeEditTags.includes("상세내역")) {
            window.activeEditTags.push("상세내역");
        }

        if (!window.memoTags || !window.memoTags.find((tag) => tag.name === "상세내역")) {
            if (!window.memoTags) {
                window.memoTags = [];
            }

            window.memoTags.push({
                name: "상세내역",
                count: 1
            });
        }
    }

    if (window.renderEditPhotoGrid) {
        window.renderEditPhotoGrid();
    }

    if (window.renderMemoTags) {
        window.renderMemoTags();
    }

    document.getElementById("editModal").style.display = "flex";
};

window.readImageAsDataUrl = function (file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (event) => resolve(event.target.result);
        reader.onerror = () => reject(new Error("파일을 읽을 수 없습니다."));

        reader.readAsDataURL(file);
    });
};

window.convertHeicIfNeeded = async function (file) {
    const name = String(file.name || "").toLowerCase();

    if (!name.endsWith(".heic") && file.type !== "image/heic") {
        return file;
    }

    if (typeof heic2any === "undefined") {
        throw new Error("HEIC 변환 라이브러리가 없습니다.");
    }

    const convertedBlob = await heic2any({
        blob: file,
        toType: "image/jpeg"
    });

    return new File(
        [convertedBlob],
        name.replace(/\.heic$/i, ".jpg") || "image.jpg",
        {
            type: "image/jpeg"
        }
    );
};

window.safeProcessImage = async function (file, callback) {
    try {
        const preparedFile = await window.convertHeicIfNeeded(file);
        const dataUrl = await window.readImageAsDataUrl(preparedFile);

        const image = new Image();

        image.onload = () => {
            const canvas = document.createElement("canvas");
            const maxWidth = 1200;
            const maxHeight = 1200;

            let width = image.width;
            let height = image.height;

            if (width > maxWidth || height > maxHeight) {
                const ratio = Math.min(maxWidth / width, maxHeight / height);
                width = Math.round(width * ratio);
                height = Math.round(height * ratio);
            }

            canvas.width = width;
            canvas.height = height;

            const context = canvas.getContext("2d");
            context.drawImage(image, 0, 0, width, height);

            callback(canvas.toDataURL("image/jpeg", 0.75));
        };

        image.onerror = () => {
            alert("이미지 파일을 읽을 수 없습니다.");
            callback(null);
        };

        image.src = dataUrl;
    } catch (e) {
        console.error("사진 처리 실패:", e);
        alert(e.message || "사진 처리 실패");
        callback(null);
    }
};

window.handleGeneralFiles = (input) => {
    if (!input.files || input.files.length === 0) {
        return;
    }

    if (window.showLoading) {
        window.showLoading("사진 처리 중...");
    }

    const files = Array.from(input.files);
    let completed = 0;

    if (!window.tempImgs) {
        window.tempImgs = [];
    }

    files.forEach((file) => {
        window.safeProcessImage(file, (dataUrl) => {
            if (dataUrl) {
                window.tempImgs.push({
                    id: `img_${Date.now()}_${Math.random()}`,
                    src: dataUrl,
                    originalName: file.name || "",
                    updatedAt: new Date().toISOString()
                });
            }

            completed++;

            if (completed === files.length) {
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

// 빠른입력 미리보기(previewArea)의 X 버튼이 호출하는데 정의가 아예 빠져 있어서
// 눌러도 아무 반응 없이 사진이 안 지워지던 버그 — 함수를 추가한다.
window.removeTemp = (id) => {
    window.tempImgs = (window.tempImgs || []).filter((img) => img.id !== id);
    if (window.renderTempImgs) {
        window.renderTempImgs();
    }
};

window.handleWorkFiles = (input) => {
    if (!input.files || input.files.length === 0) {
        return;
    }

    if (window.showLoading) {
        window.showLoading("사진 처리 중...");
    }

    const files = Array.from(input.files);
    let completed = 0;

    if (!window.workImgs) {
        window.workImgs = [];
    }

    files.forEach((file) => {
        window.safeProcessImage(file, (dataUrl) => {
            if (dataUrl) {
                window.workImgs.push({
                    id: `w_${Date.now()}_${Math.random()}`,
                    src: dataUrl,
                    originalName: file.name || "",
                    updatedAt: new Date().toISOString()
                });
            }

            completed++;

            if (completed === files.length) {
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

window.addFilesToEdit = (input) => {
    const log = window.logs.find((item) => item.id === window.editingLogId);

    if (!log || !input.files || input.files.length === 0) {
        return;
    }

    if (!log.imgs) {
        log.imgs = [];
    }

    if (window.showLoading) {
        window.showLoading("사진 처리 중...");
    }

    const files = Array.from(input.files);
    let completed = 0;

    files.forEach((file) => {
        window.safeProcessImage(file, (dataUrl) => {
            if (dataUrl) {
                log.imgs.push({
                    id: `e_${Date.now()}_${Math.random()}`,
                    src: dataUrl,
                    originalName: file.name || "",
                    updatedAt: new Date().toISOString()
                });

                log.updatedAt = new Date().toISOString();
            }

            completed++;

            if (completed === files.length) {
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

// 메모/사진 편집창의 X 버튼이 호출하는데 정의가 아예 빠져 있어서
// 눌러도 아무 반응 없이 사진이 안 지워지던 버그 — 함수를 추가한다.
// "저장" 버튼(saveEditLog)을 눌러야 실제로 커밋되는 건 메모/태그 수정과 동일하다.
window.removePhotoFromEdit = (idx) => {
    const log = window.logs.find((item) => item.id === window.editingLogId);
    if (!log || !log.imgs) {
        return;
    }
    log.imgs.splice(idx, 1);
    log.updatedAt = new Date().toISOString();
    if (window.renderEditPhotoGrid) {
        window.renderEditPhotoGrid();
    }
};
