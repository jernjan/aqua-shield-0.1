import { useState, useEffect } from 'react'
import axios from 'axios'

function SelectSites({ token, user, onSitesSelected, onToast }) {
  const [facilities, setFacilities] = useState([])
  const [vessels, setVessels] = useState([])
  const [selectedFacilities, setSelectedFacilities] = useState([])
  const [selectedVessels, setSelectedVessels] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchFacility, setSearchFacility] = useState('')
  const [searchVessel, setSearchVessel] = useState('')

  useEffect(() => {
    loadAllSites()
  }, [token])

  const loadAllSites = async () => {
    try {
      // In production, fetch from /api/sites or similar
      // For MVP, mock data or direct BarentsWatch call
      console.log('Loading facilities and vessels...')
      setLoading(false)
      onToast('Søk etter dine anlegg og båter', 'info')
    } catch (err) {
      onToast('Feil ved lasting av anlegg', 'error')
      setLoading(false)
    }
  }

  const handleFacilityToggle = (id) => {
    setSelectedFacilities(prev =>
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    )
  }

  const handleVesselToggle = (id) => {
    setSelectedVessels(prev =>
      prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]
    )
  }

  const handleSave = async () => {
    try {
      await axios.post('/api/user/select-sites', 
        { facilities: selectedFacilities, vessels: selectedVessels },
        { headers: { 'Authorization': `Bearer ${token}` } }
      )
      onToast('Anlegg lagret!')
      onSitesSelected()
    } catch (err) {
      onToast('Feil ved lagring', 'error')
    }
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '40px' }}>Laster...</div>
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px' }}>
      <h1>🐟 Velg dine anlegg og båter</h1>
      <p style={{ marginBottom: '20px', color: '#666' }}>
        AquaShield skal overvåke disse facilitetene og båtene
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
        <div>
          <h2>Lakseanlegg (fra BarentsWatch)</h2>
          <input
            type="text"
            placeholder="Søk anlegg..."
            value={searchFacility}
            onChange={(e) => setSearchFacility(e.target.value)}
            style={{ width: '100%', marginBottom: '12px' }}
          />
          <p style={{ color: '#666', fontSize: '12px', marginBottom: '12px' }}>
            💡 Tips: Søk etter navn eller anleggnummer
          </p>
          <div style={{ border: '1px solid #ddd', borderRadius: '4px', maxHeight: '400px', overflow: 'auto' }}>
            {/* Mock facilities for MVP */}
            {['Anlegg A (PO 1)', 'Anlegg B (PO 2)', 'Anlegg C (PO 3)'].map(f => (
              <label key={f} style={{ display: 'block', padding: '8px', borderBottom: '1px solid #eee', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={selectedFacilities.includes(f)}
                  onChange={() => handleFacilityToggle(f)}
                  style={{ marginRight: '8px' }}
                />
                {f}
              </label>
            ))}
          </div>
        </div>

        <div>
          <h2>Båter (fra AIS)</h2>
          <input
            type="text"
            placeholder="Søk båt..."
            value={searchVessel}
            onChange={(e) => setSearchVessel(e.target.value)}
            style={{ width: '100%', marginBottom: '12px' }}
          />
          <p style={{ color: '#666', fontSize: '12px', marginBottom: '12px' }}>
            🚢 Wellbåter og servicebåter fra norske farvann
          </p>
          <div style={{ border: '1px solid #ddd', borderRadius: '4px', maxHeight: '400px', overflow: 'auto' }}>
            {/* Mock vessels for MVP */}
            {['Wellboat 1', 'Wellboat 2', 'Service Vessel 1'].map(v => (
              <label key={v} style={{ display: 'block', padding: '8px', borderBottom: '1px solid #eee', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={selectedVessels.includes(v)}
                  onChange={() => handleVesselToggle(v)}
                  style={{ marginRight: '8px' }}
                />
                {v}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div style={{ marginTop: '30px', textAlign: 'center' }}>
        <button onClick={handleSave} className="primary" style={{ padding: '12px 30px', fontSize: '16px' }}>
          Fortsett ({selectedFacilities.length + selectedVessels.length} valgt)
        </button>
      </div>
    </div>
  )
}

export default SelectSites
