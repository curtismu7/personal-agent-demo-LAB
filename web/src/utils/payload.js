import { parseJsonText } from "../components/JsonPane.jsx";

// The keys that matter in THIS lab's payloads, stood out in both views of every JSON pane (the defaults sub, aud, scope, client_id, iss,
// grant_type, access_token ... and the alert keys decision, reason ... are already marked by the shared pane).
export const HOT_KEYS = ["tool", "resource", "consent_id", "client_assertion", "agent_detection", "verified", "onDeny", "onHigh"];

// A story payload is wire text ("POST https://...", an HTTP status line), or a title line followed by a JSON body ("Policy decision (MOCK ...)\n{...}").
// Returns { title, json }: json is the body as the exact text given (the pane shows it untouched) when it parses as an object or array, else null.
export function splitPayload(payload) {
  if (typeof payload !== "string") return { title: "", json: null };
  const nl = payload.indexOf("\n");
  if (nl > 0 && parseJsonText(payload.slice(nl + 1)) !== undefined) return { title: payload.slice(0, nl).trim(), json: payload.slice(nl + 1) };
  if (parseJsonText(payload) !== undefined) return { title: "", json: payload };
  return { title: "", json: null };
}
