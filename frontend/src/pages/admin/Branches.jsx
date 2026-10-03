import CrudPage, { activeColumn } from './CrudPage.jsx';

const fields = [
  { name: 'name', label: 'Branch name', required: true, maxLength: 120 },
  { name: 'address_line', label: 'Address', type: 'textarea', required: true, maxLength: 255 },
  { name: 'city', label: 'City', required: true, maxLength: 80 },
  { name: 'pincode', label: 'Pincode', required: true, maxLength: 6 },
  { name: 'phone', label: 'Phone', type: 'tel', required: true, maxLength: 15 },
  { name: 'email', label: 'Email', type: 'email', maxLength: 190 },
  { name: 'timings', label: 'Timings', required: true, maxLength: 255, hint: 'Separate lines with |, e.g. "Mon-Sat: 9 AM - 1 PM | Sunday: Closed"' },
  { name: 'map_query', label: 'Map search text', required: true, maxLength: 255, hint: 'Address or place name used for the embedded Google Map' },
  { name: 'image_file', label: 'Photo file name', maxLength: 120, hint: 'File inside frontend/public/images, e.g. branch-bhosari-gaon-exterior.jpg' },
  { name: 'is_active', label: 'Visibility', type: 'checkbox', checkboxLabel: 'Active (shown on website and for booking)' },
];

const initial = { name: '', address_line: '', city: 'Pune', pincode: '', phone: '', email: '', timings: '', map_query: '', image_file: '', is_active: true };

export default function Branches() {
  return (
    <CrudPage
      title="Branches"
      description="Clinic locations shown on the website and used for booking."
      endpoint="/admin/branches"
      fields={fields}
      initial={initial}
      columns={[
        { key: 'name', label: 'Name' },
        { key: 'address_line', label: 'Address', render: (r) => `${r.address_line}, ${r.city} ${r.pincode}` },
        { key: 'phone', label: 'Phone' },
        { key: 'timings', label: 'Timings' },
        activeColumn,
      ]}
      toForm={(r) => ({ ...r, email: r.email || '', image_file: r.image_file || '', is_active: Boolean(r.is_active) })}
      toPayload={(v) => ({ ...v, email: v.email || null, image_file: v.image_file || null })}
    />
  );
}
