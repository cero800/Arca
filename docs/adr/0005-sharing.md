# ADR 0005 — Enlaces para compartir y comentarios de invitados

- **Estado**: aceptada
- **Fecha**: 2026-11

## Contexto

Arca es privada y de un solo dueño, pero a veces hace falta enseñar un baúl o
recibir notas de otra persona sin crearle una cuenta. El enlace debe poder
revocarse, no debe filtrar el resto de la aplicación y no debe permitir subir ni
borrar archivos.

## Decisión

- **Enlace a nivel de baúl**, no por archivo. `share_link` referencia `vault_id`,
  tiene rol `viewer | commenter`, caducidad opcional y `revoked_at`.
- **Token de 256 bits** en base64url, mostrado una sola vez al crearlo. En la
  base solo se guarda `sha256(token)`, así que una copia de la base no permite
  reconstruir la URL.
- `/s/<token>` es público para el middleware, pero `getSharedWorkspace` valida
  el hash, la revocación, la caducidad y que el enlace no sea de un archivo.
  Si algo falla se muestra “Enlace no válido”, sin distinguir el motivo.
- **Invitado sin cuenta**: al comentar se pide un nombre y se guarda una fila
  `guest` ligada al enlace. La cookie `arca_guest` contiene `guestId` firmado con
  HMAC-SHA256 usando `BETTER_AUTH_SECRET`; si la firma no cuadra, se ignora.
- **HLS compartido**: `/api/assets/<id>/hls/...` acepta `?share=<token>` cuando
  no hay sesión. El token debe pertenecer al mismo `vault_id` que el asset; los
  segmentos siguen siendo URLs firmadas de corta vida.
- El rol `viewer` solo lee. El rol `commenter` además puede insertar notas; la
  validación del rol ocurre en el servidor, no solo en la UI.

## Por qué no otras opciones

| Opción | Motivo |
| --- | --- |
| Cuentas de invitado | Fricción y superficie de auth para un archivo personal |
| Enlace con token en claro en la base | Una filtración de la base expone todos los enlaces |
| Enlace por archivo | No encaja con el flujo de “enseñar el baúl” y complica la navegación |
| Servicio externo de sharing | Dependencia y coste; además el bucket ya resuelve el acceso |

## Consecuencias

- El dueño no puede recuperar un enlace olvidado: debe crear otro.
- Revocar un enlace invalida también el HLS y las notas nuevas de ese enlace.
- Los comentarios de invitados no se pueden editar ni borrar desde la vista
  pública; el dueño conserva el control desde su sesión.
- La cookie de invitado dura un año y no identifica a la persona entre baúles
  distintos: cada enlace crea su propio `guest`.
