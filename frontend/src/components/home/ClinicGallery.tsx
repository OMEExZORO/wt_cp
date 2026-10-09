import { CLIENT_PHOTOS } from '../../lib/images'

export function ClinicGallery() {
  const photos = CLIENT_PHOTOS.filter((photo) => photo.key !== 'doctor')
  return (
    <ul className="gallery-strip">
      {photos.map((photo) => (
        <li key={photo.key}>
          <img src={photo.src} alt={photo.alt} width={photo.width} height={photo.height} loading="lazy" decoding="async" />
        </li>
      ))}
    </ul>
  )
}
