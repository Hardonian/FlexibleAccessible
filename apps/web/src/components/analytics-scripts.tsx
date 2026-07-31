import Script from "next/script";

/**
 * GTM + GA injection. Reads the container ID from env (NEXT_PUBLIC_GTM_ID).
 * When unset, renders nothing (no external calls) — safe default for local/dev.
 * Placed once in the root layout so every route is tracked.
 */
export function AnalyticsScripts() {
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID;
  const gaId = process.env.NEXT_PUBLIC_GA_ID;

  if (!gtmId && !gaId) return null;

  return (
    <>
      {gtmId ? (
        <Script id="gtm-base" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;
            j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;
            f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}');`}
        </Script>
      ) : null}
      {gaId ? (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
            strategy="afterInteractive"
          />
          <Script id="ga-base" strategy="afterInteractive">
            {`window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${gaId}');`}
          </Script>
        </>
      ) : null}
    </>
  );
}

/** Fire a GTM event from client components. Safe no-op if no dataLayer. */
export function trackEvent(event: string, payload: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dl = (window as any).dataLayer;
  if (dl && Array.isArray(dl)) {
    dl.push({ event, ...payload });
  }
}
