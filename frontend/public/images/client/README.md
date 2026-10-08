# Client images

Put the centre's real images in this folder. Nothing here is committed by default except this file.

| File | Used for | Recommended size |
|---|---|---|
| `logo.svg` or `logo.png` | Header, footer and structured data | SVG, or PNG at least 256 x 256 with a transparent background |
| `doctor.webp` (or `.jpg`) | Home page doctor introduction and About page | 720 x 864, portrait, under 200 KB |
| `branch-bhosari.webp` | Optional branch photo | 1200 x 800, under 250 KB |

After copying a file here, set the matching value in the admin panel (or the `site_settings` table):

- Logo: `clinic.logo_url` = `/images/client/logo.svg`
- Doctor photo: `doctor.photo_url` = `/images/client/doctor.webp`

Only use photos the centre owns or has permission to publish. Do not use images copied from Google, Justdial, Practo or Lybrate.
