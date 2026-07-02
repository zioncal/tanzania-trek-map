'use strict';

const DEFAULT_VIEW = [-4.5, 38.5];
const DEFAULT_ZOOM = 7;
const TRACK_COLOR = '#1877c9';
const TRACK_ACTIVE_COLOR = '#e76f35';
const SITE_COLOR = '#15965d';

const map = L.map('map', {
  zoomControl: false,
  tap: true
}).setView(DEFAULT_VIEW, DEFAULT_ZOOM);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

L.control.zoom({ position: 'topleft' }).addTo(map);
L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);

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
  const validLinks = [];

  if (Array.isArray(properties.links)) {
    properties.links.forEach((item) => {
      if (!item || typeof item !== 'object') return;

      const url = safeExternalUrl(item.url);
      if (!url) return;

      validLinks.push({
        url,
        text: item.text || 'מידע נוסף'
      });
    });
  }

  if (validLinks.length === 0) {
    const legacyUrl = safeExternalUrl(properties.link);

    if (legacyUrl) {
      validLinks.push({
        url: legacyUrl,
        text: properties.link_text || 'מידע נוסף'
      });
    }
  }

  if (validLinks.length === 0) return '';

  return `
    <div class="external-links">
      ${validLinks.map((item) => `
        <a class="external-link"
           href="${escapeHtml(item.url)}"
           target="_blank"
           rel="noopener noreferrer">
          ${escapeHtml(item.text)} ←
        </a>
      `).join('')}
    </div>
  `;
}

function updatePanel(properties = {}) {
  const panel = document.getElementById('panel-content');
  const day = properties.day
    ? `<span class="day-badge">יום ${escapeHtml(properties.day)}</span>`
    : '';

  panel.innerHTML = `
    ${day}
    <h2>${escapeHtml(properties.title || 'מידע על המסלול')}</h2>
    <div class="meta-info">📏 <strong>מרחק:</strong> ${escapeHtml(properties.distance || 'לא צוין')}</div>
    <div class="meta-info">⏱️ <strong>זמן משוער:</strong> ${escapeHtml(properties.duration || 'לא צוין')}</div>
    <div class="meta-info">⛰️ <strong>גובה:</strong> ${escapeHtml(properties.elevation || 'לא צוין')}</div>
    <div class="desc">${escapeHtml(properties.description || 'אין תיאור זמין למקטע זה.')}</div>
    ${buildLinksHtml(properties)}
  `;
}

function showError(message) {
  document.getElementById('panel-content').innerHTML = `
    <div class="error-message">
      <strong>לא ניתן לטעון את המפה.</strong><br>
      ${escapeHtml(message)}
    </div>
  `;
}

function resetActiveTrack() {
  if (!activeTrack) return;
  activeTrack.setStyle({ color: TRACK_COLOR, weight: 5, opacity: 0.9 });
  activeTrack = null;
}

function activateTrack(visibleLayer, properties) {
  resetActiveTrack();
  activeTrack = visibleLayer;
  visibleLayer.setStyle({ color: TRACK_ACTIVE_COLOR, weight: 7, opacity: 1 });
  visibleLayer.bringToFront();
  updatePanel(properties);
}

function addTrackFeature(feature) {
  const latLngs = feature.geometry.coordinates.map(([lng, lat]) => [lat, lng]);

  const visibleLine = L.polyline(latLngs, {
    color: TRACK_COLOR,
    weight: 5,
    opacity: 0.9,
    lineCap: 'round',
    lineJoin: 'round'
  }).addTo(routeGroup);

  const hitLine = L.polyline(latLngs, {
    color: '#000',
    weight: 28,
    opacity: 0,
    bubblingMouseEvents: false
  }).addTo(routeGroup);

  const handleSelection = (event) => {
    activateTrack(visibleLine, feature.properties);
    L.DomEvent.stopPropagation(event);
  };

  visibleLine.on('click', handleSelection);
  hitLine.on('click', handleSelection);
}

function addSiteFeature(feature) {
  const [lng, lat] = feature.geometry.coordinates;

  const marker = L.circleMarker([lat, lng], {
    radius: 9,
    fillColor: SITE_COLOR,
    color: '#fff',
    weight: 3,
    fillOpacity: 0.95
  }).addTo(routeGroup);

  marker.on('click', (event) => {
    resetActiveTrack();
    updatePanel(feature.properties);
    L.DomEvent.stopPropagation(event);
  });

  marker.bindTooltip(
    escapeHtml(feature.properties?.title || 'אתר במסלול'),
    { direction: 'top' }
  );
}

async function loadRoute() {
  try {
    const response = await fetch('./safari_path.geojson', {
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`שגיאת שרת ${response.status}`);
    }

    const data = await response.json();

    if (data.type !== 'FeatureCollection' || !Array.isArray(data.features)) {
      throw new Error('מבנה ה-GeoJSON אינו תקין');
    }

    data.features.forEach((feature) => {
      const geometryType = feature.geometry?.type;
      const featureType = feature.properties?.type;

      if (featureType === 'track' && geometryType === 'LineString') {
        addTrackFeature(feature);
      } else if (featureType === 'site' && geometryType === 'Point') {
        addSiteFeature(feature);
      }
    });

    if (routeGroup.getLayers().length > 0) {
      map.fitBounds(routeGroup.getBounds(), {
        padding: [35, 35],
        maxZoom: 10
      });
    }
  } catch (error) {
    console.error(error);
    showError(error.message || 'שגיאה לא ידועה');
  }
}

map.on('click', resetActiveTrack);
loadRoute();
