# Manual Steps

Things that need a human. Values marked as placeholders are editable later from the admin panel (`site_settings` and `branches` tables).

## Client content (do not invent)

- [ ] Second branch: name and full address (`branches.slug = 'branch-2'`, currently inactive in the production seed)
- [ ] Phone numbers for the centre and each branch (`contact.phone`, `branches.phone`)
- [ ] WhatsApp number (`contact.whatsapp`, `branches.whatsapp`)
- [ ] Contact email (`contact.email`, `branches.email`)
- [ ] Opening hours for each branch (`contact.opening_hours`, `branches.opening_hours`)
- [ ] Fees, if the centre wants them published (`fees.note`, `scan_types.fee_inr`)
- [ ] Doctor photo (`doctor.photo_url`, place the image in `frontend/public/images/client/`)
- [ ] Doctor biography paragraph (`doctor.bio`)
- [ ] Google Maps place links and embed URLs for each branch (`links.google_maps_url`, `branches.maps_url`, `branches.maps_embed_url`)
- [ ] Google reviews page link (`links.google_reviews_url`)
- [ ] Real logo file (`clinic.logo_url`, `frontend/public/images/client/`)
- [ ] Doctor's review and approval of service descriptions, preparation tips, checklist questions and FAQ answers in `database/seeds/seed_base.sql`
- [ ] Real clinic opening hours, so admin can create real appointment slots

## Accounts and infrastructure

- [ ] SMTP credentials for outgoing email (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`); set `MAIL_DRIVER=smtp`
- [ ] Hosting accounts for the API, worker and frontend (Phase 8)
- [ ] Domain name and DNS
- [ ] Before go-live: remove the dev users (`*@diagnocare.test`) and demo reviews (`npm run seed:purge-demo`), or use a separate production Supabase project seeded with `npm run seed` only
- [ ] Start Docker Desktop if you want to use `docker compose up` (the daemon was not running during Phase 1, so images were not built)
