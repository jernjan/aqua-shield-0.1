/**
 * MVP Mock Data - Syntetisk data for demo av alle 4 kundegrupper
 * Gruppe 1: Farmers (anlegg)
 * Gruppe 2: Vessels (brønnbåter)
 * Gruppe 3: Admin/Regulators (statistikk)
 * Gruppe 4: Public (anonymous regional data)
 */

const generateFarmers = () => {
  const regions = ['Tromsø', 'Finnmark', 'Nord-Trøndelag', 'Sogn og Fjordane', 'Hordaland'];
  const farmers = [];
  
  for (let i = 1; i <= 100; i++) {
    const region = regions[Math.floor(Math.random() * regions.length)];
    const baseRisk = Math.floor(Math.random() * 80);
    
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
      riskLevel: baseRisk > 60 ? 'kritisk' : baseRisk > 40 ? 'høy' : 'moderat',
      riskScore: baseRisk,
      lastInspection: new Date(Date.now() - Math.random() * 30 * 24 * 3600 * 1000).toISOString(),
      complianceLogs: [
        {
          date: new Date().toISOString(),
          action: 'Fiskehelseforbrytelse rapportert',
          status: 'dokumentert',
          riskPoints: baseRisk > 60 ? 15 : 8,
        },
      ],
    });
  }
  
  return farmers;
};

const generateVessels = () => {
  const vessels = [];
  const fishTypes = ['Laks', 'Torsk', 'Sei', 'Hyse'];
  
  for (let i = 1; i <= 20; i++) {
    vessels.push({
      id: `vessel_${i}`,
      name: `M/S Båt ${i}`,
      mmsi: 250000000 + i,
      type: ['Brønnbåt', 'Trawler', 'Linjebåt'][Math.floor(Math.random() * 3)],
      lastPosition: {
        lat: 68 + Math.random() * 4,
        lng: 16 + Math.random() * 8,
        timestamp: new Date(Date.now() - Math.random() * 6 * 3600 * 1000).toISOString(),
      },
      cargo: fishTypes[Math.floor(Math.random() * fishTypes.length)],
      riskZonesEntered: [
        {
          zone: 'Tromsø fiskeripolitizone',
          distance: Math.floor(Math.random() * 50),
          timestamp: new Date(Date.now() - Math.random() * 24 * 3600 * 1000).toISOString(),
        },
      ],
      complianceActions: [
        {
          date: new Date().toISOString(),
          action: 'Fangst loggført',
          location: 'Vest-Finnmark',
          verified: false,
        },
      ],
      documentationStatus: ['godkjent', 'under-gjennomgang'][Math.floor(Math.random() * 2)],
    });
  }
  
  return vessels;
};

const generateAlerts = (farmers) => {
  const alerts = [];
  const alertTypes = [
    { type: 'lus-risiko', threshold: 60, message: 'Høy lus-risiko detektert' },
    { type: 'alger', threshold: 50, message: 'Moderate alger i området' },
    { type: 'temperatur', threshold: 55, message: 'Uvanlig høy temperatur' },
    { type: 'båtkontakt', threshold: 40, message: 'Båtkontakt registrert' },
  ];
  
  farmers.slice(0, 30).forEach((farm, idx) => {
    const alertType = alertTypes[idx % alertTypes.length];
    if (farm.riskScore > alertType.threshold) {
      alerts.push({
        id: `alert_${farm.id}_${idx}`,
        farmId: farm.id,
        farmName: farm.name,
        region: farm.region,
        type: alertType.type,
        severity: farm.riskScore > 70 ? 'kritisk' : farm.riskScore > 50 ? 'høy' : 'moderat',
        message: alertType.message,
        timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 3600 * 1000).toISOString(),
        isRead: Math.random() > 0.4,
        dataSource: ['Met.no', 'BarentsWatch', 'Kystvarsling'][Math.floor(Math.random() * 3)],
      });
    }
  });
  
  return alerts;
};

const generateAdminStats = (farmers, vessels, alerts) => {
  const riskyFarms = farmers.filter(f => f.riskScore > 60).length;
  const moderate = farmers.filter(f => f.riskScore > 40 && f.riskScore <= 60).length;
  
  return {
    summary: {
      totalFacilities: farmers.length,
      totalVessels: vessels.length,
      totalAlerts: alerts.length,
      criticalRiskFacilities: riskyFarms,
      moderateRiskFacilities: moderate,
      averageRiskScore: (farmers.reduce((sum, f) => sum + f.riskScore, 0) / farmers.length).toFixed(1),
    },
    byRegion: farmers.reduce((acc, farm) => {
      acc[farm.region] = (acc[farm.region] || 0) + 1;
      return acc;
    }, {}),
    alertsBy7Days: alerts.filter(a => {
      const days = (Date.now() - new Date(a.timestamp)) / (24 * 3600 * 1000);
      return days <= 7;
    }).length,
    complianceStatus: {
      documented: farmers.filter(f => f.complianceLogs.length > 0).length,
      undocumented: farmers.filter(f => f.complianceLogs.length === 0).length,
    },
  };
};

const generatePublicData = (farmers, alerts) => {
  return {
    regions: [
      {
        name: 'Tromsø',
        facilityCount: farmers.filter(f => f.region === 'Tromsø').length,
        recentAlerts: alerts.filter(a => a.region === 'Tromsø').length,
        averageRisk: 'Moderat',
      },
      {
        name: 'Finnmark',
        facilityCount: farmers.filter(f => f.region === 'Finnmark').length,
        recentAlerts: alerts.filter(a => a.region === 'Finnmark').length,
        averageRisk: 'Høy',
      },
      {
        name: 'Nord-Trøndelag',
        facilityCount: farmers.filter(f => f.region === 'Nord-Trøndelag').length,
        recentAlerts: alerts.filter(a => a.region === 'Nord-Trøndelag').length,
        averageRisk: 'Moderat',
      },
    ],
    topAlerts: alerts.slice(0, 10).map(a => ({
      region: a.region,
      type: a.type,
      severity: a.severity,
      timestamp: a.timestamp,
    })),
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
