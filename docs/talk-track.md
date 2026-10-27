# Talk track

Start on the **Pattern** tab (also `/#pattern`): User, Personal Agent, LLM, the Privilege AI Gateway, MCP, API GW and the resource, with the three control-plane lanes above them. Press Simulate to walk ten arrows: the user authenticates through Agent IAM Core, the optional token exchange gives a token for the MCP server, Agent Privilege decides at tool level, and Agent Authorize applies the business rules. Boxes are draggable; Reset restores them. Then switch to **12 steps** for the detailed sign-in and policy flow below.

Twelve steps, one sentence of intent each. The app shows the same text in the talk-track panel.

1. **Protected tool request.** The member asks the assistant for their benefits; the call has no token and the gateway answers 401 with a pointer to its metadata.
2. **Discover the resource.** The protected-resource metadata names the authorization server and the scope. Nobody at the company is involved.
3. **Discover the OAuth configuration.** The authorization-server metadata says how to sign in: endpoints, PKCE, signed client assertion.
4. **Browser authorization.** The browser, not the assistant, makes the authorization request, so the assistant never sees the member credentials.
5. **Client metadata lookup (CIMD).** The client id is a URL; the identity provider fetches that document for the redirect URI and the keys.
6. **Sign-in and consent.** The consent prompt names the assistant, the data and the purpose. Approve stores a record; Deny issues no code.
7. **Code exchange and client verification.** The assistant proves who it is with a signed assertion, checked against its published keys.
8. **Access token.** One audience, one scope, minutes to live.
9. **Gateway validation.** Signature, issuer, audience, expiry, scope, member and consent are checked before anything else.
10. **Fine-grained decision.** The policy decision point answers Permit or Deny for this member, client, action and resource. Use the **Try a held request** button to show the approval-required variant.
11. **Downstream call.** Only after a Permit does the gateway call the benefits API.
12. **Authorized result.** The assistant explains the result; it never held a standing credential.
