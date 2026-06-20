// ==========================================================================
// Gourmet Map (맛집 지도) - Application Core Logic with Full Menu Actions
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
  // 1. 기본 제공 로컬 맛집 데이터셋
  const defaultGourmetData = [
    {
      id: 'sundaeguk',
      name: '순창 할머니 순대국',
      user: "김지평's Pork Belly",
      category: '한식',
      emoji: '🍲',
      text: '진짜 오래된 노포. 국물이 끝내줌! 머리고기도 엄청 부드럽고 가성비 최고예요. 요즘 이런 곳 찾기 힘든데 찐입니다.',
      time: '13시간 전',
      image: 'images/sundaeguk.png',
      coords: [37.5559, 126.9723], // 서울역 부근
      likes: 42,
      comments: 7,
      routePoints: [
        [37.5500, 126.9500], // 출발지 기본 모킹 좌표
        [37.5512, 126.9580], // 거점 1
        [37.5540, 126.9650], // 거점 2
        [37.5559, 126.9723]  // 도착지
      ]
    },
    {
      id: 'dakgalbi',
      name: '마포 진품 닭갈비',
      user: "박철수's Stew",
      category: '찜탕',
      emoji: '🥘',
      text: '광고 아님. 친구랑 우연히 골목 돌다가 발견했는데 양도 많고 깻잎 향이 엄청나요! 볶음밥에 치즈 사리 추가는 필수입니다.',
      time: '11시간 전',
      image: 'images/dakgalbi.png',
      coords: [37.5401, 126.9452], // 마포역 부근
      likes: 29,
      comments: 3,
      routePoints: [
        [37.5500, 126.9500], // 출발지 기본 모킹 좌표
        [37.5465, 126.9485], // 거점 1
        [37.5420, 126.9465], // 거점 2
        [37.5401, 126.9452]  // 도착지
      ]
    },
    {
      id: 'tteokbokki',
      name: '활애집 떡볶이',
      user: "왕예림's Nxen",
      category: '분식',
      emoji: '🍢',
      text: '사장님 친절하시고 가성비 최고. 떡볶이 국물에 튀김 범벅해서 먹으면 천국입니다. 옛날 학교 앞 분식집 맛 그대로예요!',
      time: '13시간 전',
      image: 'images/tteokbokki.png',
      coords: [37.5598, 126.9244], // 홍대입구역 부근
      likes: 56,
      comments: 12,
      routePoints: [
        [37.5500, 126.9500], // 출발지 기본 모킹 좌표
        [37.5535, 126.9410], // 거점 1
        [37.5570, 126.9320], // 거점 2
        [37.5598, 126.9244]  // 도착지
      ]
    }
  ];

  // 2. 상태 관리 (State)
  let mapEngine = 'fallback'; // 'kakao' or 'fallback' (Leaflet)
  let map = null; // 지도 인스턴스
  let leafletTileLayer = null; // Leaflet 타일 레이어 레퍼런스
  let currentTheme = localStorage.getItem('gourmet_theme') || 'dark'; // 테마 모드 ('dark' or 'light')
  document.documentElement.setAttribute('data-theme', currentTheme);
  
  // 사용자가 제공한 기본 카카오맵 API Key
  const DEFAULT_KAKAO_KEY = '3feeb11c8b85ba1f65ff27e82eb653ba';

  // 맛집 목록 (로컬스토리지 보존 및 초기화)
  let gourmetList = [];
  const storedList = localStorage.getItem('gourmet_list');
  if (storedList) {
    gourmetList = JSON.parse(storedList);
    // 기존 구버전 카테고리 데이터 마이그레이션
    let migrated = false;
    gourmetList.forEach(item => {
      if (item.category === '순대국') {
        item.category = '한식';
        item.emoji = '🍲';
        migrated = true;
      } else if (item.category === '닭갈비') {
        item.category = '찜탕';
        item.emoji = '🥘';
        migrated = true;
      } else if (item.category === '떡볶이') {
        item.category = '분식';
        item.emoji = '🍢';
        migrated = true;
      }
    });
    if (migrated) {
      localStorage.setItem('gourmet_list', JSON.stringify(gourmetList));
    }
  } else {
    gourmetList = [...defaultGourmetData];
    localStorage.setItem('gourmet_list', JSON.stringify(gourmetList));
  }

  // 필터 모드 ('all' or 'favorites')
  let filterMode = 'all';

  // 마커 및 오버레이 캐시
  const markers = {}; 
  let userLocationMarker = null;
  let activeRouteLine = null;
  let activeRouteId = null;
  let activePopupOverlay = null; // 카카오맵용 팝업 오버레이
  const userStartCoords = [37.5500, 126.9500]; // 현위치 기본값
  let activeCardId = null;

  // 3. 앱 초기 구동 조율
  function initApp() {
    renderFeed(getActiveList());
    bindUIEvents();
    bindMenuModalsEvents();
    applyAdSenseVisibility();

    // 빌트인 키를 이용해 백그라운드에서 카카오맵 로드 개시
    tryLoadKakaoSdk(DEFAULT_KAKAO_KEY);

    // PC/모바일 반응형 레이아웃 변환 시 지도가 찌그러지는 현상 방지
    let lastWidth = window.innerWidth;
    window.addEventListener('resize', () => {
      const currentWidth = window.innerWidth;
      if ((lastWidth < 768 && currentWidth >= 768) || (lastWidth >= 768 && currentWidth < 768)) {
        setTimeout(() => {
          if (map) {
            if (mapEngine === 'kakao') {
              map.relayout();
            } else {
              map.invalidateSize();
            }
          }
        }, 300);
      }
      lastWidth = currentWidth;
    });
  }

  // 4. 활성화된 리스트 가져오기 (전체 vs 즐겨찾기 필터)
  function getActiveList() {
    if (filterMode === 'favorites') {
      return gourmetList.filter(item => {
        return localStorage.getItem(`likes_active_${item.id}`) === 'true';
      });
    }
    return gourmetList;
  }

  // 5. 기존 지도 완전 파괴 및 캐시 클리어
  function destroyCurrentMap() {
    Object.keys(markers).forEach(id => delete markers[id]);
    userLocationMarker = null;
    activeRouteLine = null;
    activeRouteId = null;
    activePopupOverlay = null;
    activeCardId = null;
    leafletTileLayer = null;

    if (map) {
      if (mapEngine === 'fallback') {
        try {
          map.remove();
        } catch (e) {
          console.warn('Leaflet removal failed', e);
        }
      }
      map = null;
    }

    const mapDiv = document.getElementById('map');
    mapDiv.className = ''; 
    mapDiv.innerHTML = ''; 
  }

  // 6. 카카오 맵 SDK 동적 로더
  function tryLoadKakaoSdk(appKey) {
    const oldScript = document.getElementById('kakao-map-script');
    if (oldScript) oldScript.remove();

    if (window.kakao) delete window.kakao;

    const script = document.createElement('script');
    script.id = 'kakao-map-script';
    script.type = 'text/javascript';
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false`;

    script.onload = () => {
      kakao.maps.load(() => {
        try {
          initKakaoMap();
        } catch (err) {
          console.error('Kakao Map initialization error:', err);
          initLeafletMap(); 
        }
      });
    };

    script.onerror = () => {
      console.error('Kakao Map script load failed.');
      initLeafletMap(); 
    };

    document.head.appendChild(script);
  }

  // 7. GPS 위치 수집 헬퍼 (설정값에 따른 고정밀 스위치 적용)
  function getUserCoordinates() {
    return new Promise((resolve) => {
      const isHighAccuracy = document.getElementById('gpsAccuracyToggle').checked;
      
      if (!navigator.geolocation) {
        resolve(userStartCoords);
        return;
      }
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve([position.coords.latitude, position.coords.longitude]);
        },
        (error) => {
          console.warn('Geolocation query failed, using default coordinates.', error);
          resolve(userStartCoords);
        },
        { enableHighAccuracy: isHighAccuracy, timeout: 3000, maximumAge: 0 }
      );
    });
  }

  // 8. 네이버 지도 모바일 길찾기 페이지 리다이렉트
  function redirectNaverMapRoute(newWindow, startCoords, item) {
    const sName = encodeURIComponent('현 위치');
    const eName = encodeURIComponent(item.name);
    const sx = startCoords[1]; 
    const sy = startCoords[0]; 
    const ex = item.coords[1]; 
    const ey = item.coords[0]; 

    const naverMapUrl = `https://m.map.naver.com/route.nhn?sname=${sName}&sx=${sx}&sy=${sy}&ename=${eName}&ex=${ex}&ey=${ey}&pathType=0`;

    showToast(`🧭 네이버 지도로 연동 중입니다...`);

    if (newWindow) {
      newWindow.location.href = naverMapUrl;
    } else {
      window.open(naverMapUrl, '_blank');
    }
  }

  // ==========================================================================
  // [A] 카카오맵 (Kakao Maps) 모드 가동부
  // ==========================================================================
  function initKakaoMap() {
    destroyCurrentMap();
    mapEngine = 'kakao';

    const container = document.getElementById('map');
    container.classList.add('kakao-dark-map');

    const options = {
      center: new kakao.maps.LatLng(37.5510, 126.9480),
      level: 5
    };
    map = new kakao.maps.Map(container, options);

    const zoomInBtn = document.getElementById('zoomInBtn');
    const zoomOutBtn = document.getElementById('zoomOutBtn');
    const newZoomIn = zoomInBtn.cloneNode(true);
    const newZoomOut = zoomOutBtn.cloneNode(true);
    zoomInBtn.parentNode.replaceChild(newZoomIn, zoomInBtn);
    zoomOutBtn.parentNode.replaceChild(newZoomOut, zoomOutBtn);

    newZoomIn.addEventListener('click', () => map.setLevel(map.getLevel() - 1, { animate: true }));
    newZoomOut.addEventListener('click', () => map.setLevel(map.getLevel() + 1, { animate: true }));

    const myLocBtn = document.getElementById('myLocationBtn');
    const newMyLoc = myLocBtn.cloneNode(true);
    myLocBtn.parentNode.replaceChild(newMyLoc, myLocBtn);
    newMyLoc.addEventListener('click', () => locateUserKakao());

    renderKakaoMarkers(getActiveList());
  }

  function renderKakaoMarkers(dataList) {
    Object.keys(markers).forEach(id => {
      if (markers[id]) markers[id].setMap(null);
    });
    if (activePopupOverlay) {
      activePopupOverlay.setMap(null);
      activePopupOverlay = null;
    }

    dataList.forEach(item => {
      const position = new kakao.maps.LatLng(item.coords[0], item.coords[1]);

      const content = document.createElement('div');
      content.className = 'custom-div-icon';
      content.innerHTML = `
        <div class="marker-pin-wrapper" id="marker-${item.id}">
          <div class="marker-label">${item.user.split("'")[0]}</div>
          <div class="marker-pin">
            <span class="marker-icon-content">${item.emoji}</span>
          </div>
        </div>
      `;

      const customOverlay = new kakao.maps.CustomOverlay({
        position: position,
        content: content,
        yAnchor: 1.0
      });

      customOverlay.setMap(map);
      markers[item.id] = customOverlay;

      content.addEventListener('click', () => {
        openKakaoPopup(item);
        highlightFeedCard(item.id);
      });
    });
  }

  function openKakaoPopup(item) {
    if (activePopupOverlay) activePopupOverlay.setMap(null);

    const popupContent = document.createElement('div');
    popupContent.className = 'custom-overlay-popup';
    popupContent.innerHTML = `
      <div class="popup-container">
        <div class="popup-header">
          <span class="popup-title">${item.name}</span>
          <span class="popup-tag">${item.category}</span>
        </div>
        <p class="popup-desc">${item.text.substring(0, 30)}...</p>
        <div class="popup-actions">
          <button class="popup-route-btn" data-id="${item.id}">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
            </svg>
            길찾기 시작
          </button>
        </div>
      </div>
    `;

    popupContent.querySelector('.popup-route-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      startRoutingKakao(item.id);
      activePopupOverlay.setMap(null);
      activePopupOverlay = null;
    });

    const position = new kakao.maps.LatLng(item.coords[0], item.coords[1]);
    activePopupOverlay = new kakao.maps.CustomOverlay({
      position: position,
      content: popupContent,
      yAnchor: 1.6
    });

    activePopupOverlay.setMap(map);
  }

  async function locateUserKakao(coords = null) {
    let currentCoords = coords;
    if (!currentCoords) {
      showToast('🛰️ 실시간 GPS 현재 위치 파악 중...');
      currentCoords = await getUserCoordinates();
    }
    
    const latlng = new kakao.maps.LatLng(currentCoords[0], currentCoords[1]);
    map.panTo(latlng);

    if (userLocationMarker) {
      userLocationMarker.setMap(null);
    }

    const userContent = document.createElement('div');
    userContent.className = 'custom-div-icon';
    userContent.innerHTML = `<div class="user-marker-pulse"></div>`;

    userLocationMarker = new kakao.maps.CustomOverlay({
      position: latlng,
      content: userContent,
      zIndex: 10
    });
    userLocationMarker.setMap(map);

    showToast('📍 현재 내 위치가 지도에 반영되었습니다.');
    return currentCoords;
  }

  async function startRoutingKakao(restaurantId) {
    const item = gourmetList.find(d => d.id === restaurantId);
    if (!item) return;

    if (activeRouteId === restaurantId) {
      clearRouteKakao();
      updateRouteButtonsState(null);
      showToast('❌ 길찾기 경로가 해제되었습니다.');
      return;
    }

    const newWindow = window.open('about:blank', '_blank');
    if (newWindow) {
      newWindow.document.write(`
        <div style="background:#1E2022;color:#FFF;height:100vh;display:flex;flex-direction:column;justify-content:center;align-items:center;font-family:sans-serif;">
          <h3 style="margin-bottom:10px;">🧭 네이버 지도 길찾기 연결 중</h3>
          <p style="font-size:12px;color:#9AA0A6;">실시간 GPS 위치를 분석하고 있습니다. 잠시만 기다려 주세요...</p>
        </div>
      `);
    }

    showToast('🛰️ 실시간 GPS 현재 위치 파악 중...');
    const startCoords = await Promise.race([
      getUserCoordinates(),
      new Promise(r => setTimeout(() => r(userStartCoords), 3000))
    ]);

    await locateUserKakao(startCoords);

    if (activeRouteLine) activeRouteLine.setMap(null);

    const updatedRoutePoints = [
      [startCoords[0], startCoords[1]],
      ...item.routePoints.slice(1)
    ];

    const linePath = updatedRoutePoints.map(p => new kakao.maps.LatLng(p[0], p[1]));

    activeRouteLine = new kakao.maps.Polyline({
      path: linePath,
      strokeWeight: 5,
      strokeColor: '#FF5A36',
      strokeOpacity: 0.9,
      strokeStyle: 'solid'
    });

    activeRouteLine.setMap(map);
    activeRouteId = restaurantId;

    setTimeout(() => {
      document.querySelectorAll('#map svg path').forEach(path => {
        const stroke = path.getAttribute('stroke');
        if (stroke && (stroke.toLowerCase() === '#ff5a36' || stroke.toLowerCase() === 'rgb(255, 90, 54)')) {
          path.classList.add('route-path-animated');
        }
      });
    }, 50);

    const bounds = new kakao.maps.LatLngBounds();
    linePath.forEach(latlng => bounds.extend(latlng));
    map.setBounds(bounds);

    highlightFeedCard(restaurantId);
    updateRouteButtonsState(restaurantId);

    redirectNaverMapRoute(newWindow, startCoords, item);
  }

  function clearRouteKakao() {
    if (activeRouteLine) {
      activeRouteLine.setMap(null);
      activeRouteLine = null;
    }
    activeRouteId = null;
  }

  // ==========================================================================
  // [B] Leaflet 폴백 (Fallback / 기본 데모) 가동부
  // ==========================================================================
  function applyLeafletTiles() {
    if (!map || mapEngine !== 'fallback') return;
    if (leafletTileLayer) {
      map.removeLayer(leafletTileLayer);
    }
    const tileUrl = currentTheme === 'light'
      ? 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
    leafletTileLayer = L.tileLayer(tileUrl, {
      maxZoom: 19
    }).addTo(map);
  }

  function initLeafletMap() {
    destroyCurrentMap();
    mapEngine = 'fallback';

    const container = document.getElementById('map');

    map = L.map('map', {
      zoomControl: false,
      attributionControl: false
    }).setView([37.5510, 126.9480], 13);

    applyLeafletTiles();

    const zoomInBtn = document.getElementById('zoomInBtn');
    const zoomOutBtn = document.getElementById('zoomOutBtn');
    const newZoomIn = zoomInBtn.cloneNode(true);
    const newZoomOut = zoomOutBtn.cloneNode(true);
    zoomInBtn.parentNode.replaceChild(newZoomIn, zoomInBtn);
    zoomOutBtn.parentNode.replaceChild(newZoomOut, zoomOutBtn);

    newZoomIn.addEventListener('click', () => map.zoomIn());
    newZoomOut.addEventListener('click', () => map.zoomOut());

    const myLocBtn = document.getElementById('myLocationBtn');
    const newMyLoc = myLocBtn.cloneNode(true);
    myLocBtn.parentNode.replaceChild(newMyLoc, myLocBtn);
    newMyLoc.addEventListener('click', () => locateUserLeaflet());

    renderLeafletMarkers(getActiveList());
  }

  function renderLeafletMarkers(dataList) {
    Object.keys(markers).forEach(id => {
      if (markers[id]) map.removeLayer(markers[id]);
    });

    dataList.forEach(item => {
      const customIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `
          <div class="marker-pin-wrapper" id="marker-${item.id}">
            <div class="marker-label">${item.user.split("'")[0]}</div>
            <div class="marker-pin">
              <span class="marker-icon-content">${item.emoji}</span>
            </div>
          </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 40]
      });

      const marker = L.marker(item.coords, { icon: customIcon }).addTo(map);
      
      const popupContent = `
        <div class="popup-container">
          <div class="popup-header">
            <span class="popup-title">${item.name}</span>
            <span class="popup-tag">${item.category}</span>
          </div>
          <p class="popup-desc">${item.text.substring(0, 30)}...</p>
          <div class="popup-actions">
            <button class="popup-route-btn" data-id="${item.id}">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
              </svg>
              길찾기 시작
            </button>
          </div>
        </div>
      `;
      marker.bindPopup(popupContent, { offset: [0, -28] });

      marker.on('click', () => {
        highlightFeedCard(item.id);
      });

      marker.on('popupopen', () => {
        const routeBtn = document.querySelector(`.popup-route-btn[data-id="${item.id}"]`);
        if (routeBtn) {
          routeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            startRoutingLeaflet(item.id);
            marker.closePopup();
          });
        }
      });

      markers[item.id] = marker;
    });
  }

  async function locateUserLeaflet(coords = null) {
    let currentCoords = coords;
    if (!currentCoords) {
      showToast('🛰️ 실시간 GPS 현재 위치 파악 중...');
      currentCoords = await getUserCoordinates();
    }
    
    map.setView(currentCoords, 14, { animate: true, duration: 1 });

    if (userLocationMarker) {
      map.removeLayer(userLocationMarker);
    }

    const userIcon = L.divIcon({
      className: 'custom-div-icon',
      html: `<div class="user-marker-pulse"></div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });
    userLocationMarker = L.marker(currentCoords, { icon: userIcon }).addTo(map);
    
    showToast('📍 현재 내 위치가 지도에 반영되었습니다.');
    return currentCoords;
  }

  async function startRoutingLeaflet(restaurantId) {
    const item = gourmetList.find(d => d.id === restaurantId);
    if (!item) return;

    if (activeRouteId === restaurantId) {
      clearRouteLeaflet();
      updateRouteButtonsState(null);
      showToast('❌ 길찾기 경로가 해제되었습니다.');
      return;
    }

    const newWindow = window.open('about:blank', '_blank');
    if (newWindow) {
      newWindow.document.write(`
        <div style="background:#1E2022;color:#FFF;height:100vh;display:flex;flex-direction:column;justify-content:center;align-items:center;font-family:sans-serif;">
          <h3 style="margin-bottom:10px;">🧭 네이버 지도 길찾기 연결 중</h3>
          <p style="font-size:12px;color:#9AA0A6;">실시간 GPS 위치를 분석하고 있습니다. 잠시만 기다려 주세요...</p>
        </div>
      `);
    }

    showToast('🛰️ 실시간 GPS 현재 위치 파악 중...');
    const startCoords = await Promise.race([
      getUserCoordinates(),
      new Promise(r => setTimeout(() => r(userStartCoords), 3000))
    ]);

    await locateUserLeaflet(startCoords);

    if (activeRouteLine) map.removeLayer(activeRouteLine);

    const updatedRoutePoints = [
      [startCoords[0], startCoords[1]],
      ...item.routePoints.slice(1)
    ];

    activeRouteLine = L.polyline(updatedRoutePoints, {
      color: '#FF5A36',
      weight: 5,
      opacity: 0.9,
      className: 'route-path-animated'
    }).addTo(map);

    activeRouteId = restaurantId;

    const bounds = L.latLngBounds(updatedRoutePoints);
    map.fitBounds(bounds, {
      padding: [40, 40],
      animate: true,
      duration: 1.2
    });

    highlightFeedCard(restaurantId);
    updateRouteButtonsState(restaurantId);

    redirectNaverMapRoute(newWindow, startCoords, item);
  }

  function clearRouteLeaflet() {
    if (activeRouteLine) {
      map.removeLayer(activeRouteLine);
      activeRouteLine = null;
    }
    activeRouteId = null;
  }

  // ==========================================================================
  // [C] 공통 조율 & 비즈니스 로직
  // ==========================================================================
  function startRouting(restaurantId) {
    if (mapEngine === 'kakao') {
      startRoutingKakao(restaurantId);
    } else {
      startRoutingLeaflet(restaurantId);
    }
  }

  function focusOnRestaurant(id) {
    const item = gourmetList.find(d => d.id === id);
    if (!item) return;

    highlightFeedCard(id);

    if (mapEngine === 'kakao') {
      const position = new kakao.maps.LatLng(item.coords[0], item.coords[1]);
      map.panTo(position);
      
      setTimeout(() => {
        openKakaoPopup(item);
      }, 350);
    } else {
      map.setView(item.coords, 15, { animate: true, duration: 1 });
      if (markers[id]) {
        markers[id].openPopup();
      }
    }
  }

  function renderFeed(dataList) {
    const feedListContainer = document.getElementById('feedList');
    feedListContainer.innerHTML = '';

    if (dataList.length === 0) {
      feedListContainer.innerHTML = `
        <div class="no-results">
          <div class="no-results-icon">🔍</div>
          <p>등록된 내돈내산 맛집이 없습니다.<br>맛집 등록이나 탐색 메뉴를 이용해 보세요.</p>
        </div>
      `;
      document.getElementById('feedCount').innerText = '0개 맛집';
      return;
    }

    document.getElementById('feedCount').innerText = `${dataList.length}개 맛집`;

    dataList.forEach((item, index) => {
      // 로컬스토리지에서 좋아요 여부 및 숫자 실시간 조회
      const activeLike = localStorage.getItem(`likes_active_${item.id}`) === 'true';
      const currentLikes = localStorage.getItem(`likes_count_${item.id}`) 
        ? parseInt(localStorage.getItem(`likes_count_${item.id}`)) 
        : item.likes;

      const card = document.createElement('div');
      card.className = `feed-card ${activeCardId === item.id ? 'highlighted' : ''}`;
      card.id = `card-${item.id}`;
      card.setAttribute('data-id', item.id);

      card.innerHTML = `
        <div class="card-main-content">
          <div class="card-image-wrapper">
            <img class="card-img" src="${item.image}" alt="${item.name}">
          </div>
          <div class="card-details">
            <div class="card-meta">
              <span class="user-badge">[${item.user}]</span>
              <span class="category-tag">${item.category}</span>
            </div>
            <h3 class="restaurant-name">${item.name}</h3>
            <p class="review-text">"${item.text}"</p>
            <span class="post-time">${item.time}</span>
          </div>
        </div>
        <div class="card-actions">
          <div class="action-buttons">
            <button class="action-btn like-btn ${activeLike ? 'active' : ''}" data-likes="${item.likes}">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
              </svg>
              <span class="like-count">${currentLikes}</span>
            </button>
            <button class="action-btn comment-btn">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
              <span>${item.comments}</span>
            </button>
            <button class="action-btn share-btn">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="18" cy="5" r="3"></circle>
                <circle cx="6" cy="12" r="3"></circle>
                <circle cx="18" cy="19" r="3"></circle>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
              </svg>
            </button>
          </div>
          <button class="route-btn ${activeRouteId === item.id ? 'active' : ''}" data-route-id="${item.id}">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
            </svg>
            ${activeRouteId === item.id ? '길찾기 중' : '길찾기 ➔'}
          </button>
        </div>
      `;

      card.addEventListener('click', (e) => {
        if (e.target.closest('.action-btn') || e.target.closest('.route-btn')) return;
        focusOnRestaurant(item.id);
      });

      feedListContainer.appendChild(card);

      if (index === 1) {
        const adPlaceholder = document.createElement('div');
        adPlaceholder.className = 'adsense-placeholder';
        adPlaceholder.innerHTML = `
          <div class="ads-tag">AdSense</div>
          <div class="ads-text">구글 애드센스 광고가 게재될 자리입니다</div>
        `;
        feedListContainer.appendChild(adPlaceholder);
      }
    });

    if (dataList.length < 2 && dataList.length > 0) {
      const adPlaceholder = document.createElement('div');
      adPlaceholder.className = 'adsense-placeholder';
      adPlaceholder.innerHTML = `
        <div class="ads-tag">AdSense</div>
        <div class="ads-text">구글 애드센스 광고가 게재될 자리입니다</div>
      `;
      feedListContainer.appendChild(adPlaceholder);
    }

    bindFeedButtonEvents();
    applyAdSenseVisibility();
  }

  function bindFeedButtonEvents() {
    document.querySelectorAll('.route-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-route-id');
        startRouting(id);
      });
    });

    document.querySelectorAll('.like-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const card = btn.closest('.feed-card');
        const id = card.getAttribute('data-id');
        const item = gourmetList.find(d => d.id === id);
        if (!item) return;

        btn.classList.toggle('active');
        const countSpan = btn.querySelector('.like-count');
        
        let active = btn.classList.contains('active');
        let newCount = active ? item.likes + 1 : item.likes;

        // 로컬스토리지 보존
        localStorage.setItem(`likes_active_${id}`, active ? 'true' : 'false');
        localStorage.setItem(`likes_count_${id}`, newCount);

        countSpan.innerText = newCount;

        if (active) {
          showToast('👍 맛집에 공감하셨습니다!');
        }

        // 즐겨찾기 목록 모드인 경우, 해제 시 목록에서 즉시 필터링되게 갱신
        if (filterMode === 'favorites') {
          setTimeout(() => {
            renderFeed(getActiveList());
            if (mapEngine === 'kakao') {
              renderKakaoMarkers(getActiveList());
            } else {
              renderLeafletMarkers(getActiveList());
            }
          }, 600);
        }
      });
    });

    document.querySelectorAll('.comment-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        showToast('💬 댓글 기능은 정식 출시 후 준비됩니다.');
      });
    });

    document.querySelectorAll('.share-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        showToast('🔗 클립보드에 맛집 링크가 복사되었습니다!');
      });
    });
  }

  function highlightFeedCard(id) {
    activeCardId = id;
    
    document.querySelectorAll('.marker-pin-wrapper').forEach(el => el.classList.remove('active'));
    const markerEl = document.getElementById(`marker-${id}`);
    if (markerEl) markerEl.classList.add('active');

    document.querySelectorAll('.feed-card').forEach(card => {
      card.classList.remove('highlighted');
    });

    const targetCard = document.getElementById(`card-${id}`);
    const isAutoScroll = document.getElementById('autoScrollToggle').checked;
    
    if (targetCard && isAutoScroll) {
      targetCard.classList.add('highlighted');
      targetCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function updateRouteButtonsState(activeId) {
    document.querySelectorAll('.route-btn').forEach(btn => {
      const id = btn.getAttribute('data-route-id');
      if (id === activeId) {
        btn.classList.add('active');
        btn.innerHTML = `
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          길찾기 중
        `;
      } else {
        btn.classList.remove('active');
        btn.innerHTML = `
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
          </svg>
          길찾기 ➔
        `;
      }
    });
  }

  // 실시간 검색
  const searchInput = document.getElementById('searchInput');
  
  function handleSearch() {
    const query = searchInput.value.trim().toLowerCase();
    const sourceList = getActiveList();
    
    const filteredData = sourceList.filter(item => {
      return (
        item.name.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query) ||
        item.user.toLowerCase().includes(query) ||
        item.text.toLowerCase().includes(query)
      );
    });

    renderFeed(filteredData);
    
    if (mapEngine === 'kakao') {
      renderKakaoMarkers(filteredData);
      
      if (filteredData.length === 1) {
        setTimeout(() => focusOnRestaurant(filteredData[0].id), 300);
      } else if (filteredData.length > 1) {
        const bounds = new kakao.maps.LatLngBounds();
        filteredData.forEach(d => bounds.extend(new kakao.maps.LatLng(d.coords[0], d.coords[1])));
        if (userLocationMarker) {
          bounds.extend(new kakao.maps.LatLng(userStartCoords[0], userStartCoords[1]));
        }
        map.setBounds(bounds);
      }
    } else {
      renderLeafletMarkers(filteredData);
      
      if (filteredData.length === 1) {
        setTimeout(() => focusOnRestaurant(filteredData[0].id), 300);
      } else if (filteredData.length > 1) {
        const boundsCoords = filteredData.map(item => item.coords);
        if (userLocationMarker) boundsCoords.push(userStartCoords);
        map.fitBounds(L.latLngBounds(boundsCoords), { padding: [50, 50] });
      }
    }

    if (activeRouteId && !filteredData.some(d => d.id === activeRouteId)) {
      if (mapEngine === 'kakao') {
        clearRouteKakao();
      } else {
        clearRouteLeaflet();
      }
    }
  }

  searchInput.addEventListener('input', handleSearch);
  
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleSearch();
      searchInput.blur();
    }
  });

  // UI 공통 이벤트 (헤더 햄버거 메뉴 및 뷰 연동)
  function bindUIEvents() {
    const menuBtn = document.getElementById('menuBtn');
    const menuModal = document.getElementById('menuModal');
    const closeMenuBtn = document.getElementById('closeMenuBtn');
    const menuOverlay = document.getElementById('menuOverlay');

    function openMenu() {
      menuModal.classList.add('open');
      menuBtn.classList.add('active');
    }

    function closeMenu() {
      menuModal.classList.remove('open');
      menuBtn.classList.remove('active');
    }

    menuBtn.addEventListener('click', () => {
      if (menuModal.classList.contains('open')) {
        closeMenu();
      } else {
        openMenu();
      }
    });

    closeMenuBtn.addEventListener('click', closeMenu);
    menuOverlay.addEventListener('click', closeMenu);

    // [A] 맛집 탐색 (전체 복원)
    document.getElementById('menuExplore').addEventListener('click', (e) => {
      e.preventDefault();
      filterMode = 'all';
      
      document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
      document.getElementById('menuExplore').classList.add('active');
      document.getElementById('feedTitle').innerHTML = '🔥 광고 없는 찐 숨은 맛집 피드';
      
      closeMenu();
      
      renderFeed(gourmetList);
      if (mapEngine === 'kakao') {
        renderKakaoMarkers(gourmetList);
      } else {
        renderLeafletMarkers(gourmetList);
      }
      showToast('📍 맛집 탐색 모드로 전환되었습니다.');
    });

    // [B] 즐겨찾기 목록 필터링
    document.getElementById('menuFavorites').addEventListener('click', (e) => {
      e.preventDefault();
      filterMode = 'favorites';

      document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
      document.getElementById('menuFavorites').classList.add('active');
      document.getElementById('feedTitle').innerHTML = '⭐ 내가 저장한 즐겨찾기 맛집';

      closeMenu();

      const favs = getActiveList();
      renderFeed(favs);
      if (mapEngine === 'kakao') {
        renderKakaoMarkers(favs);
      } else {
        renderLeafletMarkers(favs);
      }
      showToast(`⭐ 즐겨찾기 목록이 필터링되었습니다. (${favs.length}개)`);
    });
  }

  // ==========================================================================
  // [신규] 3대 신규 기능 모달 처리 이벤트 바인딩
  // ==========================================================================
  function bindMenuModalsEvents() {
    const menuModal = document.getElementById('menuModal');
    const menuBtn = document.getElementById('menuBtn');

    function closeHamburger() {
      menuModal.classList.remove('open');
      menuBtn.classList.remove('active');
    }

    // ----------------------------------------------------
    // (1) 맛집 등록 기능 연동
    // ----------------------------------------------------
    const registerModal = document.getElementById('registerModal');
    const menuRegister = document.getElementById('menuRegister');
    const closeRegisterBtn = document.getElementById('closeRegisterBtn');
    const cancelRegisterBtn = document.getElementById('cancelRegisterBtn');
    const registerForm = document.getElementById('registerForm');

    function openRegister() {
      closeHamburger();
      setTimeout(() => registerModal.classList.add('open'), 200);
    }

    function closeRegister() {
      registerModal.classList.remove('open');
      registerForm.reset();
    }

    menuRegister.addEventListener('click', (e) => {
      e.preventDefault();
      openRegister();
    });
    closeRegisterBtn.addEventListener('click', closeRegister);
    cancelRegisterBtn.addEventListener('click', closeRegister);

    // 식당 신규 등록 처리
    registerForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const rName = document.getElementById('restaurantName').value.trim();
      const uNick = document.getElementById('userNickname').value.trim();
      const cat = document.getElementById('categorySelect').value;
      const review = document.getElementById('reviewText').value.trim();

      // 지도 중심부 좌표 획득 (맛집 핀 위치)
      let centerLat, centerLng;
      if (mapEngine === 'kakao') {
        const center = map.getCenter();
        centerLat = center.getLat();
        centerLng = center.getLng();
      } else {
        const center = map.getCenter();
        centerLat = center.lat;
        centerLng = center.lng;
      }

      // 카테고리별 이모지 및 썸네일 매핑
      let emoji = '🍲';
      let img = 'images/sundaeguk.png';
      if (cat === '패스트푸드') { emoji = '🍔'; img = 'images/tteokbokki.png'; }
      else if (cat === '한식') { emoji = '🍲'; img = 'images/sundaeguk.png'; }
      else if (cat === '찜탕') { emoji = '🥘'; img = 'images/dakgalbi.png'; }
      else if (cat === '치킨') { emoji = '🍗'; img = 'images/dakgalbi.png'; }
      else if (cat === '분식') { emoji = '🍢'; img = 'images/tteokbokki.png'; }
      else if (cat === '디저트') { emoji = '🍰'; img = 'images/tteokbokki.png'; }

      const newId = 'user_' + Date.now();
      const newItem = {
        id: newId,
        name: rName,
        user: uNick,
        category: cat,
        emoji: emoji,
        text: review,
        time: '방금 전',
        image: img,
        coords: [centerLat, centerLng],
        likes: 0,
        comments: 0,
        routePoints: [
          [userStartCoords[0], userStartCoords[1]], // 출발지 (기본 현위치)
          [centerLat, centerLng]                  // 도착지
        ]
      };

      // 데이터 삽입 및 LocalStorage 보존
      gourmetList.unshift(newItem);
      localStorage.setItem('gourmet_list', JSON.stringify(gourmetList));

      closeRegister();
      
      // 모드 전체 탐색 모드로 전환
      filterMode = 'all';
      document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
      document.getElementById('menuExplore').classList.add('active');
      document.getElementById('feedTitle').innerHTML = '🔥 광고 없는 찐 숨은 맛집 피드';

      // 화면 리렌더링
      const activeList = getActiveList();
      renderFeed(activeList);
      if (mapEngine === 'kakao') {
        renderKakaoMarkers(activeList);
      } else {
        renderLeafletMarkers(activeList);
      }

      // 신규 맛집으로 포커스
      setTimeout(() => {
        focusOnRestaurant(newId);
      }, 400);

      showToast(`🎉 '${rName}' 맛집이 성공적으로 등록되었습니다!`);
    });

    // ----------------------------------------------------
    // (2) 환경 설정 연동 (애드센스 & 라이트 테마 토글)
    // ----------------------------------------------------
    const settingsModal = document.getElementById('settingsModal');
    const menuSettings = document.getElementById('menuSettings');
    const closeSettingsBtn = document.getElementById('closeSettingsBtn');
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    const hideAdsToggle = document.getElementById('hideAdsToggle');
    const lightThemeToggle = document.getElementById('lightThemeToggle');

    function openSettings() {
      closeHamburger();
      // 열기 직전에 토글 체크 상태 동기화
      hideAdsToggle.checked = localStorage.getItem('hide_ads') === 'true';
      lightThemeToggle.checked = (currentTheme === 'light');
      setTimeout(() => settingsModal.classList.add('open'), 200);
    }

    function closeSettings() {
      settingsModal.classList.remove('open');
    }

    menuSettings.addEventListener('click', (e) => {
      e.preventDefault();
      openSettings();
    });
    closeSettingsBtn.addEventListener('click', closeSettings);
    saveSettingsBtn.addEventListener('click', () => {
      // 설정값 저장
      localStorage.setItem('hide_ads', hideAdsToggle.checked ? 'true' : 'false');
      
      // 라이트 테마 설정 반영
      const isLight = lightThemeToggle.checked;
      currentTheme = isLight ? 'light' : 'dark';
      localStorage.setItem('gourmet_theme', currentTheme);
      document.documentElement.setAttribute('data-theme', currentTheme);

      // 지도 테마 실시간 연동
      if (map) {
        if (mapEngine === 'kakao') {
          map.relayout();
        } else {
          applyLeafletTiles();
        }
      }

      closeSettings();
      applyAdSenseVisibility();
      showToast('⚙️ 설정 변경 사항이 적용되었습니다.');
    });

    // ----------------------------------------------------
    // (3) 공지사항 연동
    // ----------------------------------------------------
    const noticeModal = document.getElementById('noticeModal');
    const menuNotice = document.getElementById('menuNotice');
    const closeNoticeBtn = document.getElementById('closeNoticeBtn');
    const confirmNoticeBtn = document.getElementById('confirmNoticeBtn');

    function openNotice() {
      closeHamburger();
      setTimeout(() => noticeModal.classList.add('open'), 200);
    }

    function closeNotice() {
      noticeModal.classList.remove('open');
    }

    menuNotice.addEventListener('click', (e) => {
      e.preventDefault();
      openNotice();
    });
    closeNoticeBtn.addEventListener('click', closeNotice);
    confirmNoticeBtn.addEventListener('click', closeNotice);
  }

  // 애드센스 플레이스홀더 제어 함수 (설정값 연동)
  function applyAdSenseVisibility() {
    const isHide = localStorage.getItem('hide_ads') === 'true';
    document.querySelectorAll('.adsense-placeholder').forEach(el => {
      if (isHide) {
        el.style.display = 'none';
      } else {
        el.style.display = 'flex';
      }
    });
  }

  // 간단한 토스트 팝업 알림
  function showToast(message) {
    const oldToast = document.querySelector('.toast-popup');
    if (oldToast) oldToast.remove();

    const toast = document.createElement('div');
    toast.className = 'toast-popup';
    toast.style.cssText = `
      position: absolute;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%) translateY(20px);
      background-color: rgba(18, 19, 21, 0.95);
      color: #FFFFFF;
      padding: 10px 18px;
      border-radius: 30px;
      font-size: 12px;
      font-weight: 600;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);
      border: 1px solid rgba(255, 255, 255, 0.1);
      z-index: 9999;
      opacity: 0;
      transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      pointer-events: none;
      white-space: nowrap;
    `;
    toast.innerText = message;
    
    document.querySelector('.phone-container').appendChild(toast);
    toast.offsetHeight;

    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-50%) translateY(-10px)';
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  // 10. 앱 최초 실행
  initApp();
});
