// Builds content-pack.json for the Learning Hub from the story data, so the pack cannot drift from the walkthrough.
//   node scripts/build-content-pack.mjs        (writes content-pack.json)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_CAST, buildFlow } from '../server/src/flow.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

export function buildPack() {
  const flow = buildFlow(DEFAULT_CAST);
  const terms = { 1: ['protected-resource-metadata'], 2: ['protected-resource-metadata'], 3: ['as-metadata'], 4: ['pkce'], 5: ['cimd'], 6: ['consent-record'], 7: ['private-key-jwt', 'pkce'], 8: ['audience-bound-token'], 9: ['audience-bound-token'], 10: ['policy-decision'], 11: ['policy-decision'], 12: ['audience-bound-token'] };
  const sid = (n) => `S${String(n).padStart(2, '0')}`;
  const tryCard = (h) => ({ id: `try-hop-${h.n}`, label: `Step ${h.n}: ${h.title}`, description: h.say, group: 'try-it', action: { type: 'route', href: `/#hop-${h.n}` }, terms: terms[h.n], story: sid(h.n) });
  return {
    schema: 'demo-content-pack/1',
    id: 'personal-agent-demo',
    title: 'Personal Agent Flow',
    version,
    demo: { id: 'personal-agent-demo', name: 'Personal Agent Flow', catalog: 'D21', baseUrl: 'http://localhost:6900', doctor: '/api/health', tags: ['mcp', 'agent', 'token-exchange', 'consent', 'approval', 'mock-only'] },
    glossary: [
      { id: 'protected-resource-metadata', term: 'Protected-resource metadata', definition: 'A document the MCP gateway publishes (RFC 9728) that names its authorization server and the scopes it understands. The first 401 points at it, so a client can find out how to get a token with no prior arrangement.', aliases: ['RFC 9728', 'resource_metadata'] },
      { id: 'as-metadata', term: 'Authorization-server metadata', definition: 'A document (RFC 8414) listing the identity provider\'s endpoints, supported grants, PKCE methods and client authentication methods, so the client needs no hard-coded configuration.', aliases: ['RFC 8414'] },
      { id: 'cimd', term: 'Client ID Metadata Document (CIMD)', definition: 'The client identifies itself by publishing a client document at a URL and using that URL as its client id. The identity provider fetches it to learn the redirect URI and the public keys, then checks them against its client acceptance policy.', aliases: ['client document', 'client.json'] },
      { id: 'consent-record', term: 'Consent record', definition: 'A stored, versioned record that this member allowed this client to use this scope on this resource. Consent is necessary where required but never overrides policy.' },
      { id: 'private-key-jwt', term: 'private_key_jwt', definition: 'The client authenticates to the token endpoint with a short signed assertion made with a key only it holds; the identity provider checks it against the published JWKS. It is client authentication, not sender constraint: a token already issued is still a bearer.' },
      { id: 'pkce', term: 'PKCE (S256)', definition: 'A one-time secret the client creates before the browser leg and proves at the token exchange, so a stolen authorization code is useless.', aliases: ['RFC 7636'] },
      { id: 'audience-bound-token', term: 'Audience-bound access token', definition: 'The access token names one audience (the MCP resource) and one scope, and lives minutes. The gateway rejects it anywhere else.', aliases: ['aud', 'at+jwt'] },
      { id: 'policy-decision', term: 'Policy decision point', definition: 'The service the gateway asks, with member, client, tool, action, resource and context, for Permit or Deny. The gateway enforces; the decision point decides.', aliases: ['PDP', 'P1AZ'] },
    ],
    sources: [
      { id: 'rfc9728', title: 'RFC 9728: OAuth 2.0 Protected Resource Metadata', url: 'https://www.rfc-editor.org/rfc/rfc9728', kind: 'standard', use: 'The metadata the first 401 points at.', status: 'not-read', checked: '2026-10-27' },
      { id: 'rfc8414', title: 'RFC 8414: OAuth 2.0 Authorization Server Metadata', url: 'https://www.rfc-editor.org/rfc/rfc8414', kind: 'standard', use: 'The sign-in configuration the client discovers.', status: 'not-read', checked: '2026-10-27' },
      { id: 'rfc7636', title: 'RFC 7636: Proof Key for Code Exchange', url: 'https://www.rfc-editor.org/rfc/rfc7636', kind: 'standard', use: 'PKCE on the consent step.', status: 'not-read', checked: '2026-10-27' },
    ],
    cards: [
      ...flow.hops.map(tryCard),
      { id: 'concept-trust', label: 'The assistant is never trusted', description: 'The assistant only ever holds a token that lives for minutes; the gateway and the policy engine decide every call.', group: 'concept', action: { type: 'route', href: '/' }, terms: ['audience-bound-token', 'policy-decision'] },
      { id: 'ref-doctor', label: 'Doctor and health', description: 'Preflight checks and the demo-health/1 endpoint.', group: 'setup', action: { type: 'route', href: '/api/health' } },
    ],
    stories: flow.hops.map((h) => ({ id: sid(h.n), title: h.title, say: h.say })),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  fs.writeFileSync(path.join(ROOT, 'content-pack.json'), `${JSON.stringify(buildPack(), null, 2)}\n`);
  console.log('wrote content-pack.json');
}
