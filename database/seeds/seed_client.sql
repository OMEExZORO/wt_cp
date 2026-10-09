UPDATE site_settings SET value = '+918605018087', is_placeholder = FALSE, updated_at = now() WHERE key = 'contact.phone';
UPDATE site_settings SET value = 'Monday to Saturday: 8:00 am to 9:00 pm
Sunday: Closed', is_placeholder = FALSE, updated_at = now() WHERE key = 'contact.opening_hours';
UPDATE site_settings SET value = 'https://share.google/ZMrpDquWZCV9jaEiv', is_placeholder = FALSE, updated_at = now() WHERE key IN ('links.google_reviews_url', 'links.google_maps_url');

UPDATE branches SET
    address_line = 'Nagdev Towers, Pune - Nashik Highway',
    landmark = 'Near Vishwavilas Hotel and Shraddha Jewellers',
    area = 'Bhosari Gaonthan, Bhosari',
    city = 'Pimpri-Chinchwad',
    postal_code = '411039',
    phone = '+918605018087',
    opening_hours = 'Monday to Saturday: 8:00 am to 9:00 pm
Sunday: Closed',
    maps_url = 'https://share.google/ZMrpDquWZCV9jaEiv',
    is_placeholder = FALSE,
    updated_at = now()
WHERE slug = 'bhosari';

INSERT INTO reviews (display_name, body, rating, status, verified_visit, is_demo, source, source_url, external_review_date, translated_by_google, moderated_at, moderation_note)
SELECT v.display_name, v.body, 5, 'approved', FALSE, FALSE, 'google', 'https://share.google/ZMrpDquWZCV9jaEiv', v.review_date::date, v.translated, now(), 'Imported from the clinic Google listing on 2026-10-09'
FROM (VALUES
    ('Shivani Kamble', 'Good service', DATE '2026-10-09' - INTERVAL '1 month', FALSE),
    ('Roma Gaikwad', 'Dr is very nice and humble.', DATE '2026-10-09' - INTERVAL '8 months', FALSE),
    ('Rekha B.p', 'Fast service for xray and USG and lab. Re0ortd were conveyed immediately. Good experience', DATE '2026-10-09' - INTERVAL '9 months', FALSE),
    ('Anisha Dhage', 'Cool people. Over all nice experience . Worth talking to dr mehhnad . Good guidance', DATE '2026-10-09' - INTERVAL '9 months', FALSE),
    ('Sangita Mane', 'Good quality of xray. Dr gave good explanation about disease', DATE '2026-10-09' - INTERVAL '9 months', FALSE),
    ('Ujjawala Kale', 'Nice dr. Nice advice. Prompt service', DATE '2026-10-09' - INTERVAL '9 months', FALSE),
    ('asha kumbhar', 'Very advanced machine. Good diagnosis', DATE '2026-10-09' - INTERVAL '9 months', FALSE),
    ('Shashikant Saini', 'Very polite and senior doctor', DATE '2026-10-09' - INTERVAL '9 months', FALSE),
    ('Vairage Sandip', 'Good diagnostic', DATE '2026-10-09' - INTERVAL '9 months', FALSE),
    ('Navita Khirad', 'Best sonagrphy centre in bhosari good staff and Best doctor', DATE '2026-10-09' - INTERVAL '1 year', FALSE),
    ('Asmi K', 'Doctor is very cooperative .', DATE '2026-10-09' - INTERVAL '1 year', FALSE),
    ('Ajinky Bagde', 'Very cooperative staff and informative doctor''s advice. Necessary they are not advising to do any report or testing. Report always clear with detail information.', DATE '2026-10-09' - INTERVAL '2 years', FALSE),
    ('vidula inamdar', 'Good experience in this centre. Good staff , proper diagnosis by Dr . Overall good service. Quick reports.', DATE '2026-10-09' - INTERVAL '2 years', FALSE),
    ('Pramod Jakhar', 'Best in pcmc. Highly genuine and knowledgeable doctor', DATE '2026-10-09' - INTERVAL '4 years', FALSE),
    ('Balwan Singh Jakhar', 'Doctor Meghnad is amazing very experienced and knowledgeable', DATE '2026-10-09' - INTERVAL '4 years', FALSE),
    ('Rahul Vendait', 'Very focused, friendly and sensible doctor.', DATE '2026-10-09' - INTERVAL '4 years', FALSE),
    ('Amol Soma', 'Polite & responsive staff.', DATE '2026-10-09' - INTERVAL '4 years', FALSE),
    ('SHRIKANT MIRAGE', 'Good sarvises', DATE '2026-10-09' - INTERVAL '4 years', FALSE),
    ('Sudhir Dewale', 'Best service and perfect diagnosis', DATE '2026-10-09' - INTERVAL '11 years', FALSE),
    ('Ajay Khodave', 'Best service available', DATE '2026-10-09' - INTERVAL '11 years', FALSE),
    ('moin shaikh', 'Nice staff', DATE '2026-10-09' - INTERVAL '11 years', TRUE)
) AS v (display_name, body, review_date, translated)
WHERE NOT EXISTS (
    SELECT 1 FROM reviews r WHERE r.source = 'google' AND r.display_name = v.display_name AND r.body = v.body
);
