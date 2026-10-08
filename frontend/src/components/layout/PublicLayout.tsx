import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import { ErrorBoundary } from '../ErrorBoundary'
import { PageLoader } from '../PageLoader'
import { SiteFooter } from './SiteFooter'
import { SiteHeader } from './SiteHeader'

export function PublicLayout() {
  return (
    <div className="layout">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <SiteHeader />
      <main id="main" className="layout__main">
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>
      <SiteFooter />
    </div>
  )
}
