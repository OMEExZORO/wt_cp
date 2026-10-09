# Client photos

Drop real photographs of the centre here (WebP, JPEG or PNG) and point the website at them.

1. Copy the file into this folder, for example `ct-room.webp`. Hero images should be about 1600 x 900 px, card images about 800 x 600 px.
2. Open `frontend/src/lib/images.ts`.
3. In the `CLIENT_OVERRIDES` object, set the entry for the slot you want to replace, for example `'hero-ct': '/images/client/ct-room.webp'`. The matching `alt` text is in `SITE_IMAGES` and should be updated to describe the real photo.
4. Remove the matching credit line from `CREDITS.md` once no stock photo is left in that slot.

Only add photos the centre owns or has permission to publish. Do not add photos of patients without written consent.
