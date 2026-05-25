#!/bin/bash
set -e

if [ -z "${FIREBASE_API_KEY}" ]; then
  # Preview/CI build sin credenciales: placeholder para que el build no falle
  cat > js/firebase.js << 'EOF'
export const FIREBASE_CONFIG = {};
EOF
  echo "js/firebase.js: placeholder (build de preview sin credenciales)"
else
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
fi

# Inject build version into service worker for cache invalidation
BUILD_VERSION=$(git rev-parse --short HEAD 2>/dev/null || date +%s)
sed -i "s/'BUILD_VERSION'/'${BUILD_VERSION}'/g" sw.js
echo "sw.js versionado como ${BUILD_VERSION}"
