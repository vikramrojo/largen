## ADDED Requirements

### Requirement: The origin publishes a robots policy
The site SHALL serve `/robots.txt` as plain text, parseable per RFC 9309, naming its
sitemap and stating its position on AI crawlers explicitly rather than by omission.

#### Scenario: A crawler fetches the policy
- **WHEN** `/robots.txt` is requested
- **THEN** it SHALL return 200 with a `text/plain` content type
- **AND** every non-comment line SHALL be a `field: value` directive belonging to a
  `User-agent` group, or a `Sitemap` line

#### Scenario: An AI crawler is not named
- **WHEN** a crawler that the policy does not name explicitly fetches the site
- **THEN** the `User-agent: *` group SHALL determine what it may do
- **AND** the policy SHALL NOT rely on silence to express an intention

#### Scenario: Content preferences are declared
- **WHEN** the policy is read for content-usage preferences
- **THEN** it SHALL state a preference for training, search and inference use
- **AND** those preferences SHALL be consistent with what the site publishes elsewhere,
  since a site that serves its contract inline for models to read has already answered

#### Scenario: The sitemap is named
- **WHEN** the policy names a sitemap
- **THEN** that URL SHALL resolve

### Requirement: The origin publishes a sitemap of its canonical pages
The site SHALL serve `/sitemap.xml` listing every canonical page, with absolute URLs on
the canonical origin.

#### Scenario: A page is added to the site
- **WHEN** a page is added by either generator
- **THEN** it SHALL appear in the sitemap without a second list being edited

#### Scenario: A listed URL does not resolve
- **WHEN** any URL in the sitemap is fetched
- **THEN** it SHALL return success
- **AND** this SHALL be checked for every entry rather than a sample, because a sitemap
  naming a dead URL is well-formed and silently wrong

#### Scenario: A page has more than one address
- **WHEN** a page is reachable at more than one path
- **THEN** the sitemap SHALL name the one the site's own navigation links

#### Scenario: The error page is not a destination
- **WHEN** the sitemap is generated
- **THEN** it SHALL NOT list the 404 page

### Requirement: The MCP server is discoverable and describes itself accurately
The site SHALL publish a server card describing the MCP endpoint it actually serves.

#### Scenario: The tool list is read
- **WHEN** the card's tool list is compared against the server's registered tools
- **THEN** they SHALL be equal
- **AND** the card SHALL be derived from the same definitions the endpoint serves, not
  maintained alongside them

#### Scenario: The card names a version
- **WHEN** the card's version is compared against the running server's
- **THEN** they SHALL agree

#### Scenario: The specification is not yet final
- **WHEN** the card conforms to a proposal that has not been merged
- **THEN** the document SHALL say so, rather than leaving a reader to discover it by
  diffing against a schema

### Requirement: The skill is discoverable and its digest is verified
The site SHALL publish a skills index naming the skill it serves, with a digest of the
bytes served at that URL.

#### Scenario: The digest is checked
- **WHEN** the URL the index publishes is fetched and hashed
- **THEN** the result SHALL equal the digest the index claims
- **AND** the check SHALL hash what the server returns rather than the file beside the
  generator, since those are the bytes a consumer receives

#### Scenario: The skill changes
- **WHEN** the skill is regenerated
- **THEN** the published digest SHALL change with it, or the check SHALL fail

### Requirement: The origin advertises its resources in responses
The landing page SHALL carry RFC 8288 `Link` headers pointing at the catalog, the
documentation and the inline contract.

#### Scenario: A client fetches the landing page
- **WHEN** the response headers are read
- **THEN** they SHALL include link relations for the API catalog, service documentation
  and a machine-readable description
- **AND** every target SHALL resolve

#### Scenario: The site answers on more than one hostname
- **WHEN** the site is reached at a hostname other than the canonical one
- **THEN** the link targets SHALL still resolve, which relative references achieve
  without the server knowing which hostname answered

### Requirement: Discovery documents claim only what exists
The site SHALL NOT publish discovery metadata describing capabilities it does not have.

#### Scenario: The site has no authentication
- **WHEN** an audit asks for OAuth or OpenID discovery metadata
- **THEN** it SHALL NOT be published while no authorization server exists
- **AND** their absence SHALL be asserted, so that adding authentication without adding
  the metadata fails a check rather than passing unnoticed

#### Scenario: A discovery document is generated
- **WHEN** any of these surfaces is produced
- **THEN** it SHALL be derived from the thing it describes
- **AND** it SHALL be compared against its generator by the same check that covers every
  other generated surface, in the same list, so that one cannot be written without being
  checked
