import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { HydratedDocument } from 'mongoose'

export type Doc<T> = HydratedDocument<T>

@Schema({ timestamps: true })
export class Organization {
  @Prop({ required: true }) name: string
  @Prop({ required: true, unique: true }) slug: string
  @Prop({ required: true, enum: ['operator', 'utility', 'homeowner', 'contractor', 'manufacturer'] }) type: string
  @Prop({ default: 'none' }) plan: string
  @Prop({ default: 0 }) miles: number
  @Prop({ default: 'active' }) status: string
  @Prop({ default: 'US' }) country: string
  @Prop({ default: '' }) logo: string
}
export const OrganizationSchema = SchemaFactory.createForClass(Organization)

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, lowercase: true }) email: string
  @Prop({ required: true }) name: string
  @Prop({ required: true }) passwordHash: string
  @Prop({ required: true, enum: ['owner', 'admin', 'engineer', 'contractor', 'homeowner'] }) role: string
  @Prop({ required: true }) orgId: string
  @Prop({ default: true }) active: boolean
  @Prop() lastLoginAt: Date
}
export const UserSchema = SchemaFactory.createForClass(User)

@Schema({ timestamps: true })
export class Asset {
  @Prop({ required: true }) orgId: string
  @Prop({ required: true }) name: string
  @Prop({ default: 'Houston, TX' }) location: string
  @Prop({ required: true }) lengthKm: number
  @Prop({ required: true }) diameterMm: number
  @Prop({ required: true }) wallMm: number
  @Prop({ default: 0 }) maopKpa: number
  @Prop({ default: 'Crude oil' }) product: string
  @Prop({ default: 'API 5L X65' }) grade: string
  @Prop({ default: 'Carbon steel' }) material: string
  @Prop({ default: 2012 }) installYear: number
  @Prop({ default: 0 }) health: number
  @Prop({ default: 'active' }) status: string
  @Prop() lastRunAt: Date
  @Prop({ type: Object }) route: Record<string, unknown>
}
export const AssetSchema = SchemaFactory.createForClass(Asset)

@Schema({ timestamps: true })
export class InspectionRun {
  @Prop({ required: true }) orgId: string
  @Prop({ required: true }) assetId: string
  @Prop({ default: 'Manual' }) vendor: string
  @Prop({ default: 'MFL + Caliper' }) toolType: string
  @Prop({ default: () => new Date() }) runDate: Date
  @Prop({ default: '' }) fileName: string
  @Prop({ default: 'complete', enum: ['queued', 'processing', 'complete', 'failed'] }) status: string
  @Prop() reportId: string
  @Prop() summary: string
}
export const InspectionRunSchema = SchemaFactory.createForClass(InspectionRun)

@Schema({ timestamps: true })
export class Report {
  @Prop({ required: true }) orgId: string
  @Prop({ required: true }) assetId: string
  @Prop({ required: true }) runId: string
  @Prop({ required: true, unique: true }) ref: string
  @Prop({ default: '' }) summary: string
  @Prop({ default: 'medium' }) risk: string
  @Prop({ default: 0 }) confidence: number
  @Prop({ default: 0 }) maxDepthPct: number
  @Prop({ default: 0 }) cgr: number
  @Prop({ default: 0 }) safePressureKpa: number
  @Prop({ default: 0 }) remainingLifeYears: number
  @Prop({ type: [Object], default: [] }) anomalies: Record<string, unknown>[]
  @Prop({ type: [Object], default: [] }) b31g: Record<string, unknown>[]
  @Prop({ type: [Object], default: [] }) heatmap: Record<string, unknown>[]
  @Prop({ type: Object }) metrics: Record<string, unknown>
}
export const ReportSchema = SchemaFactory.createForClass(Report)

@Schema({ timestamps: true })
export class Product {
  @Prop({ required: true, unique: true }) slug: string
  @Prop({ required: true, unique: true }) sku: string
  @Prop({ required: true }) name: string
  @Prop({ required: true }) category: string
  @Prop({ default: '' }) description: string
  @Prop({ required: true }) priceUsd: number
  @Prop({ default: 'each' }) unit: string
  @Prop({ default: '2–3 weeks' }) leadTime: string
  @Prop({ default: 'LineSight Supply' }) vendor: string
  @Prop({ default: 0 }) stock: number
  @Prop({ default: '' }) image: string
  @Prop({ type: [Object], default: [] }) specs: Record<string, string>[]
  @Prop({ default: false }) featured: boolean
  @Prop({ default: true }) active: boolean
}
export const ProductSchema = SchemaFactory.createForClass(Product)

@Schema({ timestamps: true })
export class Order {
  @Prop({ required: true }) orgId: string
  @Prop({ required: true }) userId: string
  @Prop({ type: [Object], default: [] }) items: Record<string, unknown>[]
  @Prop({ default: 0 }) subtotal: number
  @Prop({ default: 0 }) commission: number
  @Prop({ default: 0 }) total: number
  @Prop({ default: 'pending', enum: ['pending', 'paid', 'fulfilled', 'cancelled'] }) status: string
  @Prop({ default: 'marketplace' }) channel: string
  @Prop() ref: string
}
export const OrderSchema = SchemaFactory.createForClass(Order)

@Schema({ timestamps: true })
export class Rental {
  @Prop({ required: true }) orgId: string
  @Prop({ required: true }) productId: string
  @Prop({ required: true }) productName: string
  @Prop({ required: true }) from: Date
  @Prop({ required: true }) to: Date
  @Prop({ default: 2 }) days: number
  @Prop({ default: 0 }) subtotal: number
  @Prop({ default: 0 }) deposit: number
  @Prop({ default: 0 }) total: number
  @Prop({ default: 'reserved' }) status: string
  @Prop() ref: string
}
export const RentalSchema = SchemaFactory.createForClass(Rental)

@Schema({ timestamps: true })
export class Plan {
  @Prop({ required: true, unique: true }) slug: string
  @Prop({ required: true }) name: string
  @Prop({ required: true }) pricePerMile: number
  @Prop({ required: true }) minMonthly: number
  @Prop({ default: 0 }) fromMiles: number
  @Prop({ default: 10000 }) toMiles: number
  @Prop({ type: [String], default: [] }) features: string[]
  @Prop({ default: true }) active: boolean
}
export const PlanSchema = SchemaFactory.createForClass(Plan)

@Schema({ timestamps: true })
export class Subscription {
  @Prop({ required: true }) orgId: string
  @Prop({ required: true }) planSlug: string
  @Prop({ required: true }) miles: number
  @Prop({ default: 0 }) annualValue: number
  @Prop({ default: 'active' }) status: string
  @Prop() renewsAt: Date
}
export const SubscriptionSchema = SchemaFactory.createForClass(Subscription)

@Schema({ timestamps: true })
export class Manufacturer {
  @Prop({ required: true }) name: string
  @Prop({ default: '' }) contact: string
  @Prop({ default: 'verified' }) status: string
  @Prop({ default: 'growth' }) plan: string
  @Prop({ default: 0 }) monthlyFee: number
  @Prop({ default: 0 }) listings: number
  @Prop({ default: 'US' }) country: string
}
export const ManufacturerSchema = SchemaFactory.createForClass(Manufacturer)

@Schema({ timestamps: true })
export class Job {
  @Prop({ required: true, unique: true }) ref: string
  @Prop({ required: true }) customerName: string
  @Prop({ required: true }) email: string
  @Prop({ default: '' }) phone: string
  @Prop({ required: true }) address: string
  @Prop({ default: 'Houston' }) city: string
  @Prop({ default: 'residential' }) propertyType: string
  @Prop({ required: true }) issue: string
  @Prop({ default: '' }) videoUrl: string
  @Prop({ default: 'new', enum: ['new', 'analyzing', 'report_ready', 'bidding', 'awarded', 'in_progress', 'complete', 'cancelled'] }) status: string
  @Prop({ type: [Object], default: [] }) defects: Record<string, unknown>[]
  @Prop({ type: Object }) certificate: Record<string, unknown>
  @Prop({ default: 0 }) healthScore: number
  @Prop() contractorOrgId: string
}
export const JobSchema = SchemaFactory.createForClass(Job)

@Schema({ timestamps: true })
export class Bid {
  @Prop({ required: true }) jobId: string
  @Prop({ required: true }) contractorName: string
  @Prop({ required: true }) amountUsd: number
  @Prop({ default: 3 }) days: number
  @Prop({ default: '' }) note: string
  @Prop({ default: 'submitted', enum: ['submitted', 'shortlisted', 'awarded', 'declined'] }) status: string
}
export const BidSchema = SchemaFactory.createForClass(Bid)

@Schema({ timestamps: true })
export class Escrow {
  @Prop({ required: true }) jobId: string
  @Prop({ required: true }) amount: number
  @Prop({ default: 'funded', enum: ['funded', 'partially_released', 'released', 'refunded'] }) status: string
  @Prop({ type: [Object], default: [] }) milestones: Record<string, unknown>[]
}
export const EscrowSchema = SchemaFactory.createForClass(Escrow)

@Schema({ timestamps: true })
export class Lead {
  @Prop({ required: true }) name: string
  @Prop({ required: true }) email: string
  @Prop({ default: '' }) company: string
  @Prop({ default: 'operator' }) type: string
  @Prop({ default: '' }) message: string
  @Prop({ default: 'new' }) status: string
  @Prop({ default: 'website' }) source: string
}
export const LeadSchema = SchemaFactory.createForClass(Lead)
