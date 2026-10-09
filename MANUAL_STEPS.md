# Manual Steps

Only things that need a human. Content values marked as placeholders are editable later from the admin panel (`site_settings` and `branches` tables).

## Accounts and hosting

- [ ] Create or confirm the hosting accounts: Render (API and alerts worker), Vercel or Cloudflare Pages (frontend), Supabase (production project)
- [ ] Buy the domain name and configure DNS for the frontend and the API
- [ ] SMTP credentials for outgoing email (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`); set `MAIL_DRIVER=smtp`
- [ ] Enter the production secrets in the Render dashboard (every variable marked `sync: false` in `render.yaml`) and set `SITE_URL` and `VITE_API_BASE_URL` on the frontend host
- [ ] Create the first production admin user (SQL in the Deploy section of `README.md`)
- [ ] Before go-live: remove the dev users (`*@diagnocare.test`) and demo reviews (`npm run seed:purge-demo`), or use a separate production Supabase project seeded with `npm run seed` only
- [ ] Rotate the Supabase access token used during setup (`SUPABASE_ACCESS_TOKEN`) and any other credential that was pasted into chat or a terminal

## Client content (do not invent)

- [ ] Real phone numbers for the centre and each branch (`contact.phone`, `branches.phone`)
- [ ] WhatsApp number (`contact.whatsapp`, `branches.whatsapp`)
- [ ] Contact email (`contact.email`, `branches.email`)
- [ ] Opening hours for each branch (`contact.opening_hours`, `branches.opening_hours`), then create real appointment slots from the admin panel
- [ ] Second branch: name and full address (`branches.slug = 'branch-2'`, inactive until filled)
- [ ] Google Maps place links and embed URLs for each branch (`links.google_maps_url`, `branches.maps_url`, `branches.maps_embed_url`)
- [ ] Google reviews page link (`links.google_reviews_url`)
- [ ] Real logo file and doctor photo, placed in `frontend/public/images/client/` (see the README there) with `clinic.logo_url` and `doctor.photo_url` set
- [ ] High-resolution clinic photos (centre, reception, scan rooms, doctor): the client photos in `frontend/public/images/client/` are only 141 x 101 px, so they are used as small thumbnails. Replace them through `CLIENT_PHOTOS` and `CLIENT_OVERRIDES` in `frontend/src/lib/images.ts`
- [ ] Doctor biography paragraph (`doctor.bio`)
- [ ] Fees, only if the centre wants them published (`fees.note`, `scan_types.fee_inr`)
- [ ] Doctor's review and approval of service descriptions, preparation tips, checklist questions and FAQ answers in `database/seeds/seed_base.sql`, including whether the seeded FAQ about fetal sex determination stays
- [ ] Doctor and legal review of the Privacy and Terms pages, including retention periods, grievance contact and jurisdiction
