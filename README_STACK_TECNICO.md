# Corelia - Stack Técnico (v3)

Este documento define las herramientas, lenguajes, bases de datos e infraestructura a utilizar en el desarrollo de Corelia. Las decisiones están orientadas a un equipo de 6-10 personas con experiencia en TypeScript, desplegando en infraestructura propia on-premise con acceso remoto vía VPN.

---

## Principios de Selección

- **Un solo lenguaje**: TypeScript de extremo a extremo, frontend y backend. Cualquier desarrollador puede trabajar en cualquier parte del sistema sin cambio de contexto.
- **Tipos compartidos entre capas**: esquemas Zod y tipos TypeScript compartidos entre frontend y backend desde el día uno.
- **Infraestructura 100% local**: los datos nunca salen de los servidores propios. Docker Compose en fases tempranas, Docker Swarm cuando se necesite escalar a más nodos.
- **Sin Kubernetes, sin cloud**: se evita la complejidad operativa y la dependencia de terceros para el alojamiento.
- **Acceso remoto seguro**: VPN obligatoria para cualquier acceso desde fuera de la red local.
- **Herramientas maduras**: evitar tecnologías experimentales en el núcleo del sistema.
- **Modularidad desde el inicio**: cada servicio debe poder desplegarse, actualizarse y escalar de forma independiente.

---

## Lenguaje

**TypeScript 5+ en todo el stack.**

- Frontend: Next.js (React).
- Backend: Node.js con Fastify.
- Workers y jobs asíncronos: Node.js con BullMQ.
- Tipos y esquemas compartidos: paquete interno `@corelia/types`.

No se utiliza ningún otro lenguaje en el sistema. La búsqueda full-text y el procesamiento asíncrono se resuelven íntegramente con Node.js y el ecosistema TypeScript.

---

## Frontend

| Decisión | Herramienta | Justificación |
|---|---|---|
| Framework principal | **Next.js 14+** | SSR/SSG, routing integrado, ecosistema maduro, excelente DX en TypeScript |
| Lenguaje | **TypeScript** | Tipado estático, mejor mantenibilidad en equipos medianos |
| Estilos | **Tailwind CSS** | Productividad alta, consistencia visual, sin CSS difícil de mantener |
| Componentes UI | **shadcn/ui** | Componentes accesibles, sin dependencia de librería externa, personalizables |
| Estado global | **Zustand** | Ligero, simple, suficiente para el alcance del proyecto |
| Estado del servidor | **TanStack Query** | Caché, revalidación y sincronización de datos sin boilerplate |
| Formularios | **React Hook Form + Zod** | Validación tipada compartida con backend |
| Editor colaborativo | **Tiptap (ProseMirror)** | Editor rico extensible con soporte Y.js para edición en tiempo real |
| Tiempo real (cliente) | **Socket.io-client** | Integración directa con el backend WebSocket |
| Testing | **Vitest + Testing Library** | Rápido, compatible con el ecosistema Next.js |

---

## Backend

### API Principal

| Decisión | Herramienta | Justificación |
|---|---|---|
| Runtime | **Node.js 20 LTS** | Estable, LTS, alto rendimiento en I/O concurrente |
| Framework | **Fastify** | Más rápido que Express, tipado nativo con TypeScript, arquitectura de plugins limpia |
| Lenguaje | **TypeScript** | Mismo lenguaje que frontend, tipos compartibles entre capas |
| ORM | **Prisma** | Migraciones controladas, cliente tipado, excelente DX con PostgreSQL |
| Validación | **Zod** | Esquemas compartidos con frontend, validación de entrada en runtime |
| Autenticación | **JWT + Refresh Tokens** | Sin estado en servidor, rotación de tokens para seguridad |
| WebSockets | **Socket.io** | Tiempo real para chat, notificaciones y edición colaborativa |
| Cola de tareas | **BullMQ (Redis)** | Jobs asíncronos para notificaciones, emails, automatizaciones, webhooks e indexación |
| Integración búsqueda | **Meilisearch JS SDK** | Indexación y consultas full-text desde Node.js |
| Testing | **Vitest + Supertest** | Tests unitarios y de integración sobre endpoints HTTP |

### Versionado de API

Todos los endpoints siguen la convención `/api/v1/...` desde Fase 1. Al introducir cambios incompatibles en Fase 3, se crea `/api/v2/...` manteniendo v1 activa durante un periodo de transición documentado.

---

## Bases de Datos

| Rol | Motor | Justificación |
|---|---|---|
| Base de datos principal | **PostgreSQL 16** | Relacional, ACID, JSONB para datos flexibles, row-level security nativo |
| Caché y tiempo real | **Redis 7** | Sesiones, caché de consultas, broker de colas BullMQ, pub/sub |
| Búsqueda full-text | **Meilisearch** | Índice dedicado para documentos, tareas, mensajes y wiki (activo desde Fase 2B) |
| Archivos y adjuntos | **MinIO** | Almacenamiento de objetos compatible con S3, autoalojable en red local |

### Estrategia por módulo

- **Proyectos, tareas, usuarios, roles, auditoría**: PostgreSQL.
- **Mensajería interna**: PostgreSQL con particionado por fecha si el volumen crece.
- **Sesiones y tokens activos**: Redis con TTL automático.
- **Documentos colaborativos en tiempo real**: Y.js con persistencia en PostgreSQL vía Hocuspocus.
- **Archivos adjuntos**: MinIO, con URL de referencia almacenada en PostgreSQL.
- **Índice de búsqueda**: Meilisearch, sincronizado desde PostgreSQL vía workers BullMQ.

### Gestión de límites de almacenamiento

- Cuotas configurables por usuario, equipo y proyecto.
- Alertas automáticas al alcanzar el 80% de cuota.
- El administrador puede ajustar cuotas individualmente o por grupo.
- Archivos eliminados van a papelera con retención configurable antes de borrado definitivo.

### Política de retención de datos

| Tipo de dato | Retención por defecto | Configurable |
|---|---|---|
| Mensajes de canal | 2 años | Sí, por administrador |
| Archivos eliminados (papelera) | 30 días | Sí |
| Versiones de documentos | 12 meses o últimas 50 versiones | Sí |
| Registros de auditoría | 3 años | No (cumplimiento) |
| Tokens de invitados externos expirados | 90 días | No |
| Logs del sistema | 6 meses | Sí |

---

## Infraestructura On-Premise

### Filosofía

Toda la infraestructura corre en servidores físicos propios dentro de la red local. Los datos nunca salen de las instalaciones. El acceso desde fuera de la oficina se realiza exclusivamente a través de VPN.

### Recomendaciones de Hardware por Fase

#### Fase 1 — Servidor principal (mínimo recomendado)

| Componente | Especificación |
|---|---|
| CPU | 8 núcleos (ej. Intel Xeon E-2300 o AMD Ryzen 7) |
| RAM | 32 GB DDR4 ECC |
| Almacenamiento sistema | 2× SSD NVMe 512 GB en RAID 1 (sistema operativo y servicios) |
| Almacenamiento datos | 2× HDD o SSD SATA 2 TB en RAID 1 (PostgreSQL, MinIO, backups) |
| Red | 1 Gbps |

> Con esta configuración se soporta cómodamente hasta 50 usuarios concurrentes en Fase 1.

#### Fase 2A / 2B — Servidor secundario opcional

Si el uso crece o se requiere separar servicios, agregar un segundo nodo con especificación similar al principal para distribuir carga (videollamadas, workers BullMQ, Meilisearch).

#### Fase 3 — Clúster mínimo recomendado

- 3 nodos físicos con la especificación de Fase 1 o superior.
- Docker Swarm para orquestación entre nodos.
- NAS dedicado o servidor de almacenamiento separado para MinIO y backups si el volumen de archivos supera 2 TB.

### Sistema Operativo

**Ubuntu Server 24.04 LTS** en todos los nodos.

- LTS con soporte hasta 2029.
- Amplia compatibilidad con Docker y herramientas de monitoreo.
- Sin interfaz gráfica (headless) para maximizar recursos disponibles.

### Red Local

| Elemento | Recomendación |
|---|---|
| Switch | Gestionable, mínimo 1 Gbps por puerto |
| Segmentación | VLAN separada para servidores de producción |
| IP servidores | IPs fijas en la red local (no DHCP) |
| DNS interno | Registro DNS local para `corelia.local` o dominio interno elegido |
| Firewall | Solo puertos necesarios abiertos: 80, 443 (Nginx), puerto VPN |

---

## Acceso Remoto — VPN

Todo acceso a Corelia desde fuera de la red local pasa obligatoriamente por VPN. No se expone ningún servicio directamente a internet.

| Decisión | Herramienta | Justificación |
|---|---|---|
| Servidor VPN | **WireGuard** | Moderno, rápido, fácil de configurar, bajo consumo de recursos |
| Gestión de clientes | **wg-easy** (interfaz web opcional) | Panel de administración simple para gestionar usuarios VPN |
| Instalación | En el servidor principal o en un nodo dedicado de red | |

### Reglas de acceso VPN

- Cada usuario (desarrollador o empleado remoto) tiene su propio perfil VPN.
- Al hacer offboarding, el perfil VPN se revoca junto con el acceso a Corelia.
- Los invitados externos nunca reciben acceso VPN; se les da acceso por enlace temporal dentro de Corelia.
- Los logs de conexión VPN se retienen 6 meses.

### Flujo de acceso remoto

```
Usuario remoto
    │
  WireGuard VPN
    │
  Red local
    │
  Nginx (proxy inverso)
    │
  Corelia (servicios internos)
```

---

## Contenedores y Orquestación

| Componente | Herramienta | Fase |
|---|---|---|
| Contenedores | **Docker** | Todas |
| Orquestación | **Docker Compose** | Fase 1, 2A, 2B |
| Orquestación multi-nodo | **Docker Swarm** | Fase 3 o cuando se agregue un segundo servidor |
| Proxy inverso | **Nginx** | Todas |
| SSL interno | **Certificado autofirmado o Let's Encrypt con DNS challenge** | Todas |

### Criterios para migrar a Docker Swarm

- Se agrega un segundo servidor físico a la infraestructura.
- Más de 100 usuarios concurrentes sostenidos en un solo nodo.
- Necesidad de actualizaciones sin downtime (rolling updates).

### Topología de servicios (Fase 1 — nodo único)

```
Red local / VPN
    │
  Nginx (proxy inverso + SSL)
    │
    ├── /            → Frontend (Next.js)
    ├── /api         → Backend principal (Fastify)
    ├── /ws          → WebSocket (Socket.io)
    └── /storage     → MinIO (archivos)

Servicios internos (sin exposición directa):
    ├── PostgreSQL
    ├── Redis
    ├── Meilisearch        [activo desde Fase 2B]
    └── BullMQ workers     (Node.js)
```

---

## Backups

Toda la estrategia de backup es local y sin dependencia de servicios externos.

| Dato | Método | Frecuencia | Retención |
|---|---|---|---|
| PostgreSQL | `pg_dump` automatizado | Diaria | 30 días |
| MinIO (archivos) | Sincronización a disco secundario | Diaria | 30 días |
| Redis | `BGSAVE` + copia del dump | Diaria | 7 días |
| Configuración Docker | Script de copia de `docker-compose.yml` y `.env` | En cada cambio | Indefinida |

### Destino de backups

- **Primario**: disco o partición separada en el mismo servidor.
- **Secundario recomendado**: NAS local o disco externo rotativo en otra ubicación física (protección ante fallo de hardware o incendio).

### Pruebas de restauración

- Restauración completa probada una vez al mes en entorno de desarrollo.
- Resultado de cada prueba documentado en la wiki interna.

---

## CI/CD en Red Local

Sin dependencia de servicios cloud para el pipeline de integración y despliegue.

| Componente | Herramienta | Justificación |
|---|---|---|
| Control de versiones | **Gitea** (autoalojado) o **GitHub** | Gitea si se quiere todo local; GitHub si se acepta servicio externo solo para código |
| CI/CD | **Woodpecker CI** (si Gitea) o **GitHub Actions** (si GitHub) | Woodpecker es autoalojable y compatible con Gitea |
| Registro de imágenes | **Registro Docker local** o **GHCR** | Registro propio si todo debe ser local |

> Si el equipo prefiere simplicidad sobre autonomía total, usar GitHub + GitHub Actions es perfectamente válido — solo el código y el pipeline estarían en la nube, no los datos ni la aplicación.

---

## Observabilidad

| Pilar | Herramienta | Qué cubre |
|---|---|---|
| Métricas | **Prometheus + Grafana** | CPU, memoria, requests por segundo, errores, latencia |
| Logs | **Loki + Grafana** | Logs estructurados de todos los servicios |
| Trazas | **OpenTelemetry + Tempo** | Trazado de extremo a extremo entre frontend, API y workers |

### Alertas mínimas desde Fase 1

- Error rate > 1% en los últimos 5 minutos.
- Latencia p95 > 2 segundos en endpoints críticos.
- Uso de disco > 80% en cualquier volumen.
- Uso de memoria > 85% sostenido por más de 10 minutos.
- Worker de BullMQ con jobs fallidos acumulados.
- Base de datos sin backup exitoso en las últimas 24 horas.
- Servidor sin respuesta de healthcheck por más de 2 minutos.

---

## Videollamadas

| Decisión | Herramienta | Justificación |
|---|---|---|
| Servidor de medios | **mediasoup** | SFU autoalojable, soporte WebRTC, sin dependencia de terceros |
| Protocolo | **WebRTC** | Estándar, bajo latencia, soporte nativo en navegadores |
| Señalización | **Socket.io** | Reutiliza el canal WebSocket ya existente |

> Alternativa más simple de operar: **Jitsi Meet** autoalojado. Menos control sobre la integración en UI pero mucho más simple de mantener.

---

## Colaboración en Tiempo Real (Documentos)

| Decisión | Herramienta | Justificación |
|---|---|---|
| Protocolo CRDT | **Y.js** | Estándar para edición colaborativa sin conflictos |
| Servidor de sincronización | **Hocuspocus** | Servidor Y.js listo para producción, integrable con Fastify |
| Editor de texto | **Tiptap** | Extensible, soporte nativo Y.js |
| Persistencia | **PostgreSQL** vía Hocuspocus | Estado del documento persistido periódicamente |

---

## Seguridad

| Área | Herramienta / Práctica |
|---|---|
| Autenticación | JWT con refresh token rotation, access token de vida corta (15 min) |
| Autorización | RBAC en middleware Fastify, validado en consultas Prisma |
| Acceso remoto | WireGuard VPN obligatoria, sin exposición directa a internet |
| Secretos | Variables de entorno por ambiente, nunca en el repositorio |
| Escaneo de dependencias | `npm audit` en pipeline CI en cada PR |
| Rate limiting | Plugin de rate limit en Fastify por IP y por usuario autenticado |
| HTTPS | Obligatorio en todos los ambientes, incluso en red local |
| Headers de seguridad | Helmet.js en Fastify (CSP, HSTS, X-Frame-Options, etc.) |
| Auditoría | Tabla de auditoría en PostgreSQL, escrita desde middleware centralizado |
| Firewall del servidor | `ufw` en Ubuntu: solo puertos necesarios abiertos |
| Actualizaciones | Parches de seguridad del SO aplicados mensualmente como mínimo |

---

## Migraciones de Base de Datos

Herramienta: **Prisma Migrate**.

### Flujo de trabajo

1. El desarrollador crea la migración localmente con `prisma migrate dev`.
2. La migración se revisa en pull request junto al código que la requiere.
3. El pipeline CI valida que la migración aplica correctamente sobre una base de datos limpia.
4. En despliegue a staging: migración automática antes de iniciar el servicio.
5. En despliegue a producción: aprobación manual del líder técnico + backup previo obligatorio.

### Reglas obligatorias

- Toda migración destructiva debe incluir script de rollback documentado.
- Nunca se modifica una migración ya aplicada en producción.
- Las migraciones deben ser idempotentes cuando sea posible.

---

## Ambientes

| Ambiente | Propósito | Dónde corre | Actualización |
|---|---|---|---|
| `development` | Trabajo local de cada desarrollador | Máquina del desarrollador | Manual |
| `staging` | Validación previa al release | Servidor físico propio (puede ser el mismo nodo con puertos distintos) | Automática al hacer merge a `main` |
| `production` | Sistema en uso real | Servidor físico principal | Manual con aprobación tras validar en staging |

### Reglas entre ambientes

- Staging refleja la misma configuración de servicios que producción.
- Los datos de producción nunca se copian a staging sin anonimización previa.
- Todo cambio pasa por `development → staging → production` sin excepciones.
- Variables de entorno separadas por ambiente, fuera del repositorio.

---

## Herramientas de Desarrollo

| Área | Herramienta |
|---|---|
| Monorepo | **Turborepo** |
| Package manager | **pnpm** |
| Linting | **ESLint + Prettier** |
| Tipos compartidos | Paquete `@corelia/types` con esquemas Zod y tipos TypeScript |
| Control de versiones | **Git + Gitea** (local) o **GitHub** |
| Estrategia de ramas | `main`, `develop`, `feature/*`, `fix/*`, `release/*` |
| Gestión del proyecto | **Corelia** (dogfooding desde Fase 1) |
| Documentación interna | **Corelia Wiki** (dogfooding desde Fase 2B) |
| Decisiones técnicas | **ADRs** en `/docs/adr/` dentro del repositorio |

### Gestión de deuda técnica

- Sprint de consolidación al final de cada fase antes de iniciar la siguiente.
- Deuda técnica registrada como issues etiquetados `tech-debt`.
- 20% de la capacidad de cada sprint destinado a reducir deuda existente.
- Deuda crítica (seguridad o estabilidad) no se pospone a la siguiente fase.

---

## Experiencia Móvil

Corelia será una **PWA (Progressive Web App)** construida sobre Next.js.

- Sin app nativa en fases iniciales.
- Instalable desde el navegador en dispositivos móviles.
- Responsive obligatorio desde Fase 1 para vistas críticas (tareas, calendario, mensajería).
- Notificaciones push mediante Web Push API.
- App nativa (React Native) diferida a Fase 3 o posterior según adopción real.

---

## Plan de Pruebas de Usuario por Fase

| Fase | Duración | Método | Criterio de aceptación |
|---|---|---|---|
| Fase 1 | 2 semanas | Dogfooding con equipo interno | Coordinación diaria sin herramientas externas |
| Fase 2A | 2 semanas | Equipos piloto + métricas de adopción | 70%+ de reuniones desde Corelia |
| Fase 2B | 3 semanas | Encuesta + logs | 80%+ de documentos activos en Corelia |
| Fase 3 | 4 semanas | Revisión ejecutiva + entrevistas | 90%+ de proyectos estratégicos supervisados |

---

## Evolución del Stack por Fase

| Componente | Fase 1 | Fase 2A | Fase 2B | Fase 3 |
|---|---|---|---|---|
| Frontend | Next.js + Tailwind + shadcn | + Tiptap básico | + Y.js colaborativo | + Dashboards analíticos |
| Backend | Fastify + Prisma + Zod | + Socket.io | Sin cambios | + Endpoints analíticos + API v2 |
| Búsqueda | PostgreSQL metadatos | Sin cambios | + Meilisearch full-text | + Búsqueda analítica |
| Workers | BullMQ básico | + Jobs notificaciones | + Indexación Meilisearch | + Automatizaciones avanzadas |
| Videollamadas | — | + mediasoup + WebRTC | Sin cambios | Sin cambios |
| Orquestación | Docker Compose | Docker Compose | Docker Compose | Evaluar Docker Swarm |
| Observabilidad | Prometheus + Loki | + OpenTelemetry | Sin cambios | + Tempo completo |
| Hardware | 1 servidor físico | 1 servidor físico | Evaluar 2º nodo | 2-3 nodos + NAS |

---

## Decisiones Diferidas

- **Docker Swarm**: al agregar un segundo servidor físico o superar 100 usuarios concurrentes.
- **Segundo servidor físico**: evaluar en Fase 2B según crecimiento de usuarios y almacenamiento.
- **NAS dedicado**: evaluar en Fase 3 si el volumen de archivos supera 2 TB.
- **SSO / SAML**: evaluar si se integra con directorio de usuarios corporativo existente (Active Directory, LDAP).
- **App nativa móvil**: evaluar tras Fase 3 según datos reales de uso móvil.
- **Gitea vs GitHub**: decidir antes de Fase 1 si el código fuente también debe ser local o se acepta GitHub.