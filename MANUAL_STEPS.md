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

- [x] Bhosari phone, hours, address and Google link loaded from the Google listing (`php backend/bin/seed.php client`); still needed: second branch phone and hours
- [ ] WhatsApp number (hidden in the UI by `SHOW_WHATSAPP` in `frontend/src/lib/features.ts`) (`contact.whatsapp`, `branches.whatsapp`)
- [ ] Contact email (hidden in the UI by `SHOW_EMAIL` in `frontend/src/lib/features.ts`; `contact.email`, `branches.email`)
- [ ] Create real appointment slots matching Mon-Sat 8 am to 9 pm from the admin panel; add second branch hours
- [ ] Second branch: waiting for details. `branch-2` is set `is_active=false`; name, address and phone are needed (`branches.slug = 'branch-2'`) before activating it
- [ ] Google Maps place links and embed URLs for each branch (`links.google_maps_url`, `branches.maps_url`, `branches.maps_embed_url`)
- [x] Google reviews link set; 21 real Google reviews imported via `seed_client.sql` (the doctor's own review excluded)
- [x] Logo files added (`logo-lockup.png`, `logo-mdc.png`)
- [ ] Doctor photo, placed in `frontend/public/images/client/` (see the README there) with `clinic.logo_url` and `doctor.photo_url` set
- [ ] High-resolution clinic photos (centre, reception, scan rooms, doctor): the client photos in `frontend/public/images/client/` are only 141 x 101 px, so they are used as small thumbnails. Replace them through `CLIENT_PHOTOS` and `CLIENT_OVERRIDES` in `frontend/src/lib/images.ts`
- [ ] Doctor biography paragraph (`doctor.bio`)
- [ ] Fees, only if the centre wants them published (`fees.note`, `scan_types.fee_inr`)
- [ ] Doctor's review and approval of service descriptions, preparation tips, checklist questions and FAQ answers in `database/seeds/seed_base.sql`, including whether the seeded FAQ about fetal sex determination stays
- [ ] Doctor and legal review of the Privacy and Terms pages, including retention periods, grievance contact and jurisdiction
