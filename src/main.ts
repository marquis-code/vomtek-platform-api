import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { NestExpressApplication } from '@nestjs/platform-express'
import { join } from 'path'
import { mkdirSync } from 'fs'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule)
  const uploads = process.env.UPLOAD_DIR || join(process.cwd(), 'uploads'); mkdirSync(uploads, { recursive: true })
  app.useStaticAssets(uploads, { prefix: '/uploads/' })
  app.setGlobalPrefix('api')
  // Demo/open CORS: reflect any requesting origin so browser clients on
  // localhost, 127.0.0.1, LAN IPs and preview hosts can all reach the API.
  // `origin: true` reflects the caller's origin (required when credentials
  // are enabled). Preflight requests are answered for every route.
  app.enableCors({
    origin: true,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With', 'X-Request-Id'],
    exposedHeaders: ['Content-Disposition', 'Content-Length'],
    maxAge: 86400,
    optionsSuccessStatus: 204,
  })
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: false }))
  const doc = new DocumentBuilder().setTitle('Vomtek API').setDescription('Pipeline diagnostics, marketplace, rentals and homeowner workflows').setVersion('1.0').addBearerAuth().build()
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, doc))
  await app.listen(Number(process.env.PORT) || 4110, '0.0.0.0')
  console.log(`Vomtek API listening on http://localhost:${process.env.PORT || 4110}/api`)
}
void bootstrap()
