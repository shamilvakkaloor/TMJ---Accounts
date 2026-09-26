/** The static site's root, including a GitHub Pages repository prefix. */
const siteRoot = () =>
  new URL(import.meta.env.BASE_URL, window.location.origin);

export function appUrl(route: string, base = siteRoot()): string {
  const url = new URL(base);
  url.search = "";
  url.hash = route.startsWith("/") ? route : `/${route}`;
  return url.href;
}

/** Local assets are relative to the app, while full external URLs stay intact. */
export function assetUrl(path: string, base = siteRoot()): string {
  return new URL(path.replace(/^\/+/, ""), base).href;
}

export function scannedRecordRoute(text: string, base = siteRoot()): string {
  const url = new URL(text);
  const route = url.hash.slice(1);
  if (
    url.origin !== base.origin ||
    url.pathname !== base.pathname ||
    url.search ||
    !/^\/(p\/(member|house)\/[\w-]+|receipt\/[\w-]+)$/.test(route)
  )
    throw new Error("This QR code is not a Mahal record on this site.");
  return route;
}
