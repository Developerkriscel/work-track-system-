import { useEffect, useMemo, useState } from 'react';

function formatNumber(value) {
  if (value === null || value === undefined || value === '') return '';
  const parsed = Number(value);
  return Number.isFinite(parsed) ? String(parsed) : String(value).trim();
}

export function AttendanceLocationPolicyCard({ policy, canEdit, loading, saving, onSave }) {
  const [form, setForm] = useState({
    officeName: '',
    latitude: '',
    longitude: '',
    radiusMeters: 200,
    enabled: true
  });

  useEffect(() => {
    setForm({
      officeName: policy?.officeName || '',
      latitude: formatNumber(policy?.latitude || ''),
      longitude: formatNumber(policy?.longitude || ''),
      radiusMeters: formatNumber(policy?.radiusMeters || 200) || 200,
      enabled: policy?.enabled !== false
    });
  }, [policy]);

  const policyStatus = useMemo(() => {
    if (!form.enabled) return 'Disabled';
    if (form.latitude && form.longitude) return `Active · ${form.radiusMeters || 200}m radius`;
    return 'Saved · location not set yet';
  }, [form.enabled, form.latitude, form.longitude, form.radiusMeters]);

  const useCurrentLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((position) => {
      setForm((current) => ({
        ...current,
        latitude: String(position.coords.latitude),
        longitude: String(position.coords.longitude)
      }));
    });
  };

  if (!canEdit) return null;

  return (
    <div className="attendance-policy-card">
      <div className="attendance-policy-card__header">
        <h3>Office Location Setup</h3>
        <span className="status-pill status-pill--info">{loading ? 'Loading...' : policyStatus}</span>
      </div>

      <div className="attendance-policy-card__grid">
        <label className="dashboard-control">
          <span>Office Name</span>
          <input
            value={form.officeName}
            onChange={(event) => setForm((current) => ({ ...current, officeName: event.target.value }))}
            placeholder="Kriscel Tech Office"
          />
        </label>
        <label className="dashboard-control">
          <span>Radius (Meters)</span>
          <input
            type="number"
            min="25"
            step="1"
            value={form.radiusMeters}
            onChange={(event) => setForm((current) => ({ ...current, radiusMeters: event.target.value }))}
            placeholder="200"
          />
        </label>
        <label className="dashboard-control">
          <span>Latitude</span>
          <input
            value={form.latitude}
            onChange={(event) => setForm((current) => ({ ...current, latitude: event.target.value }))}
            placeholder="26.2183"
          />
        </label>
        <label className="dashboard-control">
          <span>Longitude</span>
          <input
            value={form.longitude}
            onChange={(event) => setForm((current) => ({ ...current, longitude: event.target.value }))}
            placeholder="78.1828"
          />
        </label>
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
          <button type="button" className="attendance-cta attendance-cta--gray" onClick={useCurrentLocation}>
            Use Current Location
          </button>
          <button
            type="button"
            className="attendance-cta attendance-cta--blue"
            disabled={saving}
            onClick={() =>
              onSave({
                officeName: form.officeName,
                latitude: form.latitude,
                longitude: form.longitude,
                radiusMeters: form.radiusMeters,
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
