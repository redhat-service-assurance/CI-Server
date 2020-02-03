#!/bin/bash
set -xe

NAME=${OPERATOR_NAME:-ci-server}
IMAGE_BUILDER=${IMAGE_BUILDER:-podman}
IMAGE_TAG=${IMAGE_TAG:-latest}

OCP_USER=${OCP_USER:-openshift}
OCP_PROJECT=${OCP_PROJECT:-sa-telemetry}
OCP_REGISTRY=${OCP_REGISTRY:-$(oc registry info)}
OCP_REGISTRY_INTERNAL=${OCP_REGISTRY_INTERNAL:-$(oc registry info --internal=true)}
OCP_TAG=${OCP_TAG:-latest}

KUBECONFIG=${KUBECONFIG:-/${HOME}/.kube/config}

if [ "${IMAGE_BUILDER}" = "podman" ]; then
    REG_EXTRAFLAGS="--tls-verify=false"
fi

${IMAGE_BUILDER} tag "${NAME}:${IMAGE_TAG}" "${OCP_REGISTRY}/${OCP_PROJECT}/${NAME}:${OCP_TAG}"
${IMAGE_BUILDER} login ${REG_EXTRAFLAGS} -u "${OCP_USER}" -p "$(oc whoami -t)" "${OCP_REGISTRY}"
${IMAGE_BUILDER} push ${REG_EXTRAFLAGS} "${OCP_REGISTRY}/${OCP_PROJECT}/${NAME}"

oc delete secret kube-config || true
oc create secret generic kube-config --from-file="${KUBECONFIG}"

oc delete deployment ci-server || true
oc create -f <(sed "\
    s|<<image_path>>|${OCP_REGISTRY_INTERNAL}/${OCP_PROJECT}/${NAME}:${OCP_TAG}|g;" \
    deploy-on-k8s.yml)

