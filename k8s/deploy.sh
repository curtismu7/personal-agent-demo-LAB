#!/usr/bin/env bash
# Deploy the MOCK-ONLY build to the SE cluster. The first deploy of each app is OWNER-APPROVED: this script refuses to
# run unless OWNER_APPROVED=1 is set by the owner. It never builds or pushes an image; it applies manifests for an image
# that already exists in the registry.
#
#   OWNER_APPROVED=1 IMAGE=<registry>/<repo>/personal-agent-demo:<sha> SE_HOST=<host> INGRESS_CLASS=<class> CLUSTER_ISSUER=<issuer> k8s/deploy.sh [--dry-run]
#
# SE_HOST is a name two labels below the cluster's wildcard (for example personal-agent.<cluster-host>): the cluster's external-dns creates
# its DNS record from the ingress, and cert-manager issues its certificate through CLUSTER_ISSUER. Both can take a few minutes.
#
# After the deploy (not done by this script): verify by CONTENT, not 200 (GET /api/info must say {mode:mock, simulated:true, hosted:true}),
# check the registry manifest and the pod's imageID match IMAGE, and hand over the full https:// URL after browser proof.
set -euo pipefail
cd "$(dirname "$0")"

[ "${OWNER_APPROVED:-}" = "1" ] || { echo "refusing: the first SE deploy of each app is owner-approved (set OWNER_APPROVED=1)" >&2; exit 2; }
for v in IMAGE SE_HOST INGRESS_CLASS CLUSTER_ISSUER; do [ -n "${!v:-}" ] || { echo "refusing: set $v (see the usage line)" >&2; exit 2; }; done
case "$IMAGE" in
  *:latest|*:HEAD|*:|*[!A-Za-z0-9._:/@-]*|"") echo "refusing: IMAGE must carry an explicit immutable tag or digest, not latest/HEAD" >&2; exit 2;;
  *:*) ;;
  *) echo "refusing: IMAGE has no tag" >&2; exit 2;;
esac
case "$SE_HOST" in *[!a-z0-9.-]*|"") echo "refusing: SE_HOST must be a plain host name" >&2; exit 2;; esac
for v in INGRESS_CLASS CLUSTER_ISSUER; do case "${!v}" in *[!a-z0-9.-]*|"") echo "refusing: $v must be a plain name" >&2; exit 2;; esac; done

render() { IMAGE="$IMAGE" SE_HOST="$SE_HOST" INGRESS_CLASS="$INGRESS_CLASS" CLUSTER_ISSUER="$CLUSTER_ISSUER" envsubst '${IMAGE} ${SE_HOST} ${INGRESS_CLASS} ${CLUSTER_ISSUER}' < "$1"; echo '---'; }
if [ "${1:-}" = "--dry-run" ]; then render deployment.yaml; render service.yaml; render certificate.yaml; render ingress.yaml; exit 0; fi
for f in deployment.yaml service.yaml certificate.yaml ingress.yaml; do render "$f" | kubectl apply -f -; done
kubectl rollout status deployment/personal-agent-demo --timeout=120s
# The certificate is issued by cert-manager (DNS-01), which can take a few minutes; the pod is already serving.
kubectl wait certificate/personal-agent-demo --for=condition=Ready --timeout=600s || echo "certificate not Ready yet: check 'kubectl describe certificate personal-agent-demo'" >&2
