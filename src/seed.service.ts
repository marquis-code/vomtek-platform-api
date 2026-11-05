import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import * as bcrypt from 'bcryptjs'
import { Asset, Bid, Doc, Escrow, InspectionRun, Job, Lead, Manufacturer, Order, Organization, Plan, Product, Rental, Report, Subscription, User } from './schemas/entities'
import { EngineService } from './engine'

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name)
  constructor(
    @InjectModel(User.name) private users: Model<Doc<User>>,
    @InjectModel(Organization.name) private orgs: Model<Doc<Organization>>,
    @InjectModel(Asset.name) private assets: Model<Doc<Asset>>,
    @InjectModel(InspectionRun.name) private runs: Model<Doc<InspectionRun>>,
    @InjectModel(Report.name) private reports: Model<Doc<Report>>,
    @InjectModel(Product.name) private products: Model<Doc<Product>>,
    @InjectModel(Order.name) private orders: Model<Doc<Order>>,
    @InjectModel(Rental.name) private rentals: Model<Doc<Rental>>,
    @InjectModel(Plan.name) private plans: Model<Doc<Plan>>,
    @InjectModel(Subscription.name) private subs: Model<Doc<Subscription>>,
    @InjectModel(Job.name) private jobs: Model<Doc<Job>>,
    @InjectModel(Bid.name) private bids: Model<Doc<Bid>>,
    @InjectModel(Escrow.name) private escrows: Model<Doc<Escrow>>,
    @InjectModel(Manufacturer.name) private manufacturers: Model<Doc<Manufacturer>>,
    @InjectModel(Lead.name) private leads: Model<Doc<Lead>>,
    private engine: EngineService,
  ) {}

  async onModuleInit() {
    if (process.env.SEED_ON_BOOT !== 'true') return
    try { await this.run(false) } catch (error) { this.logger.error(`Seed failed: ${(error as Error).message}`) }
  }

  async run(verbose = true) {
    await Promise.all([
      this.users.deleteMany({}), this.orgs.deleteMany({}), this.assets.deleteMany({}), this.runs.deleteMany({}), this.reports.deleteMany({}),
      this.products.deleteMany({}), this.orders.deleteMany({}), this.rentals.deleteMany({}), this.plans.deleteMany({}), this.subs.deleteMany({}),
      this.jobs.deleteMany({}), this.bids.deleteMany({}), this.escrows.deleteMany({}), this.manufacturers.deleteMany({}), this.leads.deleteMany({}),
    ])
    const [northstar, harris, cedar, precision, polyform, opsOrg] = await this.orgs.create([
      { name: 'Northstar Midstream', slug: 'northstar', type: 'operator', plan: 'scale', miles: 48, status: 'active' },
      { name: 'Harris County Water', slug: 'harris-water', type: 'utility', plan: 'foundation', miles: 18, status: 'active' },
      { name: 'Cedar Ridge HOA', slug: 'cedar-ridge', type: 'homeowner', plan: 'none', miles: 0, status: 'active' },
      { name: 'Precision Trenchless', slug: 'precision-trenchless', type: 'contractor', plan: 'partner', miles: 0, status: 'active' },
      { name: 'PolyForm Supply Co.', slug: 'polyform', type: 'manufacturer', plan: 'growth', miles: 0, status: 'active' },
      { name: 'LineSight Operations', slug: 'linesight-ops', type: 'operator', plan: 'internal', miles: 0, status: 'active' },
    ])
    const hash = await bcrypt.hash('LineSightDemo!2026', 12)
    const opsHash = await bcrypt.hash('LineSightOps!2026', 12)
    await this.users.create([
      { email: 'demo@linesight.io', name: 'Maya Reyes', passwordHash: hash, role: 'owner', orgId: northstar.id },
      { email: 'utility@linesight.io', name: 'Daniel Okafor', passwordHash: hash, role: 'engineer', orgId: harris.id },
      { email: 'homeowner@linesight.io', name: 'Cedar Ridge HOA', passwordHash: hash, role: 'homeowner', orgId: cedar.id },
      { email: 'contractor@linesight.io', name: 'Luis Ortega', passwordHash: hash, role: 'contractor', orgId: precision.id },
      { email: 'ops@linesight.io', name: 'LineSight Operations', passwordHash: opsHash, role: 'admin', orgId: opsOrg.id },
    ])

    const [trunk, gathering, reclaimed] = await this.assets.create([
      { orgId: northstar.id, name: 'Gulf Coast Trunk 12', location: 'Wharton County, TX', lengthKm: 48.2, diameterMm: 609.6, wallMm: 9.5, maopKpa: 6900, product: 'Crude oil', grade: 'API 5L X65', installYear: 2009, health: 78, status: 'active', lat: 29.31, lon: -96.1 },
      { orgId: northstar.id, name: 'Northstar Gathering 8', location: 'Fort Bend County, TX', lengthKm: 22.4, diameterMm: 323.9, wallMm: 8.2, maopKpa: 6900, product: 'Natural gas liquids', grade: 'API 5L X52', installYear: 2015, health: 86, status: 'active', lat: 29.53, lon: -95.75 },
      { orgId: harris.id, name: 'Reclaimed Water Main 16', location: 'Harris County, TX', lengthKm: 14.8, diameterMm: 406.4, wallMm: 7.9, maopKpa: 1380, product: 'Reclaimed water', grade: 'AWWA C200', installYear: 2004, health: 64, status: 'active', lat: 29.78, lon: -95.42 },
    ])

    const products = await this.products.create([
      { slug: 'mfl-12-three-cup', sku: 'LS-MFL-12', name: '12" MFL Inspection Pig · 3-Cup', category: 'Inspection pigs', description: 'Three-cup MFL platform for 12-inch liquid lines. Includes odometer, IMU mount andLineSight data ingestion.', priceUsd: 9800, unit: 'per run', leadTime: '3–5 weeks', vendor: 'PolyForm Supply Co.', stock: 3, image: 'smart-pig', specs: [{ label: 'Line size', value: '10–14 in' }, { label: 'Tool type', value: 'MFL + Caliper' }, { label: 'Pressure', value: 'up to 1,480 psi' }], featured: true },
      { slug: 'poly-scraper-8', sku: 'LS-POLY-08', name: '8" Polyurethane Scraper Pig', category: 'Cleaning pigs', description: 'Four-disc scraper for routine paraffin and scale removal in 8-inch lines. Configured by wall and bend radius.', priceUsd: 2450, unit: 'each', leadTime: '10–14 days', vendor: 'PolyForm Supply Co.', stock: 12, image: 'six-inch-pig', specs: [{ label: 'Line size', value: '6–10 in' }, { label: 'Material', value: 'Polyurethane' }, { label: 'Bypass', value: '12%' }], featured: true },
      { slug: 'tracking-transmitter', sku: 'LS-TX-01', name: 'Pipeline Tracking Transmitter', category: 'Instrumentation', description: 'Magnetic tracking transmitter with 30-day battery and above-ground locating accuracy to 1.5 m.', priceUsd: 1850, unit: 'each', leadTime: 'In stock', vendor: 'LineSight Supply', stock: 24, image: 'inspection-robot', specs: [{ label: 'Frequency', value: '22 Hz' }, { label: 'Battery', value: '30 days' }, { label: 'Depth', value: 'up to 6 m' }], featured: true },
      { slug: 'cup-set-12', sku: 'LS-CUP-12', name: '12" Replacement Cup Set', category: 'Spares', description: 'Set of four 85A polyurethane cups for the LineSight standard 12-inch pig.', priceUsd: 480, unit: 'set', leadTime: 'In stock', vendor: 'PolyForm Supply Co.', stock: 40, image: 'pig-insertion', specs: [{ label: 'Durometer', value: '85A' }, { label: 'Quantity', value: '4 cups' }], featured: false },
      { slug: 'camera-kit-home', sku: 'LS-CAM-HOME', name: 'Home Line Camera Kit · 7-Day Rental', category: 'Rentals', description: 'Self-service sewer camera with 100 ft reel, Wi-Fi transmitter and LineSight Home upload.', priceUsd: 395, unit: 'per week', leadTime: 'Ships next day', vendor: 'LineSight Rentals', stock: 8, image: 'inspection-robot', specs: [{ label: 'Reel', value: '100 ft' }, { label: 'Recording', value: '1080p' }, { label: 'Deposit', value: '$400' }], featured: true },
      { slug: 'acoustic-kit', sku: 'LS-AC-01', name: 'Acoustic Leak Survey Kit', category: 'Rentals', description: 'Ground microphone and correlator for municipal leak surveys. Includes calibration and shipping case.', priceUsd: 640, unit: 'per week', leadTime: 'Ships next day', vendor: 'LineSight Rentals', stock: 5, image: 'valve-station', specs: [{ label: 'Channels', value: '2' }, { label: 'Frequency', value: '0–4 kHz' }], featured: false },
      { slug: 'ili-24-rental', sku: 'LS-ILI-24', name: '24" ILI Tool · Project Rental', category: 'Rentals', description: 'Large-line MFL tool with LineSight analysts, mobilisation and preliminary report included.', priceUsd: 18500, unit: 'per run', leadTime: '6–8 weeks', vendor: 'LineSight Rentals', stock: 1, image: 'smart-pig', specs: [{ label: 'Line size', value: '20–28 in' }, { label: 'Report', value: '5 business days' }], featured: true },
      { slug: 'b2c-health-report', sku: 'LS-HOME-REPORT', name: 'Home Line Health Report', category: 'Home services', description: 'AI-assisted review of homeowner camera footage with a written health certificate and contractor-ready scope.', priceUsd: 149, unit: 'per property', leadTime: '24 hours', vendor: 'LineSight Home', stock: 999, image: 'water-utility', specs: [{ label: 'Turnaround', value: '24 hours' }, { label: 'Includes', value: 'Certificate + scope' }], featured: true },
    ])

    await this.plans.create([
      { slug: 'foundation', name: 'Foundation', pricePerMile: 14, minMonthly: 2500, fromMiles: 0, toMiles: 4999, features: ['LineSight Intelligence workspace', '2 ILI runs / year', 'B31G & CGR reports', 'Email support'] },
      { slug: 'scale', name: 'Scale', pricePerMile: 11, minMonthly: 7500, fromMiles: 5000, toMiles: 24999, features: ['Unlimited runs', '4D digital twin comparison', 'API + GIS integrations', 'Named integrity engineer'] },
      { slug: 'enterprise', name: 'Enterprise', pricePerMile: 8, minMonthly: 15000, fromMiles: 25000, toMiles: 1000000, features: ['Multi-tenant administration', 'SSO & audit exports', 'Custom models', '24/7 escalation'] },
    ])
    await this.subs.create({ orgId: northstar.id, planSlug: 'scale', miles: 48, annualValue: 48000, status: 'active', renewsAt: new Date(Date.now() + 240 * 86400000) })
    await this.subs.create({ orgId: harris.id, planSlug: 'foundation', miles: 18, annualValue: 18000, status: 'active', renewsAt: new Date(Date.now() + 300 * 86400000) })

    await this.manufacturers.create([
      { name: 'PolyForm Supply Co.', contact: 'sales@polyform.example', status: 'verified', plan: 'growth', monthlyFee: 1200, listings: 2 },
      { name: 'Gulf Tool Works', contact: 'hello@gulftool.example', status: 'verified', plan: 'starter', monthlyFee: 450, listings: 1 },
      { name: 'Precision Trenchless', contact: 'ops@precision.example', status: 'pending', plan: 'partner', monthlyFee: 0, listings: 0 },
    ])

    const run1 = await this.runs.create({ orgId: northstar.id, assetId: trunk.id, vendor: 'LineSight Engine', toolType: 'MFL + Caliper', runDate: new Date(Date.now() - 21 * 86400000), fileName: 'gulf-coast-trunk-2026-10.csv', status: 'complete' })
    const result1 = await this.engine.analyzeIli(trunk.toObject(), [])
    const report1 = await this.reports.create({ ...result1, orgId: northstar.id, assetId: trunk.id, runId: run1.id })
    run1.reportId = report1.id; run1.summary = result1.summary; await run1.save()
    const run2 = await this.runs.create({ orgId: harris.id, assetId: reclaimed.id, vendor: 'LineSight Engine', toolType: 'CCTV + Acoustic', runDate: new Date(Date.now() - 9 * 86400000), fileName: 'reclaimed-main-16-cctv.csv', status: 'complete' })
    const result2 = await this.engine.analyzeIli(reclaimed.toObject(), [])
    const report2 = await this.reports.create({ ...result2, orgId: harris.id, assetId: reclaimed.id, runId: run2.id })
    run2.reportId = report2.id; run2.summary = result2.summary; await run2.save()

    await this.orders.create([
      { orgId: northstar.id, userId: 'seed', items: [{ name: products[0].name, priceUsd: products[0].priceUsd, qty: 1 }], subtotal: 9800, commission: 784, total: 9800, status: 'fulfilled', channel: 'marketplace', ref: 'ORD-1042', createdAt: new Date(Date.now() - 18 * 86400000) },
      { orgId: harris.id, userId: 'seed', items: [{ name: products[4].name, priceUsd: products[4].priceUsd, qty: 1 }], subtotal: 395, commission: 31.6, total: 395, status: 'paid', channel: 'rental', ref: 'ORD-1043', createdAt: new Date(Date.now() - 5 * 86400000) },
    ])
    await this.rentals.create([
      { orgId: northstar.id, productId: products[0].id, productName: products[0].name, from: new Date(Date.now() - 2 * 86400000), to: new Date(Date.now() + 5 * 86400000), days: 7, subtotal: 3430, deposit: 3920, total: 7350, status: 'active', ref: 'RNT-2041' },
    ])

    const job = await this.jobs.create({
      ref: 'LSH-2026-1842', customerName: 'Cedar Ridge HOA', email: 'homeowner@linesight.io', phone: '+1 713 555 0188', address: '1420 Cedar Ridge Dr', city: 'Katy, TX', propertyType: 'residential', issue: 'Recurring backups at two cleanouts after heavy rain. Camera footage attached.', videoUrl: 'cedar-ridge-lateral.mp4', status: 'bidding', healthScore: 72,
      defects: [
        { type: 'Root intrusion', severity: 'high', distanceFt: 22, confidence: .94, note: 'Root mass reducing effective diameter.' },
        { type: 'Offset joint', severity: 'medium', distanceFt: 41, confidence: .89, note: 'Displaced joint with a snagging lip.' },
        { type: 'Scale / debris', severity: 'low', distanceFt: 58, confidence: .82, note: 'Loose scale along the invert.' },
      ],
      certificate: { issuedAt: new Date(Date.now() - 3 * 86400000), standard: 'LineSight Visual Assessment v1', confidence: .91, footageReviewedFt: 78, summary: 'Three findings identified. One high-priority root intrusion and one offset joint should be quoted for repair.' },
    })
    await this.bids.create([
      { jobId: job.id, contractorName: 'Precision Trenchless', amountUsd: 4800, days: 3, note: 'Includes excavation, root removal and spot repair.', status: 'submitted' },
      { jobId: job.id, contractorName: 'Bayou Pipe Services', amountUsd: 5250, days: 2, note: 'Two-day crew with post-repair camera verification.', status: 'submitted' },
    ])
    const job2 = await this.jobs.create({ ref: 'LSH-2026-1819', customerName: 'Cedar Ridge HOA', email: 'homeowner@linesight.io', address: '88 Cedar Ridge Ln', city: 'Katy, TX', propertyType: 'residential', issue: 'Slow drain in the clubhouse kitchen line.', videoUrl: 'clubhouse-kitchen.mp4', status: 'awarded', healthScore: 84, contractorOrgId: precision.id, defects: [{ type: 'Grease buildup', severity: 'medium', distanceFt: 16, confidence: .88, note: 'Grease accumulation through the first 18 ft.' }], certificate: { issuedAt: new Date(Date.now() - 16 * 86400000), standard: 'LineSight Visual Assessment v1', confidence: .88, footageReviewedFt: 42, summary: 'Grease buildup; jetting recommended.' } })
    await this.escrows.create({ jobId: job2.id, amount: 2600, status: 'partially_released', milestones: [{ label: 'Mobilisation', amount: 780, status: 'released' }, { label: 'Repair complete', amount: 1300, status: 'pending' }, { label: 'Verification', amount: 520, status: 'pending' }] })
    await this.leads.create([
      { name: 'Cody Bennett', email: 'cody@riverside.example', company: 'Riverside Gathering', type: 'operator', message: 'Need a 24-inch ILI run quoted for Q1.', status: 'new', source: 'website' },
      { name: 'Alicia Grant', email: 'alicia@hcfcd.example', company: 'Harris County Flood Control', type: 'utility', message: 'Looking at acoustic leak surveys across 40 km.', status: 'qualified', source: 'website' },
    ])

    this.logger.log(`Seed complete: orgs=${await this.orgs.countDocuments()} products=${await this.products.countDocuments()} reports=${await this.reports.countDocuments()} jobs=${await this.jobs.countDocuments()}`)
    if (verbose) console.log('LineSight seed complete')
  }
}
