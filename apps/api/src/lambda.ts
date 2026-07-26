import serverlessExpress from '@codegenie/serverless-express';
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
  Callback,
  Context,
} from 'aws-lambda';
import { createApplication } from './create-application';

type ExpressApplication = Parameters<typeof serverlessExpress>[0]['app'];
type ServerlessHandler = (
  event: APIGatewayProxyEventV2,
  context: Context,
  callback: Callback<APIGatewayProxyResultV2>,
) => Promise<APIGatewayProxyResultV2>;

let cachedHandler: ServerlessHandler | undefined;
const ignoredCallback: Callback<APIGatewayProxyResultV2> = () => undefined;

async function createHandler(): Promise<ServerlessHandler> {
  const nestApplication = await createApplication();
  const expressApplication = nestApplication
    .getHttpAdapter()
    .getInstance() as ExpressApplication;

  return serverlessExpress({
    app: expressApplication,
  }) as unknown as ServerlessHandler;
}

export async function handler(
  event: APIGatewayProxyEventV2,
  context: Context,
): Promise<APIGatewayProxyResultV2> {
  cachedHandler ??= await createHandler();

  return cachedHandler(event, context, ignoredCallback);
}
