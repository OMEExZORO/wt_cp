import { useAppSelector } from '../../app/hooks'
import { selectSetting } from '../../features/public/publicSlice'
import { settingText } from '../../lib/contact'
import { GOOGLE_LISTING_NAME } from '../../lib/images'

export function GoogleListingNote({ className = 'google-listing-note' }: { className?: string }) {
  const name = settingText(useAppSelector(selectSetting('google.listing_name'))) ?? GOOGLE_LISTING_NAME
  return <p className={className}>Listed on Google as {name}</p>
}
