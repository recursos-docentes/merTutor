// normData.js — Datos de "Normalización" para DB-Lab
//
// Convención de nombres: igual que tablesData.js — los nombres de tabla se
// guardan en SINGULAR acá; se pluralizan al mostrarlos con _pluralize()
// (normalize.js), no en los datos.
//
// Cada paso primero pregunta si la tabla actual cumple esa forma normal (Sí/No).
// Si no cumple (que es siempre el caso en estos ejercicios de práctica):
//   - 1FN: se arman directamente las 2 tablas resultantes (la clave+atributos fijos,
//     y la nueva tabla con la clave + el grupo repetido) — la violación ya es visible
//     en la tabla sin normalizar, no hace falta preguntarla aparte.
//   - 2FN/3FN: primero se pregunta, atributo por atributo, de qué depende cada uno
//     (dependencies/dependencyOptions), y recién con eso se arman las tablas.
//
// "replaces" declara qué tabla(s) de un paso anterior desaparecen al descomponerse
// en las resultTables de este paso. El nombre INSCRIPCIÓN (la relación original,
// sin normalizar) se conserva a propósito hasta el esquema final: en 1FN nace como
// la tabla clave+grupo repetido, y en 2FN se reduce a clave+Nota, pero sigue
// llamándose igual en vez de inventar un nombre nuevo (ej. "DETALLE_CURSO").
//
// Licencia CC BY-SA 4.0 — Prof. Elizabeth Izquierdo con asistencia de Claude

const normData = [

// ─────────────────────────────────────────────────────────────────────────────
// EJ 0 — Pedidos
// ─────────────────────────────────────────────────────────────────────────────
// FD detectadas en los datos de ejemplo: CodArt→Precio ; CI→NomCliente,ApeCliente,
// Ciudad,Teléfonos* ; Ciudad→Distancia (transitiva: Distancia depende de Ciudad,
// no directamente de CI). El TELÉFONO nace en 1FN con FK a CLIENTE, aunque CLIENTE
// recién se crea como tabla en 2FN — para cuando se llega al esquema final esa FK
// ya es válida (apunta a una tabla que sí existe).
{
    title: "📦 Pedidos",
    context: `Una empresa registra en una única tabla los pedidos que realizan sus clientes sobre los artículos disponibles.<br><br>
        Para cada pedido se guarda el código del artículo (CodArt), la cédula del cliente (CI) junto con su nombre y apellido, los teléfonos del cliente, la cantidad pedida, el precio del artículo, y la ciudad del cliente junto con la distancia de esa ciudad al depósito.`,
    rawTable: {
        name: "PEDIDO",
        fixedFields: ["CodArt", "CI", "NomCliente", "ApeCliente", "Cantidad", "Precio", "Ciudad", "Distancia"],
        repeatingLabel: "Teléfonos (varios por cliente)",
        repeatingFields: ["Teléfono"],
        keyFields: ["CodArt", "CI"],
        // Nota: acá lo multivaluado es un único campo (Teléfono), no un grupo de
        // varios campos como en el ejercicio de Inscripciones — por eso el layout
        // de la tabla sin normalizar es distinto (ver _renderRawTable en normalize.js
        // con rt.singleMultivalued).
        singleMultivalued: true,
        rows: [
            { fixed: ["A1", "111", "Jhoni", "Meentero", "12", "100", "La Paz",      "15"], values: ["094-233-333", "099-231-876"] },
            { fixed: ["A1", "222", "Lola",  "Mento",    "30", "100", "Las Piedras", "20"], values: ["098-342-343"] },
            { fixed: ["A1", "555", "Elsa",  "Pato",     "15", "100", "Progreso",    "30"], values: ["099-233-900"] },
            { fixed: ["A2", "111", "Jhoni", "Meentero", "35", "250", "La Paz",      "15"], values: ["094-233-333", "099-231-876"] },
            { fixed: ["A2", "222", "Lola",  "Mento",    "20", "250", "Las Piedras", "20"], values: ["098-342-343"] },
            { fixed: ["A2", "333", "Esteban","Quito",   "10", "250", "La Paz",      "15"], values: ["093-897-999"] },
            { fixed: ["A3", "555", "Elsa",  "Pato",     "25", "175", "Progreso",    "30"], values: ["099-233-900"] }
        ]
    },
    steps: [
        // ── Paso 1FN ──────────────────────────────────────────────────────
        {
            formaNormal: "1FN",
            gateTables: [{ table: "PEDIDO", isCompliant: false }],
            complianceExplain: "El campo Teléfono contiene varios valores (uno por cada teléfono del cliente) dentro de una misma fila. No es atómico.",
            violationQuestion: "¿Qué atributo viola la regla de 1FN?",
            violatingAttr: "Teléfono",
            violationOptions: ["CodArt", "CI", "NomCliente", "ApeCliente", "Cantidad", "Precio", "Ciudad", "Distancia", "Teléfono"],
            sourceTable: "PEDIDO",
            markToTable: "TELÉFONO",
            dependencyOptions: ["PEDIDO", "TELÉFONO"],
            dependencies: [
                { attr: "CodArt",     dependsOn: "PEDIDO" },
                { attr: "CI",         dependsOn: "TELÉFONO" },
                { attr: "NomCliente", dependsOn: "PEDIDO" },
                { attr: "ApeCliente", dependsOn: "PEDIDO" },
                { attr: "Cantidad",   dependsOn: "PEDIDO" },
                { attr: "Precio",     dependsOn: "PEDIDO" },
                { attr: "Ciudad",     dependsOn: "PEDIDO" },
                { attr: "Distancia",  dependsOn: "PEDIDO" },
                { attr: "Teléfono",   dependsOn: "TELÉFONO" }
            ],
            resultTables: [
                {
                    name: "PEDIDO",
                    fields: [
                        { name: "CodArt",     isPK: true  },
                        { name: "CI",         isPK: true  },
                        { name: "NomCliente", isPK: false },
                        { name: "ApeCliente", isPK: false },
                        { name: "Cantidad",   isPK: false },
                        { name: "Precio",     isPK: false },
                        { name: "Ciudad",     isPK: false },
                        { name: "Distancia",  isPK: false }
                    ]
                },
                {
                    name: "TELÉFONO",
                    fields: [
                        { name: "CI",       isPK: true, isFK: true, fkTo: "CLIENTE" },
                        { name: "Teléfono", isPK: true }
                    ]
                }
            ]
        },
        // ── Paso 2FN ──────────────────────────────────────────────────────
        {
            formaNormal: "2FN",
            gateTables: [
                { table: "PEDIDO",   isCompliant: false },
                { table: "TELÉFONO", isCompliant: true }
            ],
            complianceExplain: "En PEDIDO, NomCliente, ApeCliente, Ciudad y Distancia dependen solo de CI, y Precio depende solo de CodArt. Ninguno depende de toda la clave (CodArt + CI). Son dependencias parciales.",
            sourceTable: "PEDIDO",
            dependencyQuestion: "¿De qué depende cada atributo no clave de PEDIDO?",
            dependencyOptions: ["CodArt", "CI", "CodArt + CI (toda la clave)"],
            dependencies: [
                { attr: "NomCliente", dependsOn: "CI" },
                { attr: "ApeCliente", dependsOn: "CI" },
                { attr: "Precio",     dependsOn: "CodArt" },
                { attr: "Ciudad",     dependsOn: "CI" },
                { attr: "Distancia",  dependsOn: "CI" },
                { attr: "Cantidad",   dependsOn: "CodArt + CI (toda la clave)" }
            ],
            replaces: ["PEDIDO"],
            resultTables: [
                {
                    name: "CLIENTE",
                    fields: [
                        { name: "CI",         isPK: true  },
                        { name: "NomCliente", isPK: false },
                        { name: "ApeCliente", isPK: false },
                        { name: "Ciudad",     isPK: false },
                        { name: "Distancia",  isPK: false }
                    ]
                },
                {
                    name: "ARTICULO",
                    fields: [
                        { name: "CodArt", isPK: true  },
                        { name: "Precio", isPK: false }
                    ]
                },
                {
                    name: "PEDIDO",
                    fields: [
                        { name: "CodArt",   isPK: true, isFK: true, fkTo: "ARTICULO" },
                        { name: "CI",       isPK: true, isFK: true, fkTo: "CLIENTE" },
                        { name: "Cantidad", isPK: false }
                    ]
                }
            ]
        },
        // ── Paso 3FN ──────────────────────────────────────────────────────
        {
            formaNormal: "3FN",
            gateTables: [
                { table: "TELÉFONO", isCompliant: true },
                { table: "CLIENTE",  isCompliant: false },
                { table: "ARTICULO", isCompliant: true },
                { table: "PEDIDO",   isCompliant: true }
            ],
            complianceExplain: "En CLIENTE, Distancia depende de Ciudad, y Ciudad depende de CI. Distancia depende de un atributo no clave, no directamente de la clave: es una dependencia transitiva.",
            violationQuestion: "¿Qué atributo no clave genera la dependencia transitiva?",
            violatingAttr: "Distancia",
            violationOptions: ["NomCliente", "ApeCliente", "Ciudad", "Distancia"],
            transitiveTarget: "Ciudad",
            transitiveTargetOptions: ["NomCliente", "ApeCliente", "Ciudad"],
            sourceTable: "CLIENTE",
            dependencyQuestion: "¿De qué depende cada atributo no clave de CLIENTE?",
            dependencyOptions: ["CI (la clave)", "Ciudad"],
            dependencies: [
                { attr: "NomCliente", dependsOn: "CI (la clave)" },
                { attr: "ApeCliente", dependsOn: "CI (la clave)" },
                { attr: "Ciudad",     dependsOn: "CI (la clave)" },
                { attr: "Distancia",  dependsOn: "Ciudad" }
            ],
            replaces: ["CLIENTE"],
            resultTables: [
                {
                    name: "CIUDAD",
                    fields: [
                        { name: "Ciudad",    isPK: true  },
                        { name: "Distancia", isPK: false }
                    ]
                },
                {
                    name: "CLIENTE",
                    fields: [
                        { name: "CI",         isPK: true  },
                        { name: "NomCliente", isPK: false },
                        { name: "ApeCliente", isPK: false },
                        { name: "Ciudad",     isPK: false, isFK: true, fkTo: "CIUDAD" }
                    ]
                }
            ]
        }
    ]
},

// ─────────────────────────────────────────────────────────────────────────────
// EJ 1 — Alquiler de Películas (plataforma de streaming)
// ─────────────────────────────────────────────────────────────────────────────
// FD detectadas en los datos de ejemplo: Id_Película→Nom_Peli,Duración,Categoría,
// NomDirector* ; CI_Socio→Nom_Socio ; Categoría→Precio_Alquiler (transitiva: Precio_Alquiler
// depende de Categoría, no directamente de Id_Película) ; Fecha depende de toda la
// clave (Id_Película + CI_Socio, es el dato propio de ese alquiler). El DIRECTOR
// nace en 1FN con FK a PELÍCULA, aunque PELÍCULA recién se crea como tabla en 2FN
// — igual que TELÉFONO→CLIENTE en el ejercicio de Pedidos.
{
    title: "🎬 Alquiler de Películas",
    context: `Una plataforma de streaming registra en una única tabla los alquileres que realizan sus socios sobre las películas disponibles.<br><br>
        Para cada alquiler se guarda el identificador de la película (Id_Película) junto con su nombre, duración, categoría y precio de alquiler, el o los directores de la película, la cédula del socio (CI_Socio) junto con su nombre, y la fecha en que se realizó el alquiler.`,
    rawTable: {
        name: "ALQUILER",
        fixedFields: ["Id_Película", "CI_Socio", "Nom_Peli", "Duración", "Categoría", "Precio_Alquiler", "Fecha", "Nom_Socio"],
        repeatingLabel: "Directores (varios por película)",
        repeatingFields: ["NomDirector"],
        keyFields: ["Id_Película", "CI_Socio"],
        singleMultivalued: true,
        // Nombres de socios y directores con juego de palabras (mismo estilo que el
        // ejercicio de Pedidos: Elba Rato → "el barato", Armando Casas → "armando casas",
        // Dolores Barriga → "dolores de barriga", Roldán Toma → "rodando toma", etc.)
        rows: [
            { fixed: ["PEL01", "3222111", "Estación Terminal", "118", "Estreno",  "180", "02/03/2026", "Elba Rato"],     values: ["Roldán Toma", "Mara Villa"] },
            { fixed: ["PEL01", "4555222", "Estación Terminal", "118", "Estreno",  "180", "05/03/2026", "Armando Casas"], values: ["Roldán Toma", "Mara Villa"] },
            { fixed: ["PEL02", "3222111", "El Último Tren",    "95",  "Catálogo", "70",  "03/03/2026", "Elba Rato"],     values: ["Casimiro Rollo"] },
            { fixed: ["PEL02", "4888999", "El Último Tren",    "95",  "Catálogo", "70",  "08/03/2026", "Dolores Barriga"], values: ["Casimiro Rollo"] },
            { fixed: ["PEL03", "4555222", "Costa Brava",       "105", "Catálogo", "70",  "06/03/2026", "Armando Casas"], values: ["Elena Cámara"] },
            { fixed: ["PEL03", "4888999", "Costa Brava",       "105", "Catálogo", "70",  "09/03/2026", "Dolores Barriga"], values: ["Elena Cámara"] },
            { fixed: ["PEL01", "4888999", "Estación Terminal", "118", "Estreno",  "180", "10/03/2026", "Dolores Barriga"], values: ["Roldán Toma", "Mara Villa"] }
        ]
    },
    steps: [
        // ── Paso 1FN ──────────────────────────────────────────────────────
        {
            formaNormal: "1FN",
            gateTables: [{ table: "ALQUILER", isCompliant: false }],
            complianceExplain: "El campo NomDirector contiene varios valores (uno por cada director de la película) dentro de una misma fila. No es atómico.",
            violationQuestion: "¿Qué atributo viola la regla de 1FN?",
            violatingAttr: "NomDirector",
            violationOptions: ["Id_Película", "CI_Socio", "Nom_Peli", "Duración", "Categoría", "Precio_Alquiler", "Fecha", "Nom_Socio", "NomDirector"],
            sourceTable: "ALQUILER",
            markToTable: "DIRECTOR",
            dependencyOptions: ["ALQUILER", "DIRECTOR"],
            dependencies: [
                { attr: "Id_Película",     dependsOn: "DIRECTOR" },
                { attr: "CI_Socio",        dependsOn: "ALQUILER" },
                { attr: "Nom_Peli",        dependsOn: "ALQUILER" },
                { attr: "Duración",        dependsOn: "ALQUILER" },
                { attr: "Categoría",       dependsOn: "ALQUILER" },
                { attr: "Precio_Alquiler", dependsOn: "ALQUILER" },
                { attr: "Fecha",           dependsOn: "ALQUILER" },
                { attr: "Nom_Socio",       dependsOn: "ALQUILER" },
                { attr: "NomDirector",     dependsOn: "DIRECTOR" }
            ],
            resultTables: [
                {
                    name: "ALQUILER",
                    fields: [
                        { name: "Id_Película",     isPK: true  },
                        { name: "CI_Socio",        isPK: true  },
                        { name: "Nom_Peli",        isPK: false },
                        { name: "Duración",        isPK: false },
                        { name: "Categoría",       isPK: false },
                        { name: "Precio_Alquiler", isPK: false },
                        { name: "Fecha",           isPK: false },
                        { name: "Nom_Socio",       isPK: false }
                    ]
                },
                {
                    name: "DIRECTOR",
                    fields: [
                        { name: "Id_Película", isPK: true, isFK: true, fkTo: "PELÍCULA" },
                        { name: "NomDirector", isPK: true }
                    ]
                }
            ]
        },
        // ── Paso 2FN ──────────────────────────────────────────────────────
        {
            formaNormal: "2FN",
            gateTables: [
                { table: "ALQUILER",  isCompliant: false },
                { table: "DIRECTOR",  isCompliant: true }
            ],
            complianceExplain: "En ALQUILER, Nom_Peli, Duración, Categoría y Precio_Alquiler dependen solo de Id_Película, y Nom_Socio depende solo de CI_Socio. Ninguno depende de toda la clave (Id_Película + CI_Socio). Son dependencias parciales.",
            sourceTable: "ALQUILER",
            dependencyQuestion: "¿De qué depende cada atributo no clave de ALQUILER?",
            dependencyOptions: ["Id_Película", "CI_Socio", "Id_Película + CI_Socio (toda la clave)"],
            dependencies: [
                { attr: "Nom_Peli",        dependsOn: "Id_Película" },
                { attr: "Duración",        dependsOn: "Id_Película" },
                { attr: "Categoría",       dependsOn: "Id_Película" },
                { attr: "Precio_Alquiler", dependsOn: "Id_Película" },
                { attr: "Nom_Socio",       dependsOn: "CI_Socio" },
                { attr: "Fecha",           dependsOn: "Id_Película + CI_Socio (toda la clave)" }
            ],
            replaces: ["ALQUILER"],
            resultTables: [
                {
                    name: "PELÍCULA",
                    fields: [
                        { name: "Id_Película",     isPK: true  },
                        { name: "Nom_Peli",        isPK: false },
                        { name: "Duración",        isPK: false },
                        { name: "Categoría",       isPK: false },
                        { name: "Precio_Alquiler", isPK: false }
                    ]
                },
                {
                    name: "SOCIO",
                    fields: [
                        { name: "CI_Socio",  isPK: true  },
                        { name: "Nom_Socio", isPK: false }
                    ]
                },
                {
                    name: "ALQUILER",
                    fields: [
                        { name: "Id_Película", isPK: true, isFK: true, fkTo: "PELÍCULA" },
                        { name: "CI_Socio",    isPK: true, isFK: true, fkTo: "SOCIO" },
                        { name: "Fecha",       isPK: false }
                    ]
                }
            ]
        },
        // ── Paso 3FN ──────────────────────────────────────────────────────
        {
            formaNormal: "3FN",
            gateTables: [
                { table: "DIRECTOR",  isCompliant: true },
                { table: "PELÍCULA",  isCompliant: false },
                { table: "SOCIO",     isCompliant: true },
                { table: "ALQUILER",  isCompliant: true }
            ],
            complianceExplain: "En PELÍCULA, Precio_Alquiler depende de Categoría, y Categoría depende de Id_Película. Precio_Alquiler depende de un atributo no clave, no directamente de la clave: es una dependencia transitiva.",
            violationQuestion: "¿Qué atributo no clave genera la dependencia transitiva?",
            violatingAttr: "Precio_Alquiler",
            violationOptions: ["Nom_Peli", "Duración", "Categoría", "Precio_Alquiler"],
            transitiveTarget: "Categoría",
            transitiveTargetOptions: ["Nom_Peli", "Duración", "Categoría"],
            sourceTable: "PELÍCULA",
            dependencyQuestion: "¿De qué depende cada atributo no clave de PELÍCULA?",
            dependencyOptions: ["Id_Película (la clave)", "Categoría"],
            dependencies: [
                { attr: "Nom_Peli",        dependsOn: "Id_Película (la clave)" },
                { attr: "Duración",        dependsOn: "Id_Película (la clave)" },
                { attr: "Categoría",       dependsOn: "Id_Película (la clave)" },
                { attr: "Precio_Alquiler", dependsOn: "Categoría" }
            ],
            replaces: ["PELÍCULA"],
            resultTables: [
                {
                    name: "CATEGORÍA",
                    fields: [
                        { name: "Categoría",       isPK: true  },
                        { name: "Precio_Alquiler", isPK: false }
                    ]
                },
                {
                    name: "PELÍCULA",
                    fields: [
                        { name: "Id_Película", isPK: true  },
                        { name: "Nom_Peli",    isPK: false },
                        { name: "Duración",    isPK: false },
                        { name: "Categoría",   isPK: false, isFK: true, fkTo: "CATEGORÍA" }
                    ]
                }
            ]
        }
    ]
},

// ─────────────────────────────────────────────────────────────────────────────
// EJ 2 — Inscripciones a Cursos (Liceo)
// ─────────────────────────────────────────────────────────────────────────────
// FD detectadas en los datos de ejemplo: Cod_curso→Nombre_curso,CI_doc,Nombre_doc
// (transitiva: Nombre_doc depende de CI_doc, no directamente de Cod_curso) ;
// CI_est→Nombre_est,Teléfono_est* ; Nota depende de toda la clave (CI_est + Cod_curso).
// Mismo esquema de complejidad que Pedidos: un solo atributo multivaluado (no un
// grupo de varios), TELÉFONO nace en 1FN con FK a ESTUDIANTE aunque ESTUDIANTE
// recién se crea como tabla en 2FN — igual que TELÉFONO→CLIENTE en Pedidos.
{
    title: "🎓 Inscripciones a Cursos",
    context: `Un liceo registra en una única tabla las inscripciones de los estudiantes a los cursos que dictan los docentes.<br><br>
        Para cada inscripción se guarda la cédula del estudiante (CI_est) junto con su nombre y teléfono(s), el código del curso al que se inscribe junto con su nombre y el docente que lo dicta (cédula y nombre), y la nota obtenida.`,
    rawTable: {
        name: "INSCRIPCIÓN",
        fixedFields: ["CI_est", "Nombre_est", "Cod_curso", "Nombre_curso", "CI_doc", "Nombre_doc", "Nota"],
        repeatingLabel: "Teléfonos (varios por estudiante)",
        repeatingFields: ["Teléfono_est"],
        keyFields: ["CI_est", "Cod_curso"],
        singleMultivalued: true,
        rows: [
            { fixed: ["4123456", "Ana Pérez",    "BD101", "Bases de Datos",  "3111222", "Marta Silva", "8"], values: ["094-111-222", "099-333-444"] },
            { fixed: ["4123456", "Ana Pérez",    "PR102", "Programación 1", "3444555", "Juan Gómez",  "7"], values: ["094-111-222", "099-333-444"] },
            { fixed: ["4987654", "Luis Díaz",    "BD101", "Bases de Datos",  "3111222", "Marta Silva", "9"], values: ["098-555-666"] },
            { fixed: ["4987654", "Luis Díaz",    "RD103", "Redes",           "3777888", "Sofía Ramos", "6"], values: ["098-555-666"] },
            { fixed: ["4555111", "Marina Solís", "PR102", "Programación 1", "3444555", "Juan Gómez",  "8"], values: ["091-222-777"] },
            { fixed: ["4555111", "Marina Solís", "RD103", "Redes",           "3777888", "Sofía Ramos", "9"], values: ["091-222-777"] }
        ]
    },
    steps: [
        // ── Paso 1FN ──────────────────────────────────────────────────────
        {
            formaNormal: "1FN",
            gateTables: [{ table: "INSCRIPCIÓN", isCompliant: false }],
            complianceExplain: "El campo Teléfono_est contiene varios valores (uno por cada teléfono del estudiante) dentro de una misma fila. No es atómico.",
            violationQuestion: "¿Qué atributo viola la regla de 1FN?",
            violatingAttr: "Teléfono_est",
            violationOptions: ["CI_est", "Nombre_est", "Cod_curso", "Nombre_curso", "CI_doc", "Nombre_doc", "Nota", "Teléfono_est"],
            sourceTable: "INSCRIPCIÓN",
            markToTable: "TELÉFONO",
            dependencyOptions: ["INSCRIPCIÓN", "TELÉFONO"],
            dependencies: [
                { attr: "CI_est",       dependsOn: "TELÉFONO" },
                { attr: "Nombre_est",   dependsOn: "INSCRIPCIÓN" },
                { attr: "Cod_curso",    dependsOn: "INSCRIPCIÓN" },
                { attr: "Nombre_curso", dependsOn: "INSCRIPCIÓN" },
                { attr: "CI_doc",       dependsOn: "INSCRIPCIÓN" },
                { attr: "Nombre_doc",   dependsOn: "INSCRIPCIÓN" },
                { attr: "Nota",         dependsOn: "INSCRIPCIÓN" },
                { attr: "Teléfono_est", dependsOn: "TELÉFONO" }
            ],
            resultTables: [
                {
                    name: "INSCRIPCIÓN",
                    fields: [
                        { name: "CI_est",       isPK: true  },
                        { name: "Cod_curso",    isPK: true  },
                        { name: "Nombre_est",   isPK: false },
                        { name: "Nombre_curso", isPK: false },
                        { name: "CI_doc",       isPK: false },
                        { name: "Nombre_doc",   isPK: false },
                        { name: "Nota",         isPK: false }
                    ]
                },
                {
                    name: "TELÉFONO",
                    fields: [
                        { name: "CI_est",       isPK: true, isFK: true, fkTo: "ESTUDIANTE" },
                        { name: "Teléfono_est", isPK: true }
                    ]
                }
            ]
        },
        // ── Paso 2FN ──────────────────────────────────────────────────────
        {
            formaNormal: "2FN",
            gateTables: [
                { table: "INSCRIPCIÓN",   isCompliant: false },
                { table: "TELÉFONO",  isCompliant: true }
            ],
            complianceExplain: "En INSCRIPCIÓN, Nombre_est depende solo de CI_est, y Nombre_curso, CI_doc y Nombre_doc dependen solo de Cod_curso. Ninguno depende de toda la clave (CI_est + Cod_curso). Son dependencias parciales.",
            sourceTable: "INSCRIPCIÓN",
            dependencyQuestion: "¿De qué depende cada atributo no clave de INSCRIPCIÓN?",
            dependencyOptions: ["CI_est", "Cod_curso", "CI_est + Cod_curso (toda la clave)"],
            dependencies: [
                { attr: "Nombre_est",   dependsOn: "CI_est" },
                { attr: "Nombre_curso", dependsOn: "Cod_curso" },
                { attr: "CI_doc",       dependsOn: "Cod_curso" },
                { attr: "Nombre_doc",   dependsOn: "Cod_curso" },
                { attr: "Nota",         dependsOn: "CI_est + Cod_curso (toda la clave)" }
            ],
            replaces: ["INSCRIPCIÓN"],
            resultTables: [
                {
                    name: "ESTUDIANTE",
                    fields: [
                        { name: "CI_est",     isPK: true  },
                        { name: "Nombre_est", isPK: false }
                    ]
                },
                {
                    name: "CURSO",
                    fields: [
                        { name: "Cod_curso",    isPK: true  },
                        { name: "Nombre_curso", isPK: false },
                        { name: "CI_doc",       isPK: false },
                        { name: "Nombre_doc",   isPK: false }
                    ]
                },
                {
                    name: "INSCRIPCIÓN",
                    fields: [
                        { name: "CI_est",    isPK: true, isFK: true, fkTo: "ESTUDIANTE" },
                        { name: "Cod_curso", isPK: true, isFK: true, fkTo: "CURSO" },
                        { name: "Nota",      isPK: false }
                    ]
                }
            ]
        },
        // ── Paso 3FN ──────────────────────────────────────────────────────
        {
            formaNormal: "3FN",
            gateTables: [
                { table: "TELÉFONO", isCompliant: true },
                { table: "ESTUDIANTE",   isCompliant: true },
                { table: "CURSO",        isCompliant: false },
                { table: "INSCRIPCIÓN",  isCompliant: true }
            ],
            complianceExplain: "En CURSO, Nombre_doc depende de CI_doc, y CI_doc depende de Cod_curso. Nombre_doc depende de un atributo no clave, no directamente de la clave: es una dependencia transitiva.",
            violationQuestion: "¿Qué atributo no clave genera la dependencia transitiva?",
            violatingAttr: "Nombre_doc",
            violationOptions: ["Nombre_curso", "CI_doc", "Nombre_doc"],
            transitiveTarget: "CI_doc",
            transitiveTargetOptions: ["Nombre_curso", "CI_doc"],
            sourceTable: "CURSO",
            dependencyQuestion: "¿De qué depende cada atributo no clave de CURSO?",
            dependencyOptions: ["Cod_curso (la clave)", "CI_doc"],
            dependencies: [
                { attr: "Nombre_curso", dependsOn: "Cod_curso (la clave)" },
                { attr: "CI_doc",       dependsOn: "Cod_curso (la clave)" },
                { attr: "Nombre_doc",   dependsOn: "CI_doc" }
            ],
            replaces: ["CURSO"],
            resultTables: [
                {
                    name: "DOCENTE",
                    fields: [
                        { name: "CI_doc",     isPK: true  },
                        { name: "Nombre_doc", isPK: false }
                    ]
                },
                {
                    name: "CURSO",
                    fields: [
                        { name: "Cod_curso",    isPK: true  },
                        { name: "Nombre_curso", isPK: false },
                        { name: "CI_doc",       isPK: false, isFK: true, fkTo: "DOCENTE" }
                    ]
                }
            ]
        }
    ]
}

// ── Próximo ejercicio de normalización ────────────────────────────────────
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ Agregar acá el próximo ejercicio, con el mismo formato de arriba.       │
// │ Recordar coma después del último ejercicio existente.                   │
// └─────────────────────────────────────────────────────────────────────────┘
];
