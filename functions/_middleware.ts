// Keep auth storage on one origin. Local development is deliberately untouched.
export function onRequest({ request, next }: { request: Request; next: () => Promise<Response> }) {
  const url = new URL(request.url)
  if (url.hostname === 'howsehowld.pages.dev' || url.hostname.endsWith('.howsehowld.pages.dev')) {
    url.protocol = 'https:'
    url.host = 'howse.brandon-barker.ca'
    return new Response(null, { status: 302, headers: { Location: url.toString(), 'Cache-Control': 'no-store' } })
  }
  return next()
}
