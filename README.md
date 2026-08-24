# DB-Lab — UTU 2026

Herramienta interactiva para practicar diseño de bases de datos en el aula: desde el diagrama **Entidad-Relación** (notación Chen) hasta el pasaje a tablas y la **normalización** (1FN/2FN/3FN).  
Diseñada por **Prof. Elizabeth Izquierdo** con asistencia de Claude — [licencia CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).

🌐 **Demo en vivo:** https://recursos-docentes.github.io/DB-Lab/

---

## Flujo de aprendizaje (4 etapas)

Cada ejercicio tiene etapas accesibles desde los botones superiores. Las primeras tres forman una secuencia por ejercicio (MER); la Normalización es un módulo aparte con sus propios ejercicios:

| Etapa | Descripción |
|-------|-------------|
| 📋 **Analizar el problema** | El estudiante lee el enunciado completo y clasifica cada término (entidad, atributo, relación) desde un panel lateral. Incluye subtipificación (clave, simple, multivaluado, compuesto, de relación, derivado; fuerte/débil). |
| 🔗 **Diseño E-R** | Arma el diagrama colocando los nombres en los nodos vacíos. Puede validar y guardar como PNG. |
| 📊 **Pasaje a tablas** | Convierte el modelo E-R a tablas relacionales: completa cada tabla con banco de palabras (incluye distractores), y escribe las restricciones de clave foránea (FK). Exporta a PDF con el enunciado y el historial de intentos. |
| 🧬 **Normalización** | Módulo independiente (no depende del MER): practica llevar una tabla sin normalizar hasta 3FN. Ver sección propia más abajo. |

---

## Modos de uso

### 📚 Ejercitación (por defecto)
- Cada etapa permite **hasta 3 intentos**. Al agotar los intentos, el botón se bloquea y los elementos quedan en solo lectura (fichas del analizador, banco de palabras e inputs del diagrama).
- El historial de puntajes (Intento 1 / 2 / 3) se muestra en el banner de feedback y se incluye al pie del PNG al guardar.
- Para avanzar al Diseño E-R se requiere al menos **50% correcto** en el análisis (o haber agotado los 3 intentos).

### 📝 Evaluación
Activado por el docente mediante el parámetro `?ex=1` en la URL. **No hay ningún indicador visible** en pantalla.

```
er-designer.html?ejercicio=2&ex=1
```

- Cada botón de corrección (análisis y diagrama) se puede usar **una sola vez**.
- Al evaluar, se habilita automáticamente el siguiente tab sin importar el puntaje.
- El modo persiste en `sessionStorage` aunque el estudiante refresque la página.

---

## Funcionalidades del análisis de texto

- **Fichas de términos** a clasificar en un panel lateral (el enunciado queda limpio y legible).
- **Dos pasos** para atributos: primero elegir "Atributo", luego el subtipo.
  - Subtipos disponibles: Simple, Clave, De relación, Compuesto, Multivaluado, Derivado.
  - Los subtipos se muestran **solo si existen en ese ejercicio** (opciones dinámicas).
  - En ejercicios básicos (0–2) **no se pregunta subtipo**: solo Entidad / Atributo / Relación.
- **Tres pasos** para atributos compuestos: identifica el tipo, luego selecciona los componentes.
- **Entidades:** si el ejercicio solo tiene entidades fuertes, se clasifican directo sin preguntar subtipo.
- **Estado persistente:** al cambiar al tab de Diseño E-R y volver, la clasificación se mantiene.
- **Historial de intentos:** muestra el puntaje de cada intento (hasta 3) en el banner y en el PNG exportado.
- **Ver respuestas:** después de 2 intentos fallidos en modo ejercitación.

## Panel RNE (Restricciones No Estructurales)

Disponible en el tab **Diseño E-R** para todos los ejercicios mediante el checkbox "📋 Activar panel RNE".

- **Activación automática** en ejercicios con `rne: "autorelacion"`, `"generalizacion"` o `"agregacion"`.
- **Activación manual** (checkbox) para RNE básicas de dominio en cualquier otro ejercicio.
- El panel muestra una **pista contextual** según el tipo de RNE (auto-relación, categorización, agregación, o restricción básica de dominio).
- La barra **INSERTAR** permite insertar rápidamente símbolos: `∀ ∈ ∉ ∩ ∪ ∅ → si` y operadores de comparación `> ≥ < ≤ = ≠`.
- El texto se guarda en `localStorage` con clave `rne_<índice>` y se restaura al volver al tab.
- Al exportar como **PNG**, el texto RNE se incluye como banda inferior en el diagrama si hay contenido.

### Campo `rne` en `exercises[]`

```js
rne: "basica"        // restricción de dominio (cualquier ejercicio)
rne: "autorelacion"  // activa hint de irreflexividad
rne: "generalizacion"// activa hint de disjunción/cobertura
rne: "agregacion"    // activa hint de existencia en relación base
// (omitir el campo → sin RNE predefinida; el checkbox sigue disponible)
```

Si `rne` se omite, la lógica infiere el tipo a partir del campo `concept` para los tres conceptos estructurales; en cualquier otro caso usa `"basica"`.

---

## Módulo de Normalización

Tab independiente (🧬 Normalización) para practicar llevar una tabla sin normalizar hasta **3FN**, con banco de palabras + distractores, igual mecánica de interacción que Pasaje a tablas.

### Ejercicios disponibles

| Índice | Caso | Multivaluado en 1FN |
|--------|------|----------------------|
| 0 | 📦 Pedidos | Teléfonos del cliente (un solo atributo) |
| 1 | 🎬 Alquiler de Películas | Directores de la película (un solo atributo) |
| 2 | 🎓 Inscripciones a Cursos | Teléfono del estudiante (un solo atributo) |

Los tres tienen la misma complejidad: un solo atributo multivaluado en la tabla original (nunca un grupo de varios atributos repetidos juntos — eso resultó más difícil de leer para los estudiantes). Cada uno termina en 4 tablas finales y 4 restricciones FK.

### Secuencia por paso (1FN / 2FN / 3FN)

Cada paso arma dinámicamente sus subfases según lo que declaren los datos (`_normStepPhases` en `normalize.js`):

1. **¿Hay alguna tabla que no cumple la forma normal?** — Sí/No simple si solo hay una tabla (siempre el caso en 1FN); si hay varias tablas (2FN/3FN), primero pregunta si existe alguna violación y **después** pide marcar cuáles.
2. **Identificar el atributo que viola la regla** — en 1FN, cuál no es atómico; en 3FN, cuál genera la dependencia transitiva.
3. **(Solo 3FN) ¿De qué atributo no clave depende?** — antes de la clasificación completa, aísla el atributo "puente" de la dependencia transitiva.
4. **Clasificar cada atributo** — en 1FN es un check simple (marcar solo los que pasan a la tabla nueva; los atributos compartidos, como la clave, también se marcan); en 2FN/3FN es elegir de qué depende cada atributo no clave.
5. **Armar la(s) tabla(s)** — banco de palabras con distractores, mismo mecanismo que Pasaje a tablas.

Al final de los 3 pasos: **esquema completo** + restricciones FK + exportar PDF (con enunciado, tabla original, e historial de intentos de cada paso).

### Navegación de referencia (sin perder el progreso)

- **📋 Original** (badge fijo, siempre disponible): vuelve a mostrar el enunciado y la tabla sin normalizar.
- **Badges 1FN/2FN/3FN ya completados** (verdes, clickeables): abren un resumen de solo lectura de las decisiones tomadas en ese paso (qué tabla violaba la regla, de qué dependía cada atributo, tablas resultantes).
- Ambos tienen un botón "← Volver al paso actual" que restaura exactamente dónde estaba el estudiante.

### Convenciones de datos (`normData.js`)

- Nombres de tabla **siempre en singular** en los datos (`INSCRIPCIÓN`, `TELÉFONO`, `PELÍCULA`...); se pluralizan al mostrarse con `_pluralize()`. **Nunca usar nombres compuestos con guion bajo** (ej. `TELÉFONO_EST`) — `_pluralize()` no los reconoce y arma plurales rotos (`TELÉFONO_ESTES`).
- `gateTables`: qué tablas existen en ese paso y si ya cumplen la forma normal.
- `violationOptions`/`violatingAttr`: solo si el paso pregunta "qué atributo viola la regla" (1FN y 3FN).
- `transitiveTargetOptions`/`transitiveTarget`: solo en 3FN, la pregunta de "de qué atributo no clave depende".
- `markToTable` (solo 1FN): activa la UI de marcar-si-pertenece-a-la-tabla-nueva en `dependencies[]`. Los atributos compartidos entre las dos tablas resultantes (típicamente la clave) también deben listarse con `dependsOn` apuntando a la tabla nueva.
- `dependencyOptions`/`dependencies[]` (2FN/3FN): de qué depende cada atributo no clave.
- `replaces`: qué tabla(s) del paso anterior desaparecen al descomponerse en `resultTables`. El nombre de la tabla original se conserva hasta el esquema final en vez de inventar uno nuevo.
- Una tabla nueva puede declarar `fkTo` hacia una tabla que **todavía no existe** (se crea recién en un paso posterior) — es válido porque para cuando se llega al esquema final esa FK ya apunta a algo real.

Para agregar un ejercicio nuevo: copiar el bloque de `📦 Pedidos` en `normData.js` como plantilla (es el más simple), y probar todo el flujo en el navegador antes de darlo por terminado.

---

## Accesibilidad y soporte para estudiantes con dificultades

| Función | Descripción |
|---------|-------------|
| 📖 **Conceptos E-R** | Modal con teoría en formato **acordeón** (clic para expandir). 6 ítems de primer nivel: Entidad, Atributo, Relación, Cardinalidad, Totalidad, RNE. Entidad y Atributo se subdividen en sub-ítems (fuerte/débil; simple-clave/compuesto/multivaluado/derivado/de relación). Cada sub-ítem incluye mini SVG de la representación gráfica y ejemplos contextualizados. |
| 📋 **Panel RNE** | En el tab Diseño E-R, todos los ejercicios muestran un checkbox "Activar panel RNE" para escribir restricciones no estructurales. Los ejercicios con RNE estructural (autorelación, categorización, agregación) lo activan automáticamente. El texto persiste en `localStorage` y se incluye como banda inferior en el PNG exportado. |
| 📚 **Glosario** | Modal con formas SVG y definición de cada concepto E-R. |
| ? **Tutorial** | Modal de 4 pasos automático en el primer uso, reabrble con `?`. |
| 💡 **Ver respuestas** | Botón en el **tab Analizar el problema**: aparece en el feedback tras 2 intentos fallidos en modo ejercitación. Muestra la clasificación correcta de cada término (en violeta) directamente sobre las fichas del panel. Solo disponible en modo ejercitación, nunca en evaluación. |
| ⬆️ **Comparación de intentos** | Muestra si mejoró, empeoró o se mantuvo respecto al intento anterior. |

---

## Estructura de archivos

```
merTutor-main/
├── index.html               ← Página de inicio con ejercicios por concepto
├── er-designer.html         ← Aplicación principal (Analizar → Diseño E-R → Tablas → Normalización)
├── exercises.js             ← Datos MER: exercises[], analyzeData[], analyzeConfig[]
├── script.js                ← UI: variables globales, loadExercise(), canvas render
├── diagram.js               ← Diagrama: drawCrispConnectors(), validación, PNG
├── analysis.js              ← Análisis: modo eval, panel de clasificación, setStage()
├── tablesData.js            ← Datos de Pasaje a tablas
├── tables.js                ← Lógica de Pasaje a tablas (banco de palabras, FK, PDF)
├── normData.js              ← Datos del módulo de Normalización (3 ejercicios)
├── normalize.js             ← Lógica del módulo de Normalización
├── styles.css               ← Estilos personalizados
├── add-exercise-wizard.html ← Asistente para crear nuevos ejercicios (MER)
└── README.md                ← Este archivo
```

> **Nota sobre caché:** Los archivos JS se cargan con `?t=45` en `er-designer.html` e `index.html`. Al subir cambios que los estudiantes no ven reflejados, incrementar ese número **en ambos archivos, en todos los `<script>` afectados**.

---

## Ejercicios disponibles (Diseño E-R)

| Índice | Caso | Concepto | Estado |
|--------|------|---------|--------|
| 0 | 🔧 Taller Mecánico | Atributos especiales (atributo de relación, N:N) | ✅ |
| 1 | 📚 Biblioteca Escolar | Atributos especiales (atributo de relación, N:N) | ✅ |
| 2 | 🛒 Tienda Online | Relaciones simples (1:N) | ✅ |
| 3 | 🌐 Red Social | Generalización / ISA | ✅ |
| 4 | 📺 Plataforma de Streaming | Atributos especiales (compuesto, multivaluado) | ✅ |
| 5 | 🏥 Sistema Hospitalario | Relaciones simples (1:N) | ✅ |
| 6 | 🏫 Institución educativa | Atributos especiales (compuesto, derivado, N:N) | ✅ |
| 7 | 🏫 Colegio | Totalidad / Participación | ✅ |
| 8 | 🎬 Película | Entidad débil | ✅ |
| 9 | ⚽ Fútbol | Autorelación | ✅ |
| 10 | 🎵 Música | Relaciones simples (N:N, N:1) | ✅ |
| 11 | 📖 Biblioteca2 | Entidad débil | ✅ |
| 12 | 🔩 Almacén de Piezas | Autorelación + entidad débil | ✅ |
| 13 | 🏫 Instituto | Agregación | ✅ |

---

## Agregar un nuevo ejercicio

### Método rápido: Asistente visual

Abrir `add-exercise-wizard.html` en el navegador. Genera automáticamente el código para los 4 bloques que hay que pegar.

**Cómo insertar el emoji del título:**
1. Hacer clic en el campo "Título" del asistente
2. Presionar **Win + .** (tecla Windows + punto)
3. Buscar por palabra (ej: "music", "hospital", "school")
4. Hacer clic en el emoji → se inserta donde está el cursor

Para autorelación, la sintaxis en el campo de relaciones es:
```
juega_con | CLUB | CLUB | >locatario | >visitante | FechaPartido
```
(entidad1 = entidad2, roles con prefijo `>`, atributos de relación al final)

---

### Método manual

#### Paso 1 — Código del ejercicio (`exercises.js`)

Agregar al final del array `exercises[]` en `exercises.js`, antes del `];` y separado por coma:

```js
{
    title: "Nombre del ejercicio",
    description: `HTML con el enunciado.`,
    hint: "Sugerencia pedagógica.",
    wordBank: ["ENTIDAD_A", "ENTIDAD_B", "relacion", "Atrib1", "1", "N"],
    nodes: [
        { id: "e1", type: "entity",      correctValue: "ENTIDAD_A",  x: 20, y: 50, w: 110, h: 52 },
        { id: "r1", type: "relation",    correctValue: "relacion",   x: 50, y: 50, w: 80,  h: 80 },
        { id: "a1", type: "attribute",   isKey: false, correctValue: "Atrib1", x: 20, y: 22, w: 92, h: 40 },
        { id: "pk", type: "attribute",   isKey: true,  correctValue: "Id",     x: 10, y: 22, w: 92, h: 40 },
        { id: "mv", type: "attribute",   isMultivalued: true, correctValue: "Tags", x: 30, y: 22, w: 92, h: 40 },
        { id: "dv", type: "attribute",   isDerived: true,     correctValue: "Edad", x: 40, y: 22, w: 92, h: 40 },
        { id: "c1", type: "cardinality", correctValue: "1",  x: 35, y: 50, w: 30, h: 30 },
        { id: "c2", type: "cardinality", correctValue: "N",  x: 65, y: 50, w: 30, h: 30 },
        { id: "t1", type: "totalidad",   correctValue: "S",  x: 32, y: 45, w: 28, h: 24 }
    ],
    connections: [
        { from: "pk", to: "e1" },
        { from: "a1", to: "e1" },
        { from: "e1", to: "r1" },
        { from: "r1", to: "e2" }
    ],
    // METADATOS
    concept: "relaciones_simples",
    availableFor: ["class", "home", "eval"],
    enabled: true
}
```

##### Posicionamiento de nodos

| Propiedad | Descripción |
|-----------|-------------|
| `x` | Centro horizontal en **%** del canvas (canvas = 1060 px). |
| `y` | Centro vertical en **%** del canvas (canvas = 540 px). |
| `w` / `h` | Tamaño en px. Guía: entidad 110 · relación 80 (autorelación 100) · atributo 92 · cardinalidad 30. |

```
y ≈  6%  →  sub-atributos de compuesto
y ≈ 22%  →  atributos principales (PK, etc.)
y ≈ 45%  →  entidades y relaciones  ← fila principal
y ≈ 72%  →  atributos de relación / multivaluados
```

##### Autorelación

Entidad y relación comparten la misma `y`. El rombo usa `w: 100, h: 100`. Las conexiones llevan `role`. Las cardinalidades van en `y: 20` (superior) y `y: 40` (inferior):

```js
{ id: "e_0",   type: "entity",      correctValue: "CLUB",      x: 30, y: 30, w: 110, h: 52 },
{ id: "r_1",   type: "relation",    correctValue: "juega_con", x: 60, y: 30, w: 100, h: 100 },
{ id: "c_top", type: "cardinality", correctValue: "N",         x: 43, y: 20, w: 30,  h: 30 },
{ id: "c_bot", type: "cardinality", correctValue: "N",         x: 43, y: 40, w: 30,  h: 30 },
// Conexiones
{ from: "e_0", to: "r_1", role: "locatario" },
{ from: "r_1", to: "e_0", role: "visitante" },
```

##### Totalidad (participación)

Nodos `type: "totalidad"` con `correctValue: "S"` (total) o `"N"` (parcial). Posicionar entre la entidad y la relación. El diagrama dibuja el círculo doble automáticamente al validar.

##### Visibilidad (`enabled`)

- `enabled: true` → aparece en `index.html`
- `enabled: false` → accesible desde `er-designer.html` pero no en la página de inicio

---

#### Paso 2 — Análisis de términos (`exercises.js`)

Agregar al array `analyzeData[]` en la **misma posición** que el ejercicio. Cada elemento es un string o un objeto término:

```js
{ word: "término", type: "entidad|atributo|relacion", entityType: "fuerte|débil", attrType: "simple|clave|compuesto|multivaluado|derivado|relacion" }
```

**Reglas:**
- `entityType` → siempre en entidades (`"fuerte"` o `"débil"`).
- `attrType` → siempre en atributos.

```js
[
    "Un hospital desea registrar sus médicos y pacientes.\n\n",
    "• De cada ", { word:"Médico", type:"entidad", entityType:"fuerte" }, " se guarda ",
    { word:"matricula", type:"atributo", attrType:"clave" }, ", ",
    { word:"nombre",    type:"atributo", attrType:"simple" }, ".\n",
    "• Un médico puede ", { word:"atender", type:"relacion" }, " muchos pacientes.\n"
]
```

> ⚠️ **Importante:** `exercises[]`, `analyzeData[]` y `analyzeConfig[]` deben tener exactamente el mismo número de entradas alineadas por índice. Una **coma faltante** entre entradas rompe el array en JavaScript sin error visible — verificar con la consola del navegador si algo no carga.

---

#### Paso 3 — Configuración (`exercises.js`)

Agregar al array `analyzeConfig[]` en la misma posición:

```js
{ requireSubtypes: true }   // true → pide subtipo de atributo | false → no pide
```

---

#### Paso 4 — Selectores en `er-designer.html`

Agregar la misma opción en **los dos** `<select>` del archivo (`exercise-select` y `analyze-select`):

```html
<option value="9">⚽ Fútbol</option>
```

El `value` debe ser el índice del ejercicio en `exercises[]`.

---

#### Paso 5 — Página de inicio (`index.html`)

Si `enabled: true` y `concept` está definido con una sección activa, el botón aparece automáticamente. No se requiere código adicional.

Secciones activas en `index.html`:

| `concept` | Sección visible |
|-----------|----------------|
| `relaciones_simples` | Entidades, atributos y relaciones |
| `atributos_especiales` | Atributos especiales |
| `participacion` | Totalidad (participación) |
| `autorelacion` | Autorelación |
| `generalizacion` | Generalización/Categorización (ISA) |
| `entidad_debil` | Entidades débiles |
| `agregacion` | Agregación |

---

## Tecnologías

- **HTML + JavaScript vanilla** — sin frameworks ni bundlers
- **Tailwind CSS** vía CDN
- **html2canvas** — exportación del diagrama como PNG
- **GitHub Pages** — despliegue directo de archivos estáticos

No requiere instalación ni build. Para desplegar: subir los archivos al repositorio y activar GitHub Pages desde la rama `main`.