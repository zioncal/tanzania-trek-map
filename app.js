// הגדרת המפה ומרכז ראשוני
const map = L.map('map', {
    zoomControl: false 
}).setView([-4.5, 38.5], 8); 

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

L.control.zoom({ position: 'topleft' }).addTo(map);

// פונקציה לעדכון פאנל המידע בעת לחיצה
function updatePanel(properties) {
    const contentDiv = document.getElementById('panel-content');
    
    // יצירת קוד הקישורים - תמיכה גם בקישור בודד וגם במערך קישורים מרובה
    let linkHTML = '';
    if (properties.link && properties.link_text) {
        linkHTML = `<p style="margin-top:15px;"><a href="${properties.link}" target="_blank" style="color:#1abc9c; font-weight:bold; text-decoration:none;">${properties.link_text} ←</a></p>`;
    } else if (Array.isArray(properties.links)) {
        linkHTML = properties.links.map(lnk => `
            <p style="margin-top:10px; margin-bottom:5px;">
                <a href="${lnk.url}" target="_blank" style="color:#1abc9c; font-weight:bold; text-decoration:none;">${lnk.text} ←</a>
            </p>
        `).join('');
    }

    contentDiv.innerHTML = `
        <h2>${properties.title || 'מידע על המסלול'}</h2>
        <div class="meta-info">📏 מרחק: ${properties.distance || 'לא צוין'}</div>
        <div class="meta-info">⏱️ זמן משוער: ${properties.duration || 'לא צוין'}</div>
        <div class="meta-info">⛰️ גובה: ${properties.elevation || 'לא צוין'}</div>
        <hr style="border:0; border-top:1px solid #dee2e6; margin:10px 0;">
        <div class="desc">${properties.description || 'אין תיאור זמין למקטע זה.'}</div>
        <div class="links-wrapper" style="margin-top:15px; padding-top:10px; border-top:1px dashed #dee2e6;">${linkHTML}</div>
    `;
}

// טעינת ועיבוד קובץ ה-GeoJSON
fetch('safari_path.geojson')
    .then(response => {
        if (!response.ok) throw new Error('שגיאה בטעינת הקובץ');
        return response.json();
    })
    .then(data => {
        
        // 1. שלב ראשון: ציור המסלולים (Lines) עם מנגנון לחיצה מורחב ומדויק
        L.geoJSON(data, {
            filter: function(feature) {
                return feature.properties && feature.properties.type === 'track';
            },
            style: function(feature) {
                return { color: '#3498db', weight: 3, opacity: 0.85 };
            },
            onEachFeature: function(feature, layer) {
                if (layer.getLatLngs) {
                    const originalLatLngs = layer.getLatLngs();
                    
                    // יצירת קו רחב במיוחד מעל הקו המקורי לצורך לחיצה קלה בנייד ובמחשב
                    const touchCatchLayer = L.polyline(originalLatLngs, {
                        color: '#3498db', 
                        weight: 25,       
                        opacity: 0.01,    
                        interactive: true
                    }).addTo(map);

                    touchCatchLayer.on('click', function(e) {
                        updatePanel(feature.properties);
                        layer.setStyle({ color: '#e74c3c', weight: 5 });
                        setTimeout(() => layer.setStyle({ color: '#3498db', weight: 3 }), 800);
                        L.DomEvent.stopPropagation(e);
                    });
                }
            }
        }).addTo(map);

        // 2. שלב שני: ציור נקודות העניין (Points / Sites)
        L.geoJSON(data, {
            filter: function(feature) {
                return feature.properties && feature.properties.type === 'site';
            },
            pointToLayer: function(feature, latlng) {
                return L.circleMarker(latlng, {
                    radius: 9,
                    fillColor: '#2ecc71',
                    color: '#fff',
                    weight: 2,
                    opacity: 1,
                    fillOpacity: 0.9
                });
            },
            onEachFeature: function(feature, layer) {
                layer.on('click', function(e) {
                    updatePanel(feature.properties);
                    layer.setRadius(13);
                    setTimeout(() => layer.setRadius(9), 500);
                    L.DomEvent.stopPropagation(e);
                });
            }
        }).addTo(map);

    })
    .catch(error => {
        console.error('שגיאה:', error);
        document.getElementById('panel-content').innerHTML = '<p style="color:red; font-weight:bold; text-align:center;">⚠️ שגיאה בטעינת נתוני המפה בענן. ודא שקובץ ה-GeoJSON תקין.</p>';
    });
