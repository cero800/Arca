# ADR 0001 — Stack de coste cero para un archivo privado

- **Estado**: aceptada
- **Fecha**: 2026-11

## Contexto

Arca es una app privada de un solo dueño para conservar imágenes, videos, PDFs, audio y texto. Las restricciones son fuertes:

- Presupuesto **$0** y sin tarjeta de crédito.
- Menos de **10 GB** iniciales, con archivos de hasta **1 GB**.
- Todo privado: nada de buckets públicos.
- El repositorio será público (portafolio).
- Quiero aprender Go, así que el worker y la CLI no se escriben en TypeScript.

## Decisión

- **Next.js 15 + React 19 + Tailwind v4** en Vercel Hobby.
- **Better Auth** con email/password y `disableSignUp` cerrado tras el seed.
- **Neon Free** (Postgres) con Drizzle ORM.
- **Backblaze B2** (10 GB gratis) como almacenamiento S3-compatible.
- **Go** para worker y CLI.
- **GitHub Actions** como cómputo inicial del worker, con diseño portable.
- **Postgres** como cola, sin Redis.

## Alternativas descartadas

| Opción | Motivo |
| --- | --- |
| Cloudflare R2 | Exige tarjeta para activar el free tier |
| Oracle Cloud Always Free | Exige tarjeta y capacidad variable |
| Storj | Ya no tiene free tier real |
| Supabase Storage | 1 GB gratis, insuficiente |
| Redis/Upstash | Otra dependencia; Postgres cubre la cola |

## Consecuencias

- La app depende de tres proveedores gratuitos; el código evita APIs propietarias (S3, SQL estándar).
- Vercel Hobby impone límites de ejecución: el procesamiento pesado nunca corre en una función serverless.
- El repositorio público hace que Actions sea gratis, pero el uso de Actions como cómputo de media es una zona gris de sus términos. Mitigación: worker portable y cron de baja frecuencia.
- Si Arca crece por encima de 10 GB, se puede mover el bucket a otro proveedor S3-compatible sin tocar la app.
