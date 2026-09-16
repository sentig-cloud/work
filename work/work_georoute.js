// work_georoute.js
// 주간표 요일 헤더 / 월간 달력 날짜를 롱프레스하면, 그날 등록된 카드들의 주소를 모아
// 좌표로 변환하고(카카오 지오코딩), 순서·거리를 보여주는 "동선 관리" 팝업을 연다.
// 지도 SDK를 새로 붙이는 대신 이미 있는 텍스트 주소를 그대로 활용해서, 기존 지도 앱
// 연결(T맵/네이버지도/카카오맵)로 좌표 기반 길찾기까지 바로 이어지게 한다.

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

window.openGeoRouteModal = async (year, month, day) => {
    const modal = document.getElementById('geoRouteModal');
    const list = document.getElementById('geoRouteList');
    const title = document.getElementById('geoRouteTitle');
    if (!modal || !list || !title) return;

    const myRequestId = ++geoRouteRequestId;
    const weekdayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const weekday = weekdayNames[new Date(year, month - 1, day).getDay()];
    title.textContent = `동선 관리 · ${month}/${day}(${weekday})`;
    modal.style.display = 'flex';

    const dayLogs = (window.logs || [])
        .filter(l => l && l.y === year && l.m === month && l.d === day && l.address && String(l.address).trim())
        .sort((a, b) => String(a.workTime || a.time || '').localeCompare(String(b.workTime || b.time || '')));

    if (dayLogs.length === 0) {
        list.innerHTML = `<div class="geo-route-empty">이 날짜에 주소가 등록된 카드가 없습니다.</div>`;
        return;
    }

    list.innerHTML = `<div class="geo-route-empty">주소 ${dayLogs.length}건 위치 확인 중...</div>`;

    const results = [];
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
        results.push({ log, address, geo });
        renderGeoRouteList(results, dayLogs.length);
    }
};

function renderGeoRouteList(results, totalCount) {
    const list = document.getElementById('geoRouteList');
    if (!list) return;

    let prevPoint = null;
    let totalKm = 0;

    const itemsHtml = results.map(({ log, address, geo }, idx) => {
        const hasCoords = !!(geo && geo.ok && typeof geo.lat === 'number' && typeof geo.lng === 'number');
        let distanceHtml = '';
        if (hasCoords && prevPoint) {
            const d = window.haversineKm(prevPoint.lat, prevPoint.lng, geo.lat, geo.lng);
            totalKm += d;
            distanceHtml = `<div class="geo-route-distance">↓ 이전 지점에서 약 ${d.toFixed(1)}km</div>`;
        }
        if (hasCoords) prevPoint = geo;

        const timeText = log.workTime || log.time || '';
        const resolvedAddr = geo && (geo.roadAddress || geo.jibunAddress) || '';
        const statusHtml = hasCoords
            ? (resolvedAddr ? `<div class="geo-route-address-resolved">${escapeHtml(resolvedAddr)}</div>` : '')
            : `<div class="geo-route-address-failed">⚠ 위치를 찾지 못했습니다${geo?.error ? ` (${escapeHtml(geo.error)})` : ''}</div>`;

        const navBtn = hasCoords
            ? `<button type="button" class="w95-btn geo-route-nav-btn" data-lat="${geo.lat}" data-lng="${geo.lng}" data-addr="${escapeHtml(resolvedAddr || address)}"><i class="fa-solid fa-diamond-turn-right"></i> 길찾기</button>`
            : '';

        return `${distanceHtml}<div class="geo-route-item">
            <div class="geo-route-item-head">
                <span class="geo-route-order">${idx + 1}</span>
                ${timeText ? `<span class="geo-route-time">${escapeHtml(timeText)}</span>` : ''}
            </div>
            <div class="geo-route-address-original">${escapeHtml(address)}</div>
            ${statusHtml}
            ${navBtn}
        </div>`;
    }).join('');

    const pendingCount = totalCount - results.length;
    const pendingHtml = pendingCount > 0 ? `<div class="geo-route-empty">나머지 ${pendingCount}건 확인 중...</div>` : '';
    const summaryHtml = totalKm > 0
        ? `<div class="geo-route-summary">이동 예상 거리(직선) 합계: 약 ${totalKm.toFixed(1)}km</div>`
        : '';

    list.innerHTML = itemsHtml + pendingHtml + summaryHtml;

    list.querySelectorAll('.geo-route-nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            window.openGeoRouteNav(parseFloat(btn.dataset.lat), parseFloat(btn.dataset.lng), btn.dataset.addr || '');
        });
    });
}

window.openGeoRouteNav = (lat, lng, address) => {
    window.pendingMapTarget = { lat, lng, address };
    const mapModal = document.getElementById('mapAppModal');
    if (mapModal) mapModal.style.display = 'flex';
};

window.closeGeoRouteModal = () => {
    geoRouteRequestId++; // 진행 중이던 지오코딩 결과가 더 이상 반영되지 않게 한다
    const modal = document.getElementById('geoRouteModal');
    if (modal) modal.style.display = 'none';
};
