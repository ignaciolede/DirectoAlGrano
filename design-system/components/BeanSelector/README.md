# BeanSelector

Grupos de chips para registrar el grano: qué tomaste, origen, tueste y método.

**Qué provee quien lo usa:** las opciones de cada grupo y las seleccionadas (`aria-pressed`). `data-single` en `.dag-chips` lo vuelve de una sola opción.

- "¿Qué tomaste?", "Tueste" y "Método" son de una opción; "Origen" admite varias (blends).
- Siempre incluir "No sé": no saber el origen no te puede trabar la review.
- Rótulo de grupo en `label`; separación entre grupos `space-6`.
- En la vista de detalle mostralo como `dag-tag` de solo lectura.
- Futuro: permitir agregar una opción propia ("+ Otro") que queda guardada.
