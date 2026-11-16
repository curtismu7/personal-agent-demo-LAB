# Changelog

## 0.1.0 (unreleased)
- Verification mark in the header: the shared `VerifyMark` (vendored from AI-DEMO-Standalone `shared/verify-mark`, byte for byte, pinned) shows this lab's Verified / In progress mark from the demo shelf, beside the Shelf link inside the top menu. It reads the same `GET /api/shelf` call the Shelf link makes, so it shows through the lab-proxy (where that call reaches the shelf) and nothing when the lab is opened on its own port, when the shelf has no mark for it, or when the shelf is unreachable.
- PingOne Protect added to step 6 (sign-in, risk evaluation and consent): new participant "Risk engine PingOne Protect" and two messages (risk evaluation with browser signals, risk level back), so the story is now 28 messages and 8 participants; still twelve steps. The evaluation is a stub with fixed values; the AI-agent-type detection claim is labelled UNVERIFIED. Learning Hub pack gains a Protect glossary term.
- First slice, scaffolded from agent-mcp-door-demo: twelve-step AI-assistant-to-gateway sequence (26 messages, 7 participants) with decoded mock token JSON, simulated held-request approval modal, talk track, presenter mode, Reset, doctor, content pack, k8s manifests (not deployed).
- Ports 6900-6909.
