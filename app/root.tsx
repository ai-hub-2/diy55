import { useStore } from '@nanostores/react';
import type { LinksFunction } from '@remix-run/cloudflare';
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from '@remix-run/react';
import tailwindReset from '@unocss/reset/tailwind-compat.css?url';
import { themeStore } from './lib/stores/theme';
import { stripIndents } from './utils/stripIndent';
import { createHead } from 'remix-island';
import { useEffect, useRef } from 'react';
import { Workbox } from 'workbox-window';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { ClientOnly } from 'remix-utils/client-only';

import reactToastifyStyles from 'react-toastify/dist/ReactToastify.css?url';
import globalStyles from './styles/index.scss?url';
import xtermStyles from '@xterm/xterm/css/xterm.css?url';

import 'virtual:uno.css';

export const links: LinksFunction = () => [
  {
    rel: 'icon',
    href: '/favicon.svg',
    type: 'image/svg+xml',
  },
  { rel: 'stylesheet', href: reactToastifyStyles },
  { rel: 'stylesheet', href: tailwindReset },
  { rel: 'stylesheet', href: globalStyles },
  { rel: 'stylesheet', href: xtermStyles },
  {
    rel: 'preconnect',
    href: 'https://fonts.googleapis.com',
  },
  {
    rel: 'preconnect',
    href: 'https://fonts.gstatic.com',
    crossOrigin: 'anonymous',
  },
  {
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  },
];

const inlineThemeCode = stripIndents`
  setTutorialKitTheme();

  function setTutorialKitTheme() {
    let theme = localStorage.getItem('bolt_theme');

    if (!theme) {
      theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    document.querySelector('html')?.setAttribute('data-theme', theme);
  }
`;

export const Head = createHead(() => (
  <>
    <meta charSet="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    {/* PWA Manifest and iOS support */}
    <link rel="manifest" href="/manifest.json" />
    <meta name="theme-color" content="#000000" /> {/* Default theme color, can be dynamic later */}
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" /> {/* Should match one in manifest */}
    {/* Add more apple-touch-startup-image if needed */}

    <Meta />
    <Links />
    <script dangerouslySetInnerHTML={{ __html: inlineThemeCode }} />
  </>
));

export function Layout({ children }: { children: React.ReactNode }) {
  const theme = useStore(themeStore);

  useEffect(() => {
    document.querySelector('html')?.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <>
      <ClientOnly>{() => <DndProvider backend={HTML5Backend}>{children}</DndProvider>}</ClientOnly>
      <ScrollRestoration />
      <Scripts />
    </>
  );
}

import { logStore } from './lib/stores/logs';

export default function App() {
  const theme = useStore(themeStore);
  const wb = useRef<Workbox | null>(null);
  const registration = useRef<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    logStore.logSystem('Application initialized', {
      theme,
      platform: navigator.platform,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    });

    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      wb.current = new Workbox('/sw.js'); // vite-plugin-pwa generates sw.js by default

      const showSkipWaitingPrompt = (event: Event) => {
        // `event.wasWaitingBeforeRegister` will be false if this is the first service worker,
        // or if there was a previous service worker that was uncontrolled.
        // `event.isUpdate` will be true if there's an update available.
        // Display a toast or modal asking the user to reload to update.
        console.log('Service worker update available. Please refresh.');
        // Example: toast.info("New version available. Refresh to update.", { onClick: () => wb.current?.messageSW({ type: "SKIP_WAITING" }) });
        // For now, we'll just log and skip waiting automatically for simplicity in autoUpdate mode
        if (wb.current) {
          wb.current.messageSW({ type: 'SKIP_WAITING' });
        }
      };

      wb.current.addEventListener('waiting', showSkipWaitingPrompt);
      // wb.current.addEventListener('externalwaiting', showSkipWaitingPrompt); // For external SW

      wb.current
        .register()
        .then((r) => {
          registration.current = r;
          console.log('Service worker registered:', r);
        })
        .catch((error) => {
          console.error('Service worker registration failed:', error);
        });
    }
  }, []); // Run only once on mount

  // Listen for messages from the service worker.
  useEffect(() => {
    if (!wb.current) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'RELOAD_PAGE') {
        window.location.reload();
      }
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);
    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage);
    };
  }, []);


  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}
