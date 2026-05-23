window.WorkExportHTML = `
<style>
    /* 글자 크기 축소 및 줄바꿈 유지 */
    .exp-tag-row { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; justify-content: center; }
    .exp-tag { display: inline-flex; align-items: center; justify-content: center; gap: 4px; padding: 4px 6px; font-size: 0.7rem; min-height: 26px; cursor: pointer; user-select: none; border-radius: 4px; transition: 0.1s; text-align: center; white-space: normal; word-break: keep-all; line-height: 1.2; }
    
    .exp-tag.on { background: #e0e7ff; color: #3730a3; border: 1px solid #6366f1; font-weight: bold; box-shadow: inset 1px 1px #fff, inset -1px -1px #808080; }
    .exp-tag.off { background: #f1f5f9; color: #64748b; border: 1px solid #cbd5e1; box-shadow: inset 1px 1px #fff, inset -1px -1px #cbd5e1; }
    .exp-tag.disabled { opacity: 0.4; pointer-events: none; background: #e5e7eb; color: #9ca3af; border: 1px solid #d1d5db; }
    
    .exp-tag-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
    .exp-col-tag { justify-content: flex-start; padding: 4px; min-height: 30px; height: auto; display: flex; align-items: center; box-shadow: 1px 1px 2px rgba(0,0,0,0.05); }
    .exp-col-num { background: #3730a3; color: white; width: 16px; height: 16px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 0.65rem; font-weight: bold; flex-shrink: 0; }
    .exp-col-tag.off .exp-col-num { background: transparent; color: transparent; border: 1px solid #94a3b8; }
    
    .exp-section { background: #ffffff; border: 1px solid #cbd5e1; padding: 8px; border-radius: 6px; display: flex; flex-direction: column; gap: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
    
    /* 🌟 두 번째 칸: 좌우 2줄 분리용 그리드 설정 */
    .exp-grid-2col { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .col-left { justify-content: flex-start; }
    .col-right { justify-content: flex-end; }
</style>
<div id="exportConfigLayer" class="layer" style="z-index: 5000; background: rgba(0,0,0,0.55); justify-content: center; padding: 10px;">
    <div class="modal-box w95-window" style="max-height: 95vh; display: flex; flex-direction: column; border-radius: 8px; overflow: hidden; border: 2px solid #94a3b8;">
        <div class="w95-titlebar" style="background: #1e293b; padding: 6px 10px; font-size: 0.9rem;">
            <span>내보내기 설정</span>
            <button type="button" class="w95-btn" style="padding:0 8px; font-size: 0.8rem;" onclick="window.WorkExportUI.close()">X</button>
        </div>
        <div class="modal-content-scroll" style="background:#f8fafc; padding:8px; display:flex; flex-direction:column; gap:6px;">
            
            <div class="exp-section">
                <div class="exp-tag-row" id="expMonthArea"></div>
            </div>

            <div class="exp-section exp-grid-2col">
                <div class="exp-tag-row col-left" id="expSortArea"></div>
                <div class="exp-tag-row col-right" id="expFormatArea"></div>
                <div class="exp-tag-row col-left" id="expWidthArea"></div>
                <div class="exp-tag-row col-right" id="expOptionsArea"></div>
            </div>

            <div class="exp-section">
                <div class="exp-tag-grid" id="expColGridGeneral"></div>
            </div>

            <div class="exp-section">
                <div class="exp-tag-grid" id="expColGridCommute"></div>
            </div>

        </div>
        <div class="modal-footer" style="padding:8px; background:#e2e8f0; border-top: 1px solid #cbd5e1;">
            <button type="button" class="w95-btn" style="width:100%; height:34px; font-size:0.95rem; font-weight:900; color:#ffffff; background:#2563eb; border-color:#1d4ed8 #60a5fa #60a5fa #1d4ed8;" onclick="window.WorkExportUI.triggerExport()">생성</button>
        </div>
    </div>
</div>

<div id="exportTagEditModal" class="modal-overlay" style="z-index: 5500; display: none; background: rgba(0,0,0,0.3);">
    <div class="modal-box w95-window" style="max-width: 260px;">
        <div class="w95-titlebar"><span>항목 편집</span></div>
        <div style="padding:8px; background:var(--w-gray);">
            <input type="hidden" id="editExportTargetId">
            <div style="display:flex; align-items:center; gap:6px; margin-bottom: 6px;">
                <input type="number" id="editExportOrderInput" class="w95-in" style="width:40px; height:26px; text-align:center; font-weight:bold;">
                <input type="text" id="editExportNameInput" class="w95-in" style="flex:1; height:26px; padding:0 5px;">
            </div>
            <div style="display:flex; gap:6px;">
                <button type="button" class="w95-btn" style="flex:1;" onclick="window.WorkExportUI.closeEditModal()">취소</button>
                <button type="button" class="w95-btn" style="flex:1; color:var(--w-blue); font-weight:bold;" onclick="window.WorkExportUI.saveEditModal()">적용</button>
            </div>
        </div>
    </div>
</div>
`;