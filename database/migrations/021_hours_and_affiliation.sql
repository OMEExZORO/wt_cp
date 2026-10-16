UPDATE site_settings
SET value = E'Monday to Saturday: 8:00 AM to 10:00 PM\nSunday: Closed\nLab service: open 24 hours', is_placeholder = FALSE, updated_at = now()
WHERE key = 'contact.opening_hours';

UPDATE branches
SET opening_hours = E'Monday to Saturday: 8:00 AM to 10:00 PM\nSunday: Closed\nLab service: open 24 hours'
WHERE slug IN ('bhosari', 'moshi', 'pimple-gurav', 'moi');

DELETE FROM site_settings WHERE key = 'doctor.affiliation';

DELETE FROM slots s
WHERE s.slot_date > (now() AT TIME ZONE 'Asia/Kolkata')::date
  AND extract(isodow FROM s.slot_date) = 7
  AND s.booked_count = 0
  AND NOT EXISTS (SELECT 1 FROM appointments a WHERE a.slot_id = s.id);
