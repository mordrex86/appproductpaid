# Product payment application

Aplicación full stack para comprar un producto, registrar la entrega, procesar
un pago con tarjeta en Sandbox y actualizar el inventario.

## Enlaces de entrega

- Aplicación: <https://d26xn7avlebvew.cloudfront.net>
- Swagger UI: <https://d26xn7avlebvew.cloudfront.net/docs>
- Health check: <https://d26xn7avlebvew.cloudfront.net/api/v1/health>

## Flujo

1. Se muestra el producto, su precio y las unidades disponibles.
2. El cliente ingresa los datos de la tarjeta y de entrega.
3. Se presenta el resumen con producto, tarifa de servicio, envío y total.
4. Se crea una transacción pendiente y se procesa el pago en Sandbox.
5. Se muestra el resultado y se regresa al producto con el inventario
   actualizado.

El avance se conserva durante una recarga del navegador. Los datos completos de
la tarjeta, el CVC y el token de pago no se almacenan.

## Tecnologías

| Área            | Tecnología                                 |
| --------------- | ------------------------------------------ |
| Frontend        | React 19, TypeScript, Vite y Redux Toolkit |
| Backend         | NestJS 11 y TypeScript                     |
| Base de datos   | Amazon DynamoDB                            |
| Pagos           | Wompi Sandbox                              |
| Infraestructura | AWS SAM y CloudFormation                   |
| Despliegue      | S3, CloudFront, API Gateway y Lambda       |
| Pruebas         | Jest, Testing Library y Supertest          |

## Arquitectura

La API utiliza arquitectura hexagonal dentro de un monolito modular. El dominio
y los casos de uso no dependen de NestJS, HTTP, DynamoDB ni del proveedor de
pagos.

```text
Frontend React
      |
      v
Controladores HTTP
      |
      v
Casos de uso <---- Puertos
      |              ^
      v              |
   Dominio      Adaptadores
                |         |
             DynamoDB   Pagos Sandbox
```

El frontend usa Redux Toolkit para coordinar las cinco pantallas y
`sessionStorage` para recuperar el progreso no sensible.

### Modelo de datos

DynamoDB utiliza una tabla por entorno con claves de partición `PK` y
ordenamiento `SK`:

| Entidad      | `PK`                  | `SK`          |
| ------------ | --------------------- | ------------- |
| Producto     | `PRODUCT#<id>`        | `METADATA`    |
| Cliente      | `CUSTOMER#<id>`       | `PROFILE`     |
| Transacción  | `TRANSACTION#<id>`    | `TRANSACTION` |
| Entrega      | `TRANSACTION#<id>`    | `DELIVERY`    |
| Idempotencia | `IDEMPOTENCY#<clave>` | `REQUEST`     |

La creación del cliente, la entrega, la transacción y el registro de
idempotencia se realiza de forma atómica. El inventario se reserva antes del
pago: una aprobación confirma el descuento y un rechazo libera las unidades.

Los valores de negocio son montos cerrados en pesos colombianos:

- producto: 129.900 COP por unidad;
- tarifa de servicio: 2.000 COP;
- envío: 8.000 COP;
- total para una unidad: 139.900 COP.

## API

El contrato completo, los cuerpos de solicitud y las respuestas se pueden
probar desde [Swagger](https://d26xn7avlebvew.cloudfront.net/docs).

| Método | Ruta                                                 | Descripción                              |
| ------ | ---------------------------------------------------- | ---------------------------------------- |
| `GET`  | `/api/v1/products/:productId`                        | Consulta producto y stock                |
| `POST` | `/api/v1/transactions`                               | Crea una transacción pendiente           |
| `GET`  | `/api/v1/transactions/:transactionId`                | Consulta una transacción                 |
| `GET`  | `/api/v1/payments/config`                            | Obtiene la configuración pública de pago |
| `POST` | `/api/v1/transactions/:transactionId/payment`        | Inicia el pago                           |
| `POST` | `/api/v1/transactions/:transactionId/payment/status` | Sincroniza el resultado                  |

La creación de transacciones requiere el encabezado `Idempotency-Key`. El
backend obtiene el precio persistido y calcula todos los valores; el navegador
no puede establecer montos ni estados.

## Ejecución local

Requisitos:

- Node.js 24;
- npm 11.

```bash
npm ci
npm run dev:api
```

En otra terminal:

```bash
npm run dev:web
```

Direcciones locales:

- Frontend: <http://localhost:5173>
- API: <http://localhost:3000>
- Swagger: <http://localhost:3000/docs>

Las variables locales se crean a partir de `.env.example`. La integración de
pago debe configurarse únicamente con credenciales Sandbox.

## Pruebas

```bash
npm run verify
npm run test:e2e
```

Resultados de la última ejecución completa:

| Proyecto | Pruebas | Statements | Branches | Functions |   Lines |
| -------- | ------: | ---------: | -------: | --------: | ------: |
| API      |      59 |    97,46 % |  91,05 % |   98,85 % | 97,46 % |
| Web      |      24 |    94,94 % |  89,65 % |   90,27 % | 94,94 % |

La cobertura de frontend y backend supera el 80 % solicitado. También existen
pruebas E2E de la API.

## Despliegue

La aplicación está publicada en AWS y conectada con la API y DynamoDB:

<https://d26xn7avlebvew.cloudfront.net>

El despliegue automático valida formato, tipos, pruebas, cobertura y compilación
antes de actualizar el entorno.
