// Rule 18 (mock-only SE build): the manifests keep their safety properties. Text checks, no cluster, no yaml dependency.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { test } from 'node:test';

const read = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const dep = read('k8s/deployment.yaml');
const run = (env) => spawnSync('bash', ['k8s/deploy.sh', '--dry-run'], { cwd: new URL('..', import.meta.url).pathname, env: { PATH: process.env.PATH, ...env }, encoding: 'utf8' });

test('the deployment is mock-only, hosted, non-root, read-only, limited and probed on /api/health', () => {
  for (const re of [/name: MODE, value: mock/, /PAGENT_HOSTED, value: "1"/, /name: PAGENT_PUBLIC_HOST, value: \$\{SE_HOST\}/, /runAsNonRoot: true/, /readOnlyRootFilesystem: true/, /allowPrivilegeEscalation: false/, /drop: \["ALL"\]/,
    /limits: \{ cpu: 500m, memory: 256Mi \}/, /automountServiceAccountToken: false/, /seccompProfile/]) assert.match(dep, re);
  assert.equal((dep.match(/path: \/api\/health/g) || []).length, 2, 'readiness and liveness');
  assert.match(dep, /replicas: 1/);
  assert.doesNotMatch(dep, /image: \S*:(latest|HEAD)\b/);
  assert.doesNotMatch(dep, /MODE, value: (live|prod)/i);
});

test('no secret, tenant id, credential or real host sits in the manifests', () => {
  for (const f of ['k8s/deployment.yaml', 'k8s/service.yaml', 'k8s/ingress.yaml', 'k8s/certificate.yaml', 'k8s/deploy.sh']) {
    const t = read(f);
    assert.doesNotMatch(t, /secretKeyRef|kind: Secret|password|(^|\s)token:|apiKey|ping-devops|ghcr\.io\/[a-z]/i, f);
  }
  assert.match(read('k8s/ingress.yaml'), /host: \$\{SE_HOST\}/, 'the host is supplied, never defaulted');
  assert.match(read('k8s/ingress.yaml'), /ingressClassName: \$\{INGRESS_CLASS\}/, 'the ingress class is supplied, never defaulted');
  assert.match(read('k8s/certificate.yaml'), /name: \$\{CLUSTER_ISSUER\}/, 'the issuer is supplied, never defaulted');
});

test('the public ingress terminates TLS on its own host, is rate limited, and rewrites Host to loopback', () => {
  const ing = read('k8s/ingress.yaml');
  for (const re of [/tls:/, /secretName: personal-agent-demo-tls/, /limit-rps/, /limit-connections/, /proxy-body-size/, /ssl-redirect: "true"/, /upstream-vhost: "127\.0\.0\.1:6900"/]) assert.match(ing, re);
  const cert = read('k8s/certificate.yaml');
  assert.match(cert, /kind: Certificate/);
  assert.match(cert, /secretName: personal-agent-demo-tls/);
  assert.match(cert, /- \$\{SE_HOST\}/);
});

test('the Dockerfile has one image for both forms: MODE defaults to mock, no fork', () => {
  const d = read('Dockerfile');
  assert.match(d, /ENV[^\n]*MODE=mock/);
  assert.equal((d.match(/^FROM /gm) || []).length, 2, 'the same two stages as standalone');
  assert.match(d, /USER node/);
});

test('deploy.sh refuses without owner approval, without an immutable tag, and with a bad host', { skip: spawnSync('which', ['envsubst']).status !== 0 && 'envsubst not installed' }, () => {
  const ok = { OWNER_APPROVED: '1', IMAGE: 'registry.example/team/personal-agent-demo:abc1234', SE_HOST: 'door.demo.example', INGRESS_CLASS: 'class-x', CLUSTER_ISSUER: 'issuer-x' };
  assert.equal(run({}).status, 2, 'no approval');
  for (const IMAGE of ['registry.example/x:latest', 'registry.example/x:HEAD', 'registry.example/x', 'registry.example/x:', 'reg;rm/x:1']) assert.equal(run({ ...ok, IMAGE }).status, 2, IMAGE);
  assert.equal(run({ ...ok, SE_HOST: 'Bad Host' }).status, 2);
  for (const k of ['INGRESS_CLASS', 'CLUSTER_ISSUER']) {
    const { [k]: _omit, ...rest } = ok;
    assert.equal(run(rest).status, 2, `${k} required`);
    assert.equal(run({ ...ok, [k]: 'Bad Name;x' }).status, 2, `${k} validated`);
  }
  assert.equal(run({ ...ok, OWNER_APPROVED: '0' }).status, 2);
  const r = run(ok);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /image: registry\.example\/team\/personal-agent-demo:abc1234/);
  assert.match(r.stdout, /host: door\.demo\.example/);
  assert.match(r.stdout, /kind: Certificate/);
  assert.match(r.stdout, /ingressClassName: class-x/);
  assert.match(r.stdout, /name: issuer-x/);
  assert.doesNotMatch(r.stdout, /\$\{(IMAGE|SE_HOST|INGRESS_CLASS|CLUSTER_ISSUER)\}/);
});
