#!/bin/bash
set -e

required=(
  FIREBASE_API_KEY
  FIREBASE_AUTH_DOMAIN
  FIREBASE_DATABASE_URL
  FIREBASE_PROJECT_ID
  FIREBASE_STORAGE_BUCKET
  FIREBASE_MESSAGING_SENDER_ID
  FIREBASE_APP_ID
)

for var in "${required[@]}"; do
  if [ -z "${!var}" ]; then
    echo "ERROR: variable de entorno '$var' no está definida" >&2
    exit 1
  fi
done

cat > js/firebase.js << EOF
export const FIREBASE_CONFIG = {
  apiKey:            "${FIREBASE_API_KEY}",
  authDomain:        "${FIREBASE_AUTH_DOMAIN}",
  databaseURL:       "${FIREBASE_DATABASE_URL}",
  projectId:         "${FIREBASE_PROJECT_ID}",
  storageBucket:     "${FIREBASE_STORAGE_BUCKET}",
  messagingSenderId: "${FIREBASE_MESSAGING_SENDER_ID}",
  appId:             "${FIREBASE_APP_ID}"
};
EOF

echo "js/firebase.js generado correctamente"

# Inject build version into service worker for cache invalidation
BUILD_VERSION=$(git rev-parse --short HEAD 2>/dev/null || date +%s)
sed -i "s/'BUILD_VERSION'/'${BUILD_VERSION}'/g" sw.js
echo "sw.js versionado como ${BUILD_VERSION}"
