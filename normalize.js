// normalize.js — Lógica interactiva "Normalización" para DB-Lab
// renderNormPanel(exerciseIdx) es llamado desde analysis.js (setStage) al entrar al tab.
//
// Por cada paso (1FN, 2FN, 3FN), la secuencia de subfases se arma dinámicamente
// según lo que declare el paso (ver _normStepPhases):
//   "gate"         — marcar, de todas las tablas actuales, cuáles NO están en esta
//                    forma normal (siempre presente).
//   "violation"    — ¿qué atributo viola la regla? (solo 1FN, vía step.violationOptions)
//   "dependencies" — ¿de qué depende / en qué tabla queda cada atributo? (vía step.dependencies)
//   "fill"         — completar la(s) tabla(s) resultantes (banco de palabras + distractores,
//                    mismo mecanismo que "Pasaje a tablas")
//
// Licencia CC BY-SA 4.0 — Diseñada por Prof. Elizabeth Izquierdo con asistencia de Claude

// ── Estado de la sesión ─────────────────────────────────────────────────────
let _normExIdx    = 0;
let _normDataEx   = null;
let _normStepIdx  = 0;   // 0,1,2 → 1FN,2FN,3FN ; === steps.length → esquema completo
let _normStepPhase= 0;   // 0 = ¿cumple?, 1 = identificar dependencias, 2 = completar tabla(s)
let _normSlots    = {};  // { stepIdx: { "ti_fi": palabra } }
let _normDepAnswers = {};// { stepIdx: { atributo: opción elegida } }
let _normGateAnswers = {};// { stepIdx: Set(tablas marcadas como "no cumple") }
let _normDepMarks    = {};// { stepIdx: Set(atributos marcados como "pasan a la tabla nueva") } — solo pasos con step.markToTable
let _normStepDone = [];
let _normAttempts = {};  // { stepIdx: { gate:[...], dep:[...], fill:[...] } } — {hits,total} cada uno
let _normSelectedWord   = null;
let _normWordPoolCache  = {}; // { stepIdx: [palabras] } — calculado una vez por paso
let _normFKAttempts     = []; // [{matched, total, pct}] — intentos de "Validar restricciones FK"

// ── Reglas de cada forma normal, mostradas como referencia al entrar a cada paso ──
const NORM_FORM_RULES = {
    '1FN': 'Todos los atributos deben tener valores atómicos: un solo valor por celda, sin listas ni grupos repetidos.',
    '2FN': 'Además de cumplir 1FN, todo atributo no clave debe depender de la clave completa (no solo de una parte, en claves compuestas).',
    '3FN': 'Además de cumplir 2FN, ningún atributo no clave puede depender de otro atributo no clave (sin dependencias transitivas).'
};

// ── Punto de entrada principal ────────────────────────────────────────────────
function renderNormPanel(exerciseIdx) {
    const container = document.getElementById('stage-normalize');
    if (!container) return;

    if (!normData || normData.length === 0) {
        container.innerHTML = `
            <div class="flex items-center justify-center flex-1 p-8">
                <div class="text-center">
                    <span class="text-5xl block mb-4">🧬</span>
                    <p class="text-slate-400 text-sm">No hay ejercicios de normalización todavía.</p>
                </div>
            </div>`;
        return;
    }

    const idx = (typeof exerciseIdx === 'number' && normData[exerciseIdx]) ? exerciseIdx : 0;
    _normExIdx     = idx;
    _normDataEx    = normData[idx];
    _normStepIdx   = 0;
    _normStepPhase = 0;
    _normSlots     = {};
    _normDepAnswers = {};
    _normGateAnswers = {};
    _normDepMarks    = {};
    _normStepDone  = _normDataEx.steps.map(() => false);
    _normAttempts  = {};
    _normSelectedWord  = null;
    _normWordPoolCache = {};
    _normFKAttempts    = [];

    _renderNormShell(container);
    _renderNormPhase();
}

function loadNormExercise(idx) {
    renderNormPanel(parseInt(idx, 10));
}

// ── Shell permanente (barra superior + indicador de pasos + contenido) ────────
function _renderNormShell(container) {
    container.innerHTML = `
    <div class="flex flex-col flex-1 w-full max-w-[1400px] mx-auto p-4 gap-4" style="min-height:640px;">

        <div class="no-print flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-2xl px-5 py-3">
            <span class="text-fuchsia-300 font-extrabold text-sm">🧬 Normalización</span>
            <select id="norm-select" onchange="loadNormExercise(this.value)"
                class="ml-2 p-1.5 bg-slate-800 border border-slate-700 rounded-lg font-semibold text-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-fuchsia-500 transition">
                ${normData.map((ex, i) => `<option value="${i}" ${i === _normExIdx ? 'selected' : ''}>${_esc(ex.title)}</option>`).join('')}
            </select>
            <button onclick="_normExportPDF()" title="Exportar como PDF"
                class="ml-auto px-3 py-1.5 bg-indigo-700 hover:bg-indigo-600 border border-indigo-600 rounded-lg text-xs text-white font-semibold transition flex items-center gap-1.5">
                📄 PDF
            </button>
        </div>

        <div class="no-print flex items-center gap-2 flex-wrap">
            <div onclick="_normViewOriginal()" title="Ver la consigna y la tabla original (sin normalizar)"
                class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition bg-indigo-900/60 text-indigo-200 cursor-pointer hover:bg-indigo-800/70">
                <span>📋</span><span>Original</span>
            </div>
            <span class="text-slate-600 text-xs">→</span>
            ${['1FN', '2FN', '3FN', 'Esquema completo'].map((ph, i) => `
                <div id="norm-phase-${i}" class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition
                    ${i === 0 ? 'bg-fuchsia-600 text-white' : 'bg-slate-800 text-slate-500'}">
                    <span>${i + 1}</span><span>${ph}</span>
                </div>
                ${i < 3 ? '<span class="text-slate-600 text-xs">→</span>' : ''}
            `).join('')}
        </div>

        <div id="norm-phase-content" class="flex-1 flex flex-col gap-4"></div>
    </div>`;
}

// ── Despachar paso actual ──────────────────────────────────────────────────────
function _renderNormPhase() {
    const totalSteps = _normDataEx.steps.length;
    for (let i = 0; i <= totalSteps; i++) {
        const el = document.getElementById(`norm-phase-${i}`);
        if (!el) continue;
        const active = (i === _normStepIdx) || (_normStepIdx >= totalSteps && i === totalSteps);
        const done   = i < _normStepIdx && i < totalSteps;
        el.className = `flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition
            ${active ? 'bg-fuchsia-600 text-white' : done ? 'bg-emerald-900/60 text-emerald-300 cursor-pointer hover:bg-emerald-800/70' : 'bg-slate-800 text-slate-500'}`;
        el.onclick = done ? () => _normViewStepReview(i) : null;
        el.title = done ? 'Ver mis respuestas de este paso' : '';
    }

    const content = document.getElementById('norm-phase-content');
    if (!content) return;

    if (_normStepIdx >= totalSteps) _renderNormComplete(content);
    else _renderNormStep(content);
}

// ── Revisión de la consigna y tabla original (sin normalizar) ─────────────────
// Disponible en cualquier momento (no depende del progreso), para volver a mirar
// el enunciado y los datos de ejemplo mientras se analiza un paso más avanzado
// (ej. buscar la dependencia transitiva en 3FN sin recordar de memoria los datos).
function _normViewOriginal() {
    const content = document.getElementById('norm-phase-content');
    if (!content) return;
    const data = _normDataEx;
    content.innerHTML = `
        <div class="bg-fuchsia-950/30 border border-fuchsia-700/40 rounded-2xl p-4 flex items-center justify-between gap-3">
            <strong class="text-xs text-fuchsia-200">📋 Consigna y tabla original (sin normalizar)</strong>
            <button onclick="_renderNormPhase()"
                class="px-3 py-1.5 bg-fuchsia-700 hover:bg-fuchsia-600 border border-fuchsia-600 rounded-lg text-xs text-white font-semibold transition">
                ← Volver al paso actual
            </button>
        </div>
        <div class="bg-slate-900 border border-fuchsia-800/50 rounded-2xl p-4 text-xs text-slate-300 leading-relaxed">
            ${data.context}
        </div>
        ${_renderRawTable(data.rawTable)}
    `;
}

// ── Revisión de un paso ya completado (solo lectura) ──────────────────────────
// Se abre haciendo clic en un badge "1FN"/"2FN"/"3FN" ya marcado como hecho, para
// repasar qué se decidió en ese paso sin perder el avance del paso actual.
function _normViewStepReview(stepIdx) {
    const content = document.getElementById('norm-phase-content');
    if (!content) return;
    const step = _normDataEx.steps[stepIdx];

    const gateHtml = step.gateTables.map(g => `
        <span class="px-3 py-1.5 rounded-lg text-xs font-bold font-mono border
            ${g.isCompliant ? 'bg-slate-800 border-emerald-600/50 text-emerald-300' : 'bg-emerald-900/40 border-emerald-600 text-emerald-200'}">
            ${g.isCompliant ? '✓' : '✗'} ${_esc(_pluralize(g.table))} ${g.isCompliant ? `— ya cumplía ${_esc(step.formaNormal)}` : `— no cumplía ${_esc(step.formaNormal)}`}
        </span>`).join('');

    const violationHtml = step.violatingAttr ? `
        <div class="text-xs text-slate-300">🔎 Atributo que violaba ${_esc(step.formaNormal)}: <strong class="text-white font-mono">${_esc(step.violatingAttr)}</strong>${step.transitiveTarget ? ` — depende de <strong class="text-white font-mono">${_esc(step.transitiveTarget)}</strong>` : ''}</div>` : '';

    const depHtml = step.dependencies ? `
        <div class="flex flex-wrap gap-2">
            ${step.dependencies.map(d => {
                const target = step.markToTable ? _pluralize(d.dependsOn) : d.dependsOn;
                return `<span class="px-2.5 py-1 rounded-lg text-[11px] font-mono bg-slate-800/70 border border-slate-700 text-slate-300">
                    <strong class="text-white">${_esc(d.attr)}</strong> → ${_esc(target)}
                </span>`;
            }).join('')}
        </div>` : '';

    content.innerHTML = `
        <div class="bg-fuchsia-950/30 border border-fuchsia-700/40 rounded-2xl p-4 flex items-center justify-between gap-3">
            <strong class="text-xs text-fuchsia-200">🔎 Revisión — Paso ${stepIdx + 1} · ${_esc(step.formaNormal)}</strong>
            <button onclick="_renderNormPhase()"
                class="px-3 py-1.5 bg-fuchsia-700 hover:bg-fuchsia-600 border border-fuchsia-600 rounded-lg text-xs text-white font-semibold transition">
                ← Volver al paso actual
            </button>
        </div>

        <div class="bg-sky-950/30 border border-sky-700/40 rounded-2xl p-3 text-xs text-sky-200 leading-relaxed">
            📐 <strong>Regla de ${_esc(step.formaNormal)}:</strong> ${_esc(NORM_FORM_RULES[step.formaNormal] || '')}
        </div>

        <div class="bg-slate-900 border border-fuchsia-800/50 rounded-2xl p-5 flex flex-col gap-3">
            <p class="text-xs text-slate-400 font-bold">¿Cumplía ${_esc(step.formaNormal)}?</p>
            <div class="flex flex-wrap gap-2">${gateHtml}</div>
            ${violationHtml}
            ${depHtml}
            <p class="text-xs text-slate-400 font-bold mt-1">Tabla(s) resultante(s):</p>
            ${_renderCurrentSchemaCardsFromTables(step.resultTables)}
        </div>
    `;
}

function _renderCurrentSchemaCardsFromTables(tables) {
    return `
    <div class="grid gap-3 ${tables.length > 1 ? 'md:grid-cols-' + Math.min(tables.length, 3) : ''}">
        ${tables.map(t => _renderNormTableCard(t)).join('')}
    </div>`;
}

// ── Esquema acumulado: última versión de cada tabla hasta un paso dado ───────
// (aplica los reemplazos declarados en "replaces" antes de sumar las resultTables,
// así una tabla descompuesta en un paso posterior no sigue apareciendo)
function _normCurrentSchema(data, uptoStepIdxInclusive) {
    const byName = {};
    for (let i = 0; i <= uptoStepIdxInclusive; i++) {
        const step = data.steps[i];
        (step.replaces || []).forEach(name => { delete byName[name]; });
        step.resultTables.forEach(t => { byName[t.name] = t; });
    }
    return Object.values(byName);
}

function _renderNormTableCard(t) {
    const displayName = _pluralize(t.name);
    const fieldSpan = (f) => {
        let cls = 'font-mono text-xs ';
        if (f.isPK) cls += 'underline font-bold ';
        cls += f.isFK ? 'text-blue-300' : (f.isPK ? 'text-pink-300' : 'text-slate-300');
        return `<span class="${cls}">${_esc(f.name)}</span>`;
    };
    return `
    <div class="bg-slate-900 border border-slate-700 rounded-2xl p-4">
        <div class="flex items-center gap-2 mb-2">
            <span class="text-lg">▤</span>
            <span class="font-extrabold text-white text-sm">${_esc(displayName)}</span>
        </div>
        <div class="font-mono text-xs bg-slate-800/60 rounded-xl p-3 leading-relaxed">
            <span class="text-white font-bold">${_esc(displayName)}</span><span class="text-slate-400">(</span>${t.fields.map(fieldSpan).join('<span class="text-slate-500">, </span>')}<span class="text-slate-400">)</span>
        </div>
    </div>`;
}

function _renderCurrentSchemaCards(data, uptoStepIdx) {
    const tables = _normCurrentSchema(data, uptoStepIdx);
    return `
    <div class="grid gap-3 ${tables.length > 1 ? 'md:grid-cols-' + Math.min(tables.length, 3) : ''}">
        ${tables.map(t => _renderNormTableCard(t)).join('')}
    </div>`;
}

// ── Tabla sin normalizar (0FN), con grupo repetido visual (rowspan) ──────────
// Dos formatos de tabla sin normalizar:
//  - grupo repetido de VARIOS campos anidados por fila padre (rt.students[].courses[])
//    → usa rowspan en los campos fijos, ej. Inscripciones a Cursos.
//  - UN solo atributo multivaluado con varios valores en la misma celda (rt.rows[].values)
//    → cada fila ya es una combinación única, sin rowspan, ej. Pedidos.
function _renderRawTable(rt) {
    if (rt.singleMultivalued) return _renderRawTableSingleMultivalued(rt);

    const rows = [];
    rt.students.forEach(st => {
        st.courses.forEach((crow, ci) => {
            rows.push({ fixed: st.fixed, rowspan: st.courses.length, course: crow, first: ci === 0 });
        });
    });
    return `
    <div class="bg-slate-900 border border-slate-700 rounded-2xl p-4 overflow-x-auto">
        <p class="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">${_esc(_pluralize(rt.name))}</p>
        <p class="text-[10px] text-amber-300/80 mb-3">${_esc(rt.repeatingLabel)}: grupo repetido dentro de la misma fila.</p>
        <table class="text-xs font-mono border-collapse w-full">
            <thead>
                <tr class="text-slate-400">
                    ${rt.fixedFields.map(f => `<th class="border border-slate-700 px-2 py-1.5 bg-slate-800 ${(rt.keyFields || []).includes(f) ? 'underline font-bold' : ''}">${_esc(f)}</th>`).join('')}
                    ${rt.repeatingFields.map(f => `<th class="border border-amber-700/50 px-2 py-1.5 bg-amber-950/40 text-amber-200 ${(rt.keyFields || []).includes(f) ? 'underline font-bold' : ''}">${_esc(f)}</th>`).join('')}
                </tr>
            </thead>
            <tbody>
                ${rows.map(r => `
                    <tr class="text-slate-200">
                        ${r.first ? r.fixed.map(v => `<td class="border border-slate-700 px-2 py-1.5 bg-slate-800/40 align-top" rowspan="${r.rowspan}">${_esc(v)}</td>`).join('') : ''}
                        ${r.course.map(v => `<td class="border border-amber-700/30 px-2 py-1.5">${_esc(v)}</td>`).join('')}
                    </tr>`).join('')}
            </tbody>
        </table>
    </div>`;
}

function _renderRawTableSingleMultivalued(rt) {
    return `
    <div class="bg-slate-900 border border-slate-700 rounded-2xl p-4 overflow-x-auto">
        <p class="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">${_esc(_pluralize(rt.name))}</p>
        <p class="text-[10px] text-amber-300/80 mb-3">${_esc(rt.repeatingLabel)}: varios valores dentro de la misma celda.</p>
        <table class="text-xs font-mono border-collapse w-full">
            <thead>
                <tr class="text-slate-400">
                    ${rt.fixedFields.map(f => `<th class="border border-slate-700 px-2 py-1.5 bg-slate-800 ${(rt.keyFields || []).includes(f) ? 'underline font-bold' : ''}">${_esc(f)}</th>`).join('')}
                    ${rt.repeatingFields.map(f => `<th class="border border-amber-700/50 px-2 py-1.5 bg-amber-950/40 text-amber-200 ${(rt.keyFields || []).includes(f) ? 'underline font-bold' : ''}">${_esc(f)}</th>`).join('')}
                </tr>
            </thead>
            <tbody>
                ${rt.rows.map(r => `
                    <tr class="text-slate-200">
                        ${r.fixed.map(v => `<td class="border border-slate-700 px-2 py-1.5 bg-slate-800/40">${_esc(v)}</td>`).join('')}
                        <td class="border border-amber-700/30 px-2 py-1.5">${r.values.map(v => _esc(v)).join('<br>')}</td>
                    </tr>`).join('')}
            </tbody>
        </table>
    </div>`;
}

// ── Paso individual ────────────────────────────────────────────────────────────
// Secuencia de subfases de un paso: siempre arranca en la compuerta Sí/No,
// después (si el paso lo declara) identificar el atributo que viola la regla,
// después (si el paso lo declara) clasificar cada atributo por tabla, y por
// último completar la(s) tabla(s). _normStepPhase es un índice sobre esta lista,
// así el mismo código sirve para 1FN (gate→violation→dependencies→fill) y para
// 2FN/3FN (gate→dependencies→fill) sin duplicar lógica de avance.
function _normStepPhases(step) {
    const phases = [];
    if (step.gateTables.length > 1) phases.push('exists');
    phases.push('gate');
    if (step.violationOptions) phases.push('violation');
    if (step.transitiveTargetOptions) phases.push('violationTarget');
    if (step.dependencies) phases.push('dependencies');
    phases.push('fill');
    return phases;
}

function _renderNormStep(container) {
    const data = _normDataEx;
    const step = data.steps[_normStepIdx];
    const stepNum = _normStepIdx + 1;
    const totalSteps = data.steps.length;

    const refHtml = _normStepIdx === 0
        ? _renderRawTable(data.rawTable)
        : _renderCurrentSchemaCards(data, _normStepIdx - 1);

    const phaseName = _normStepPhases(step)[_normStepPhase];
    let bodyHtml;
    if (phaseName === 'exists') bodyHtml = _renderNormGateExists(step);
    else if (phaseName === 'gate') bodyHtml = step.gateTables.length === 1 ? _renderNormGateSingle(step) : _renderNormGateChecklist(step);
    else if (phaseName === 'violation') bodyHtml = _renderNormViolationUI(step);
    else if (phaseName === 'violationTarget') bodyHtml = _renderNormViolationTargetUI(step);
    else if (phaseName === 'dependencies') bodyHtml = step.markToTable ? _renderNormDependencyMarkUI(step) : _renderNormDependencyUI(step);
    else bodyHtml = _renderNormFillUI(step);

    container.innerHTML = `
        <div class="bg-fuchsia-950/30 border border-fuchsia-700/40 rounded-2xl p-4 text-xs text-fuchsia-200 leading-relaxed">
            <strong>Paso ${stepNum} de ${totalSteps} — ${_esc(step.formaNormal)}</strong>
            ${_normStepIdx === 0 ? '<br>' + data.context : ''}
        </div>

        <div class="bg-sky-950/30 border border-sky-700/40 rounded-2xl p-3 text-xs text-sky-200 leading-relaxed">
            📐 <strong>Regla de ${_esc(step.formaNormal)}:</strong> ${_esc(NORM_FORM_RULES[step.formaNormal] || '')}
        </div>

        ${refHtml}

        <div class="bg-slate-900 border border-fuchsia-800/50 rounded-2xl p-5 flex flex-col gap-3">
            ${bodyHtml}
        </div>

        <div id="norm-feedback" class="hidden p-4 rounded-2xl text-sm font-bold border"></div>
    `;
    if (phaseName === 'fill') _normRefreshWordBank();
}

// ── Subfase "exists": antes de marcar cuáles tablas violan la forma normal
// (solo cuando hay varias tablas), primero preguntar si existe alguna violación.
function _renderNormGateExists(step) {
    return `
        <p class="text-sm text-white font-bold mb-1">¿Hay alguna tabla que NO está en ${_esc(step.formaNormal)}?</p>
        <div class="flex gap-3">
            <button onclick="_normAnswerGateExists(true)"
                class="flex-1 py-3 rounded-xl border border-slate-700 bg-slate-800 hover:bg-emerald-800/40 hover:border-emerald-500 transition text-sm font-bold text-slate-200">Sí</button>
            <button onclick="_normAnswerGateExists(false)"
                class="flex-1 py-3 rounded-xl border border-slate-700 bg-slate-800 hover:bg-rose-800/40 hover:border-rose-500 transition text-sm font-bold text-slate-200">No</button>
        </div>`;
}

function _normAnswerGateExists(answer) {
    const step = _normDataEx.steps[_normStepIdx];
    const si = _normStepIdx;
    const fb = document.getElementById('norm-feedback');
    const actual = step.gateTables.some(g => !g.isCompliant);
    const correct = (answer === actual);

    if (correct) {
        _normLog(si, 'gate', 1, 1);
        if (fb) {
            fb.classList.remove('hidden');
            fb.className = 'p-3 rounded-2xl text-xs font-bold border bg-emerald-900/40 border-emerald-700 text-emerald-300';
            fb.innerHTML = `✅ ¡Correcto! ${answer ? 'Buscar cuál(es).' : ''}${_normHistHtml(si, 'gate', 'Respuesta')}`;
        }
        _normStepPhase++;
        setTimeout(() => _renderNormPhase(), 900);
    } else {
        _normLog(si, 'gate', 0, 1);
        if (_normCount(si, 'gate') >= 3) {
            if (fb) {
                fb.classList.remove('hidden');
                fb.className = 'p-3 rounded-2xl text-xs font-bold border bg-amber-900/40 border-amber-700 text-amber-200';
                fb.innerHTML = `🔎 Máximo de intentos alcanzado. Respuesta correcta: "${actual ? 'Sí' : 'No'}".${_normHistHtml(si, 'gate', 'Respuesta')}`;
            }
            _normStepPhase++;
            setTimeout(() => _renderNormPhase(), 1700);
        } else {
            if (fb) {
                fb.classList.remove('hidden');
                fb.className = 'p-3 rounded-2xl text-xs font-bold border bg-rose-900/40 border-rose-700 text-rose-300';
                fb.innerHTML = `❌ Revisar de nuevo. Reintentar.${_normHistHtml(si, 'gate', 'Respuesta')}`;
            }
        }
    }
}

// ── Subfase "gate", variante de una sola tabla (siempre el caso en 1FN: todavía
// no se descompuso nada, no hay entre qué "buscar") — vuelve al Sí/No simple.
function _renderNormGateSingle(step) {
    const g = step.gateTables[0];
    return `
        <p class="text-sm text-white font-bold mb-1">¿La tabla ${_esc(_pluralize(g.table))} está en ${_esc(step.formaNormal)}?</p>
        <div class="flex gap-3">
            <button onclick="_normAnswerGateSingle(true)"
                class="flex-1 py-3 rounded-xl border border-slate-700 bg-slate-800 hover:bg-emerald-800/40 hover:border-emerald-500 transition text-sm font-bold text-slate-200">Sí</button>
            <button onclick="_normAnswerGateSingle(false)"
                class="flex-1 py-3 rounded-xl border border-slate-700 bg-slate-800 hover:bg-rose-800/40 hover:border-rose-500 transition text-sm font-bold text-slate-200">No</button>
        </div>`;
}

function _normAnswerGateSingle(answer) {
    const step = _normDataEx.steps[_normStepIdx];
    const g = step.gateTables[0];
    const fb = document.getElementById('norm-feedback');
    const si = _normStepIdx;
    const correct = (answer === g.isCompliant);

    if (correct) {
        _normLog(si, 'gate', 1, 1);
        if (fb) {
            fb.classList.remove('hidden');
            fb.className = 'p-3 rounded-2xl text-xs font-bold border bg-emerald-900/40 border-emerald-700 text-emerald-300';
            fb.innerHTML = `✅ ¡Correcto! ${_esc(step.complianceExplain)}${_normHistHtml(si, 'gate', 'Respuesta')}`;
        }
        _normStepPhase++;
        setTimeout(() => _renderNormPhase(), 1100);
    } else {
        _normLog(si, 'gate', 0, 1);
        if (_normCount(si, 'gate') >= 3) {
            if (fb) {
                fb.classList.remove('hidden');
                fb.className = 'p-3 rounded-2xl text-xs font-bold border bg-amber-900/40 border-amber-700 text-amber-200';
                fb.innerHTML = `🔎 Máximo de intentos alcanzado. Respuesta correcta: "${g.isCompliant ? 'Sí' : 'No'}". ${_esc(step.complianceExplain)}${_normHistHtml(si, 'gate', 'Respuesta')}`;
            }
            _normStepPhase++;
            setTimeout(() => _renderNormPhase(), 1900);
        } else {
            if (fb) {
                fb.classList.remove('hidden');
                fb.className = 'p-3 rounded-2xl text-xs font-bold border bg-rose-900/40 border-rose-700 text-rose-300';
                fb.innerHTML = `❌ Revisar de nuevo. Reintentar.${_normHistHtml(si, 'gate', 'Respuesta')}`;
            }
        }
    }
}

// ── Subfase "gate", variante de varias tablas: marcar cuáles NO están en esta
// forma normal (la mayoría van a estar bien; el estudiante tiene que encontrar
// la que todavía viola la forma normal del paso entre todas, no se le dice de
// entrada cuál es).
function _renderNormGateChecklist(step) {
    const si = _normStepIdx;
    if (!_normGateAnswers[si]) _normGateAnswers[si] = new Set();
    const marked = _normGateAnswers[si];
    return `
        <p class="text-sm text-white font-bold mb-2">Marcar las tablas que NO están en ${_esc(step.formaNormal)}:</p>
        <div class="flex flex-wrap gap-2">
            ${step.gateTables.map(g => `
                <button onclick="_normToggleGateTable('${_escAttr(g.table)}')"
                    data-table="${_esc(g.table)}"
                    class="norm-gate-opt px-4 py-2.5 rounded-xl border text-xs font-bold font-mono transition
                    ${marked.has(g.table) ? 'bg-rose-700 border-rose-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-fuchsia-500'}">
                    ${_esc(_pluralize(g.table))}
                </button>`).join('')}
        </div>
        <button id="btn-validate-gate" onclick="_normValidateGateChecklist()"
            class="py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm transition active:scale-95 mt-2">
            ✔ Validar
        </button>`;
}

function _normToggleGateTable(table) {
    const si = _normStepIdx;
    if (!_normGateAnswers[si]) _normGateAnswers[si] = new Set();
    const marked = _normGateAnswers[si];
    if (marked.has(table)) marked.delete(table); else marked.add(table);
    const btn = document.querySelector(`.norm-gate-opt[data-table="${CSS.escape(table)}"]`);
    if (btn) {
        const isMarked = marked.has(table);
        btn.className = 'norm-gate-opt px-4 py-2.5 rounded-xl border text-xs font-bold font-mono transition ' +
            (isMarked ? 'bg-rose-700 border-rose-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-fuchsia-500');
    }
}

function _normValidateGateChecklist() {
    const step = _normDataEx.steps[_normStepIdx];
    const si = _normStepIdx;
    const marked = _normGateAnswers[si] || new Set();
    let errors = 0;

    step.gateTables.forEach(g => {
        const shouldMark = !g.isCompliant;
        const isMarked   = marked.has(g.table);
        const btn = document.querySelector(`.norm-gate-opt[data-table="${CSS.escape(g.table)}"]`);
        let cls = 'norm-gate-opt px-4 py-2.5 rounded-xl border text-xs font-bold font-mono transition ';
        if (shouldMark && isMarked) {
            cls += 'bg-emerald-700 border-emerald-500 text-white'; // acertó: la marcó y violaba
        } else if (!shouldMark && !isMarked) {
            cls += 'bg-slate-800 border-emerald-600/50 text-slate-300'; // acertó: la dejó sin marcar y cumplía
        } else if (!shouldMark && isMarked) {
            cls += 'bg-rose-700 border-rose-500 text-white'; // falso positivo: la marcó sin motivo
            errors++;
        } else {
            cls += 'bg-amber-700 border-amber-500 text-white'; // se le escapó: violaba y no la marcó
            errors++;
        }
        if (btn) btn.className = cls;
    });

    const total = step.gateTables.length;
    const hits  = total - errors;
    _normLog(si, 'gate', hits, total);
    const fb = document.getElementById('norm-feedback');
    if (!fb) return;
    fb.classList.remove('hidden');
    const histHtml = _normHistHtml(si, 'gate', 'Respuesta');

    const complianceExplain = step.sourceTable
        ? step.complianceExplain.replace(step.sourceTable, _pluralize(step.sourceTable))
        : step.complianceExplain;

    if (errors === 0) {
        fb.className = 'p-3 rounded-2xl text-xs font-bold border bg-emerald-900/40 border-emerald-700 text-emerald-300';
        fb.innerHTML = `✅ ¡Correcto! ${_esc(complianceExplain)}${histHtml}`;
        _normStepPhase++;
        setTimeout(() => _renderNormPhase(), 1200);
    } else if (_normCount(si, 'gate') >= 3) {
        _normGateAnswers[si] = new Set(step.gateTables.filter(g => !g.isCompliant).map(g => g.table));
        fb.className = 'p-3 rounded-2xl text-xs font-bold border bg-amber-900/40 border-amber-700 text-amber-200';
        fb.innerHTML = `🔎 Máximo de intentos alcanzado. ${_esc(complianceExplain)}${histHtml}`;
        _normStepPhase++;
        setTimeout(() => _renderNormPhase(), 1900);
    } else {
        fb.className = 'p-3 rounded-2xl text-xs font-bold border bg-rose-900/40 border-rose-700 text-rose-300';
        fb.innerHTML = `❌ Hay ${errors} respuesta(s) incorrecta(s) (en rojo/ámbar). Reintentar.${histHtml}`;
    }
}

// ── Subfase "violation": ¿qué atributo viola la regla? (solo 1FN) ─────────────
function _renderNormViolationUI(step) {
    return `
        <p class="text-sm text-white font-bold mb-1">${_esc(step.violationQuestion)}</p>
        <div class="flex flex-col gap-2">
            ${step.violationOptions.map(opt => `
                <button onclick="_normAnswerViolation('${_escAttr(opt)}')"
                    class="w-full text-left px-4 py-3 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 hover:border-fuchsia-500 transition text-xs text-slate-300 font-mono">
                    ${_esc(opt)}
                </button>`).join('')}
        </div>`;
}

function _normAnswerViolation(chosen) {
    const step = _normDataEx.steps[_normStepIdx];
    const fb = document.getElementById('norm-feedback');
    const si = _normStepIdx;
    const correct = chosen === step.violatingAttr;

    if (correct) {
        _normLog(si, 'violation', 1, 1);
        if (fb) {
            fb.classList.remove('hidden');
            fb.className = 'p-3 rounded-2xl text-xs font-bold border bg-emerald-900/40 border-emerald-700 text-emerald-300';
            fb.innerHTML = `✅ ¡Correcto!${_normHistHtml(si, 'violation', 'Atributo violador')}`;
        }
        _normStepPhase++;
        setTimeout(() => _renderNormPhase(), 1000);
    } else {
        _normLog(si, 'violation', 0, 1);
        if (_normCount(si, 'violation') >= 3) {
            if (fb) {
                fb.classList.remove('hidden');
                fb.className = 'p-3 rounded-2xl text-xs font-bold border bg-amber-900/40 border-amber-700 text-amber-200';
                fb.innerHTML = `🔎 Máximo de intentos alcanzado. El atributo que viola ${_esc(step.formaNormal)} es: "${_esc(step.violatingAttr)}".${_normHistHtml(si, 'violation', 'Atributo violador')}`;
            }
            _normStepPhase++;
            setTimeout(() => _renderNormPhase(), 1800);
        } else {
            if (fb) {
                fb.classList.remove('hidden');
                fb.className = 'p-3 rounded-2xl text-xs font-bold border bg-rose-900/40 border-rose-700 text-rose-300';
                fb.innerHTML = `❌ No es ese. Elegiste: "${_esc(chosen)}". Reintentar.${_normHistHtml(si, 'violation', 'Atributo violador')}`;
            }
        }
    }
}

// ── Subfase "violationTarget": ¿de qué atributo no clave depende el atributo
// que viola la regla? (solo 3FN, después de identificar cuál es ese atributo) ──
function _renderNormViolationTargetUI(step) {
    return `
        <p class="text-sm text-white font-bold mb-1">¿De qué atributo no clave depende <span class="font-mono text-fuchsia-300">${_esc(step.violatingAttr)}</span>?</p>
        <div class="flex flex-col gap-2">
            ${step.transitiveTargetOptions.map(opt => `
                <button onclick="_normAnswerViolationTarget('${_escAttr(opt)}')"
                    class="w-full text-left px-4 py-3 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 hover:border-fuchsia-500 transition text-xs text-slate-300 font-mono">
                    ${_esc(opt)}
                </button>`).join('')}
        </div>`;
}

function _normAnswerViolationTarget(chosen) {
    const step = _normDataEx.steps[_normStepIdx];
    const fb = document.getElementById('norm-feedback');
    const si = _normStepIdx;
    const correct = chosen === step.transitiveTarget;

    if (correct) {
        _normLog(si, 'violationTarget', 1, 1);
        if (fb) {
            fb.classList.remove('hidden');
            fb.className = 'p-3 rounded-2xl text-xs font-bold border bg-emerald-900/40 border-emerald-700 text-emerald-300';
            fb.innerHTML = `✅ ¡Correcto! ${_esc(step.complianceExplain)}${_normHistHtml(si, 'violationTarget', 'Depende de')}`;
        }
        _normStepPhase++;
        setTimeout(() => _renderNormPhase(), 1300);
    } else {
        _normLog(si, 'violationTarget', 0, 1);
        if (_normCount(si, 'violationTarget') >= 3) {
            if (fb) {
                fb.classList.remove('hidden');
                fb.className = 'p-3 rounded-2xl text-xs font-bold border bg-amber-900/40 border-amber-700 text-amber-200';
                fb.innerHTML = `🔎 Máximo de intentos alcanzado. ${_esc(step.violatingAttr)} depende de "${_esc(step.transitiveTarget)}". ${_esc(step.complianceExplain)}${_normHistHtml(si, 'violationTarget', 'Depende de')}`;
            }
            _normStepPhase++;
            setTimeout(() => _renderNormPhase(), 2000);
        } else {
            if (fb) {
                fb.classList.remove('hidden');
                fb.className = 'p-3 rounded-2xl text-xs font-bold border bg-rose-900/40 border-rose-700 text-rose-300';
                fb.innerHTML = `❌ No es ese. Elegiste: "${_esc(chosen)}". Reintentar.${_normHistHtml(si, 'violationTarget', 'Depende de')}`;
            }
        }
    }
}

// ── Subfase 1: ¿de qué depende cada atributo? (solo 2FN/3FN) ─────────────────
function _renderNormDependencyUI(step) {
    const si = _normStepIdx;
    if (!_normDepAnswers[si]) _normDepAnswers[si] = {};
    const answers = _normDepAnswers[si];

    return `
        <div class="bg-indigo-950/30 border border-indigo-700/40 rounded-xl p-3 text-xs text-indigo-200">
            📌 Tabla <strong>${_esc(_pluralize(step.sourceTable))}</strong> — ${_esc(step.dependencyQuestion.replace(step.sourceTable, _pluralize(step.sourceTable)))}
        </div>
        <div class="flex flex-col gap-2">
            ${step.dependencies.map(d => `
                <div class="flex items-center gap-3 flex-wrap bg-slate-800/60 border border-slate-700 rounded-xl p-3">
                    <span class="font-mono text-xs text-white font-bold min-w-[110px]">${_esc(d.attr)}</span>
                    <span class="text-slate-500 text-xs">${_esc(step.assignLabel || 'depende de')}:</span>
                    <div class="flex gap-2 flex-wrap">
                        ${step.dependencyOptions.map(opt => `
                            <button onclick="_normSetDependency('${_escAttr(d.attr)}','${_escAttr(opt)}')"
                                data-attr="${_esc(d.attr)}" data-opt="${_esc(opt)}"
                                class="norm-dep-opt px-3 py-1.5 rounded-lg text-xs font-bold border transition
                                ${answers[d.attr] === opt ? 'bg-fuchsia-600 border-fuchsia-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-fuchsia-500'}">
                                ${_esc(step.assignLabel ? _pluralize(opt) : opt)}
                            </button>`).join('')}
                    </div>
                </div>`).join('')}
        </div>
        <button id="btn-validate-dep" onclick="_normValidateDependencies()"
            class="py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm transition active:scale-95">
            ✔ ${step.assignLabel ? 'Validar clasificación' : 'Validar dependencias'}
        </button>`;
}

// Igual que _esc pero también escapa comillas simples, para poder inyectar el
// valor dentro de un atributo onclick="...('valor')" sin romper el HTML.
function _escAttr(s) {
    return _esc(s).replace(/'/g, '&#39;');
}

function _normSetDependency(attr, opt) {
    const si = _normStepIdx;
    if (!_normDepAnswers[si]) _normDepAnswers[si] = {};
    _normDepAnswers[si][attr] = opt;
    document.querySelectorAll(`.norm-dep-opt[data-attr="${CSS.escape(attr)}"]`).forEach(b => {
        const isSel = b.dataset.opt === opt;
        b.className = 'norm-dep-opt px-3 py-1.5 rounded-lg text-xs font-bold border transition ' +
            (isSel ? 'bg-fuchsia-600 border-fuchsia-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-fuchsia-500');
    });
}

function _normValidateDependencies() {
    const step = _normDataEx.steps[_normStepIdx];
    const si = _normStepIdx;
    const answers = _normDepAnswers[si] || {};
    let errors = 0;

    step.dependencies.forEach(d => {
        const chosen = answers[d.attr];
        const ok = chosen === d.dependsOn;
        if (!ok) errors++;
        document.querySelectorAll(`.norm-dep-opt[data-attr="${CSS.escape(d.attr)}"]`).forEach(b => {
            const isSelected = b.dataset.opt === chosen;
            if (isSelected) {
                b.className = 'norm-dep-opt px-3 py-1.5 rounded-lg text-xs font-bold border transition text-white ' +
                    (ok ? 'bg-emerald-700 border-emerald-500' : 'bg-rose-700 border-rose-500');
            } else {
                b.className = 'norm-dep-opt px-3 py-1.5 rounded-lg text-xs font-bold border transition bg-slate-800 border-slate-700 text-slate-300';
            }
        });
    });

    const total = step.dependencies.length;
    const hits  = total - errors;
    _normLog(si, 'dep', hits, total);
    const fb = document.getElementById('norm-feedback');
    if (!fb) return;
    fb.classList.remove('hidden');
    const noun = step.assignLabel ? 'Clasificación' : 'Dependencias';
    const itemWord = step.assignLabel ? 'atributo(s) mal clasificado(s)' : 'dependencia(s) incorrecta(s)';
    const histHtml = _normHistHtml(si, 'dep', noun);

    if (errors === 0) {
        fb.className = 'p-3 rounded-2xl text-xs font-bold border bg-emerald-900/40 border-emerald-700 text-emerald-300';
        fb.innerHTML = `✅ ¡Correcto! Ahora armar la(s) tabla(s) resultante(s).${histHtml}`;
        _normStepPhase++;
        setTimeout(() => _renderNormPhase(), 1200);
    } else if (_normCount(si, 'dep') >= 3) {
        step.dependencies.forEach(d => { _normDepAnswers[si][d.attr] = d.dependsOn; });
        fb.className = 'p-3 rounded-2xl text-xs font-bold border bg-amber-900/40 border-amber-700 text-amber-200';
        fb.innerHTML = `🔎 Máximo de intentos alcanzado — así queda correcto. Ahora armar la(s) tabla(s).${histHtml}`;
        _normStepPhase++;
        setTimeout(() => _renderNormPhase(), 1900);
    } else {
        fb.className = 'p-3 rounded-2xl text-xs font-bold border bg-rose-900/40 border-rose-700 text-rose-300';
        fb.innerHTML = `❌ Hay ${errors} ${itemWord} (en rojo). Reintentar.${histHtml}`;
    }
}

// ── Subfase 2: completar la(s) tabla(s) resultantes ───────────────────────────
// Banco de palabras: campos correctos de este paso + distractores (nombres de
// campo del ejercicio que no corresponden a ninguna tabla de este paso).
function _normWordPool(step) {
    const correct = [];
    step.resultTables.forEach(t => t.fields.forEach(f => correct.push(f.name)));

    const allFieldNames = new Set();
    _normDataEx.steps.forEach(s => s.resultTables.forEach(t => t.fields.forEach(f => allFieldNames.add(f.name))));
    _normDataEx.rawTable.fixedFields.forEach(f => allFieldNames.add(f));
    _normDataEx.rawTable.repeatingFields.forEach(f => allFieldNames.add(f));

    const correctSet = new Set(correct);
    const distractors = [...allFieldNames].filter(n => !correctSet.has(n));

    return [...correct, ...distractors];
}

// ── Variante "marcar" de la subfase "dependencies" (solo cuando step.markToTable) ──
// En vez de elegir entre 2 tablas para CADA atributo, se marcan solo los que pasan
// a la tabla nueva (step.markToTable) — el resto se entiende que queda donde estaba,
// igual que el checklist de la compuerta.
function _renderNormDependencyMarkUI(step) {
    const si = _normStepIdx;
    if (!_normDepMarks[si]) _normDepMarks[si] = new Set();
    const marked  = _normDepMarks[si];
    const stayTable = step.dependencyOptions.find(o => o !== step.markToTable) || step.dependencyOptions[0];
    return `
        <div class="bg-indigo-950/30 border border-indigo-700/40 rounded-xl p-3 text-xs text-indigo-200">
            📌 Tabla <strong>${_esc(_pluralize(step.sourceTable))}</strong> — Marcar los atributos que forman parte de <strong>${_esc(_pluralize(step.markToTable))}</strong>
            (los que no se marquen quedan solo en ${_esc(_pluralize(stayTable))}; si un atributo se comparte entre las dos, como la clave, también se marca).
        </div>
        <div class="flex flex-wrap gap-2">
            ${step.dependencies.map(d => `
                <button onclick="_normToggleDepMark('${_escAttr(d.attr)}')"
                    data-attr="${_esc(d.attr)}"
                    class="norm-dep-mark px-3 py-1.5 rounded-lg text-xs font-bold font-mono border transition
                    ${marked.has(d.attr) ? 'bg-fuchsia-600 border-fuchsia-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-fuchsia-500'}">
                    ${_esc(d.attr)}
                </button>`).join('')}
        </div>
        <button id="btn-validate-dep" onclick="_normValidateDependencyMarks()"
            class="py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm transition active:scale-95">
            ✔ Validar clasificación
        </button>`;
}

function _normToggleDepMark(attr) {
    const si = _normStepIdx;
    if (!_normDepMarks[si]) _normDepMarks[si] = new Set();
    const marked = _normDepMarks[si];
    if (marked.has(attr)) marked.delete(attr); else marked.add(attr);
    const btn = document.querySelector(`.norm-dep-mark[data-attr="${CSS.escape(attr)}"]`);
    if (btn) {
        const isMarked = marked.has(attr);
        btn.className = 'norm-dep-mark px-3 py-1.5 rounded-lg text-xs font-bold font-mono border transition ' +
            (isMarked ? 'bg-fuchsia-600 border-fuchsia-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-fuchsia-500');
    }
}

function _normValidateDependencyMarks() {
    const step = _normDataEx.steps[_normStepIdx];
    const si = _normStepIdx;
    const marked = _normDepMarks[si] || new Set();
    let errors = 0;

    step.dependencies.forEach(d => {
        const shouldMark = d.dependsOn === step.markToTable;
        const isMarked   = marked.has(d.attr);
        const btn = document.querySelector(`.norm-dep-mark[data-attr="${CSS.escape(d.attr)}"]`);
        let cls = 'norm-dep-mark px-3 py-1.5 rounded-lg text-xs font-bold font-mono border transition ';
        if (shouldMark && isMarked) {
            cls += 'bg-emerald-700 border-emerald-500 text-white';
        } else if (!shouldMark && !isMarked) {
            cls += 'bg-slate-800 border-emerald-600/50 text-slate-300';
        } else if (!shouldMark && isMarked) {
            cls += 'bg-rose-700 border-rose-500 text-white';
            errors++;
        } else {
            cls += 'bg-amber-700 border-amber-500 text-white';
            errors++;
        }
        if (btn) btn.className = cls;
    });

    const total = step.dependencies.length;
    const hits  = total - errors;
    _normLog(si, 'dep', hits, total);
    const fb = document.getElementById('norm-feedback');
    if (!fb) return;
    fb.classList.remove('hidden');
    const histHtml = _normHistHtml(si, 'dep', 'Clasificación');

    if (errors === 0) {
        fb.className = 'p-3 rounded-2xl text-xs font-bold border bg-emerald-900/40 border-emerald-700 text-emerald-300';
        fb.innerHTML = `✅ ¡Correcto! Ahora armar la(s) tabla(s) resultante(s).${histHtml}`;
        _normStepPhase++;
        setTimeout(() => _renderNormPhase(), 1200);
    } else if (_normCount(si, 'dep') >= 3) {
        marked.clear();
        step.dependencies.forEach(d => { if (d.dependsOn === step.markToTable) marked.add(d.attr); });
        fb.className = 'p-3 rounded-2xl text-xs font-bold border bg-amber-900/40 border-amber-700 text-amber-200';
        fb.innerHTML = `🔎 Máximo de intentos alcanzado — así queda correcto. Ahora armar la(s) tabla(s).${histHtml}`;
        _normStepPhase++;
        setTimeout(() => _renderNormPhase(), 1900);
    } else {
        fb.className = 'p-3 rounded-2xl text-xs font-bold border bg-rose-900/40 border-rose-700 text-rose-300';
        fb.innerHTML = `❌ Hay ${errors} atributo(s) mal clasificado(s) (en rojo/ámbar). Reintentar.${histHtml}`;
    }
}

// Recordatorio de solo lectura de las dependencias ya identificadas (paso anterior),
// para tenerlas a la vista mientras se arman las tablas resultantes.
function _renderNormDependencyRecap(step) {
    if (!step.dependencies) return '';
    if (step.markToTable) {
        const si = _normStepIdx;
        const marked = _normDepMarks[si] || new Set();
        const stayTable = step.dependencyOptions.find(o => o !== step.markToTable) || step.dependencyOptions[0];
        return `
            <div class="bg-indigo-950/20 border border-indigo-800/30 rounded-xl p-3 flex flex-col gap-1.5">
                <p class="text-[10px] font-extrabold text-indigo-300 uppercase tracking-widest">📌 Clasificación de ${_esc(_pluralize(step.sourceTable))} (ya marcada)</p>
                <div class="flex flex-wrap gap-2">
                    ${step.dependencies.map(d => `
                        <span class="px-2.5 py-1 rounded-lg text-[11px] font-mono bg-slate-800/70 border border-slate-700 text-slate-300">
                            <strong class="text-white">${_esc(d.attr)}</strong> → ${_esc(_pluralize(marked.has(d.attr) ? step.markToTable : stayTable))}
                        </span>`).join('')}
                </div>
            </div>`;
    }
    return `
        <div class="bg-indigo-950/20 border border-indigo-800/30 rounded-xl p-3 flex flex-col gap-1.5">
            <p class="text-[10px] font-extrabold text-indigo-300 uppercase tracking-widest">📌 Dependencias de ${_esc(_pluralize(step.sourceTable))} (ya identificadas)</p>
            <div class="flex flex-wrap gap-2">
                ${step.dependencies.map(d => `
                    <span class="px-2.5 py-1 rounded-lg text-[11px] font-mono bg-slate-800/70 border border-slate-700 text-slate-300">
                        <strong class="text-white">${_esc(d.attr)}</strong> → ${_esc(d.dependsOn)}
                    </span>`).join('')}
            </div>
        </div>`;
}

function _renderNormFillUI(step) {
    const si = _normStepIdx;
    const pool = _normWordPool(step);
    _normWordPoolCache[si] = pool;
    const shuffled = [...pool].sort(() => Math.random() - 0.5);

    return `
        ${_renderNormDependencyRecap(step)}

        <p class="text-xs text-slate-400 font-bold">Completar la(s) tabla(s) resultante(s). El banco de palabras puede tener elementos de más.</p>

        <div id="norm-word-bank" class="flex flex-wrap gap-1.5">
            ${shuffled.map(w => `
                <button data-word="${_esc(w)}" onclick="_normSelectWord(this.dataset.word)"
                    class="norm-word px-2.5 py-1 rounded-lg text-xs font-bold transition">
                    ${_esc(w)}
                </button>`).join('')}
        </div>

        <div class="grid gap-4 ${step.resultTables.length > 1 ? 'md:grid-cols-' + Math.min(step.resultTables.length, 3) : ''}">
            ${step.resultTables.map((t, ti) => _renderNormFillTable(t, ti)).join('')}
        </div>

        <button id="btn-validate-norm" onclick="_normValidateFill()"
            class="py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm transition active:scale-95">
            ✔ Validar tabla(s)
        </button>`;
}

function _renderNormFillTable(t, ti) {
    return `
        <div class="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
            <p class="text-center text-fuchsia-300 font-extrabold text-sm mb-3">${_esc(_pluralize(t.name))}</p>
            <div class="flex flex-wrap gap-2 justify-center items-start">
                ${t.fields.map((f, fi) => {
                    const label = [f.isPK ? 'PK' : '', f.isFK ? 'FK' : ''].filter(Boolean).join(' · ');
                    const labelColor = f.isPK ? 'text-pink-400' : (f.isFK ? 'text-blue-400' : 'text-slate-500');
                    return `
                    <div class="flex flex-col items-center gap-1">
                        <span class="text-[9px] ${labelColor} font-bold h-3 leading-3 block">${label}</span>
                        <button id="norm-slot-${ti}-${fi}" onclick="_normFillSlot(${ti}, ${fi})"
                            class="norm-slot min-w-[90px] px-2 py-1.5 rounded-lg border-2 border-dashed border-slate-600 text-xs text-slate-500 hover:border-fuchsia-500 transition font-mono">
                            ?
                        </button>
                    </div>`;
                }).join('')}
            </div>
        </div>`;
}

function _normSelectWord(word) {
    _normSelectedWord = (_normSelectedWord === word) ? null : word;
    _normRefreshWordBank();
}

function _normFillSlot(ti, fi) {
    const btn = document.getElementById(`norm-slot-${ti}-${fi}`);
    if (!btn) return;
    const key = `${ti}_${fi}`;
    if (!_normSlots[_normStepIdx]) _normSlots[_normStepIdx] = {};

    if (_normSlots[_normStepIdx][key] !== undefined) {
        delete _normSlots[_normStepIdx][key];
        btn.textContent = '?';
        btn.className = 'norm-slot min-w-[90px] px-2 py-1.5 rounded-lg border-2 border-dashed border-slate-600 text-xs text-slate-500 hover:border-fuchsia-500 transition font-mono';
        _normRefreshWordBank();
        return;
    }
    if (!_normSelectedWord) return;
    _normSlots[_normStepIdx][key] = _normSelectedWord;
    btn.textContent = _normSelectedWord;
    btn.className = 'norm-slot min-w-[90px] px-2 py-1.5 rounded-lg border-2 border-fuchsia-500 bg-fuchsia-900/30 text-xs text-fuchsia-200 font-bold font-mono transition cursor-pointer';
    _normSelectedWord = null;
    _normRefreshWordBank();
}

function _normRefreshWordBank() {
    const bank = document.getElementById('norm-word-bank');
    if (!bank) return;
    const pool = _normWordPoolCache[_normStepIdx] || [];
    const counts = {};
    pool.forEach(w => counts[w] = (counts[w] || 0) + 1);
    const used = {};
    Object.values(_normSlots[_normStepIdx] || {}).forEach(w => { used[w] = (used[w] || 0) + 1; });

    bank.querySelectorAll('.norm-word').forEach(b => {
        const word = b.dataset.word;
        const usedUp = (used[word] || 0) >= (counts[word] || 0);
        const selected = _normSelectedWord === word;
        b.disabled = usedUp;
        b.className = 'norm-word px-2.5 py-1 rounded-lg text-xs font-bold transition ' +
            (usedUp ? 'bg-slate-800 border border-slate-700 text-slate-600 opacity-50 cursor-not-allowed' :
             selected ? 'bg-fuchsia-600 border border-fuchsia-500 text-white' :
             'bg-fuchsia-900/30 border border-fuchsia-700/40 text-fuchsia-200 hover:bg-fuchsia-800/40');
    });
}

function _normValidateFill() {
    const step = _normDataEx.steps[_normStepIdx];
    const si = _normStepIdx;
    const slots = _normSlots[si] || {};
    let total = 0, errors = 0;

    step.resultTables.forEach((t, ti) => {
        const pkFields = t.fields.filter(f => f.isPK).map(f => f.name);
        const nonPk    = t.fields.filter(f => !f.isPK).map(f => f.name);
        const pkZone   = pkFields.length;
        t.fields.forEach((f, fi) => {
            total++;
            const btn = document.getElementById(`norm-slot-${ti}-${fi}`);
            if (!btn) return;
            const w = slots[`${ti}_${fi}`];
            const ok = fi < pkZone ? (new Set(pkFields)).has(w) : (new Set(nonPk)).has(w);
            if (ok) {
                btn.className = 'norm-slot min-w-[90px] px-2 py-1.5 rounded-lg border-2 border-emerald-500 bg-emerald-900/30 text-xs text-emerald-200 font-bold font-mono';
            } else {
                errors++;
                btn.className = 'norm-slot min-w-[90px] px-2 py-1.5 rounded-lg border-2 border-rose-500 bg-rose-900/30 text-xs text-rose-300 font-bold font-mono';
            }
        });
    });

    const fb = document.getElementById('norm-feedback');
    if (!fb) return;
    fb.classList.remove('hidden');
    const hits = total - errors;
    _normLog(si, 'fill', hits, total);
    const histHtml = _normHistHtml(si, 'fill', 'Tabla');

    if (errors === 0) {
        _normStepDone[si] = true;
        fb.className = 'p-3 rounded-2xl text-xs font-bold border bg-emerald-900/40 border-emerald-700 text-emerald-300';
        fb.innerHTML = `✅ ¡Correcto! Avanzar al siguiente paso.${histHtml}`;
        setTimeout(() => _normNextStep(), 1200);
    } else if (_normCount(si, 'fill') >= 3) {
        step.resultTables.forEach((t, ti) => {
            if (!_normSlots[si]) _normSlots[si] = {};
            t.fields.forEach((f, fi) => {
                const btn = document.getElementById(`norm-slot-${ti}-${fi}`);
                if (!btn) return;
                _normSlots[si][`${ti}_${fi}`] = f.name;
                btn.textContent = f.name;
                btn.className = 'norm-slot min-w-[90px] px-2 py-1.5 rounded-lg border-2 border-emerald-500 bg-emerald-900/30 text-xs text-emerald-200 font-bold font-mono';
            });
        });
        _normStepDone[si] = true;
        fb.className = 'p-3 rounded-2xl text-xs font-bold border bg-amber-900/40 border-amber-700 text-amber-200';
        fb.innerHTML = `🔎 Máximo de intentos alcanzado — así se completa correctamente. Avanzar al siguiente paso.${histHtml}`;
        setTimeout(() => _normNextStep(), 1900);
    } else {
        fb.className = 'p-3 rounded-2xl text-xs font-bold border bg-rose-900/40 border-rose-700 text-rose-300';
        fb.innerHTML = `❌ Hay ${errors} campo(s) incorrectos: puede que no correspondan a esta tabla, o que estén en la zona equivocada (los PK van primero).${histHtml}`;
    }
}

function _normNextStep() {
    _normStepIdx++;
    _normStepPhase = 0;
    _renderNormPhase();
}

// ── Esquema final (después de resolver 1FN, 2FN y 3FN) ────────────────────────
function _renderNormComplete(container) {
    const data = _normDataEx;
    const tables = _normCurrentSchema(data, data.steps.length - 1);
    container.innerHTML = `
        <div class="bg-emerald-950/30 border border-emerald-700/40 rounded-2xl p-4 text-xs text-emerald-200 leading-relaxed">
            <strong>Esquema completo en 3FN.</strong> Escribir las restricciones de clave foránea (FK) en la caja de texto.
            <br>Formato: <code class="text-white">TABLA.campo FK TABLA2.campo</code> — una por línea.
        </div>
        <div class="flex flex-col gap-3">
            ${tables.map(t => _renderNormTableCard(t)).join('')}
        </div>

        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-3">
            <p class="text-xs font-extrabold text-slate-400 uppercase tracking-widest">
                Restricciones de integridad referencial (FK)
            </p>
            <p class="text-xs text-slate-500">
                Escribir una restricción por línea. Ejemplo: <code class="text-slate-300">CURSOS.CI_doc FK DOCENTES.CI_doc</code>
            </p>
            <textarea id="norm-fk-input" rows="6"
                class="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-fuchsia-500 resize-y"
                placeholder="Escribir las restricciones FK aquí...&#10;TABLA1.campo FK TABLA2.campo"></textarea>
            <button id="btn-validate-norm-fk" onclick="_normValidateFKConstraints()"
                class="py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition active:scale-95">
                ✔ Validar restricciones FK
            </button>
            <div id="norm-fk-feedback" class="hidden"></div>
        </div>

        <div class="flex gap-3">
            <button onclick="_normExportPDF()"
                class="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-xl text-sm transition flex items-center justify-center gap-2">
                📄 Exportar PDF
            </button>
            <button onclick="renderNormPanel(_normExIdx)"
                class="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-xl text-sm transition">
                🔄 Reiniciar ejercicio
            </button>
        </div>`;
}

// ── Restricciones FK esperadas, a partir del esquema final ────────────────────
function _buildExpectedNormConstraints(data) {
    const tables = _normCurrentSchema(data, data.steps.length - 1);
    const constraints = [];
    tables.forEach(t => {
        t.fields.forEach(f => {
            if (f.isFK && f.fkTo) {
                const refTbl   = tables.find(rt => rt.name === f.fkTo);
                const refPK    = refTbl?.fields.find(rf => rf.isPK);
                const refField = refPK ? refPK.name : f.name;
                constraints.push(`${_pluralize(t.name)}.${f.name} FK ${_pluralize(f.fkTo)}.${refField}`);
            }
        });
    });
    return constraints;
}

function _normValidateFKConstraints() {
    const data     = _normDataEx;
    const expected = _buildExpectedNormConstraints(data);
    const rawInput = (document.getElementById('norm-fk-input')?.value || '');
    const lines    = rawInput.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    const stripAccents = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

    // Mapa de nombres de tabla (singular Y plural) → forma canónica (la esperada, en plural)
    const tables = _normCurrentSchema(data, data.steps.length - 1);
    const canonicalMap = {};
    tables.forEach(t => {
        const canon = stripAccents(_pluralize(t.name)).toUpperCase();
        canonicalMap[stripAccents(t.name).toUpperCase()] = canon;
        canonicalMap[canon] = canon;
    });

    const normalizeLine = s => {
        let out = s.toUpperCase().trim()
                   .normalize('NFD').replace(/[̀-ͯ]/g, '')
                   .replace(/\s+/g, ' ');
        out = out.replace(/([A-ZÑ_]+)(?=\.)/g, w => canonicalMap[w] || w);
        return out;
    };

    const expectedNorm = expected.map(normalizeLine);
    const inputNorm    = lines.map(normalizeLine);

    const matched   = new Set();
    const unmatched = [];

    inputNorm.forEach((line, i) => {
        const idx = expectedNorm.findIndex((e, ei) => e === line && !matched.has(ei));
        if (idx !== -1) matched.add(idx);
        else unmatched.push(lines[i]);
    });

    const missing = expected.filter((_, i) => !matched.has(i));
    const allOk   = missing.length === 0 && unmatched.length === 0;

    const fb = document.getElementById('norm-fk-feedback');
    if (!fb) return;
    fb.classList.remove('hidden');

    const pct = expected.length > 0 ? Math.round((matched.size / expected.length) * 100) : 100;
    _normFKAttempts.push({ matched: matched.size, total: expected.length, pct });
    const histHtml = _normFKAttempts
        .map((s, i) => `<span class="font-bold">Intento ${i + 1}:</span> ${s.matched}/${s.total}`)
        .join(' &nbsp;|&nbsp; ');
    const histBlock = `<div class="mt-2 pt-2 border-t border-slate-700/50 text-[11px] text-slate-400">${histHtml}</div>`;

    if (allOk) {
        fb.className = 'p-4 rounded-2xl text-xs font-bold border bg-emerald-900/40 border-emerald-700 text-emerald-300';
        fb.innerHTML = `✅ ¡Perfecto! Las ${expected.length} restricciones FK son correctas.${histBlock}`;
    } else {
        fb.className = 'p-4 rounded-2xl text-xs font-bold border bg-amber-900/40 border-amber-700 text-amber-200';
        let html = '';
        if (matched.size > 0) {
            html += `<p class="text-emerald-300 mb-2">✅ ${matched.size} restricción(es) correcta(s).</p>`;
        }
        if (unmatched.length > 0) {
            html += `<p class="text-rose-300 mb-1">❌ No reconocidas (${unmatched.length}):</p>`;
            unmatched.forEach(u => {
                html += `<p class="font-mono bg-rose-900/30 px-2 py-0.5 rounded mb-0.5">${_esc(u)}</p>`;
            });
        }
        if (missing.length > 0) {
            if (_normFKAttempts.length >= 3) {
                html += `<p class="text-amber-300 mt-2 mb-1">⚠ Faltan (${missing.length}):</p>`;
                missing.forEach(m => {
                    html += `<p class="font-mono bg-amber-900/30 px-2 py-0.5 rounded mb-0.5 text-slate-300">${_esc(m)}</p>`;
                });
            } else {
                html += `<p class="text-amber-300 mt-2">⚠ Faltan ${missing.length} restricción(es). Revisar y reintentar.</p>`;
            }
        }
        fb.innerHTML = html + histBlock;
    }

    if (_normFKAttempts.length >= 3) {
        const btn = document.getElementById('btn-validate-norm-fk');
        if (btn) {
            btn.disabled = true;
            btn.className = 'py-3 bg-slate-700/50 text-slate-400 font-bold rounded-xl text-sm cursor-not-allowed';
            btn.textContent = '✓ Máximo 3 intentos';
        }
    }
}

// ── Registro de intentos ───────────────────────────────────────────────────────
function _normLog(stepIdx, kind, hits, total) {
    if (!_normAttempts[stepIdx]) _normAttempts[stepIdx] = { gate: [], violation: [], dep: [], fill: [] };
    if (!_normAttempts[stepIdx][kind]) _normAttempts[stepIdx][kind] = [];
    _normAttempts[stepIdx][kind].push({ hits, total });
}
function _normCount(stepIdx, kind) {
    return ((_normAttempts[stepIdx] || {})[kind] || []).length;
}
function _normHistHtml(stepIdx, kind, label) {
    const list = (_normAttempts[stepIdx] || {})[kind] || [];
    if (list.length === 0) return '';
    const inner = list.map((s, i) => `Int.${i + 1}: ${s.hits}/${s.total}`).join(' &nbsp;|&nbsp; ');
    return `<div class="mt-2 pt-2 border-t border-slate-700/30 text-[11px] opacity-80"><span class="font-bold">${label}:</span> ${inner}</div>`;
}

// ── Tabla sin normalizar, en HTML apto para impresión (fondo claro) ──────────
function _normRawTablePdfHTML(rt) {
    if (rt.singleMultivalued) {
        return `
        <p style="font-size:11px;color:#92400e;margin:0 0 6px;">${_esc(rt.repeatingLabel)}: varios valores dentro de la misma celda.</p>
        <table style="border-collapse:collapse;font-family:monospace;font-size:11px;width:100%;margin-bottom:16px;">
            <thead>
                <tr>
                    ${rt.fixedFields.map(f => `<th style="border:1px solid #d1d5db;padding:4px 8px;background:#f3f4f6;text-align:left;${(rt.keyFields || []).includes(f) ? 'text-decoration:underline;font-weight:bold;' : ''}">${_esc(f)}</th>`).join('')}
                    ${rt.repeatingFields.map(f => `<th style="border:1px solid #fcd34d;padding:4px 8px;background:#fffbeb;color:#92400e;text-align:left;${(rt.keyFields || []).includes(f) ? 'text-decoration:underline;font-weight:bold;' : ''}">${_esc(f)}</th>`).join('')}
                </tr>
            </thead>
            <tbody>
                ${rt.rows.map(r => `
                    <tr>
                        ${r.fixed.map(v => `<td style="border:1px solid #d1d5db;padding:4px 8px;background:#f9fafb;">${_esc(v)}</td>`).join('')}
                        <td style="border:1px solid #fde68a;padding:4px 8px;">${r.values.map(v => _esc(v)).join('<br>')}</td>
                    </tr>`).join('')}
            </tbody>
        </table>`;
    }

    const rows = [];
    rt.students.forEach(st => {
        st.courses.forEach((crow, ci) => {
            rows.push({ fixed: st.fixed, rowspan: st.courses.length, course: crow, first: ci === 0 });
        });
    });
    return `
        <p style="font-size:11px;color:#92400e;margin:0 0 6px;">${_esc(rt.repeatingLabel)}: grupo repetido dentro de la misma fila.</p>
        <table style="border-collapse:collapse;font-family:monospace;font-size:11px;width:100%;margin-bottom:16px;">
            <thead>
                <tr>
                    ${rt.fixedFields.map(f => `<th style="border:1px solid #d1d5db;padding:4px 8px;background:#f3f4f6;text-align:left;${(rt.keyFields || []).includes(f) ? 'text-decoration:underline;font-weight:bold;' : ''}">${_esc(f)}</th>`).join('')}
                    ${rt.repeatingFields.map(f => `<th style="border:1px solid #fcd34d;padding:4px 8px;background:#fffbeb;color:#92400e;text-align:left;${(rt.keyFields || []).includes(f) ? 'text-decoration:underline;font-weight:bold;' : ''}">${_esc(f)}</th>`).join('')}
                </tr>
            </thead>
            <tbody>
                ${rows.map(r => `
                    <tr>
                        ${r.first ? r.fixed.map(v => `<td style="border:1px solid #d1d5db;padding:4px 8px;background:#f9fafb;vertical-align:top;" rowspan="${r.rowspan}">${_esc(v)}</td>`).join('') : ''}
                        ${r.course.map(v => `<td style="border:1px solid #fde68a;padding:4px 8px;">${_esc(v)}</td>`).join('')}
                    </tr>`).join('')}
            </tbody>
        </table>`;
}

// ── PDF Export (iframe — evita bloqueo de popup) ──────────────────────────────
// Mismo mecanismo que _tabExportPDF() en tables.js: esquema final + restricciones
// FK + historial de aciertos/errores de cada paso (gate, dependencias, tablas, FK).
function _normExportPDF() {
    const data   = _normDataEx;
    const schema = _normCurrentSchema(data, data.steps.length - 1);
    const constr = _buildExpectedNormConstraints(data);

    const fieldStr = (f) => {
        let s = f.name;
        if (f.isPK) s = `<u><strong>${s}</strong></u>`;
        if (f.isFK) s = `<span style="color:#3b82f6">${s}</span>`;
        return s;
    };

    const tablesHTML = schema.map(t => `
        <div style="margin-bottom:16px;break-inside:avoid;">
            <div style="font-family:monospace;font-size:12px;line-height:1.6;
                        border:1px solid #e5e7eb;border-radius:8px;padding:12px;
                        background:#f9fafb;">
                <strong>${_pluralize(t.name)}</strong>(${t.fields.map(fieldStr).join(', ')})
            </div>
        </div>`).join('');

    const constrHTML = constr.map(c => `
        <p style="font-family:monospace;font-size:11px;margin:2px 0;color:#374151;">${_esc(c)}</p>`).join('');

    const enunciadoHTML = data.context
        ? `<h2>Enunciado</h2><div class="enunciado">${data.context}</div>`
        : '';

    const rawTableHTML = _normRawTablePdfHTML(data.rawTable);

    const stepLabels = ['1FN', '2FN', '3FN'];
    const attemptLines = [];
    data.steps.forEach((step, si) => {
        const a = _normAttempts[si];
        if (!a) return;
        const parts = [];
        if (a.gate.length > 0) parts.push(`¿Cumple?: ${a.gate.map((s, i) => `Int.${i+1}: ${s.hits}/${s.total}`).join(' | ')}`);
        if (a.violation && a.violation.length > 0) parts.push(`Atributo violador: ${a.violation.map((s, i) => `Int.${i+1}: ${s.hits}/${s.total}`).join(' | ')}`);
        if (a.dep.length  > 0) parts.push(`${step.assignLabel ? 'Clasificación' : 'Dependencias'}: ${a.dep.map((s, i) => `Int.${i+1}: ${s.hits}/${s.total}`).join(' | ')}`);
        if (a.fill.length > 0) parts.push(`Tabla(s): ${a.fill.map((s, i) => `Int.${i+1}: ${s.hits}/${s.total}`).join(' | ')}`);
        if (parts.length > 0) attemptLines.push(`${stepLabels[si] || `Paso ${si+1}`} — ${parts.join(' &nbsp;·&nbsp; ')}`);
    });
    if (_normFKAttempts.length > 0) {
        attemptLines.push(`Restricciones FK: ${_normFKAttempts.map((s, i) => `Int.${i+1}: ${s.matched}/${s.total}`).join(' &nbsp;|&nbsp; ')}`);
    }
    const attemptsHTML = attemptLines.length > 0
        ? `<div class="meta">${attemptLines.map(l => `<p style="margin:2px 0;">${l}</p>`).join('')}</div>`
        : '';

    const html = `<!DOCTYPE html>
<html lang="es"><head>
<meta charset="UTF-8">
<title>Normalización — ${data.title}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 13px; color: #1f2937; margin: 20px 30px; }
  h1   { font-size: 18px; margin-bottom: 4px; }
  h2   { font-size: 13px; color: #4b5563; border-bottom: 1px solid #d1d5db; padding-bottom: 4px; margin: 16px 0 8px; }
  .meta { font-size: 11px; color: #6b7280; margin-bottom: 16px; }
  .enunciado { font-size: 12px; line-height: 1.6; color: #374151; margin-bottom: 12px; }
  @media print { body { margin: 10mm 15mm; } }
</style>
</head><body>
<h1>Normalización</h1>
<p class="meta">Ejercicio: ${_esc(data.title)} &nbsp;|&nbsp; DB-Lab — Prof. Elizabeth Izquierdo | CC BY-SA 4.0</p>
${attemptsHTML}
${enunciadoHTML}
<h2>${_esc(_pluralize(data.rawTable.name))} — relación inicial</h2>
${rawTableHTML}
<h2>Modelo Relacional final (3FN)</h2>
${tablesHTML}
<h2>Restricciones de integridad referencial (FK)</h2>
${constrHTML}
</body></html>`;

    const oldTitle = document.title;
    const safeName = 'DB_Lab_Normalizacion_' + data.title
        .replace(/[\u{1F000}-\u{1FFFF}\u{2190}-\u{2BFF}\u{FE0F}]/gu, '')
        .trim()
        .replace(/\s+/g, '_');
    document.title = safeName;

    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;right:200%;bottom:200%;width:0;height:0;border:0;';
    document.body.appendChild(iframe);
    iframe.contentDocument.open();
    iframe.contentDocument.write(html);
    iframe.contentDocument.close();
    setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        setTimeout(() => {
            document.body.removeChild(iframe);
            document.title = oldTitle;
        }, 600);
    }, 350);
}
