# Product payment application

Aplicación full stack para implementar un flujo de compra, pago con tarjeta,
entrega y actualización de inventario.

## Estado

El repositorio contiene la base técnica del proyecto:

- SPA con React, TypeScript, Vite y Redux Toolkit.
- API con NestJS y TypeScript.
- Monorepo administrado con npm workspaces.
- Pruebas unitarias con Jest y umbral mínimo de cobertura.
- Pipeline de integración continua.

Los módulos de producto, clientes, transacciones, entregas y la integración de
pago se implementarán en incrementos posteriores.

## Requisitos

- Node.js 24.14.0
- npm 11

## Instalación

```bash
npm ci
```

Para la primera instalación, antes de que exista `package-lock.json`, usar
`npm install`.

## Ejecución local

API:

```bash
npm run dev:api
```

Frontend:

```bash
npm run dev:web
```

Direcciones locales:

- Frontend: <http://localhost:5173>
- Health check: <http://localhost:3000/api/v1/health>

## Comandos

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:coverage
npm run test:e2e
npm run build
npm run verify
```

## Arquitectura

El backend sigue puertos y adaptadores dentro de un monolito modular:

```text
presentation -> application -> domain
infrastructure -> application ports
Nest modules -> composition root
```

El dominio no depende de NestJS, HTTP, persistencia ni servicios externos. Cada
capacidad de negocio se agregará bajo `apps/api/src/modules` con sus propias
capas.

El frontend se organiza por funcionalidades. Los componentes presentan estado,
Redux coordina el flujo serializable y los servicios externos se encapsulan en
adaptadores.

La decisión completa está en
[`docs/adr/0001-stack-and-architecture.md`](docs/adr/0001-stack-and-architecture.md).

## Variables de entorno

Copiar `.env.example` como `.env` y ajustar únicamente valores locales. El
archivo `.env` no se versiona.

La base actual no requiere secretos. Las credenciales de proveedores externos
se agregarán posteriormente mediante variables seguras.

## API, base de datos y despliegue

- La documentación OpenAPI se añadirá junto con los primeros contratos de
  negocio.
- El modelo de base de datos se documentará cuando se seleccione PostgreSQL o
  DynamoDB.
- Las URLs públicas se agregarán después de configurar el despliegue cloud.

No se deben publicar credenciales, datos completos de tarjeta ni archivos de
configuración local.
