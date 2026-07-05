'use strict';

const DEFAULT_VIEW = [-4.5, 38.5];
const DEFAULT_ZOOM = 7;
const TRACK_COLOR = '#1877c9';
const TRACK_ACTIVE_COLOR = '#e76f35';
const SITE_COLOR = '#15965d';

const mapElement = document.getElementById('map');
const panelElement = document.getElementById('panel-content');

if (!mapElement || !panelElement || typeof L === 'undefined') {
  throw new Error('Leaflet או רכיבי המפה לא נטענו כראוי.');
}

const map = L.map(mapElement, {
  zoomControl: false,
  tap: true
}).setView(DEFAULT_VIEW, DEFAULT_ZOOM);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

L.control.zoom({ position: 'topleft' }).addTo(map);
L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);

map.createPane('tracksPane');
map.getPane('tracksPane').style.zIndex = '410';
map.createPane('trackHitsPane');
map.getPane('trackHitsPane').style.zIndex = '420';
map.createPane('sitesPane');
map.getPane('sitesPane').style.zIndex = '650';

const boundsGroup = L.featureGroup().addTo(map);
let activeTrack = null;

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function safeExternalUrl(value) {
  if (!value) return '';
  try {
    const url = new URL(value, window.location.href);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
  } catch (error) {
    return '';
  }
}

function getLinks(properties) {
  const links = [];

  if (Array.isArray(properties.links)) {
    properties.links.forEach(function (item) {
      if (!item || typeof item !== 'object') return;
      const url = safeExternalUrl(item.url);
      if (url) links.push({ url: url, text: item.text || 'מידע נוסף' });
    });
  }

  if (links.length === 0) {
    const url = safeExternalUrl(properties.link);
    if (url) links.push({ url: url, text: properties.link_text || 'מידע נוסף' });
  }

  return links;
}

function buildLinksHtml(properties) {
  const links = getLinks(properties);
  if (links.length === 0) return '';

  return '<div class="external-links">' + links.map(function (item) {
    return '<a class="external-link" href="' + escapeHtml(item.url) +
      '" target="_blank" rel="noopener noreferrer">' +
      escapeHtml(item.text) + '</a>';
  }).join('') + '</div>';
}

function updatePanel(properties) {
  properties = properties || {};
  const day = properties.day !== undefined && properties.day !== null
    ? '<span class="day-badge">יום ' + escapeHtml(properties.day) + '</span>'
    : '';

  panelElement.innerHTML =
    day +
    '<h2>' + escapeHtml(properties.title || 'מידע על המסלול') + '</h2>' +
    '<div class="meta-info">📏 <strong>מרחק:</strong> ' + escapeHtml(properties.distance || 'לא צוין') + '</div>' +
    '<div class="meta-info">⏱️ <strong>זמן משוער:</strong> ' + escapeHtml(properties.duration || 'לא צוין') + '</div>' +
    '<div class="meta-info">⛰️ <strong>גובה:</strong> ' + escapeHtml(properties.elevation || 'לא צוין') + '</div>' +
    '<div class="desc">' + escapeHtml(properties.description || 'אין תיאור זמין.') + '</div>' +
    buildLinksHtml(properties);
}

function showError(message) {
  panelElement.innerHTML =
    '<div class="error-message"><strong>לא ניתן לטעון את המפה.</strong><br>' +
    escapeHtml(message) + '<br><br>ודא ששלושת הקבצים נמצאים באותה תיקייה ובשמות המדויקים.</div>';
}

function resetActiveTrack() {
  if (!activeTrack) return;
  activeTrack.setStyle({ color: TRACK_COLOR, weight: 5, opacity: 0.9 });
  activeTrack = null;
}

function addTrackFeature(feature) {
  const coordinates = feature.geometry.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return;

  const latLngs = coordinates.map(function (coord) {
    return [coord[1], coord[0]];
  });

  const visibleLine = L.polyline(latLngs, {
    pane: 'tracksPane',
    color: TRACK_COLOR,
    weight: 5,
    opacity: 0.9,
    lineCap: 'round',
    lineJoin: 'round'
  }).addTo(map);

  const hitLine = L.polyline(latLngs, {
    pane: 'trackHitsPane',
    color: '#000000',
    weight: 24,
    opacity: 0,
    bubblingMouseEvents: false
  }).addTo(map);

  boundsGroup.addLayer(visibleLine);

  function selectTrack(event) {
    resetActiveTrack();
    activeTrack = visibleLine;
    visibleLine.setStyle({ color: TRACK_ACTIVE_COLOR, weight: 7, opacity: 1 });
    updatePanel(feature.properties || {});
    if (event) L.DomEvent.stopPropagation(event);
  }

  visibleLine.on('click', selectTrack);
  hitLine.on('click', selectTrack);
  hitLine.bindTooltip('יום ' + escapeHtml((feature.properties || {}).day || '') + ' – לחץ לפרטים', {
    sticky: true,
    direction: 'top'
  });
}

function addSiteFeature(feature) {
  const coordinates = feature.geometry.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return;

  const properties = feature.properties || {};
  const dayText = properties.day == null ? '' : String(properties.day);

  const marker = L.marker([coordinates[1], coordinates[0]], {
    pane: 'sitesPane',
    bubblingMouseEvents: false,
    icon: L.divIcon({
      className: 'day-marker-wrapper',
      html: '<div class="day-marker">' + escapeHtml(dayText) + '</div>',
      iconSize: [34, 34],
      iconAnchor: [17, 17]
    })
  }).addTo(map);

  boundsGroup.addLayer(marker);

  marker.on('click', function (event) {
    resetActiveTrack();
    updatePanel(properties);
    L.DomEvent.stopPropagation(event);
  });

  marker.bindTooltip(escapeHtml(properties.title || 'אתר במסלול'), {
    direction: 'top',
    offset: [0, -17]
  });
}

async function loadRoute() {
  try {
    const response = await fetch('./safari_path.geojson?v=20260702', { cache: 'no-store' });
    if (!response.ok) throw new Error('שגיאת שרת ' + response.status + ' בעת טעינת safari_path.geojson');

    const data = await response.json();
    if (data.type !== 'FeatureCollection' || !Array.isArray(data.features)) {
      throw new Error('מבנה קובץ ה-GeoJSON אינו FeatureCollection תקין.');
    }

    const tracks = data.features.filter(function (feature) {
      return feature.geometry && feature.geometry.type === 'LineString' &&
        feature.properties && feature.properties.type === 'track';
    });
    const sites = data.features.filter(function (feature) {
      return feature.geometry && feature.geometry.type === 'Point' &&
        feature.properties && feature.properties.type === 'site';
    });

    tracks.forEach(addTrackFeature);
    sites.forEach(addSiteFeature);

    if (boundsGroup.getLayers().length === 0) throw new Error('לא נמצאו שכבות להצגה.');

    map.fitBounds(boundsGroup.getBounds(), { padding: [35, 35], maxZoom: 10 });
    panelElement.innerHTML = '<div class="placeholder">המפה מוכנה.<br>לחץ על מספר יום או על קו כחול.</div>';
  } catch (error) {
    console.error(error);
    showError(error && error.message ? error.message : 'שגיאה לא ידועה.');
  }
}

map.on('click', resetActiveTrack);
loadRoute();
