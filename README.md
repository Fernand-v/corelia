<p align="center">
  <img src="apps/web/app/icon.svg" alt="Corelia Logo" width="80" height="80" />
</p>

<h1 align="center">Corelia</h1>

<p align="center">
  <strong>Plataforma de intranet y gestion de proyectos colaborativa, open source y self-hosted</strong>
</p>

<p align="center">
  <a href="#funcionalidades">Funcionalidades</a> &bull;
  <a href="#capturas-de-pantalla">Capturas</a> &bull;
  <a href="#tecnologias">Tecnologias</a> &bull;
  <a href="#instalacion">Instalacion</a> &bull;
  <a href="#arquitectura">Arquitectura</a> &bull;
  <a href="#contribuir">Contribuir</a> &bull;
  <a href="#licencia">Licencia</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License" />
  <img src="https://img.shields.io/badge/node-%3E%3D20-green.svg" alt="Node >= 20" />
  <img src="https://img.shields.io/badge/pnpm-9.12.3-orange.svg" alt="pnpm 9.12.3" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-blue.svg" alt="TypeScript" />
</p>

---

Corelia es una plataforma integral de intranet y gestion de proyectos para equipos que necesitan centralizar su trabajo en un solo lugar. Combina gestion de tareas con tablero Kanban, documentos colaborativos en tiempo real (texto, hojas de calculo, diagramas, pizarras), videollamadas WebRTC, mensajeria por canales, formularios, reportes, presupuestos y mucho mas — todo con un sistema de 6 roles jerarquicos y 50+ permisos granulares.

Despliega tu propia instancia con Docker Compose en minutos. Sin dependencias de servicios en la nube. Tus datos, tu servidor.


## Funcionalidades

### Gestion de proyectos y tareas
- Tablero **Kanban** con etapas personalizables y drag-and-drop
- Plantillas de proyecto: Software, Contenido y Operaciones
- Ciclo de vida de tareas con historial completo de cambios
- Dependencias entre tareas, bloqueos y reasignaciones con motivos
- Vinculacion de tareas con objetivos y acuerdos de reuniones
- Presupuesto por proyecto con partidas y flujo de aprobacion de gastos

### Documentos colaborativos en tiempo real
- **Texto enriquecido** — Editor Tiptap con formato completo
- **Hojas de calculo** — AG Grid + HyperFormula con formulas reales
- **Diagramas** — maxGraph con plantillas BPMN, UML, entidad-relacion, flujo, arquitectura y secuencia
- **Pizarras** — Excalidraw para bocetos y lluvias de ideas
- **Presentaciones** — Creacion de diapositivas
- Edicion simultanea entre multiples usuarios via Y.js CRDT
- Versionado automatico y manual con restauracion

### Reuniones y videollamadas
- Programacion de reuniones con invitaciones a participantes
- Notas de reunion y acuerdos con seguimiento de cumplimiento
- **Videollamadas WebRTC** via mediasoup (video y solo voz)
- Integracion con calendarios Google y Microsoft

### Mensajeria en tiempo real
- Canales por equipo y por proyecto
- Mensajes de texto, archivos adjuntos y notas de voz
- Menciones de usuarios con notificacion
- Confirmacion de lectura
- Invitaciones a llamada directamente desde el chat

### Formularios y solicitudes
- Constructor de formularios con multiples tipos de pregunta (texto, opcion multiple, valoracion, NPS, fecha, archivos)
- Flujo de solicitudes internas: vacaciones, permisos, acceso a recursos
- Aprobacion/rechazo con notificacion automatica
- Vista resumen con estadisticas

### Gestion de archivos
- Explorador con carpetas jerarquicas por proyecto y equipo
- Almacenamiento S3-compatible (MinIO)
- Historial de cambios y cuotas de almacenamiento

### Mas funcionalidades
- **Anuncios corporativos** — Publicacion inmediata, programada o recurrente con audiencia segmentada
- **Objetivos y metas** — Seguimiento de progreso vinculado a tareas
- **Calendario y disponibilidad** — Vista semanal con bloques de vacaciones, permisos y ausencias
- **Busqueda global** — Busqueda unificada de tareas, proyectos, mensajes, personas y archivos (Meilisearch)
- **Directorio de personas** — Con estado de presencia en tiempo real
- **Reportes y metricas** — KPIs personales, reportes ejecutivos exportables a PDF y Excel
- **Notificaciones** — Push en el navegador (VAPID), correo electronico, preferencias por tipo y frecuencia
- **Automatizaciones** — Reglas por proyecto: notificaciones automaticas, cambios de estado, auditorias
- **Integraciones** — Webhooks salientes (Slack, Teams), importacion desde CSV, Trello y Notion
- **Registro de auditoria** — Trazabilidad completa de todas las acciones del sistema
- **Control de tiempo** — Registro de horas y configuracion de horarios laborales
- **Onboarding/offboarding** — Checklists para incorporacion y baja de usuarios

### Sistema de roles (RBAC)

6 roles jerarquicos con mas de 50 permisos granulares, aplicados a nivel global y por proyecto:

| Rol | Descripcion |
|---|---|
| `INVITADO_EXTERNO` | Acceso minimo, solo lectura limitada |
| `OBSERVADOR` | Lectura de proyectos y tareas |
| `COLABORADOR` | Crear y editar tareas, documentos, mensajes |
| `COORDINADOR_EQUIPO` | Gestionar miembros del equipo y asignar tareas |
| `LIDER_PROYECTO` | Gestion completa de proyectos, presupuesto, aprobaciones |
| `ADMINISTRADOR` | Acceso total al sistema |

## Tecnologias

### Frontend
| Tecnologia | Uso |
|---|---|
| **Next.js 15** | Framework (App Router) |
| **TypeScript** | Lenguaje |
| **Tailwind CSS** | Estilos |
| **TanStack Query** | Estado del servidor |
| **Zustand** | Estado del cliente |
| **React Hook Form + Zod** | Formularios y validacion |
| **Socket.IO** | Comunicacion en tiempo real |
| **Tiptap** | Editor de texto enriquecido |
| **AG Grid + HyperFormula** | Hojas de calculo |
| **maxGraph** | Diagramas |
| **Excalidraw** | Pizarras |
| **Hocuspocus + Y.js** | Edicion colaborativa |

### Backend
| Tecnologia | Uso |
|---|---|
| **Fastify 5** | Framework HTTP (ESM) |
| **TypeScript** | Lenguaje |
| **Prisma** | ORM (PostgreSQL) |
| **Redis 7** | Cache y colas |
| **BullMQ** | Jobs en segundo plano |
| **Socket.IO** | Tiempo real |
| **mediasoup** | WebRTC (videollamadas) |
| **MinIO** | Almacenamiento S3 |
| **Meilisearch** | Busqueda full-text |
| **Nodemailer** | Emails transaccionales |
| **PDFKit / ExcelJS** | Exportacion de reportes |

### Infraestructura
| Tecnologia | Uso |
|---|---|
| **Docker Compose** | Orquestacion de servicios |
| **PostgreSQL 16** | Base de datos relacional |
| **Nginx** | Proxy inverso y TLS |
| **Grafana + Tempo** | Monitoreo y tracing distribuido |
| **Turborepo** | Monorepo build system |
| **pnpm 9** | Gestor de paquetes |

## Arquitectura

```
corelia/
├── apps/
│   ├── api/                 # REST API — Fastify 5 (TypeScript, ESM)
│   │   ├── src/
│   │   │   ├── plugins/     # Plugins: auth, rbac, redis, storage, queues, socket, media...
│   │   │   ├── modules/     # 27 modulos (router.ts + service.ts + schema.ts)
│   │   │   ├── lib/         # Utilidades: RBAC, tokens, passwords, HTTP
│   │   │   └── config/      # Validacion de env vars con Zod
│   │   └── prisma/          # Schema, migraciones y seeds
│   ├── web/                 # Frontend — Next.js 15 (App Router)
│   │   ├── app/
│   │   │   ├── (auth)/      # Login, activacion de invitaciones
│   │   │   ├── (dashboard)/ # Todas las vistas autenticadas (30+ paginas)
│   │   │   └── call/        # Sala de videollamadas (standalone)
│   │   ├── components/      # 50+ componentes React
│   │   └── lib/             # API client, Socket.IO, Hocuspocus
│   ├── hocuspocus/          # Servidor colaborativo — Y.js CRDT
│   └── workers/             # Jobs en segundo plano — BullMQ
│       └── src/jobs/        # email, webhooks, automaciones, purga de documentos
├── packages/
│   ├── types/               # Schemas Zod y tipos compartidos
│   ├── ui/                  # Libreria de componentes UI
│   └── config/              # Config ESLint, Prettier, TypeScript
└── docker/                  # Docker Compose (dev, staging, produccion)
```

### Flujo de comunicacion

```
                    ┌──────────┐
                    │  Nginx   │ :80/:443
                    └────┬─────┘
            ┌────────────┼────────────┐
            │            │            │
      /api/v1/*      /*         /collab/*
            │            │            │
     ┌──────┴──────┐  ┌──┴───┐  ┌────┴──────┐
     │  Fastify API │  │ Next │  │ Hocuspocus│
     │    :4000     │  │ :3000│  │   :1234   │
     └──────┬───┬───┘  └──────┘  └───────────┘
            │   │
     ┌──────┘   └──────┐
     │                  │
┌────┴─────┐    ┌───────┴───────┐
│PostgreSQL│    │  Redis / MinIO│
│  :5432   │    │  :6379 / :9000│
└──────────┘    └───────────────┘
```

## Instalacion

### Requisitos previos

- **Node.js** >= 20
- **pnpm** 9.12.3 (`corepack enable && corepack prepare pnpm@9.12.3 --activate`)
- **Docker** y **Docker Compose**

### Inicio rapido con Docker (recomendado)

```bash
# 1. Clonar el repositorio
git clone https://github.com/tu-usuario/corelia.git
cd corelia

# 2. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus valores (ver seccion de configuracion abajo)

# 3. Levantar todo el stack
docker compose --env-file .env -f docker/docker-compose.yml up -d --build

# 4. Inicializar base de datos
corepack enable
corepack pnpm install
corepack pnpm prisma:seed

# 5. Crear administrador inicial
BOOTSTRAP_ADMIN_EMAIL='admin@corelia.local' \
BOOTSTRAP_ADMIN_PASSWORD='Admin123!@#' \
BOOTSTRAP_ADMIN_FIRST_NAME='Admin' \
BOOTSTRAP_ADMIN_LAST_NAME='Corelia' \
corepack pnpm bootstrap:admin
```

Tu instancia estara disponible en `http://localhost`.

### Desarrollo local

```bash
# 1. Instalar dependencias
pnpm install

# 2. Configurar variables de entorno
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
cp apps/workers/.env.example apps/workers/.env

# 3. Levantar solo infraestructura (PostgreSQL, Redis, MinIO, Meilisearch)
cd docker && docker compose up -d postgres redis minio meilisearch && cd ..

# 4. Migraciones y seed
pnpm prisma:migrate:dev
pnpm prisma:generate
pnpm prisma:seed

# 5. Crear admin
pnpm bootstrap:admin

# 6. Iniciar en modo desarrollo
pnpm dev
```

En modo desarrollo sin Nginx, el frontend auto-enruta las llamadas API al puerto 4000. Accede a `http://localhost:3000`.

### Datos de demostracion (opcional)

```bash
pnpm data:demo
```

### Configuracion de variables de entorno

Variables minimas requeridas en `.env`:

| Variable | Descripcion |
|---|---|
| `POSTGRES_PASSWORD` | Contraseña de PostgreSQL |
| `REDIS_PASSWORD` | Contraseña de Redis |
| `JWT_ACCESS_SECRET` | Secreto para tokens JWT de acceso |
| `JWT_REFRESH_SECRET` | Secreto para tokens JWT de refresco |
| `COLLAB_AUTH_SECRET` | Secreto para el servidor colaborativo |
| `MINIO_ROOT_USER` | Usuario root de MinIO |
| `MINIO_ROOT_PASSWORD` | Contraseña root de MinIO |
| `SMTP_USER` | Usuario SMTP para emails |
| `SMTP_PASS` | Contraseña SMTP |

Para push notifications del navegador:

```bash
# Generar claves VAPID
corepack pnpm push:generate-keys
# Añadir al .env: WEB_PUSH_VAPID_PUBLIC_KEY, WEB_PUSH_VAPID_PRIVATE_KEY, WEB_PUSH_ENABLED=true
```

Para acceso en red local o produccion, ajustar tambien: `CORS_ALLOWED_ORIGINS`, `NEXT_PUBLIC_API_URL_DOCKER`, `NEXT_PUBLIC_WS_URL_DOCKER`, `MEDIA_ANNOUNCED_IP`.

### Servicios y puertos

| Servicio | Puerto | Descripcion |
|---|---|---|
| Web (Nginx) | 80/443 | Frontend y proxy |
| API (directa) | 4000 | REST API |
| MinIO Console | 9001 | Panel de almacenamiento |
| PostgreSQL | 5432 | Base de datos |
| Redis | 6379 | Cache y colas |
| Meilisearch | 7700 | Motor de busqueda |
| Hocuspocus | 1234 | Documentos colaborativos |

## Comandos utiles

```bash
pnpm dev                    # Inicia todos los apps (watch mode)
pnpm build                  # Compila todo el monorepo
pnpm test                   # Ejecuta todos los tests
pnpm lint                   # Lint de todo el proyecto
pnpm typecheck              # Verificacion de tipos
pnpm prisma:migrate:dev     # Crear y aplicar migraciones
pnpm prisma:generate        # Regenerar cliente Prisma
pnpm search:reindex         # Reindexar Meilisearch
pnpm data:demo              # Generar datos de demostracion

# Ejecutar solo un app
pnpm --filter @corelia/api dev
pnpm --filter @corelia/web dev

# Ejecutar un test individual
pnpm --filter @corelia/api exec vitest run src/test/auth.integration.spec.ts
```

## Contribuir

Las contribuciones son bienvenidas. Para contribuir:

1. Haz un fork del repositorio
2. Crea una rama para tu feature (`git checkout -b feature/mi-feature`)
3. Realiza tus cambios y asegurate de que los tests pasan (`pnpm test`)
4. Verifica linting y tipos (`pnpm lint && pnpm typecheck`)
5. Haz commit de tus cambios
6. Abre un Pull Request

### Estructura de tests

- **API:** `apps/api/src/test/**/*.spec.ts` — Vitest, cobertura minima 70%
- **Web:** `apps/web/**/*.spec.ts` — Vitest

## Licencia

Este proyecto esta bajo la [Licencia MIT](LICENSE).

---

<p align="center">
  Hecho con esfuerzo y dedicacion
</p>
