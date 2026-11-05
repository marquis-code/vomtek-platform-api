import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { SeedService } from './seed.service'

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['log', 'error', 'warn'] })
  await app.get(SeedService).run(true)
  await app.close()
}
void main()
