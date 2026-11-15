# Arca

Archivo privado para guardar lo que quieres conservar: imágenes, videos, PDFs, audio y texto, organizados en **baúles**. Un solo dueño, sin registro público.

> Estado: **etapa 1–3 en progreso**. Funcionan auth, baúles, subida directa a B2, comentarios, explorador con vista previa, papelera, worker de medios y enlaces para compartir. El player HLS usa un endpoint propio que reescribe la playlist con URLs firmadas por segmento.

## Stack

| Capa | Elección |
| --- | --- |
| Web | Next.js 15 (App Router) + React 19 + Tailwind v4 |
| Auth | Better Auth (email/password, signup deshabilitado) |
| Base de datos | Postgres en Neon Free + Drizzle ORM |
| Storage | Backblaze B2 (bucket privado, URLs firmadas) |
| Worker | Go + ffmpeg/ffprobe + pdftoppm |
| Cola | `processing_job` en Postgres con `FOR UPDATE SKIP LOCKED` |
| Deploy | Vercel Hobby |
| CI / worker | GitHub Actions (repo público) |

Coste objetivo: **$0** sin tarjeta. B2 free tier: 10 GB de storage; Neon Free: 0.5 GB; Vercel Hobby; Actions gratis en repos públicos.

## Estructura

```
apps/web                 Next.js: UI, API routes, server actions
packages/core            Constantes, schemas Zod, helpers compartidos
packages/db              Esquema Drizzle, cliente y migraciones
cmd/worker               Worker de medios (Go)
cmd/arca                 CLI operativa (Go)
internal/config          Variables de entorno
internal/store           Cola y acceso a Postgres
internal/storage         Cliente S3/B2
internal/media           ffmpeg, ffprobe, pdftoppm
internal/processor       Orquestación de derivados
docs/adr                 Decisiones de arquitectura
```

## Desarrollo local

Requisitos: Node 22+, pnpm 11+, Go 1.24+, Postgres 15+, ffmpeg y poppler (para el worker).

```bash
pnpm install
cp .env.example .env

# Crea la base local (ejemplo con rol arca/arca)
createdb -U postgres -O arca arca

pnpm db:migrate
pnpm db:seed
pnpm dev
```

Abre `http://localhost:3000` e inicia sesión con `OWNER_EMAIL` / `OWNER_PASSWORD`. El seed es idempotente y crea un baúl de bienvenida.

Para el worker:

```bash
go run ./cmd/worker          # loop continuo
go run ./cmd/worker -once    # drena la cola y sale
go run ./cmd/arca health
go run ./cmd/arca stats
go run ./cmd/arca jobs list pending 20
go run ./cmd/arca jobs retry <asset-id>
go run ./cmd/arca put <baúl> <archivo...>
go run ./cmd/arca pull <baúl> <destino>
```

> El módulo Go usa `github.com/silver/arca` como placeholder. Cámbialo en `go.mod` y en los imports (`internal/*`, `cmd/*`) cuando definas el repositorio.

### Storage opcional en local

Sin `S3_*`, la UI funciona pero las subidas responden `503` y `/api/health` marca `storage: error`. Puedes usar MinIO:

```bash
docker run --rm -p 9000:9000 -p 9001:9001 \
  -e MINIO_ROOT_USER=minioadmin -e MINIO_ROOT_PASSWORD=minioadmin \
  minio/minio server /data --console-address ":9001"
```

Crea el bucket `arca-media` y deja `S3_FORCE_PATH_STYLE=true`. El SDK desactiva checksums para compatibilidad con B2.

## Variables de entorno

| Variable | Uso |
| --- | --- |
| `APP_URL`, `BETTER_AUTH_URL` | Origen público de la app |
| `BETTER_AUTH_SECRET` | Secreto de 32+ caracteres |
| `DATABASE_URL` | Neon pooled (web) |
| `DATABASE_URL_DIRECT` | Neon directo (migraciones y worker) |
| `OWNER_EMAIL`, `OWNER_NAME`, `OWNER_PASSWORD` | Solo para `db:seed` |
| `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET` | Backblaze B2 |
| `S3_KEY`, `S3_SECRET` | Application key restringida al bucket |
| `S3_FORCE_PATH_STYLE` | `true` en B2 |
| `GITHUB_REPO`, `GITHUB_DISPATCH_TOKEN` | Disparo inmediato del worker |
| `CRON_SECRET` | Reservado para tareas programadas |
| `MAX_FILE_BYTES` | 1 GB por archivo |
| `STORAGE_QUOTA_BYTES` | 10 GB de cuota |

Variables del worker: `WORKER_MAX_ATTEMPTS`, `WORKER_LEASE_SECONDS`, `WORKER_POLL_SECONDS`, `WORKER_JOB_TIMEOUT_SECONDS`, `WORKER_TMP`, `FFMPEG_PATH`, `FFPROBE_PATH`, `PDFTOPPM_PATH`.

## Backblaze B2

1. Crea un bucket **privado** (ej. `arca-media`, región `us-west-004`).
2. Crea una application key con acceso solo a ese bucket (read/write/list/delete).
3. `S3_ENDPOINT` es el endpoint S3 de la región, p. ej. `https://s3.us-west-004.backblazeb2.com`.
4. Configura CORS para permitir subidas directas desde el navegador y exponer `ETag` (necesario para multipart):

```json
[
  {
    "corsRuleName": "arca-web",
    "allowedOrigins": ["http://localhost:3000", "https://mi-arca.vercel.app"],
    "allowedOperations": ["s3_get", "s3_put", "s3_head", "s3_post"],
    "allowedHeaders": ["*"],
    "exposeHeaders": ["ETag", "x-amz-request-id"],
    "maxAgeSeconds": 3600
  }
]
```

5. Añade una regla de ciclo de vida para abortar multipart incompletos después de 1 día.

El bucket nunca es público: la web firma `GET` por 1 hora y las subidas usan URLs prefirmadas de 15 minutos (multipart en partes de 16 MB, concurrencia 3).

## Neon

- Proyecto en la región más cercana posible a Vercel.
- `DATABASE_URL` con el host **pooled** (`-pooler`) para la web.
- `DATABASE_URL_DIRECT` con el host directo para migraciones y worker.
- El cliente usa `prepare: false` porque el pooler de Neon no soporta prepared statements en modo transacción.

## Deploy en Vercel

1. Importa el repositorio (monorepo pnpm; Vercel detecta el workspace).
2. Root directory: `apps/web`. Build command: `pnpm build`. Install: `pnpm install`.
3. Añade todas las variables de entorno de producción.
4. Ejecuta las migraciones con el workflow **migrate** o en local apuntando a Neon:

```bash
DATABASE_URL_DIRECT="postgres://..." pnpm db:migrate
```

5. Ejecuta el seed una vez con las credenciales del owner.
6. Configura el dominio `mi-arca.vercel.app` en `APP_URL` y `BETTER_AUTH_URL`.

## GitHub Actions

| Workflow | Cuándo | Qué hace |
| --- | --- | --- |
| `web.yml` | push/PR | typecheck + build de Next |
| `go.yml` | push/PR | vet, test y build de Go |
| `migrate.yml` | manual | aplica migraciones Drizzle |
| `transcode.yml` | `repository_dispatch`, manual, cada 30 min | ejecuta el worker `-once` |

Secretos necesarios: `DATABASE_URL_DIRECT`, `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_KEY`, `S3_SECRET`.

Para el disparo inmediato, crea un fine-grained PAT con permiso de **Contents: read/write** sobre el repo y guárdalo como `GITHUB_DISPATCH_TOKEN`. Si falla el dispatch, el cron de barrido recoge el job igualmente.

> Nota: usar Actions como cómputo de media está en una zona gris de sus términos. El worker es portable a un PC propio u Oracle Cloud; la cola en Postgres y el contrato S3 no cambian. El cron de 30 min es solo un barrido de seguridad.

## Arquitectura

- **Auth**: una sola cuenta. `emailAndPassword.disableSignUp = true` en la app; el seed crea la cuenta con una instancia que permite signup. Sesión de 30 días con cookie cache de 5 min.
- **Baúles**: `vault` con slug único, descripción y borrado en cascada.
- **Assets**: dedupe por `sha256` y baúl (índice único parcial), papelera con `deleted_at`, estados `uploading → processing → ready | error`.
- **Subida**: el navegador pide un intent, sube el original directo a B2 (simple o multipart) y confirma; la API verifica con `HeadObject` y encola el job. La CLI (`arca put`) hace lo mismo contra Postgres y S3 sin pasar por la web, con dedupe y cuota.
- **Derivados**: tabla `derivative` con thumb, preview, poster, storyboard, HLS, páginas de PDF, waveform y texto. El worker descarga el original a `/tmp`, ejecuta ffmpeg y sube los resultados.
- **Video**: HLS 720p en fMP4 y un storyboard 10×10 (sprite WebP + VTT). El VTT se sirve desde `/api/assets/:id/storyboard` reescribiendo el sprite a una URL firmada; el reproductor pinta la miniatura al pasar el cursor por la barra.
- **Comentarios**: `author_id` (owner) o `guest_id` (invitados), con `at_second` para notas de video/audio.
- **Compartir**: `share_link` guarda solo el hash del token, con rol `viewer | commenter`, caducidad opcional y revocación. La cookie del invitado va firmada con HMAC; el enlace se valida en cada lectura y en cada petición HLS/storyboard (`?share=`).

Decisiones detalladas en [`docs/adr`](docs/adr).

## Seguridad

- Sin registro público ni endpoints de signup abiertos.
- Bucket privado; URLs firmadas de vida corta.
- Rate limit de Better Auth activado.
- Tokens de share/API se guardan hasheados.
- Descargas y metadatos siempre verifican `owner_id`.
- `robots: noindex, nofollow`.

## Roadmap

- [x] Scaffold, auth, esquema, shell visual
- [x] Baúles, subida directa, comentarios, explorador
- [x] Worker Go: miniaturas, posters, HLS 720p, PDF, texto, waveform
- [x] Player HLS con reescritura de playlist firmada
- [x] Papelera y restauración desde la UI
- [x] Enlaces para compartir + comentarios de invitados
- [x] Quick look, `⌘K`, drag & drop desde portapapeles
- [x] CLI de backup (`arca put`, `arca pull`)
- [x] Storyboard VTT y scrubbing en video

## Scripts

```bash
pnpm dev            # Next en desarrollo
pnpm build          # build de producción
pnpm typecheck      # TS en todo el monorepo
pnpm lint           # ESLint
pnpm db:generate    # genera migración Drizzle
pnpm db:migrate     # aplica migraciones
pnpm db:seed        # crea owner + baúl inicial
pnpm go:test        # tests de Go
pnpm go:vet         # vet de Go
```
