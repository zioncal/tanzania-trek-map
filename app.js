// 1. שלב ראשון: ציור המסלולים (Lines) עם מנגנון לחיצה מורחב ומדויק
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
                // יצירת קו רחב במיוחד מעל הקו המקורי לצורך לחיצה קלה בנייד
                if (layer.getLatLngs) {
                    const originalLatLngs = layer.getLatLngs();
                    
                    const touchCatchLayer = L.polyline(originalLatLngs, {
                        color: '#3498db', // צבע חוקי חובה
                        weight: 25,       // עובי רחב מאוד לתפיסת האצבע בנייד
                        opacity: 0.01,    // כמעט שקוף לחלוטין, אך קיים עבור הדפדפן ללחיצה
                        interactive: true
                    }).addTo(map);

                    // מאזין לחיצה על השכבה הרחבה
                    touchCatchLayer.on('click', function(e) {
                        updatePanel(feature.properties);
                        
                        // אפקט ויזואלי קטן לקו המקורי (הדק) כדי לתת אישור למשתמש
                        layer.setStyle({ color: '#e74c3c', weight: 5 });
                        setTimeout(() => layer.setStyle({ color: '#3498db', weight: 3 }), 800);
                        
                        L.DomEvent.stopPropagation(e);
                    });
                }
            }
        }).addTo(map);
