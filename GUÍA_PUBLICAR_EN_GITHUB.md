# 🚀 Guía: Subir cambios a GitHub y publicar como página web

Todo desde el navegador, sin instalar nada.

---

## Primera vez: crear el repositorio y subir los archivos

### 1. Crear una cuenta en GitHub

Ir a [github.com](https://github.com) y registrarse (es gratis).

### 2. Crear un repositorio nuevo

1. Clic en el botón verde **New** (o en el `+` arriba a la derecha → **New repository**)
2. Completar:
   - **Repository name**: `DB-Lab`
   - **Description**: opcional
   - Marcar **Public** (necesario para GitHub Pages gratuito)
   - Marcar **Add a README file**
3. Clic en **Create repository**

### 3. Subir los archivos del proyecto

1. Dentro del repositorio, clic en **Add file → Upload files**
2. Arrastrar todos los archivos del proyecto o usar el selector
3. En el campo **Commit changes** escribir una descripción, por ejemplo: `Versión inicial`
4. Clic en **Commit changes**

---

## Activar GitHub Pages (solo se hace una vez)

1. Dentro del repositorio, clic en **Settings** (pestaña superior)
2. En el menú izquierdo, clic en **Pages**
3. En **Source**, seleccionar **Deploy from a branch**
4. En **Branch**, elegir `main` y carpeta `/ (root)`
5. Clic en **Save**

Después de 1–2 minutos el sitio queda publicado en:
```
https://TU-USUARIO.github.io/DB-Lab/
```

> Para acceder directo al diseñador: `https://TU-USUARIO.github.io/DB-Lab/er-designer.html`

---

## Actualizar un archivo (flujo habitual)

Para actualizar, por ejemplo, `exercises.js`:

1. Ir al repositorio en github.com
2. Hacer clic en el archivo a actualizar (ej. `exercises.js`)
3. Clic en el ícono del lápiz ✏️ (**Edit this file**) — arriba a la derecha del contenido
4. Realizar los cambios directamente en el editor
5. Abajo, en **Commit changes**, escribir una descripción breve del cambio
6. Clic en **Commit changes**

El sitio web se actualiza solo en 1–2 minutos.

---

## Reemplazar un archivo completo

Si se modificó el archivo en la computadora y se necesita reemplazarlo en GitHub:

1. Dentro del repositorio, navegar a la carpeta donde está el archivo
2. Clic en **Add file → Upload files**
3. Subir el archivo con el **mismo nombre** — GitHub lo reemplaza automáticamente
4. Escribir una descripción y clic en **Commit changes**

---

## Verificar que el deploy funcionó

En el repositorio → pestaña **Actions** se puede ver el estado:
- 🟡 En proceso (esperar)
- ✅ Publicado correctamente
- ❌ Error (clic para ver el detalle)

---

## Solución de problemas

| Problema | Solución |
|----------|----------|
| El sitio no aparece después de activar Pages | Esperar 2–3 min y recargar |
| Los cambios no se reflejan | Esperar 1–2 min y recargar con **Ctrl+Shift+R** |
| El sitio muestra versión vieja | Incrementar `?t=N` en las etiquetas `<script>` de `er-designer.html` e `index.html` |
| Error 404 al abrir el sitio | Verificar que el archivo `index.html` esté en la raíz del repositorio |
| No aparece el botón ✏️ | Verificar que la sesión de GitHub esté iniciada |
