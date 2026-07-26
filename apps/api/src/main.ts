import { ConfigService } from '@nestjs/config';
import { createApplication } from './create-application';

async function bootstrap() {
  const app = await createApplication();
  const config = app.get(ConfigService);
  const port = config.getOrThrow<number>('PORT');

  await app.listen(port);
}
void bootstrap();
