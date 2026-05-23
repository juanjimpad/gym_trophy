# 🏆 Gym Trophy

[![License: Non-Commercial](https://img.shields.io/badge/License-Non--Commercial-orange.svg)](./LICENSE)
[![Built with Claude](https://img.shields.io/badge/Built%20with-Claude%20AI-blueviolet?logo=anthropic)](https://claude.ai)
[![Ko-fi](https://img.shields.io/badge/Support-Ko--fi-FF5E5B?logo=ko-fi&logoColor=white)](https://ko-fi.com/juanjimpad)

Aplicación web para la gestión de entrenamientos de fuerza. Diseñada para entrenadores personales que quieren llevar el control de pesos, series, repeticiones y retos grupales de sus clientes en tiempo real.

**Demo:** [gym-trophy.com](https://gym-trophy.com)

---

## Características

### Pesos · Series · Reps
- Ranking por ejercicio con la mejor marca histórica de cada cliente (👑)
- Leaderboard con medallas (🥇🥈🥉) separado en **Top 3 hombres / Top 3 mujeres / Resto / Sin marca**
- Desempate por edad (mayor edad primero) y por fecha de registro del peso
- Buscador en tiempo real sobre el ranking para ir directo al cliente
- Soporte para ejercicios de **peso corporal** (weight = 0): se muestran como "Peso corporal" en el ranking
- Historial de sesiones por ejercicio con gráfica de evolución del peso

### Retos grupales
- Desafíos de repeticiones, calorías o tiempo con fecha de inicio y fin
- Ranking en tiempo real con la misma lógica de agrupación y desempate que los pesos
- Buscador de clientes en el ranking del reto
- Badge de estado: Pendiente · Activo · Finalizado
- El reto queda inactivo pasada la fecha de fin

### Clientes
- Vista a pantalla completa con búsqueda en tiempo real
- Cada cliente muestra sexo (♂/♀) y edad calculada automáticamente
- Añadir, editar y eliminar clientes con nombre, sexo y fecha de nacimiento
- Acceso directo a la sesión de cualquier cliente desde la lista

### Sesiones
- Registro de peso, series y repeticiones por ejercicio
- Navegación inteligente al guardar: vuelve al ranking del ejercicio, a la lista de clientes o al inicio según el origen de la sesión
- Historial por ejercicio con opción de eliminar sesiones individuales

### General
- **Soporte multiidioma (ES / EN)** — interfaz automática según el idioma del navegador
- **PWA con soporte offline** — Service Worker que cachea los recursos estáticos tras la primera carga
- **Sincronización en la nube** — Firebase Realtime Database; los cambios se reflejan en tiempo real en todos los dispositivos
- **Dark mode** — Selector ☀️🌙✨ en el pie de página; guarda la preferencia entre sesiones
- **Acceso seguro** — Login con correo/contraseña o cuenta de Google. Cada usuario tiene sus datos completamente aislados
- **Ejercicios personalizados** — Añade ejercicios propios que se aplican automáticamente a todos los clientes

---

## Tecnologías

- HTML · CSS · JavaScript (ES Modules, sin frameworks ni bundler)
- [Firebase Realtime Database](https://firebase.google.com/products/realtime-database) — persistencia y sincronización en tiempo real
- [Firebase Authentication](https://firebase.google.com/products/auth) — acceso seguro con email/contraseña y Google Sign-In
- [Chart.js](https://www.chartjs.org/) — gráficas de evolución por ejercicio
- Alojado en [Cloudflare Pages](https://pages.cloudflare.com/) con `build.sh` que inyecta las credenciales desde env vars

---

## Estructura del proyecto

```
gym_trophy/
├── index.html
├── sw.js                  # Service Worker — caché offline y versionado de assets
├── favicon.ico
├── build.sh               # Genera js/firebase.js desde env vars (Cloudflare Pages)
├── wrangler.json          # Configuración de Cloudflare Pages
├── .dev.vars.example      # Plantilla de variables de entorno para desarrollo local
├── css/
│   └── style.css
└── js/
    ├── app.js             # Punto de entrada, Firebase init, event delegation
    ├── config.js          # Ejercicios base, bandas, duraciones y constantes
    ├── firebase.js        # Credenciales Firebase (gitignoreado — generado en build)
    ├── i18n.js            # Módulo de internacionalización
    ├── locales/
    │   ├── es.js          # Cadenas en español
    │   └── en.js          # Cadenas en inglés
    ├── state.js           # Estado global mutable
    ├── theme.js           # Lógica de tema (claro/oscuro/auto) y persistencia
    ├── utils.js           # Funciones puras: rankings, fechas, edad, agrupación
    ├── db.js              # Operaciones de escritura a Firebase
    └── render.js          # Todas las vistas (renderizado sin framework)
```

---

## Diseño de la base de datos

Los datos se almacenan bajo `users/{uid}/` para aislar completamente cada entrenador.

### clients

| Campo | Tipo | Descripción |
|---|---|---|
| `name` | string | Nombre completo del cliente |
| `sex` | `"male"` · `"female"` · null | Sexo (opcional) |
| `birthDate` | string `YYYY-MM-DD` · null | Fecha de nacimiento (opcional) |

**clients → exercises** *(un registro por ejercicio)*

| Campo | Tipo | Descripción |
|---|---|---|
| `name` | string | Nombre del ejercicio |
| `weight` | number | Peso en kg (0 = peso corporal) |
| `reps` | number | Repeticiones de la última sesión |
| `sets` | number | Series de la última sesión |
| `band` | string · null | Solo Chin ups: color de banda de asistencia |

**clients → history → \<exKey\> → \<YYYYMMDD\>** *(una entrada por día y ejercicio)*

| Campo | Tipo | Descripción |
|---|---|---|
| `ts` | number | Timestamp Unix en ms |
| `weight` | number | Peso registrado ese día |
| `reps` | number | Repeticiones registradas ese día |
| `sets` | number | Series registradas ese día |
| `band` | string · null | Solo Chin ups |

---

### customExercises

| Campo | Tipo | Descripción |
|---|---|---|
| `name` | string | Nombre del ejercicio personalizado |
| `custom` | boolean | Siempre `true` |

---

### challenges

| Campo | Tipo | Descripción |
|---|---|---|
| `name` | string | Nombre del reto |
| `exerciseName` | string · null | Ejercicio asociado (opcional) |
| `metric` | `"reps"` · `"cal"` · `"time"` | Tipo de métrica |
| `duration` | number · null | Duración en segundos (opcional) |
| `startDate` | string `YYYY-MM-DD` · null | Fecha de inicio (opcional) |
| `endDate` | string `YYYY-MM-DD` · null | Fecha de fin (opcional) |
| `createdAt` | number | Timestamp de creación |
| `finished` | boolean | `true` si el reto fue cerrado manualmente |

**challenges → results** *(un resultado por cliente)*

| Campo | Tipo | Descripción |
|---|---|---|
| `value` | number | Resultado: reps, kcal o segundos |
| `ts` | number | Timestamp del registro |

---

## Reglas de Firebase Realtime Database

```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read":  "auth != null && auth.uid === $uid",
        ".write": "auth != null && auth.uid === $uid"
      }
    }
  }
}
```

Cada usuario solo puede leer y escribir sus propios datos. El resto de la base de datos es completamente inaccesible.

---

## Despliegue

### 1. Clona el repositorio

```bash
git clone https://github.com/juanjimpad/gym_trophy.git
cd gym-trophy/gym_trophy
```

### 2. Configura Firebase

1. Crea un proyecto en [Firebase Console](https://console.firebase.google.com)
2. Activa **Realtime Database** (modo Europa) y **Authentication → Email/Password** y/o **Google**
3. Aplica las reglas de seguridad del apartado anterior
4. En **Authentication → Users**, crea los usuarios que tendrán acceso
5. En **Authentication → Settings → Authorized domains**, añade tu dominio
6. Si usas Google Sign-In: una vez registrados todos los usuarios, deshabilita el registro automático en **Authentication → Settings**

### 3. Configura las variables de entorno en Cloudflare Pages

En **Cloudflare Pages → Settings → Environment variables**, añade:

| Variable | Valor |
|---|---|
| `FIREBASE_API_KEY` | apiKey de tu proyecto |
| `FIREBASE_AUTH_DOMAIN` | authDomain |
| `FIREBASE_DATABASE_URL` | databaseURL |
| `FIREBASE_PROJECT_ID` | projectId |
| `FIREBASE_STORAGE_BUCKET` | storageBucket |
| `FIREBASE_MESSAGING_SENDER_ID` | messagingSenderId |
| `FIREBASE_APP_ID` | appId |

### 4. Publica en Cloudflare Pages

Conecta tu repositorio en Cloudflare Pages con esta configuración:

| Ajuste | Valor |
| --- | --- |
| Build command | `bash build.sh` |
| Build output directory | `/gym_trophy` |

Cada push a `main` despliega automáticamente.

> **Desarrollo local:** Copia `.dev.vars.example` → `.dev.vars`, rellena las credenciales y ejecuta:

```bash
wrangler pages dev .
```

---

## Apoya el proyecto

Si esta aplicación te resulta útil, considera invitarme a un café ☕

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/juanjimpad)

---

## Licencia

Proyecto de código abierto para uso **no comercial**. Consulta el archivo [LICENSE](./LICENSE) para más detalles.

---

> Desarrollado con la asistencia de [Claude](https://claude.ai) (Anthropic) · 2026
