/**
 * MVP Mock Data - Syntetisk data for demo av alle 4 kundegrupper
 * Gruppe 1: Farmers (anlegg) - Fullstendige anleggdata med inspeksjoner, sertifikater
 * Gruppe 2: Vessels (brønnbåter) - AIS, last, compliance, risk zones
 * Gruppe 3: Admin/Regulators (statistikk) - Aggregert risiko, dokumentasjon
 * Gruppe 4: Public (anonymous regional data) - Anonyme varsler, regionale trender
 */

const generateFarmers = () => {
  const regions = ['Tromsø', 'Finnmark', 'Nord-Trøndelag', 'Sogn og Fjordane', 'Hordaland'];
  const farmers = [];
  
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

    farmers.push({
      id: `farm_${i}`,
      name: `Anlegg ${i}`,
      region,
      coordinates: {
        lat: 68 + Math.random() * 4,
        lng: 16 + Math.random() * 8,
      },
      capacity: Math.floor(50000 + Math.random() * 100000),
      species: ['Atlantisk laks', 'Ørret', 'Piggvar'][Math.floor(Math.random() * 3)],
      type: ['Merd', 'Kar', 'Innland'][Math.floor(Math.random() * 3)],
      riskLevel: baseRisk > 60 ? 'kritisk' : baseRisk > 40 ? 'høy' : 'moderat',
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
  
  for (let i = 1; i <= 20; i++) {
    const riskZones = [];
    for (let j = 0; j < Math.floor(Math.random() * 3) + 1; j++) {
      riskZones.push({
        zone: zones[Math.floor(Math.random() * zones.length)],
        riskLevel: ['høy', 'moderat', 'lav'][Math.floor(Math.random() * 3)],
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
    { type: 'lus-risiko', severity: 'critical', message: 'Høy lus-risiko detektert', dataSource: 'BarentsWatch' },
    { type: 'lus-risiko', severity: 'high', message: 'Moderat lus-risiko', dataSource: 'BarentsWatch' },
    { type: 'alger', severity: 'high', message: 'Moderate alger i området', dataSource: 'Met.no' },
    { type: 'alger', severity: 'medium', message: 'Svake alger påvist', dataSource: 'Met.no' },
    { type: 'temperatur', severity: 'high', message: 'Uvanlig høy temperatur', dataSource: 'Kystvarsling' },
    { type: 'temperatur', severity: 'medium', message: 'Temperatur Over normalt', dataSource: 'Kystvarsling' },
    { type: 'båtkontakt', severity: 'high', message: 'Båtkontakt registrert', dataSource: 'AIS' },
    { type: 'båtkontakt', severity: 'low', message: 'Båt i nærheten', dataSource: 'AIS' },
    { type: 'mortilitet', severity: 'critical', message: 'Uvanlig høy dødelighetrate', dataSource: 'Internal' },
    { type: 'inspeksjon', severity: 'high', message: 'Inspeksjon avsluttet med merknader', dataSource: 'Mattilsynet' },
  ];
  
  farmers.forEach((farm, idx) => {
    // Generate 2-8 alerts per farm
    for (let j = 0; j < Math.floor(Math.random() * 7) + 2; j++) {
      const alertType = alertTypes[Math.floor(Math.random() * alertTypes.length)];
      const daysAgo = Math.floor(Math.random() * 30);
      
      alerts.push({
        id: `alert_${farm.id}_${j}`,
        farmId: farm.id,
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
  
  const criticalAlerts = alerts.filter(a => a.severity === 'critical').length;
  const highAlerts = alerts.filter(a => a.severity === 'high').length;
  
  const regionBreakdown = {};
  farmers.forEach(f => {
    if (!regionBreakdown[f.region]) {
      regionBreakdown[f.region] = {
        name: f.region,
        totalFacilities: 0,
        criticalRisk: 0,
        highRisk: 0,
        averageRisk: 0,
        recentAlerts: 0,
      };
    }
    regionBreakdown[f.region].totalFacilities++;
    if (f.riskScore > 60) regionBreakdown[f.region].criticalRisk++;
    if (f.riskScore > 40) regionBreakdown[f.region].highRisk++;
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
      criticalAlerts: criticalAlerts,
      highAlerts: highAlerts,
      criticalRiskFacilities: riskyFarms,
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

module.exports = {
  farmers: generateFarmers(),
  alerts: null, // Will be populated after farmers are generated
  vessels: generateVessels(),
  init() {
    this.alerts = generateAlerts(this.farmers);
    this.adminStats = generateAdminStats(this.farmers, this.vessels, this.alerts);
    this.publicData = generatePublicData(this.farmers, this.alerts);
    return this;
  },
};
