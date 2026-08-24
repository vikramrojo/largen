/* The origin largen.dev is published at.
 *
 * A committed literal, deliberately, not `process.env.LARGEN_BASE_URL`. The
 * surfaces that need an absolute URL — sitemap.xml, robots.txt, the api-catalog
 * anchors — are generated into site/public/ and compared byte-for-byte by
 * `largen contract --check`. Reading the origin from the environment would make
 * two machines generate two different files and the check would fail on whoever
 * did not export the same variable.
 *
 * It is `largen.exe.xyz` because that is what answers today. `largen.dev` is the
 * name the project is called, is what package.json's `homepage` says, and does
 * not resolve yet. Publishing a sitemap of URLs that do not resolve is the one
 * way this format fails, so the constant names the host that serves and moves
 * when DNS lands — one edit, then regenerate. See the `largen-dev-origin` change.
 *
 * The server does NOT import this. Its Link headers use relative references,
 * which RFC 8288 resolves against the request URL, so they are correct on every
 * hostname the site answers on without knowing which one it is.
 */
export const CANONICAL = 'https://largen.exe.xyz'

/** Absolute URL for a site-root-relative path. */
export const canonical = (path) => new URL(path, CANONICAL).href

export default CANONICAL
