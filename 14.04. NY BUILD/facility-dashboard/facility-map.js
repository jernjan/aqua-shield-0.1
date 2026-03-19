// facility-map.js - Map visualization

const FacilityMap = {
  map: null,
  selectedFacilityMarker: null,
  facilityMarkers: [],
  vesselMarkers: [],
  lastNearbyVesselsCount: 0,
  filterNearbyOnly: true,
  nearbyRadiusKm: 20,
  currentFacility: null,
  onFacilitySelect: null,
  
  // Toggle visibility states
  showFacilities: true,
  showVessels: true,
  showRisk: true,

  isLiceHigh(facility) {
    if (!facility || typeof facility !== 'object') return false;
    return facility.lice_over_threshold === true
      || facility.liceHigh === true
      || facility?.lice?.over_threshold === true;
  },

  applySplitMarkerStyle(marker, markerClass, liceHigh) {
    const element = marker?.getElement?.();
    if (!element) return;

    const baseColorMap = {
      'facility-marker-small-red': '#ef4444',
      'facility-marker-small-orange': '#f97316',
      'facility-marker-small-amber': '#f59e0b',
      'facility-marker-small-yellow': '#facc15',
      'facility-marker-small-green': '#22c55e',
      'facility-marker-small-purple': '#7c3aed'
    };

    const baseColor = baseColorMap[markerClass] || '#22c55e';
    const shouldSplit = liceHigh === true && ['facility-marker-small-red', 'facility-marker-small-orange', 'facility-marker-small-amber', 'facility-marker-small-yellow'].includes(markerClass);
    element.style.background = shouldSplit
      ? `linear-gradient(90deg, ${baseColor} 0 50%, #7c3aed 50% 100%)`
      : baseColor;
  },

  setFilter({ showNearbyOnly, radiusKm }) {
    this.filterNearbyOnly = !!showNearbyOnly;
    this.nearbyRadiusKm = Number.isFinite(radiusKm) ? radiusKm : 20;
  },

  setOnFacilitySelect(callback) {
    this.onFacilitySelect = typeof callback === 'function' ? callback : null;
  },
  
  // Initialize map and event listeners
  init(containerId = 'facilityMap') {
    if (this.map) {
      this.map.remove();
    }

    const container = document.getElementById(containerId);
    if (!container) {
      console.error('❌ Map container not found:', containerId);
      return null;
    }

    if (typeof L === 'undefined') {
      console.error('❌ Leaflet library not available in facility dashboard');
      container.innerHTML = `
        <div style="padding: 1rem; border-radius: 8px; background: #fef2f2; color: #991b1b; text-align: center;">
          Kartet kunne ikke lastes (Leaflet mangler). Oppdater siden eller sjekk nettverk/CDN-tilgang.
        </div>
      `;
      return null;
    }
    
    // Create map centered on Norway coast
    this.map = L.map(containerId).setView([63.4305, 10.3951], 9);
    
    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 18
    }).addTo(this.map);
    
    // Setup toggle listeners
    this.setupToggleListeners();
    
    
    return this.map;
  },

  // Setup toggle event listeners
  setupToggleListeners() {
    const facilityToggle = document.getElementById('toggleFacilities');
    const vesselToggle = document.getElementById('toggleVessels');
    const riskToggle = document.getElementById('toggleRisk');

    if (facilityToggle) {
      facilityToggle.addEventListener('change', (e) => {
        this.showFacilities = e.target.checked;
        this.updateMarkerVisibility();
        
      });
    }

    if (vesselToggle) {
      vesselToggle.addEventListener('change', (e) => {
        this.showVessels = e.target.checked;
        this.updateMarkerVisibility();
        
      });
    }

    if (riskToggle) {
      riskToggle.addEventListener('change', (e) => {
        this.showRisk = e.target.checked;
        
        // Toggle legend visibility
        const legendGroup = document.getElementById('bwRiskLegendGroup');
        if (legendGroup) {
          legendGroup.style.display = this.showRisk ? 'inline' : 'none';
        }
        
        // Toggle BW-risk sidebar panel visibility
        const bwRiskPanel = document.getElementById('bwRiskPanel');
        if (bwRiskPanel) {
          bwRiskPanel.style.display = this.showRisk ? 'block' : 'none';
        }
        
        this.refreshFacilitiesView();
        
      });
    }
  },

  refreshFacilitiesView() {
    if (!this.map) return;
    
    // Skip expensive rendering if facilities layer is hidden
    if (!this.showFacilities) return;

    if (this.currentFacility) {
      const assessment = FacilityLogic.assessRisk(this.currentFacility);
      this.displayFacility(this.currentFacility, assessment);
      return;
    }

    this.displayAllFacilities();
  },

  // Update marker visibility based on toggle states
  updateMarkerVisibility() {
    // Update facility markers
    if (this.selectedFacilityMarker) {
      if (this.showFacilities) {
        this.map.addLayer(this.selectedFacilityMarker);
      } else {
        this.map.removeLayer(this.selectedFacilityMarker);
      }
    }

    // Update other facility markers
    this.facilityMarkers.forEach((marker, idx) => {
      try {
        if (this.showFacilities && !marker._map) {
          this.map.addLayer(marker);
        } else if (!this.showFacilities && marker._map) {
          this.map.removeLayer(marker);
        }
      } catch (e) {
        // Silently handle markers that don't exist
      }
    });

    // Update vessel markers
    this.vesselMarkers.forEach((marker) => {
      try {
        if (this.showVessels && !marker._map) {
          this.map.addLayer(marker);
        } else if (!this.showVessels && marker._map) {
          this.map.removeLayer(marker);
        }
      } catch (e) {
        // Silently handle markers that don't exist
      }
    });
  },
  
  
  // Display facility and surrounding facilities
  async displayFacility(facility, assessment) {
    if (!this.map || !facility) return;
    
    // Clear existing markers
    this.clearMarkers();

    this.currentFacility = facility;
    
    const lat = FacilityData.parseCoordinate(facility.latitude);
    const lon = FacilityData.parseCoordinate(facility.longitude);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      console.warn('⚠️ Invalid facility coordinates for map display:', facility?.name, facility?.latitude, facility?.longitude);
      return;
    }
    
    // Center map on facility
    this.map.setView([lat, lon], 10);
    
    // Add selected facility marker (blue)
    const selectedIcon = L.divIcon({
      className: 'facility-marker-blue',
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });
    
    this.selectedFacilityMarker = L.marker([lat, lon], { icon: selectedIcon })
      .addTo(this.map)
      .bindPopup(`<strong>${facility.name}</strong><br>Ditt anlegg`)
      .bindTooltip(facility.name || 'Ukjent anlegg', { direction: 'top', offset: [0, -8], opacity: 0.95 });
    
    // Add radius circle
    L.circle([lat, lon], {
      radius: this.nearbyRadiusKm * 1000,
      color: '#3b82f6',
      fillColor: '#93c5fd',
      fillOpacity: 0.1,
      weight: 2,
      dashArray: '5, 5'
    }).addTo(this.map);
    
    // Display all other facilities
    this.displayOtherFacilities(facility);

    // Display nearby vessels (AIS) - only if toggle is enabled
    const toggleVesselsEl = document.getElementById('toggleVessels');
    if (!toggleVesselsEl || toggleVesselsEl.checked) {
      await this.displayNearbyVessels(facility);
    }
    
    // Display ocean current arrow
    this.displayOceanCurrent(facility);

    // Display additional ocean current hints near infected facilities
    await this.displayNearbyOceanCurrents(assessment);
    
    // Highlight nearby infected if any
    if (assessment && assessment.nearbyInfected && assessment.nearbyInfected.length > 0) {
      assessment.nearbyInfected.forEach(item => {
        const infectedMarker = L.circle(
          [item.facility.latitude, item.facility.longitude],
          {
            radius: 2000,
            color: '#ef4444',
            fillColor: '#fecaca',
            fillOpacity: 0.3,
            weight: 2
          }
        ).addTo(this.map);
        
        infectedMarker.bindPopup(
          `<strong>${item.facility.name}</strong><br>` +
          `⚠️ Smittet: ${item.diseases.join(', ')}<br>` +
          `Avstand: ${item.distance.toFixed(1)} km`
        );
        
        this.facilityMarkers.push(infectedMarker);
      });
    }

    // Display local smitte radius if enabled
    this.displayLocalSmitteRadius(facility);
  },
  
  // Display facilities within 10km of confirmed infected (bonus local radius feature)
  displayLocalSmitteRadius(currentFacility) {
    const toggle = document.getElementById('toggleLocalSmitteRadius');
    if (!toggle || !toggle.checked) return;
    
    const infectedFacilities = FacilityData.getInfectedFacilities();
    if (infectedFacilities.length === 0) return;
    
    const localSmitteRadius = 10; // km - fixed at 10km
    const nearbyRadius = 20; // Only show facilities within 20 km of selected facility
    
    // Find all facilities within 10km of ANY infected facility
    const facilitiesInLocalRadius = new Set();
    
    infectedFacilities.forEach(infected => {
      FacilityData.facilities.forEach(facility => {
        // Skip current facility
        if (facility.name === currentFacility.name) return;
        
        // Skip already infected
        const diseases = facility.diseases || facility.diseaseInfo?.diseases || [];
        const isInfected = Array.isArray(diseases) && diseases.length > 0;
        if (isInfected) return;
        
        // Check distance to infected facility
        const distanceToInfected = FacilityData.calculateDistance(
          facility.latitude,
          facility.longitude,
          infected.latitude,
          infected.longitude
        );
        
        if (distanceToInfected <= localSmitteRadius) {
          // ALSO check distance to SELECTED facility (not infected)
          const distanceToSelected = FacilityData.calculateDistance(
            facility.latitude,
            facility.longitude,
            currentFacility.latitude,
            currentFacility.longitude
          );
          
          // Only add if within 20 km of selected facility
          if (distanceToSelected <= nearbyRadius) {
            facilitiesInLocalRadius.add(facility.name);
          }
        }
      });
    });
    
    // Display facilities in local radius as yellow markers
    facilitiesInLocalRadius.forEach(facilityName => {
      const facility = FacilityData.getFacility(facilityName);
      if (!facility || !facility.latitude || !facility.longitude) return;
      
      const icon = L.divIcon({
        className: 'facility-marker-small-yellow',
        iconSize: [12, 12],
        iconAnchor: [6, 6]
      });

      const liceHigh = this.isLiceHigh(facility);
      
      const marker = L.marker([facility.latitude, facility.longitude], { icon })
        .addTo(this.map)
        .bindPopup(
          `<strong>${facility.name}</strong><br>` +
          `⚠️ Innenfor lokal smitteradius (10 km fra smittet)<br>` +
          `${liceHigh ? '<span style="color:#7c3aed;font-weight:600;">🟣 Høge lusetal (delt markør)</span><br>' : ''}` +
          `Anbefalt: Desinfeksjon/karantene prosedyre for båter`
        )
        .bindTooltip(facility.name || 'Ukjent anlegg', { direction: 'top', offset: [0, -8], opacity: 0.95 });

      this.applySplitMarkerStyle(marker, 'facility-marker-small-yellow', liceHigh);
      
      if (this.onFacilitySelect) {
        marker.on('click', () => this.onFacilitySelect(facility));
      }
      
      this.facilityMarkers.push(marker);
    });
  },
  
  // Display all other facilities on map
  displayOtherFacilities(currentFacility) {
    const facilities = FacilityData.facilities;
    
    facilities.forEach(facility => {
      // Skip current facility
      if (facility.name === currentFacility.name) return;
      
      const lat = FacilityData.parseCoordinate(facility.latitude);
      const lon = FacilityData.parseCoordinate(facility.longitude);
      
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

      if (this.filterNearbyOnly) {
        const distance = FacilityData.calculateDistance(
          lat,
          lon,
          currentFacility.latitude,
          currentFacility.longitude
        );
        if (distance > this.nearbyRadiusKm) return;
      }
      
      // Determine facility status
      const diseases = facility.diseases || facility.diseaseInfo?.diseases || [];
      const isInfected = Array.isArray(diseases) && diseases.length > 0;
      
      // PRIMARY SOURCE: Get BarentsWatch risk (from disease-spread API)
      const riskData = FacilityData.getFacilityRiskData(facility, { skipGeo: true });
      const hasBwRisk = FacilityData.isSevereRiskLevel(riskData?.risk_level);
      const zoneType = String(riskData?.zone_type || facility?.zone_type || '').toUpperCase();
      const liceHigh = this.isLiceHigh(facility);
      
      let markerClass = 'facility-marker-small-green';
      
      // RED = Confirmed diseased
      if (isInfected) {
        markerClass = 'facility-marker-small-red';
      } 
      // ORANGE = BarentsWatch risk (OFFICIAL source)
      else if (this.showRisk && hasBwRisk) {
        markerClass = zoneType === 'SURVEILLANCE'
          ? 'facility-marker-small-amber'
          : 'facility-marker-small-orange';
      } else if (liceHigh) {
        markerClass = 'facility-marker-small-purple';
      }
      
      const icon = L.divIcon({
        className: markerClass,
        iconSize: [12, 12],
        iconAnchor: [6, 6]
      });
      
      const marker = L.marker([lat, lon], { icon })
        .addTo(this.map)
        .bindPopup(this.createFacilityPopup(facility, isInfected, riskData))
        .bindTooltip(facility.name || 'Ukjent anlegg', { direction: 'top', offset: [0, -8], opacity: 0.95 });

      this.applySplitMarkerStyle(marker, markerClass, liceHigh);

      if (this.onFacilitySelect) {
        marker.on('click', () => this.onFacilitySelect(facility));
      }
      
      this.facilityMarkers.push(marker);
    });
  },

  displayAllFacilities() {
    if (!this.map) return;

    this.clearMarkers();

    // Wider overview for initial selection
    this.map.setView([64.5, 12.0], 5);

    const facilities = FacilityData.facilities || [];

    facilities.forEach(facility => {
      const lat = FacilityData.parseCoordinate(facility.latitude);
      const lon = FacilityData.parseCoordinate(facility.longitude);

      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

      const diseases = facility.diseases || facility.diseaseInfo?.diseases || [];
      const isInfected = Array.isArray(diseases) && diseases.length > 0;
      
      // PRIMARY SOURCE: BarentsWatch risk data (from disease-spread API)
      const riskData = FacilityData.getFacilityRiskData(facility, { skipGeo: true });
      const hasBwRisk = FacilityData.isSevereRiskLevel(riskData?.risk_level);
      const zoneType = String(riskData?.zone_type || facility?.zone_type || '').toUpperCase();
      const liceHigh = this.isLiceHigh(facility);

      let markerClass = 'facility-marker-small-green';

      // RED = Confirmed diseased from diseases array
      if (isInfected) {
        markerClass = 'facility-marker-small-red';
      } 
      // ORANGE = BarentsWatch risk (PRIMARY source)
      else if (this.showRisk && hasBwRisk) {
        markerClass = zoneType === 'SURVEILLANCE'
          ? 'facility-marker-small-amber'
          : 'facility-marker-small-orange';
      } else if (liceHigh) {
        markerClass = 'facility-marker-small-purple';
      }

      const icon = L.divIcon({
        className: markerClass,
        iconSize: [12, 12],
        iconAnchor: [6, 6]
      });

      const marker = L.marker([lat, lon], { icon })
        .addTo(this.map)
        .bindPopup(this.createFacilityPopup(facility, isInfected, riskData))
        .bindTooltip(facility.name || 'Ukjent anlegg', { direction: 'top', offset: [0, -8], opacity: 0.95 });

      this.applySplitMarkerStyle(marker, markerClass, liceHigh);

      if (this.onFacilitySelect) {
        marker.on('click', () => this.onFacilitySelect(facility));
      }

      this.facilityMarkers.push(marker);
    });
  },

  async displayNearbyVessels(currentFacility) {
    if (!currentFacility) return;

    if (!Array.isArray(FacilityData.vessels) || FacilityData.vessels.length === 0) {
      
      await FacilityData.loadVessels();
    }

    
    
    
    
    
    
    // Debug: Check first few vessels
    if (FacilityData.vessels.length > 0) {
      
      FacilityData.vessels.slice(0, 5).forEach((v, i) => {
        
      });
    } else {
      console.warn(`⚠️ NO VESSELS LOADED - Check API connection!`);
    }

    const vesselsNearby = FacilityData.findVesselsWithinDistance(
      currentFacility.latitude,
      currentFacility.longitude,
      this.nearbyRadiusKm
    );

    this.lastNearbyVesselsCount = vesselsNearby.length;
    
    

    const getStatusStyle = (status) => {
      let color = '#1e293b';
      let fillColor = '#cbd5e1';

      if (status === 'breach') {
        color = '#7f1d1d';
        fillColor = '#dc2626';
      } else if (status === 'cleared') {
        color = '#166534';
        fillColor = '#22c55e';
      } else if (status === 'not-cleared') {
        color = '#7f1d1d';
        fillColor = '#ef4444';
      } else if (status === 'quarantine') {
        color = '#92400e';
        fillColor = '#f97316';
      } else if (status === 'caution') {
        color = '#713f12';
        fillColor = '#eab308';
      }

      return { color, fillColor };
    };

    const buildPopup = (vessel, distance, status) => {
      const vesselName = vessel.name || `MMSI ${vessel.mmsi}`;
      const vesselMmsi = vessel.mmsi || '--';
      const vesselSpeed = vessel.speedOverGround ?? '--';
      const vesselHeading = vessel.trueHeading ?? vessel.courseOverGround ?? '--';

      let statusLabel = 'Registrert i AIS';
      let quarantineWarning = '';

      if (status === 'checking') {
        statusLabel = 'Sjekker status...';
      } else if (status === 'breach') {
        statusLabel = 'KARANTENEBRUDD';
        quarantineWarning = `<span style="color: #dc2626; font-weight: bold;">⛔ KARANTENEBRUDD - Besøkt annet anlegg innen 48 timer</span><br>`;
      } else if (status === 'cleared') {
        statusLabel = 'Klarert';
      } else if (status === 'not-cleared') {
        statusLabel = 'Risiko';
      } else if (status === 'quarantine') {
        statusLabel = 'I KARANTENE';
        const cached = FacilityData.quarantineCache[vessel.mmsi];
        const hoursRemaining = cached?.hoursRemaining || 0;
        quarantineWarning = `<span style="color: #ef4444; font-weight: bold;">⚠️ KARANTENE - ${Math.ceil(hoursRemaining)} timer gjenstår</span><br>`;
      } else if (status === 'caution') {
        statusLabel = 'FORSIKTIG';
        quarantineWarning = `<span style="color: #f59e0b; font-weight: bold;">⚡ FORSIKTIG - Nylig fra smittet anlegg</span><br>`;
      }

      return (
        `<strong>${vesselName}</strong><br>` +
        `MMSI: ${vesselMmsi}<br>` +
        quarantineWarning +
        `Status: ${statusLabel}<br>` +
        `Fart: ${vesselSpeed} kn<br>` +
        `Kurs: ${vesselHeading}<br>` +
        `Avstand: ${distance.toFixed(1)} km`
      );
    };

    for (const item of vesselsNearby) {
      const vessel = item.vessel;
      const vLat = FacilityData.parseCoordinate(vessel.latitude);
      const vLon = FacilityData.parseCoordinate(vessel.longitude);

      if (!Number.isFinite(vLat) || !Number.isFinite(vLon)) {
        continue;
      }

      const initialStyle = getStatusStyle('checking');
      
      // Create SVG triangle marker for vessel (compact size - 20x20)
      const triangleSvg = `
        <svg width="20" height="20" viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg">
          <polygon points="15,2 28,26 2,26" 
            fill="${initialStyle.fillColor}" 
            stroke="${initialStyle.color}" 
            stroke-width="2"/>
        </svg>
      `;
      
      const vesselIcon = L.divIcon({
        html: triangleSvg,
        iconSize: [20, 20],
        className: 'vessel-triangle-marker'
      });
      
      const marker = L.marker([vLat, vLon], {
        icon: vesselIcon
      }).addTo(this.map);

      marker.vesselMmsi = vessel.mmsi;
      marker.bindPopup(buildPopup(vessel, item.distance, 'checking'));

      const vesselName = vessel.name || `MMSI ${vessel.mmsi}`;
      const vesselMmsi = vessel.mmsi || '--';
      marker.bindTooltip(`${vesselName} (${vesselMmsi})`, {
        permanent: false,
        direction: 'top',
        offset: [0, -10]
      });

      this.vesselMarkers.push(marker);

      FacilityData.getVesselStatus(vessel.mmsi)
        .then((status) => {
          const nextStyle = getStatusStyle(status);
          
          // Update SVG triangle color
          const newTriangleSvg = `
            <svg width="20" height="20" viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg">
              <polygon points="15,2 28,26 2,26" 
                fill="${nextStyle.fillColor}" 
                stroke="${nextStyle.color}" 
                stroke-width="2"/>
            </svg>
          `;
          
          const newVesselIcon = L.divIcon({
            html: newTriangleSvg,
            iconSize: [20, 20],
            className: 'vessel-triangle-marker'
          });
          
          marker.setIcon(newVesselIcon);
          marker.setPopupContent(buildPopup(vessel, item.distance, status));
        })
        .catch(() => {
          marker.setPopupContent(buildPopup(vessel, item.distance, 'unregistered'));
        });
    }
  },
  
  // Display ocean current arrow
  displayOceanCurrent(facility) {
    const currentData = FacilityData.currentOceanData;
    if (!currentData) {
      
      return;
    }

    // Calculate arrow position with offset to avoid overlapping facility marker
    const lat = facility.latitude;
    const lon = facility.longitude;
    
    // Get direction and speed
    const direction = currentData.direction || 0; // degrees, 0=N, 90=E
    const speed = currentData.speed || 0; // m/s
    
    // Offset arrow 0.01 degrees (~1km) to the east to avoid marker overlap
    const offsetLon = lon + 0.015;
    
    const arrowMarker = this.createOceanCurrentMarker(
      lat,
      offsetLon,
      direction,
      speed,
      { popupTitle: 'Havstrøm (ved anlegg)', openPopup: true, sizeScale: 1 }
    );

    this.facilityMarkers.push(arrowMarker);
  },

  createOceanCurrentMarker(lat, lon, direction, speed, options = {}) {
    const sizeScale = Number.isFinite(options.sizeScale) ? options.sizeScale : 1;
    
    // Arrow size scales with speed (strength indicator)
    const baseSize = 20;
    const speedFactor = Math.min(speed * 80, 20); // max +20px for strong currents
    const arrowSize = Math.min(50, (baseSize + speedFactor) * sizeScale);
    
    // Color indicates strength: gray (very weak), light blue (weak), blue (medium), dark blue (strong)
    let arrowColor = '#cbd5e1'; // very weak (< 0.03 m/s)
    let strengthLabel = 'Veldig svak';
    let strokeWidth = 1;
    
    if (speed >= 0.20) {
      arrowColor = '#1e3a8a'; // dark blue - strong
      strengthLabel = 'Sterk';
      strokeWidth = 2;
    } else if (speed >= 0.12) {
      arrowColor = '#1e40af'; // blue - medium
      strengthLabel = 'Middels';
      strokeWidth = 1.5;
    } else if (speed >= 0.05) {
      arrowColor = '#3b82f6'; // light blue - weak
      strengthLabel = 'Svak';
      strokeWidth = 1;
    } else if (speed >= 0.03) {
      arrowColor = '#94a3b8'; // gray-blue - very weak
      strengthLabel = 'Veldig svak';
      strokeWidth = 0.8;
    }
    
    const popupTitle = options.popupTitle || 'Havstrøm';

    const arrowIcon = L.divIcon({
      className: 'ocean-current-arrow',
      html: `<div style="
        width: ${arrowSize}px; 
        height: ${arrowSize}px; 
        transform: rotate(${direction}deg);
        background: url('data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22><polygon points=%2212,2 22,22 12,18 2,22%22 fill=%22${encodeURIComponent(arrowColor)}%22 stroke=%22white%22 stroke-width=%22${strokeWidth}%22/></svg>');
        background-size: contain;
        background-repeat: no-repeat;
        background-position: center;
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
        pointer-events: none;
      "></div>`,
      iconSize: [arrowSize, arrowSize],
      iconAnchor: [arrowSize / 2, arrowSize / 2]
    });

    const marker = L.marker([lat, lon], { icon: arrowIcon, interactive: false, keyboard: false })
      .addTo(this.map)
      .bindPopup(
        `<strong>${popupTitle}</strong><br>` +
        `Retning: ${Math.round(direction)}° (${this.getDirectionName(direction)})<br>` +
        `Fart: ${(speed * 100).toFixed(1)} cm/s<br>` +
        `Styrke: <strong style="color: ${arrowColor};">${strengthLabel}</strong><br>` +
        `<small style="color: #6b7280;">Pilstørrelse og farge indikerer styrke</small>`
      );

    if (options.openPopup) {
      marker.openPopup();
    }

    return marker;
  },

  getDirectionName(degrees) {
    const directions = ['N', 'NØ', 'Ø', 'SØ', 'S', 'SV', 'V', 'NV'];
    const index = Math.round(((degrees % 360) / 45)) % 8;
    return directions[index];
  },

  async displayNearbyOceanCurrents(assessment) {
    if (!assessment || !assessment.nearbyInfected || assessment.nearbyInfected.length === 0) {
      return;
    }

    const candidates = assessment.nearbyInfected
      .slice()
      .sort((a, b) => (a.distance || 0) - (b.distance || 0))
      .slice(0, 3);

    const results = await Promise.all(
      candidates.map(item => FacilityData.getOceanCurrentAt(item.facility.latitude, item.facility.longitude))
    );

    results.forEach((currentData, idx) => {
      const item = candidates[idx];
      if (!currentData || !item || !item.facility) return;

      const marker = this.createOceanCurrentMarker(
        item.facility.latitude,
        item.facility.longitude,
        currentData.direction || 0,
        currentData.speed || 0,
        { popupTitle: `Havstrøm (nært smittet: ${item.facility.name})`, openPopup: false, sizeScale: 0.7 }
      );

      this.facilityMarkers.push(marker);
    });
  },
  
  // Create popup for facility
  createFacilityPopup(facility, isInfected, riskData) {
    let html = `<strong>${facility.name}</strong><br>`;
    const liceHigh = this.isLiceHigh(facility);

    if (isInfected) {
      html += `<span style="color: #ef4444; font-weight: bold;">⚠️ SMITTET</span><br>`;
      const diseases = facility.diseases || [];
      diseases.forEach(d => {
        const diseaseName = typeof d === 'string' ? d : (d.name || 'Ukjent');
        html += `Sykdom: ${diseaseName}<br>`;
      });
    } else if (this.showRisk && riskData) {
      html += `<span style="color: #f59e0b;">BW-risiko: ${riskData.risk_level}</span><br>`;
      if (riskData._match_method) {
        html += `<small style="color: #6b7280;">Match: ${riskData._match_method}</small><br>`;
      }
    } else {
      html += `<span style="color: #10b981;">✓ Frisk</span><br>`;
    }

    if (liceHigh) {
      html += `<span style="color: #7c3aed; font-weight: bold;">🟣 Høge lusetal (delt markør)</span><br>`;
    }

    if (facility.fdir?.production_category) {
      html += `Produksjon: ${facility.fdir.production_category}<br>`;
    }

    const bSurvey = facility.fdir?.latest_b_survey;
    if (bSurvey?.site_condition) {
      const labels = {
        1: '1 - meget god',
        2: '2 - god',
        3: '3 - dårlig',
        4: '4 - meget dårlig'
      };
      const conditionText = labels[bSurvey.site_condition] || bSurvey.site_condition;
      html += `B-undersøkelse: ${conditionText}<br>`;
    }

    return html;
  },
  
  // Refresh vessel markers with updated quarantine status
  async refreshVesselMarkers() {
    if (this.vesselMarkers.length === 0) {
      return; // No markers to refresh
    }

    

    // Update each vessel marker with current status
    for (const marker of this.vesselMarkers) {
      if (!marker.vesselMmsi) {
        continue; // Skip if no MMSI data associated
      }

      // Get updated status
      const status = await FacilityData.getVesselStatus(marker.vesselMmsi);
      
      // Determine new color
      let fillColor = '#cbd5e1'; // Default gray
      let color = '#1e293b';
      
      if (status === 'cleared') {
        color = '#166534';
        fillColor = '#22c55e'; // Green
      } else if (status === 'not-cleared') {
        color = '#7f1d1d';
        fillColor = '#ef4444'; // Red
      } else if (status === 'quarantine') {
        color = '#92400e';
        fillColor = '#f97316'; // Orange
      } else if (status === 'caution') {
        color = '#713f12';
        fillColor = '#eab308'; // Yellow
      }

      // Update marker color by creating new icon with updated SVG
      const newTriangleSvg = `
        <svg width="20" height="20" viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg">
          <polygon points="15,2 28,26 2,26" 
            fill="${fillColor}" 
            stroke="${color}" 
            stroke-width="2"/>
        </svg>
      `;
      
      const newVesselIcon = L.divIcon({
        html: newTriangleSvg,
        iconSize: [20, 20],
        className: 'vessel-triangle-marker'
      });
      
      marker.setIcon(newVesselIcon);
    }

    
  },
  
  // Clear all markers
  clearMarkers() {
    if (this.selectedFacilityMarker) {
      this.map.removeLayer(this.selectedFacilityMarker);
      this.selectedFacilityMarker = null;
    }
    
    this.facilityMarkers.forEach(marker => this.map.removeLayer(marker));
    this.facilityMarkers = [];

    this.vesselMarkers.forEach(marker => this.map.removeLayer(marker));
    this.vesselMarkers = [];
  }
};

// Add CSS for small facility markers
const style = document.createElement('style');
style.textContent = `
  .facility-marker-blue {
    width: 20px !important;
    height: 20px !important;
    background-color: #3b82f6 !important;
    border: 3px solid white;
    border-radius: 50%;
    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
  }
  
  .facility-marker-small-green {
    width: 12px !important;
    height: 12px !important;
    background-color: #10b981 !important;
    border: 2px solid white;
    border-radius: 50%;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  }
  
  .facility-marker-small-red {
    width: 12px !important;
    height: 12px !important;
    background-color: #ef4444 !important;
    border: 2px solid white;
    border-radius: 50%;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  }
  
  .facility-marker-small-orange {
    width: 12px !important;
    height: 12px !important;
    background-color: #f59e0b !important;
    border: 2px solid white;
    border-radius: 50%;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  }

  .facility-marker-small-amber {
    width: 12px !important;
    height: 12px !important;
    background-color: #facc15 !important;
    border: 2px solid white;
    border-radius: 50%;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  }
  
  .facility-marker-small-yellow {
    width: 12px !important;
    height: 12px !important;
    background-color: #fbbf24 !important;
    border: 2px solid white;
    border-radius: 50%;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  }
`;
document.head.appendChild(style);

window.FacilityMap = FacilityMap;
