# Corelia - Intranet Colaborativa por Fases (v4)

Este documento define el alcance funcional de Corelia como intranet unificada, incluyendo operación diaria, colaboración en tiempo real y gestión estratégica.

---

## Dependencias entre Fases (Mapa de Construcción)

```
Fase 1 (Núcleo Operativo)
  └─► Fase 2A (Comunicación en Tiempo Real)
        └─► Fase 2B (Documentación Colaborativa)
              └─► Fase 3 (Planificación y Gestión Estratégica)
```

Requerimientos de entrada por fase:

- **Fase 2A** requiere: módulo de calendario v1, motor de notificaciones, módulo de identidad y permisos.
- **Fase 2B** requiere: módulo de archivos v1, módulo de mensajería v1, módulo de búsqueda v1.
- **Fase 3** requiere: módulo de tareas con dependencias, calendario colaborativo v2, módulo de analítica base.

---

## Alcance Base de la Intranet (Obligatorio)

Corelia debe cubrir de forma nativa:

- Canales de comunicación por equipo y proyecto.
- Videollamadas internas con ciclo completo de reunión (agenda, acuerdos, seguimiento).
- Documentos colaborativos editables por múltiples usuarios.
- Carpetas compartidas con permisos granulares.
- Calendario de responsabilidades y disponibilidad.
- Gestión de dependencias entre tareas.
- Roles, permisos y asignación por proyecto con resolución de conflictos de rol.
- Reasignación controlada de tareas.
- Búsqueda global unificada.
- Onboarding, offboarding y acceso de invitados externos.
- Historial de decisiones vinculado a tareas e hitos.
- Plan de migración desde herramientas externas.
- Notificaciones y alertas configurables por usuario.
- Base de conocimiento y wiki interna organizacional.
- Formularios y solicitudes internas con flujos de aprobación.
- Tablón de anuncios y comunicación organizacional segmentada.
- Registro de tiempo y dedicación por tarea o proyecto.
- Directorio de personas con perfil, rol, equipo y habilidades.
- Automatizaciones simples basadas en reglas de eventos.
- Gestión de objetivos vinculados a proyectos y tareas.

---

## Modelo Base de Estados de Tarea (Desde Fase 1)

Estados mínimos:

- `Backlog`
- `Pendiente`
- `En progreso`
- `En revisión`
- `Bloqueada`
- `Completada`
- `Cancelada`

Reglas mínimas:

- `Bloqueada` debe registrar causa y tarea bloqueante (si aplica).
- `Completada` no puede reasignarse sin reapertura autorizada.
- Todo cambio de estado queda en auditoría con usuario, fecha y motivo.

Plantillas de estado por tipo de proyecto (configurables desde Fase 1):

- Proyectos de desarrollo de software.
- Proyectos de contenido y comunicación.
- Proyectos de operaciones internas.

---

## Matriz de Roles y Límites Operativos (Desde Fase 1)

### Roles base

- `Administrador`: control global, configuración, permisos y reasignación total.
- `Líder de proyecto`: planificación y reasignación dentro de sus proyectos.
- `Coordinador de equipo`: distribución operativa dentro de su equipo.
- `Colaborador`: ejecución y actualización de tareas asignadas.
- `Observador/Invitado interno`: visibilidad de avance sin permisos de edición.
- `Invitado externo`: acceso limitado y temporal a proyectos o documentos específicos mediante enlace con expiración.

### Resolución de conflictos de rol

Un usuario puede tener roles distintos en proyectos diferentes (por ejemplo, Líder en Proyecto A y Colaborador en Proyecto B). Las reglas de resolución son:

- Los permisos se aplican **en contexto de proyecto**, no de forma global.
- El rol más restrictivo aplica fuera del contexto de un proyecto específico.
- El `Administrador` puede resolver conflictos de acceso cuando sea necesario.
- El sistema debe mostrar al usuario su rol activo según el contexto en el que opera.

### Reasignación de tareas por rol

- `Administrador`: cualquier tarea.
- `Líder de proyecto`: tareas del proyecto que lidera.
- `Coordinador de equipo`: tareas entre miembros de su equipo en proyectos habilitados.
- `Colaborador`: solicita reasignación, no reasigna directamente.
- `Observador/Invitado`: sin permisos de reasignación.

### Validaciones obligatorias

- Motivo obligatorio al reasignar.
- Notificación al responsable anterior, nuevo responsable y líder.
- Validación de disponibilidad (vacaciones/ausencia).
- Validación de horario laboral (alerta y confirmación fuera de jornada).
- Bloqueo de cambios en tareas cerradas salvo reapertura autorizada.

---

## Fase 1 - Núcleo Operativo

### Objetivo

Estabilizar la operación diaria con control de acceso, trazabilidad y planificación básica real.

### Funcionalidades incluidas

- Autenticación segura y control de sesiones.
- RBAC con roles base, permisos por proyecto/equipo y resolución de conflictos de rol.
- Gestión de usuarios, equipos, proyectos y tareas.
- Flujo de onboarding con checklist configurable (rol, equipo, horario, acceso inicial).
- Flujo de offboarding con revocación de acceso, transferencia de tareas activas y archivado de historial.
- Gestión de invitados externos: acceso por enlace temporal con fecha de expiración y permisos mínimos.
- Directorio de personas: perfil por usuario con nombre, rol, equipo, horario, habilidades y contacto interno.
- Tablero con estados intermedios definidos y plantillas por tipo de proyecto.
- Dependencias básicas entre tareas (bloquea/depende) con alertas de bloqueo.
- Reasignación con motivo y auditoría completa.
- Calendario personal de responsabilidades y vencimientos.
- Registro de vacaciones, permisos, ausencias y jornada laboral.
- Capacidad operativa por persona (horas disponibles y límite de tareas activas).
- Registro de tiempo y dedicación por tarea (manual, con resumen por proyecto y persona).
- Canales internos de mensajería textual por equipo/proyecto.
- Notificaciones configurables por usuario: canal (email, interno), tipo de evento y frecuencia.
- Tablón de anuncios organizacionales con segmentación por área o empresa completa.
- Formularios internos básicos: solicitudes de vacaciones, permisos y acceso (con flujo de aprobación simple).
- Carpetas compartidas base por proyecto/equipo.
- Búsqueda global v1 en proyectos, tareas, mensajes, directorio y archivos por metadatos y títulos.
- Historial de decisiones: notas de decisión vinculadas a tareas, hitos o proyectos.
- Automatizaciones simples v1: reglas de evento configurables (ej. "al completar tarea → notificar líder", "sin movimiento en N días → alertar").
- Gestión de objetivos v1: definición de objetivos por equipo o proyecto con vinculación a tareas.
- Integración externa base: notificaciones por email, webhooks salientes y exportación de calendario (`.ics`).
- Importación de datos desde herramientas comunes (Trello, Notion, CSV) como parte del onboarding inicial.
- Página de estado del sistema y modo de mantenimiento visible para usuarios.
- Auditoría completa de eventos críticos.

### Entregables mínimos

- Módulo de identidad, permisos y resolución de roles en contexto.
- Módulo de ciclo de vida del usuario (alta, cambio, baja, transferencia, invitados externos).
- Módulo de directorio de personas v1.
- Módulo de proyectos/tareas con dependencias básicas y plantillas.
- Módulo de calendario operativo y disponibilidad v1.
- Módulo de capacidad de carga y registro de tiempo v1.
- Módulo de mensajería interna v1.
- Motor de notificaciones configurables v1.
- Módulo de tablón de anuncios v1.
- Módulo de formularios y solicitudes internas v1.
- Módulo de automatizaciones simples v1.
- Módulo de gestión de objetivos v1.
- Módulo de archivos/carpetas compartidas v1.
- Módulo de historial de decisiones v1.
- Módulo de búsqueda global v1.
- Módulo de integraciones base (email, webhooks, `.ics`).
- Herramienta de migración/importación inicial.
- Página de estado del sistema.

### Criterios de cierre medibles

- 100% de usuarios activos con rol, equipo y horario definido.
- 100% de offboardings ejecutados con transferencia o cierre de tareas activas.
- 95% de tareas activas con responsable y fecha objetivo.
- 100% de reasignaciones con motivo y traza en auditoría.
- 90% de consultas frecuentes resueltas desde búsqueda global.
- 100% de accesos de invitados externos con fecha de expiración configurada.
- Al menos una automatización activa por equipo al cierre de fase.
- Al menos un objetivo definido por proyecto activo al cierre de fase.
- Medición definida y activa para cada criterio (fuente: logs del sistema).

---

## Fase 2A - Comunicación en Tiempo Real

### Objetivo

Consolidar reuniones, coordinación en vivo y agenda compartida dentro de Corelia.

### Requiere de Fase 1

- Módulo de calendario v1.
- Motor de notificaciones configurables v1.
- Módulo de identidad y permisos.

### Funcionalidades incluidas

- Videollamadas integradas (1:1 y grupales).
- Compartir pantalla en reuniones.
- Ciclo completo de reunión: agenda previa, notas durante la sesión, registro de acuerdos y seguimiento de puntos abiertos vinculados a tareas.
- Calendario compartido por equipo/proyecto (vista día/semana/mes).
- Reprogramación de tareas desde calendario.
- Alertas de conflicto por horario, vacaciones y dependencias bloqueantes.
- Notificaciones en tiempo real (mensajes, menciones, cambios clave).
- Modo degradado: si falla videollamadas, el sistema mantiene activos el chat, la agenda y el registro de acuerdos.
- Integraciones de transición: sincronización con Google/Microsoft Calendar y notificaciones opcionales a Slack/Teams.

### Entregables mínimos

- Módulo de reuniones internas v1 (agenda, sesión, acuerdos y seguimiento).
- Módulo de calendario colaborativo v2.
- Motor de notificaciones en tiempo real.
- Motor de validación de conflictos de agenda y dependencias.
- Conectores de integración externa v1.

### Criterios de cierre medibles

- 70% o más de reuniones operativas semanales realizadas desde Corelia (fuente: logs de sesiones).
- 95% de notificaciones críticas entregadas en menos de 60 segundos (fuente: logs del motor de notificaciones).
- 100% de asignaciones nuevas validadas contra disponibilidad y jornada.
- 90% de reuniones con al menos un acuerdo o nota registrada.
- 80% de puntos de acuerdo con tarea o responsable vinculado.

---

## Fase 2B - Documentación Colaborativa y Contenido

### Objetivo

Centralizar la creación de conocimiento y contenido operativo dentro de la intranet.

### Requiere de Fase 1

- Módulo de archivos v1.
- Módulo de mensajería v1.
- Módulo de búsqueda global v1.

### Funcionalidades incluidas

- Documentos colaborativos con edición simultánea.
- Comentarios, sugerencias y menciones en documentos.
- Historial de versiones y comparación de cambios.
- Flujos de aprobación documental por rol con firma electrónica básica (confirmación formal con traza).
- Carpetas de uso mixto (equipo, proyecto, inter-área) con permisos avanzados.
- Base de conocimiento y wiki interna: espacio estructurado para procesos, guías, decisiones y conocimiento institucional, separado de los documentos de proyecto.
- Búsqueda global v2 con texto completo en documentos, mensajes, wiki y archivos indexados.
- Modo degradado: si falla la edición colaborativa, el sistema activa modo lectura con cola de cambios pendientes para aplicar al recuperarse.

### Entregables mínimos

- Módulo de documentos colaborativos v1.
- Módulo de versionado y aprobaciones con firma básica.
- Módulo de base de conocimiento / wiki interna v1.
- Gestión avanzada de permisos sobre contenido.
- Motor de indexación y búsqueda de texto completo.

### Criterios de cierre medibles

- 80% o más de documentos activos de proyecto gestionados dentro de Corelia (fuente: encuesta de adopción + logs).
- 100% de documentos críticos con historial de versiones disponible.
- Al menos 10 artículos de wiki publicados y referenciados por el equipo al cierre de fase.
- Búsqueda global disponible sobre tareas, mensajes, documentos, wiki y archivos.
- 0% de accesos a documentos críticos sin permiso registrado en auditoría.

---

## Fase 3 - Planificación y Gestión Estratégica

### Objetivo

Habilitar supervisión ejecutiva y toma de decisiones basada en datos consolidados.

### Requiere de Fases 2A y 2B

- Módulo de tareas con dependencias.
- Calendario colaborativo v2.
- Módulo de documentos con versionado.
- Módulo de gestión de objetivos v1.

### Funcionalidades incluidas

- Diagramas de actividades y flujos de proceso por proyecto.
- Gantt con dependencias, ruta crítica y alertas de desvío.
- Planeación de capacidad avanzada (equipo, carga y pronóstico).
- Gestión de objetivos v2 (OKR): objetivos estratégicos con resultados clave medibles, vinculados a proyectos, tareas y métricas de Corelia.
- Indicadores estratégicos (cumplimiento, productividad, bloqueos, tiempos de ciclo, avance de OKRs).
- Reportes ejecutivos exportables.
- Automatizaciones avanzadas v2: reglas complejas con condiciones múltiples, acciones encadenadas e integración con módulos externos.
- Búsqueda analítica v3: por periodos, equipos, estado y métricas clave.
- Plantillas avanzadas de proceso por tipo de proyecto.
- Integraciones empresariales (ERP/CRM/facturación) vía API y webhooks.
- Trazabilidad ampliada para auditoría y cumplimiento normativo.

### Entregables mínimos

- Módulo de diagramación y planificación avanzada.
- Módulo de gestión de objetivos v2 (OKR).
- Módulo de analítica y reportes ejecutivos.
- Motor de automatizaciones avanzadas v2.
- Módulo de integración empresarial v2.
- Auditoría ampliada para cumplimiento.

### Criterios de cierre medibles

- 90% o más de proyectos estratégicos supervisados con KPIs activos en Corelia (fuente: panel de indicadores).
- 100% de objetivos estratégicos del periodo con al menos un resultado clave medido desde Corelia.
- 100% de reportes ejecutivos periódicos generados desde Corelia.
- Reducción medible de desvíos por dependencias no gestionadas (línea base establecida en Fase 1).
- Al menos una integración empresarial activa y documentada en producción.

---

## Búsqueda Global (Definición por Fase)

- **Fase 1**: búsqueda unificada por metadatos en tareas, proyectos, mensajes, directorio y archivos.
- **Fase 2B**: búsqueda full-text en documentos, wiki y contenido indexado.
- **Fase 3**: búsqueda analítica por periodos, equipos, estado y métricas clave.

---

## Integración Externa (Hoja de Ruta)

- **Fase 1**: email, webhooks salientes, exportación de calendario (`.ics`) e importación de datos externos.
- **Fase 2A**: sincronización con Google/Microsoft Calendar, notificaciones en Slack/Teams.
- **Fase 3**: integraciones empresariales (ERP/CRM/facturación) y reportes automatizados.

---

## Automatizaciones (Evolución por Fase)

- **Fase 1 (v1)**: reglas simples de un evento → una acción. Ejemplos:
  - Al completar una tarea → notificar al líder.
  - Sin movimiento en N días → alertar al responsable.
  - Al reasignar → registrar en auditoría y notificar involucrados.

- **Fase 3 (v2)**: reglas complejas con condiciones múltiples y acciones encadenadas. Ejemplos:
  - Si una tarea está bloqueada más de 48h y el líder no ha respondido → escalar al administrador.
  - Al cerrar todos los hitos de un proyecto → generar reporte y notificar a dirección.
  - Al superar el 80% de carga de un colaborador → alertar al coordinador y proponer redistribución.

---

## Gestión de Objetivos (Evolución por Fase)

- **Fase 1 (v1)**: objetivos simples por equipo o proyecto con descripción, responsable y vinculación a tareas. Sin métricas automáticas.
- **Fase 3 (v2 - OKR)**: objetivos estratégicos con resultados clave medibles, progreso calculado desde datos de Corelia, ciclos de revisión configurables y visibilidad por área o empresa.

---

## Continuidad Operativa y Modo Degradado

Si un componente falla, Corelia debe seguir operando en modo parcial:

- **Si falla el servidor principal**: página de estado pública activa, comunicado automático a usuarios con tiempo estimado de restauración.
- **Si falla videollamadas**: mantener chat, agenda y registro de acuerdos.
- **Si falla edición colaborativa**: modo lectura + cola de cambios pendientes para aplicar al recuperarse.
- **Si falla indexación de búsqueda**: fallback a búsqueda básica por metadatos.
- **Si falla integración externa**: reintentos automáticos con backoff y trazabilidad de eventos fallidos.
- **Si falla motor de automatizaciones**: las acciones manuales equivalentes siguen disponibles; las automatizaciones fallidas quedan en cola con alerta al administrador.

Controles mínimos:

- Backups programados con pruebas periódicas de restauración.
- Objetivos de continuidad definidos (`RTO` y `RPO`) antes de salir a producción.
- Monitoreo activo y alertas de incidentes críticos.
- Página de estado del sistema accesible sin autenticación.

---

## Plantillas y Estandarización

Desde Fase 1, Corelia debe soportar plantillas configurables para:

- Estructura base de tareas por tipo de proyecto.
- Checklist de onboarding por rol.
- Estados predeterminados por flujo de trabajo.
- Notas de decisión estandarizadas.
- Formularios de solicitudes internas (vacaciones, permisos, accesos).

Desde Fase 3, se agregan:

- Plantillas de proceso avanzadas (con flujos de aprobación y Gantt predefinido).
- Plantillas de reportes ejecutivos.
- Plantillas de ciclo OKR por tipo de equipo.

---

## Requisitos Transversales

- Seguridad y privacidad de datos desde el diseño.
- Alta disponibilidad y continuidad operativa documentada.
- Escalabilidad progresiva por usuarios y proyectos.
- Rendimiento estable en uso concurrente.
- Experiencia usable en escritorio y móvil.
- Arquitectura modular y mantenible.
- Cumplimiento con normativas de privacidad aplicables (según mercado objetivo).

---

## Prioridad de Construcción

Si hay conflicto entre alcance y tiempo, priorizar en este orden:

1. Seguridad, roles, resolución de conflictos de rol y ciclo de vida de usuarios.
2. Operación diaria (tareas, dependencias, calendario, carga, directorio, plantillas base).
3. Notificaciones configurables y automatizaciones simples.
4. Comunicación en tiempo real y agenda compartida.
5. Documentación colaborativa, wiki y búsqueda avanzada.
6. Analítica, OKRs, integración empresarial y automatizaciones avanzadas.