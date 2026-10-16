UPDATE site_settings
SET value = 'Dr. Meghnad Padsalgikar is a radiologist (MBBS, DMRE, DNB Radiology) who leads Meghnad Diagnostic Centre, with branches at Bhosari, Moshi, Pimple Gurav and Moi in Pune. The centre offers ultrasound for obstetrics, gynecology, general and specialized needs and prostate imaging, CT scans, and ultrasound-guided and CT-guided biopsies. Images are reported by a radiologist, and the report supports your own doctor''s decisions. The centre''s lab also provides a 24-hour service.', is_placeholder = FALSE, updated_at = now()
WHERE key = 'doctor.bio' AND (value IS NULL OR btrim(value) = '');

UPDATE reviews
SET status = 'pending', updated_at = now()
WHERE status = 'approved';
