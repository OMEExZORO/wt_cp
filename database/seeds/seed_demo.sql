DELETE FROM reviews WHERE is_demo = TRUE;

INSERT INTO reviews (display_name, rating, body, status, verified_visit, is_demo, moderated_at)
VALUES
    ('Demo data: Sample Patient A', 5, 'Demo data: placeholder review text for development screenshots only. Not a real patient review.', 'approved', FALSE, TRUE, now()),
    ('Demo data: Sample Patient B', 4, 'Demo data: placeholder review text for development screenshots only. Not a real patient review.', 'approved', FALSE, TRUE, now()),
    ('Demo data: Sample Patient C', 5, 'Demo data: placeholder review text for development screenshots only. Not a real patient review.', 'approved', FALSE, TRUE, now()),
    ('Demo data: Sample Patient D', 3, 'Demo data: placeholder review awaiting moderation, for testing the admin moderation queue.', 'pending', FALSE, TRUE, NULL);
