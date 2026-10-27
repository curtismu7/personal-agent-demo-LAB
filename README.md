# Personal Agent Flow

**Tier: Demo.** How an AI assistant (the member's own agent) reaches a member's benefits through an MCP gateway, in twelve steps: protected tool request, resource metadata, OAuth configuration, browser authorization, client metadata lookup (CIMD), sign-in and consent, signed code exchange, access token, gateway validation, fine-grained policy decision, downstream call and authorized result. The walkthrough is a React Flow sequence diagram with a decoded payload or mock token JSON under each message.

It also has a **held request**: the policy engine answers "approval required" and a modal (simulated) lets the member approve or decline, so the audience cannot miss the human step.

Mock only. Every host ends in `.example`, every token is a labelled teaching value, and the app makes no outbound network request (a netguard blocks them and tests prove it). It needs no tenant and no credentials. The architecture is illustrative, not a claim of any production deployment.

The **Pattern** tab (`/#pattern`) shows the Personal Agent Pattern: the actors and the three Ping Agentic Control Plane lanes (Agent IAM Core, Agent Privilege, Agent Authorize) as a draggable React Flow diagram with Simulate, speed control and Reset.

Related: `agent-mcp-door-demo` tells the catalog-to-audit story (publish, register, per-call exchange, approval, audit). This app is the twelve-step sign-in and policy-decision flow. This repo started from that app's scaffold (same server, doctor, k8s and diagram components) with its own story data.

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
- Hosted SE build (rule 18): the same image with `MODE=mock` and `PAGENT_HOSTED=1` (banner says "Hosted simulation"). `k8s/` has the Deployment, Service, Ingress and `deploy.sh`; the first deploy is owner-approved and has **not** happened (`OWNER_APPROVED=1 IMAGE=<registry>/personal-agent-demo:<tag> SE_HOST=<host> INGRESS_CLASS=<class> CLUSTER_ISSUER=<issuer> k8s/deploy.sh [--dry-run]`).
- Learning Hub: `content-pack.json` (`demo-content-pack/1`, built by `npm run content-pack` from the same story data). Cards open a step with `/#hop-3`. Catalog id D21.
- **Inherited rulings, to confirm for this app:** the sibling app's owner rulings (2026-10-24) were rule 13 N/A (no server state) and rule 5 accepted (a sequence diagram's participants stay on their lifelines, no movable boxes; Simulate, speed, Reset and the reel exist). Both are carried over here unconfirmed.
- **Open, not built:** rule 10 (three vertical packs), rule 14 (W3C `traceparent` on every hop) and rule 17 (diagrams loaded from diagram-studio data). The approval modal is client-side only (no mock phone, no server state).
- Hardening inherited from the sibling's review: errors are short JSON, only `.example` and `.invalid` hosts are reserved, a customer value that names a URL, host or address keeps the default.
