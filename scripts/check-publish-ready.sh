#!/usr/bin/env bash
# Fails while a "TODO before publishing" marker is left anywhere in the repository.
# CI runs it, so the repository cannot go green until every marker is resolved.
set -euo pipefail
cd "$(dirname "$0")/.."
if grep -rn --exclude-dir=node_modules --exclude-dir=.git --exclude=check-publish-ready.sh \
  "TODO before publishing" . ; then
  echo "Resolve the markers above before this repository goes public."
  exit 1
fi
echo "No marker left: ready to publish."
