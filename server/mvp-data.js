/**
 * MVP Mock Data - Syntetisk data for demo av alle 4 kundegrupper
 * Gruppe 1: Farmers (anlegg) - Fullstendige anleggdata med inspeksjoner, sertifikater
 * Gruppe 2: Vessels (brønnbåter) - AIS, last, compliance, risk zones
 * Gruppe 3: Admin/Regulators (statistikk) - Aggregert risiko, dokumentasjon
 * Gruppe 4: Public (anonymous regional data) - Anonyme varsler, regionale trender
 */

// Mock user accounts for testing
const MOCK_USERS = {
  farmer1: { id: 'user_1', name: 'Arne Anleggmann', email: 'arne@farms.no', role: 'farmer' },
  farmer2: { id: 'user_2', name: 'Berit Fiskeoppdrett', email: 'berit@farms.no', role: 'farmer' },
  vessel1: { id: 'user_3', name: 'Kåre Båtrederi', email: 'kare@shipping.no', role: 'vessel_operator' },
  vessel2: { id: 'user_4', name: 'Siri Sjøtransport', email: 'siri@shipping.no', role: 'vessel_operator' },
};

const generateFarmers = () => {
  const regions = ['Tromsø', 'Finnmark', 'Nord-Trøndelag', 'Sogn og Fjordane', 'Hordaland'];
  const farmers = [];
  const userIds = ['user_1', 'user_2']; // Distribute farms across 2 users
  
  for (let i = 1; i <= 100; i++) {
    const region = regions[Math.floor(Math.random() * regions.length)];
    const baseRisk = Math.floor(Math.random() * 80);
    
    // Generate 2-5 past inspections per farm
    const inspections = [];
    for (let j = 0; j < Math.floor(Math.random() * 4) + 2; j++) {
      inspections.push({
        date: new Date(Date.now() - (j + 1) * 7 * 24 * 3600 * 1000).toISOString(),
        inspector: `Inspektor ${Math.floor(Math.random() * 10) + 1}`,
        findings: Math.floor(Math.random() * 5),
        status: Math.random() > 0.3 ? 'godkjent' : 'merknader',
        reportUrl: `#rapport-${i}-${j}`,
      });
    }

    // Generate realistic coordinates based on region and add current direction
    let lat = 68 + Math.random() * 4;
    let lng = 16 + Math.random() * 8;
    let currentDirection = 'vestlig'; // Westerly current (typical for Norway)
    
    // Classify as upstream/downstream based on position
    // Westerly current = farms to the west are "upstream" (safer if current farm infected)
    const downstreamRisk = lng < 20 ? 'nedstrøms' : lng < 24 ? 'samme-område' : 'oppstrøms';

    farmers.push({
      id: `farm_${i}`,
      userId: userIds[i % 2], // Distribute: user_1 gets farms 1,3,5... user_2 gets 2,4,6...
      name: `Anlegg ${i}`,
      region,
      coordinates: {
        lat,
        lng,
      },
      currentDirection, // Havstrøm-retning
      downstreamRisk, // Smitte-risiko fra nærliggende anlegg
      capacity: Math.floor(50000 + Math.random() * 100000),
      species: ['Atlantisk laks', 'Ørret', 'Piggvar'][Math.floor(Math.random() * 3)],
      type: ['Merd', 'Kar', 'Innland'][Math.floor(Math.random() * 3)],
      riskLevel: baseRisk > 60 ? 'risikofylt' : baseRisk > 40 ? 'høy oppmerksomhet' : 'moderat',
      riskScore: baseRisk,
      lastInspection: inspections[0].date,
      inspectionHistory: inspections,
      owner: `Eier ${Math.floor(Math.random() * 50) + 1}`,
      email: `owner${i}@farm.no`,
      phone: `+47 ${Math.floor(Math.random() * 90000000) + 10000000}`,
      license: `LIS-${2024}-${String(i).padStart(4, '0')}`,
      licenses: [
        { type: 'Driftskonsesjon', expires: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(), status: 'gyldig' },
        { type: 'Miljøkonsesjon', expires: new Date(Date.now() + 500 * 24 * 3600 * 1000).toISOString(), status: 'gyldig' },
      ],
      complianceLogs: [
        {
          date: new Date().toISOString(),
          action: 'Fiskehelseforbrytelse rapportert',
          status: 'dokumentert',
          riskPoints: baseRisk > 60 ? 15 : 8,
        },
        {
          date: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(),
          action: 'Miljøkontroll gjennomført',
          status: 'dokumentert',
          riskPoints: 3,
        },
      ],
      mortalities: {
        thisWeek: Math.floor(Math.random() * 500),
        thisMonth: Math.floor(Math.random() * 2000),
        trend: Math.random() > 0.5 ? 'opp' : 'ned',
      },
      waterTemperature: {
        current: 10 + Math.random() * 5,
        unit: '°C',
        lastMeasured: new Date().toISOString(),
      },
    });
  }
  
  return farmers;
};

const generateVessels = () => {
  const vessels = [];
  const fishTypes = ['Laks', 'Torsk', 'Sei', 'Hyse'];
  const zones = ['Tromsø fiskeripolitizone', 'Finnmark fiskeripolitizone', 'Nord-Trøndelag fiskeripolitizone', 'Sogn fiskeripolitizone'];
  const userIds = ['user_3', 'user_4']; // Distribute vessels across 2 users
  
  for (let i = 1; i <= 20; i++) {
    const riskZones = [];
    for (let j = 0; j < Math.floor(Math.random() * 3) + 1; j++) {
      riskZones.push({
        zone: zones[Math.floor(Math.random() * zones.length)],
        riskLevel: ['høy oppmerksomhet', 'moderat', 'lav'][Math.floor(Math.random() * 3)],
        distance: Math.floor(Math.random() * 50),
        timestamp: new Date(Date.now() - j * 24 * 3600 * 1000 - Math.random() * 12 * 3600 * 1000).toISOString(),
        status: Math.random() > 0.5 ? 'aktiv' : 'passert',
      });
    }

    const complianceActions = [];
    for (let j = 0; j < Math.floor(Math.random() * 4) + 2; j++) {
      complianceActions.push({
        date: new Date(Date.now() - j * 7 * 24 * 3600 * 1000).toISOString(),
        action: ['Fangst loggført', 'Dokumentasjon kontrollert', 'Sertifikat verifisert', 'Inspeksjon gjennomført'][Math.floor(Math.random() * 4)],
        location: ['Vest-Finnmark', 'Øst-Finnmark', 'Tromsø', 'Nord-Trøndelag'][Math.floor(Math.random() * 4)],
        verified: Math.random() > 0.3,
      });
    }

    vessels.push({
      id: `vessel_${i}`,
      userId: userIds[i % 2], // Distribute: user_3 gets vessels 1,3,5... user_4 gets 2,4,6...
      name: `M/S Båt ${i}`,
      mmsi: 250000000 + i,
      type: ['Brønnbåt', 'Trawler', 'Linjebåt'][Math.floor(Math.random() * 3)],
      callSign: `N${String(i).padStart(3, '0')}AB`,
      imoNumber: 9000000 + i,
      owner: `Rederiet ${Math.floor(Math.random() * 30) + 1}`,
      captain: `Kaptein ${Math.floor(Math.random() * 50) + 1}`,
      lastPosition: {
        lat: 68 + Math.random() * 4,
        lng: 16 + Math.random() * 8,
        timestamp: new Date(Date.now() - Math.random() * 6 * 3600 * 1000).toISOString(),
      },
      cargo: {
        type: fishTypes[Math.floor(Math.random() * fishTypes.length)],
        quantity: Math.floor(Math.random() * 200) + 10,
        unit: 'tonn',
      },
      riskZonesEntered: riskZones,
      complianceActions: complianceActions,
      documentationStatus: ['godkjent', 'under-gjennomgang', 'utløpt'][Math.floor(Math.random() * 3)],
      certificates: [
        { type: 'ISM', expires: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(), status: 'gyldig' },
        { type: 'ISPS', expires: new Date(Date.now() + 200 * 24 * 3600 * 1000).toISOString(), status: 'gyldig' },
        { type: 'Fiskeri', expires: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(), status: 'utløpt' },
      ],
      catches: Math.floor(Math.random() * 100),
      lastInspection: new Date(Date.now() - Math.random() * 90 * 24 * 3600 * 1000).toISOString(),
    });
  }
  
  return vessels;
};

const generateAlerts = (farmers) => {
  const alerts = [];
  const alertTypes = [
    { type: 'lus-risiko', severity: 'risikofylt', message: 'Høy lus-risiko detektert', dataSource: 'BarentsWatch' },
    { type: 'lus-risiko', severity: 'høy oppmerksomhet', message: 'Moderat lus-risiko', dataSource: 'BarentsWatch' },
    { type: 'alger', severity: 'høy oppmerksomhet', message: 'Moderate alger i området', dataSource: 'Met.no' },
    { type: 'alger', severity: 'moderat', message: 'Svake alger påvist', dataSource: 'Met.no' },
    { type: 'temperatur', severity: 'høy oppmerksomhet', message: 'Uvanlig høy temperatur', dataSource: 'Kystvarsling' },
    { type: 'temperatur', severity: 'moderat', message: 'Temperatur Over normalt', dataSource: 'Kystvarsling' },
    { type: 'båtkontakt', severity: 'høy oppmerksomhet', message: 'Båtkontakt registrert', dataSource: 'AIS' },
    { type: 'båtkontakt', severity: 'lav', message: 'Båt i nærheten', dataSource: 'AIS' },
    { type: 'mortilitet', severity: 'risikofylt', message: 'Uvanlig høy dødelighetrate', dataSource: 'Internal' },
    { type: 'inspeksjon', severity: 'høy oppmerksomhet', message: 'Inspeksjon avsluttet med merknader', dataSource: 'Mattilsynet' },
  ];
  
  farmers.forEach((farm, idx) => {
    // Generate 2-8 alerts per farm
    for (let j = 0; j < Math.floor(Math.random() * 7) + 2; j++) {
      const alertType = alertTypes[Math.floor(Math.random() * alertTypes.length)];
      const daysAgo = Math.floor(Math.random() * 30);
      
      alerts.push({
        id: `alert_${farm.id}_${j}`,
        farmId: farm.id,
        userId: farm.userId, // Link alert to farm owner
        farmName: farm.name,
        region: farm.region,
        type: alertType.type,
        severity: alertType.severity,
        message: alertType.message,
        timestamp: new Date(Date.now() - daysAgo * 24 * 3600 * 1000 - Math.random() * 24 * 3600 * 1000).toISOString(),
        isRead: Math.random() > 0.35,
        dataSource: alertType.dataSource,
        actionRequired: Math.random() > 0.7,
        actionDeadline: new Date(Date.now() + Math.floor(Math.random() * 14) * 24 * 3600 * 1000).toISOString(),
      });
    }
  });
  
  return alerts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
};

const generateAdminStats = (farmers, vessels, alerts) => {
  const riskyFarms = farmers.filter(f => f.riskScore > 60).length;
  const moderate = farmers.filter(f => f.riskScore > 40 && f.riskScore <= 60).length;
  
  const risikofyltAlerts = alerts.filter(a => a.severity === 'risikofylt').length;
  const highAlerts = alerts.filter(a => a.severity === 'høy oppmerksomhet').length;
  
  const regionBreakdown = {};
  farmers.forEach(f => {
    if (!regionBreakdown[f.region]) {
      regionBreakdown[f.region] = {
        name: f.region,
        totalFacilities: 0,
        risikofyltRisk: 0,
        høyOppmerksomhetRisk: 0,
        averageRisk: 0,
        recentAlerts: 0,
      };
    }
    regionBreakdown[f.region].totalFacilities++;
    if (f.riskScore > 60) regionBreakdown[f.region].risikofyltRisk++;
    if (f.riskScore > 40) regionBreakdown[f.region].høyOppmerksomhetRisk++;
  });

  Object.keys(regionBreakdown).forEach(region => {
    const regionFarms = farmers.filter(f => f.region === region);
    regionBreakdown[region].averageRisk = (
      regionFarms.reduce((sum, f) => sum + f.riskScore, 0) / regionFarms.length
    ).toFixed(1);
    regionBreakdown[region].recentAlerts = alerts.filter(
      a => a.region === region && (Date.now() - new Date(a.timestamp)) / (24 * 3600 * 1000) <= 7
    ).length;
  });
  
  return {
    summary: {
      totalFacilities: farmers.length,
      totalVessels: vessels.length,
      totalAlerts: alerts.length,
      risikofyltAlerts: risikofyltAlerts,
      høyOppmerksomhetAlerts: highAlerts,
      risikofyltRiskFacilities: riskyFarms,
      moderateRiskFacilities: moderate,
      averageRiskScore: (farmers.reduce((sum, f) => sum + f.riskScore, 0) / farmers.length).toFixed(1),
      lastUpdated: new Date().toISOString(),
    },
    regionBreakdown: Object.values(regionBreakdown),
    alertsBy7Days: alerts.filter(a => {
      const days = (Date.now() - new Date(a.timestamp)) / (24 * 3600 * 1000);
      return days <= 7;
    }).length,
    complianceStatus: {
      documented: farmers.filter(f => f.complianceLogs.length > 0).length,
      undocumented: farmers.filter(f => f.complianceLogs.length === 0).length,
    },
    topAlerts: alerts.slice(0, 20).map(a => ({
      ...a,
      daysSince: Math.floor((Date.now() - new Date(a.timestamp)) / (24 * 3600 * 1000)),
    })),
  };
};

const generatePublicData = (farmers, alerts) => {
  const regions = ['Tromsø', 'Finnmark', 'Nord-Trøndelag', 'Sogn og Fjordane', 'Hordaland'];
  
  return {
    regions: regions.map(region => {
      const regionFarms = farmers.filter(f => f.region === region);
      const regionAlerts = alerts.filter(a => a.region === region);
      const avgRisk = (
        regionFarms.reduce((sum, f) => sum + f.riskScore, 0) / (regionFarms.length || 1)
      ).toFixed(0);
      
      return {
        name: region,
        facilityCount: regionFarms.length,
        recentAlerts: regionAlerts.filter(
          a => (Date.now() - new Date(a.timestamp)) / (24 * 3600 * 1000) <= 7
        ).length,
        averageRisk: avgRisk,
        riskLevel: avgRisk > 60 ? 'Høy' : avgRisk > 40 ? 'Moderat' : 'Lav',
        lastUpdated: new Date().toISOString(),
      };
    }),
    topAlerts: alerts.slice(0, 20).map(a => ({
      region: a.region,
      type: a.type,
      severity: a.severity,
      timestamp: a.timestamp,
      daysSince: Math.floor((Date.now() - new Date(a.timestamp)) / (24 * 3600 * 1000)),
    })),
    disclaimer: 'Disse varslene er anonymisert og er offentlig tilgjengelig informasjon. Detaljerte anleggsspesifikke data er kun tilgjengelig for autorisert personell.',
    lastUpdated: new Date().toISOString(),
  };
};

const generateTasks = (vessels) => {
  const tasks = [];
  const taskTypes = [
    { name: 'Karantene - Lus', duration: 7, chemicals: ['Hydrogenperoksid', 'Parasorb'], type: 'karantene-lus' },
    { name: 'Karantene - Furunkulose', duration: 14, chemicals: ['Oxolinic acid', 'Florfenikol'], type: 'karantene-furunkulose' },
    { name: 'Merbromin behandling', duration: 5, chemicals: ['Merbromin'], type: 'merbromin' },
    { name: 'Sertifikat fornyelse', duration: 0, chemicals: [], type: 'sertifikat' },
    { name: 'Vedlikehold merd', duration: 2, chemicals: [], type: 'vedlikehold' },
  ];
  
  for (let i = 0; i < 40; i++) {
    const vessel = vessels[Math.floor(Math.random() * vessels.length)];
    const taskType = taskTypes[Math.floor(Math.random() * taskTypes.length)];
    const daysUntilDue = Math.floor(Math.random() * 60) + 1;
    
    let status = 'planned';
    if (daysUntilDue <= 7) status = 'urgent';
    else if (daysUntilDue <= 14) status = 'scheduled';
    
    tasks.push({
      id: `task_${i}`,
      vesselId: vessel.id,
      userId: vessel.userId,
      type: taskType.type,
      name: taskType.name,
      status: status,
      dueDate: new Date(Date.now() + daysUntilDue * 24 * 3600 * 1000).toISOString(),
      daysUntil: daysUntilDue,
      duration: taskType.duration,
      chemicals: taskType.chemicals,
      notes: `Task for ${vessel.name}`,
      createdDate: new Date(Date.now() - Math.random() * 30 * 24 * 3600 * 1000).toISOString(),
      completedDate: null,
    });
  }
  
  return tasks;
};

const generateNearbyFarms = (farmers) => {
  // Create index of farms by location for proximity queries
  const nearbyMap = {};
  
  farmers.forEach((farm) => {
    nearbyMap[farm.id] = {
      farm,
      nearby: [],
    };
  });
  
  // For each farm, find nearby farms (within ~30 km distance and current direction)
  farmers.forEach((farm) => {
    const nearby = farmers
      .filter((other) => {
        if (other.id === farm.id) return false;
        
        // Calculate rough distance (simplified)
        const dlat = other.coordinates.lat - farm.coordinates.lat;
        const dlng = other.coordinates.lng - farm.coordinates.lng;
        const distance = Math.sqrt(dlat * dlat + dlng * dlng) * 111; // km
        
        return distance <= 30; // Within 30km
      })
      .map((other) => {
        // Classify risk based on current direction and position
        const dlat = other.coordinates.lat - farm.coordinates.lat;
        const dlng = other.coordinates.lng - farm.coordinates.lng;
        const distanceKm = Math.sqrt(dlat * dlat + dlng * dlng) * 111;
        
        let riskCategory = 'same-area'; // same-område
        let riskColor = 'orange';
        
        if (dlng < -2) {
          // West (upstream of westerly current)
          riskCategory = 'upstream';
          riskColor = 'green';
        } else if (dlng > 2) {
          // East (downstream of westerly current)
          riskCategory = 'downstream';
          riskColor = 'red';
        }
        
        return {
          id: other.id,
          name: other.name,
          distance: distanceKm,
          riskCategory,
          riskColor,
          riskLevel: other.riskLevel,
          species: other.species,
          currentState: other.riskLevel === 'risikofylt' ? 'infected-risk' : 'monitoring',
        };
      })
      .sort((a, b) => {
        // Sort by risk: downstream (red) > same-area (orange) > upstream (green)
        const riskOrder = { downstream: 0, 'same-area': 1, upstream: 2 };
        return riskOrder[a.riskCategory] - riskOrder[b.riskCategory];
      });
    
    nearbyMap[farm.id].nearby = nearby;
  });
  
  return nearbyMap;
};

const generateAlgaeAlerts = (farmers) => {
  // Generate algae bloom alerts for farms
  const algaeAlerts = [];
  const algaeStrains = ['Dinoflagellater', 'Diatomer', 'Grønnalger', 'Rødalger', 'Havblink'];
  
  farmers.forEach((farm) => {
    // 40% of farms get algae alerts
    if (Math.random() > 0.6) {
      const strain = algaeStrains[Math.floor(Math.random() * algaeStrains.length)];
      const concentration = ['lav', 'moderat', 'høy'][Math.floor(Math.random() * 3)];
      const severity = concentration === 'høy' ? 'høy oppmerksomhet' : concentration === 'moderat' ? 'moderat' : 'lav';
      
      // Generate several bloom events across next 30 days
      for (let j = 0; j < Math.floor(Math.random() * 3) + 1; j++) {
        const startDay = Math.floor(Math.random() * 30) + 1;
        const durationDays = Math.floor(Math.random() * 7) + 2;
        
        algaeAlerts.push({
          id: `algae_${farm.id}_${j}`,
          farmId: farm.id,
          userId: farm.userId,
          farmName: farm.name,
          region: farm.region,
          strain,
          concentration,
          severity,
          startDate: new Date(Date.now() + startDay * 24 * 3600 * 1000).toISOString(),
          endDate: new Date(Date.now() + (startDay + durationDays) * 24 * 3600 * 1000).toISOString(),
          durationDays,
          estimatedRiskLevel: concentration === 'høy' ? 'høy oppmerksomhet' : 'moderat',
          dataSource: 'Met.no / Havforskningsinstituttet',
          notes: `${strain} bloom - ${concentration} concentration in area`,
        });
      }
    }
  });
  
  return algaeAlerts;
};

const generateInfectionChain = (farmers, nearbyFarmsMap) => {
  // Build a graph showing which farms can infect which other farms via sea current
  const infectionGraph = {};
  
  farmers.forEach((farm) => {
    // If this farm is at risk (risikofylt), find all downstream farms it could infect
    const riskLevel = farm.riskLevel === 'risikofylt' ? 'critical' : farm.riskLevel === 'høy oppmerksomhet' ? 'high' : 'moderate';
    
    const nearby = nearbyFarmsMap[farm.id]?.nearby || [];
    const downstreamFarms = nearby.filter(n => n.riskCategory === 'downstream');
    
    infectionGraph[farm.id] = {
      farmId: farm.id,
      farmName: farm.name,
      region: farm.region,
      coordinates: farm.coordinates,
      riskLevel: farm.riskLevel,
      riskScore: farm.riskScore,
      currentDirection: farm.currentDirection,
      canInfect: downstreamFarms.map(f => f.id), // List of farm IDs this farm could infect
      downstreamFarms: downstreamFarms, // Detailed info about downstream neighbors
      infectionRiskLevel: riskLevel,
    };
  });
  
  return infectionGraph;
};

module.exports = {
  farmers: generateFarmers(),
  alerts: null, // Will be populated after farmers are generated
  vessels: generateVessels(),
  tasks: null, // Will be populated after vessels are generated
  disinfections: [], // Will be populated/added to after vessels are generated
  quarantines: [], // Auto-triggered quarantines based on non-reporting vessels
  nearbyFarmsMap: null, // Will be populated after farmers are generated
  algaeAlerts: null, // Will be populated after farmers are generated
  infectionGraph: null, // Will be populated after farmers and nearbyFarmsMap are generated
  init() {
    this.alerts = generateAlerts(this.farmers);
    this.tasks = generateTasks(this.vessels);
    this.disinfections = []; // Initialize empty disinfections array
    this.quarantines = []; // Initialize empty quarantines array
    this.nearbyFarmsMap = generateNearbyFarms(this.farmers);
    this.infectionGraph = generateInfectionChain(this.farmers, this.nearbyFarmsMap);
    this.algaeAlerts = generateAlgaeAlerts(this.farmers);
    this.adminStats = generateAdminStats(this.farmers, this.vessels, this.alerts);
    this.publicData = generatePublicData(this.farmers, this.alerts);
    return this;
  },
  MOCK_USERS,
};
