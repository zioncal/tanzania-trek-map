'use strict';

const TRACK_COLOR = '#1877c9';
const TRACK_ACTIVE_COLOR = '#e76f35';

const map = L.map('map', { zoomControl: false, tap: true })
  .setView([-4.5, 38.5], 7);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

L.control.zoom({ position: 'topleft' }).addTo(map);
L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);

// שכבות נפרדות מבטיחות שנקודות האתרים תמיד מעל קווי המסלול.
map.createPane('trackPane');
map.getPane('trackPane').style.zIndex = 410;

map.createPane('trackHitPane');
map.getPane('trackHitPane').style.zIndex = 420;

map.createPane('sitePane');
map.getPane('sitePane').style.zIndex = 650;

map.createPane('siteTooltipPane');
map.getPane('siteTooltipPane').style.zIndex = 700;

const routeGroup = L.featureGroup().addTo(map);
let activeTrack = null;

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function safeExternalUrl(value) {
  if (!value) return '';
  try {
    const url = new URL(value, window.location.href);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

function buildLinksHtml(properties = {}) {
  const links = [];

  if (Array.isArray(properties.links)) {
    for (const item of properties.links) {
      const url = safeExternalUrl(item?.url);
      if (url) links.push({ url, text: item.text || 'מידע נוסף' });
    }
  }

  if (links.length === 0) {
    const url = safeExternalUrl(properties.link);
    if (url) links.push({ url, text: properties.link_text || 'מידע נוסף' });
  }

  if (links.length === 0) return '';

  return `<div class="external-links">${links.map(item => `
    <a class="external-link" href="${escapeHtml(item.url)}"
       target="_blank" rel="noopener noreferrer">
      ${escapeHtml(item.text)} ←
    </a>`).join('')}</div>`;
}

function updatePanel(properties = {}) {
  const panel = document.getElementById('panel-content');
  panel.innerHTML = `
    ${properties.day ? `<span class="day-badge">יום ${escapeHtml(properties.day)}</span>` : ''}
    <h2>${escapeHtml(properties.title || 'מידע על המסלול')}</h2>
    <div class="meta-info">📏 <strong>מרחק:</strong> ${escapeHtml(properties.distance || 'לא צוין')}</div>
    <div class="meta-info">⏱️ <strong>זמן משוער:</strong> ${escapeHtml(properties.duration || 'לא צוין')}</div>
    <div class="meta-info">⛰️ <strong>גובה:</strong> ${escapeHtml(properties.elevation || 'לא צוין')}</div>
    <div class="desc">${escapeHtml(properties.description || 'אין תיאור זמין.')}</div>
    ${buildLinksHtml(properties)}
  `;
}

function resetActiveTrack() {
  if (!activeTrack) return;
  activeTrack.setStyle({ color: TRACK_COLOR, weight: 5, opacity: 0.9 });
  activeTrack = null;
}

function addTrackFeature(feature) {
  const latLngs = feature.geometry.coordinates.map(([lng, lat]) => [lat, lng]);

  const line = L.polyline(latLngs, {
    pane: 'trackPane', color: TRACK_COLOR, weight: 5, opacity: 0.9,
    lineCap: 'round', lineJoin: 'round'
  }).addTo(routeGroup);

  const hitLine = L.polyline(latLngs, {
    pane: 'trackHitPane', color: '#000', weight: 24, opacity: 0,
    bubblingMouseEvents: false
  }).addTo(routeGroup);

  const select = event => {
    resetActiveTrack();
    activeTrack = line;
    line.setStyle({ color: TRACK_ACTIVE_COLOR, weight: 7, opacity: 1 });
    updatePanel(feature.properties);
    L.DomEvent.stopPropagation(event);
  };

  line.on('click', select);
  hitLine.on('click', select);
  line.bindTooltip(`יום ${feature.properties?.day || ''} – ${escapeHtml(feature.properties?.title || '')}`, { sticky: true });
}

function makeDayIcon(day) {
  return L.divIcon({
    className: 'day-site-marker',
    html: `<div style="width:34px;height:34px;border-radius:50%;background:#15965d;color:white;border:3px solid white;box-shadow:0 1px 6px rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;">${escapeHtml(day)}</div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20]
  });
}

function addSiteFeature(feature) {
  const [lng, lat] = feature.geometry.coordinates;
  const marker = L.marker([lat, lng], {
    pane: 'sitePane',
    icon: makeDayIcon(feature.properties?.day || '•'),
    riseOnHover: true,
    bubblingMouseEvents: false
  }).addTo(routeGroup);

  marker.on('click', event => {
    resetActiveTrack();
    updatePanel(feature.properties);
    L.DomEvent.stopPropagation(event);
  });

  marker.bindTooltip(escapeHtml(feature.properties?.title || 'אתר במסלול'), {
    pane: 'siteTooltipPane', direction: 'top', offset: [0, -18]
  });
}

async function loadRoute() {
  try {
    const response = await fetch('./safari_path.geojson', { cache: 'no-store' });
    if (!response.ok) throw new Error(`שגיאת שרת ${response.status}`);

    const data = await response.json();
    if (data.type !== 'FeatureCollection' || !Array.isArray(data.features)) {
      throw new Error('מבנה קובץ ה-GeoJSON אינו תקין');
    }

    data.features
      .filter(f => f.properties?.type === 'track' && f.geometry?.type === 'LineString')
      .forEach(addTrackFeature);

    data.features
      .filter(f => f.properties?.type === 'site' && f.geometry?.type === 'Point')
      .forEach(addSiteFeature);

    map.fitBounds(routeGroup.getBounds(), { padding: [35, 35], maxZoom: 10 });
  } catch (error) {
    console.error(error);
    document.getElementById('panel-content').innerHTML =
      `<div class="error-message"><strong>לא ניתן לטעון את המפה.</strong><br>${escapeHtml(error.message)}</div>`;
  }
}

map.on('click', resetActiveTrack);
loadRoute();
