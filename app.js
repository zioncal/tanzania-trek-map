// 1. אתחול המפה וקביעת הראייה על אזור צפון-מזרח טנזניה
const map = L.map('map').setView([-4.6, 38.3], 8);

// 2. טעינת שכבת הבסיס הטופוגרפית (OpenTopoMap)
L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    maxZoom: 17,
    attribution: 'Map data: &copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

// 3. פונקציה משותפת לעדכון פאנל המידע כולל תמיכה בקישורים מאומתים
function updatePanel(props) {
    const panel = document.getElementById('panel-content');
    
    // ייצור דינמי של כפתור קישור - רק במידה ושדה הקישור מוגדר בנתונים
    let linkSectionHtml = '';
    if (props.link) {
        linkSectionHtml = `
            <div class="link-container" style="margin-top: 15px; padding-top: 12px; border-top: 2px dashed #e67e22;">
                <a href="${props.link}" target="_blank" rel="noopener noreferrer" 
                   style="display: inline-block; background-color: #e67e22; color: white; padding: 10px 14px; 
                          text-decoration: none; font-weight: bold; border-radius: 5px; font-size: 13px; 
                          box-shadow: 0 2px 4px rgba(0,0,0,0.15); transition: background 0.2s;">
                    ${props.link_text || '🔗 לחץ לצפייה באתר הרשמי'}
                </a>
            </div>
        `;
    }

    panel.innerHTML = `
        <h2>${props.title}</h2>
        <div class="meta-info" style="margin-bottom: 8px; font-size: 14px;">📊 <b>מרחק יומי:</b> ${props.distance}</div>
        <div class="meta-info" style="margin-bottom: 8px; font-size: 14px;">⏱️ <b>משך זמן:</b> ${props.duration}</div>
        <div class="meta-info" style="margin-bottom: 15px; font-size: 14px;">⛰️ <b>גובה / עלייה מצטברת:</b> ${props.elevation}</div>
        <p class="desc" style="line-height: 1.6; color: #34495e; text-align: justify; border-top: 1px solid #eee; padding-top: 10px; margin-bottom: 10px;">${props.description}</p>
        ${linkSectionHtml}
    `;
}

// 4. טעינת הנתונים והבטחת תצוגה של כל הישויות כאלמנטים אינטראקטיביים
fetch('safari_path.geojson')
    .then(response => {
        if (!response.ok) throw new Error('תגובת רשת שגויה או קובץ חסר');
        return response.json();
    })
    .then(data => {
        L.geoJSON(data, {
            // הגדרת עיצוב ויזואלי לקווי הטרק והספארי
            style: function(feature) {
                return { color: '#d35400', weight: 4, opacity: 0.85, dashArray: '5, 5' };
            },
            // טיפול והוספת אינטראקציה לכל אלמנט ברשימה
            onEachFeature: function(feature, layer) {
                // האזנה ללחיצה על הקו או הנקודה עצמה
                layer.on('click', function(e) {
                    updatePanel(feature.properties);
                    if (feature.geometry.type === 'Point') {
                        map.setView(e.latlng, 12);
                    } else {
                        map.fitBounds(layer.getBounds(), { padding: [40, 40] });
                    }
                });

                // בניית סמן בנקודת ההתחלה של קטעי תנועה (LineString) כדי לאפשר לחיצה נוחה
                if (feature.geometry.type === 'LineString') {
                    const startCoords = feature.geometry.coordinates[0];
                    const marker = L.marker([startCoords[1], startCoords[0]]).addTo(map);
                    
                    marker.on('click', function() {
                        updatePanel(feature.properties);
                        map.setView(marker.getLatLng(), 11);
                    });
                }
            },
            // ציור ישיר של הנקודות המובנות (Points)
            pointToLayer: function(feature, latlng) {
                return L.marker(latlng);
            }
        }).addTo(map);
    })
    .catch(error => {
        console.error('שגיאה בטעינת הקובץ הגאוגרפי:', error);
    });