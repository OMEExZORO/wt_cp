import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, '..', 'public', 'images', 'stock')

const IMAGES = [
  { name: 'hero-welcome', id: 8459996, width: 1600, height: 900, position: 'centre' },
  { name: 'hero-ct', id: 13176452, width: 1600, height: 900, position: 'centre' },
  { name: 'hero-ultrasound', id: 7108424, width: 1600, height: 900, position: 'centre' },
  { name: 'hero-biopsy', id: 20055176, width: 1600, height: 900, position: 'centre' },
  { name: 'card-ct', id: 13176357, width: 800, height: 600, position: 'centre' },
  { name: 'card-ultrasound', id: 7089394, width: 800, height: 600, position: 'attention' },
  { name: 'card-biopsy', id: 35609691, width: 800, height: 600, position: 'attention' },
  { name: 'card-reporting', id: 4226124, width: 800, height: 600, position: 'centre' },
  { name: 'card-reception', id: 7108325, width: 800, height: 600, position: 'centre' },
]

await mkdir(outDir, { recursive: true })

for (const image of IMAGES) {
  const url = `https://images.pexels.com/photos/${image.id}/pexels-photo-${image.id}.jpeg?auto=compress&cs=tinysrgb&w=2400`
  const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  if (!response.ok) {
    throw new Error(`Download failed for ${image.id}: ${response.status}`)
  }
  const source = Buffer.from(await response.arrayBuffer())
  const output = await sharp(source)
    .resize(image.width, image.height, { fit: 'cover', position: image.position })
    .webp({ quality: 74 })
    .toBuffer()
  await writeFile(join(outDir, `${image.name}.webp`), output)
  console.log(`${image.name}.webp ${Math.round(output.length / 1024)} KB`)
}
