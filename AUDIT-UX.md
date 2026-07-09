# Auditoría UX — Cajú

Auditoría completa de la experiencia de usuario del proyecto Cajú (gestión de pagos a proveedores).

---

## 1. Flujos del Usuario

### 1.1 Autenticación
1. El usuario llega a la app → ve pantalla de login
2. Click en "Iniciar sesión con Google" → OAuth con Supabase
3. Redirect de vuelta → se cargan datos → ve el Dashboard

### 1.2 Subir Factura (Inbox)
1. Navega a Inbox → click "Subir"
2. Aparece zona de drag & drop o click para seleccionar archivos (PDF, JPG, PNG, WebP)
3. Puede subir múltiples archivos a la vez (uno por uno secuencial)
4. Cada archivo se envía a `/api/invoices` → se sube a Supabase Storage → Claude Vision extrae los datos
5. Se detecta duplicado por hash SHA-256 del archivo
6. Se auto-crea el proveedor si no existe por RUT
7. La factura queda en estado EXTRACTED o REVIEW_REQUIRED según los scores de confianza de la IA
8. Se refresca toda la lista con `fetchData()`

### 1.3 Revisar y Aprobar Factura
1. En Inbox, click en una factura → ve detalle con datos extraídos, preview del documento, historial
2. Puede editar datos (proveedor, montos, fechas) con botón "Editar"
3. Puede cambiar estado: Aprobar, Disputa, Rechazar
4. Si tiene baja confianza en algún campo, se muestra score en color (verde >90%, amarillo >80%, rojo <80%)

### 1.4 Acciones en Lote (Inbox)
1. Seleccionar facturas con checkbox (o "Seleccionar todo")
2. Acciones disponibles: Aprobar, Marcar como Extraída, Rechazar, Eliminar

### 1.5 Pagar Facturas
1. Navega a "Pagos" → ve facturas con status APPROVED o SCHEDULED
2. Selecciona facturas con checkbox
3. Puede generar archivo TXT para Itaú Link Empresa (formato clásico 97 posiciones)
4. Puede exportar a Excel (SheetJS cargado desde CDN dinámicamente)
5. Puede marcar como "Pagada" (batch)
6. Sección colapsable "Historial de Pagos" muestra facturas PAID agrupadas por mes

### 1.6 Gastos Recurrentes (Fijos & Cuotas)
1. Ve resumen total mensual con breakdown por tipo (costos fijos, retiro socio, cuotas tarjeta)
2. Puede crear/editar/eliminar gastos recurrentes
3. Formulario con tipo, nombre, monto, día del mes, categoría, proveedor asociado
4. Para cuotas de tarjeta: total cuotas, cuota actual, últimos 4 dígitos
5. Editor de categorías (persisten en localStorage)

### 1.7 Gestión de Proveedores
1. Lista con búsqueda por nombre, alias o RUT
2. Cards con categoría, banco, monto pendiente
3. Puede crear proveedor manualmente con formulario completo (razón social, RUT, banco, cuenta, etc.)
4. Detalle muestra: datos, datos bancarios, facturas asociadas, totales pendiente/pagado
5. Edición inline de todos los campos
6. Eliminación con protección si tiene facturas asociadas

### 1.8 Dashboard
1. KPIs: monto pendiente, facturas vencidas, vencen en 7 días, inbox sin procesar
2. Obligaciones mensuales (desde gastos recurrentes)
3. Próximos vencimientos (top 6)
4. Breakdown por estado con clicks que llevan al Inbox

---

## 2. Puntos de Fricción en la UX

### 2.1 Upload de Facturas
- **Sin indicador de progreso real**: La barra de progreso es una animación CSS (`pulse`) que oscila infinitamente. No refleja progreso real del upload ni de la extracción IA. En archivos grandes o con respuesta lenta de Claude, el usuario no sabe si está funcionando.
- **Procesamiento secuencial**: Si se suben 10 facturas, se procesan una por una. Cada una pasa por upload + Claude Vision (varios segundos). No hay forma de cancelar.
- **Sin preview pre-upload**: El usuario no ve los archivos que seleccionó antes de que comience el procesamiento.
- **Notificaciones efímeras para errores**: Las notificaciones desaparecen en 2.5 segundos (`setTimeout 2500`). Si se suben 5 archivos y 3 fallan, el usuario ve solo el último error toast.
- **El error de duplicado es una notificación fugaz**: Si el archivo ya fue subido, se muestra un toast rojo por 2.5s. Debería linkear a la factura existente.

### 2.2 Flujo de Estados
- **Acción duplicada en InvDetail**: Las líneas 909-910 generan botones duplicados de "Pagada" cuando el estado es APPROVED (aparece 2 veces en el array `actions`).
- **Confirm nativo para todo**: Todas las acciones importantes (aprobar, rechazar, pagar, eliminar) usan `window.confirm()`. Rompe la estética y no permite customización.
- **No hay flujo de "Programar pago"**: El status SCHEDULED existe pero no hay UI para programar pagos con fecha futura. Solo se puede marcar como PAID directamente.
- **No hay undo**: Las actualizaciones optimistas no tienen rollback visual. Si falla la escritura a Supabase, aparece un toast de error pero el estado local ya cambió visualmente.

### 2.3 Edición de Facturas
- **Form no valida campos**: El formulario de edición de factura permite guardar sin total, sin fecha, con valores inválidos. No hay validación.
- **Total no se recalcula**: Si editás subtotal o IVA, el total no se actualiza automáticamente (y viceversa).
- **No se puede editar factura PAID**: No hay forma de corregir errores en facturas ya marcadas como pagadas.

### 2.4 Generación de Archivo Itaú
- **Solo formato Clásico (intra-Itaú)**: El código `generateItauTxt` en page.js solo genera el formato de 97 posiciones (Itaú-to-Itaú). Si el proveedor tiene banco diferente a Itaú, la generación falla silenciosamente (muestra error en toast pero sigue). El formato inter-bancario de `itau-format.js` (165 posiciones) **no se usa en la UI**.
- **Variables de entorno hardcodeadas en cliente**: `NEXT_PUBLIC_ITAU_DEBIT_ACCOUNT` y `NEXT_PUBLIC_ITAU_OFFICE_CODE` usan valores fallback hardcodeados (`"1234567"`, `"04"`). Si no están configuradas, se genera el archivo con datos ficticios sin warning.
- **El código Itaú está duplicado**: Existe `src/lib/itau-format.js` con una implementación completa, pero `page.js` reimplementa todo inline (líneas 1088-1168).

### 2.5 Proveedores
- **Auto-creación sin feedback claro**: Cuando Claude extrae un RUT nuevo, se crea un proveedor automáticamente con datos mínimos (nombre, RUT, categoría "Servicios"). El usuario no se entera explícitamente de que se creó un proveedor nuevo.
- **No se puede fusionar proveedores duplicados**: Si la IA crea dos proveedores con nombres ligeramente diferentes para el mismo proveedor, no hay forma de mergerlos.
- **Formulario de nuevo proveedor no valida**: Se puede guardar sin nombre ni RUT (los campos marcados con `*` no se validan).
- **Fallback silencioso**: Si falla el insert a Supabase, el código crea un proveedor con ID local (`s${Date.now()}`). Este proveedor no persiste al recargar.

### 2.6 Gastos Recurrentes
- **Los gastos recurrentes no generan facturas automáticas**: A pesar de que el schema tiene `auto_generate` y `last_generated_date`, no hay lógica que genere facturas desde recurrentes.
- **Las categorías se guardan en localStorage**: Si el usuario cambia de navegador/dispositivo, pierde sus categorías personalizadas.
- **No hay validación del formulario**: Se puede crear un gasto sin nombre o con monto 0.

### 2.7 Navegación y Layout
- **Sin deep linking / URLs**: Todo el routing es por estado interno (`view`). No se puede compartir un link a una factura, no hay botón "atrás" del browser, F5 siempre vuelve al Dashboard.
- **Sin keyboard shortcuts**: No hay atajos de teclado para ninguna acción.
- **El sidebar muestra "Admin" hardcodeado**: Línea 523 muestra "Admin" para todos los usuarios, independientemente de su rol real en la DB.

### 2.8 Carga Inicial
- **Se carga TODO**: `fetchData()` trae todas las facturas, todos los proveedores, y todos los gastos recurrentes de una vez. Sin paginación. Si la empresa tiene 5000 facturas históricas, la carga inicial será lenta.
- **Doble pantalla de loading**: Si auth está cargando, muestra LoadingScreen. Luego si data está cargando, muestra otra LoadingScreen idéntica. El usuario ve el spinner dos veces sin saber por qué.

---

## 3. Empty States

| Vista | ¿Tiene empty state? | Qué muestra | Observaciones |
|---|---|---|---|
| Inbox (sin facturas) | Sí | 📭 "Sin facturas" | Debería invitar a subir la primera factura con CTA |
| Inbox (filtro sin resultados) | Sí | Mismo 📭 "Sin facturas" | No distingue entre "no hay facturas" y "el filtro no tiene resultados" |
| Pagos (sin pendientes) | Sí | ✅ "Sin pagos pendientes" | Adecuado |
| Historial pagos (vacío) | Sí | "No hay pagos registrados aún" | Adecuado |
| Detalle factura (sin documento) | Sí | 📄 "Sin documento adjunto" | Adecuado |
| Detalle factura (sin eventos) | Sí | "Sin eventos" | Adecuado |
| Proveedores (sin proveedores) | No | Grilla vacía sin mensaje | **Falta empty state** |
| Proveedores (búsqueda sin resultados) | No | Grilla vacía | **Falta empty state** |
| Detalle proveedor (sin facturas) | Sí | "Sin facturas" | Adecuado |
| Dashboard (próximos vencimientos vacío) | No | Card vacía | **No hay mensaje cuando no hay vencimientos próximos** |
| Dashboard (sin datos) | No | Muestra $0 en todos los KPIs | Debería tener onboarding o mensaje de bienvenida |
| Recurrentes (sin gastos) | No | Solo headers de tipo sin items | **Falta empty state general** |

---

## 4. Quick Wins (Alto Impacto, Bajo Esfuerzo)

### 4.1 Corregir el botón duplicado "Pagada"
**Impacto**: Elimina confusión visual en detalle de factura.
**Esfuerzo**: 1 línea.
```
// Línea 909: esta condición ya está cubierta por la línea 910
if (inv.status === "APPROVED") actions.push(...)  // BORRAR ESTA LÍNEA
```

### 4.2 Distinguir empty states de filtro vs datos vacíos
**Impacto**: El usuario entiende si no tiene facturas o si su búsqueda no encontró resultados.
**Esfuerzo**: Condicional simple comparando `invoices.length === 0` vs `filtered.length === 0`.

### 4.3 Agregar empty states faltantes (Proveedores, Recurrentes, Dashboard)
**Impacto**: Primera impresión mucho mejor para usuarios nuevos. Guiarlos al primer paso.
**Esfuerzo**: 3-4 bloques de JSX simples.

### 4.4 Aumentar timeout de notificaciones de error a 5+ segundos
**Impacto**: El usuario puede leer el mensaje de error completo.
**Esfuerzo**: Cambiar `2500` a `5000` para `type === "error"`.

### 4.5 Validación básica de formularios
**Impacto**: Previene datos basura en la DB.
**Esfuerzo**: Deshabilitar botón "Guardar" si campos requeridos están vacíos.

### 4.6 Mostrar rol real del usuario en el sidebar
**Impacto**: Transparencia sobre permisos.
**Esfuerzo**: Leer de `profiles` y mostrar en vez del "Admin" hardcodeado.

### 4.7 Auto-recalcular total al editar subtotal/IVA
**Impacto**: Evita inconsistencias en montos.
**Esfuerzo**: `useEffect` o cálculo derivado en el form de edición de factura.

### 4.8 Feedback al crear proveedor automáticamente
**Impacto**: El usuario sabe que se creó un proveedor nuevo y puede ir a completar sus datos.
**Esfuerzo**: Mostrar en el toast de upload exitoso si se creó un proveedor nuevo.

### 4.9 Usar `itau-format.js` desde la UI en vez de duplicar
**Impacto**: Habilita transferencias inter-bancarias + elimina código duplicado.
**Esfuerzo**: Importar y llamar `generateItauPaymentFile()` en vez del código inline de `page.js`.

### 4.10 Agregar `loading` state al botón de guardar en formularios
**Impacto**: El usuario sabe que la acción se está procesando.
**Esfuerzo**: Estado booleano + `disabled` + texto "Guardando...".

---

## 5. Problemas de Código que Afectan UX

### 5.1 Monolito de `page.js` (~1600 líneas)
Todo el frontend vive en un solo archivo: Dashboard, Inbox, InvDetail, DocPreview, Payables, RecurringView, Suppliers, SupDetail, más todos los sub-componentes (Badge, Card, Btn, Input, Select, Progress), helpers, y lógica de negocio.

**Impacto en UX**:
- Cualquier cambio de estado re-renderiza potencialmente todo el árbol
- No hay code splitting: el bundle inicial incluye TODO
- Difícil de mantener → más probabilidad de bugs que afectan al usuario

### 5.2 Constantes duplicadas
| Constante | `page.js` | `utils.js` | `itau-format.js` |
|---|---|---|---|
| `STATUSES` | ✅ (con bg, icon) | ✅ (sin bg, icon) | — |
| `BANK_CODES` | ✅ | ✅ | ✅ |
| `fmt()` | ✅ | ✅ | — |
| `fmtDate()` | ✅ | ✅ | — |
| `daysUntil()` | ✅ | ✅ | — |
| Itaú format logic | ✅ (inline) | — | ✅ (modular) |

Si alguien agrega un banco en un lugar y no en otro, se generan pagos incorrectos.

### 5.3 Optimistic updates sin rollback
`updateInvoice()` actualiza el estado local inmediatamente y muestra un toast de éxito. Si la escritura a Supabase falla, muestra un toast de error pero **no revierte el estado local**. El usuario ve datos que no están persistidos.

### 5.4 Batch operations secuenciales
`batchUpdateInvoices` y `batchDeleteInvoices` iteran con `for...of` y hacen un request individual por factura. Con 50 facturas seleccionadas, esto genera 100 requests (50 updates + 50 inserts de eventos). Debería usar upserts o RPCs batch.

### 5.5 Sin manejo de sesión expirada
Si el token de Supabase expira mientras el usuario está usando la app, las operaciones empiezan a fallar silenciosamente (solo `console.error`). No hay redirect al login ni mensaje claro.

### 5.6 SheetJS cargado desde CDN externo
La generación de Excel carga SheetJS dinámicamente desde `cdn.sheetjs.com` (línea 1027). Si el CDN está caído o si hay restricciones de red corporativa, falla sin buen feedback. Además, `window.XLSX` persiste globalmente sin control.

### 5.7 DocPreview hace HEAD request en cada render
`DocPreview` hace un `fetch(publicUrl, { method: "HEAD" })` cada vez que se monta para probar si la URL pública funciona. Si el bucket es privado (que lo es por diseño), esto siempre falla y luego intenta signed URL. Genera un request innecesario por cada preview.

### 5.8 `supabase-browser.js` y `supabase-server.js` no se usan
`page.js` crea su propio cliente Supabase inline (línea 10). Los módulos de `src/lib/` quedan sin usar, lo que genera confusión sobre cuál es el patrón correcto.

### 5.9 `extract.js` no se usa desde la API route
`src/app/api/invoices/route.js` tiene su propia implementación de extracción inline con un prompt diferente al de `src/lib/extract.js`. Hay dos prompts de extracción distintos con campos diferentes (`emisor_nombre`/`emisor_rut` vs `supplier_name`/`supplier_tax_id`).

---

## Resumen de Prioridades

| Prioridad | Categoría | Items |
|---|---|---|
| **P0 — Bugs** | Funcional | Botón "Pagada" duplicado, optimistic update sin rollback, variables Itaú sin validar |
| **P1 — Quick wins** | UX | Empty states, timeout de errores, validación de forms, feedback de auto-creación de proveedor |
| **P2 — Deuda técnica** | Código | Unificar constantes, usar `itau-format.js` y `extract.js`, eliminar duplicación |
| **P3 — Mejoras** | UX | Progreso real de upload, deep linking, paginación, manejo de sesión expirada |
| **P4 — Arquitectura** | Código | Descomponer `page.js`, implementar App Router con rutas reales, code splitting |
