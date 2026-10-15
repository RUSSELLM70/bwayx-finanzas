# Publicar BWAY X - Finanzas para tu comunidad

La app es 100 % estática (HTML/CSS/JS): no necesita servidor, base de datos ni build. Solo hosting con **HTTPS**
(obligatorio para instalarla como app, para el cifrado con PIN y para funcionar sin conexión).

## Opciones gratuitas (arrastrar la carpeta o conectar el repo)
- **Cloudflare Pages**: Create project → Upload assets → sube esta carpeta. Directorio de salida: la raíz. Sin build command.
- **Netlify**: app.netlify.com/drop → arrastra la carpeta.
- **GitHub Pages**: sube el proyecto a un repo → Settings → Pages → rama `main`, carpeta `/ (root)`.

## Antes de compartir el enlace (importante)
1. **Elige el dominio definitivo ya.** Los datos de cada persona están ligados al dominio exacto. Si después cambias de
   URL, los usuarios "pierden" sus datos (siguen en el dominio viejo). Mejor un dominio propio estable que uno temporal.
2. Prueba en un iPhone (Safari) y en un Android (Chrome): abrir, instalar, cargar datos de ejemplo, cerrar y reabrir.
3. Comparte el **enlace https**, nunca el archivo `index.html` suelto (no funciona por `file://`).

## Actualizaciones
Sube los archivos nuevos y listo: el service worker toma siempre la versión más reciente cuando hay internet.
Los datos de los usuarios no se tocan. Si cambias el formato de datos, añade compatibilidad en `store.js → load()`.

## Mensaje sugerido para tus usuarios
1. Abre el enlace y **instala la app** (iPhone: Safari → Compartir → "Agregar a pantalla de inicio"; Android: menú ⋮ → "Instalar app").
2. Tus datos se guardan solo en tu teléfono. Haz una **copia de seguridad** cada semana (Ajustes → Copia de seguridad).
3. Si activas el PIN y lo olvidas, no hay forma de recuperarlo.

---

# Actualizaciones automáticas (recomendado)

## Cómo llegan las actualizaciones a los usuarios
1. Tú publicas una versión nueva (ver abajo).
2. Cada vez que el usuario abre la app, vuelve a ella o pasa una hora, el navegador busca cambios.
3. Si hay versión nueva, aparece el aviso **"Nueva versión disponible"** → "Actualizar ahora". Sus datos no se tocan.
4. Si abre la app sin internet, usa la última versión guardada.

`build-deploy.sh` marca cada publicación con una versión única; por eso el navegador siempre detecta el cambio.

## Publicar sin arrastrar carpetas: GitHub + Netlify
1. Crea un repositorio en GitHub y sube este proyecto (el `.gitignore` ya excluye `deploy/` y el zip).
2. En Netlify: Add new site → Import from Git → elige el repo. Lee `netlify.toml` solo (comando y carpeta `deploy`).
3. Desde entonces: `git push` → Netlify corre las pruebas, construye y publica. **Si una prueba falla, no se publica**, así no llega una versión rota a tus usuarios.

## Reglas para no romper datos al actualizar
- Nunca cambies las claves `finanzasos:*` de `store.js` / `vault.js` ni el nombre de la base `finanzasos-mirror`.
- Si cambias el formato de los datos, sube `SCHEMA` en `store.js` y convierte los datos viejos en `load()`.
- Cambiar de dominio hace que los usuarios pierdan sus datos: decide el definitivo antes de repartir el enlace.
