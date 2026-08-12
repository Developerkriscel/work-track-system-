import { useEffect, useMemo, useState } from 'react';

function formatNumber(value) {
  if (value === null || value === undefined || value === '') return '';
  const parsed = Number(value);
  return Number.isFinite(parsed) ? String(parsed) : String(value).trim();
}

export function AttendanceLocationPolicyCard({ policy, canEdit, loading, saving, onSave }) {
  const [form, setForm] = useState({
    locations: [{ officeName: '', latitude: '', longitude: '', radiusMeters: 200 }],
    enabled: true
  });
  const [geoMessage, setGeoMessage] = useState('');
  const [geoLoadingIndex, setGeoLoadingIndex] = useState(null);

  useEffect(() => {
    let locs = policy?.locations || [];
    if (!locs.length) {
      locs = [{
        officeName: policy?.officeName || '',
        latitude: formatNumber(policy?.latitude || ''),
        longitude: formatNumber(policy?.longitude || ''),
        radiusMeters: formatNumber(policy?.radiusMeters || 200) || 200,
      }];
    } else {
      locs = locs.map(loc => ({
        officeName: loc.officeName || '',
        latitude: formatNumber(loc.latitude || ''),
        longitude: formatNumber(loc.longitude || ''),
        radiusMeters: formatNumber(loc.radiusMeters || 200) || 200,
      }));
    }

    setForm({
      locations: locs,
      enabled: policy?.enabled !== false
    });
  }, [policy]);

  const policyStatus = useMemo(() => {
    if (!form.enabled) return 'Disabled';
    const activeCount = form.locations.filter(l => l.latitude && l.longitude).length;
    if (activeCount > 0) return `Active · ${activeCount} location(s)`;
    return 'Saved · location not set yet';
  }, [form.enabled, form.locations]);

  const useCurrentLocation = (index) => {
    setGeoMessage('');
    if (!navigator.geolocation) {
      setGeoMessage('Current location is not supported by this browser.');
      return;
    }

    setGeoLoadingIndex(index);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm((current) => {
          const updatedLocs = [...current.locations];
          updatedLocs[index] = {
            ...updatedLocs[index],
            latitude: String(position.coords.latitude),
            longitude: String(position.coords.longitude)
          };
          return { ...current, locations: updatedLocs };
        });
        setGeoLoadingIndex(null);
      },
      (error) => {
        const message = error?.code === 1
          ? 'Location access is blocked. Allow permission and try again.'
          : error?.code === 2
            ? 'Location is unavailable right now. Try again after moving to a better signal area.'
            : error?.code === 3
              ? 'Location request timed out. Please try again.'
              : 'Unable to capture your current location.';
        setGeoLoadingIndex(null);
        setGeoMessage(message);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  const addLocation = () => {
    setForm(current => ({
      ...current,
      locations: [...current.locations, { officeName: '', latitude: '', longitude: '', radiusMeters: 200 }]
    }));
  };

  const removeLocation = (index) => {
    setForm(current => {
      const updatedLocs = current.locations.filter((_, i) => i !== index);
      if (updatedLocs.length === 0) {
        updatedLocs.push({ officeName: '', latitude: '', longitude: '', radiusMeters: 200 });
      }
      return { ...current, locations: updatedLocs };
    });
  };

  const updateLocation = (index, field, value) => {
    setForm(current => {
      const updatedLocs = [...current.locations];
      updatedLocs[index] = { ...updatedLocs[index], [field]: value };
      return { ...current, locations: updatedLocs };
    });
  };

  if (!canEdit) return null;

  return (
    <div className="attendance-policy-card">
      <div className="attendance-policy-card__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h3>Office Location Setup</h3>
          <span className="status-pill status-pill--info">{loading ? 'Loading...' : policyStatus}</span>
        </div>
        <button type="button" onClick={addLocation} className="attendance-cta attendance-cta--gray" style={{ borderRadius: '6px', padding: '6px 12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          Add Office Location
        </button>
      </div>

      <div className="attendance-policy-locations">
        {form.locations.map((loc, index) => (
          <div key={index} style={{ marginBottom: '24px', padding: '20px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h4 style={{ margin: 0, fontSize: '14px', color: '#475569', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                Location {index + 1}
              </h4>
              <button 
                type="button" 
                onClick={() => removeLocation(index)}
                style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '13px', cursor: 'pointer', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', borderRadius: '4px', transition: 'background 0.2s' }}
                onMouseOver={(e) => e.currentTarget.style.background = '#fee2e2'}
                onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                Delete
              </button>
            </div>
            
            <div className="attendance-policy-card__grid">
              <label className="dashboard-control">
                <span>Office Name</span>
                <input
                  value={loc.officeName}
                  onChange={(event) => updateLocation(index, 'officeName', event.target.value)}
                  placeholder="Kriscel Tech Office"
                  style={{ background: '#ffffff' }}
                />
              </label>
              <label className="dashboard-control">
                <span>Radius (Meters)</span>
                <input
                  type="number"
                  min="25"
                  step="1"
                  value={loc.radiusMeters}
                  onChange={(event) => updateLocation(index, 'radiusMeters', event.target.value)}
                  placeholder="200"
                  style={{ background: '#ffffff' }}
                />
              </label>
              <label className="dashboard-control">
                <span>Latitude</span>
                <input
                  value={loc.latitude}
                  onChange={(event) => updateLocation(index, 'latitude', event.target.value)}
                  placeholder="26.2183"
                  style={{ background: '#ffffff' }}
                />
              </label>
              <label className="dashboard-control">
                <span>Longitude</span>
                <input
                  value={loc.longitude}
                  onChange={(event) => updateLocation(index, 'longitude', event.target.value)}
                  placeholder="78.1828"
                  style={{ background: '#ffffff' }}
                />
              </label>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button
                type="button"
                className="attendance-cta attendance-cta--gray"
                style={{ padding: '8px 14px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
                onClick={() => useCurrentLocation(index)}
                disabled={geoLoadingIndex === index}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="3"></circle></svg>
                {geoLoadingIndex === index ? 'Capturing...' : 'Use Current Location'}
              </button>
            </div>
            {geoMessage ? (
              <p style={{ margin: '12px 0 0', fontSize: '13px', color: '#b91c1c' }} aria-live="polite">
                {geoMessage}
              </p>
            ) : null}
          </div>
        ))}
      </div>

      <div className="attendance-policy-card__actions">
        <label className="attendance-policy-card__toggle">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))}
          />
          <span>Enforce office location</span>
        </label>

        <div className="attendance-policy-card__action-buttons">
          <button
            type="button"
            className="attendance-cta attendance-cta--blue"
            disabled={saving}
            onClick={() =>
              onSave({
                locations: form.locations,
                enabled: form.enabled
              })
            }
          >
            {saving ? 'Saving...' : 'Save Policy'}
          </button>
        </div>
      </div>
    </div>
  );
}
