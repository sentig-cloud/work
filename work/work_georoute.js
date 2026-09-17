// work_georoute.js
// 주간표 요일 헤더 / 월간 달력 날짜를 롱프레스하면, 그날(또는 여러 날) 등록된 카드들의
// 주소를 모아 좌표로 변환하고(카카오 지오코딩), 현재 위치 기준 자동차 소요시간·거리와
// 함께 미니 카카오맵에 번호 핀으로 찍어 보여주는 "동선 관리" 팝업을 연다. 날짜 태그는
// 중복 선택 가능하며 요일마다 색이 고정되어(월=파랑, 화=주황 ...) 여러 날을 한 번에 겹쳐
// 봐도 구분된다. 지도의 번호 핀이나 목록 카드를 누르면 그 지점 하나만, 빈 공간을 누르면
// 전체 동선을 다시 보여준다. 카드를 길게 누르면 열려있는 팝업을 정리하고 그 작업일지
// 편집 화면으로 이동한다. 목록의 길찾기 아이콘은 작업일지 상의 지도 버튼과 동일하게
// 짧게 누르면 앱 선택 팝업, 길게 누르면 설정에서 고른 기본 지도 앱으로 바로 이동한다.

function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, ch => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
}

function geoCacheGet(address) {
    try {
        const cache = JSON.parse(localStorage.getItem('wm_geocode_cache') || '{}');
        return cache[address] || null;
    } catch {
        return null;
    }
}

function geoCacheSet(address, result) {
    try {
        const cache = JSON.parse(localStorage.getItem('wm_geocode_cache') || '{}');
        cache[address] = result;
        localStorage.setItem('wm_geocode_cache', JSON.stringify(cache));
    } catch {
        // 캐시 저장 실패는 기능에 영향 없으니 무시
    }
}

// ─── 동선 관리 설정: 기능 켜기/끄기, 내 위치 아이콘 ───
window.isGeoRouteEnabled = () => localStorage.getItem('wm_georoute_enabled') !== '0';
window.setGeoRouteEnabled = (enabled) => localStorage.setItem('wm_georoute_enabled', enabled ? '1' : '0');
window.GEO_ROUTE_LOC_ICONS = ['📍', '🔵', '🚩', '🧭'];
window.getGeoRouteLocIcon = () => localStorage.getItem('wm_georoute_loc_icon') || window.GEO_ROUTE_LOC_ICONS[0];
window.setGeoRouteLocIcon = (icon) => localStorage.setItem('wm_georoute_loc_icon', icon);
window.getGeoRouteFontScale = () => localStorage.getItem('wm_georoute_font_scale') || 'medium';
window.setGeoRouteFontScale = (scale) => localStorage.setItem('wm_georoute_font_scale', scale);

// 요일별 고정 색상(월=0 ... 일=6) — 여러 날을 동시에 선택했을 때 구분용
const GEO_ROUTE_DAY_COLORS = ['#2563eb', '#ea580c', '#16a34a', '#db2777', '#7c3aed', '#0891b2', '#dc2626'];
function dayColorFor(mondayIdx0) {
    return GEO_ROUTE_DAY_COLORS[((mondayIdx0 % 7) + 7) % 7];
}

let geoRouteRequestId = 0;
let geoRouteCurrentResults = []; // [{log,address,geo,eta,dayMeta}] — 여러 날을 합친 목록일 수 있음
let geoRouteCurrentTotal = 0;
let geoRouteSelectedIdx = null; // null = 전체 동선 보기, 숫자면 그 지점만 보기
let geoRouteAnchorMonday = null; // 날짜 태그 줄이 보여주는 주의 월요일
let geoRouteSelectedDays = []; // [{year,month,day}] 현재 선택된 날짜(들), 항상 1개 이상

// ─── 현재 위치 → 자동차 이동시간(카카오 모빌리티 실제 도로/교통 기반 길찾기) ───
function formatDurationSec(sec) {
    const minutes = Math.max(1, Math.round(sec / 60));
    if (minutes < 60) return `${minutes}분`;
    return `${Math.floor(minutes / 60)}시간 ${minutes % 60}분`;
}

let geoRouteUserLocation = null;
let geoRouteUserLocationPromise = null;
// 팝업을 새로 열 때마다 호출해서, 예전에 잡아둔 위치를 계속 재사용하지 않고 매번 새로
// GPS를 다시 잡게 한다 — 위치가 바뀐 채로 다시 열었는데 예전 위치가 남아있던 문제 수정.
function resetUserLocation() {
    geoRouteUserLocation = null;
    geoRouteUserLocationPromise = null;
}
function ensureUserLocation() {
    if (geoRouteUserLocation) return Promise.resolve(geoRouteUserLocation);
    if (geoRouteUserLocationPromise) return geoRouteUserLocationPromise;
    geoRouteUserLocationPromise = new Promise(resolve => {
        if (!navigator.geolocation) { resolve(null); return; }
        navigator.geolocation.getCurrentPosition(
            pos => {
                geoRouteUserLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                resolve(geoRouteUserLocation);
                updateGeoRouteMap(geoRouteCurrentResults); // 위치가 늦게 잡히면 마커를 다시 그려준다
            },
            () => resolve(null),
            { timeout: 8000, maximumAge: 0 }
        );
    });
    return geoRouteUserLocationPromise;
}

// ─── 카카오맵 SDK 지연 로딩 + 팝업 안의 미니맵(핀 찍기) ───
let kakaoMapsReadyPromise = null;
function ensureKakaoMapsReady() {
    if (kakaoMapsReadyPromise) return kakaoMapsReadyPromise;
    kakaoMapsReadyPromise = new Promise((resolve, reject) => {
        if (typeof kakao === 'undefined' || !kakao.maps) {
            reject(new Error('카카오맵 SDK를 불러오지 못했습니다.'));
            return;
        }
        kakao.maps.load(resolve);
    });
    return kakaoMapsReadyPromise;
}

let geoRouteMapInstance = null;
let geoRouteMapOverlays = [];

function clearGeoRouteMapOverlays() {
    geoRouteMapOverlays.forEach(ov => ov.setMap(null));
    geoRouteMapOverlays = [];
}

function refreshPinHighlight() {
    document.querySelectorAll('#geoRouteMap .geo-route-map-pin').forEach(el => {
        const isSelected = geoRouteSelectedIdx !== null && Number(el.dataset.idx) === geoRouteSelectedIdx;
        el.classList.toggle('is-selected', isSelected);
        el.style.background = isSelected ? '#f59e0b' : el.dataset.color;
    });
}

async function updateGeoRouteMap(results) {
    const container = document.getElementById('geoRouteMap');
    if (!container) return;
    try {
        await ensureKakaoMapsReady();
    } catch {
        container.textContent = '지도를 불러오지 못했습니다.';
        return;
    }

    if (!geoRouteMapInstance) {
        geoRouteMapInstance = new kakao.maps.Map(container, {
            center: new kakao.maps.LatLng(37.5665, 126.9780),
            level: 6
        });
        // 핀이 아닌 지도 빈 공간을 누르면 선택을 해제하고 전체 동선을 다시 보여준다.
        kakao.maps.event.addListener(geoRouteMapInstance, 'click', () => {
            geoRouteSelectedIdx = null;
            renderGeoRouteList();
        });
    }
    clearGeoRouteMapOverlays();
    geoRouteMapInstance.relayout();

    const points = results.filter(r => r.geo && r.geo.ok && typeof r.geo.lat === 'number' && typeof r.geo.lng === 'number');
    const bounds = new kakao.maps.LatLngBounds();

    // 항상 내 위치를 표시(가능한 경우) — 설정에서 고른 아이콘 사용
    if (geoRouteUserLocation) {
        const locPos = new kakao.maps.LatLng(geoRouteUserLocation.lat, geoRouteUserLocation.lng);
        bounds.extend(locPos);
        const locEl = document.createElement('div');
        locEl.className = 'geo-route-my-location';
        locEl.textContent = window.getGeoRouteLocIcon();
        const locOverlay = new kakao.maps.CustomOverlay({ position: locPos, content: locEl, yAnchor: 0.5, zIndex: 20 });
        locOverlay.setMap(geoRouteMapInstance);
        geoRouteMapOverlays.push(locOverlay);
    }

    results.forEach((item, idx) => {
        const geo = item.geo;
        if (!(geo && geo.ok && typeof geo.lat === 'number' && typeof geo.lng === 'number')) return;
        const position = new kakao.maps.LatLng(geo.lat, geo.lng);
        bounds.extend(position);

        const pinEl = document.createElement('div');
        pinEl.className = 'geo-route-map-pin';
        pinEl.dataset.idx = idx;
        pinEl.dataset.color = item.dayMeta.color;
        pinEl.style.background = item.dayMeta.color;
        pinEl.innerHTML = `<span>${idx + 1}</span>`;
        // 즐겨찾기처럼: 번호 핀을 누르면 그 지점 하나만 목록에 보여준다.
        pinEl.addEventListener('click', (e) => {
            e.stopPropagation();
            geoRouteSelectedIdx = idx;
            renderGeoRouteList();
        });

        const overlay = new kakao.maps.CustomOverlay({ position, content: pinEl, yAnchor: 1 });
        overlay.setMap(geoRouteMapInstance);
        geoRouteMapOverlays.push(overlay);
    });

    if (points.length === 0) {
        if (geoRouteUserLocation) geoRouteMapInstance.setCenter(new kakao.maps.LatLng(geoRouteUserLocation.lat, geoRouteUserLocation.lng));
        refreshPinHighlight();
        return;
    }

    if (points.length === 1 && !geoRouteUserLocation) {
        geoRouteMapInstance.setCenter(new kakao.maps.LatLng(points[0].geo.lat, points[0].geo.lng));
        geoRouteMapInstance.setLevel(4);
    } else {
        geoRouteMapInstance.setBounds(bounds);
    }
    refreshPinHighlight();
}

// ─── 날짜 전환 태그(중복 선택 가능, 요일별 고정 색상, 이전/다음 주 이동) ───
function renderGeoRouteDateChips() {
    const container = document.getElementById('geoRouteDateChips');
    if (!container || !window.WorkTimetable || !geoRouteAnchorMonday) return;
    const days = window.WorkTimetable.weekDays(geoRouteAnchorMonday);
    const labels = window.WorkTimetable.DAY_LABELS;
    const chipsHtml = days.map((d, i) => {
        const isSelected = geoRouteSelectedDays.some(sd => sd.year === d.getFullYear() && sd.month === d.getMonth() + 1 && sd.day === d.getDate());
        const color = dayColorFor(i);
        const style = isSelected ? `background:${color} !important; border-color:${color}; color:#fff;` : '';
        return `<button type="button" class="w95-btn geo-route-date-chip${isSelected ? ' is-active' : ''}" style="${style}" data-y="${d.getFullYear()}" data-m="${d.getMonth() + 1}" data-d="${d.getDate()}">
            <span>${labels[i]}</span><span>${d.getDate()}</span>
        </button>`;
    }).join('');
    container.innerHTML = `
        <button type="button" class="w95-btn geo-route-week-nav-btn" id="geoRoutePrevWeekBtn" title="이전 주"><i class="fa-solid fa-chevron-left"></i></button>
        ${chipsHtml}
        <button type="button" class="w95-btn geo-route-week-nav-btn" id="geoRouteNextWeekBtn" title="다음 주"><i class="fa-solid fa-chevron-right"></i></button>
    `;
    container.querySelectorAll('.geo-route-date-chip').forEach(btn => {
        btn.addEventListener('click', () => toggleGeoRouteDay(Number(btn.dataset.y), Number(btn.dataset.m), Number(btn.dataset.d)));
    });
    document.getElementById('geoRoutePrevWeekBtn').addEventListener('click', () => shiftGeoRouteWeek(-1));
    document.getElementById('geoRouteNextWeekBtn').addEventListener('click', () => shiftGeoRouteWeek(1));
}

function shiftGeoRouteWeek(delta) {
    geoRouteAnchorMonday = new Date(geoRouteAnchorMonday.getFullYear(), geoRouteAnchorMonday.getMonth(), geoRouteAnchorMonday.getDate() + delta * 7);
    const days = window.WorkTimetable.weekDays(geoRouteAnchorMonday);
    // 주가 바뀌면 선택을 그 주 첫 날(월요일) 하나로 초기화한다.
    loadGeoRouteDays([{ year: days[0].getFullYear(), month: days[0].getMonth() + 1, day: days[0].getDate() }]);
}

function toggleGeoRouteDay(year, month, day) {
    const idx = geoRouteSelectedDays.findIndex(sd => sd.year === year && sd.month === month && sd.day === day);
    let next;
    if (idx >= 0) {
        if (geoRouteSelectedDays.length === 1) return; // 최소 1개는 항상 선택돼 있어야 한다.
        next = geoRouteSelectedDays.filter((_, i) => i !== idx);
    } else {
        next = [...geoRouteSelectedDays, { year, month, day }];
    }
    loadGeoRouteDays(next);
}

// ─── 목록 카드 ───
function buildItemCardHtml(item, idx, opts = {}) {
    const { log, address, geo, eta, dayMeta } = item;
    const hasCoords = !!(geo && geo.ok && typeof geo.lat === 'number' && typeof geo.lng === 'number');
    const timeText = log.workTime || log.time || '';
    const nameText = log.customerName || log.content || log.taskType || '';
    const resolvedAddr = (geo && (geo.roadAddress || geo.jibunAddress)) || '';
    const statusHtml = hasCoords
        ? (resolvedAddr ? `<div class="geo-route-address-resolved">${escapeHtml(resolvedAddr)}</div>` : '')
        : `<div class="geo-route-address-failed">⚠ 위치를 찾지 못했습니다${geo?.error ? ` (${escapeHtml(geo.error)})` : ''}</div>`;

    // 현재 위치 → 이 지점까지 거리 · 소요시간(카카오 모빌리티). 아직 계산 전이면 비워둔다.
    const etaHtml = (eta && eta.ok && typeof eta.durationSec === 'number')
        ? `<span class="geo-route-eta" title="현재 위치에서 자동차로 약 ${(eta.distanceM / 1000).toFixed(1)}km · 약 ${formatDurationSec(eta.durationSec)}"><i class="fa-solid fa-car"></i> ${(eta.distanceM / 1000).toFixed(1)}km · ${formatDurationSec(eta.durationSec)}</span>`
        : '';

    const navBtn = hasCoords
        ? `<button type="button" class="w95-btn geo-route-nav-icon-btn" data-lat="${geo.lat}" data-lng="${geo.lng}" data-addr="${escapeHtml(resolvedAddr || address)}" title="길찾기"><i class="fa-solid fa-diamond-turn-right"></i></button>`
        : '';

    const dayTagHtml = opts.showDayTag
        ? `<span class="geo-route-day-tag" style="background:${dayMeta.color};">${escapeHtml(dayMeta.label)}</span>`
        : '';

    return `<div class="geo-route-item" data-idx="${idx}" style="border-left:4px solid ${dayMeta.color};">
        ${dayTagHtml}
        <div class="geo-route-item-head">
            <span class="geo-route-order" style="background:${dayMeta.color};">${idx + 1}</span>
            ${timeText ? `<span class="geo-route-time">${escapeHtml(timeText)}</span>` : ''}
            <span class="geo-route-name">${escapeHtml(nameText || '(이름 없음)')}</span>
            ${etaHtml}
            ${navBtn}
        </div>
        <div class="geo-route-address-original">${escapeHtml(address)}</div>
        ${statusHtml}
    </div>`;
}

// 목록의 길찾기 아이콘 = 작업일지 상 지도 버튼과 동일한 짧게/길게 누르기 동작
// (work_ui.js의 window.startMapPress/endMapPress 재사용, 대상 좌표만 눌린 항목 것으로 지정)
// 카드 자체는 탭하면 그 항목만 선택(지도 핀과 동일), 길게 누르면 열려있는 팝업을 정리하고
// 그 작업일지 편집 화면으로 이동한다.
function wireGeoRouteListInteractions(list) {
    list.querySelectorAll('.geo-route-nav-icon-btn').forEach(btn => {
        const lat = parseFloat(btn.dataset.lat);
        const lng = parseFloat(btn.dataset.lng);
        const addr = btn.dataset.addr || '';
        const setTarget = (e) => {
            e.stopPropagation();
            window.pendingMapTarget = { lat, lng, address: addr };
            window.startMapPress?.(e);
        };
        btn.addEventListener('mousedown', setTarget);
        btn.addEventListener('touchstart', setTarget);
        btn.addEventListener('mouseup', e => { e.stopPropagation(); window.endMapPress?.(e); });
        btn.addEventListener('touchend', e => { e.stopPropagation(); window.endMapPress?.(e); });
    });

    list.querySelectorAll('.geo-route-item[data-idx]').forEach(card => {
        const idx = Number(card.dataset.idx);
        card.addEventListener('click', (e) => {
            if (e.target.closest('.geo-route-nav-icon-btn')) return;
            geoRouteSelectedIdx = idx;
            renderGeoRouteList();
            refreshPinHighlight();
        });
        window.attachLongPress?.(card, () => {
            const item = geoRouteCurrentResults[idx];
            if (!item) return;
            window.closeGeoRouteModal();
            window.closeMapAppModal?.();
            window.openWorkModal?.(item.log.id);
        }, { ignoreSelector: '.geo-route-nav-icon-btn' });
    });
}

function renderGeoRouteList() {
    const list = document.getElementById('geoRouteList');
    if (!list) return;
    const results = geoRouteCurrentResults;
    const multiDay = geoRouteSelectedDays.length > 1;

    if (geoRouteSelectedIdx !== null && results[geoRouteSelectedIdx]) {
        const idx = geoRouteSelectedIdx;
        list.innerHTML =
            `<div class="geo-route-back-all">← 전체 동선 보기 (${geoRouteCurrentTotal}건)</div>` +
            buildItemCardHtml(results[idx], idx, { showDayTag: multiDay });
        wireGeoRouteListInteractions(list);
        const backBtn = list.querySelector('.geo-route-back-all');
        if (backBtn) backBtn.addEventListener('click', () => {
            geoRouteSelectedIdx = null;
            renderGeoRouteList();
            refreshPinHighlight();
        });
        refreshPinHighlight();
        return;
    }

    const itemsHtml = results.map((item, idx) => buildItemCardHtml(item, idx, { showDayTag: multiDay })).join('');
    const pendingCount = geoRouteCurrentTotal - results.length;
    const pendingHtml = pendingCount > 0 ? `<div class="geo-route-empty">나머지 ${pendingCount}건 확인 중...</div>` : '';

    list.innerHTML = itemsHtml + pendingHtml;
    wireGeoRouteListInteractions(list);
    refreshPinHighlight();
}

async function loadGeoRouteDays(daysArr) {
    geoRouteSelectedDays = daysArr;
    geoRouteSelectedIdx = null;
    const myRequestId = ++geoRouteRequestId;

    const list = document.getElementById('geoRouteList');
    const title = document.getElementById('geoRouteTitle');
    if (!list || !title) return;

    const weekdayNames = ['일', '월', '화', '수', '목', '금', '토'];
    title.textContent = daysArr.length === 1
        ? `동선 관리 · ${daysArr[0].month}/${daysArr[0].day}(${weekdayNames[new Date(daysArr[0].year, daysArr[0].month - 1, daysArr[0].day).getDay()]})`
        : `동선 관리 · ${daysArr.length}일 선택됨`;

    renderGeoRouteDateChips();
    ensureUserLocation(); // 위치 권한 요청을 미리 시작해둔다 (지오코딩과 병렬로 진행)

    const dayMetas = daysArr.map(dd => {
        const dow = new Date(dd.year, dd.month - 1, dd.day).getDay(); // 0=일
        const mon0 = (dow + 6) % 7; // 0=월 ... 6=일
        return { ...dd, color: dayColorFor(mon0), label: `${dd.month}/${dd.day}(${weekdayNames[dow]})` };
    });

    let combined = [];
    for (const dm of dayMetas) {
        const logsForDay = (window.logs || [])
            .filter(l => l && l.y === dm.year && l.m === dm.month && l.d === dm.day && l.address && String(l.address).trim())
            .map(l => ({ log: l, dayMeta: dm }));
        combined.push(...logsForDay);
    }
    combined.sort((a, b) => {
        const ka = `${a.dayMeta.year}-${String(a.dayMeta.month).padStart(2, '0')}-${String(a.dayMeta.day).padStart(2, '0')}`;
        const kb = `${b.dayMeta.year}-${String(b.dayMeta.month).padStart(2, '0')}-${String(b.dayMeta.day).padStart(2, '0')}`;
        if (ka !== kb) return ka.localeCompare(kb);
        return String(a.log.workTime || a.log.time || '').localeCompare(String(b.log.workTime || b.log.time || ''));
    });

    geoRouteCurrentResults = [];
    geoRouteCurrentTotal = combined.length;

    if (combined.length === 0) {
        list.innerHTML = `<div class="geo-route-empty">선택한 날짜에 주소가 등록된 카드가 없습니다.</div>`;
        clearGeoRouteMapOverlays();
        return;
    }

    list.innerHTML = `<div class="geo-route-empty">주소 ${combined.length}건 위치 확인 중...</div>`;

    for (const { log, dayMeta } of combined) {
        const address = String(log.address).trim();
        let geo = geoCacheGet(address);
        if (!geo) {
            try {
                geo = await window.geocodeAddress(address);
                geoCacheSet(address, geo);
            } catch (e) {
                geo = { ok: false, error: e.message || '변환 실패' };
            }
        }
        // 그 사이 다른 날짜(들)로 다시 열었으면 이 결과는 버린다 (중복/반복 렌더 방지)
        if (myRequestId !== geoRouteRequestId) return;
        geoRouteCurrentResults.push({ log, address, geo, eta: undefined, dayMeta });
        renderGeoRouteList();
        updateGeoRouteMap(geoRouteCurrentResults);
    }

    // 주소 지오코딩이 모두 끝난 뒤, 현재 위치 기준 자동차 거리/소요시간을 순서대로 채운다.
    const userLoc = await ensureUserLocation();
    if (myRequestId !== geoRouteRequestId || !userLoc) return;
    for (const item of geoRouteCurrentResults) {
        if (myRequestId !== geoRouteRequestId) return;
        if (!(item.geo && item.geo.ok)) { item.eta = null; continue; }
        try {
            item.eta = await window.fetchDrivingRoute(userLoc.lat, userLoc.lng, item.geo.lat, item.geo.lng);
        } catch (e) {
            item.eta = null;
        }
        if (myRequestId !== geoRouteRequestId) return;
        renderGeoRouteList();
    }
}

// ─── 목록 높이 기억 + 드래그로 조절 (기본은 남는 공간을 다 채워서 작업일지 팝업처럼 크게) ───
function applyGeoRouteListHeight() {
    const list = document.querySelector('#geoRouteModal .geo-route-list-scroll');
    if (!list) return;
    const saved = parseInt(localStorage.getItem('wm_georoute_list_height') || '', 10);
    if (saved && saved > 80) {
        list.style.flex = 'none';
        list.style.height = `${saved}px`;
    } else {
        list.style.flex = '1';
        list.style.height = '';
    }
}

function wireGeoRouteResizeHandle() {
    const handle = document.getElementById('geoRouteResizeHandle');
    const list = document.querySelector('#geoRouteModal .geo-route-list-scroll');
    if (!handle || !list || handle.dataset.wired) return;
    handle.dataset.wired = '1';
    let startY = 0, startHeight = 0;
    const onMove = (e) => {
        const dy = e.clientY - startY;
        const newHeight = Math.max(100, Math.min(window.innerHeight * 0.75, startHeight + dy));
        list.style.flex = 'none';
        list.style.height = `${newHeight}px`;
    };
    const onEnd = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onEnd);
        localStorage.setItem('wm_georoute_list_height', String(Math.round(list.getBoundingClientRect().height)));
    };
    handle.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        startY = e.clientY;
        startHeight = list.getBoundingClientRect().height;
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onEnd);
    });
}

function applyGeoRouteFontScale() {
    const modal = document.getElementById('geoRouteModal');
    if (!modal) return;
    modal.classList.remove('geo-route-scale-small', 'geo-route-scale-medium', 'geo-route-scale-large');
    modal.classList.add(`geo-route-scale-${window.getGeoRouteFontScale()}`);
}

window.openGeoRouteModal = (year, month, day) => {
    if (!window.isGeoRouteEnabled()) return;
    const modal = document.getElementById('geoRouteModal');
    if (!modal) return;
    modal.style.display = 'flex';
    resetUserLocation(); // 팝업을 새로 열 때마다 항상 지금 위치를 새로 잡는다
    applyGeoRouteListHeight();
    applyGeoRouteFontScale();
    wireGeoRouteResizeHandle();
    geoRouteAnchorMonday = window.WorkTimetable
        ? window.WorkTimetable.mondayOf(new Date(year, month - 1, day))
        : new Date(year, month - 1, day);
    loadGeoRouteDays([{ year, month, day }]);
};

window.closeGeoRouteModal = () => {
    geoRouteRequestId++; // 진행 중이던 지오코딩/소요시간 결과가 더 이상 반영되지 않게 한다
    geoRouteSelectedIdx = null;
    const modal = document.getElementById('geoRouteModal');
    if (modal) modal.style.display = 'none';
};
