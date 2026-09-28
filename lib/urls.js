export const siteRoot = () => new URL("../", import.meta.url);
export function appUrl(route, base = siteRoot()) {
  const url = new URL(base);
  url.search = "";
  url.hash = route.startsWith("/") ? route : `/${route}`;
  return url.href;
}
export function assetUrl(path, base = siteRoot()) {
  const url = new URL(path.replace(/^\/+/, ""), base);
  if (!["https:", "http:"].includes(url.protocol))
    throw new Error("Logo must use a local path or HTTPS URL.");
  return url.href;
}
export function scannedRecordRoute(text, base = siteRoot()) {
  const url = new URL(text),
    route = url.hash.slice(1);
  if (
    url.origin !== base.origin ||
    url.pathname !== base.pathname ||
    url.search ||
    !/^\/(p\/(member|house)\/[\w-]+|receipt\/[\w-]+)$/.test(route)
  )
    throw new Error("This QR code is not a Mahal record on this site.");
  return route;
}
