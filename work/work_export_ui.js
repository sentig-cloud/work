// work_export_ui.js (v2 - groups 통합)

window.WorkExportUI = {
    // ─── 고정 컬럼 (시스템) ───
    systemColumns: [
        { id: 'date',      name: '날짜',       customName: '날짜' },
        { id: 'time',      name: '시간',       customName: '시간' },
        { id: 'cat',       name: '분류',       customName: '분류' },
        { id: 'taskNo',    name: 'Task번호',   customName: 'Task번호' },
        { id: 'customer',  name: '고객명',     customName: '고객명' },
        { id: 'taskType',  name: '작업유형',   customName: '작업유형' },
        { id: 'status',    name: '상태',       customName: '상태' },
        { id: 'coworkers', name: '매니저',     customName: '매니저' },
        { id: 'address',   name: '주소',       customName: '주소' },
        { id: 'content',   name: '내용',       customName: '내용' },
        { id: 'note',      name: '특이사항',   customName: '특이사항' },
        { id: 'equips',    name: '장비/KM',    customName: '장비/KM' },
        { id: 'duty',      name: '당직여부',   customName: '당직여부' },
        { id: 'otCount',   name: 'OT',         customName: 'OT' },
        { id: 'durationStart', name: '시작시간', customName: '시작시간' },
        { id: 'durationEnd',   name: '종료시간', customName: '종료시간' },
        { id: 'durationTotal', name: '총시간',   customName: '총시간' },
        { id: 'oxDisplay', name: 'O/X표시',    customName: 'O/X표시' },
        { id: 'tags',      name: '태그',       customName: '태그' },
        { id: 'hasPhoto',  name: '사진유무',   customName: '사진유무' },
        { id: 'inTime',    name: '출근시간',   customName: '출근시간' },
        { id: 'outTime',   name: '퇴근시간',   customName: '퇴근시간' },
        { id: 'driveKm',   name: '주행거리',   customName: '주행거리' },
        { id: 'commuteOt', name: '시간외근무', customName: '시간외근무' },
        { id: 'inNote',    name: '출근특이사항', customName: '출근특이사항' },
        { id: 'outNote',   name: '퇴근특이사항', customName: '퇴근특이사항' }
    ],

    // 동적으로 groups에서 생성된 컬럼 포함 전체 컬럼
    get columnsMaster() {
        const cols = [...this.systemColumns];
        // v2: 커스텀 그룹 컬럼 동적 추가
        if (window.groups) {
            // duration(시작/종료)은 아래 systemColumns에 durationStart/End/Total로 이미 전용 컬럼이
            // 있으므로 여기서 또 일반 customGroups 컬럼으로 중복 추가하지 않도록 제외한다.
            const builtInIds = window.BUILT_IN_GROUP_IDS || ['taskTypes','coworkers','statuses','equipments','memoTags','duration'];
            const customGroups = (window.groups || []).filter(g => !builtInIds.includes(g.id));
            customGroups.forEach(g => {
                // 이미 있으면 스킵
                if (!cols.find(c => c.id === `grp_${g.id}`)) {
                    cols.push({
                        id: `grp_${g.id}`,
                        name: g.title,
                        customName: g.title,
                        groupId: g.id,
                        isCustomGroup: true,
                        disabled: !g.enabled  // 비활성 그룹 = disabled
                    });
                }
            });
        }

        // 비활성 그룹(active=false)은 선택 자체를 못 하므로 내보내기 목록에서도 완전히 뺀다
        // (기본 제공 그룹은 고정 컬럼 id로 매핑, 커스텀 그룹은 groupId로 바로 확인)
        const builtInColumnGroupId = {
            taskType: 'taskTypes',
            coworkers: 'coworkers',
            status: 'statuses',
            equips: 'equipments'
        };
        return cols.filter(col => {
            const groupId = col.groupId || builtInColumnGroupId[col.id];
            if (!groupId) return true;
            return window.isGroupActive ? window.isGroupActive(groupId) : true;
        });
    },

    state: {
        selectedType: 'xlsx',
        selectedWidth: 'normal',
        photoOption: 'image',
        selectedYear: new Date().getFullYear(),
        selectedMonths: [new Date().getMonth() + 1],
        selectAllMonths: false,
        selectedSort: 'desc',
        selectedOrder: []
    },

    init: function () {
        if (!document.getElementById('exportConfigLayer')) {
            document.body.insertAdjacentHTML('beforeend', window.WorkExportHTML);
        }
        this.loadConfig();
        if (this.state.selectedOrder.length === 0) {
            this.state.selectedOrder = this.columnsMaster.map(c => c.id);
        }
    },

    loadConfig: function () {
        let conf = localStorage.getItem('wm_export_conf');
        if (conf) {
            let parsed = JSON.parse(conf);
            this.state = { ...this.state, ...parsed };
            if (this.state.selectedType === "xls") this.state.selectedType = "xlsx";
            if (parsed.customNames) {
                parsed.customNames.forEach(cn => {
                    // 시스템 컬럼
                    let match = this.systemColumns.find(c => c.id === cn.id);
                    if (match) match.customName = cn.name;
                    // 커스텀 그룹 컬럼은 groups.title로 관리되므로 별도 처리 안 함
                });
            }
        }
    },

    saveConfig: function () {
        let customNames = this.systemColumns
            .filter(c => c.customName !== c.name)
            .map(c => ({ id: c.id, name: c.customName }));
        localStorage.setItem('wm_export_conf', JSON.stringify({ ...this.state, customNames }));
    },

    open: function (y, mArr, sort) {
        this.init();
        if (y) this.state.selectedYear = y;
        if (mArr) {
            this.state.selectedMonths = mArr;
            this.state.selectAllMonths = (mArr.length === 12);
        }
        if (sort) this.state.selectedSort = sort;
        document.getElementById('exportConfigLayer').style.display = 'flex';
        this.render();
    },

    close: function () { document.getElementById('exportConfigLayer').style.display = 'none'; },

    toggleMonth: function (m) {
        this.state.selectAllMonths = false;
        let idx = this.state.selectedMonths.indexOf(m);
        if (idx > -1) this.state.selectedMonths.splice(idx, 1);
        else this.state.selectedMonths.push(m);
        if (this.state.selectedMonths.length === 12) this.state.selectAllMonths = true;
        this.saveConfig(); this.render();
    },

    toggleAllMonths: function () {
        this.state.selectAllMonths = !this.state.selectAllMonths;
        if (this.state.selectAllMonths) this.state.selectedMonths = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
        else this.state.selectedMonths = [];
        this.saveConfig(); this.render();
    },

    setSort: function (s) { this.state.selectedSort = s; this.saveConfig(); this.render(); },
    setFormat: function (f) { this.state.selectedType = f; this.saveConfig(); this.render(); },
    setWidth: function (w) { this.state.selectedWidth = w; this.saveConfig(); this.render(); },
    setPhotoOption: function (opt) { this.state.photoOption = opt; this.saveConfig(); this.render(); },

    toggleExportCol: function (id) {
        let idx = this.state.selectedOrder.indexOf(id);
        if (idx > -1) {
            this.state.selectedOrder.splice(idx, 1);
            if (id === 'hasPhoto') this.state.photoOption = 'ox';
        } else {
            this.state.selectedOrder.push(id);
        }
        this.saveConfig(); this.render();
    },

    openEditModal: function (id) {
        let item = this.columnsMaster.find(c => c.id === id);
        if (!item) return;
        let cIdx = this.state.selectedOrder.indexOf(id);
        if (cIdx === -1) return alert("활성화된 항목만 이름/순서를 바꿀 수 있습니다.");
        document.getElementById('editExportTargetId').value = id;
        document.getElementById('editExportNameInput').value = item.customName;
        document.getElementById('editExportOrderInput').value = cIdx + 1;
        document.getElementById('exportTagEditModal').style.display = 'flex';
    },

    closeEditModal: function () { document.getElementById('exportTagEditModal').style.display = 'none'; },

    saveEditModal: function () {
        let id = document.getElementById('editExportTargetId').value;
        let item = this.columnsMaster.find(c => c.id === id);
        let name = document.getElementById('editExportNameInput').value.trim();
        let ord = parseInt(document.getElementById('editExportOrderInput').value);
        if (!name || isNaN(ord) || ord < 1 || ord > this.state.selectedOrder.length) return;
        item.customName = name;

        // 커스텀 그룹이면 groups.title도 업데이트
        if (item.isCustomGroup && item.groupId) {
            const g = window.getGroupById && window.getGroupById(item.groupId);
            if (g) {
                g.title = name;
                window.markDirty && window.markDirty('master', 'groups', 'upsert');
                window.saveLocal && window.saveLocal('group-title');
            }
        }

        let cIdx = this.state.selectedOrder.indexOf(id);
        this.state.selectedOrder.splice(cIdx, 1);
        this.state.selectedOrder.splice(ord - 1, 0, id);

        this.saveConfig();
        this.closeEditModal();
        this.render();
        if (window.applyCustomTitles) window.applyCustomTitles();
    },

    render: function () {
        const cols = this.columnsMaster;

        // 1번째 칸: 월별
        let mHtml = `<div class="exp-tag ${this.state.selectAllMonths ? 'on' : 'off'}" onclick="window.WorkExportUI.toggleAllMonths()">전체</div>`;
        for (let i = 1; i <= 12; i++) {
            mHtml += `<div class="exp-tag ${this.state.selectedMonths.includes(i) ? 'on' : 'off'}" onclick="window.WorkExportUI.toggleMonth(${i})">${i}월</div>`;
        }
        document.getElementById('expMonthArea').innerHTML = mHtml;

        // 2번째 칸
        document.getElementById('expSortArea').innerHTML = `
            <div class="exp-tag ${this.state.selectedSort === 'desc' ? 'on' : 'off'}" onclick="window.WorkExportUI.setSort('desc')">최신순</div>
            <div class="exp-tag ${this.state.selectedSort === 'asc' ? 'on' : 'off'}" onclick="window.WorkExportUI.setSort('asc')">과거순</div>
        `;
        document.getElementById("expFormatArea").innerHTML = `
            <div class="exp-tag ${this.state.selectedType === "xlsx" ? "on" : "off"}" onclick="window.WorkExportUI.setFormat('xlsx')">XLSX</div>
            <div class="exp-tag ${this.state.selectedType === "csv" ? "on" : "off"}" onclick="window.WorkExportUI.setFormat('csv')">CSV</div>
        `;
        document.getElementById('expWidthArea').innerHTML = `
            <div class="exp-tag ${this.state.selectedWidth === 'compact' ? 'on' : 'off'}" onclick="window.WorkExportUI.setWidth('compact')">세밀</div>
            <div class="exp-tag ${this.state.selectedWidth === 'normal' ? 'on' : 'off'}" onclick="window.WorkExportUI.setWidth('normal')">보편</div>
            <div class="exp-tag ${this.state.selectedWidth === 'spacious' ? 'on' : 'off'}" onclick="window.WorkExportUI.setWidth('spacious')">넉넉</div>
        `;
        let hasPhotoOn = this.state.selectedOrder.includes('hasPhoto');
        document.getElementById('expOptionsArea').innerHTML = `
            <div class="${hasPhotoOn ? (this.state.photoOption === 'image' ? 'exp-tag on' : 'exp-tag off') : 'exp-tag disabled'}" onclick="if(${hasPhotoOn}) window.WorkExportUI.setPhotoOption('image')">일반</div>
            <div class="${hasPhotoOn ? (this.state.photoOption === 'ox' ? 'exp-tag on' : 'exp-tag off') : 'exp-tag disabled'}" onclick="if(${hasPhotoOn}) window.WorkExportUI.setPhotoOption('ox')">O/X</div>
            <div class="${hasPhotoOn ? (this.state.photoOption === 'over' ? 'exp-tag on' : 'exp-tag off') : 'exp-tag disabled'}" onclick="if(${hasPhotoOn}) window.WorkExportUI.setPhotoOption('over')">오버</div>
        `;

        // 3번째 칸: 일반 항목
        // 4번째 칸: 출퇴근 항목
        // 5번째 칸(신규): 커스텀 그룹 항목
        let generalHtml = '';
        let commuteHtml = '';
        let customGroupHtml = '';

        const commuteIds = ['inTime', 'outTime', 'driveKm', 'commuteOt', 'inNote', 'outNote'];

        cols.forEach(col => {
            const isSelected = this.state.selectedOrder.includes(col.id);
            const ordNum = isSelected ? (this.state.selectedOrder.indexOf(col.id) + 1) : '';
            const btnClass = isSelected ? 'exp-tag on' : 'exp-tag off';

            // ── 비활성 그룹 컬럼: 회색 + 취소선 표시 ──
            const isDisabledGroup = col.isCustomGroup && col.disabled;
            let extraStyle = '';
            if (col.id === 'hasPhoto' && isSelected) {
                extraStyle = 'background:#dcfce7; border-color:#22c55e; color:#166534;';
            }
            if (isDisabledGroup) {
                extraStyle = 'background:#f1f5f9; border-color:#cbd5e1; color:#94a3b8; opacity:0.7;';
            }

            const labelStyle = isDisabledGroup ? 'text-decoration:line-through; color:#94a3b8;' : '';
            const disabledNote = isDisabledGroup ? ' <span style="font-size:0.6rem; color:#94a3b8;">(비활성)</span>' : '';

            const itemHtml = `
                <div class="${btnClass} exp-col-tag" style="${extraStyle}"
                    onclick="window.WorkExportUI.toggleExportCol('${col.id}')"
                    oncontextmenu="event.preventDefault(); window.WorkExportUI.openEditModal('${col.id}');">
                    <span class="exp-col-num">${ordNum}</span>
                    <span style="flex:1; line-height:1.1; ${labelStyle}">${col.customName || col.name}${disabledNote}</span>
                </div>
            `;

            if (col.isCustomGroup) {
                customGroupHtml += itemHtml;
            } else if (commuteIds.includes(col.id)) {
                commuteHtml += itemHtml;
            } else {
                generalHtml += itemHtml;
            }
        });

        document.getElementById('expColGridGeneral').innerHTML = generalHtml;
        document.getElementById('expColGridCommute').innerHTML = commuteHtml;

        // 커스텀 그룹 섹션 (있을 때만 표시)
        const customSection = document.getElementById('expColGridCustom');
        if (customSection) {
            customSection.innerHTML = customGroupHtml;
            const customParent = customSection.closest('.exp-section');
            if (customParent) customParent.style.display = customGroupHtml ? 'flex' : 'none';
        }
    },

    triggerExport: function () {
        if (!window.logs || this.state.selectedOrder.length === 0) return alert("데이터 또는 선택항목 없음");
        const cols = this.columnsMaster;
        let orderedCols = this.state.selectedOrder.map(id => cols.find(c => c.id === id)).filter(Boolean);
        window.WorkExport.doExport(window.logs, this.state, orderedCols);
    }
};