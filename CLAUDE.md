# personal-agent-demo

Demo-tier standalone app (D21): a React Flow sequence diagram of an AI assistant reaching member benefits through an MCP gateway in twelve steps, with decoded mock token JSON and a simulated held-request approval modal. Mock only.

- Run: `./scripts/run.sh` (http://localhost:6900). Test: `npm test` (server is `node --test test/*.test.js`, a glob). Preflight: `npm run doctor`.
- Story data is `server/src/flowData.js` with `{{brand}}`, `{{program}}`, `{{host}}` tokens; `flow.js` fills them from `customer.config.json`. A test fails on an unfilled token, a non-`.example` host or a name from the forbidden list.
- Diagram files in `web/src/components`, `hooks`, `utils` come from the sibling agent-mcp-door-demo scaffold (itself copied from AI-DEMO2). Never import across repos; re-copy to update.
- The approval modal (`ApprovalModal.jsx`) is client-side only: no server state, no phone.
- Rules that bite: loopback bind only; same-origin writes; zero outbound network (netguard); no customer, tenant or product-owner names or ids; ports 6900-6909; show tokens raw (education) but never a real credential.
- Open: rules 10, 14, 17; hosted SE deploy needs owner approval.
