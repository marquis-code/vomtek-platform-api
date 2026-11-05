import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'
import { MongooseModule } from '@nestjs/mongoose'
import { AuthController } from './auth.controller'
import { AdminController, PortalController, PublicController } from './app.controller'
import { AppService } from './app.service'
import { EngineService } from './engine'
import { PdfService } from './pdf.service'
import { AuditService } from './audit.service'
import { SeedService } from './seed.service'
import {
  Asset, AssetSchema, Bid, BidSchema, Escrow, EscrowSchema, InspectionRun, InspectionRunSchema, Job, JobSchema,
  Lead, LeadSchema, Manufacturer, ManufacturerSchema, Order, OrderSchema, Organization, OrganizationSchema,
  Plan, PlanSchema, Product, ProductSchema, Rental, RentalSchema, Report, ReportSchema, Subscription, SubscriptionSchema, User, UserSchema,
  Invoice, InvoiceSchema, Payment, PaymentSchema, Refund, RefundSchema, ContractorProfile, ContractorProfileSchema,
  WorkOrder, WorkOrderSchema, AuditLog, AuditLogSchema, Notification, NotificationSchema, Setting, SettingSchema, PasswordReset, PasswordResetSchema,
} from './schemas/entities'

const models = MongooseModule.forFeature([
  { name: User.name, schema: UserSchema }, { name: Organization.name, schema: OrganizationSchema },
  { name: Asset.name, schema: AssetSchema }, { name: InspectionRun.name, schema: InspectionRunSchema },
  { name: Report.name, schema: ReportSchema }, { name: Product.name, schema: ProductSchema },
  { name: Order.name, schema: OrderSchema }, { name: Rental.name, schema: RentalSchema },
  { name: Plan.name, schema: PlanSchema }, { name: Subscription.name, schema: SubscriptionSchema },
  { name: Job.name, schema: JobSchema }, { name: Bid.name, schema: BidSchema }, { name: Escrow.name, schema: EscrowSchema },
  { name: Manufacturer.name, schema: ManufacturerSchema }, { name: Lead.name, schema: LeadSchema },
  { name: Invoice.name, schema: InvoiceSchema }, { name: Payment.name, schema: PaymentSchema }, { name: Refund.name, schema: RefundSchema },
  { name: ContractorProfile.name, schema: ContractorProfileSchema }, { name: WorkOrder.name, schema: WorkOrderSchema },
  { name: AuditLog.name, schema: AuditLogSchema }, { name: Notification.name, schema: NotificationSchema }, { name: Setting.name, schema: SettingSchema },
  { name: PasswordReset.name, schema: PasswordResetSchema },
])

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRoot(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27019/linesight'),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({ secret: config.get('JWT_SECRET') || 'linesight-dev-secret', signOptions: { expiresIn: '7d' } }),
    }),
    models,
  ],
  controllers: [AuthController, PublicController, PortalController, AdminController],
  providers: [AppService, EngineService, SeedService, PdfService, AuditService],
})
export class AppModule {}
