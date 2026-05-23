export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/js/firebase.js") {
      const config = {
        apiKey:            env.FIREBASE_API_KEY,
        authDomain:        env.FIREBASE_AUTH_DOMAIN,
        databaseURL:       env.FIREBASE_DATABASE_URL,
        projectId:         env.FIREBASE_PROJECT_ID,
        storageBucket:     env.FIREBASE_STORAGE_BUCKET,
        messagingSenderId: env.FIREBASE_MESSAGING_SENDER_ID,
        appId:             env.FIREBASE_APP_ID,
      };
      return new Response(
        `export const FIREBASE_CONFIG = ${JSON.stringify(config)};`,
        { headers: { "Content-Type": "application/javascript; charset=utf-8" } }
      );
    }

    return env.ASSETS.fetch(request);
  },
};
