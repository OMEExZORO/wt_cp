ALTER TABLE reviews ADD COLUMN source TEXT NOT NULL DEFAULT 'site';
ALTER TABLE reviews ADD COLUMN source_url TEXT;
ALTER TABLE reviews ADD COLUMN external_review_date DATE;
ALTER TABLE reviews ADD COLUMN reviewer_photo_url TEXT;

ALTER TABLE reviews ADD CONSTRAINT reviews_source_check CHECK (source IN ('site', 'google'));
ALTER TABLE reviews ADD CONSTRAINT reviews_source_url_length_check CHECK (source_url IS NULL OR char_length(source_url) <= 500);
ALTER TABLE reviews ADD CONSTRAINT reviews_reviewer_photo_url_length_check CHECK (reviewer_photo_url IS NULL OR char_length(reviewer_photo_url) <= 500);

CREATE INDEX reviews_source_idx ON reviews (source, status);
