// work_export.js
window.WorkExport = {
    doExport: async function(raw, state, cols) {
        try {
            let list = [...raw].filter(l => (l.y||2026) === state.selectedYear);
            
            if (!state.selectAllMonths && state.selectedMonths.length > 0) {
                list = list.filter(l => state.selectedMonths.includes(l.m));
            }

            if(list.length === 0) return alert("선택 기간에 데이터 없음");

            list.sort((a,b) => {
                let tA = new Date(a.y||2026, (a.m||1)-1, a.d||1).getTime();
                let tB = new Date(b.y||2026, (b.m||1)-1, b.d||1).getTime();
                return state.selectedSort === 'asc' ? tA - tB : tB - tA;
            });

            let colMaxLens = cols.map(c => c && (c.customName || c.name) ? (c.customName || c.name).length : 5);
            let rawDataRows = [];

            list.forEach(l => {
                let row = [];
                cols.forEach((c, i) => {
                    let val = '';
                    if (c.id === 'date') val = `${l.y}.${String(l.m).padStart(2,'0')}.${String(l.d).padStart(2,'0')}`;
                    else if (c.id === 'time') val = l.time || '';
                    else if (c.id === 'cat') val = l.cat === 'work' ? '작업' : (l.cat.includes('commute') ? '출퇴근' : (l.cat==='photo'?'사진':'메모'));
                    else if (c.id === 'taskNo') val = l.taskNo || '';
                    else if (c.id === 'customer') val = l.customerName || '';
                    else if (c.id === 'taskType') val = l.taskType || '';
                    else if (c.id === 'status') val = l.status || '';
                    else if (c.id === 'coworkers') val = (l.coworkers || []).join(', ');
                    else if (c.id === 'address') val = l.address || '';
                    else if (c.id === 'content') val = l.content || (l.cat === 'memo' ? l.memo : '');
                    else if (c.id === 'note') val = l.note || '';
                    else if (c.id === 'equips') {
                        if (l.equips) { val = Object.entries(l.equips).filter(e => e[1] > 0).map(e => `${e[0]} ${e[1]}`).join(', '); }
                        if (l.km && l.cat !== 'commute_in' && l.cat !== 'commute_out') { val += (val ? ' / ' : '') + l.km + 'km'; }
                    }
                    else if (c.id === 'duty') val = l.isDuty ? '당직' : '';
                    else if (c.id === 'oxDisplay') val = l.personalCheck || '';
                    else if (c.id === 'tags') val = (l.tags || []).join(', ');
                    
                    // 🌟 사진유무 3가지 모드 매핑
                    else if (c.id === 'hasPhoto') {
                        if (l.imgs && l.imgs.length > 0) {
                            if (state.photoOption === 'image') val = { type: 'image', base64: l.imgs[0].src };
                            else if (state.photoOption === 'over') val = { type: 'over', base64: l.imgs[0].src };
                            else val = 'O'; // ox 모드
                        } else {
                            val = 'X';
                        }
                    }
                    
                    else if (c.id === 'inTime') val = (l.cat === 'commute_in') ? (l.inTime || l.time || '') : '';
                    else if (c.id === 'outTime') val = (l.cat === 'commute_out') ? (l.outTime || l.time || '') : '';
                    else if (c.id === 'driveKm') val = (l.cat === 'commute_in' || l.cat === 'commute_out') ? (l.km ? l.km + 'km' : '') : '';
                    else if (c.id === 'commuteOt') {
                        if (l.cat === 'commute_in' || l.cat === 'commute_out') {
                            if (l.inException || l.outException) val = '예외';
                            else if (l.overtimeMin) {
                                let h = String(Math.floor(l.overtimeMin / 60)).padStart(2, '0');
                                let m = String(l.overtimeMin % 60).padStart(2, '0');
                                val = `+${h}:${m}`;
                            }
                        }
                    }
                    else if (c.id === 'inNote') val = (l.cat === 'commute_in') ? (l.commuteNote || '') : '';
                    else if (c.id === 'outNote') val = (l.cat === 'commute_out') ? (l.commuteNote || '') : '';

                    let strLen = 0;
                    if (val && (val.type === 'image' || val.type === 'over')) strLen = 6; 
                    else strLen = String(val || '').length;
                    
                    if (strLen > colMaxLens[i]) colMaxLens[i] = strLen;
                    row.push(val);
                });
                rawDataRows.push(row);
            });

            const headerRow = cols.map(c => c.customName || c.name || "");
            let mStr = state.selectAllMonths ? "전체" : state.selectedMonths.join(',');
            let name = `WorkMaster_${state.selectedYear}_${mStr}`;

            if(state.selectedType === 'csv') {
                this.buildC([headerRow, ...rawDataRows], name);
            } else {
                await this.buildX(headerRow, rawDataRows, colMaxLens, name, state.selectedWidth, state.selectedType);
            }
        } catch(e) { alert("내보내기 중 오류 발생: " + e.message); }
    },

    buildX: async function(headers, rawDataRows, maxLens, name, sty, format) {
        if(!window.ExcelJS) {
            await new Promise((res, rej) => {
                let sc = document.createElement('script');
                sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.3.0/exceljs.min.js';
                sc.onload = res; sc.onerror = rej;
                document.head.appendChild(sc);
            });
            await new Promise((res, rej) => {
                let sc = document.createElement('script');
                sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js';
                sc.onload = res; sc.onerror = rej;
                document.head.appendChild(sc);
            });
        }
        
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Data');

        const headerRowObj = worksheet.addRow(headers);
        headerRowObj.height = 28;
        headerRowObj.eachCell((cell) => {
            cell.font = { bold: true, color: {argb: 'FF1F2937'} };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: {argb: 'FFF1F5F9'} };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.border = { top: {style:'thin', color:{argb:'FFCBD5E1'}}, left: {style:'thin', color:{argb:'FFCBD5E1'}}, bottom: {style:'thin', color:{argb:'FFCBD5E1'}}, right: {style:'thin', color:{argb:'FFCBD5E1'}} };
        });

        // 🌟 세밀/보편/넉넉에 따른 일반 사진 크기 변환 세팅
        let imgSize = 60; 
        if (sty === 'compact') imgSize = 40;
        else if (sty === 'spacious') imgSize = 90;

        let rowIndex = 2;
        rawDataRows.forEach(rowRaw => {
            const safeRow = rowRaw.map(v => (v && (v.type === 'image' || v.type === 'over')) ? (v.type === 'over' ? 'O' : '') : v);
            const rowObj = worksheet.addRow(safeRow);
            let maxRowHeight = 24; 

            rowRaw.forEach((v, cIdx) => {
                const cell = rowObj.getCell(cIdx + 1);
                const colName = headers[cIdx];
                
                const isCenter = ['시간','출근시간','퇴근시간','날짜','분류','O/X표시','당직여부','사진유무','Task번호'].includes(colName);
                const isWrap = ['주소','내용','특이사항','출근특이사항','퇴근특이사항'].includes(colName);

                cell.alignment = { vertical: 'middle', horizontal: isCenter ? 'center' : 'left', wrapText: isWrap };
                cell.border = { top: {style:'thin', color:{argb:'FFCBD5E1'}}, left: {style:'thin', color:{argb:'FFCBD5E1'}}, bottom: {style:'thin', color:{argb:'FFCBD5E1'}}, right: {style:'thin', color:{argb:'FFCBD5E1'}} };

                if (v && v.type === 'image' && v.base64) {
                    try {
                        // 1. 일반 옵션: 설정된 너비에 따라 썸네일 크기 및 줄 높이 확장
                        let baseData = v.base64.split(',')[1] || v.base64;
                        let imgId = workbook.addImage({ base64: baseData, extension: 'png' });
                        worksheet.addImage(imgId, {
                            tl: { col: cIdx + 0.15, row: rowIndex - 1 + 0.15 },
                            ext: { width: imgSize, height: imgSize }
                        });
                        maxRowHeight = imgSize + 10;
                    } catch(e) {}
                } else if (v && v.type === 'over' && v.base64) {
                    try {
                        // 2. 오버 옵션: 줄 높이는 24 기본, 'O' 출력 및 메모 팝업, 겹치지 않게 아주 작은 점 하나 삽입
                        cell.value = 'O';
                        cell.note = {
                            texts: [{ font: { size: 9, color: { argb: 'FF64748B' } }, text: '지오코딩 원본 사진 내장됨' }],
                            margins: { insetmode: 'custom', inset: [0.1, 0.1, 0.1, 0.1] },
                            protection: { locked: 'True', lockText: 'True' },
                            editAs: 'twoCell',
                            from: { col: cIdx + 1, row: rowIndex - 1 },
                            to: { col: cIdx + 5, row: rowIndex + 11 }
                        };
                        
                        let baseData = v.base64.split(',')[1] || v.base64;
                        let imgId = workbook.addImage({ base64: baseData, extension: 'png' });
                        worksheet.addImage(imgId, {
                            tl: { col: cIdx + 0.8, row: rowIndex - 1 + 0.1 },
                            ext: { width: 5, height: 5 } // 화면을 가리지 않도록 우측 상단 모서리에 5픽셀 점으로 숨김
                        });
                    } catch(e) {}
                }
            });
            rowObj.height = maxRowHeight;
            rowIndex++;
        });

        let widthBase = sty === 'compact' ? 1.5 : (sty === 'normal' ? 2.5 : 4.0);
        let maxLongTextWidth = sty === 'compact' ? 35 : (sty === 'normal' ? 50 : 80); 

        headers.forEach((columnName, i) => {
            const column = worksheet.getColumn(i + 1);
            const isLongTextColumn = ['주소', '내용', '특이사항', '출근특이사항', '퇴근특이사항'].includes(columnName);

            if (columnName === '사진유무') {
                column.width = 12; 
            } else if (isLongTextColumn) {
                let calcWidth = maxLens[i] * widthBase * 1.3;
                if (calcWidth > maxLongTextWidth) calcWidth = maxLongTextWidth;
                if (calcWidth < 15) calcWidth = 15;
                column.width = calcWidth;
            } else {
                let fixedWidth = (maxLens[i] * widthBase) + 4;
                if (fixedWidth < 10) fixedWidth = 10;
                column.width = fixedWidth;
            }
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        
        let ext = format === 'xls' ? 'xls' : 'xlsx';
        saveAs(blob, `${name}.${ext}`);
        if(window.WorkExportUI) window.WorkExportUI.close();
    },

    buildC: function(arr, name) {
        let csv = "\uFEFF" + arr.map(r => r.map(v => {
            let str = '';
            if (v && (v.type === 'image' || v.type === 'over')) str = 'O';
            else str = String(v || '');
            return `"${str.replace(/"/g,'""')}"`;
        }).join(',')).join('\n');
        
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `${name}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
        if(window.WorkExportUI) window.WorkExportUI.close();
    }
};