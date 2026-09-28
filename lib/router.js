export function routeInfo(hash = location.hash) {
  const raw = hash.replace(/^#/, "") || "/",
    url = new URL(raw, "https://routes.invalid");
  return {
    path: url.pathname.replace(/\/$/, "") || "/",
    params: url.searchParams,
  };
}
export function navigate(route) {
  location.hash = route;
}
