import { useState } from 'react';
import { api } from '../../api/client.js';
import { Alert, EmptyState, Spinner, useAsync } from '../../components/ui.jsx';
import StubNotice from './StubNotice.jsx';

export default function SafetyChecklists() {
  const [scanTypeId, setScanTypeId] = useState('');
  const { data: scanTypes } = useAsync(() => api.get('/scan-types'), []);
  const { data, loading, error } = useAsync(() => api.get('/clinical/checklists', { scan_type_id: scanTypeId }), [scanTypeId]);

  return (
    <div>
      <h1>Pre-scan safety checklists</h1>
      <StubNotice>
        Checklist questions per scan type are stored and listed here. Recording patient answers against an appointment and
        blocking unsafe scans will be added in a later phase.
      </StubNotice>
      <div className="filters">
        <select value={scanTypeId} onChange={(e) => setScanTypeId(e.target.value)} aria-label="Scan type">
          <option value="">All scan types</option>
          {(scanTypes || []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <Alert type="error">{error}</Alert>
      {loading && <Spinner />}
      {!loading && data?.length === 0 && <EmptyState title="No checklist items" />}
      {!loading && data?.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Scan type</th>
                <th>Question</th>
                <th>Required</th>
                <th>Blocks scan if “Yes”</th>
                <th>Answer</th>
              </tr>
            </thead>
            <tbody>
              {data.map((i) => (
                <tr key={i.id}>
                  <td>{i.scan_type_name}</td>
                  <td>{i.question}</td>
                  <td>{i.is_required ? 'Yes' : 'No'}</td>
                  <td>{i.blocks_scan_if_yes ? 'Yes' : 'No'}</td>
                  <td>
                    <select disabled aria-label="Answer (coming soon)">
                      <option>Yes / No / N.A.</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
