# Personal Agent Flow LAB

Repo: https://github.com/curtismu7/personal-agent-demo-LAB

Tier: Demo

**Tier: Demo.** How an AI assistant (the member's own agent) reaches a member's benefits through an MCP gateway, in twelve steps: protected tool request, resource metadata, OAuth configuration, browser authorization, client metadata lookup (CIMD), sign-in and consent, signed code exchange, access token, gateway validation, fine-grained policy decision, downstream call and authorized result. The walkthrough is a React Flow sequence diagram with a decoded payload or mock token JSON under each message.

It also has a **held request**: the policy engine answers "approval required" and a modal (simulated) lets the member approve or decline, so the audience cannot miss the human step.

Mock only. Every host ends in `.example`, every token is a labelled teaching value, and the app makes no outbound network request (a netguard blocks them and tests prove it). It needs no tenant and no credentials. The architecture is illustrative, not a claim of any production deployment.

The **Pattern** tab (`/#pattern`) shows the Personal Agent Pattern: the actors and the three Ping Agentic Control Plane lanes (Agent IAM Core, Agent Privilege, Agent Authorize), with a switch between Agent Privilege and Agent Gateway (IG) as the MCP gateway, as a draggable React Flow diagram with Simulate, speed control and Reset.

Related: `agent-mcp-door-demo` tells the catalog-to-audit story (publish, register, per-call exchange, approval, audit). This app is the twelve-step sign-in and policy-decision flow. This repo started from that app's scaffold (same server, doctor, k8s and diagram components) with its own story data.

## Run from a clone

Prerequisites: Node 26. Docker (OrbStack) only for the Docker form.

```
git clone https://github.com/curtismu7/personal-agent-demo-LAB.git
cd personal-agent-demo-LAB
npm ci
npm run build
npm run doctor
npm start
```

## Ports, and what to do if the port is taken

```
Ports: personal-agent-demo-LAB listens on 6900 (set with PORT, default 6900).
Port range for this app: 6900-6909.

If the port is taken:
1. Find what is using it:
   lsof -iTCP:6900 -sTCP:LISTEN -n -P
2. If it is an old copy of this app, stop that process: kill <PID>.
3. If it is something else, stop it, or start this app on another port:
   PORT=<other port> npm start
```

Other variable: `HOST_PORT=6900` (Docker host port). Keep both inside 6900-6909.

## Run

```
./scripts/run.sh          # installs, builds, runs the doctor, starts; then open http://localhost:6900/
```

or, step by step: `npm ci && npm run build && npm run doctor && npm start`. With Docker (OrbStack): `HOST_PORT=6900 docker compose up --build -d` (published on `127.0.0.1` only).

| Command | What it does |
| --- | --- |
| `npm test` | server (node:test), web (vitest) and repo checks |
| `npm run doctor` | preflight: node, bind, port, story shape, hosts, keys, netguard, port free |
| `npm run content-pack` | rebuilds and validates `content-pack.json` |
| `npm run reset` | confirms a reset on a running server (the walkthrough itself lives in the browser) |

Port range 6900-6909 (default 6900). `GET /api/health` answers `demo-health/1`.

## Using it

- **Talk track:** pick a step to jump to it; the panel shows what to say. **Simulate** (step bar) walks the 26 arrows; **Step time** sets the speed; the **movie reel** jumps to any message.
- **Held request:** the header button opens the approval modal (Approve or Decline, Esc closes).
- **Presenter:** the Presenter button (or `P`) hides the intro and enlarges the talk track. `→` next, `←` back, `Esc` leaves. The simulation banner stays.
- **Reset demo:** stops the walkthrough and refits the diagram.
- **Branding:** copy `customer.config.example.json` to `customer.config.json` and edit the three cast values. It is git-ignored and read on every request.

## Notes

- The text carries no customer or product-owner names. The flow follows an illustrative "AI assistant accesses member benefits" workflow supplied by the owner; hosts, ids and tokens are teaching values.
- Hosted SE build (rule 18): the same image with `MODE=mock` and `PAGENT_HOSTED=1` (banner says "Hosted simulation"). Deployed 2026-10-27 (owner-approved; host recorded in the owner notes), verified by content (`GET /api/info` = `{mode: mock, simulated: true, hosted: true}`), pod imageID = registry digest. `k8s/` has the Deployment, Service, Certificate, Ingress and `deploy.sh` (`OWNER_APPROVED=1 NAMESPACE=<ns> IMAGE=<registry>/personal-agent-demo:<sha> SE_HOST=<host> INGRESS_CLASS=<class> CLUSTER_ISSUER=<issuer> k8s/deploy.sh [--dry-run]`; manifests use `__IMAGE__`, `__SE_HOST__`, `__INGRESS_CLASS__`, `__CLUSTER_ISSUER__`).
- Learning Hub: `content-pack.json` (`demo-content-pack/1`, built by `npm run content-pack` from the same story data). Cards open a step with `/#hop-3`. Catalog id D21.
- **Inherited rulings, to confirm for this app:** the sibling app's owner rulings (2026-10-24) were rule 13 N/A (no server state) and rule 5 accepted (a sequence diagram's participants stay on their lifelines, no movable boxes; Simulate, speed, Reset and the reel exist). Both are carried over here unconfirmed.
- **Sources and status of claims (rule 2):** CIMD (client ID metadata documents) and the OAuth 2.1 profile are IETF drafts, not RFCs. RFC 9728, RFC 8414, RFC 7636 (PKCE) and private_key_jwt (RFC 7523 / OIDC) are standards. Product names (PingOne Authorize, Agent Privilege, Agent Gateway) and the approval-receipt behaviour are illustrative: UNVERIFIED against a Ping source here.
- **Rule 13 (workspace id):** implemented. The held-request decision is the only server state and is kept per workspace: each browser tab sends its own `X-Workspace` id (default `default`, `^[a-z0-9-]{1,40}$`, anything else is a 400), the store is bounded (500 workspaces, 1 hour), and Reset clears only that workspace. The walkthrough itself lives in the browser. Tests prove one workspace's Approve or Reset never touches another's.
- **Rule 17 (diagram-studio data):** the Pattern diagrams are `diagram-studio/1` data files (`server/diagrams/`), checked at start-up with a copy of the studio's own validator (`server/src/diagramStudioValidate.js`) and loaded by name; no nodes or edges are built in code. A step may carry an extra `payload` field (mock token JSON) that the studio ignores. The 12-step sequence diagram is NOT studio data (the studio has no sequence-diagram viewer), so rule 17 is only partly met.
- **Open, not built:** rule 10 (three vertical packs), rule 14 (W3C `traceparent` on every hop) and The approval modal has no mock phone (it is a simulated in-page approval whose decision is kept per workspace on the server).
- Hardening inherited from the sibling's review: errors are short JSON, only `.example` and `.invalid` hosts are reserved, a customer value that names a URL, host or address keeps the default.
