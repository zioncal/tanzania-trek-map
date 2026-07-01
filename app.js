// הגדרת המפה ומרכז ראשוני
const map = L.map('map', {
    zoomControl: false // נבטל כדי להוסיף אותו במיקום נוח שלא יפריע לפאנל
}).setView([-4.5, 38.5], 8); 

// הוספת שכבת מפה בסיסית (OpenStreetMap)
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// הוספת בקרת זום בפינה השמאלית העליונה (מרוחק מהפאנל הנייד)
L.control.zoom({ position: 'topleft' }).addTo(map);

// פונקציה לעדכון פאנל המידע בעת לחיצה
function updatePanel(properties) {
    const contentDiv = document.getElementById('panel-content');
    
    let linkHTML = '';
    if (properties.link && properties.link_text) {
        linkHTML = `<p style="margin-top:15px;"><a href="${properties.link}" target="_blank" style="color:#1abc9c; font-weight:bold; text-decoration:none;">${properties.link_text} ←</a></p>`;
    }

    contentDiv.innerHTML = `
        <h2>${properties.title || 'מידע על המסלול'}</h2>
        <div class="meta-info">📏 מרחק: ${properties.distance || 'לא צוין'}</div>
        <div class="meta-info">⏱️ זמן משוער: ${properties.duration || 'לא צוין'}</div>
        <div class="meta-info">⛰️ גובה: ${properties.elevation || 'לא צוין'}</div>
        <hr style="border:0; border-top:1px solid #dee2e6; margin:10px 0;">
        <div class="desc">${properties.description || 'אין תיאור זמין למקטע זה.'}</div>
        ${linkHTML}
    `;
}

// טעינת ועיבוד קובץ ה-GeoJSON
fetch('safari_path.geojson')
    .then(response => response.json())
    .then(data => {
        
        // 1. שלב ראשון: ציור המסלולים (Lines) עם מנגנון לחיצה מורחב
        L.geoJSON(data, {
            filter: function(feature) {
                return feature.properties.type === 'track';
            },
            style: function(feature) {
                return {
                    color: '#3498db',
                    weight: 3,
                    opacity: 0.85
                };
            },
            onEachFeature: function(feature, layer) {
                // יצירת קו שקוף ועבה במיוחד מעל הקו המקורי לצורך לחיצה קלה
                if (layer.getLatLngs) {
                    const originalLatLngs = layer.getLatLngs();
                    
                    const touchCatchLayer = L.polyline(originalLatLngs, {
                        color: '#transparent',
                        weight: 24, // טווח רחב במיוחד ללחיצה נוחה עם האצבע
                        opacity: 0,  // שקוף לחלוטין לגולש
                        interactive: true
                    }).addTo(map);

                    // מאזין לחיצה על השכבה השקופה הרחבה
                    touchCatchLayer.on('click', function(e) {
                        updatePanel(feature.properties);
                        // אפקט ויזואלי קטן לקו המקורי כדי שהמשתמש יבין מה הוא סימן
                        layer.setStyle({ color: '#e74c3c', weight: 4 });
                        setTimeout(() => layer.setStyle({ color: '#3498db', weight: 3 }), 800);
                        L.DomEvent.stopPropagation(e);
                    });
                }
            }
        }).addTo(map);

        // 2. שלב שני: ציור נקודות העניין (Points / Sites)
        L.geoJSON(data, {
            filter: function(feature) {
                return feature.properties.type === 'site';
            },
            pointToLayer: function(feature, latlng) {
                // עיצוב מרקרים מודרניים ובולטים ללחיצה
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
                    // הבלטה זמנית של הנקודה שנלחצה
                    layer.setRadius(13);
                    setTimeout(() => layer.setRadius(9), 500);
                    L.DomEvent.stopPropagation(e);
                });
            }
        }).addTo(map);

    })
    .catch(error => console.error('שגיאה בטעינת קובץ המסלול:', error));
