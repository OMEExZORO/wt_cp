ALTER TABLE branches ADD COLUMN IF NOT EXISTS phone_secondary TEXT;

INSERT INTO branches (slug, name, address_line, landmark, area, city, state, postal_code, phone, phone_secondary, opening_hours, maps_url, maps_embed_url, latitude, longitude, is_placeholder, is_active, sort_order)
VALUES
    ('bhosari', 'MDC Bhosari', 'Nagdeo Towers, Ground & Second Floor, Pune-Nashik Road, Bhosari, Pune', NULL, 'Bhosari', 'Pune', 'Maharashtra', '411039', '9890094569', '8308849804',
     E'Monday to Saturday: 8:00 AM to 10:00 PM\nSunday: Closed\nLab service: open 24 hours',
     'https://www.google.com/maps/search/?api=1&query=Nagdeo%20Towers%2C%20Ground%20%26%20Second%20Floor%2C%20Pune-Nashik%20Road%2C%20Bhosari%2C%20Pune%20-%20411%20039',
     NULL, NULL, NULL, FALSE, TRUE, 1),
    ('moshi', 'MDC Moshi', 'Gat No. 284, Near Shree Hospital, Dehu-Moshi Road, Tal. Haveli, Dist. Pune', NULL, 'Moshi', 'Pune', 'Maharashtra', '411070', '8380068696', '8308849804',
     E'Monday to Saturday: 8:00 AM to 10:00 PM\nSunday: Closed\nLab service: open 24 hours',
     'https://www.google.com/maps/search/?api=1&query=Gat%20No.%20284%2C%20Near%20Shree%20Hospital%2C%20Dehu-Moshi%20Road%2C%20Tal.%20Haveli%2C%20Dist.%20Pune%20-%20411%20070',
     NULL, NULL, NULL, FALSE, TRUE, 2),
    ('pimple-gurav', 'MDC Pimple Gurav', 'Patil Plaza Shop No. 3, Opp. PCMC School, Sangvi-Pimple Gurav Road, Pimple Gurav, Pune', NULL, 'Pimple Gurav', 'Pune', 'Maharashtra', '411061', '8380068693', '9689891846',
     E'Monday to Saturday: 8:00 AM to 10:00 PM\nSunday: Closed\nLab service: open 24 hours',
     'https://www.google.com/maps/search/?api=1&query=Patil%20Plaza%20Shop%20No.%203%2C%20Opp.%20PCMC%20School%2C%20Sangvi-Pimple%20Gurav%20Road%2C%20Pimple%20Gurav%2C%20Pune%20-%20411%20061',
     NULL, NULL, NULL, FALSE, TRUE, 3),
    ('moi', 'MDC Moi', 'At. Moi, Gat No. 652, Moi - Nighoje Road, Tal. Khed, Dist. Pune', NULL, 'Moi', 'Pune', 'Maharashtra', '410501', '8669604865', '8308849804',
     E'Monday to Saturday: 8:00 AM to 10:00 PM\nSunday: Closed\nLab service: open 24 hours',
     'https://www.google.com/maps/search/?api=1&query=At.%20Moi%2C%20Gat%20No.%20652%2C%20Moi%20-%20Nighoje%20Road%2C%20Tal.%20Khed%2C%20Dist.%20Pune%20-%20410%20501',
     NULL, NULL, NULL, FALSE, TRUE, 4)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    address_line = EXCLUDED.address_line,
    landmark = EXCLUDED.landmark,
    area = EXCLUDED.area,
    city = EXCLUDED.city,
    state = EXCLUDED.state,
    postal_code = EXCLUDED.postal_code,
    phone = EXCLUDED.phone,
    phone_secondary = EXCLUDED.phone_secondary,
    opening_hours = EXCLUDED.opening_hours,
    maps_url = EXCLUDED.maps_url,
    maps_embed_url = EXCLUDED.maps_embed_url,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    is_placeholder = FALSE,
    is_active = TRUE,
    sort_order = EXCLUDED.sort_order;

UPDATE branches SET is_active = FALSE WHERE slug = 'branch-2';

UPDATE site_settings SET value = '9890094569', is_placeholder = FALSE, updated_at = now() WHERE key = 'contact.phone';
UPDATE site_settings
SET value = E'Monday to Saturday: 8:00 AM to 10:00 PM\nSunday: Closed\nLab service: open 24 hours', is_placeholder = FALSE, updated_at = now()
WHERE key = 'contact.opening_hours';

INSERT INTO slots (branch_id, modality, slot_date, start_time, end_time, capacity)
SELECT b.id, m.modality, d::date, t::time, (t + interval '30 minutes')::time, m.capacity
FROM branches b
CROSS JOIN (VALUES ('USG', 2), ('CT', 1), ('BIOPSY', 1)) AS m (modality, capacity)
CROSS JOIN generate_series((now() AT TIME ZONE 'Asia/Kolkata')::date + 1, (now() AT TIME ZONE 'Asia/Kolkata')::date + 30, interval '1 day') AS d
CROSS JOIN generate_series(timestamp '2000-01-01 08:00', timestamp '2000-01-01 21:30', interval '30 minutes') AS t
WHERE b.slug IN ('bhosari', 'moshi', 'pimple-gurav', 'moi') AND extract(isodow FROM d) < 7
ON CONFLICT ON CONSTRAINT slots_branch_modality_date_time_unique DO NOTHING;
