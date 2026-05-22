# 🏆 Gym Trophy

[![License: Non-Commercial](https://img.shields.io/badge/License-Non--Commercial-orange.svg)](./LICENSE)
[![Built with Claude](https://img.shields.io/badge/Built%20with-Claude%20AI-blueviolet?logo=anthropic)](https://claude.ai)
[![Ko-fi](https://img.shields.io/badge/Support-Ko--fi-FF5E5B?logo=ko-fi&logoColor=white)](https://ko-fi.com/juanjimpad)

Aplicación web para la gestión de entrenamientos de fuerza. Diseñada para entrenadores personales que quieren llevar el control de pesos, series, repeticiones y retos grupales de sus clientes en tiempo real.

---

## Características

- **Pesos · Series · Reps** — Ranking por ejercicio con la mejor marca histórica de cada cliente (👑). Leaderboard con medallas separado por sexo.
- **Retos grupales** — Desafíos de repeticiones, calorías o tiempo con fecha de inicio y fin. Ranking en tiempo real separado por sexo. El reto queda inactivo pasada la fecha de fin.
- **Historial de sesiones** — Consulta el historial completo de sesiones por ejercicio y cliente. Incluye gráfica de evolución del peso y opción de eliminar sesiones individuales.
- **Buscador de clientes** — Filtrado en tiempo real sobre la lista de clientes mientras escribes.
- **Soporte multiidioma (ES / EN)** — La interfaz está disponible en español e inglés.
- **PWA con soporte offline** — Service Worker que cachea los recursos estáticos. La app funciona sin conexión una vez cargada.
- **Sincronización en la nube** — Datos guardados en Firebase Realtime Database. Cualquier cambio se refleja instantáneamente en todos los dispositivos.
- **Acceso con contraseña** — Login con correo y contraseña mediante Firebase Authentication.
- **Gestión de clientes** — Añadir, editar y eliminar clientes con nombre, sexo y fecha de nacimiento.
- **Ejercicios personalizados** — Añade ejercicios propios que se aplican automáticamente a todos los clientes.
- **Ganadores por sexo** — Rankings diferenciados para hombres y mujeres en ejercicios y retos.
- **Edad informativa** — La edad de cada cliente se calcula automáticamente a partir de su fecha de nacimiento y se muestra en los rankings.
- **Detección de conexión** — Banner de aviso cuando se pierde la conexión. Indicador de guardado en el encabezado.

---

## Tecnologías

- HTML · CSS · JavaScript (ES Modules, sin frameworks ni bundler)
- [Firebase Realtime Database](https://firebase.google.com/products/realtime-database) — persistencia y sincronización en tiempo real
- [Firebase Authentication](https://firebase.google.com/products/auth) — acceso seguro con email y contraseña
- [Chart.js](https://www.chartjs.org/) — gráficas de evolución por ejercicio
- Alojado en [GitHub Pages](https://pages.github.com/) vía GitHub Actions

---

## Estructura del proyecto

```
gym_trophy/
├── index.html
├── sw.js               # Service Worker — caché offline y versionado de assets
├── css/
│   └── style.css
└── js/
    ├── app.js              # Punto de entrada, Firebase init, event delegation
    ├── config.js           # Ejercicios base, bandas, duraciones y constantes
    ├── firebase.js         # Credenciales Firebase (gitignoreado)
    ├── firebase.example.js # Plantilla de credenciales para nuevos despliegues
    ├── i18n.js             # Módulo de internacionalización (idioma activo, t())
    ├── locales/
    │   ├── es.js           # Cadenas en español
    │   └── en.js           # Cadenas en inglés
    ├── state.js            # Estado global mutable
    ├── utils.js            # Funciones puras: rankings, fechas, edad, agrupación
    ├── db.js               # Operaciones de escritura a Firebase
    └── render.js           # Todas las vistas (renderizado sin framework)
```

---

## Diseño de la base de datos

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
        ".read":  "auth != null && auth.uid == $uid",
        ".write": "auth != null && auth.uid == $uid"
      }
    }
  }
}
```

Cada usuario solo puede leer y escribir sus propios datos.

---

## Despliegue

### 1. Clona el repositorio

```bash
git clone https://github.com/juanjimpad/gym_trophy.git
cd gym-trophy/gym_trophy
```

### 2. Configura Firebase

1. Crea un proyecto en [Firebase Console](https://console.firebase.google.com)
2. Activa **Realtime Database** (modo Europa) y **Authentication → Email/Password**
3. Copia `js/firebase.example.js` → `js/firebase.js` y rellena tus credenciales
4. Aplica las reglas de seguridad del apartado anterior
5. En **Authentication → Users**, crea los usuarios que tendrán acceso
6. En **Authentication → Settings → Authorized domains**, añade tu dominio de GitHub Pages

### 3. Publica en GitHub Pages

En los ajustes de tu repositorio → **Pages** → Branch: `main`, Folder: `/gym_trophy`

> **Desarrollo local:** Los módulos ES no funcionan con `file://`. Usa un servidor local:
> ```bash
> npx serve .
> ```

---

## Apoya el proyecto

Si esta aplicación te resulta útil, considera invitarme a un café ☕

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/juanjimpad)

---

## Licencia

Proyecto de código abierto para uso **no comercial**. Consulta el archivo [LICENSE](./LICENSE) para más detalles.

---

> Desarrollado con la asistencia de [Claude](https://claude.ai) (Anthropic) · 2026
