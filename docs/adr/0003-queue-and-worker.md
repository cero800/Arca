# ADR 0003 — Cola en Postgres y worker portable

- **Estado**: aceptada
- **Fecha**: 2026-11

## Contexto

Las subidas deben procesarse fuera de la request web: miniaturas, HLS, PDFs y waveforms pueden tardar minutos. No queremos añadir Redis ni un servicio de colas propietario. El worker debe poder ejecutarse primero en GitHub Actions y luego en un PC propio u Oracle Cloud sin reescribir la lógica.

## Decisión

- La cola vive en la tabla `processing_job`:
  - estados `pending | processing | done | error`;
  - `run_at` para backoff, `attempts`, `lease_until` para leases;
  - toma atómica con `SELECT … FOR UPDATE SKIP LOCKED`.
- El worker es un binario Go independiente:
  - `cmd/worker` procesa la cola;
  - `cmd/arca` es la CLI operativa;
  - `internal/processor` no conoce GitHub Actions ni Vercel.
- El contrato con la web es mínimo: **Postgres + S3**. Nada de APIs internas.
- El disparo inmediato usa `repository_dispatch` a un workflow de GitHub Actions. Si falla, un cron cada 30 minutos barre la cola.
- Un lease vencido vuelve a `pending` al arrancar (`RecoverStale`), así que un runner cancelado no bloquea el sistema.

## Consecuencias

- Un solo proveedor menos (sin Redis).
- La web y el worker pueden desplegarse por separado.
- GitHub Actions impone un máximo de 30–60 min por job; los archivos grandes deben caber en ese presupuesto (1 GB con HLS 720p suele quedar por debajo).
- El reparto de trabajo permite mover el worker a un servidor propio cambiando solo variables de entorno.
- Los reintentos usan backoff cuadrático (30 s × intento²) y máximo de 3 intentos por defecto.
