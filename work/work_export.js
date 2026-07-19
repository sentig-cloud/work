// work_export.js
window.WorkExport = {
    imageCache: new Map(),

    doExport: async function(raw, state, cols) {
        try {
            let list = [...raw].filter(l => (l.y || 2026) === state.selectedYear);

            if (!state.selectAllMonths && state.selectedMonths.length > 0) {
                list = list.filter(l => state.selectedMonths.includes(l.m));
            }

            if (list.length === 0) return alert("선택 기간에 데이터 없음");

            list.sort((a, b) => {
                const tA = new Date(a.y || 2026, (a.m || 1) - 1, a.d || 1).getTime();
                const tB = new Date(b.y || 2026, (b.m || 1) - 1, b.d || 1).getTime();
                return state.selectedSort === "asc" ? tA - tB : tB - tA;
            });

            const maxLens = cols.map(c => (c.customName || c.name || "").length);
            const rows = [];

            list.forEach(log => {
                const row = [];

                cols.forEach((col, index) => {
                    let value = "";

                    if (col.id === "date") value = this.getLogDate(log);
                    else if (col.id === "time") value = log.time || "";
                    else if (col.id === "cat") {
                        value = log.cat === "work"
                            ? "작업"
                            : ((log.cat || "").includes("commute")
                                ? "출퇴근"
                                : (log.cat === "photo" ? "사진" : "메모"));
                    }
                    else if (col.id === "taskNo") value = log.taskNo || "";
                    else if (col.id === "customer") value = log.customerName || "";
                    else if (col.id === "taskType") value = log.taskType || "";
                    else if (col.id === "status") value = log.status || "";
                    else if (col.id === "coworkers") value = (log.coworkers || []).join(", ");
                    else if (col.id === "address") value = log.address || "";
                    else if (col.id === "content") value = log.content || (log.cat === "memo" ? log.memo : "");
                    else if (col.id === "note") value = log.note || "";
                    else if (col.id === "equips") {
                        if (log.equips) {
                            value = Object.entries(log.equips)
                                .filter(entry => entry[1] > 0)
                                .map(entry => Number(entry[1]) > 1 ? `${entry[0]} ${entry[1]}` : entry[0])
                                .join(", ");
                        }

                        if (log.km && log.cat !== "commute_in" && log.cat !== "commute_out") {
                            value += (value ? " / " : "") + log.km + "km";
                        }
                    }
                    else if (col.id === "duty") value = log.isDuty ? "당직" : "";
                    else if (col.id === "otCount") value = log.otCount ? "O" : "";
                    else if (col.id === "durationStart") value = log.startTime || "";
                    else if (col.id === "durationEnd") value = log.endTime || "";
                    else if (col.id === "durationTotal") value = log.totalMin ? window.formatDurationMin(log.totalMin) : "";
                    else if (col.id === "oxDisplay") value = log.personalCheck || "";
                    else if (col.id === "tags") value = (log.tags || []).join(", ");
                    else if (col.id === "hasPhoto") {
                        const images = (log.imgs || []).filter(image => image && image.src);

                        if (images.length === 0) value = "X";
                        else if (state.photoOption === "image") {
                            value = { type: "image", images, log };
                        }
                        else if (state.photoOption === "over") {
                            value = { type: "over", images, log };
                        }
                        else value = "O";
                    }
                    else if (col.id === "inTime") {
                        value = log.cat === "commute_in" ? (log.inTime || log.time || "") : "";
                    }
                    else if (col.id === "outTime") {
                        value = log.cat === "commute_out" ? (log.outTime || log.time || "") : "";
                    }
                    else if (col.id === "driveKm") {
                        value = (log.cat === "commute_in" || log.cat === "commute_out")
                            ? (log.km ? log.km + "km" : "")
                            : "";
                    }
                    else if (col.id === "commuteOt") {
                        if (log.cat === "commute_in" || log.cat === "commute_out") {
                            if (log.inException || log.outException) {
                                value = "예외";
                            }
                            else if (log.overtimeMin) {
                                const hours = String(Math.floor(log.overtimeMin / 60)).padStart(2, "0");
                                const minutes = String(log.overtimeMin % 60).padStart(2, "0");
                                value = `+${hours}:${minutes}`;
                            }
                        }
                    }
                    else if (col.id === "inNote") {
                        value = log.cat === "commute_in" ? (log.commuteNote || "") : "";
                    }
                    else if (col.id === "outNote") {
                        value = log.cat === "commute_out" ? (log.commuteNote || "") : "";
                    }
                    // v2: 커스텀 그룹 컬럼 처리
                    else if (col.isCustomGroup && col.groupId) {
                        const grpVal = log.customGroups && log.customGroups[col.groupId];
                        if (Array.isArray(grpVal)) value = grpVal.join(", ");
                        else value = grpVal || "";
                    }

                    const groupId = col.groupId || {
                        taskType: "taskTypes",
                        status: "statuses",
                        coworkers: "coworkers",
                        equips: "equipments",
                        tags: "memoTags"
                    }[col.id];
                    if (log.cat === "work" && groupId && window.isLogGroupExcluded?.(log, groupId)) {
                        value = { type: "excluded", text: "-" };
                    }

                    const textLength = value && (value.type === "image" || value.type === "over")
                        ? 6
                        : (value && value.type === "excluded" ? 1 : String(value || "").length);

                    if (textLength > maxLens[index]) maxLens[index] = textLength;
                    row.push(value);
                });

                rows.push(row);
            });

            const headers = cols.map(col => col.customName || col.name || "");
            const monthText = state.selectAllMonths ? "전체" : state.selectedMonths.join(",");
            const fileName = `WorkMaster_${state.selectedYear}_${monthText}`;

            if (state.selectedType === "csv") {
                this.buildCsv([headers, ...rows], fileName);
            }
            else {
                await this.buildXlsx(headers, rows, maxLens, fileName, state.selectedWidth);
            }
        }
        catch (error) {
            console.error(error);
            alert("내보내기 중 오류 발생: " + error.message);
        }
    },

    getLogDate: function(log) {
        return `${log.y}.${String(log.m).padStart(2, "0")}.${String(log.d).padStart(2, "0")}`;
    },

    getLogIdentity: function(log) {
        return [
            this.getLogDate(log),
            log.customerName ? `고객명: ${log.customerName}` : "",
            log.taskNo ? `작업번호: ${log.taskNo}` : ""
        ].filter(Boolean).join(" / ");
    },

    loadScript: function(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = src;
            script.onload = resolve;
            script.onerror = () => reject(new Error(`라이브러리를 불러오지 못했습니다: ${src}`));
            document.head.appendChild(script);
        });
    },

    ensureLibraries: async function() {
        if (!window.ExcelJS) {
            await this.loadScript("https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js");
        }

        if (!window.saveAs) {
            await this.loadScript("https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js");
        }
    },

    blobToDataUrl: function(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error("사진 파일을 읽지 못했습니다."));
            reader.readAsDataURL(blob);
        });
    },

    dataUrlToBlob: function(dataUrl) {
        const parts = String(dataUrl || "").split(",");
        const match = (parts[0] || "").match(/^data:([^;]+);base64$/i);

        if (!match || !parts[1]) {
            throw new Error("사진 데이터 형식이 올바르지 않습니다.");
        }

        const binary = atob(parts[1]);
        const bytes = new Uint8Array(binary.length);

        for (let index = 0; index < binary.length; index++) {
            bytes[index] = binary.charCodeAt(index);
        }

        return new Blob([bytes], { type: match[1] });
    },

    convertBlobToPng: function(blob) {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(blob);
            const image = new Image();

            image.onload = () => {
                try {
                    const canvas = document.createElement("canvas");
                    canvas.width = image.naturalWidth || image.width;
                    canvas.height = image.naturalHeight || image.height;
                    canvas.getContext("2d").drawImage(image, 0, 0);
                    URL.revokeObjectURL(url);
                    resolve(canvas.toDataURL("image/png"));
                }
                catch (error) {
                    URL.revokeObjectURL(url);
                    reject(error);
                }
            };

            image.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error("지원하지 않는 사진 형식입니다."));
            };

            image.src = url;
        });
    },

    prepareImage: async function(src) {
        if (this.imageCache.has(src)) return this.imageCache.get(src);

        const promise = (async () => {
            let dataUrl;

            if (/^data:image\//i.test(src)) {
                dataUrl = src;
            }
            else {
                const response = await fetch(src);

                if (!response.ok) {
                    throw new Error(`사진 다운로드 실패 (${response.status}): ${src}`);
                }

                dataUrl = await this.blobToDataUrl(await response.blob());
            }

            const match = dataUrl.match(/^data:(image\/[^;]+);base64,/i);

            if (!match) {
                throw new Error("사진 데이터 형식이 올바르지 않습니다.");
            }

            const mime = match[1].toLowerCase();
            let extension = "";

            if (mime === "image/jpeg" || mime === "image/jpg") extension = "jpeg";
            else if (mime === "image/png") extension = "png";
            else if (mime === "image/gif") extension = "gif";

            if (!extension) {
                dataUrl = await this.convertBlobToPng(this.dataUrlToBlob(dataUrl));
                extension = "png";
            }

            return {
                base64: dataUrl.split(",")[1],
                extension
            };
        })();

        this.imageCache.set(src, promise);
        return promise;
    },

    addPreparedImage: async function(workbook, worksheet, src, position) {
        try {
            const prepared = await this.prepareImage(src);
            const imageId = workbook.addImage(prepared);
            worksheet.addImage(imageId, position);
            return true;
        }
        catch (error) {
            console.warn("엑셀 사진 삽입 실패:", src, error);
            this.failedImageSources.push(src);
            return false;
        }
    },

    getBorder: function(color, style) {
        const line = {
            style: style || "thin",
            color: { argb: color }
        };

        return {
            top: line,
            left: line,
            bottom: line,
            right: line
        };
    },

    buildXlsx: async function(headers, rows, maxLens, fileName, widthMode) {
        await this.ensureLibraries();
        this.imageCache = new Map();
        this.failedImageSources = [];

        const workbook = new ExcelJS.Workbook();
        const dataSheet = workbook.addWorksheet("Data");
        const photoRows = [];

        const imageSize = widthMode === "compact"
            ? 40
            : (widthMode === "spacious" ? 90 : 60);

        const rowHeightPerImage = imageSize * 0.75 + 6;

        const header = dataSheet.addRow(headers);
        header.height = 28;

        header.eachCell(cell => {
            cell.font = {
                bold: true,
                color: { argb: "FF1F2937" }
            };

            cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFF1F5F9" }
            };

            cell.alignment = {
                vertical: "middle",
                horizontal: "center"
            };

            cell.border = this.getBorder("FFCBD5E1");
        });

        for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
            const excelRowNumber = rowIndex + 2;
            const rawRow = rows[rowIndex];

            const safeRow = rawRow.map(value => {
                if (value && value.type === "excluded") return "-";
                if (!value || (value.type !== "image" && value.type !== "over")) {
                    return value;
                }

                return value.type === "over" ? "O" : "";
            });

            const excelRow = dataSheet.addRow(safeRow);
            let rowHeight = 24;

            for (let colIndex = 0; colIndex < rawRow.length; colIndex++) {
                const value = rawRow[colIndex];
                const cell = excelRow.getCell(colIndex + 1);
                const columnName = headers[colIndex];

                const centered = [
                    "시간",
                    "출근시간",
                    "퇴근시간",
                    "날짜",
                    "분류",
                    "O/X표시",
                    "당직여부",
                    "사진유무",
                    "Task번호",
                    "OT",
                    "시작시간",
                    "종료시간",
                    "총시간"
                ].includes(columnName);

                const wrapped = [
                    "주소",
                    "내용",
                    "특이사항",
                    "출근특이사항",
                    "퇴근특이사항"
                ].includes(columnName);

                cell.alignment = {
                    vertical: "middle",
                    horizontal: (centered || (value && value.type === "excluded")) ? "center" : "left",
                    wrapText: wrapped
                };

                cell.border = this.getBorder("FFCBD5E1");

                if (value && value.type === "image") {
                    for (let imageIndex = 0; imageIndex < value.images.length; imageIndex++) {
                        await this.addPreparedImage(
                            workbook,
                            dataSheet,
                            value.images[imageIndex].src,
                            {
                                tl: {
                                    col: colIndex + 0.12,
                                    row: excelRowNumber - 1 + 0.04 + (imageIndex / value.images.length)
                                },
                                ext: {
                                    width: imageSize,
                                    height: imageSize
                                }
                            }
                        );
                    }

                    rowHeight = Math.max(
                        rowHeight,
                        value.images.length * rowHeightPerImage
                    );
                }
                else if (value && value.type === "over") {
                    photoRows.push({
                        dataCell: cell,
                        dataRowNumber: excelRowNumber,
                        log: value.log,
                        images: value.images
                    });
                }
            }

            excelRow.height = rowHeight;
        }

        this.setColumnWidths(dataSheet, headers, maxLens, widthMode);

        if (photoRows.length > 0) {
            await this.buildPhotoSheet(workbook, photoRows, widthMode);
        }

        const buffer = await workbook.xlsx.writeBuffer();

        const blob = new Blob(
            [buffer],
            {
                type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            }
        );

        saveAs(blob, `${fileName}.xlsx`);

        if (this.failedImageSources.length > 0) {
            alert(`엑셀 파일은 생성되었지만 사진 ${this.failedImageSources.length}개를 넣지 못했습니다. 콘솔에서 누락된 사진 주소를 확인하세요.`);
        }

        if (window.WorkExportUI) {
            window.WorkExportUI.close();
        }
    },

    buildPhotoSheet: async function(workbook, photoRows, widthMode) {
        const photoSheet = workbook.addWorksheet("사진 모음");

        const photoSize = widthMode === "compact"
            ? 150
            : (widthMode === "spacious" ? 260 : 200);

        const photoRowHeight = photoSize * 0.75 + 8;

        photoSheet.columns = [
            { width: 22 },
            { width: 52 },
            { width: 16 },
            { width: 42 }
        ];

        const header = photoSheet.addRow([
            "사진 모음",
            "Data 시트의 O를 누르면 해당 기록으로 이동합니다."
        ]);

        header.height = 28;
        photoSheet.mergeCells("B1:D1");

        header.eachCell(cell => {
            cell.font = {
                bold: true,
                color: { argb: "FF1F2937" }
            };

            cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFE2E8F0" }
            };

            cell.border = this.getBorder("FF94A3B8");
        });

        for (const photoRow of photoRows) {
            const firstPhotoRow = photoSheet.rowCount + 2;

            photoRow.dataCell.value = {
                text: "O",
                hyperlink: `#'사진 모음'!A${firstPhotoRow}`
            };

            photoRow.dataCell.font = {
                color: { argb: "FF2563EB" },
                underline: true,
                bold: true
            };

            photoRow.dataCell.alignment = {
                vertical: "middle",
                horizontal: "center"
            };

            for (let imageIndex = 0; imageIndex < photoRow.images.length; imageIndex++) {
                const excelRowNumber = photoSheet.rowCount + 1;

                const row = photoSheet.addRow([
                    {
                        text: "Data 목록으로 돌아가기",
                        hyperlink: `#'Data'!A${photoRow.dataRowNumber}`
                    },
                    this.getLogIdentity(photoRow.log),
                    `사진 ${imageIndex + 1} / ${photoRow.images.length}`,
                    ""
                ]);

                row.height = photoRowHeight;

                row.getCell(1).font = {
                    color: { argb: "FF2563EB" },
                    underline: true,
                    bold: true
                };

                row.getCell(2).alignment = {
                    vertical: "middle",
                    wrapText: true
                };

                row.getCell(3).alignment = {
                    vertical: "middle",
                    horizontal: "center"
                };

                for (let colIndex = 1; colIndex <= 4; colIndex++) {
                    const cell = row.getCell(colIndex);

                    cell.border = this.getBorder("FFF59E0B", "medium");

                    cell.fill = {
                        type: "pattern",
                        pattern: "solid",
                        fgColor: {
                            argb: imageIndex === 0 ? "FFFFF7D6" : "FFFFFBEB"
                        }
                    };
                }

                await this.addPreparedImage(
                    workbook,
                    photoSheet,
                    photoRow.images[imageIndex].src,
                    {
                        tl: {
                            col: 3.12,
                            row: excelRowNumber - 1 + 0.12
                        },
                        ext: {
                            width: photoSize,
                            height: photoSize
                        }
                    }
                );
            }
        }
    },

    setColumnWidths: function(worksheet, headers, maxLens, widthMode) {
        const widthBase = widthMode === "compact"
            ? 1.5
            : (widthMode === "normal" ? 2.5 : 4);

        const maxLongTextWidth = widthMode === "compact"
            ? 35
            : (widthMode === "normal" ? 50 : 80);

        headers.forEach((columnName, index) => {
            const column = worksheet.getColumn(index + 1);

            const isLongTextColumn = [
                "주소",
                "내용",
                "특이사항",
                "출근특이사항",
                "퇴근특이사항"
            ].includes(columnName);

            if (columnName === "사진유무") {
                column.width = widthMode === "compact"
                    ? 10
                    : (widthMode === "spacious" ? 18 : 14);
            }
            else if (isLongTextColumn) {
                let width = maxLens[index] * widthBase * 1.3;

                if (width > maxLongTextWidth) width = maxLongTextWidth;
                if (width < 15) width = 15;

                column.width = width;
            }
            else {
                let width = (maxLens[index] * widthBase) + 4;

                if (width < 10) width = 10;

                column.width = width;
            }
        });
    },

    buildCsv: function(rows, fileName) {
        const csv = "\uFEFF" + rows.map(row => {
            return row.map(value => {
                let text = "";

                if (value && value.type === "excluded") {
                    text = "-";
                }
                else if (value && (value.type === "image" || value.type === "over")) {
                    text = "O";
                }
                else {
                    text = String(value || "");
                }

                return `"${text.replace(/"/g, '""')}"`;
            }).join(",");
        }).join("\n");

        const blob = new Blob(
            [csv],
            {
                type: "text/csv;charset=utf-8;"
            }
        );

        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `${fileName}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);

        if (window.WorkExportUI) {
            window.WorkExportUI.close();
        }
    }
};
