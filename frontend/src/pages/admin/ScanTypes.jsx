import CrudPage, { activeColumn } from './CrudPage.jsx';
import { categories } from '../../config/site.js';

const categoryOptions = Object.entries(categories).map(([value, c]) => ({ value, label: c.label }));

const fields = [
  { name: 'name', label: 'Name', required: true, maxLength: 120 },
  { name: 'category', label: 'Category', type: 'select', options: categoryOptions, required: true },
  { name: 'description', label: 'Description', type: 'textarea', required: true, maxLength: 1000 },
  { name: 'preparation', label: 'Patient preparation', type: 'textarea', maxLength: 1000 },
  { name: 'duration_minutes', label: 'Duration (minutes)', type: 'number', min: 5, max: 240, required: true },
  { name: 'price', label: 'Price (₹)', type: 'number', min: 0, step: '0.01', required: true },
  { name: 'is_active', label: 'Availability', type: 'checkbox', checkboxLabel: 'Active (bookable)' },
];

const initial = { name: '', category: 'xray', description: '', preparation: '', duration_minutes: 15, price: '', is_active: true };

export default function ScanTypes() {
  return (
    <CrudPage
      title="Scan Types"
      description="X-ray, Sonography and Colour Doppler studies offered."
      endpoint="/admin/scan-types"
      fields={fields}
      initial={initial}
      columns={[
        { key: 'name', label: 'Name' },
        { key: 'category', label: 'Category', render: (r) => categories[r.category]?.label },
        { key: 'duration_minutes', label: 'Duration', render: (r) => `${r.duration_minutes} min` },
        { key: 'price', label: 'Price', render: (r) => `₹${Number(r.price).toLocaleString('en-IN')}` },
        activeColumn,
      ]}
      toForm={(r) => ({ ...r, preparation: r.preparation || '', is_active: Boolean(r.is_active) })}
      toPayload={(v) => ({ ...v, preparation: v.preparation || null, duration_minutes: String(v.duration_minutes), price: String(v.price) })}
    />
  );
}
