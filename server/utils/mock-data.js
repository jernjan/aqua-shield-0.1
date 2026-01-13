/**
 * Mock Data Generator - For testing snapshots without real API credentials
 */

function generateMockFacilities(count = 2687) {
  const facilities = [];
  const regions = ['Troms og Finnmark', 'Nordland', 'Trøndelag', 'Hordaland', 'Sogn og Fjordane', 'Rogaland'];
  const baseCoords = [
    { lat: 70.5, lng: 25.5 },  // North (Barents)
    { lat: 68.0, lng: 18.0 },  // Troms
    { lat: 65.5, lng: 12.5 },  // Nordland
    { lat: 63.5, lng: 10.0 },  // Trøndelag
    { lat: 60.5, lng: 6.0 },   // Hordaland
    { lat: 59.0, lng: 5.5 }    // Rogaland
  ];

  for (let i = 0; i < count; i++) {
    const regionIdx = i % regions.length;
    const baseCoord = baseCoords[regionIdx];
    const baseRegion = regions[regionIdx];

    // Distribute facilities geographically
    const jitterLat = (Math.random() - 0.5) * 2;
    const jitterLng = (Math.random() - 0.5) * 2;

    // Vary lice count: 70% have low, 20% medium, 10% high
    let liceCount = 0;
    const rand = Math.random();
    if (rand < 0.7) liceCount = Math.random() * 5;
    else if (rand < 0.9) liceCount = 5 + Math.random() * 10;
    else liceCount = 15 + Math.random() * 20;

    // Disease status: 90% healthy, 5% suspect, 5% infected
    let diseaseStatus = 'healthy';
    const diseaseRand = Math.random();
    if (diseaseRand < 0.05) diseaseStatus = 'infected';
    else if (diseaseRand < 0.10) diseaseStatus = 'suspect';

    facilities.push({
      id: `NOR-${String(i + 1).padStart(5, '0')}`,
      name: `Anlegg ${baseRegion} ${i + 1}`,
      lat: baseCoord.lat + jitterLat,
      lng: baseCoord.lng + jitterLng,
      municipality: baseRegion,
      species: 'Salmon',
      liceCount: Math.round(liceCount * 10) / 10,
      diseaseStatus: diseaseStatus,
      lastUpdate: new Date().toISOString()
    });
  }

  return facilities;
}

function generateMockVessels(count = 4066) {
  const vessels = [];
  const types = ['Service vessel', 'Feed barge', 'Workboat', 'Transport vessel', 'Inspection vessel'];
  const baseCoords = [
    { lat: 70.5, lng: 25.5 },
    { lat: 68.0, lng: 18.0 },
    { lat: 65.5, lng: 12.5 },
    { lat: 63.5, lng: 10.0 },
    { lat: 60.5, lng: 6.0 },
    { lat: 59.0, lng: 5.5 }
  ];

  for (let i = 0; i < count; i++) {
    const typeIdx = i % types.length;
    const baseCoord = baseCoords[i % baseCoords.length];

    const jitterLat = (Math.random() - 0.5) * 2;
    const jitterLng = (Math.random() - 0.5) * 2;

    vessels.push({
      id: `VESSEL-${String(i + 1).padStart(5, '0')}`,
      name: `Vessel ${i + 1}`,
      type: types[typeIdx],
      lat: baseCoord.lat + jitterLat,
      lng: baseCoord.lng + jitterLng,
      heading: Math.floor(Math.random() * 360),
      speed: Math.random() * 15,
      mmsi: 200000000 + i,
      callSign: `VS${String(i + 1).padStart(5, '0')}`
    });
  }

  return vessels;
}

module.exports = {
  generateMockFacilities,
  generateMockVessels
};
