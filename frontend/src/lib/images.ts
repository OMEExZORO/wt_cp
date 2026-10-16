export interface ClientPhoto {
  key: string
  src: string
  alt: string
  width: number
  height: number
}

export const CLIENT_PHOTOS: ClientPhoto[] = [
  { key: 'doctor', src: '/images/client/doctor-at-usg.jpg', alt: 'Dr. Meghnad Padsalgikar seated beside the ultrasound machine', width: 141, height: 101 },
  { key: 'signboard', src: '/images/client/centre-signboard.jpg', alt: 'Centre signboard in Marathi reading Meghnad Sonography', width: 141, height: 101 },
  { key: 'reception', src: '/images/client/reception.jpg', alt: 'Reception and waiting area entrance', width: 141, height: 101 },
  { key: 'lab-technician', src: '/images/client/lab-technician.jpg', alt: 'Laboratory technician at work', width: 141, height: 101 },
  { key: 'lab-analyser', src: '/images/client/lab-analyser.jpg', alt: 'Laboratory analyser', width: 141, height: 101 },
  { key: 'lab-counter', src: '/images/client/lab-counter.jpg', alt: 'Laboratory work counter', width: 141, height: 101 },
]

export function clientPhoto(key: string): ClientPhoto | undefined {
  return CLIENT_PHOTOS.find((photo) => photo.key === key)
}

export const GOOGLE_LISTING_NAME = 'Meghnad Sonography Center'
