import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  const origins = (process.env.CORS_ORIGINS || 'http://localhost:3200,http://localhost:3210').split(',').map(s => s.trim())
  app.setGlobalPrefix('api')
  app.enableCors({ origin: origins, credentials: true, methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'] })
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: false }))
  const doc = new DocumentBuilder().setTitle('LineSight API').setDescription('Pipeline diagnostics, marketplace, rentals and homeowner workflows').setVersion('1.0').addBearerAuth().build()
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, doc))
  await app.listen(Number(process.env.PORT) || 4110, '0.0.0.0')
  console.log(`LineSight API listening on http://localhost:${process.env.PORT || 4110}/api`)
}
void bootstrap()
