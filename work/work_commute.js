// work_commute.js

window.handleCommuteFile = async (input) => {
    if (!input.files || input.files.length === 0) {
        return;
    }

    if (window.showLoading) {
        window.showLoading("사진 처리 중...");
    }

    const file = input.files[0];

    if (!window.safeProcessImage) {
        if (window.hideLoading) {
            window.hideLoading();
        }

        alert("사진 처리 기능을 불러오지 못했습니다.");
        input.value = "";
        return;
    }

    window.safeProcessImage(file, (dataUrl) => {
        if (dataUrl) {
            window.tempCommuteImg = dataUrl;
            window.tempCommuteOriginalName = file.name || "";

            document.getElementById("commuteNoPhotoText").style.display = "none";

            const preview = document.getElementById("commuteImgPreview");
            preview.style.display = "block";
            preview.src = dataUrl;

            document.getElementById("commuteImgDelBtn").style.display = "block";

            if (window.isVisionOcrEnabled?.()) {
                window.runCommuteVisionOcr?.(dataUrl);
            }
        }

        if (window.hideLoading) {
            window.hideLoading();
        }
    });

    input.value = "";
};

window.handleCommuteImg = window.handleCommuteFile;

// ─── 구글 비전 OCR: 출퇴근 사진에서 시간/거리(km) 자동 인식 (설정에서 켜고 끌 수 있음) ───
window.isVisionOcrEnabled = () => localStorage.getItem("wm_vision_ocr_enabled") === "1";
window.setVisionOcrEnabled = enabled => localStorage.setItem("wm_vision_ocr_enabled", enabled ? "1" : "0");

window.runCommuteVisionOcr = async (dataUrl) => {
    const requestImg = dataUrl;
    if (!window.runVisionOcr) return;
    const hint = ensureCommuteOcrHintDom();
    hint.style.display = "block";
    hint.className = "commute-ocr-hint";
    hint.textContent = "사진에서 시간/거리 인식 중...";
    try {
        const text = await window.runVisionOcr(requestImg);
        // 그 사이 사진이 바뀌었거나 모달이 닫혔으면 결과를 반영하지 않는다.
        if (window.tempCommuteImg !== requestImg) return;
        applyCommuteOcrResult(text);
    } catch (e) {
        console.warn("출퇴근 사진 OCR 실패:", e);
        if (window.tempCommuteImg !== requestImg) return;
        hint.className = "commute-ocr-hint is-warning";
        hint.textContent = "사진 인식에 실패했습니다. 시간/거리를 직접 확인해주세요.";
    }
};

function ensureCommuteOcrHintDom() {
    let el = document.getElementById("commuteOcrHint");
    if (!el) {
        el = document.createElement("div");
        el.id = "commuteOcrHint";
        el.className = "commute-ocr-hint";
        el.style.display = "none";
        const noteInput = document.getElementById("commuteNote");
        noteInput?.parentElement?.insertBefore(el, noteInput);
    }
    return el;
}

function applyCommuteOcrResult(text) {
    const hint = ensureCommuteOcrHintDom();
    if (!text) {
        hint.className = "commute-ocr-hint is-warning";
        hint.textContent = "사진에서 글자를 읽지 못했습니다. 시간/거리를 직접 확인해주세요.";
        return;
    }

    const timeMatch = text.match(/([01]?\d|2[0-3])\s*[:시]\s*([0-5]?\d)\s*분?/);
    const kmMatch = text.match(/(\d{1,3}(?:,\d{3})+|\d{4,7})\s*(?:km|KM|Km)/) || text.match(/(\d{1,3}(?:,\d{3})+|\d{4,7})/);

    let ocrTime = null;
    if (timeMatch) {
        const hh = String(Math.min(23, parseInt(timeMatch[1], 10))).padStart(2, "0");
        const mm = String(Math.min(59, parseInt(timeMatch[2], 10))).padStart(2, "0");
        ocrTime = `${hh}:${mm}`;
        const timeInput = document.getElementById("commuteTime");
        if (timeInput) {
            timeInput.value = ocrTime.replace(":", "");
            window.formatTimeInput?.(timeInput);
            window.updateOvertime?.();
        }
    }
    if (kmMatch) {
        const kmInput = document.getElementById("commuteKm");
        if (kmInput) kmInput.value = kmMatch[1].replace(/,/g, "");
    }

    if (!timeMatch && !kmMatch) {
        hint.className = "commute-ocr-hint is-warning";
        hint.textContent = "사진에서 시간/거리를 찾지 못했습니다. 직접 입력해주세요.";
        return;
    }

    if (ocrTime) {
        const now = window.getCurrentTimeString();
        const toMin = t => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
        const diff = Math.abs(toMin(ocrTime) - toMin(now));
        if (diff > 30) {
            hint.className = "commute-ocr-hint is-warning";
            hint.textContent = `⚠ 사진에서 읽은 시간(${ocrTime})이 현재 시각(${now})과 ${diff}분 차이가 있습니다. 확인해주세요.`;
            return;
        }
    }

    hint.className = "commute-ocr-hint is-ok";
    hint.textContent = `사진에서 인식: ${ocrTime ? `시간 ${ocrTime}` : ""}${ocrTime && kmMatch ? " · " : ""}${kmMatch ? `거리 ${kmMatch[1].replace(/,/g, "")}km` : ""} (자동 입력됨, 확인 후 저장하세요)`;
}

window.handleCommuteThumbClick = (event) => {
    if (event && event.target && event.target.id === "commuteImgDelBtn") {
        return;
    }

    if (window.tempCommuteImg) {
        if (window.openImageViewer) {
            window.openImageViewer(0, "tempCommute");
        }

        return;
    }

    const input = document.getElementById("commuteImgInput");

    if (input) {
        input.click();
    }
};

window.removeCommuteImg = (event) => {
    if (event && event.stopPropagation) {
        event.stopPropagation();
    }

    window.tempCommuteImg = null;
    window.tempCommuteOriginalName = "";

    document.getElementById("commuteNoPhotoText").style.display = "block";
    document.getElementById("commuteImgPreview").style.display = "none";
    document.getElementById("commuteImgPreview").src = "";
    document.getElementById("commuteImgDelBtn").style.display = "none";

    const hint = document.getElementById("commuteOcrHint");
    if (hint) hint.style.display = "none";
};

window.updateOvertime = () => {
    const timeValue = document.getElementById("commuteTime").value;
    const baseValue = document.getElementById("commuteBaseTime").value;
    const overtimeInput = document.getElementById("commuteOvertime");

    if (
        timeValue.length < 4 ||
        baseValue.length < 4 ||
        !timeValue.includes(":") ||
        !baseValue.includes(":")
    ) {
        overtimeInput.value = "00:00";
        window.calculatedOvertimeMin = 0;
        return;
    }

    const parseMinutes = (value) => {
        const parts = value.split(":").map(Number);
        return parts[0] * 60 + parts[1];
    };

    const currentMinutes = parseMinutes(timeValue);
    const baseMinutes = parseMinutes(baseValue);

    let difference = 0;

    if (window.currentCommuteType === "in") {
        difference = baseMinutes - currentMinutes;
    } else {
        difference = currentMinutes - baseMinutes;
    }

    if (difference < 0 || window.isCommuteException) {
        difference = 0;
    }

    window.calculatedOvertimeMin = difference;

    const hours = String(Math.floor(difference / 60)).padStart(2, "0");
    const minutes = String(difference % 60).padStart(2, "0");

    overtimeInput.value = `${hours}:${minutes}`;
};

window.updateCommuteDetailByDate = (year, month, day) => {
    const dayLogs = window.logs.filter(
        (log) =>
            log.y === year &&
            log.m === month &&
            log.d === day
    );

    const inLog = dayLogs.find((log) => log.cat === "commute_in");
    const outLog = dayLogs.find((log) => log.cat === "commute_out");
    const detailId = `calc_commute_${year}_${month}_${day}`;
    const previousDetail = window.logs.find((log) => log.id === detailId);

    if (!inLog || !outLog) {
        if (previousDetail) {
            window.logs = window.logs.filter((log) => log.id !== detailId);

            if (window.markDirty) {
                window.markDirty("logs", detailId, "delete");
            }
        }

        return;
    }

    let distance = (parseInt(outLog.km, 10) || 0) - (parseInt(inLog.km, 10) || 0);

    if (distance < 0) {
        distance = 0;
    }

    const monthLogs = window.logs.filter(
        (log) =>
            String(log.y) === String(year) &&
            String(log.m) === String(month)
    );

    let monthlyDistance = 0;

    for (let currentDay = 1; currentDay <= day; currentDay++) {
        const dailyIn = monthLogs.find(
            (log) =>
                String(log.d) === String(currentDay) &&
                log.cat === "commute_in"
        );

        const dailyOut = monthLogs.find(
            (log) =>
                String(log.d) === String(currentDay) &&
                log.cat === "commute_out"
        );

        if (dailyIn && dailyOut) {
            const dailyDistance =
                (parseInt(dailyOut.km, 10) || 0) -
                (parseInt(dailyIn.km, 10) || 0);

            if (dailyDistance > 0) {
                monthlyDistance += dailyDistance;
            }
        }
    }

    const formatOvertime = (minutes) => {
        if (!minutes) return "";

        const hoursText = String(Math.floor(minutes / 60)).padStart(2, "0");
        const minutesText = String(minutes % 60).padStart(2, "0");

        return ` (+${hoursText}:${minutesText})`;
    };

    const inOvertimeText = inLog.inException
        ? " [예외]"
        : formatOvertime(inLog.overtimeMin);

    const outOvertimeText = outLog.outException
        ? " [예외]"
        : formatOvertime(outLog.overtimeMin);

    const weekdayNames = ["일", "월", "화", "수", "목", "금", "토"];
    const weekday = weekdayNames[new Date(year, month - 1, day).getDay()];
    const hasDuty = dayLogs.some((log) => log.cat === "work" && log.isDuty);
    const dutyText = hasDuty ? " - 당직" : "";

    const memo =
        `[출/퇴 상세내역]\n` +
        `📅 ${year}년 ${month}월 ${day}일(${weekday})${dutyText}\n` +
        `🟢 출근 : ${inLog.time || "-"}${inOvertimeText}\n` +
        `🔴 퇴근 : ${outLog.time || "-"}${outOvertimeText}\n` +
        `🚗 주행: ${Number(distance).toLocaleString()}km ` +
        `(누적 ${Number(monthlyDistance).toLocaleString()}km)`;

    const sortTime = outLog.time ? `${outLog.time}:01` : "23:59:59";
    const now = new Date().toISOString();

    if (!window.memoTags) {
        window.memoTags = [];
    }

    if (!window.memoTags.find((tag) => tag.name === "상세내역")) {
        window.memoTags.push({
            name: "상세내역",
            count: 1
        });

        if (window.markDirty) {
            window.markDirty("master", "memoTags", "replace");
        }
    }

    if (previousDetail) {
        const customLines = String(previousDetail.memo || "")
            .split("\n")
            .filter((line) => {
                const value = line.trim();

                return !(
                    value.startsWith("[출/퇴 상세내역]") ||
                    value.startsWith("📅") ||
                    value.startsWith("🟢") ||
                    value.startsWith("🔴") ||
                    value.startsWith("🚗 주행:") ||
                    value.startsWith("오늘 주행:")
                );
            })
            .filter(Boolean);

        previousDetail.memo =
            memo + (customLines.length > 0 ? `\n${customLines.join("\n")}` : "");

        previousDetail.time = sortTime;
        previousDetail.updatedAt = now;

        if (!previousDetail.tags) {
            previousDetail.tags = [];
        }

        if (!previousDetail.tags.includes("상세내역")) {
            previousDetail.tags.push("상세내역");
        }

        if (window.markDirty) {
            window.markDirty("logs", previousDetail.id, "upsert");
        }
    } else {
        const detailLog = {
            id: detailId,
            y: year,
            m: month,
            d: day,
            cat: "memo",
            tags: ["상세내역"],
            memo,
            time: sortTime,
            updatedAt: now
        };

        window.logs.push(detailLog);

        if (window.markDirty) {
            window.markDirty("logs", detailLog.id, "upsert");
        }
    }
};

window.saveCommute = () => {
    const timeInput = document.getElementById("commuteTime");

    window.formatTimeInput(timeInput);

    const commuteTime = timeInput.value || window.getCurrentTimeString();
    const kilometerText = document
        .getElementById("commuteKm")
        .value
        .replace(/[^0-9]/g, "");

    const kilometers = parseInt(kilometerText, 10) || 0;
    const overtimeMinutes = window.calculatedOvertimeMin || 0;
    const note = document.getElementById("commuteNote").value.trim();

    let exceptionText = "";
    let exceptionStatus = null;

    if (window.isCommuteException) {
        exceptionText = " [예외 적용됨]";
        exceptionStatus = "예외";
    } else if (overtimeMinutes > 0) {
        exceptionStatus =
            window.currentCommuteType === "in" ? "조출" : "지연";

        exceptionText = ` [${exceptionStatus} 적용]`;
    }

    const category =
        window.currentCommuteType === "in" ? "commute_in" : "commute_out";

    const existingIndex = window.logs.findIndex(
        (log) =>
            log.y === window.currentYear &&
            log.m === window.curMonth &&
            log.d === window.curDay &&
            log.cat === category
    );

    const existingLog =
        existingIndex >= 0 ? window.logs[existingIndex] : null;

    const id = existingLog ? existingLog.id : Date.now().toString();
    const now = new Date().toISOString();

    let images = [];

    if (window.tempCommuteImg) {
        const previousImage =
            existingLog &&
            existingLog.imgs &&
            existingLog.imgs[0]
                ? existingLog.imgs[0]
                : null;

        images = [
            {
                id:
                    previousImage &&
                    previousImage.src === window.tempCommuteImg
                        ? previousImage.id
                        : `c_${Date.now()}`,
                src: window.tempCommuteImg,
                originalName:
                    window.tempCommuteOriginalName ||
                    previousImage?.originalName ||
                    "",
                updatedAt: now
            }
        ];
    }

    const newLog = {
        id,
        y: window.currentYear,
        m: window.curMonth,
        d: window.curDay,
        cat: category,
        time: commuteTime,
        inTime: window.currentCommuteType === "in" ? commuteTime : null,
        outTime: window.currentCommuteType === "out" ? commuteTime : null,
        inResult: window.currentCommuteType === "in" ? exceptionStatus : null,
        outResult: window.currentCommuteType === "out" ? exceptionStatus : null,
        inException:
            window.currentCommuteType === "in"
                ? window.isCommuteException
                : null,
        outException:
            window.currentCommuteType === "out"
                ? window.isCommuteException
                : null,
        overtimeMin: overtimeMinutes,
        commuteNote: note,
        km: kilometers,
        imgs: images,
        memo:
            `${window.currentCommuteType === "in" ? "출근" : "퇴근"} 기록: ` +
            `${commuteTime} / ${Number(kilometers).toLocaleString()}km${exceptionText}`,
        personalCheck: existingLog ? existingLog.personalCheck || null : null,
        updatedAt: now
    };

    window.saveToLocalStore("logs", newLog);

    window.updateCommuteDetailByDate(
        window.currentYear,
        window.curMonth,
        window.curDay
    );

    window.saveLocal(`logs:${id}:commute`, {
        skipSnapshotDirty: true
    });

    window.closeCommuteModal();
};
