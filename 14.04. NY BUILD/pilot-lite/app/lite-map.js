export function renderFacilityMiniMap(container, facilities, options = {}) {
    const L = window.L;
    if (!L) {
        container.innerHTML = '<div class="empty">Leaflet ikke lastet – sjekk nettverkstilgang.</div>';
        return;
    }

    const preserveViewport = options.preserveViewport === true;
    let previousView = null;

    // Destroy previous Leaflet instance if any
    if (container._leafletMap) {
        if (preserveViewport) {
            try {
                const oldMap = container._leafletMap;
                previousView = {
                    center: oldMap.getCenter(),
                    zoom: oldMap.getZoom()
                };
            } catch (_) {
                previousView = null;
            }
        }
        container._leafletMap.remove();
        container._leafletMap = null;
    }

    const selectedFacilityId = options.selectedFacilityId || null;
    const analysisRadiusKm = Number(options.analysisRadiusKm) || 20;
    const fitToAllFacilities = options.fitToAllFacilities === true;
    const infectedIds = options.infectedIds || new Set();
    const severeIds = options.severeIds || new Set();
    const alertWarningIds = options.alertWarningIds || new Set();
    const liceHighIds = options.liceHighIds || new Set();
    const ilaProtectionIds = options.ilaProtectionIds || new Set();
    const ilaSurveillanceIds = options.ilaSurveillanceIds || new Set();
    const demandFacilityIds = options.demandFacilityIds || new Set();
    const demandCountByFacility = options.demandCountByFacility || new Map();
    const availableFacilityIds = options.availableFacilityIds || new Set();
    const demoFacilityIds = options.demoFacilityIds || new Set();
    const masovalFacilityIds = options.masovalFacilityIds || new Set(); // Facilities owned by Masøval company
    const showSelectionRadius = options.showSelectionRadius !== false;
    const nearbyVessels = options.nearbyVessels || [];
    const nearbyRiskVessels = options.nearbyRiskVessels || [];
    const nearbyClearedVessels = options.nearbyClearedVessels || [];
    const froyVessels = options.froyVessels || []; // Frøy fleet – shown as teal boat icons
    const selectedVesselMmsi = String(options.selectedVesselMmsi || '').trim();
    const centerOnSelectedVessel = options.centerOnSelectedVessel === true;
    const selectableFacilityIds = options.selectableFacilityIds || null;
    const onFacilityClick = typeof options.onFacilityClick === 'function' ? options.onFacilityClick : null;
    const onNearbyVesselClick = typeof options.onNearbyVesselClick === 'function' ? options.onNearbyVesselClick : null;
    const onFroyVesselClick = typeof options.onFroyVesselClick === 'function' ? options.onFroyVesselClick : null;

    const cleanText = (...values) => {
        for (const value of values) {
            const text = String(value ?? '').trim();
            if (text) return text;
        }
        return '';
    };

    const normalizeText = (value) => String(value || '').trim().toLowerCase();

    const createHalfBlueIcon = (mainColor, strokeColor, size = 12) => L.divIcon({
        className: 'facility-half-marker-icon',
        html: `<span class="facility-half-marker" style="--marker-main:${mainColor};--marker-stroke:${strokeColor};--marker-size:${size}px"></span>`,
        iconSize: [size + 6, size + 6],
        iconAnchor: [Math.round((size + 6) / 2), Math.round((size + 6) / 2)]
    });

    const createDemandPinIcon = () => L.divIcon({
        className: 'facility-demand-marker-icon',
        html: '<span class="facility-demand-marker"></span>',
        iconSize: [10, 10],
        iconAnchor: [-1, 10]
    });

    const getFacilityProductionInfo = (facility) => {
        const raw = cleanText(
            facility?.production_type,
            facility?.productionType,
            facility?.fdir?.production_type,
            facility?.fdir?.species,
            facility?.species
        );
        const normalized = normalizeText(raw);

        if (!normalized) return { label: 'Ukjent produksjon', fillColor: '#94a3b8' };
        if (/(smolt|settefisk|yngel)/.test(normalized)) return { label: raw || 'Smolt', fillColor: '#06b6d4' };
        if (/(stamfisk|brood|rogn)/.test(normalized)) return { label: raw || 'Stamfisk', fillColor: '#8b5cf6' };
        if (/(skjell|musling|oyster|østers|tare|alge|algae|shell)/.test(normalized)) return { label: raw, fillColor: '#16a34a' };
        if (/(matfisk|laks|salmon|orret|ørret|regnbue)/.test(normalized)) return { label: raw || 'Matfisk', fillColor: '#2563eb' };
        return { label: raw, fillColor: '#64748b' };
    };

    const isNorwayCoordinate = (lat, lon) => Number.isFinite(lat) && Number.isFinite(lon) && lat >= 57 && lat <= 72 && lon >= 3 && lon <= 32;

    const withCoords = (facilities || []).filter(
        (item) => {
            const lat = Number(item.latitude);
            const lon = Number(item.longitude);
            return isNorwayCoordinate(lat, lon);
        }
    );

    if (withCoords.length === 0) {
        container.innerHTML = '<div class="empty">Ingen koordinater tilgjengelig for kartvisning.</div>';
        return;
    }

    // Remove old content and let Leaflet own the container
    container.innerHTML = '';

    const map = L.map(container, {
        zoomControl: true,
        attributionControl: true,
        scrollWheelZoom: true
    });
    container._leafletMap = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 15
    }).addTo(map);

    const bounds = [];
    let selectedLatLng = null;
    let selectedVesselLatLng = null;
    const riskMmsi = new Set(nearbyRiskVessels.map((item) => String(item?.vessel?.mmsi || '').trim()).filter(Boolean));
    const clearedMmsi = new Set(nearbyClearedVessels.map((item) => String(item?.vessel?.mmsi || '').trim()).filter(Boolean));

    for (const facility of withCoords) {
        const lat = Number(facility.latitude);
        const lng = Number(facility.longitude);
        const facilityId = String(facility.id || '').trim();
        const isSelected = selectedFacilityId && facility.id === selectedFacilityId;
        const isInfected = infectedIds.has(facility.id) || infectedIds.has(facilityId);
        const isSevere = severeIds.has(facility.id) || severeIds.has(facilityId);
        const isAlert = alertWarningIds.has(String(facility.id || ''));
        const isIlaProtection = ilaProtectionIds.has(facility.id) || ilaProtectionIds.has(facilityId);
        const isIlaSurveillance = ilaSurveillanceIds.has(facility.id) || ilaSurveillanceIds.has(facilityId);
        const demandCountRaw = Number(demandCountByFacility instanceof Map
            ? demandCountByFacility.get(facilityId)
            : demandCountByFacility?.[facilityId]);
        const demandCount = Number.isFinite(demandCountRaw) ? Math.max(0, Math.round(demandCountRaw)) : 0;
        const hasDemand = demandFacilityIds.has(facility.id) || demandFacilityIds.has(facilityId) || demandCount > 0;
        const isAvailableWindow = availableFacilityIds.has(facility.id) || availableFacilityIds.has(facilityId);
        const liceAdultFemale = Number(
            facility?.liceAdultFemale
            ?? facility?.lice?.adult_female
            ?? facility?.adult_female_lice
            ?? NaN
        );
        const isLiceHigh = liceHighIds.has(facility.id)
            || liceHighIds.has(facilityId)
            || facility?.liceHigh === true
            || facility?.lice_over_threshold === true
            || facility?.lice?.over_threshold === true
            || (Number.isFinite(liceAdultFemale) && liceAdultFemale >= 0.5);
        // isDemoRegistered: for facility dashboard (calendar enabled)
        // OR: is Masøval facility (for vessel dashboard)
        const isDemoRegistered = demoFacilityIds.has(String(facility.id || '')) || masovalFacilityIds.has(String(facility.id || ''));
        const production = getFacilityProductionInfo(facility);

        // Risk color precedence: infected (red) -> lice (purple) -> ILA protection (orange) -> ILA surveillance (yellow) -> generic warning
        const riskColor = isInfected
            ? '#dc2626'
            : isLiceHigh
            ? '#a855f7'
            : isIlaProtection
            ? '#f97316'
            : isIlaSurveillance
            ? '#eab308'
            : (isAlert || isSevere)
            ? '#f97316'
            : '#2563eb';
        const hasRisk = isInfected || isLiceHigh || isIlaProtection || isIlaSurveillance || isAlert || isSevere;
        const neutralColor = '#94a3b8';
        const fillColor = hasRisk ? riskColor : (isAvailableWindow ? '#10b981' : neutralColor);

        let strokeColor = '#ffffff';
        let weight = 1.5;
        if (isSelected) {
            strokeColor = '#0f172a';
            weight = 3;
        } else if (isInfected || isLiceHigh) {
            strokeColor = riskColor;
            weight = 2.5;
        }

        const marker = isDemoRegistered
            ? L.marker([lat, lng], {
                icon: createHalfBlueIcon(
                    hasRisk ? riskColor : neutralColor,
                    strokeColor,
                    isSelected ? 16 : 12
                )
            }).addTo(map)
            : L.circleMarker([lat, lng], {
                radius: isSelected ? 9 : 5,
                fillColor: isInfected ? 'transparent' : fillColor,
                color: isInfected ? '#dc2626' : strokeColor,
                weight: isInfected ? 2.5 : weight,
                fillOpacity: isInfected ? 0 : 1
            }).addTo(map);

        const statusParts = [];
        if (isInfected) statusParts.push('Smittet');
        if (isLiceHigh) statusParts.push('Lus');
        if (isIlaProtection) statusParts.push('ILA vernesone');
        if (isIlaSurveillance) statusParts.push('ILA overvåkning');
        if (hasDemand) statusParts.push(`Etterspørsel${demandCount > 0 ? ` (${demandCount})` : ''}`);
        if (isAvailableWindow) statusParts.push('Ledig vindu');
        if (!statusParts.length && (isAlert || isSevere)) statusParts.push('Varsel');

        const status = isSelected
            ? `Valgt anlegg${statusParts.length ? ` · ${statusParts.join(' + ')}` : ''}`
            : statusParts.length
            ? statusParts.join(' + ')
            : (isDemoRegistered ? 'Kalender aktiv' : 'Normal');

        marker.bindPopup(`<b>${facility.name}</b><br>${facility.municipality || ''}<br>Produksjon: ${production.label}${Number.isFinite(liceAdultFemale) ? `<br>Lus (voksne hunnlus): ${liceAdultFemale.toFixed(2)}` : ''}${isDemoRegistered ? '<br>Kalender aktiv i systemet' : ''}${hasDemand ? `<br>Etterspørsel: ${demandCount > 0 ? demandCount : 'Ja'}` : ''}<br>${status}`);
        marker.bindTooltip(`${facility.name || 'Ukjent anlegg'} · ${production.label}`, {
            direction: 'top',
            offset: [0, -8],
            opacity: 0.92
        });
        const isSelectable = !selectableFacilityIds || selectableFacilityIds.has(String(facility.id || ''));
        if (onFacilityClick && isSelectable) {
            marker.on('click', () => onFacilityClick(facility.id));
        }

        if (hasDemand) {
            L.marker([lat, lng], {
                icon: createDemandPinIcon(),
                interactive: false,
                keyboard: false,
                zIndexOffset: 450
            }).addTo(map);
        }

        bounds.push([lat, lng]);

        if (isSelected && showSelectionRadius) {
            selectedLatLng = [lat, lng];
            L.circle([lat, lng], {
                radius: analysisRadiusKm * 1000,
                color: '#2563eb',
                weight: 1.5,
                dashArray: '6 4',
                fillColor: '#2563eb',
                fillOpacity: 0.04
            }).addTo(map);
        }
    }

    for (const item of nearbyVessels) {
        const lat = Number(item?.vessel?.latitude);
        const lng = Number(item?.vessel?.longitude);
        if (!isNorwayCoordinate(lat, lng)) continue;

        const mmsi = String(item?.vessel?.mmsi || '').trim();
        let color = '#64748b';
        let label = 'AIS-båt';
        if (riskMmsi.has(mmsi)) {
            color = '#dc2626';
            label = 'Risiko-båt';
        } else if (clearedMmsi.has(mmsi)) {
            color = '#10b981';
            label = 'Signert grønn båt';
        }

        const vesselMarker = L.circleMarker([lat, lng], {
            radius: 4,
            fillColor: color,
            color: '#ffffff',
            weight: 1,
            fillOpacity: 1
        })
            .addTo(map)
            .bindPopup(`<b>${item?.vessel?.name || mmsi || 'Ukjent båt'}</b><br>${label}<br>${(item?.distanceKm ?? 0).toFixed(1)} km`);
        if (onNearbyVesselClick) {
            vesselMarker.on('click', () => onNearbyVesselClick(item?.vessel, item));
        }
        bounds.push([lat, lng]);
    }

    // Frøy fleet – teal boat marker with speed and vessel name
    for (const v of froyVessels) {
        const lat = Number(v?.latitude);
        const lng = Number(v?.longitude);
        if (!isNorwayCoordinate(lat, lng)) continue;

        const name = cleanText(v?.name, String(v?.mmsi || ''), 'Ukjent båt');
        const vesselMmsi = String(v?.mmsi || '').trim();
        const isSelectedVessel = selectedVesselMmsi && vesselMmsi === selectedVesselMmsi;
        const speed = Number.isFinite(Number(v?.speedOverGround)) ? `${Number(v.speedOverGround).toFixed(1)} kn` : '–';
        const tsText = v?.msgtime ? new Date(v.msgtime).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' }) : '';

        // Boat-shaped divIcon pointing roughly north
        const boatIcon = L.divIcon({
            className: '',
            html: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="22" viewBox="0 0 18 22">
                <polygon points="9,1 17,20 9,16 1,20" fill="${isSelectedVessel ? '#1d4ed8' : '#0d9488'}" stroke="#ffffff" stroke-width="1.5"/>
            </svg>`,
            iconSize: [18, 22],
            iconAnchor: [9, 11]
        });

        const froyMarker = L.marker([lat, lng], { icon: boatIcon })
            .addTo(map)
            .bindPopup(`<b>${name}</b><br>${isSelectedVessel ? 'Valgt båt' : 'Frøy-båt'}<br>Hastighet: ${speed}${tsText ? `<br>Sist sett: ${tsText}` : ''}`)
            .bindTooltip(name, { direction: 'top', offset: [0, -12], opacity: 0.92 });
        if (onFroyVesselClick) {
            froyMarker.on('click', () => onFroyVesselClick(v));
        }
        if (isSelectedVessel) {
            selectedVesselLatLng = [lat, lng];
            L.circleMarker([lat, lng], {
                radius: 9,
                color: '#1d4ed8',
                weight: 2,
                fillColor: '#dbeafe',
                fillOpacity: 0.3
            }).addTo(map);
        }
        // Don't push Frøy boats into bounds so they don't shift the facility view
    }

    if (previousView && preserveViewport) {
        map.setView(previousView.center, previousView.zoom);
    } else if (centerOnSelectedVessel && selectedVesselLatLng) {
        map.setView(selectedVesselLatLng, 10);
    } else if (fitToAllFacilities && bounds.length > 0) {
        map.fitBounds(bounds, { padding: [20, 20] });
    } else if (selectedLatLng) {
        const [selLat, selLng] = selectedLatLng;
        const radiusMeters = analysisRadiusKm * 1000;
        const latDelta = radiusMeters / 111320;
        const lngDelta = radiusMeters / (111320 * Math.max(Math.cos((selLat * Math.PI) / 180), 0.2));
        const focusBounds = L.latLngBounds(
            [selLat - latDelta, selLng - lngDelta],
            [selLat + latDelta, selLng + lngDelta]
        );
        map.fitBounds(focusBounds.pad(0.2), { padding: [20, 20], maxZoom: 11 });
    } else if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [20, 20] });
    }

    // Force Leaflet to recalculate container size after CSS layout settles
    setTimeout(() => { map.invalidateSize(); }, 100);
}
