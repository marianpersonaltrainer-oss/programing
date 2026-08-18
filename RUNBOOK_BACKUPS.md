# Runbook de backups recuperables · Programming EVO

## Estado y alcance

- **Origen:** Supabase producción, validado por el project ref esperado antes de ejecutar `pg_dump`.
- **Frecuencia:** diaria a las **01:00 UTC** y ejecución manual desde GitHub Actions.
- **Formato:** dump PostgreSQL custom, cifrado con GPG/AES-256 antes de publicarse.
- **Destino:** GitHub Releases de este repositorio.
- **Restore de control:** PostgreSQL 17 efímero y aislado, destruido siempre al terminar.
- **Retención:** no hay borrado automático. No eliminar releases hasta que Dirección apruebe una política.

Un archivo cifrado no se considera backup recuperable hasta que el mismo workflow lo descifra, restaura y valida. Si cualquier comprobación falla, el job termina en error y no publica una release.

## Configuración obligatoria

El environment de GitHub `programing-evo-production` necesita estos secretos:

| Secreto | Uso |
|---|---|
| `SUPABASE_POOLER_URL` o `SUPABASE_DB_URL` | URI PostgreSQL completa de producción. Para dump se recomienda session pooler o conexión directa; no transaction pooler. |
| `SUPABASE_DB_PASSWORD` | Solo si la URI contiene el marcador `YOUR-PASSWORD`. |
| `SUPABASE_PRODUCTION_PROJECT_REF` | Project ref exacto esperado. El job aborta si la URI pertenece a otro proyecto. |
| `BACKUP_ENCRYPTION_KEY` | Frase aleatoria de al menos 32 caracteres, custodiada separadamente del repositorio y de las releases. |

No guardar estos valores en archivos, comentarios, tickets o documentación. GitHub enmascara los secretos y los scripts no imprimen URIs, contraseñas, claves ni contenido del dump.

## Qué valida el workflow

1. La URI tiene protocolo PostgreSQL, apunta al project ref de producción y usa la base `postgres`.
2. La clave de cifrado existe antes de iniciar cualquier lectura.
3. `pg_dump` se ejecuta con cliente PostgreSQL 17, formato custom, sin owner ni privilegios.
4. El dump se cifra; el archivo plano se elimina; se genera SHA-256 del cifrado.
5. Se verifica el checksum y se descifra una copia de control.
6. `pg_restore --exit-on-error` restaura en PostgreSQL 17 efímero sin puertos publicados.
7. Existen las tablas y funciones críticas configuradas, no hay claves foráneas sin validar y puede leerse al menos una semana publicada.
8. El contenedor y todos los archivos planos se eliminan tanto en PASS como en FAIL.

## Ejecutar un backup real

1. Abrir **Actions → Backup Supabase → Run workflow**.
2. Ejecutar sobre `main`.
3. Confirmar que los dos jobs terminan en verde:
   - `Validate backup and restore path`;
   - `Encrypted production backup and isolated restore`.
4. Abrir la release `backup-YYYY-MM-DDTHHMMSSZ-RUN_ID`.
5. Confirmar que solo contiene:
   - `*.dump.gpg`;
   - `*.dump.gpg.sha256`.
6. Revisar que la descripción indica `Restore verification: PASS` y el commit/run correctos.

## Restauración de emergencia

Realizarla primero en una máquina o runner controlado; nunca probar directamente sobre producción.

```bash
sha256sum -c backup-AAAA-MM-DDTHHMMSSZ-RUN_ID.dump.gpg.sha256
gpg --batch --pinentry-mode loopback --output restore.dump \
  --decrypt backup-AAAA-MM-DDTHHMMSSZ-RUN_ID.dump.gpg
pg_restore --exit-on-error --no-owner --no-privileges \
  --dbname="postgresql://USUARIO:PASSWORD@DESTINO:5432/postgres" restore.dump
```

Después, repetir las validaciones del workflow y hacer un smoke test funcional: semana activa visible, publicación/lectura operativa y tablas de Coach presentes. El dump no incluye archivos físicos de Supabase Storage ni configuración externa de Auth, Vercel, proveedores OAuth, Edge Functions o DNS; esos recursos requieren su propio procedimiento.

## Fallos y respuesta

| Fallo | Resultado | Acción |
|---|---|---|
| URI ausente, inválida o de otro proyecto | FAIL antes de `pg_dump` | Corregir el secreto; no reintentar a ciegas. |
| Clave de cifrado ausente o corta | FAIL antes de `pg_dump` | Crear/corregir `BACKUP_ENCRYPTION_KEY`. |
| Dump o cifrado falla | FAIL, sin release | Revisar versión/conectividad y volver a ejecutar. |
| Restore o validación falla | FAIL, sin release | Conservar logs sin PII, corregir compatibilidad y repetir. No declarar recuperabilidad. |
| Secreto aparece en logs | Incidente de seguridad | Cancelar workflow, deshabilitarlo y rotar inmediatamente el secreto afectado. |

## Rollback

1. Deshabilitar `Backup Supabase` desde GitHub Actions.
2. Revertir únicamente el commit del workflow, `scripts/backup/` y este runbook.
3. Rotar cualquier secreto potencialmente expuesto.
4. No borrar releases existentes: el borrado es una acción destructiva separada que necesita autorización.

## Criterio de cierre F0-T01

F0-T01 solo puede marcarse `PASS` cuando exista una ejecución real de producción con artefacto cifrado, checksum, restore aislado completo, validaciones críticas correctas y cero secretos/PII en logs.
