// facility-logic.js - Risk calculation and recommendations

const FacilityLogic = {
  
  // Calculate comprehensive risk assessment for a facility
  assessRisk(facility) {
    if (!facility) return null;
    
    const assessment = {
      facilityName: facility.name,
      status: 'healthy',
      riskLevel: 'Lav',
      riskScore: 0,
      riskExplanation: [],
      factors: [],
      recommendations: [],
      bwRiskNearby: []
    };
    
    // 1. Check if facility itself is infected
    const diseases = facility.diseases || facility.diseaseInfo?.diseases || [];
    const isInfected = Array.isArray(diseases) && diseases.length > 0;
    
    if (isInfected) {
      assessment.status = 'infected';
      assessment.riskLevel = 'Ekstrem';
      assessment.riskScore = 100;
      assessment.riskExplanation.push('Anlegget har aktiv sykdom (100% risiko)');
      assessment.factors.push({
        factor: 'Smittet anlegg',
        status: 'Ja - ' + diseases.join(', '),
        severity: 'danger'
      });
      assessment.recommendations.push({
        type: 'critical',
        title: 'Anlegget er smittet',
        text: `Aktive sykdommer: ${diseases.join(', ')}. Følg alle karantenebestemmelser.`,
        reason: 'Anlegget har bekreftet sykdomstilfelle'
      });
      return assessment;
    }
    
    // 2. Check BarentsWatch risk data
    let riskData = FacilityData.getFacilityRiskData(facility);
    if (riskData && !(riskData.risk_level === 'Ekstrem' || riskData.risk_level === 'Høy')) {
      riskData = null;
    }
    if (riskData) {
      assessment.riskData = riskData;
      assessment.riskLevel = riskData.risk_level || 'Lav';
      assessment.riskScore = riskData.risk_score || 0;
      
      if (riskData.risk_level === 'Ekstrem') {
        assessment.status = 'high-risk';
        assessment.riskExplanation.push(`BW-modell: Ekstrem risiko`);
        assessment.factors.push({
          factor: 'BW-modellert risiko',
          status: 'Ekstrem',
          severity: 'danger'
        });
      } else if (riskData.risk_level === 'Høy') {
        assessment.status = 'high-risk';
        assessment.riskExplanation.push(`BW-modell: Høy risiko`);
        assessment.factors.push({
          factor: 'BW-modellert risiko',
          status: 'Høy',
          severity: 'warning'
        });
      } else if (riskData.risk_level === 'Moderat') {
        assessment.status = 'moderate-risk';
        assessment.riskExplanation.push(`BW-modell: Moderat risiko`);
        assessment.factors.push({
          factor: 'BW-modellert risiko',
          status: 'Moderat',
          severity: 'warning'
        });
      }
      
      // Add nearby diseased facilities count
      if (riskData.nearby_diseased_facilities_count > 0) {
        assessment.factors.push({
          factor: 'Smittede i nær område',
          status: `${riskData.nearby_diseased_facilities_count} anlegg`,
          severity: riskData.nearby_diseased_facilities_count >= 3 ? 'danger' : 'warning'
        });
      }
    }
    
    // 3. Check proximity to infected facilities (15 km to match map radius)
    const nearbyInfected = FacilityData.findInfectedWithinDistance(
      facility.latitude,
      facility.longitude,
      15
    );
    
    
    
    assessment.nearbyInfected = nearbyInfected;
    
    if (nearbyInfected.length > 0) {
      const closest = nearbyInfected[0];
      assessment.closestInfected = closest;
      
      assessment.factors.push({
        factor: 'Smittede innen 15 km',
        status: `${nearbyInfected.length} anlegg (nærmeste ${closest.distance.toFixed(1)} km)`,
        severity: closest.distance < 5 ? 'danger' : 'warning'
      });
      
      // Add explanation for nearby infected
      assessment.riskExplanation.push(`${nearbyInfected.length} smittet(e) anlegg innen 15 km (nærmeste ${closest.distance.toFixed(1)} km)`);
      
      // Recommendation based on distance
      if (closest.distance < 5) {
        assessment.recommendations.push({
          type: 'warning',
          title: 'Smittet anlegg svært nær',
          text: `${closest.facility.name} er ${closest.distance.toFixed(1)} km unna med ${closest.diseases.join(', ')}. Anbefalt ekstra prøvetaking.`,
          reason: `Avstand under 5 km øker smitterisiko betydelig`
        });
      }
    }

    // 3B. Check nearby BW-risk facilities (orange)
    const bwRiskNearby = FacilityData.getBWRiskFacilitiesWithinDistance(
      facility.latitude,
      facility.longitude,
      15
    );
    assessment.bwRiskNearby = bwRiskNearby;

    if (bwRiskNearby.length > 0) {
      assessment.factors.push({
        factor: 'BW-risiko innen 15 km',
        status: `${bwRiskNearby.length} anlegg`,
        severity: bwRiskNearby.length >= 3 ? 'warning' : 'info'
      });
    }
    
    // 4. Check recent visits from risky boats
    const recentVisits = FacilityData.getFacilityVisits(facility.name, 3); // Last 3 days
    assessment.recentVisits = recentVisits;
    
    const riskyVisits = recentVisits.filter(v => {
      // Check if boat visited infected facility recently
      return v.previous_facilities && v.previous_facilities.some(pf => 
        pf.infected === true || pf.has_disease === true
      );
    });
    
    if (riskyVisits.length > 0) {
      assessment.factors.push({
        factor: 'Loggede risikobesøk (72t)',
        status: `${riskyVisits.length} besøk`,
        severity: 'warning'
      });
      
      // Check if proper disinfection was done
      const lackingDisinfection = riskyVisits.filter(v => 
        !v.disinfection_chemical || v.disinfection_chemical === 'Ingen'
      );
      
      if (lackingDisinfection.length > 0) {
        assessment.riskExplanation.push(`${lackingDisinfection.length} båt(er) fra risiko uten desinfeksjon`);
        assessment.recommendations.push({
          type: 'warning',
          title: 'Manglende desinfeksjon',
          text: `${lackingDisinfection.length} loggede besøk fra risikoområder uten dokumentert desinfeksjon. Vurder ekstra prøvetaking.`,
          reason: 'Båter fra smittede områder øker smitterisiko betydelig'
        });
      }
    }
    
    // 5. Check disinfection compliance
    const totalVisits = FacilityData.getFacilityVisits(facility.name, 30);
    const disinfectedVisits = totalVisits.filter(v =>
      v.disinfection_chemical && v.disinfection_chemical !== 'Ingen'
    );
    const missingDisinfection = totalVisits.filter(v =>
      !v.disinfection_chemical || v.disinfection_chemical === 'Ingen'
    );

    const getVesselLabel = (visit) =>
      visit.vessel_name || (visit.mmsi ? `MMSI ${visit.mmsi}` : 'Ukjent');
    const uniqueNames = (visits) => Array.from(new Set(visits.map(getVesselLabel)));
    const formatNames = (names) => {
      if (!names.length) return 'Ingen';
      const head = names.slice(0, 5);
      const tail = names.length > 5 ? ` +${names.length - 5}` : '';
      return `${head.join(', ')}${tail}`;
    };
    
    const disinfectionRate = totalVisits.length > 0
      ? (disinfectedVisits.length / totalVisits.length * 100)
      : null;
    const disinfectionStatus = totalVisits.length > 0
      ? `${disinfectedVisits.length} av ${totalVisits.length} båter (${disinfectionRate.toFixed(0)}%)`
      : 'Ingen besøk registrert';

    const missingNames = uniqueNames(missingDisinfection);
    const disinfectedNames = uniqueNames(disinfectedVisits);
    const disinfectionDetails = totalVisits.length > 0
      ? `Uten: ${formatNames(missingNames)} · Med: ${formatNames(disinfectedNames)}`
      : 'Ingen båter logget';

    assessment.disinfectionDetails = {
      total: totalVisits.length,
      disinfected: disinfectedVisits.length,
      missing: missingDisinfection.length,
      missingNames,
      disinfectedNames
    };

    assessment.factors.push({
      factor: 'Desinfeksjon dokumentert (logget)',
      status: disinfectionStatus,
      severity: disinfectionRate === null ? 'info' : (disinfectionRate < 90 ? 'warning' : 'ok'),
      details: disinfectionDetails
    });

    if (disinfectionRate !== null && disinfectionRate < 90) {
      assessment.recommendations.push({
        type: 'info',
        title: 'Forbedre desinfeksjonsdokumentasjon',
        text: `Kun ${disinfectedVisits.length} av ${totalVisits.length} besøk har dokumentert desinfeksjon (${disinfectionRate.toFixed(0)}%). Sørg for at alle båter logger desinfeksjon.`,
        reason: 'God dokumentasjon er viktig for sporbarhet ved smitteutbrudd'
      });
    }
    
    // 6. Summarize risk explanation
    if (nearbyInfected.length > 0 && riskData) {
      // Both BW risk and confirmed infections nearby
      assessment.riskExplanation.push(`Bekreftet smitte i nærområdet bekrefter BW-modell`);
    } else if (nearbyInfected.length === 0 && riskData) {
      // BW shows risk but no confirmed infections nearby
      assessment.riskExplanation.push(`BW-modell viser risiko, ingen bekreftet smitte innen 15 km funnet`);
    } else if (nearbyInfected.length === 0 && !riskData) {
      // No risk factors at all
      assessment.riskExplanation.push('Ingen kjente risikofaktorer identifisert');
    }
    
    // 7. Add positive recommendations if all is good
    if (assessment.recommendations.length === 0 && nearbyInfected.length === 0) {
      assessment.recommendations.push({
        type: 'info',
        title: 'Lav risiko',
        text: 'Ingen smittede anlegg i nærheten og god desinfeksjonspraksis. Fortsett god biosikkerhet.',
        reason: 'Fortsett forebyggende tiltak for å opprettholde lav risiko'
      });
    }
    
    return assessment;
  },
  
  // Generate simple rule-based recommendations
  generateRecommendations(assessment) {
    if (!assessment) return [];
    
    const recommendations = [...assessment.recommendations];
    
    // Rule: Infected within 10km + current toward
    if (assessment.nearbyInfected && assessment.nearbyInfected.length > 0) {
      // This would require current data - placeholder for now
      recommendations.push({
        type: 'info',
        title: 'Overvåk vannstrømmer',
        text: 'Med smittede anlegg i området, overvåk strømretning fra smittekilder.'
      });
    }
    
    // Rule: High visit frequency without issues
    if (assessment.recentVisits && assessment.recentVisits.length > 5) {
      recommendations.push({
        type: 'info',
        title: 'Høy båttrafikk',
        text: `${assessment.recentVisits.length} besøk siste 3 dager. Sørg for streng biosikkerhetprotokoll ved høy trafikk.`
      });
    }
    
    return recommendations;
  },
  
  // Determine risk status badge
  getRiskBadge(assessment) {
    if (!assessment) return { text: '⚪ UKJENT', class: 'low-risk' };
    
    const riskLevel = assessment.riskLevel;
    
    if (assessment.status === 'infected') {
      return { text: '🔴 SMITTET', class: 'infected' };
    } else if (riskLevel === 'Ekstrem') {
      return { text: '🔴 EKSTREM RISIKO', class: 'infected' };
    } else if (riskLevel === 'Høy') {
      return { text: '🟠 HØY RISIKO', class: 'high-risk' };
    } else if (riskLevel === 'Moderat') {
      return { text: '🟡 MODERAT RISIKO', class: 'moderate-risk' };
    } else {
      return { text: '🟢 FRISK', class: 'low-risk' };
    }
  }
};

window.FacilityLogic = FacilityLogic;
