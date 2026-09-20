# STAT — Documento de traspaso (handoff)

> Para: el/la programador/a que herede este proyecto.
> Objetivo de este texto: que puedas entender **qué es STAT, por qué existe, cómo está construido, cómo se prueba y se publica, qué decisiones se tomaron (y qué errores se cometieron), y qué falta por hacer**, sin tener que preguntarle nada a nadie. Si algo de aquí contradice el código, **manda el código** — este documento describe el estado a fecha **2026-09-20** (último commit al escribirlo: `76e13f3`).
>
> Los números de línea cambian con cada edición, por eso casi todo se referencia por **nombre de función/constante** (búscalo con Ctrl+F en `app.html`).

---

## 0. Resumen en 60 segundos

- **STAT** (*Scoring & Team Analytics Tool*) es una web app para equipos de **FIRST LEGO League (FLL)**. Sirve para: registrar el puntaje de cada lanzada/ronda del *Robot Game*, llevar entrenamientos, ver estadísticas por jugador/pareja/misión/estrategia, y (nuevo) hacer **pruebas de rendimiento del robot** y una **bitácora de ajustes**.
- La construyó y la usa el equipo **Mecha Titans**. Dueño del proyecto: el equipo (correo del equipo: `mechatitansmtt@gmail.com`; usuario GitHub: `coronel208`).
- **Es (casi) un solo archivo**: `app.html` (~7.650 líneas, HTML+CSS+JS juntos, **sin build, sin npm, sin framework**). Backend = **Firebase Realtime Database**. Hosting = **Firebase Hosting** (`https://stat-fll.web.app`). Código en GitHub `coronel208/STAT` (rama `main`).
- Es **mobile-first** (se usa en el celular durante entrenamientos) pero debe verse bien en PC.
- Idioma de la UI y de los comentarios: **español**. Los nombres oficiales de las misiones de BioGlow se dejan **en inglés** (decisión explícita del dueño; ver §10).
- Temporadas soportadas hoy: **Unearthed 2025-26** (terminada, datos reales de producción, NO se puede perder) y **BioGlow 2026-27** (la actual, arrancando).
- Regla de oro del dueño: **cada cambio se prueba, se commitea, se hace push a `main`, se despliega a Firebase Hosting y se verifica que lo publicado sea idéntico al archivo local.** Ver §3.

---

## 1. Contexto de dominio (FLL) — para no perderte con el vocabulario

| Término | Qué significa en STAT |
|---|---|
| **FLL / Robot Game** | Competencia de robótica. En 2:30 min (`TIMER_TOTAL=150`) el robot hace misiones sobre un tapete. |
| **Temporada** | Cada año FLL cambia el tema y las misiones (2025-26 = *Unearthed*, 2026-27 = *BioGlow*). |
| **Misión (M01…M15)** | Cada modelo LEGO del tapete con sus reglas de puntaje. **INS** = Inspección de equipo (20 pts). **FP** = Precision Tokens (fichas restantes → puntos, tabla `TOKEN_SCORES`). |
| **Lanzada** | Una salida del robot (un programa/“launch”) que intenta varias misiones seguidas. En STAT una **lanzada configurada** (`lanzadasConfiguradas`) es una *estrategia*: nombre + base + lista de misiones + puntos objetivo. |
| **Ronda (run)** | Un intento completo registrado con puntaje (`runs[]`). |
| **Bases roja / azul** | Dos zonas/posiciones de lanzamiento en la mesa; en cada ronda hay pareja "azul" y pareja "roja". Casilla P1 = **lanza**, P2 = **recibe** (rol por base). |
| **Pareja** | Dos jugadores que compiten juntos (`pairs[]`). Se crean solas al registrar una ronda (`autoGetOrCreatePair`). |
| **Cuadrilla** | Etiqueta libre de texto (`cuadrillaName`) que agrupa rondas; hay una sección de análisis de cuadrillas (`_cuadrillasSection`). |
| **Entrenamiento** | Sesión planificada con varias rondas pendientes (`trainings[]`, cada una con `rounds[]`). |
| **Rendimiento** | Módulo nuevo: pruebas mecánicas/de precisión del robot y pruebas de una lanzada, fuera del puntaje oficial. |
| **Bitácora de ajustes** | Diario cronológico de cambios hechos al robot/programas. |

---

## 2. Repositorio y stack

```
stat_repo/
├─ app.html          ← LA APP. Todo el producto vive aquí (HTML + <style> + <script>).
├─ index.html        ← Landing pública (marketing).
├─ features.html     ← Página de funciones (marketing).
├─ about.html        ← "Sobre nosotros" (marketing).
├─ admin.html        ← Panel admin ANTIGUO e independiente (ver deuda técnica §14; el panel real está DENTRO de app.html).
├─ manifest.json     ← PWA (instalable). start_url ./app.html
├─ sw.js             ← Service worker: red primero, caché como respaldo (cascarón nada más).
├─ firebase.json     ← Hosting: site "stat-fll", public ".", html sin caché.
├─ .firebaserc       ← Proyecto Firebase por defecto.
├─ images/, icon_stat.png, logo_stat.png, team.png  ← Assets.
└─ HANDOFF.md        ← Este documento (excluido del hosting, ver firebase.json).
```

- **Sin build.** Se edita `app.html` y se sube. No hay bundler, ni transpilación, ni tests automatizados.
- Librerías por CDN (todas en `<script>`/`<link>` cerca del inicio de `app.html`): **Firebase JS SDK 10.12.0 (compat)** (`firebase-app-compat`, `firebase-database-compat`), **Chart.js 4.4.1** (gráficas, vía `dibujarGrafica`), **SheetJS `xlsx` 0.18.5** (exportar/importar Excel; se comprueba `typeof XLSX`), y Google Fonts (Plus Jakarta Sans, JetBrains Mono; el logo usa Barlow Condensed).
- **Proyecto Firebase**: `fll-unearthed-2026-6ff40` (Realtime DB URL `https://fll-unearthed-2026-6ff40-default-rtdb.firebaseio.com`). La `firebaseConfig` está en claro dentro de `app.html` y de `admin.html` (es normal en apps web de Firebase; la seguridad debe venir de las *Rules*, ver §14 — **ojo, es un problema**).
- **Hosting**: sitio `stat-fll` → `https://stat-fll.web.app`. Todo el directorio `.` se publica excepto lo listado en `ignore` de `firebase.json`.

---

## 3. Cómo trabajar: correr, probar, commitear, desplegar

### 3.1 Entorno del dueño
Windows 11, **Git Bash** (a veces PowerShell). Hay `node`, `git`, `firebase` CLI. **No** hay `python` funcional (el alias de la Microsoft Store engaña), **no** hay `gh`. `pdftotext` (poppler) sí existe en `/mingw64/bin` (se usó para leer los PDFs oficiales); `pdftoppm` no.

### 3.2 Verificación de sintaxis (siempre antes de commitear)
No hay linter, así que se extrae el `<script>` y se comprueba con Node:
```bash
node -e "const fs=require('fs');const m=fs.readFileSync('app.html','utf8').match(/<script>([\s\S]*)<\/script>/);fs.writeFileSync(process.argv[1],m[1]);" /ruta/temporal/_chk.js
node --check /ruta/temporal/_chk.js && echo SYNTAX_OK
```
(En Git Bash de Windows `node --check <(...)` y `/tmp` fallan; escribe a un archivo en una carpeta real.)

### 3.3 Probar la lógica de misiones sin navegador
`app.html` se puede evaluar en Node con stubs mínimos de `window/document/localStorage/firebase` y luego llamar a `defaultMState()`, `mSetCheck()`, `mCounter()`, `calcScore()`, `mScoreFor()`, `mMaxScore()`. Truco importante: hay que hacer `eval(scriptCompleto + codigoDePrueba)` **en una sola cadena** (los `const` declarados en un `eval` no salen de él). Al final siempre aparece un `TypeError ... 'style'` de `init()`: es el arranque de la app sin DOM, **ignóralo**. Así se validó toda la lógica de misiones BioGlow (ver §9).

### 3.4 Probar la UI
1. Servidor estático local (cualquier `node` `http.createServer` que sirva la carpeta). Ejemplos usados: puertos 8934-8958.
2. Abrir con el navegador de pruebas. Para revisar solo CSS/layout sin loguearse, conviene **armar una página de prueba** con el `<style>` y el `<header>`/tabs reales extraídos de `app.html` (así se validó el header y el menú inferior sin tocar Firebase).
3. `resize_window` a 375×812 (celular) y ≥1200 px (PC). El breakpoint móvil de toda la app es **`max-width:640px`**.
4. Ojo: el screenshot del navegador de pruebas a veces devuelve un **cuadro viejo/duplicado**; repetir la captura antes de asumir que el layout está mal.
5. Ojo: la conexión a Firebase desde el entorno de pruebas se cae de vez en cuando (`.info/connected=false`, error de WebSocket). Es del entorno, no de la app; recargar y esperar.

### 3.5 Equipo de pruebas (QA)
Existe en la base de producción un equipo **`equipo_prueba_qa2`** con una **copia realista de los datos reales** (≈423 rondas, 11 jugadores, 8 lanzadas). Sirve para probar migraciones y listeners con datos de verdad sin arriesgar Mecha Titans. Reglas:
- Después de cualquier prueba, **restaurarlo a su estado original**: solo la clave `data` (sin `seasons` ni `currentSeasonId`).
- Nunca escribir a mano en `teams/mecha_titans`. Los datos reales solo cambian por el flujo normal de la app (login → migración automática).
- Las credenciales del QA **no están en este documento**; pídeselas al dueño.

### 3.6 Flujo de commit + deploy (repetido en TODOS los cambios)
```bash
# 1) sintaxis OK (arriba)  2) pruebas OK  3) limpiar temporales
git status --short                       # debe salir solo app.html (u otros archivos que tocaste)
git add app.html                         # SIEMPRE archivos por nombre, nunca "git add ."
git commit -m "Mensaje en español que explique el POR QUÉ

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"   # (atribución usada hasta ahora; ajusta a tu caso)
git push origin main                     # push directo a main: el dueño lo tiene autorizado
firebase deploy --only hosting --project fll-unearthed-2026-6ff40 --account <CUENTA_CON_ACCESO>
# 4) verificar que lo publicado == archivo local:
curl -s "https://stat-fll.web.app/app.html?nocache=$(date +%s)" -o /tmp/live.html && diff -q /tmp/live.html app.html && echo SYNCED
```
- `<CUENTA_CON_ACCESO>`: hasta ahora se desplegó con la cuenta Google del dueño (una cuenta escolar). Tú necesitas que el dueño te agregue como colaborador en el proyecto Firebase y en el repo GitHub, y hacer `firebase login`.
- `firebase.json` sirve los `.html` con `no-cache`; el service worker es "red primero", así que una versión nueva se ve sin trucos. Aun así usa `?nocache=` al verificar con curl.
- **Nunca** `--no-verify`, nunca force-push a `main`, nunca borrar datos de Firebase sin verificación previa (ver §12).

---

## 4. Mapa de `app.html` (por nombre)

Orden aproximado dentro del archivo (busca las cabeceras `/* ═══ ... ═══ */`):

1. **`<style>`** — Reset, paleta de marca (variables CSS `:root`), header (`.hdr`), pestañas (`.tabs/.tbtn`), pantallas selector (`.picker-screen/.picker-card`), cards, botones, sub-tabs, navegación de Análisis (`.an-nav*`), slider de reconocimientos (`.awards-slider`), inputs, timer, tarjetas de misión (`.mcard/.prow/.chkbtn/.ctr`), drag & drop, modal genérico, y **tema especial superadmin** (`body.modo-oscuro`).
2. **HTML** — `login-wrap` (login/registro multi-paso), `<header class="hdr">`, `<div class="tabs" id="tabs-bar">`, `<div class="main" id="main">`, `#modal-root`, `#toast`.
3. **`CONSTANTS`** — `TOKEN_SCORES`, `MAX_SCORE`, `TIMER_TOTAL`, **`MISSIONS_UNEARTHED`**, **`MISSIONS_BIOGLOW`**, `MISSIONS_BY_SEASON`, `let MISSIONS`, `currentMissionSetKey`, `FORO_DEPS`.
4. **`STATE`** — `APP_SCREENS`, `appModule`, `_irAlModulo`, `tab`, `roundMode`, `pendingRound`, `mState`, timer, `players/pairs/trainings/runs`.
5. **`FIREBASE CONFIG & INIT`** — `firebaseConfig`, `_hashPass`, `save()` (debounced 800 ms), listeners online/offline ("el rescatista").
6. **Temporadas** — `currentSeasonId`, `seasonsIndex`, `_aplicarDatosTemporada`, **`OFFICIAL_SEASONS`**, `loadTeamData`, `_cambiarTemporada`, `_actualizarBadgeTemporada`, `_irABitacora`, `startRealtimeSync`.
7. **Login** — `doLogin`, `doRegisterCoach`, `doRegisterPlayer`, `accesoPermitido`.
8. **`HELPERS`** — `uid`, `getPlayer/getPair`, `openModal/closeModal`, `showToast`, `defaultMState`, **motor de misiones** (`_reqMet`, `_effCounterVal`, `_findParam`, `_missionZeroed`, `calcScore`, `mScoreFor`, `mMaxScore`, `getMissionResults`), filtros/ordenamientos de Buscar.
9. **`RENDER DISPATCH`** — `render()` (enrutador central), `renderTemporadaPicker`, `renderModulosMenu`, **módulo Rendimiento** (`renderRendimiento`, `_renderPruebasList`, `_renderPruebaCard/_renderPruebaBody`, `_abrirFormPrueba`, `_mostrarFormRobot`, `_mostrarFormLanzada`, `_crearPrueba*`, `_abrirFormIntento*`, `_registrarIntento*`, `_renderBitacora`, `_abrirFormAjuste`, `_crearAjuste`).
10. **Temas y render global** — `aplicarTemaGlobal`, `renderHeaderBadge`.
11. **Panel de administración** (`renderAdminPanel`, `_adm*`) — gestión de equipos/usuarios/superadmin/estrategias de otros equipos (solo superadmin) y vista del entrenador.
12. **Navegación** — `switchTab`.
13. **TAB Ronda** — `renderRonda`, hub, config, countdown, timer, **`renderMissions`**, **`_refreshMissions`**, `mSetCheck`, `mCounter`, `mToken`, `saveRun`, entrenamientos en curso.
14. **TAB Entrenamientos**, **TAB Parrilla** (jugadores), **TAB Parejas**.
15. **Análisis / Efectividad** — `renderAnalisis` (sub-tabs), `renderAnalisisResumen`, `_computeAwards`, `renderEfectividadJugadores/Parejas/Misiones/Estrategia`, `renderSubPagina{Jugador,Pareja,Lanzada}`, `effTable`, `dibujarGrafica`, **`renderLanzadaForm`** + `window.guardarLanzada/borrarLanzada`, `_cuadrillasSection`.
16. **ACTIONS / Excel export-import**, **Drag & drop de parejas (Buscar)** — `renderBuscar`, `bqDragStart/bqDropTo/bqTouch*`.
17. **Logout** — `doLogout` y bootstrap `init()` al final.

---

## 5. Modelo de datos en Firebase Realtime Database

```
users/{username}                         ← cuenta (login propio, NO Firebase Auth)
  { username, nombre, password(SHA-256 hex), rol: 'jugador'|'entrenador'|'superadmin',
    teamId, teamName, inviteCode? }        (inviteCode solo el entrenador)

teams/{teamId}                           ← teamId = slug del nombre (ej. "mecha_titans")
  name, country, city, inviteCode ("STAT-XXXX"), coach (username), lastActivity
  currentSeasonId                        ← temporada "por defecto" del equipo (la fija un admin)
  data/                                  ← NIVEL EQUIPO (no cambia de temporada)
     players: [ {id, name, username?} ]           (username = cuenta vinculada)
     pairs:   [ {id, name, p1, p2, _auto?} ]
     (legado: runs/trainings/lanzadas/missionOverrides — NO borrar, es respaldo de la migración)
  seasons/{seasonId}/                    ← seasonId: "unearthed_2025_26" | "bioglow_2026_27"
     meta: { name, yearLabel, missionSetKey, createdAt }
     data/                               ← NIVEL TEMPORADA
        runs:             [ Run ]
        trainings:        [ Training ]
        lanzadas:         [ Lanzada ]            (estrategias configuradas)
        missionOverrides: { Mxx: { paramId: [nombres de sub-acciones] } }
        perfTests:        [ {id, category:'robot'|'lanzada', name, metric?, unit?, missions?, lanzadaId?, createdAt} ]
        perfAttempts:     [ robot: {id,testId,ts,value,notes,savedBy}
                            lanzada: {id,testId,ts,results:{Mxx:bool},notes,savedBy} ]
        adjustments:      [ {id, ts, description} ]
```

Formas de los objetos principales:
- **Run** (`saveRun`): `{id, roundName, note, azulPairId, rojaPairId, azulP1, azulP2, rojaP1, rojaP2, azulLanzadorId, rojaLanzadorId, cuadrillaName, missions:<snapshot de mState>, score, ts, trainingId|null, trainingRoundId|null, savedBy, savedByRole}`.
- **`missions` / `mState`**: mapa `paramId → valor`. `check` = `true | false | null` (null = sin marcar); `counter` = número, **o** array tri-state si tiene sub-acciones nombradas; `token` = 0..6.
- **Training**: `{id, name, ts, status, rounds:[{id, order, label, azulPairId, rojaPairId, azulP1.., cuadrillaName, completed}]}`.
- **Lanzada** (`guardarLanzada`): `{id:'LZ_<ts>', name, base:'Roja'|'Azul'|'Soporte', missions:[códigos], max, targetPts:{Mxx:n}, targetParts:{paramId:n}}`. En la vista Estrategia se agregan virtualmente `M00 Fichas Precisión` e `INS Inspección` (base "Soporte").

### Gotchas de persistencia (importantes)
1. **Firebase no guarda arrays con huecos.** Un array tri-state `[null,null,true,…]` vuelve como objeto `{"2":true}`. Por eso existe `_triArr()` que lo reconstruye. Cualquier código nuevo que lea arrays de Firebase debe tolerar objeto-en-vez-de-array.
2. `save()` escribe **todo** con una sola `db.ref().update({...})` multi-ruta (atómico) y **con debounce de 800 ms**. Si `syncTimeout` está pendiente, los listeners en vivo **no** pisan el estado local (evita perder ediciones).
3. `save()` no hace nada si no hay `currentTeamId` **y** `currentSeasonId`.
4. Respaldo offline: si no hay red guarda `{players,pairs,trainings,runs,currentSeasonId}` en `localStorage['stat_respaldo_offline']` y al volver internet hace `save()`. **Ojo (deuda):** ese respaldo no incluye `lanzadas, missionOverrides, perfTests, perfAttempts, adjustments`; al reconectar `save()` sube el estado en memoria completo, pero si el usuario cierra la pestaña estando offline se pierde eso.
5. Claves de `localStorage` usadas: `stat_saas_session` (sesión del usuario), `stat_respaldo_offline`, `stat_season_<teamId>` (temporada elegida en este dispositivo), `stat_lanzadas` (legado, migración única a Firebase).

---

## 6. Autenticación y roles

- **No se usa Firebase Auth.** Login propio: se lee `users/{usuario}` y se compara el hash. Contraseñas: **SHA-256 sin sal** vía `crypto.subtle` (`_hashPass`). Cuentas antiguas en texto plano se migran a hash en silencio en el primer login exitoso.
- Usuario = `primernombre_primerapellido` en minúsculas sin tildes (`generarUsername`).
- **Registro entrenador** (`doRegisterCoach`): crea `teams/{slug}` con código de invitación `STAT-XXXX` y el usuario `rol:'entrenador'`.
- **Registro jugador** (`doRegisterPlayer`): pide el código del equipo (busca `teams` por `inviteCode`), **vincula o crea** al jugador en `teams/{id}/data/players` (compara por nombre completo sin distinguir mayúsculas y le guarda `username`), y crea `rol:'jugador'`.
- **Roles y permisos**:
  - `jugador`: solo ve **sus** rondas (`render()` filtra `runsFiltradas` por su `player.id`), no administra. **Sí** puede entrar a ver cualquier temporada (incluidas pasadas), pero su elección de temporada es solo local (localStorage), no cambia la del equipo.
  - `entrenador`: ve todo el equipo, crea/edita estrategias (Estrategia), pruebas, ajustes; ve el código de invitación; cambia la temporada por defecto del equipo.
  - `superadmin`: todo lo anterior + panel para ver/administrar **todos** los equipos, crear/editar/eliminar equipos, editar estrategias de otros equipos, hacer/quitar superadmin. Tiene un **tema oscuro especial** (`body.modo-oscuro`) aplicado automáticamente.
  - `esAdminActual()` = rol `admin|superadmin|entrenador` (es el "guard" que usa casi toda la UI de edición). Nota histórica: antes solo `admin/superadmin` podían crear lanzadas y el registro nunca asignaba esos roles, por eso ningún entrenador podía configurar Estrategia — bug ya corregido.

---

## 7. Navegación y pantallas (flujo estricto de 2 pasos)

El dueño pidió explícitamente este flujo. **Siempre** se entra por la temporada:

| Hash | `appModule` | Pantalla |
|---|---|---|
| *(vacío)* | `temporada` | **Paso 1**: elegir temporada (`renderTemporadaPicker`). Tocar una tarjeta solo la **preselecciona** (`_seasonPending`); hay que pulsar **Continuar** (`_confirmarTemporada`) — a propósito, para que cambiar de temporada nunca sea un toque accidental. |
| `#modulos` | `modulos` | **Paso 2**: elegir módulo (`renderModulosMenu`): "Registro de Puntajes" o "Pruebas de Rendimiento". |
| `#puntajes` | `puntajes` | La app clásica con barra de pestañas: Ronda / Entrenam. / Parrilla / Análisis / Buscar (+ Admin). |
| `#rendimiento` | `rendimiento` | Módulo de Rendimiento (sub-tabs Pruebas / Bitácora). |

- `_irAlModulo(mod)` cambia `appModule`, actualiza `location.hash` y llama `render()`; hay un listener `hashchange` para que el botón "atrás" funcione. `accesoPermitido()` siempre deja `appModule='temporada'` tras el login.
- El **logo STAT** y el botón **🏠 Inicio** del header llevan a `#modulos`. El **pill de temporada** del header (amarillo) lleva a `#` (elegir temporada). El botón **📝 Bitácora** del header abre Rendimiento directo en la Bitácora (`_irABitacora`). El pill de temporada y el botón Bitácora **no se muestran** en la pantalla de temporada (`_actualizarBadgeTemporada`).
- La barra de pestañas (`#tabs-bar`) solo existe en `puntajes`. En el resto se oculta con `style.setProperty('display','none','important')` (ver gotcha CSS §12).
- **El usuario NO puede crear temporadas desde la UI** (lo pidió explícitamente). Las temporadas salen solo de `OFFICIAL_SEASONS` en el código.

---

## 8. Sistema de temporadas (cómo funciona por dentro)

- **`OFFICIAL_SEASONS`** es la **única fuente de verdad** de qué temporadas existen. `loadTeamData()`:
  1. Lee `teams/{id}`. `players/pairs` salen de `data`.
  2. **Migración legada (una vez por equipo):** si no existe `teams/{id}/seasons`, copia `runs/trainings/lanzadas/missionOverrides` de `/data` a `seasons/unearthed_2025_26/data` y fija `currentSeasonId`. **`/data` legado nunca se borra.**
  3. Crea (vacías) todas las temporadas oficiales que falten para ese equipo — así aparecen solas al agregarlas al código.
  4. `seasonsIndex` se **filtra estrictamente** a las claves de `OFFICIAL_SEASONS`. Cualquier temporada suelta en Firebase se ignora (esto fue lo que arregló el bug de "dos BioGlow": había una temporada huérfana `bioglow_mu21hxku` creada cuando aún existía el botón "crear temporada"; se borró de producción tras verificar que estaba 100 % vacía, y además el filtro la hace inofensiva para cualquier otro equipo).
  5. Resuelve `currentSeasonId`: localStorage → `root.currentSeasonId` válido → primera oficial.
  6. `_aplicarDatosTemporada()` carga los arrays de la temporada y **cambia el set de misiones** (`MISSIONS = MISSIONS_BY_SEASON[meta.missionSetKey]`, `currentMissionSetKey`, y recalcula `MAX_SCORE`).
- `_cambiarTemporada(id)`: guarda en localStorage; **solo si `esAdminActual()`** escribe `teams/{id}/currentSeasonId` en Firebase; aplica datos; **reinicia el listener en vivo**; re-renderiza.
- **Listeners en vivo** (`startRealtimeSync`): dos refs — `teams/{id}/data` (players/pairs) y `teams/{id}/seasons/{sid}/data` (todo lo de temporada). **Bug histórico importante:** `ref.on('value',cb)` devuelve `cb`, **no** una función de desuscripción; antes se llamaba `realtimeListener()` y reventaba con `Cannot read properties of undefined (reading 'exists')` la primera vez que se cambiaba de temporada. Ahora se guarda `{ref, callback}` y se llama `ref.off('value', callback)`.

### Checklist para agregar una temporada nueva (ej. 2027-28)
1. Crear `const MISSIONS_XXXX=[...]` (misma forma que las otras; ver §9). Obtener los números **de la hoja de puntuación oficial** (no de memoria).
2. Añadirla a `MISSIONS_BY_SEASON` (`clave: MISSIONS_XXXX`).
3. Añadir entrada en `OFFICIAL_SEASONS` (`id_ANIO: {name, yearLabel, missionSetKey}`).
4. Revisar cualquier `if(currentMissionSetKey==='unearthed' …)` (hoy solo M14 "Foro") por si algo específico de Unearthed se filtra a la nueva.
5. Comprobar que la suma de `mMaxScore` da el máximo oficial (BioGlow = **530**).
6. Probar con `equipo_prueba_qa2`; luego commit + deploy. Los equipos existentes la recibirán vacía automáticamente al iniciar sesión.
7. Decidir si `TOKEN_SCORES` cambia (en BioGlow es idéntica a Unearthed).

---

## 9. Motor de misiones (el corazón de la app)

### 9.1 Forma de una misión
```js
{ code:'M04', name:'Lucky Leaves', amber?:bool, noEquip?:bool,
  params:[ {id, label, pts, type:'check'|'counter'|'token', ...opciones} ] }
```
- `type:'check'` → dos botones ✓ / ✗ (tri-estado: `true`, `false`, `null`; volver a pulsar el mismo botón desmarca). Suma `pts` si `true`.
- `type:'counter'` → botones −/+ (0..`max`), suma `valor*pts`. Necesita `max` y `perItem` (texto "10 c/u").
- `type:'token'` → selector 0..6 con `TOKEN_SCORES` (solo FP).
- `bonus:true` solo pinta la etiqueta "BONO" (no cambia el cálculo).

### 9.2 Primitivas declarativas (añadidas para BioGlow; reutilizables)
| Propiedad | Efecto | Ejemplo |
|---|---|---|
| `requires:'idX'` | El parámetro queda gris/deshabilitado y **no puntúa** hasta que `idX` esté marcado. Vale para `check` **y** `counter`. Al desmarcar `idX` se limpian en cascada sus dependientes (`_clearDependents`). | M06: fragmentos requieren la hormiga. |
| `requiresValue:n` | Con `requires`, exige que el contador `requires` valga **exactamente** `n` (en vez de "verdadero"). | (hoy sin uso; queda disponible) |
| `capBy:'idContador'` | El máximo del contador es el **valor actual** de otro contador; si el de origen baja, este se recorta solo. La etiqueta "máx N" se actualiza en vivo. | M14: semillas que tocan el tapete ≤ semillas en la estación. |
| `group:'nombre'` | **Exclusión mutua**: marcar uno desmarca los demás del grupo (y sus dependientes). Además `mMaxScore` toma solo el **máximo** del grupo (no la suma). | M05 parcial/completa; M15 bonos; M04 bono completo vs. "devolví al katydid". |
| `zeroesMission:true` (+ `unless:'idY'`) | Si este check está en `true` la **misión completa vale 0**, salvo que `idY` esté en `true`. Lo aplican `calcScore` y `mScoreFor` (vía `_missionZeroed`). No suma `pts` por sí mismo. | M04: "saqué al katydid". |

`mMaxScore(m)` = suma de checks sin grupo + **máximo por grupo** + `max*pts` de contadores + 50 por token. Es el máximo **teórico alcanzable**; por eso los grupos importan (sin ellos M05 daba 30 en vez de 20 y la misión nunca aparecía como "completa").

### 9.3 Cómo fluye el dato
`renderMissions()` dibuja las tarjetas → los botones llaman `mSetCheck(id,val)` / `mCounter(id,±1)` / `mToken(n)` → mutan `mState` → `_refreshMissions()` **actualiza solo los nodos DOM afectados** (NO llama `render()`; hacerlo destruiría el DOM y los botones dejarían de responder) → `saveRun()` calcula `calcScore(mState)`, guarda un **snapshot** de `mState` en `run.missions` y sube a Firebase.
**Consecuencia:** el puntaje histórico se calcula con `mScoreFor(m, run.missions)` cada vez; **si cambias las reglas de una misión, cambian los puntajes recalculados de rondas antiguas** que usen esos ids. Cambiar ids/estructura de misiones de una temporada con datos reales es delicado (para BioGlow aún no hay datos reales importantes, para Unearthed **no toques** sus ids).

### 9.4 Sub-acciones nombradas (`missionOverrides`) y el "Foro"
- Un contador (ej. "3 secciones, 10 c/u") puede convertirse en checks **individuales nombrados** configurando `missionOverrides[Mxx][paramId]=[nombres]` desde "⚙️ Sub-acciones por misión" (pantalla de misiones, solo admin) / Estrategia. Se guarda como array tri-state.
- **Unearthed M14 "Foro"** es un caso fijo: 7 objetos con **dependencia** de otras misiones (`FORO_DEPS`: no puedes marcar "Cepillo" si M01 no puntuó, etc.). **Esto solo aplica a Unearthed**: todas las comprobaciones llevan `currentMissionSetKey==='unearthed' &&` (5 sitios: `defaultMState`, `effTable` ×2, formulario de ronda ×2). Bug histórico: sin esa guarda, el M14 de BioGlow ("Seeds of Renewal", un contador simple) se dibujaba como el Foro de 7 ítems.

### 9.5 BioGlow 2026-27 — tabla oficial implementada (total **530**)
Fuentes usadas: *Robot Game Rulebook* oficial (PDF en inglés) y el *Software Scoresheet* oficial (PDF). Ambos extraídos con `pdftotext -layout`. **No existe traducción oficial al español** localizada, y el dueño pidió **dejar los nombres oficiales en inglés** (los `label` de cada parte sí están en español).

| Misión | Nombre oficial | Máx | Estructura resumida |
|---|---|---|---|
| INS | Inspection | 20 | check 20 |
| M01 | Drone Survey | 30 | 20 + bono 10 (requiere lo primero) |
| M02 | Exploding Seeds | 30 | contador 0-3 × 10 |
| M03 | Flip the Rock | 30 | 20 + bono 10 (requiere lo primero) |
| M04 | Lucky Leaves | 30 | ver §9.6 |
| M05 | Reaching Roots | 20 | parcial 10 **o** completa 20 (grupo excluyente) |
| M06 | Leafcutter Frenzy | 40 | hormiga toca nido (0 pts, habilita) + fragmentos 0-4 × 10 |
| M07 | Humongous Fungus | 40 | micelio 20 + conexiones 0-2 × 10 (requiere micelio) |
| M08 | Tangled | 30 | check 30 |
| M09 | Research Platform | 30 | 3 checks × 10 |
| M10 | Fragile Microhabitats | 20 | 2 checks × 10 |
| M11 | Window to the Past | 20 | check 20 |
| M12 | Forest Elder | 30 | 20 + 10 |
| M13 | Keystone Species | 30 | **un solo check** combinado (según la hoja oficial) |
| M14 | Seeds of Renewal | 40 | semillas 0-4 × 5 + bono 0-4 × 5 (tope = semillas en estación) |
| M15 | Biocentric Architecture | 40 | 3 checks × 10 + **un solo** bono ambiental de 10 (Mina/Ciudad/Granja, grupo excluyente) |
| FP | Precision Tokens | 50 | tabla `TOKEN_SCORES` (idéntica a Unearthed) |

Unearthed suma **545** (valor inicial de `MAX_SCORE`); BioGlow **530** (el dueño lo contó a mano y coincidió con la app tras corregir M04).

### 9.6 La historia de Lucky Leaves (M04) — léela, es una lección
Se rehízo **cuatro veces** por modelar de memoria/por descripción verbal en vez de contra la hoja oficial:
1. Contador de hojas (×10, máx 2) + bono → sobrecontaba (40).
2. Modelo de 3 casillas "hoja 1 / hoja 2 normal o katydid" + bono parcial inventado → sobrecontaba.
3. Lo que dice **literalmente la hoja oficial**: 10 si al menos una hoja salió; **+20** de bono si la segunda también salió **y** el katydid sigue en su posición inicial; si el katydid termina fuera del hábitat (aunque sea parcial) la misión vale **0**.
4. **Versión vigente** (aclarada por el dueño, que es quien revisa el modelo físico): sacar/mover al katydid **anula la misión**, pero si lo **devuelves al hábitat** antes de terminar, te dan **+10 aparte** de la hoja ya contada (en lugar del bono completo de 20).

Implementación vigente (4 casillas):
```js
{id:'m04_leaves',        pts:10, type:'check'}                                   // ≥1 hoja fuera
{id:'m04_bonus_full',    pts:20, type:'check', bonus:true, requires:'m04_leaves', group:'m04_katydid_bonus'}
{id:'m04_katydid_out',   pts:0,  type:'check', zeroesMission:true, unless:'m04_katydid_returned'}
{id:'m04_katydid_returned', pts:10, type:'check', bonus:true, requires:'m04_katydid_out', group:'m04_katydid_bonus'}
```
Resultados: solo hoja = 10; hoja + bono completo = 30; katydid sacado y no devuelto = 0; katydid sacado y devuelto = 10 + 10 = 20. Máximo teórico 30 (los dos bonos comparten `group`).
**Moraleja para ti:** ante una regla rara, pide al dueño la **hoja oficial / captura** y valida con números; y él revisa personalmente el modelo físico de cada misión — te dirá cuándo algo no coincide. Actualmente **sigue revisando las misiones y va a agregar sub-misiones** (`missionOverrides`/ajustes de labels), así que espera cambios de datos de BioGlow.

---

## 10. Módulo "Registro de Puntajes" (lo que ya existía, resumido)

- **Ronda**: hub ("¿Cómo quieres lanzar?": Entrenamiento o Lanzada suelta) → configurar parejas por base (P1 lanza, P2 recibe) → cuenta regresiva 3-2-1 → **timer de 2:30 con reloj de pared (sin deriva, ticker de 250 ms)** → checklist de misiones → guardar. Se puede reutilizar parejas/cuadrilla de una ronda previa.
- **Entrenamientos**: se planifican rondas (asistente `trainWizSlots`), se ejecutan una a una y se marcan `completed`.
- **Parrilla**: jugadores y parejas del equipo.
- **Análisis** (sub-tabs en tarjetas mobile-first): Resumen (+ slider de **reconocimientos**, `_computeAwards`), Jugadores, Parejas, Cuadrillas, Misiones, Estrategia, Entrenamientos. Gráficas con Chart.js (`dibujarGrafica`; ojo: lee colores de `document.body`, no de `<html>`, por el modo oscuro).
- **Estrategia** = `lanzadasConfiguradas` (crear/editar con `renderLanzadaForm`, con puntos objetivo por parte).
- **Buscar**: filtros (texto, jugador, pareja, cuadrilla, rango de puntaje, **período**: Todo/Hoy/7 días/30 días/Temporada/rango personalizado) y **buscar por pareja arrastrando dos jugadores** (mouse y touch: `bqDragStart/bqDropTo/bqTouchStart/Move/End`). Historial: esas funciones estaban referenciadas en el HTML pero **nunca definidas** (bug latente que dejaba el arrastre muerto); ya se implementaron.
- **Admin**: `renderAdminPanel` (equipos, usuarios, superadmin, estrategias de cualquier equipo; para leer/escribir lanzadas de otro equipo se usan `_admTeamLanzadasPath/_admTeamLanzadas`, que resuelven la ruta por temporada con respaldo a la ruta legada).
- **Excel**: exportar/importar rondas (columnas incluyen `cuadrilla`, `comentario`, `guardado_por`…).
- **Regla de conteo de rondas (decisión explícita del dueño, revertida una vez):** un jugador/pareja cuenta **1 ronda por registro**, aunque aparezca en las dos bases de esa misma ronda (se deduplica con `Set`/condiciones OR). No lo cambies sin preguntarle.

## 11. Módulo "Pruebas de Rendimiento"

Todo **por temporada** (el robot se rediseña cada año). Sub-tabs **Pruebas** y **Bitácora**.
- **Pruebas** se clasifican en dos categorías (`perfTests[].category`):
  - **🤖 Robot** (mecánicas): botones rápidos "Línea recta", "Giro llanta fija", "Giro pivot" (crean la prueba con métrica "% de precisión"), o personalizada (nombre + métrica + unidad). Cada intento guarda un valor numérico + notas; muestra último valor y mini-gráfica de línea.
  - **🎯 Lanzada**: se prueba una rutina de misiones repetidamente. Al crearla eliges: **una lanzada ya configurada** en Estrategia (`lanzadaId`, copia sus misiones), **o** un subconjunto personalizado de misiones, **o** el atajo "¿No existe? Crear una lanzada nueva" (`_irACrearLanzada`, te lleva al formulario real de Estrategia y un aviso te recuerda volver). Cada intento marca ✓/✗ por misión (reutiliza `.chkbtn/.prow`) y la tarjeta muestra el **% de éxito por misión** (`ok/total`).
- **Bitácora**: lista cronológica de `adjustments` (fecha + descripción) con alta/baja.
- Los jugadores lo ven pero los controles de creación/edición dependen de `esAdminActual()` (revisar la función concreta si cambias permisos).

---

## 12. UI/CSS: sistema y trampas (mucho dolor aquí)

- **Variables de marca** en `:root` (`--navy`, `--teal/--cyan`, `--surface`, `--text*`, `--border*`, `--green/--amber/--red/--blue…`). El tema oscuro de superadmin **redefine** las mismas variables en `body.modo-oscuro` (no en `:root`) → por eso los estilos deben usar variables, y JS que lea colores debe leerlas de `document.body`.
- **Breakpoint móvil único:** `@media(max-width:640px)`. Desktop: `min-width:641px`.
- **Header móvil (vigente):** fila 1 = logo + botón **Salir** en los extremos; fila 2 = el resto (admin/superadmin, pill del equipo, pill de temporada, 📝 Bitácora, 🏠 Inicio) **repartido de borde a borde**. Se logra con `.hdr{justify-content:space-between}`, `.hdr-right{display:contents}` (para reordenar hijos con `order`), `#hdr-logout{order:1}`, `.hdr::after{flex:0 0 100%;order:2;margin-top:-10px}` (fuerza el salto de línea) y `.hdr-right > :not(#hdr-logout){order:3}`. En móvil se ocultan textos largos con `.hdr-full-label` (solo ícono), `#hdr-user`, `#hdr-divider`, `#hdr-temporada`, `#header-badge-container`. En desktop es una sola fila `nowrap`.
- **Menú inferior móvil:** `.tabs` pasa a `position:fixed;bottom:0`; las 5 pestañas usan `flex:1 1 0` (todas visibles, **sin scroll horizontal**), `font-size:.64rem`. `.main` reserva `padding-bottom` para no quedar tapado; `#conn-indicator` se sube.
- **Pantallas selector (temporada/módulos):** `.picker-screen` (flex columna centrada, `min-height:calc(100vh - 130px)`) + `.picker-card` (`max-width:420px`) para que en PC no se vean como una isla perdida.
- **Inputs:** el selector CSS base cubre `text|number|date`, `select`, `textarea`. En modo oscuro `input[type=date]{color-scheme:dark}` (sin eso el texto blanco sale sobre fondo claro nativo = ilegible).
- **Trampas conocidas:**
  1. `.tabs{display:flex !important}` → un `el.style.display='none'` **no** funciona; usar `el.style.setProperty('display','none','important')` y `removeProperty` para restaurar.
  2. En `<button>`, `border-color` no se pinta de forma fiable en algunos navegadores (medido en el navegador de pruebas): el acento de la pestaña activa móvil usa `box-shadow: inset 0 3px 0 0 <color>` (también en el tema oscuro).
  3. `_refreshMissions()` no debe reemplazarse por `render()` (destruye el DOM mientras se toca).
  4. No usar `position:sticky` con `top` fijo en móvil para las pestañas: el header tiene altura variable.

---

## 13. Errores reales que ya se pagaron (no los repitas)

| Síntoma | Causa | Arreglo |
|---|---|---|
| Arrastre en Buscar no hacía nada | Funciones `bq*` referenciadas pero jamás definidas | Implementadas (mouse + touch) |
| Error al cambiar de temporada (`reading 'exists'`) | `.on()` no devuelve unsubscribe | Guardar ref+callback y `.off()` |
| M14 de BioGlow con 7 ítems del Foro | Comprobación por código de misión sin mirar temporada | Guarda `currentMissionSetKey==='unearthed'` |
| Dos "BioGlow" en el selector | Temporada huérfana creada por el viejo botón "crear" | Filtro estricto a `OFFICIAL_SEASONS` + borrado del nodo vacío verificado |
| Pestañas que no se ocultaban | `!important` en `.tabs` | `setProperty(...,'important')` |
| Fecha ilegible en modo oscuro | `input[type=date]` sin estilo/`color-scheme` | Añadido al selector base + `color-scheme:dark` |
| Máximos de misión inflados / misión nunca "completa" | `mMaxScore` sumaba opciones excluyentes | `group` + máximo por grupo |
| `requires` "decorativo" en contadores (M06/M07/M14) | Solo se aplicaba a `check` | Extendido a `counter` en render, refresh, `mCounter` y puntaje |
| Lucky Leaves mal (4 veces) | Modelado por descripción verbal | Validar contra la hoja oficial (§9.6) |
| Conteo de rondas | Se contaban base-apariciones en vez de rondas | Una ronda = 1 aunque juegue en 2 bases (decisión del dueño) |

---

## 14. Deuda técnica, riesgos y mejoras sugeridas (en orden de prioridad)

### 14.1 Seguridad (lo más urgente)
- **No hay Firebase Auth y no hay `database.rules.json` en el repo.** Las *Rules* viven en la consola de Firebase y **no las he podido ver**. Si son las que sugiere `admin.html` (`".read": true, ".write": true`), **cualquiera con la URL de la base puede leer y escribir todo** (incluidos los hashes de contraseñas de `users/`). Acción: revisar las Rules hoy mismo; el camino correcto es migrar a **Firebase Authentication** (email/contraseña o usuarios sintéticos) y escribir reglas por `teamId` y por rol.
- Hashes SHA-256 **sin sal** y sin límite de intentos: migrar a Auth resuelve ambos.
- `firebaseConfig` en claro es normal, pero solo es seguro si las Rules están bien.
- `admin.html` es un panel **antiguo** que aún habla de `teams/{k}/pin` (el PIN de equipo se eliminó del producto) y borra nodos con `.remove()`. Decidir: **borrarlo** (el panel real está en `app.html`) o modernizarlo. Mientras exista y esté publicado, es una superficie de riesgo.

### 14.2 Robustez de datos
- Respaldo offline incompleto (§5.4): guardar también `lanzadas, missionOverrides, perfTests, perfAttempts, adjustments`.
- `save()` reescribe **arrays completos** de `runs` cada vez (con el tamaño actual ≈ 400+ rondas es aceptable; si crece mucho o hay 2 personas guardando a la vez puede haber pisadas "el último gana"). Mejora: escribir por elemento con clave (`runs/{id}`) o usar transacciones.
- Puntajes históricos se **recalculan** con las reglas actuales (§9.3). Si vas a cambiar reglas de una temporada con datos, considera guardar el `score` en la ronda (ya se guarda) y usarlo como fuente para totales históricos, o versionar el set de misiones.

### 14.3 Mantenibilidad
- Un solo archivo de ~7.650 líneas y ~420 KB. Sugerencia realista y gradual: separar en `app.css`, `missions.js` (datos por temporada), `engine.js` (motor de misiones), `rendimiento.js`, etc., con `<script src>` simples (sin necesidad de bundler). Empezar por **`missions.js`** (aislado y con menos acoplamiento) y **el motor** (ya es lógica pura, se prueba en Node).
- Cero pruebas automáticas: el arnés Node de §3.3 es un buen punto de partida para volverlo un `test/` real (casos de M04, M05, M06, M14, M15 ya están descritos en este documento).
- Código muerto/viejo: `admin.html`, `stat_lanzadas` legado, restos de tema configurable.

### 14.4 Producto (ideas hablado/pendientes)
- Terminar de **revisar las misiones de BioGlow con el dueño** (él agregará sub-misiones y confirmará sub-acciones/puntos) — es lo más probable que llegue como primer pedido.
- Rendimiento: gráficas para pruebas de lanzada (evolución del % de éxito en el tiempo), enlazar **ajustes ↔ pruebas** (el modelo original preveía `relatedTestIds` en `adjustments`; hoy solo hay texto libre), exportar a Excel.
- Comparar temporadas (Unearthed vs BioGlow) en Análisis.
- Nombres de misión en español: solo si aparece la traducción **oficial** (el dueño no quiere traducciones propias).
- Vista de solo lectura de temporadas pasadas más explícita para jugadores.

---

## 15. Cómo trabaja (y qué espera) el dueño — trátalo bien

- Se comunica en **español, informal y directo**. Espera respuestas **cortas**, sin adulación ni resúmenes largos. Corrige rápido y con capturas de pantalla ("Nooo bro, mirá…"); cuando corrige, **haz lo que dice**, y si discrepas menciónalo en una línea.
- Le importa muchísimo: **no perder datos reales** (Unearthed), **mobile-first sin romper el estilo**, que **cada cambio quede desplegado y verificado**, y que **las reglas coincidan con la hoja oficial**.
- Pide planear primero y ejecutar **por fases** cuando el cambio es grande (así se hizo Temporadas → BioGlow → Menú → Rendimiento).
- Decisiones ya tomadas por él (no las reviertas sin preguntar): flujo estricto temporada → módulo; **seleccionar y confirmar** para cambiar de temporada; **no** crear temporadas desde la UI; jugadores pueden **ver** temporadas pasadas; nombres oficiales de misiones **en inglés**; conteo de rondas = 1 por registro.

---

## 16. Historial de commits relevantes (para orientarte con `git log`)

`8f1f006` Fase 1 datos por temporada · `a2bc15a` Fase 2 misiones BioGlow · `74f56d6` Fase 3 menú principal · `c823043` Fase 4 Rendimiento · `68002d9` rediseño temporada/módulos + URLs por pantalla + Rendimiento por categorías · `816527b` centrado en desktop, integración de lanzadas con Estrategia · `ce19ef7` nombres oficiales en inglés · `f661aa7` exclusión mutua/topes (M04–M15) · `d7f9eab` header/menú móvil · `1976d25` M04 según hoja oficial (530) · `50ea2c2` M04 katydid devuelto · `76e13f3` fechas legibles + botón Bitácora.
Antes de esas fases: PWA, panel admin unificado, Excel, reconocimientos, análisis por misión/lanzada, buscar por pareja, etc. (ver `git log`).

---

## 17. Primeros pasos recomendados para ti (en este orden)

1. Pídele al dueño acceso a: repo GitHub, proyecto Firebase (`fll-unearthed-2026-6ff40`), y las credenciales del equipo `equipo_prueba_qa2`.
2. **Revisa las Rules de la Realtime Database** (§14.1). Es lo único que te recomiendo hacer antes de cualquier feature.
3. Clona, abre `app.html` en un servidor estático local y recorre el flujo: login → temporada → módulo → Ronda → guardar → Análisis → Rendimiento.
4. Lee en este orden dentro del código: `OFFICIAL_SEASONS` → `loadTeamData` → `save` → `render` → `MISSIONS_BIOGLOW` → `calcScore/mScoreFor/mMaxScore` → `renderMissions/_refreshMissions/mSetCheck/mCounter`.
5. Reproduce mentalmente M04 con la tabla de §9.6 y comprueba que entiendes por qué el máximo es 30.
6. Pregunta al dueño qué misiones/sub-misiones de BioGlow ya revisó; ahí estará tu primer trabajo.

---

## 18. Glosario rápido de funciones que más vas a tocar

`render()` enruta todo · `save()` sube todo (debounce) · `loadTeamData()` carga y migra · `_aplicarDatosTemporada()` cambia de set de misiones · `_cambiarTemporada()` · `startRealtimeSync()` · `esAdminActual()` guard de permisos · `defaultMState()` estado vacío de una ronda · `_reqMet/_effCounterVal/_findParam/_missionZeroed` motor · `calcScore/mScoreFor/mMaxScore` puntajes · `renderMissions/_refreshMissions` UI de misiones · `mSetCheck/mCounter/mToken` interacciones · `saveRun()` guarda una ronda · `renderAnalisis()` + `renderEfectividad*` análisis · `renderLanzadaForm()`/`guardarLanzada` Estrategia · `renderRendimiento()` y `_renderPruebasList/_renderBitacora` Rendimiento · `openModal/closeModal/showToast/uid` utilidades.
