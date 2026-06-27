# Corelia 3NF Strict Structure

Este documento acompaña a `docs/db/corelia-3nf-structure.sql`.

La estructura propuesta toma como inspiración el modelo actual de Corelia, pero no es una migración directa. Es un rediseño relacional con foco en 3NF estricta y nombres de campos normalizados en `snake_case`.

## Criterios Aplicados

- No se usan arrays en columnas.
- No se usan columnas `json`/`jsonb`.
- No se guardan campos derivados o cacheados si pueden calcularse desde tablas hijas.
- No se usan relaciones polimórficas con muchos FK opcionales en una misma tabla.
- Los estados, tipos y catálogos se modelan como tablas lookup.
- Las relaciones N:M se modelan con tablas puente.
- Los nombres de tablas y campos usan `snake_case`.

## Normalizaciones Relevantes

- `PersonProfile.skills String[]` pasa a `skills` + `person_profile_skills`.
- `WorkSchedule.weekDays Int[]` pasa a `week_days` + `work_schedule_week_days`.
- `Message.mentions String[]` pasa a `message_mentions`.
- `DynamicFormQuestion.options Json` pasa a `dynamic_form_question_options`.
- `DynamicFormQuestion.conditionalLogic Json` pasa a `dynamic_form_conditional_rules`.
- `DynamicFormAnswer.value Json` pasa a columnas tipadas y `dynamic_form_answer_options`.
- `WebhookDelivery.payload` pasa a `webhook_delivery_fields`.
- `DocumentCollabEvent.payload` pasa a `document_collab_event_fields`.
- `AuditLog.previousDataText/newDataText` pasa a `audit_log_field_changes`.
- `StorageQuota` se divide en `user_storage_quotas` y `team_storage_quotas`.
- `DecisionNote.linked*Id` se divide en tablas de link por entidad.
- `AuditLog.target*Id` se divide en tablas de target por entidad.

## Campos Derivados Eliminados

- `ProjectMember.syncTeamsCount`: se calcula desde `project_member_team_sources`.
- `CollaborativeDocument.currentVersion`: se calcula con `MAX(version_number)` en `collaborative_document_versions`.
- `DocumentCollabSession.latestSnapshot*`: se obtiene desde versiones/snapshots asociados.
- `Objective.progressPct`: se calcula desde `objective_tasks` y el estado de las tareas.

## Notas

La 3NF estricta mejora integridad y reduce anomalías, pero puede aumentar joins y complejidad de escritura. Para producción, algunas desnormalizaciones pueden ser razonables si se documentan como cache y se protegen con transacciones, tests o triggers.
