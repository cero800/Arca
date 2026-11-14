# ADR 0002 — Bucket privado con URLs firmadas y subida directa

- **Estado**: aceptada
- **Fecha**: 2026-11

## Contexto

Los archivos pueden pesar hasta 1 GB. Hacer que pasen por una función de Vercel es caro en tiempo, memoria y ancho de banda, y además incumple los límites de body de la plataforma. A la vez, el bucket no puede ser público.

## Decisión

1. El bucket es **privado**. Nunca se expone una URL permanente.
2. La API crea un `asset` en estado `uploading` y devuelve una URL prefirmada:
   - `PUT` simple para archivos ≤ 5 MB.
   - Multipart de 16 MB por parte para archivos mayores, con URLs prefirmadas por parte.
3. El navegador sube **directo a B2** con concurrencia 3.
4. Al terminar, llama a `/api/uploads/complete`; el servidor valida con `HeadObject`, actualiza el tamaño real y encola el job.
5. La lectura usa `GET` prefirmado de 1 hora. El worker también firma o descarga con credenciales propias.
6. El SDK de AWS se configura con `requestChecksumCalculation: "WHEN_REQUIRED"` porque B2 no soporta todos los checksums nuevos.

## Consecuencias

- Vercel solo gestiona JSON pequeño, no bytes de media.
- El CORS del bucket debe permitir `GET/PUT/POST/HEAD` y **exponer `ETag`**, o el multipart no puede completarse.
- Las URLs firmadas son bearer tokens temporales: no se registran en logs y caducan rápido.
- Un asset huérfano (`uploading` sin completar) se puede barrer con una tarea de limpieza y una regla de ciclo de vida para multipart incompletos.
- La descarga de originales desde el worker cuesta tráfico de salida de B2; el free tier incluye 1 GB/día, suficiente para el uso previsto.
