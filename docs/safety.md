# Safety

- Loopback bind only (`PAGENT_BIND` is the explicit opt-in the container uses); the compose file publishes `127.0.0.1` only (a test pins it).
- Host header must be a loopback name; writes must be same-origin.
- Netguard blocks every outbound connection (fetch, socket, DNS, UDP) with a self-test, and a test asserts zero attempts.
- The approval modal is simulated and client-side only: no push, no request, no state.
- Story text is data; hosts end in `.example`; no key-looking values; tokens are labelled "MOCK: teaching values only". The web renders story text as text, never as markup.
- No tenant, credential or customer identifier ships. `customer.config.json` only sets three display strings and is git-ignored.
