import { useEffect } from 'react'

export const SITE_NAME = 'Meghnad Diagnostic Centre'

function upsertMeta(attribute: 'name' | 'property', key: string, content: string): void {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`)
  if (element === null) {
    element = document.createElement('meta')
    element.setAttribute(attribute, key)
    document.head.appendChild(element)
  }
  element.setAttribute('content', content)
}

export function usePageMeta(title: string, description: string): void {
  useEffect(() => {
    const fullTitle = title === SITE_NAME ? `${SITE_NAME} | Imaging for a Healthier Tomorrow` : `${title} | ${SITE_NAME}`
    document.title = fullTitle
    upsertMeta('name', 'description', description)
    upsertMeta('property', 'og:title', fullTitle)
    upsertMeta('property', 'og:description', description)
    upsertMeta('property', 'og:type', 'website')
    upsertMeta('property', 'og:site_name', SITE_NAME)
    upsertMeta('property', 'og:locale', 'en_IN')
    upsertMeta('name', 'twitter:card', 'summary')
    upsertMeta('name', 'twitter:title', fullTitle)
    upsertMeta('name', 'twitter:description', description)
  }, [title, description])
}

export function useJsonLd(id: string, data: Record<string, unknown> | null): void {
  const serialised = data === null ? null : JSON.stringify(data)
  useEffect(() => {
    if (serialised === null) {
      return undefined
    }
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.id = id
    script.text = serialised
    document.head.appendChild(script)
    return () => {
      script.remove()
    }
  }, [id, serialised])
}
