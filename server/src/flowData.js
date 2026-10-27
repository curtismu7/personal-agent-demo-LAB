// The story: an AI assistant (the member's own agent) reaches a member's benefits through an MCP gateway, in twelve steps:
// discovery, client metadata (CIMD), sign-in and consent, a signed code exchange, a gateway check and a fine-grained
// policy decision. Text is data with {{tokens}} so the brand, program and host come from customer.config.json
// (see flow.js). Every host ends in .example and every token value is a teaching value: nothing here is a real
// credential, tenant or customer. Illustrative architecture, not a claim of any production deployment.

const json = (title, obj) => `${title} (MOCK: teaching values, not a credential)\n${JSON.stringify(obj, null, 2)}`;

export const SOURCE = `sequenceDiagram
    autonumber
    participant U as Member\\nbrowser
    participant C as AI assistant\\nMCP client
    participant G as {{brand}} MCP gateway\\nenforcement point
    participant I as Identity provider\\nauthorize • token • JWKS
    participant Z as Policy decision point\\nPingOne Authorize
    participant B as {{brand}} Benefits API
    participant O as Assistant metadata\\nclient.json • jwks.json

    rect rgb(225,229,238)
    Note over U,C: Step 1 — Protected tool request
    U->>C: Show my {{program}} benefits
    C->>G: POST /mcp — no token
    G-->>C: 401 Unauthorized + WWW-Authenticate
    end
    rect rgb(226,228,236)
    Note over C,I: Steps 2-3 — Discover the resource and OAuth configuration
    C->>G: GET protected-resource metadata
    G-->>C: 200 OK
    C->>I: GET OAuth AS metadata
    I-->>C: 200 OK
    end
    rect rgb(222,230,248)
    Note over U,O: Steps 4-5 — Browser authorization and CIMD lookup
    C->>U: Sign in to {{brand}}
    U->>I: GET /oauth/authorize (browser request)
    I->>O: GET /oauth/client.json — CIMD lookup
    O-->>I: 200 OK
    end
    rect rgb(255,235,222)
    Note over U,I: Step 6 — Sign-in and consent
    I->>U: Login + resource-specific consent prompt
    U->>I: Member approves or denies
    I->>U: 302 redirect
    U->>C: OAuth callback
    end
    rect rgb(255,240,225)
    Note over C,O: Steps 7-8 — Code exchange, client verification, token
    C->>I: POST /oauth/token
    I->>O: GET /oauth/jwks.json
    O-->>I: Public JWKS
    I-->>C: 200 OK — access token
    end
    rect rgb(218,240,240)
    Note over C,Z: Steps 9-10 — Gateway validation and fine-grained decision
    C->>G: POST /mcp
    G->>Z: Policy evaluation
    Z-->>G: Permit / Deny
    end
    rect rgb(225,229,238)
    Note over G,U: Steps 11-12 — Downstream call and authorized result
    G->>B: Call benefits API
    B-->>G: Permitted benefits
    G-->>C: Tool result
    C->>U: Explain benefits
    end
`;

// One slot per message, in order (26). null = no payload under that message.
export const PAYLOADS = [
  null,
  'POST https://mcp.{{host}}.example/mcp\n(no Authorization header)\ntool: get_my_benefits',
  'HTTP/1.1 401 Unauthorized\nWWW-Authenticate: Bearer\n  resource_metadata="https://mcp.{{host}}.example/\n  .well-known/oauth-protected-resource/mcp"\n  scope="benefits:read"',
  'GET https://mcp.{{host}}.example/\n  .well-known/oauth-protected-resource/mcp\n(RFC 9728 inserts the resource path, here /mcp)',
  json('Protected-resource metadata (RFC 9728)', { resource: 'https://mcp.{{host}}.example/mcp', authorization_servers: ['https://login.{{host}}.example'], scopes_supported: ['benefits:read'], bearer_methods_supported: ['header'] }),
  'GET https://login.{{host}}.example/\n  .well-known/oauth-authorization-server',
  json('Authorization-server metadata (RFC 8414)', { issuer: 'https://login.{{host}}.example', authorization_endpoint: 'https://login.{{host}}.example/oauth/authorize', token_endpoint: 'https://login.{{host}}.example/oauth/token', grant_types_supported: ['authorization_code'], code_challenge_methods_supported: ['S256'], client_id_metadata_document_supported: true, token_endpoint_auth_methods_supported: ['private_key_jwt'] }),
  null,
  'client_id: https://assistant.example/oauth/client.json\nredirect_uri: https://assistant.example/oauth/callback\nscope: benefits:read\nresource: https://mcp.{{host}}.example/mcp\nresponse_type: code; state: <RANDOM_STATE>\ncode_challenge: <S256 of the verifier>; code_challenge_method: S256',
  'GET https://assistant.example/oauth/client.json\nThe identity provider validates the redirect URI and its client acceptance policy',
  json('CIMD client document', { client_id: 'https://assistant.example/oauth/client.json', client_name: 'Example AI assistant', redirect_uris: ['https://assistant.example/oauth/callback'], token_endpoint_auth_method: 'private_key_jwt', jwks_uri: 'https://assistant.example/oauth/jwks.json' }),
  'CONSENT SCREEN (example)\nClient: Example AI assistant | Member: signed-in {{program}} member\nAllow: /members/{me}/benefits (read)\nDownstream: {{brand}} Benefits API | Purpose: current coverage\n[ Deny ]  [ Allow benefits:read ]  (consent id + version persisted)',
  json('Consent record stored on Approve (a Deny issues no code)', { consent_id: 'cns_7f3a', version: 3, member: 'mem_1042', client_id: 'https://assistant.example/oauth/client.json', scope: 'benefits:read', resource: 'https://mcp.{{host}}.example/mcp', granted_at: 'iat' }),
  'HTTP/1.1 302 Found\nLocation: https://assistant.example/oauth/callback?\n  code=<AUTHORIZATION_CODE>&state=<RANDOM_STATE>',
  'GET /oauth/callback?code=<AUTHORIZATION_CODE>&state=<RANDOM_STATE>',
  json('Token request, decoded', { request: { grant_type: 'authorization_code', code: '<AUTHORIZATION_CODE>', redirect_uri: 'https://assistant.example/oauth/callback', resource: 'https://mcp.{{host}}.example/mcp', code_verifier: '<ORIGINAL_PKCE_VERIFIER>', client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer' }, client_assertion: { header: { alg: 'RS256', kid: 'assistant-key-1' }, claims: { iss: 'https://assistant.example/oauth/client.json', sub: 'https://assistant.example/oauth/client.json', aud: 'https://login.{{host}}.example/oauth/token', jti: '<unique id>', exp: 'iat + 60s' } } }),
  'GET https://assistant.example/oauth/jwks.json',
  json('Public JWKS', { keys: [{ kty: 'RSA', kid: 'assistant-key-1', use: 'sig', alg: 'RS256', n: '<PUBLIC_MODULUS>', e: 'AQAB' }] }),
  json('Token response, access token decoded', { response: { token_type: 'Bearer', scope: 'benefits:read', expires_in: 600 }, access_token: { header: { alg: 'RS256', kid: 'idp-key-1', typ: 'at+jwt' }, claims: { iss: 'https://login.{{host}}.example', sub: 'mem_1042', aud: 'https://mcp.{{host}}.example/mcp', client_id: 'https://assistant.example/oauth/client.json', scope: 'benefits:read', jti: '<unique id>', exp: 'iat + 10 min' } }, verified: ['assertion signature', 'code', 'PKCE', 'redirect_uri'] }),
  'POST https://mcp.{{host}}.example/mcp\nAuthorization: Bearer <access_token>\ntool: get_my_benefits | scope: benefits:read\nThe gateway checks signature, issuer, audience, expiry, scope, member and consent; it denies if any fails',
  json('Policy input', { subject: { member: 'mem_1042' }, client: { id: 'https://assistant.example/oauth/client.json' }, action: 'benefits.read', tool: 'get_my_benefits', resource: 'member/mem_1042/benefits', context: { consent_id: 'cns_7f3a', scope: 'benefits:read', risk: 'low' }, rule: 'member owns the target; consent active; no expanded access' }),
  json('Policy decision', { decision: 'Permit', obligations: [], reason: 'member owns target; consent cns_7f3a active', onDeny: 'the gateway does not call the downstream API' }),
  'GET /members/mem_1042/benefits\n(only after a Permit)',
  'Permitted benefits for the signed-in member only',
  json('Tool result', { tool: 'get_my_benefits', content: [{ type: 'text', text: 'Plan: Example PPO. Status: active.' }] }),
  'Example: Your Example PPO coverage is active.',
];

// Reel details per participant.
export const DETAILS = {
  U: 'The member, in an AI assistant session. The browser, not the assistant, sends the authorization request to the identity provider and shows the consent prompt.',
  C: 'The AI client. Identified by a published client metadata document (CIMD, an IETF draft), proves itself with a signed client assertion (private_key_jwt) and PKCE S256. Holds the access token.',
  G: 'Protected resource and enforcement point. Challenges with 401 + resource metadata, validates the token (signature, issuer, audience, expiry, scope, member, consent), asks the policy decision point, and only on Permit calls the benefits API.',
  I: 'OAuth authorization server (OAuth 2.1 profile, an IETF draft) and identity provider. Fetches the client CIMD, authenticates the member, records explicit resource-specific consent, verifies the client assertion against its JWKS and issues an audience-bound access token.',
  Z: 'Policy decision point. Evaluates member, client or agent, tool, target resource, action, entitlements and recorded consent. Consent is necessary where required, but never overrides policy.',
  B: 'Downstream resource. Only reached on a Permit; returns only the authorized member data.',
  O: 'Where the assistant publishes its CIMD (client.json) and public keys (jwks.json). Illustrative host.',
};

// Talk track, one per step: what the presenter says. `first`/`last` are the message indexes the step covers.
export const HOPS = [
  { n: 1, title: 'Protected tool request', first: 0, last: 2, say: 'The member asks the assistant for their benefits. The assistant calls the tool with no token and the gateway answers 401 with a pointer to its metadata.' },
  { n: 2, title: 'Discover the resource', first: 3, last: 4, say: 'The assistant reads the protected-resource metadata: which authorization server to trust and which scope this tool needs. Nobody at {{brand}} is involved.' },
  { n: 3, title: 'Discover the OAuth configuration', first: 5, last: 6, say: 'The authorization-server metadata says how to sign in: endpoints, PKCE, and that the client proves itself with a signed assertion.' },
  { n: 4, title: 'Browser authorization', first: 7, last: 8, say: 'The assistant sends the member to the identity provider. The browser makes the authorization request, so the assistant never sees the member credentials.' },
  { n: 5, title: 'Client metadata lookup (CIMD)', first: 9, last: 10, say: 'The client id is a URL. The identity provider fetches that document to learn the redirect URI and the keys, and checks them against its client acceptance policy.' },
  { n: 6, title: 'Sign-in and consent', first: 11, last: 14, say: 'The member signs in and sees a consent prompt that names the assistant, the data and the purpose. Approve stores a consent record; Deny issues no code.' },
  { n: 7, title: 'Code exchange and client verification', first: 15, last: 17, say: 'The assistant trades the code for a token and proves who it is with a signed assertion. The identity provider checks the signature against the published keys.' },
  { n: 8, title: 'Access token', first: 18, last: 18, say: 'The token is bound to one audience and one scope, and lives minutes. The assistant holds it; it is not a session.' },
  { n: 9, title: 'Gateway validation', first: 19, last: 19, say: 'Every call carries the token. The gateway checks signature, issuer, audience, expiry, scope, member and consent before anything else happens.' },
  { n: 10, title: 'Fine-grained decision', first: 20, last: 21, say: 'The gateway asks the policy decision point whether this member, through this client, may do this action on this resource. A Deny stops the call here.' },
  { n: 11, title: 'Downstream call', first: 22, last: 23, say: 'Only after a Permit does the gateway call the benefits API, which returns only this member\'s data.' },
  { n: 12, title: 'Authorized result', first: 24, last: 25, say: 'The result goes back to the assistant, which explains it to the member. The assistant held its own signing key and a short-lived token, never the member\'s credentials.' },
];
