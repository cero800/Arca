# Despliegue de Arca

Checklist para poner Arca en producción con **Aiven Free + Backblaze B2 + Vercel Hobby + GitHub Actions**. Todo sin tarjeta.

## 1. Base de datos (Aiven Free)

- Aiven Free no permite elegir región ni tiene pooler: usa la **misma** cadena en `DATABASE_URL` y `DATABASE_URL_DIRECT`.
- Conserva `?sslmode=require`. Codifica caracteres especiales del password en la URI.
- `max_connections = 20`; el pool de la web en producción es 2 y las conexiones inactivas se cierran a los 5 s. Si se agotan los slots, reinicia el servicio desde la consola o con `avn service restart <nombre>`.
- Si el servicio está apagado por inactividad: Console → servicio → **Power on**.

Obtener la URI:

```bash
avn service get <nombre-del-servicio> --json | jq -r '.service_uri'
psql "<uri>" -c 'select version();'
```

## 2. Storage (Backblaze B2)

- Región elegida al crear la **cuenta** (no se puede cambiar después). Para EEUU: **US East** → Endpoint `https://s3.us-east-005.backblazeb2.com`.
- Bucket **privado** `arca-media`.
- Application key limitada a ese bucket, **Read and Write**: su `keyID` es `S3_KEY` y su `applicationKey` es `S3_SECRET`.
- `S3_REGION` es solo el código (`us-east-005`), no el host completo.
- CORS se configura con la CLI y la **master application key** (la key limitada no tiene `writeBuckets`):

```bash
python3 -m venv ~/.venvs/b2cli
~/.venvs/b2cli/bin/pip install --upgrade b2
~/.venvs/b2cli/bin/b2 account authorize

cat > rules.json <<'EOF'
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
EOF

~/.venvs/b2cli/bin/b2 bucket update --cors-rules "$(<./rules.json)" arca-media allPrivate
~/.venvs/b2cli/bin/b2 bucket get arca-media
```

- En Arch, `pip install` global falla por PEP 668: usa el venv, `pipx install b2` o el binario self-contained de B2.
- lifecycle: abortar multipart incompletos después de 1 día.
- La master key es **solo** para la CLI; nunca va en `.env`, GitHub ni Vercel.

## 3. Local: `.env` de la raíz

Lo leen `pnpm db:migrate`, `pnpm db:seed`, el worker y la CLI de Go. `apps/web/.env.local` lo lee `next dev`.

```bash
DATABASE_URL="<uri-aiven>"
DATABASE_URL_DIRECT="<uri-aiven>"
S3_ENDPOINT="https://s3.us-east-005.backblazeb2.com"
S3_REGION="us-east-005"
S3_BUCKET="arca-media"
S3_KEY="<keyID>"
S3_SECRET="<applicationKey>"
S3_FORCE_PATH_STYLE="true"
GITHUB_REPO="cero800/Arca"
OWNER_EMAIL="..."
OWNER_NAME="..."
OWNER_PASSWORD="..."          # >= 10 caracteres, cámbiala antes del seed
BETTER_AUTH_SECRET="..."      # openssl rand -base64 32
```

Verificación antes de seguir:

```bash
go run ./cmd/arca health       # database: ok / storage: ok
pnpm db:migrate
pnpm db:seed                   # idempotente; no cambia la contraseña si el owner ya existe
```

## 4. GitHub Secrets

`https://github.com/cero800/Arca` → Settings → Secrets and variables → Actions → **New repository secret**:

| Secret | Valor |
| --- | --- |
| `DATABASE_URL_DIRECT` | URI de Aiven |
| `S3_ENDPOINT` | `https://s3.us-east-005.backblazeb2.com` |
| `S3_REGION` | `us-east-005` |
| `S3_BUCKET` | `arca-media` |
| `S3_KEY` | `keyID` de la app key |
| `S3_SECRET` | `applicationKey` de la app key |

PAT para disparar el worker desde la web:

- GitHub → avatar → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate new token.
- Repository access: solo `cero800/Arca`.
- Repository permissions → **Contents: Read and write**.
- El token va en Vercel como `GITHUB_DISPATCH_TOKEN`, **no** en los secrets de Actions.

## 5. Vercel Hobby

- Importar `https://github.com/cero800/Arca`.
- **Root Directory**: `apps/web`. Install: `pnpm install`. Build: `pnpm build`.
- Environment Variables (Production):

| Variable | Valor |
| --- | --- |
| `APP_URL` | `https://mi-arca.vercel.app` |
| `BETTER_AUTH_URL` | `https://mi-arca.vercel.app` |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` |
| `DATABASE_URL` | URI de Aiven |
| `DATABASE_URL_DIRECT` | URI de Aiven (la misma) |
| `S3_ENDPOINT` | `https://s3.us-east-005.backblazeb2.com` |
| `S3_REGION` | `us-east-005` |
| `S3_BUCKET` | `arca-media` |
| `S3_KEY` | `keyID` de la app key |
| `S3_SECRET` | `applicationKey` de la app key |
| `S3_FORCE_PATH_STYLE` | `true` |
| `GITHUB_REPO` | `cero800/Arca` |
| `GITHUB_DISPATCH_TOKEN` | PAT fine-grained |
| `MAX_FILE_BYTES` | `1073741824` |
| `STORAGE_QUOTA_BYTES` | `10737418240` |

`OWNER_*` **no** van en Vercel: solo los usa el seed local.

- Dominio `mi-arca.vercel.app` en el proyecto.
- Región de functions: dejar `iad1` (default), coherente con B2 US East.

## 6. Orden y verificación final

1. Aiven arriba → migraciones → seed del owner.
2. B2 bucket + key + CORS + lifecycle.
3. GitHub Secrets + PAT.
4. Vercel con todas las variables y dominio.
5. Entrar en `https://mi-arca.vercel.app` con el owner → subir un archivo real.
6. Comprobar en `https://github.com/cero800/Arca/actions` que `transcode.yml` procesa el job.
7. Verificar HLS, storyboard y enlace de compartir desde otro navegador.

Comandos útiles:

```bash
curl -s https://mi-arca.vercel.app/api/health
go run ./cmd/arca stats
go run ./cmd/arca jobs list
psql "$DATABASE_URL_DIRECT" -c 'select original_name, status, kind from asset order by created_at desc limit 5;'
```
