import { Suspense, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useAppDispatch } from '../../app/hooks'
import { loadBranches, loadSite } from '../../features/public/publicSlice'
import { ErrorBoundary } from '../ErrorBoundary'
import { PageLoader } from '../PageLoader'
import { StructuredData } from '../public/StructuredData'
import { SiteFooter } from './SiteFooter'
import { SiteHeader } from './SiteHeader'
import { StickyActionBar } from './StickyActionBar'

export function PublicLayout() {
  const dispatch = useAppDispatch()
  const { pathname } = useLocation()

  useEffect(() => {
    void dispatch(loadSite())
    void dispatch(loadBranches())
  }, [dispatch])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="layout">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <SiteHeader />
      <main id="main" className="layout__main" tabIndex={-1}>
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>
      <SiteFooter />
      <StickyActionBar />
      <StructuredData />
    </div>
  )
}
