#!/bin/bash
set -euo pipefail
node scripts/generate-version.mjs
bun build src/index.tsx --outdir dist --target bun
