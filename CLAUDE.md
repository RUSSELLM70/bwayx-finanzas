# BWAY X - Finanzas — guía para Claude (terminal)

PWA de finanzas personales (HTML/CSS/JS sin dependencias, sin build). Datos 100 % locales en el dispositivo del usuario.
Sitio en producción: **https://bwayxfinanzas.netlify.app** (Netlify). Repositorio objetivo: **`bwayx-finanzas`** en GitHub (privado).

## Inicio rápido (para la persona dueña del proyecto)
```bash
cd /Users/mattewsrussell/Projects/FinanzasOS
claude "Sigue CLAUDE.md y publica el proyecto"
```
Claude Code carga este archivo automáticamente al abrir la carpeta. **Si el usuario escribe cualquier mensaje como
"publica", "sube", "hola" o "empecemos", ejecuta el flujo "Publicación inicial" de abajo sin pedir más contexto.**

---

## Flujo A — Publicación inicial (GitHub + Netlify)
Objetivo: dejar el proyecto en GitHub y que **cada `git push` publique la PWA sola** (Netlify corre las pruebas y despliega).
Ejecuta en orden; muestra al usuario el resultado de cada paso en una línea. Detente y explica si algo falla.

1. **Entorno.** `node -v` debe ser ≥ 22 (las pruebas usan `node --test` con globs). `git --version` y `gh --version` deben existir
   (si falta `gh`: `brew install gh`).
2. **Pruebas.** `npm test` → deben pasar todas (hoy: 73). Si alguna falla, **no publiques**: arréglala primero.
3. **Git local.**
   - Si no existe `.git`: `git init -b main`.
   - Si `git config user.name`/`user.email` están vacíos, pídeselos al usuario y configúralos (`git config --global ...`).
   - Revisa `.gitignore` (debe excluir `deploy/`, `*.zip`, `node_modules/`, `.DS_Store`, `.claude/`).
   - `git add -A` y revisa `git status --short`: **no debe entrar** ningún `.zip`, `deploy/`, `.claude/` ni archivos con claves/tokens.
   - `git commit -m "BWAY X - Finanzas: versión inicial"` (si no hay nada que confirmar, sigue).
4. **GitHub.** `gh auth status`.
   - Si no hay sesión o el token es inválido: ejecuta `gh auth login -h github.com -w` y pide al usuario que complete el código en el
     navegador (es interactivo; solo él puede autorizar). Repite `gh auth status` hasta que diga que está autenticado.
   - Si no existe remoto `origin`: `gh repo create bwayx-finanzas --private --source=. --push`.
   - Si ya existe `origin`: `git push -u origin main`.
   - Confirma con `git log --oneline -1` y `gh repo view --json url -q .url`. Muestra la URL del repo.
5. **Netlify (lo hace el usuario en el navegador; guíalo paso a paso).** No existe forma de hacerlo sin su cuenta.
   1. Abrir su sitio **bwayxfinanzas** → *Site configuration → Build & deploy → Continuous deployment → Link repository*.
   2. Elegir GitHub → repo `bwayx-finanzas` → rama `main`. Netlify lee `netlify.toml` solo
      (`sh build-deploy.sh --no-zip`, carpeta `deploy`, `NODE_VERSION=22`). No cambiar nada más.
   3. **Conectarlo a ESE MISMO sitio.** Crear un sitio nuevo cambiaría el dominio y los usuarios **perderían sus datos**
      (los datos están atados al origen exacto). Si Netlify no ofrece "Link repository" en un sitio creado con Drop, **no improvises**:
      explica la alternativa (importar el repo como sitio nuevo, borrar el viejo y renombrar el nuevo a `bwayxfinanzas` para conservar
      el mismo origen) y pide confirmación antes de que el usuario haga algo destructivo.
6. **Verificar el despliegue** (cuando el usuario confirme que Netlify terminó el build):
   - Con `WebFetch` (o `curl` si hay red) abre `https://bwayxfinanzas.netlify.app/sw.js`.
   - `const CACHE = 'finanzasos-XXXXXXXXXXXX'` debe coincidir con `git rev-parse HEAD | cut -c1-12`
     (el script `build-deploy.sh` usa `COMMIT_REF`). Si aún dice `finanzasos-v15` o similar, ese despliegue no vino de Git.
   - Dile al usuario cómo comprobar el aviso en su teléfono (ver "Comprobar la actualización" abajo).

## Flujo B — Cada cambio posterior
1. Edita el código pedido. Mantén el estilo existente.
2. `npm test` (todas deben pasar). Si cambias la interfaz, revisa también el contraste y que no queden clases sin CSS.
3. Cuando el usuario diga "publica"/"sube" (o si ya lo pidió explícitamente en esa tarea): `git add -A && git commit -m "<qué cambió>" && git push`.
   Si no lo pidió, pregunta una vez "¿lo publico?" — publicar llega a usuarios reales.
4. Netlify corre las pruebas y despliega solo. Los usuarios reciben el diálogo **"Nueva versión disponible"** la próxima vez que abran o
   vuelvan a la app (tarda unos segundos en detectarse). **Si una prueba falla en Netlify, no se publica** (la versión anterior sigue viva).
5. Nunca uses `git push --force`, `git reset --hard` ni reescribas el historial sin que el usuario lo pida expresamente.

## Reglas que NO se pueden romper (perderían datos de usuarios reales)
- **No cambies** las claves de almacenamiento `finanzasos:v1`, `finanzasos:enc`, `finanzasos:corrupt:*`, ni la base IndexedDB
  `finanzasos-mirror`. Aunque la app se llame "BWAY X - Finanzas", esos nombres son internos.
- **No cambies el dominio** una vez repartido el enlace (los datos están ligados al origen).
- Si cambias el formato de los datos: sube `SCHEMA` en `js/store.js` y migra los datos viejos dentro de `load()`; conserva compatibilidad hacia atrás.
- Textos de usuario siempre con `esc()`; campos con `data-n` (ver `js/inputs.js`); **sin** `confirm/alert/prompt` nativos (usa `ask()` de `js/dialog.js`).
  Hay pruebas que fallan si se rompe alguna de estas reglas.
- Siempre se publica la carpeta que genera `build-deploy.sh` (`deploy/`), nunca la raíz: ahí el `sw.js` lleva la marca de versión que activa las actualizaciones.

## Comprobar la actualización en el teléfono
1. Abrir la PWA y cerrarla por completo (iPhone: deslizar hacia arriba; Android: apps recientes) para que cargue la última versión.
2. Hacer un cambio mínimo, `git push`, esperar a que Netlify diga *Published*.
3. Abrir la PWA (o volver a ella) y esperar ~10 s → debe salir el diálogo dorado **"Nueva versión disponible → Actualizar ahora"**.
   (La primera vez que se instala el mecanismo no puede avisarse a sí mismo; desde la segunda actualización sí.)

## Comandos útiles
| Qué | Comando |
|---|---|
| Probar en local | `python3 -m http.server 5173` → http://localhost:5173 |
| Pruebas | `npm test` |
| Generar carpeta de despliegue manual | `sh build-deploy.sh` (con zip) · `--no-zip` · `--skip-tests` |
| Estado de Git / último commit | `git status -sb` · `git log --oneline -5` |
| Ver sesión de GitHub | `gh auth status` |

## Si algo falla
| Síntoma | Qué hacer |
|---|---|
| `gh auth status` dice token inválido | `gh auth login -h github.com -w` y completar en el navegador |
| `git push` rechazado | `git pull --rebase origin main`, resolver, `npm test`, volver a hacer push (sin `--force`) |
| Build de Netlify falla | Pedir al usuario el log del deploy; casi siempre es una prueba rota o `NODE_VERSION` ≠ 22 |
| Pantalla en blanco tras publicar | Probar quitando `_headers` (política CSP estricta) en un commit aparte y revisar la consola del navegador |
| El usuario no ve el aviso de actualización | Revisar que se publicó desde Git (`sw.js` con hash del commit) y que cerró y reabrió la PWA |

## Mapa del código (`js/`)
`app.js` arranque y eventos · `ctx.js` estado, formato, bloqueo con PIN · `views.js` pantallas · `sheets.js` formularios ·
`dialog.js` alertas luxury · `derive.js` cálculos (pagos, deudas, alertas) · `actions.js` mutaciones · `store.js` persistencia + importación ·
`mirror.js` copia espejo/historial (IndexedDB) · `vault.js` cifrado AES-GCM · `advice.js`/`alerts.js` consejos y avisos ·
`debt.js` estrategias (avalancha/bola de nieve) · `xlsx.js` Excel con gráficos · `ics.js` calendario · `notify.js` notificaciones ·
`inputs.js`/`words.js` validación y monto en letras · `dates.js`, `money.js`, `fixed.js`, `charts.js`.
`sw.js` service worker (red primero + agenda de notificaciones). Pruebas en `tests/` (`npm test`).
