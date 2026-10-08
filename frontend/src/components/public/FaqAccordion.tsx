import { useCallback, useRef, useState, type KeyboardEvent } from 'react'
import type { PublicFaq } from '../../types/public'
import { ChevronDownIcon } from '../icons/Icons'

export function FaqAccordion({ faqs, idPrefix = 'faq' }: { faqs: PublicFaq[]; idPrefix?: string }) {
  const [openId, setOpenId] = useState<string | null>(null)
  const buttons = useRef<(HTMLButtonElement | null)[]>([])

  const toggle = useCallback((id: string) => {
    setOpenId((current) => (current === id ? null : id))
  }, [])

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
      const last = faqs.length - 1
      let next: number | null = null
      if (event.key === 'ArrowDown') {
        next = index === last ? 0 : index + 1
      } else if (event.key === 'ArrowUp') {
        next = index === 0 ? last : index - 1
      } else if (event.key === 'Home') {
        next = 0
      } else if (event.key === 'End') {
        next = last
      }
      if (next !== null) {
        event.preventDefault()
        buttons.current[next]?.focus()
      }
    },
    [faqs.length],
  )

  return (
    <div className="accordion">
      {faqs.map((faq, index) => {
        const open = openId === faq.id
        const buttonId = `${idPrefix}-button-${faq.id}`
        const panelId = `${idPrefix}-panel-${faq.id}`
        return (
          <div key={faq.id} className={`accordion__item${open ? ' accordion__item--open' : ''}`}>
            <h3 className="accordion__heading">
              <button
                type="button"
                id={buttonId}
                ref={(element) => {
                  buttons.current[index] = element
                }}
                className="accordion__button"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => toggle(faq.id)}
                onKeyDown={(event) => onKeyDown(event, index)}
              >
                <span>{faq.question}</span>
                <ChevronDownIcon className="accordion__chevron" />
              </button>
            </h3>
            <div id={panelId} role="region" aria-labelledby={buttonId} hidden={!open} className="accordion__panel">
              <p>{faq.answer}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
