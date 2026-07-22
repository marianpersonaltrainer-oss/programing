# Puente Programming EVO · V0

## Integración elegida

El puente vive en `/?v2`, la única superficie que ya dispone de Supabase Auth, perfiles, organización y roles reales. No modifica `/` ni `/?coach`.

- `coach`: Mi turno y Recursos EVO.
- `programmer`: programación V2, Recursos EVO y Control de turnos.
- `programmer` representa a Dirección en esta V0. No se crea un segundo sistema de roles.

## Datos y seguridad

La migración `20260722210000_shift_protocol_logs.sql` crea una tabla aditiva e inmutable:

- permite varias aperturas y cierres por persona y día;
- impone `user_id`, `org_id`, `id` y `created_at` desde la base de datos;
- solo concede al cliente permiso de inserción sobre los cinco campos funcionales;
- valida incidencias y confirmaciones también con restricciones SQL;
- permite al entrenador leer solo sus registros;
- permite a `programmer` consultar los registros de su organización;
- no concede `UPDATE` ni `DELETE` a usuarios autenticados.
- limita la actualización del perfil propio a `full_name`, porque la política anterior permitía cambiar también `role` y `org_id`; esos campos quedan reservados a administración segura.

La aplicación calcula los límites diarios en `Europe/Madrid` y consulta por el intervalo UTC correspondiente. Esto contempla los cambios de horario de verano e invierno.

## Aplicación segura de la migración

No aplicar en producción durante el desarrollo del puente.

Opciones válidas:

1. Supabase local: iniciar el entorno local y aplicar las migraciones desde cero.
2. Staging: verificar primero que la referencia del proyecto no es la de producción y aplicar, en orden, `20260622120000_pe2_weeks.sql`, `20260629150000_pe2_structured_auth.sql` y `20260722210000_shift_protocol_logs.sql`.

La preview debe usar únicamente las claves anónimas del entorno local o de staging. Si no existe uno de esos entornos, el código y las pruebas pueden validarse, pero no debe publicarse una preview conectada a producción.

La migración puede comprobarse sin red ni credenciales con:

```bash
npm run test:migration:shift-protocols
```

La prueba usa PostgreSQL embebido en memoria y cubre múltiples registros diarios, restricciones, identidad/hora impuestas, inmutabilidad, separación de permisos y bloqueo de escalada de rol.

## Prueba manual pendiente

Andrea, Javi y Sergio deben abrir los siete recursos desde sus propias cuentas y desde móvil. Las pruebas automáticas solo validan los destinos y su integración.
