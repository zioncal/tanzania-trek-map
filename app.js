// הגדרת המפה ומרכז ראשוני על אזור אוסאמבארה וטאנגה
const map = L.map('map', {
    zoomControl: false 
}).setView([-4.8, 38.6], 8); 

// הוספת שכבת מפה בסיסית יציבה (OpenStreetMap)
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// הוספת בקרת זום בפינה השמאלית העליונה
L.control.zoom({ position: 'topleft' }).addTo(map);

// פונקציה אחידה ומאובטחת לעדכון פאנל המידע בעת לחיצה
function updatePanel(properties) {
    const contentDiv = document.getElementById('panel-content');
    
    let linkHTML = '';
    if (properties.link && properties.link_text) {
        linkHTML = `
            <div style="margin-top: 15px; padding-top: 10px; border-top: 1px dashed #2ecc71;">
                🌐 <a href="${properties.link}" target="_blank" rel="noopener noreferrer" 
                      style="color: #1abc9c; font-weight: bold; text-decoration: underline; font-size: 13px;">
                    ${properties.link_text}
                </a>
            </div>
        `;
    }

    contentDiv.innerHTML = `
        <h2>${properties.title || 'מידע על המסלול'}</h2>
        <div class="meta-info" style="margin-bottom: 6px;">📏 <b>מרחק:</b> ${properties.distance || 'לא צוין'}</div>
        <div class="meta-info" style="margin-bottom: 6px;">⏱️ <b>זמן משוער:</b> ${properties.duration || 'לא צוין'}</div>
        <div class="meta-info" style="margin-bottom: 12px;">⛰️ <b>גובה:</b> ${properties.elevation || 'לא צוין'}</div>
        <p class="desc" style="line-height: 1.6; color: #34495e; margin: 0; text-align: justify;">${properties.description || 'אין תיאור זמין למקטע זה.'}</p>
        ${linkHTML}
    `;
}

// טעינת ועיבוד קובץ ה-GeoJSON בלולאה הנדסית מאובטחת
fetch('safari_path.geojson')
    .then(response => {
        if (!response.ok) throw new Error('Network response was not ok');
        return response.json();
    })
    .then(data => {
        
        // ציור ישיר ומובנה של כל הישויות
        L.geoJSON(data, {
            // 1. הגדרת סגנון ויזואלי לקווים האמיתיים (הדקים)
            style: function(feature) {
                if (feature.properties.type === 'track') {
                    return { color: '#3498db', weight: 4, opacity: 0.85 };
                }
            },
            // 2. הפיכת נקודות הלינה (Sites) לעיגולים מעוצבים ובולטים
            pointToLayer: function(feature, latlng) {
                return L.circleMarker(latlng, {
                    radius: 10,
                    fillColor: '#2ecc71',
                    color: '#ffffff',
                    weight: 2,
                    opacity: 1,
                    fillOpacity: 0.9
                });
            },
            // 3. הצמדת אירועי הלחיצה ומנגנון "כרית המגע" השקופה
            onEachFeature: function(feature, layer) {
                const props = feature.properties;

                // במידה והאלמנט הוא קו מסלול (Track)
                if (props.type === 'track' && feature.geometry.type === 'LineString') {
                    // יצירת קו הגנה שקוף רחב במיוחד ללכידת אצבעות בנייד
                    const catchLayer = L.polyline(layer.getLatLngs(), {
                        color: '#3498db',
                        weight: 26,    // טווח רחב מאוד ללחיצה קלה ללא צורך בדיוק
                        opacity: 0.01,  // כמעט שקוף לגמרי אך מרונדר בדפדפן
                        interactive: true
                    }).addTo(map);

                    catchLayer.on('click', function(e) {
                        updatePanel(props);
                        
                        // אפקט הבהוב קצר כדי לתת אישור ויזואלי לגולש
                        layer.setStyle({ color: '#e74c3c', weight: 6 });
                        setTimeout(() => layer.setStyle({ color: '#3498db', weight: 4 }), 700);
                        
                        map.fitBounds(layer.getBounds(), { padding: [50, 50] });
                        L.DomEvent.stopPropagation(e);
                    });
                } 
                // במידה והאלמנט הוא נקודת עניין/לינה (Site)
                else if (props.type === 'site') {
                    layer.on('click', function(e) {
                        updatePanel(props);
                        
                        // אפקט הגדלה זמני לנקודה שנלחצה
                        layer.setRadius(14);
                        setTimeout(() => layer.setRadius(10), 400);
                        
                        map.setView(layer.getLatLng(), 12);
                        L.DomEvent.stopPropagation(e);
                    });
                }
            }
        }).addTo(map);

    })
    .catch(error => {
        console.error('Error loading GeoJSON:', error);
        document.getElementById('panel-content').innerHTML = '<p style="color:red; font-weight:bold;">שגיאה בטעינת נתוני המפה בענן.</p>';
    });
