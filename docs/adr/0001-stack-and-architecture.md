# ADR 0001: Stack y arquitectura inicial

- Estado: aceptado
- Fecha: 2026-07-24

## Contexto

La aplicación debe implementar una SPA con estado global, una API en TypeScript,
pruebas Jest y un flujo de pago que proteja información sensible. El alcance
requiere claridad y trazabilidad sin asumir la complejidad operativa de
microservicios.

## Decisión

Se adopta un monorepo con npm workspaces:

- React 19, Vite 8 y Redux Toolkit 2 para el frontend.
- NestJS 11 para la API.
- TypeScript estricto en ambas aplicaciones.
- Jest 30 para pruebas.
- Arquitectura hexagonal dentro de un monolito modular.

El backend se organiza por capacidad de negocio. El dominio permanece libre de
NestJS, transporte, persistencia y SDK externos. La aplicación declara puertos,
infraestructura los implementa y los módulos NestJS funcionan como composition
roots.

El frontend se organiza por funcionalidades y conserva en Redux únicamente
estado serializable y no sensible.

## Consecuencias

- Los casos de uso pueden probarse sin red ni framework.
- La API puede cambiar de persistencia o cliente externo mediante adaptadores.
- Se requieren mappers explícitos entre DTO, dominio y persistencia.
- Los límites de imports deben verificarse en lint y CI.
- Se acepta algo de código adicional para mantener claras las dependencias.

## Decisiones pendientes

- PostgreSQL o DynamoDB.
- ORM o cliente de persistencia.
- Proveedor y topología de despliegue.
- Estrategia final de callbacks y reconciliación del proveedor de pagos.

Estas decisiones requieren un ADR adicional antes de incorporar dependencias o
infraestructura.
