/**
 * Which page the canvas is showing, from the URL path.
 *
 * Two pages, both keeping `?run=<slug>` so a link restores the run as well as
 * the page:
 *   /default          the fixed pipeline
 *   /custom-workflow  the composer
 *
 * Small enough not to want a router dependency: one pathname, one popstate
 * listener, and pushState for navigation.
 */

import { useCallback, useEffect, useState } from 'react';

export const DEFAULT_ROUTE = '/default';
export const COMPOSER_ROUTE = '/custom-workflow';

export type Route = typeof DEFAULT_ROUTE | typeof COMPOSER_ROUTE;

function routeFor(pathname: string): Route {
  return pathname.replace(/\/+$/, '') === COMPOSER_ROUTE ? COMPOSER_ROUTE : DEFAULT_ROUTE;
}

export function useRoute() {
  const [route, setRoute] = useState<Route>(() => routeFor(window.location.pathname));

  // Anything that is not one of the two pages becomes /default, keeping ?run.
  useEffect(() => {
    const current = window.location.pathname.replace(/\/+$/, '');
    if (current !== DEFAULT_ROUTE && current !== COMPOSER_ROUTE) {
      window.history.replaceState(null, '', `${DEFAULT_ROUTE}${window.location.search}`);
      setRoute(DEFAULT_ROUTE);
    }
  }, []);

  useEffect(() => {
    const onPopState = () => setRoute(routeFor(window.location.pathname));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  /** Move between pages, carrying the current `?run` across. */
  const navigate = useCallback((next: Route) => {
    if (routeFor(window.location.pathname) === next) {
      return;
    }
    window.history.pushState(null, '', `${next}${window.location.search}`);
    setRoute(next);
  }, []);

  return { route, navigate };
}
