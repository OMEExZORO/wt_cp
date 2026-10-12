import '@testing-library/jest-dom/vitest'
import { configure } from '@testing-library/react'
import { vi } from 'vitest'

// Routes are lazy-loaded and rendered in jsdom; under parallel load the default 1s wait is too tight.
configure({ asyncUtilTimeout: 10_000 })
window.scrollTo = vi.fn() as unknown as typeof window.scrollTo
