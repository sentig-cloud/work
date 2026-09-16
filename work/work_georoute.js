// work_georoute.js
// 주간표 요일 헤더 / 월간 달력 날짜를 롱프레스하면, 그날 등록된 카드들의 주소를 모아
// 좌표로 변환하고(카카오 지오코딩), 순서·거리와 함께 미니 카카오맵에 번호 핀으로 찍어
// 보여주는 "동선 관리" 팝업을 연다. 지도의 번호 핀을 누르면 그 지점 하나만, 빈 공간을
// 누르면 그날 전체 동선을 순서대로 보여준다. 각 항목에는 현재 위치에서 그곳까지 자동차로
// 걸리는 시간(카카오 모빌리티 실시간 길찾기)이 같이 표시된다. 목록의 길찾기 아이콘은
// 작업일지 상의 지도 버튼(startMapPress/endMapPress)과 똑같이 짧게 누르면 앱 선택 팝업,
// 길게 누르면 마지막에 쓴(또는 설정에서 고른) 지도 앱으로 바로 이동한다.

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

let geoRouteRequestId = 0;
let geoRouteCurrentResults = [];
let geoRouteCurrentTotal = 0;
let geoRouteSelectedIdx = null; // null = 전체 동선 보기, 숫자면 그 지점만 보기

// ─── 현재 위치 → 자동차 이동시간(카카오 모빌리티 실제 도로/교통 기반 길찾기) ───
function formatDurationSec(sec) {
    const minutes = Math.max(1, Math.round(sec / 60));
    if (minutes < 60) return `${minutes}분`;
    return `${Math.floor(minutes / 60)}시간 ${minutes % 60}분`;
}

let geoRouteUserLocation = null;
let geoRouteUserLocationPromise = null;
function ensureUserLocation() {
    if (geoRouteUserLocation) return Promise.resolve(geoRouteUserLocation);
    if (geoRouteUserLocationPromise) return geoRouteUserLocationPromise;
    geoRouteUserLocationPromise = new Promise(resolve => {
        if (!navigator.geolocation) { resolve(null); return; }
        navigator.geolocation.getCurrentPosition(
            pos => { geoRouteUserLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude }; resolve(geoRouteUserLocation); },
            () => resolve(null),
            { timeout: 8000, maximumAge: 300000 }
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
        el.classList.toggle('is-selected', geoRouteSelectedIdx !== null && Number(el.dataset.idx) === geoRouteSelectedIdx);
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
    if (points.length === 0) return;

    const bounds = new kakao.maps.LatLngBounds();
    results.forEach((item, idx) => {
        const geo = item.geo;
        if (!(geo && geo.ok && typeof geo.lat === 'number' && typeof geo.lng === 'number')) return;
        const position = new kakao.maps.LatLng(geo.lat, geo.lng);
        bounds.extend(position);

        const pinEl = document.createElement('div');
        pinEl.className = 'geo-route-map-pin';
        pinEl.dataset.idx = idx;
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

    if (points.length === 1) {
        geoRouteMapInstance.setCenter(new kakao.maps.LatLng(points[0].geo.lat, points[0].geo.lng));
        geoRouteMapInstance.setLevel(4);
    } else {
        geoRouteMapInstance.setBounds(bounds);
    }
    refreshPinHighlight();
}

// ─── 날짜 전환 태그(그 주 월~일) ───
function renderGeoRouteDateChips(year, month, day) {
    const container = document.getElementById('geoRouteDateChips');
    if (!container || !window.WorkTimetable) return;
    const monday = window.WorkTimetable.mondayOf(new Date(year, month - 1, day));
    const days = window.WorkTimetable.weekDays(monday);
    const labels = window.WorkTimetable.DAY_LABELS;
    container.innerHTML = days.map((d, i) => {
        const isActive = d.getFullYear() === year && d.getMonth() + 1 === month && d.getDate() === day;
        return `<button type="button" class="w95-btn geo-route-date-chip${isActive ? ' is-active' : ''}" data-y="${d.getFullYear()}" data-m="${d.getMonth() + 1}" data-d="${d.getDate()}">
            <span>${labels[i]}</span><span>${d.getDate()}</span>
        </button>`;
    }).join('');
    container.querySelectorAll('.geo-route-date-chip').forEach(btn => {
        btn.addEventListener('click', () => {
            window.openGeoRouteModal(Number(btn.dataset.y), Number(btn.dataset.m), Number(btn.dataset.d));
        });
    });
}

// ─── 목록 카드 ───
function buildItemCardHtml(item, idx) {
    const { log, address, geo, eta } = item;
    const hasCoords = !!(geo && geo.ok && typeof geo.lat === 'number' && typeof geo.lng === 'number');
    const timeText = log.workTime || log.time || '';
    const nameText = log.customerName || log.content || log.taskType || '';
    const resolvedAddr = (geo && (geo.roadAddress || geo.jibunAddress)) || '';
    const statusHtml = hasCoords
        ? (resolvedAddr ? `<div class="geo-route-address-resolved">${escapeHtml(resolvedAddr)}</div>` : '')
        : `<div class="geo-route-address-failed">⚠ 위치를 찾지 못했습니다${geo?.error ? ` (${escapeHtml(geo.error)})` : ''}</div>`;

    // 현재 위치 → 이 지점까지 자동차 소요시간(카카오 모빌리티). 아직 계산 전이면 비워둔다.
    const etaHtml = (eta && eta.ok && typeof eta.durationSec === 'number')
        ? `<span class="geo-route-eta" title="현재 위치에서 자동차로 약 ${formatDurationSec(eta.durationSec)}"><i class="fa-solid fa-car"></i> ${formatDurationSec(eta.durationSec)}</span>`
        : '';

    const navBtn = hasCoords
        ? `<button type="button" class="w95-btn geo-route-nav-icon-btn" data-lat="${geo.lat}" data-lng="${geo.lng}" data-addr="${escapeHtml(resolvedAddr || address)}" title="길찾기"><i class="fa-solid fa-diamond-turn-right"></i></button>`
        : '';

    return `<div class="geo-route-item">
        <div class="geo-route-item-head">
            <span class="geo-route-order">${idx + 1}</span>
            ${timeText ? `<span class="geo-route-time">${escapeHtml(timeText)}</span>` : ''}
            ${nameText ? `<span class="geo-route-name">${escapeHtml(nameText)}</span>` : ''}
            ${etaHtml}
            ${navBtn}
        </div>
        <div class="geo-route-address-original">${escapeHtml(address)}</div>
        ${statusHtml}
    </div>`;
}

// 목록의 길찾기 아이콘 = 작업일지 상 지도 버튼과 동일한 짧게/길게 누르기 동작
// (work_ui.js의 window.startMapPress/endMapPress 재사용, 대상 좌표만 눌린 항목 것으로 지정)
function wireGeoRouteListInteractions(list) {
    list.querySelectorAll('.geo-route-nav-icon-btn').forEach(btn => {
        const lat = parseFloat(btn.dataset.lat);
        const lng = parseFloat(btn.dataset.lng);
        const addr = btn.dataset.addr || '';
        const setTarget = (e) => {
            window.pendingMapTarget = { lat, lng, address: addr };
            window.startMapPress?.(e);
        };
        btn.addEventListener('mousedown', setTarget);
        btn.addEventListener('touchstart', setTarget);
        btn.addEventListener('mouseup', e => window.endMapPress?.(e));
        btn.addEventListener('touchend', e => window.endMapPress?.(e));
    });
}

function renderGeoRouteList() {
    const list = document.getElementById('geoRouteList');
    if (!list) return;
    const results = geoRouteCurrentResults;

    if (geoRouteSelectedIdx !== null && results[geoRouteSelectedIdx]) {
        const idx = geoRouteSelectedIdx;
        list.innerHTML =
            `<div class="geo-route-back-all">← 전체 동선 보기 (${geoRouteCurrentTotal}건)</div>` +
            buildItemCardHtml(results[idx], idx);
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

    let prevPoint = null;
    let totalKm = 0;

    const itemsHtml = results.map((item, idx) => {
        const geo = item.geo;
        const hasCoords = !!(geo && geo.ok && typeof geo.lat === 'number' && typeof geo.lng === 'number');
        let distanceHtml = '';
        if (hasCoords && prevPoint) {
            const d = window.haversineKm(prevPoint.lat, prevPoint.lng, geo.lat, geo.lng);
            totalKm += d;
            distanceHtml = `<div class="geo-route-distance">↓ 이전 지점에서 약 ${d.toFixed(1)}km</div>`;
        }
        if (hasCoords) prevPoint = geo;
        return `${distanceHtml}${buildItemCardHtml(item, idx)}`;
    }).join('');

    const pendingCount = geoRouteCurrentTotal - results.length;
    const pendingHtml = pendingCount > 0 ? `<div class="geo-route-empty">나머지 ${pendingCount}건 확인 중...</div>` : '';
    const summaryHtml = totalKm > 0
        ? `<div class="geo-route-summary">이동 예상 거리(직선) 합계: 약 ${totalKm.toFixed(1)}km</div>`
        : '';

    list.innerHTML = itemsHtml + pendingHtml + summaryHtml;
    wireGeoRouteListInteractions(list);
    refreshPinHighlight();
}

window.openGeoRouteModal = async (year, month, day) => {
    const modal = document.getElementById('geoRouteModal');
    const list = document.getElementById('geoRouteList');
    const title = document.getElementById('geoRouteTitle');
    if (!modal || !list || !title) return;

    const myRequestId = ++geoRouteRequestId;
    geoRouteSelectedIdx = null;
    const weekdayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const weekday = weekdayNames[new Date(year, month - 1, day).getDay()];
    title.textContent = `동선 관리 · ${month}/${day}(${weekday})`;
    modal.style.display = 'flex';
    renderGeoRouteDateChips(year, month, day);
    ensureUserLocation(); // 위치 권한 요청을 미리 시작해둔다 (지오코딩과 병렬로 진행)

    const dayLogs = (window.logs || [])
        .filter(l => l && l.y === year && l.m === month && l.d === day && l.address && String(l.address).trim())
        .sort((a, b) => String(a.workTime || a.time || '').localeCompare(String(b.workTime || b.time || '')));

    geoRouteCurrentResults = [];
    geoRouteCurrentTotal = dayLogs.length;

    if (dayLogs.length === 0) {
        list.innerHTML = `<div class="geo-route-empty">이 날짜에 주소가 등록된 카드가 없습니다.</div>`;
        clearGeoRouteMapOverlays();
        return;
    }

    list.innerHTML = `<div class="geo-route-empty">주소 ${dayLogs.length}건 위치 확인 중...</div>`;

    for (const log of dayLogs) {
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
        // 그 사이 다른 날짜로 다시 열었으면 이 결과는 버린다 (중복/반복 렌더 방지)
        if (myRequestId !== geoRouteRequestId) return;
        geoRouteCurrentResults.push({ log, address, geo, eta: undefined });
        renderGeoRouteList();
        updateGeoRouteMap(geoRouteCurrentResults);
    }

    // 주소 지오코딩이 모두 끝난 뒤, 현재 위치 기준 자동차 소요시간을 순서대로 채운다.
    // (위치 요청은 위에서 미리 시작해뒀으니 대부분 이미 끝나있거나 곧 끝난다)
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
};

window.closeGeoRouteModal = () => {
    geoRouteRequestId++; // 진행 중이던 지오코딩 결과가 더 이상 반영되지 않게 한다
    geoRouteSelectedIdx = null;
    const modal = document.getElementById('geoRouteModal');
    if (modal) modal.style.display = 'none';
};
