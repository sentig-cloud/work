window.WorkExportUI = {
    columnsMaster: [
        { id: 'date', name: '날짜', customName: '날짜' },
        { id: 'time', name: '시간', customName: '시간' },
        { id: 'cat', name: '분류', customName: '분류' },
        { id: 'taskNo', name: 'Task번호', customName: 'Task번호' },
        { id: 'customer', name: '고객명', customName: '고객명' },
        { id: 'taskType', name: '작업유형', customName: '작업유형' },
        { id: 'status', name: '상태', customName: '상태' },
        { id: 'coworkers', name: '매니저', customName: '매니저' },
        { id: 'address', name: '주소', customName: '주소' },
        { id: 'content', name: '내용', customName: '내용' },
        { id: 'note', name: '특이사항', customName: '특이사항' },
        { id: 'equips', name: '장비/KM', customName: '장비/KM' },
        { id: 'duty', name: '당직여부', customName: '당직여부' },
        { id: 'oxDisplay', name: 'O/X표시', customName: 'O/X표시' },
        { id: 'tags', name: '태그', customName: '태그' },
        { id: 'hasPhoto', name: '사진유무', customName: '사진유무' },
        { id: 'inTime', name: '출근시간', customName: '출근시간' },
        { id: 'outTime', name: '퇴근시간', customName: '퇴근시간' },
        { id: 'driveKm', name: '주행거리', customName: '주행거리' },
        { id: 'commuteOt', name: '시간외근무', customName: '시간외근무' },
        { id: 'inNote', name: '출근특이사항', customName: '출근특이사항' },
        { id: 'outNote', name: '퇴근특이사항', customName: '퇴근특이사항' }
    ],
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
    init: function() {
        if(!document.getElementById('exportConfigLayer')) {
            document.body.insertAdjacentHTML('beforeend', window.WorkExportHTML);
        }
        this.loadConfig();
        if(this.state.selectedOrder.length === 0) {
            this.state.selectedOrder = this.columnsMaster.map(c=>c.id);
        }
    },
    loadConfig: function() {
        let conf = localStorage.getItem('wm_export_conf');
        if(conf) {
            let parsed = JSON.parse(conf);
            this.state = { ...this.state, ...parsed };
            if (this.state.selectedType === "xls") this.state.selectedType = "xlsx";
            if(parsed.customNames) {
                parsed.customNames.forEach(cn => {
                    let match = this.columnsMaster.find(c => c.id === cn.id);
                    if(match) match.customName = cn.name;
                });
            }
        }
    },
    saveConfig: function() {
        let customNames = this.columnsMaster.filter(c=>c.customName !== c.name).map(c=>({id: c.id, name: c.customName}));
        localStorage.setItem('wm_export_conf', JSON.stringify({ ...this.state, customNames }));
    },
    open: function(y, mArr, sort) {
        this.init();
        if(y) this.state.selectedYear = y;
        if(mArr) {
            this.state.selectedMonths = mArr;
            this.state.selectAllMonths = (mArr.length === 12);
        }
        if(sort) this.state.selectedSort = sort;
        document.getElementById('exportConfigLayer').style.display = 'flex';
        this.render();
    },
    close: function() { document.getElementById('exportConfigLayer').style.display = 'none'; },
    
    toggleMonth: function(m) {
        this.state.selectAllMonths = false;
        let idx = this.state.selectedMonths.indexOf(m);
        if(idx > -1) this.state.selectedMonths.splice(idx, 1);
        else this.state.selectedMonths.push(m);
        if(this.state.selectedMonths.length === 12) this.state.selectAllMonths = true;
        this.saveConfig(); this.render();
    },
    toggleAllMonths: function() {
        this.state.selectAllMonths = !this.state.selectAllMonths;
        if(this.state.selectAllMonths) this.state.selectedMonths = [1,2,3,4,5,6,7,8,9,10,11,12];
        else this.state.selectedMonths = [];
        this.saveConfig(); this.render();
    },
    setSort: function(s) { this.state.selectedSort = s; this.saveConfig(); this.render(); },
    setFormat: function(f) { this.state.selectedType = f; this.saveConfig(); this.render(); },
    setWidth: function(w) { this.state.selectedWidth = w; this.saveConfig(); this.render(); },
    setPhotoOption: function(opt) { this.state.photoOption = opt; this.saveConfig(); this.render(); },
    
    toggleExportCol: function(id) {
        let idx = this.state.selectedOrder.indexOf(id);
        if(idx > -1) {
            this.state.selectedOrder.splice(idx, 1);
            if(id === 'hasPhoto') this.state.photoOption = 'ox';
        } else {
            this.state.selectedOrder.push(id);
        }
        this.saveConfig(); this.render();
    },
    openEditModal: function(id) {
        let item = this.columnsMaster.find(c=>c.id===id); if(!item) return;
        let cIdx = this.state.selectedOrder.indexOf(id);
        if(cIdx === -1) return alert("활성화된 항목만 이름/순서를 바꿀 수 있습니다.");
        document.getElementById('editExportTargetId').value = id;
        document.getElementById('editExportNameInput').value = item.customName;
        document.getElementById('editExportOrderInput').value = cIdx + 1;
        document.getElementById('exportTagEditModal').style.display = 'flex';
    },
    closeEditModal: function() { document.getElementById('exportTagEditModal').style.display = 'none'; },
    saveEditModal: function() {
        let id = document.getElementById('editExportTargetId').value;
        let item = this.columnsMaster.find(c=>c.id===id);
        let name = document.getElementById('editExportNameInput').value.trim();
        let ord = parseInt(document.getElementById('editExportOrderInput').value);
        if(!name || isNaN(ord) || ord < 1 || ord > this.state.selectedOrder.length) return;
        item.customName = name;
        let cIdx = this.state.selectedOrder.indexOf(id);
        this.state.selectedOrder.splice(cIdx, 1); this.state.selectedOrder.splice(ord-1, 0, id);
        
        this.saveConfig(); this.closeEditModal(); this.render();
        if(window.applyCustomTitles) window.applyCustomTitles();
    },
    render: function() {
        // 1번째 칸: 월별
        let mHtml = `<div class="exp-tag ${this.state.selectAllMonths ? 'on' : 'off'}" onclick="window.WorkExportUI.toggleAllMonths()">전체</div>`;
        for(let i=1; i<=12; i++) { mHtml += `<div class="exp-tag ${this.state.selectedMonths.includes(i) ? 'on' : 'off'}" onclick="window.WorkExportUI.toggleMonth(${i})">${i}월</div>`; }
        document.getElementById('expMonthArea').innerHTML = mHtml;
        
        // 2번째 칸: 좌우 2줄 (정렬/너비 좌측, 포맷/사진 우측)
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

        // 3번째 & 4번째 칸: 항목 리스트
        let generalHtml = '';
        let commuteHtml = '';
        this.columnsMaster.forEach(col => {
            let isSelected = this.state.selectedOrder.includes(col.id);
            let ordNum = isSelected ? (this.state.selectedOrder.indexOf(col.id) + 1) : '';
            let btnClass = isSelected ? 'exp-tag on' : 'exp-tag off';
            
            let extraStyle = (col.id === 'hasPhoto' && isSelected) ? 'background:#dcfce7; border-color:#22c55e; color:#166534;' : '';

            let itemHtml = `
                <div class="${btnClass} exp-col-tag" style="${extraStyle}" onclick="window.WorkExportUI.toggleExportCol('${col.id}')" oncontextmenu="event.preventDefault(); window.WorkExportUI.openEditModal('${col.id}');">
                    <span class="exp-col-num">${ordNum}</span> <span style="flex:1; line-height: 1.1;">${col.customName || col.name}</span>
                </div>
            `;
            
            let isCommute = ['inTime', 'outTime', 'driveKm', 'commuteOt', 'inNote', 'outNote'].includes(col.id);
            if (isCommute) commuteHtml += itemHtml;
            else generalHtml += itemHtml;
        });

        document.getElementById('expColGridGeneral').innerHTML = generalHtml;
        document.getElementById('expColGridCommute').innerHTML = commuteHtml;
    },
    
    triggerExport: function() {
        if(!window.logs || this.state.selectedOrder.length === 0) return alert("데이터 또는 선택항목 없음");
        
        let orderedCols = this.state.selectedOrder.map(id => this.columnsMaster.find(c => c.id === id)).filter(Boolean);
        window.WorkExport.doExport(window.logs, this.state, orderedCols);
    }
};