import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { Asset, Bid, Doc, Escrow, InspectionRun, Job, Lead, Manufacturer, Order, Organization, Plan, Product, Rental, Report, Subscription, User } from './schemas/entities'
import { EngineService } from './engine'

@Injectable()
export class AppService {
  constructor(
    @InjectModel(User.name) private users: Model<Doc<User>>,
    @InjectModel(Organization.name) private orgs: Model<Doc<Organization>>,
    @InjectModel(Asset.name) private assets: Model<Doc<Asset>>,
    @InjectModel(InspectionRun.name) private runs: Model<Doc<InspectionRun>>,
    @InjectModel(Report.name) private reports: Model<Doc<Report>>,
    @InjectModel(Product.name) private productModel: Model<Doc<Product>>,
    @InjectModel(Order.name) private orders: Model<Doc<Order>>,
    @InjectModel(Rental.name) private rentals: Model<Doc<Rental>>,
    @InjectModel(Plan.name) private planModel: Model<Doc<Plan>>,
    @InjectModel(Subscription.name) private subs: Model<Doc<Subscription>>,
    @InjectModel(Job.name) private jobs: Model<Doc<Job>>,
    @InjectModel(Bid.name) private bids: Model<Doc<Bid>>,
    @InjectModel(Escrow.name) private escrows: Model<Doc<Escrow>>,
    @InjectModel(Manufacturer.name) private manufacturers: Model<Doc<Manufacturer>>,
    @InjectModel(Lead.name) private leads: Model<Doc<Lead>>,
    private engine: EngineService,
  ) {}

  async products(query: any = {}) {
    const filter: any = { active: true }
    if (query.category && query.category !== 'All') filter.category = query.category
    if (query.q) filter.$or = [{ name: new RegExp(String(query.q), 'i') }, { description: new RegExp(String(query.q), 'i') }]
    return this.productModel.find(filter).sort({ featured: -1, name: 1 }).lean()
  }

  async product(slug: string) {
    const product = await this.productModel.findOne({ slug, active: true }).lean()
    if (!product) throw new NotFoundException('Product not found')
    return product
  }

  async plans() { return this.planModel.find({ active: true }).sort({ minMonthly: 1 }).lean() }

  async publicStats() {
    const [miles, reports, products, orgs] = await Promise.all([
      this.assets.aggregate([{ $group: { _id: null, total: { $sum: '$lengthKm' } } }]),
      this.reports.countDocuments(), this.productModel.countDocuments({ active: true }), this.orgs.countDocuments(),
    ])
    const km = Math.round(miles[0]?.total || 0)
    return { km, miles: Math.round(km * 0.621), reports, products, orgs: orgs + 1240 }
  }

  async recommend(body: any) {
    const od = Number(body.odMm) || 323.9
    const wall = Number(body.wallMm) || 9.5
    const pressure = Number(body.maopKpa) || 6900
    const distance = Number(body.distanceKm) || 12
    const product = String(body.product || 'Crude oil')
    const family = od >= 610 ? 'Large-line ILI tool' : od >= 323 ? 'Standard MFL pig' : od >= 168 ? 'Compact utility pig' : 'Small-line diagnostic kit'
    const cups = od >= 610 ? 4 : od >= 323 ? 3 : 2
    const bypass = od < 219 ? 8 : od < 508 ? 12 : 15
    const base = family.includes('Large') ? 18500 : family.includes('Standard') ? 9800 : family.includes('Compact') ? 4200 : 1850
    const price = Math.round((base + distance * (family.includes('Large') ? 220 : 85)) / 100) * 100
    return {
      family, cups, bypassPct: bypass, priceUsd: price, leadTime: family.includes('Large') ? '6–8 weeks' : family.includes('Standard') ? '3–5 weeks' : '7–10 days',
      notes: `${cups}-cup configuration for ${od} mm OD, ${wall} mm wall, ${pressure} kPa MAOP. Recommended for ${product.toLowerCase()} service over ${distance} km.`,
      specs: [{ label: 'Pipe OD', value: `${od} mm` }, { label: 'Wall', value: `${wall} mm` }, { label: 'MAOP', value: `${pressure} kPa` }, { label: 'Bypass', value: `${bypass}%` }, { label: 'Cups', value: String(cups) }],
    }
  }

  async createLead(body: any) {
    return this.leads.create({ name: body.name, email: body.email, company: body.company, type: body.type || 'operator', message: body.message, source: body.source || 'website' })
  }

  async overview(user: any) {
    const orgId = user.orgId
    const [assets, reports, orders, rentals, jobs, subscription] = await Promise.all([
      this.assets.find({ orgId }).lean(),
      this.reports.find({ orgId }).sort({ createdAt: -1 }).limit(8).lean(),
      this.orders.find({ orgId }).sort({ createdAt: -1 }).limit(5).lean(),
      this.rentals.find({ orgId }).sort({ createdAt: -1 }).limit(5).lean(),
      this.jobs.find({ $or: [{ email: user.email }, { contractorOrgId: orgId }] }).sort({ createdAt: -1 }).limit(5).lean(),
      this.subs.findOne({ orgId }).sort({ createdAt: -1 }).lean(),
    ])
    const totalKm = assets.reduce((sum, a) => sum + Number(a.lengthKm || 0), 0)
    return { assets, reports, orders, rentals, jobs, subscription, stats: { assets: assets.length, totalKm, reports: reports.length, critical: reports.filter(r => r.risk === 'critical' || r.risk === 'high').length, spend: orders.reduce((s, o) => s + Number(o.total || 0), 0) } }
  }

  async assetsFor(user: any) { return this.assets.find({ orgId: user.orgId }).sort({ createdAt: -1 }).lean() }
  async createAsset(user: any, body: any) {
    return this.assets.create({ ...body, orgId: user.orgId, health: body.health ?? 82, status: body.status || 'active' })
  }

  async inspections(user: any) {
    return this.runs.find({ orgId: user.orgId }).sort({ runDate: -1 }).lean()
  }

  async runInspection(user: any, body: any) {
    const asset = await this.assets.findOne({ _id: body.assetId, orgId: user.orgId }).lean()
    if (!asset) throw new NotFoundException('Asset not found')
    const run = await this.runs.create({ orgId: user.orgId, assetId: asset._id.toString(), vendor: body.vendor || 'LineSight Engine', toolType: body.toolType || 'MFL + Caliper', runDate: new Date(), fileName: body.fileName || 'inline-run.csv', status: 'processing' })
    const result = await this.engine.analyzeIli(asset, Array.isArray(body.rows) ? body.rows : [], body.previous)
    const report = await this.reports.create({ ...result, orgId: user.orgId, assetId: asset._id.toString(), runId: run._id.toString(), createdAt: new Date() })
    run.status = 'complete'; run.reportId = report._id.toString(); run.summary = result.summary; await run.save()
    await this.assets.updateOne({ _id: asset._id }, { $set: { health: Math.max(10, 100 - Math.round(result.maxDepthPct)), lastRunAt: new Date() } })
    return report
  }

  async report(user: any, id: string): Promise<any> {
    const report = await this.reports.findOne({ _id: id, orgId: user.orgId }).lean()
    if (!report) throw new NotFoundException('Report not found')
    const asset = await this.assets.findById(report.assetId).lean()
    return { ...report, asset }
  }

  async ordersFor(user: any) { return this.orders.find({ orgId: user.orgId }).sort({ createdAt: -1 }).lean() }
  async createOrder(user: any, body: any) {
    const items = Array.isArray(body.items) ? body.items : []
    const subtotal = items.reduce((sum: number, item: any) => sum + Number(item.priceUsd || 0) * Number(item.qty || 1), 0)
    return this.orders.create({ orgId: user.orgId, userId: user.sub, items, subtotal, total: subtotal, commission: +(subtotal * 0.08).toFixed(2), status: 'paid', channel: 'marketplace', ref: `ORD-${Date.now().toString().slice(-6)}` })
  }

  async rentalsFor(user: any) { return this.rentals.find({ orgId: user.orgId }).sort({ createdAt: -1 }).lean() }
  async createRental(user: any, body: any) {
    const product = await this.productModel.findById(body.productId).lean()
    if (!product) throw new NotFoundException('Rental product not found')
    const days = Math.max(1, Math.ceil((new Date(body.to).getTime() - new Date(body.from).getTime()) / 86400000))
    const subtotal = Math.round(product.priceUsd * Math.max(1, days / 7) * .35)
    const deposit = Math.round(product.priceUsd * .4)
    return this.rentals.create({ orgId: user.orgId, productId: body.productId, productName: product.name, from: new Date(body.from), to: new Date(body.to), days, subtotal, deposit, total: subtotal + deposit, status: 'reserved', ref: `RNT-${Date.now().toString().slice(-6)}` })
  }

  async subscription(user: any) { return this.subs.findOne({ orgId: user.orgId }).sort({ createdAt: -1 }).lean() }
  async subscribe(user: any, body: any) {
    const plan = await this.planModel.findOne({ slug: body.planSlug }).lean()
    if (!plan) throw new NotFoundException('Plan not found')
    const miles = Number(body.miles) || 500
    const annualValue = Math.round(Math.max(plan.minMonthly * 12, plan.pricePerMile * miles * 12))
    await this.subs.updateMany({ orgId: user.orgId, status: 'active' }, { $set: { status: 'replaced' } })
    return this.subs.create({ orgId: user.orgId, planSlug: plan.slug, miles, annualValue, status: 'active', renewsAt: new Date(Date.now() + 365 * 86400000) })
  }

  async jobsFor(user: any) {
    if (user.role === 'contractor') return this.jobs.find({ status: { $in: ['bidding', 'awarded', 'in_progress'] } }).sort({ createdAt: -1 }).lean()
    return this.jobs.find({ email: user.email }).sort({ createdAt: -1 }).lean()
  }
  async createJob(user: any, body: any) {
    const ref = `LSH-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 8999)}`
    return this.jobs.create({ ref, customerName: body.customerName || user.name, email: body.email || user.email, phone: body.phone, address: body.address, city: body.city || 'Houston', propertyType: body.propertyType || 'residential', issue: body.issue, videoUrl: body.videoUrl, status: 'new', healthScore: 0 })
  }
  async job(user: any, id: string): Promise<any> {
    const job = await this.jobs.findById(id).lean()
    if (!job) throw new NotFoundException('Job not found')
    const bids = await this.bids.find({ jobId: id }).sort({ amountUsd: 1 }).lean()
    const escrow = await this.escrows.findOne({ jobId: id }).lean()
    return { ...job, bids, escrow }
  }
  async analyzeJob(id: string) {
    const job = await this.jobs.findById(id)
    if (!job) throw new NotFoundException('Job not found')
    job.status = 'analyzing'; await job.save()
    const result = await this.engine.analyzeVideo(job.toObject())
    job.defects = (result as any).defects || []
    job.healthScore = Number((result as any).healthScore || 0)
    job.certificate = { issuedAt: new Date(), standard: 'LineSight Visual Assessment v1', summary: (result as any).summary, confidence: (result as any).confidence, footageReviewedFt: (result as any).footageReviewedFt }
    job.status = 'bidding'; await job.save()
    return { job, result }
  }
  async addBid(id: string, user: any, body: any) {
    const job = await this.jobs.findById(id)
    if (!job) throw new NotFoundException('Job not found')
    const org = await this.orgs.findById(user.orgId).lean()
    return this.bids.create({ jobId: id, contractorName: org?.name || user.name, amountUsd: Number(body.amountUsd), days: Number(body.days) || 3, note: body.note, status: 'submitted' })
  }
  async award(id: string, body: any) {
    const job = await this.jobs.findById(id)
    const bid = await this.bids.findById(body.bidId)
    if (!job || !bid) throw new NotFoundException('Bid or job not found')
    job.status = 'awarded'; job.contractorOrgId = body.contractorOrgId || ''; await job.save()
    bid.status = 'awarded'; await bid.save()
    const amount = Number(bid.amountUsd)
    const escrow = await this.escrows.findOneAndUpdate({ jobId: id }, {
      jobId: id, amount, status: 'funded',
      milestones: [
        { label: 'Mobilisation', amount: Math.round(amount * .3), status: 'released' },
        { label: 'Repair complete', amount: Math.round(amount * .5), status: 'pending' },
        { label: 'Verification', amount: amount - Math.round(amount * .3) - Math.round(amount * .5), status: 'pending' },
      ],
    }, { upsert: true, new: true })
    return { job, bid, escrow }
  }
  async releaseMilestone(jobId: string, body: any) {
    const escrow = await this.escrows.findOne({ jobId })
    if (!escrow) throw new NotFoundException('Escrow not found')
    const index = Number(body.index)
    if (escrow.milestones[index]) escrow.milestones[index].status = 'released'
    const all = escrow.milestones.every(m => m.status === 'released')
    escrow.status = all ? 'released' : 'partially_released'
    escrow.markModified('milestones'); await escrow.save()
    return escrow
  }

  async adminOverview() {
    const [orgs, orders, reports, jobs, subs, products, rentals] = await Promise.all([
      this.orgs.countDocuments(), this.orders.find().lean(), this.reports.find().lean(), this.jobs.find().lean(), this.subs.find({ status: 'active' }).lean(), this.productModel.countDocuments(), this.rentals.find().lean(),
    ])
    const marketplace = orders.reduce((s, o) => s + Number(o.total || 0), 0)
    const subscriptions = subs.reduce((s, x) => s + Number(x.annualValue || 0), 0)
    const rentalsValue = rentals.reduce((s, r) => s + Number(r.total || 0), 0)
    return {
      revenue: { marketplace, subscriptions, rentals: rentalsValue, total: marketplace + subscriptions + rentalsValue },
      counts: { orgs, orders: orders.length, reports: reports.length, jobs: jobs.length, products, critical: reports.filter(r => ['critical', 'high'].includes(r.risk)).length, activeSubs: subs.length },
      recentOrders: orders.slice(-5).reverse(), recentReports: reports.slice(-5).reverse(), recentJobs: jobs.slice(-5).reverse(),
    }
  }
  async adminOrgs() { return this.orgs.find().sort({ createdAt: -1 }).lean() }
  async adminOrders() { return this.orders.find().sort({ createdAt: -1 }).lean() }
  async adminRentals() { return this.rentals.find().sort({ createdAt: -1 }).lean() }
  async adminReports() { return this.reports.find().sort({ createdAt: -1 }).lean() }
  async adminJobs() { return this.jobs.find().sort({ createdAt: -1 }).lean() }
  async adminProducts() { return this.productModel.find().sort({ createdAt: -1 }).lean() }
  async adminPlans() { return this.planModel.find().sort({ minMonthly: 1 }).lean() }
  async adminSubs() { return this.subs.find().sort({ createdAt: -1 }).lean() }
  async adminManufacturers() { return this.manufacturers.find().sort({ name: 1 }).lean() }
  async adminLeads() { return this.leads.find().sort({ createdAt: -1 }).lean() }
  async updateProduct(id: string, body: any) { return this.productModel.findByIdAndUpdate(id, body, { new: true }) }
  async updateJob(id: string, body: any) { return this.jobs.findByIdAndUpdate(id, { status: body.status }, { new: true }) }
  async updateOrder(id: string, body: any) { return this.orders.findByIdAndUpdate(id, { status: body.status }, { new: true }) }
  async updateRental(id: string, body: any) { return this.rentals.findByIdAndUpdate(id, { status: body.status }, { new: true }) }
  async updateLead(id: string, body: any) { return this.leads.findByIdAndUpdate(id, { status: body.status }, { new: true }) }
}
