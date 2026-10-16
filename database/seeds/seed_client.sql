UPDATE site_settings SET value = '9890094569', is_placeholder = FALSE, updated_at = now() WHERE key = 'contact.phone';
UPDATE site_settings SET value = E'Monday to Saturday: 8:00 AM to 10:00 PM
Sunday: Closed
Lab service: open 24 hours', is_placeholder = FALSE, updated_at = now() WHERE key = 'contact.opening_hours';
UPDATE site_settings SET value = 'https://share.google/ZMrpDquWZCV9jaEiv', is_placeholder = FALSE, updated_at = now() WHERE key IN ('links.google_reviews_url', 'links.google_maps_url');

UPDATE site_settings
SET value = 'Dr. Meghnad Padsalgikar is a radiologist (MBBS, DMRE, DNB Radiology) who leads Meghnad Diagnostic Centre, with branches at Bhosari, Moshi, Pimple Gurav and Moi in Pune. The centre offers ultrasound for obstetrics, gynecology, general and specialized needs and prostate imaging, CT scans, and ultrasound-guided and CT-guided biopsies. Images are reported by a radiologist, and the report supports your own doctor''s decisions. The centre''s lab also provides a 24-hour service.', is_placeholder = FALSE, updated_at = now()
WHERE key = 'doctor.bio' AND (value IS NULL OR btrim(value) = '');

UPDATE reviews SET status = 'pending', updated_at = now() WHERE status = 'approved';
