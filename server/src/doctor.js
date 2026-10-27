// Preflight checks shared by `npm run doctor` and GET /api/health. Never prints a secret, needs no network.
// Each check: { id, level: 'pass' | 'info' | 'fail', detail }.
import { assertBindAllowed, bindHost, portProblem, scanHosts, scanKeys, DEFAULT_PORT, PORT_MIN, PORT_MAX } from './safety.js';
import { netguardSelfTest } from './netguard.js';
import { DEFAULT_CAST, buildFlow, messageCount, rawStory, unfilled } from './flow.js';
import { modeFrom } from './config.js';

export async function runChecks({ env = process.env, cast = DEFAULT_CAST } = {}) {
  const checks = [];
  const add = (id, level, detail) => checks.push({ id, level, detail });

  const major = Number(process.versions.node.split('.')[0]);
  add('node', major >= 20 ? 'pass' : 'fail', `v${process.versions.node} (need >= 20)`);

  try { add('mode', 'pass', `MODE=${modeFrom(env)} (the only mode this app has${env.PAGENT_HOSTED === '1' ? '; hosted build' : ''})`); }
  catch (e) { add('mode', 'fail', e.message); }

  try { add('bind', 'pass', `${assertBindAllowed(bindHost(env), env)}${env.PAGENT_BIND ? ' (PAGENT_BIND opt-in)' : ' (loopback)'}`); }
  catch (e) { add('bind', 'fail', e.message); }

  const port = env.PORT === undefined || env.PORT === '' ? DEFAULT_PORT : Number(env.PORT);
  const problem = portProblem(port);
  add('port-range', problem ? 'fail' : 'pass', problem || `${port} is inside ${PORT_MIN}-${PORT_MAX} and not reserved`);

  const raw = rawStory();
  const n = messageCount(raw.source);
  add('story-shape', raw.payloads.length === n ? 'pass' : 'fail', `${n} messages, ${raw.payloads.length} payload slots`);
  const missing = ['U', 'C', 'G', 'I', 'Z', 'B', 'O'].filter((id) => !raw.details[id]);
  add('story-details', missing.length ? 'fail' : 'pass', missing.length ? `no reel details for: ${missing.join(', ')}` : 'every participant has reel details');
  const text = [raw.source, ...raw.payloads.filter(Boolean), ...Object.values(raw.details), ...raw.hops.map((h) => h.say)].join('\n');
  const holes = unfilled(text, DEFAULT_CAST);
  add('story-tokens', holes.length ? 'fail' : 'pass', holes.length ? `unfilled {{tokens}}: ${[...new Set(holes)].join(', ')}` : 'every {{cast}} token is filled');

  const filled = JSON.stringify(buildFlow(cast));
  const hosts = scanHosts(filled);
  add('story-hosts', hosts.length ? 'fail' : 'pass', hosts.length ? `non-reserved hosts: ${hosts.join(', ')}` : 'every host in the story is .invalid or .example');
  const keys = scanKeys(filled);
  add('story-keys', keys.length ? 'fail' : 'pass', keys.length ? 'key-looking values that are not sk-MOCK-' : 'no key-looking values in the story');

  const ng = await netguardSelfTest();
  add('netguard', ng.ok ? 'pass' : 'fail', ng.ok ? `blocked fetch, socket, socket-by-IP, dns lookup, dns resolve and udp to a non-loopback host (${ng.blocked}/6)` : ng.detail);

  add('tenant', 'pass', 'mock only: no tenant, no credentials, no outbound network');
  return checks;
}

export const allPassed = (checks) => checks.every((c) => c.level !== 'fail');
