import { createApp } from './create-app';

async function bootstrap() {
  const app = await createApp();
  await app.listen(Number(process.env.PORT ?? 3000), '127.0.0.1');
  console.log(`Reservation exam API: ${await app.getUrl()}`);
}

void bootstrap().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
