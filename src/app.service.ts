import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { Asset, Bid, ContractorProfile, Doc, Escrow, InspectionRun, Invoice, Job, Lead, Manufacturer, Notification, Order, Organization, Payment, Plan, Product, Refund, Rental, Report, Setting, Subscription, User, WorkOrder } from './schemas/entities'
import { EngineService } from './engine'
import { PdfService } from './pdf.service'
import { AuditService } from './audit.service'

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
    @InjectModel(Invoice.name) private invoices: Model<Doc<Invoice>>,
    @InjectModel(Payment.name) private payments: Model<Doc<Payment>>,
    @InjectModel(Refund.name) private refunds: Model<Doc<Refund>>,
    @InjectModel(ContractorProfile.name) private contractorProfiles: Model<Doc<ContractorProfile>>,
    @InjectModel(WorkOrder.name) private workOrders: Model<Doc<WorkOrder>>,
    @InjectModel(Setting.name) private settings: Model<Doc<Setting>>,
    @InjectModel(Notification.name) private notifications: Model<Doc<Notification>>,
    private engine: EngineService,
    private pdf: PdfService,
    private audit: AuditService,
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
    const previous = await this.reports.findOne({ orgId: user.orgId, assetId: asset._id.toString() }).sort({ createdAt: -1 }).lean()
    const run = await this.runs.create({ orgId: user.orgId, assetId: asset._id.toString(), vendor: body.vendor || 'Vomtek Engine', toolType: body.toolType || 'MFL + Caliper', runDate: new Date(), fileName: body.fileName || 'inline-run.csv', filePath: body.filePath || '', rows: Array.isArray(body.rows) ? body.rows : [], status: 'processing' })
    const result = await this.engine.analyzeIli(asset, Array.isArray(body.rows) ? body.rows : [], previous)
    const report = await this.reports.create({ ...result, orgId: user.orgId, assetId: asset._id.toString(), runId: run._id.toString(), previousReportId: previous?._id?.toString() || '', createdAt: new Date() })
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
    const order = await this.orders.create({ orgId: user.orgId, userId: user.sub, items, subtotal, total: subtotal, commission: +(subtotal * 0.08).toFixed(2), status: 'paid', channel: 'marketplace', ref: `ORD-${Date.now().toString().slice(-6)}` })
    for (const item of items) {
      if (item.slug) await this.productModel.updateOne({ slug: item.slug, stock: { $gt: 0 } }, { $inc: { stock: -Number(item.qty || 1) } })
    }
    const billing = await this.issueInvoice(user.orgId, 'marketplace', items.map((i: any) => ({ description: i.name, qty: i.qty || 1, amount: Number(i.priceUsd || 0) * Number(i.qty || 1) })), { orderId: order.id })
    await this.audit.log(user, 'order.created', 'order', order.id, { total: order.total })
    await this.audit.notify({ orgId: user.orgId, subject: `Order ${order.ref} confirmed`, body: `$${order.total} paid. Invoice ${billing.invoice.ref}.` })
    return { ...order.toObject(), invoice: billing.invoice, payment: billing.payment }
  }

  async rentalsFor(user: any) { return this.rentals.find({ orgId: user.orgId }).sort({ createdAt: -1 }).lean() }
  async createRental(user: any, body: any) {
    const product = await this.productModel.findById(body.productId).lean()
    if (!product) throw new NotFoundException('Rental product not found')
    const days = Math.max(1, Math.ceil((new Date(body.to).getTime() - new Date(body.from).getTime()) / 86400000))
    const subtotal = Math.round(product.priceUsd * Math.max(1, days / 7) * .35)
    const deposit = Math.round(product.priceUsd * .4)
    const rental = await this.rentals.create({ orgId: user.orgId, productId: body.productId, productName: product.name, from: new Date(body.from), to: new Date(body.to), days, subtotal, deposit, total: subtotal + deposit, status: 'reserved', ref: `RNT-${Date.now().toString().slice(-6)}` })
    await this.issueInvoice(user.orgId, 'rental', [{ description: `${product.name} rental (${days} days)`, qty: 1, amount: subtotal }, { description: 'Refundable equipment deposit', qty: 1, amount: deposit }])
    await this.audit.log(user, 'rental.reserved', 'rental', rental.id, { total: rental.total })
    return rental
  }

  async subscription(user: any) { return this.subs.findOne({ orgId: user.orgId }).sort({ createdAt: -1 }).lean() }
  async subscribe(user: any, body: any) {
    const plan = await this.planModel.findOne({ slug: body.planSlug }).lean()
    if (!plan) throw new NotFoundException('Plan not found')
    const miles = Number(body.miles) || 500
    const annualValue = Math.round(Math.max(plan.minMonthly * 12, plan.pricePerMile * miles * 12))
    await this.subs.updateMany({ orgId: user.orgId, status: 'active' }, { $set: { status: 'replaced' } })
    const sub = await this.subs.create({ orgId: user.orgId, planSlug: plan.slug, miles, annualValue, status: 'active', renewsAt: new Date(Date.now() + 365 * 86400000) })
    await this.issueInvoice(user.orgId, 'subscription', [{ description: `${plan.name} annual subscription`, qty: 1, amount: annualValue }])
    await this.audit.log(user, 'subscription.activated', 'subscription', sub.id, { plan: plan.slug, annualValue })
    return sub
  }

  async jobsFor(user: any) {
    if (user.role === 'contractor') return this.jobs.find({ status: { $in: ['bidding', 'awarded', 'in_progress'] } }).sort({ createdAt: -1 }).lean()
    return this.jobs.find({ email: user.email }).sort({ createdAt: -1 }).lean()
  }
  async createJob(user: any, body: any) {
    const ref = `VTK-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 8999)}`
    return this.jobs.create({ ref, customerName: body.customerName || user.name, email: body.email || user.email, phone: body.phone, address: body.address, city: body.city || 'Houston', propertyType: body.propertyType || 'residential', issue: body.issue, videoUrl: body.videoUrl, status: 'new', healthScore: 0 })
  }
  async job(user: any, id: string): Promise<any> {
    const job = await this.jobs.findById(id).lean()
    if (!job) throw new NotFoundException('Job not found')
    const bids = await this.bids.find({ jobId: id }).sort({ amountUsd: 1 }).lean()
    const escrow = await this.escrows.findOne({ jobId: id }).lean()
    const workOrder = await this.workOrders.findOne({ jobId: id }).lean()
    return { ...job, bids, escrow, workOrder }
  }
  async analyzeJob(id: string) {
    const job = await this.jobs.findById(id)
    if (!job) throw new NotFoundException('Job not found')
    job.status = 'analyzing'; await job.save()
    const result = await this.engine.analyzeVideo(job.toObject())
    job.defects = (result as any).defects || []
    job.healthScore = Number((result as any).healthScore || 0)
    job.certificate = { issuedAt: new Date(), standard: 'Vomtek Visual Assessment v1', summary: (result as any).summary, confidence: (result as any).confidence, footageReviewedFt: (result as any).footageReviewedFt }
    job.status = 'bidding'; await job.save()
    return { job, result }
  }
  async addBid(id: string, user: any, body: any) {
    const job = await this.jobs.findById(id)
    if (!job) throw new NotFoundException('Job not found')
    const org = await this.orgs.findById(user.orgId).lean()
    return this.bids.create({ jobId: id, contractorName: org?.name || user.name, contractorOrgId: user.orgId, amountUsd: Number(body.amountUsd), days: Number(body.days) || 3, note: body.note, status: 'submitted' })
  }
  async award(id: string, body: any) {
    const job = await this.jobs.findById(id)
    const bid = await this.bids.findById(body.bidId)
    if (!job || !bid) throw new NotFoundException('Bid or job not found')
    job.status = 'awarded'; job.contractorOrgId = bid.contractorOrgId || body.contractorOrgId || ''; await job.save()
    bid.status = 'awarded'; await bid.save()
    const amount = Number(bid.amountUsd)
    await this.workOrders.create({ jobId: id, orgId: job.contractorOrgId, contractorOrgId: job.contractorOrgId, bidId: bid.id, status: 'scheduled', scope: bid.note || job.issue, scheduledAt: new Date(Date.now() + 2 * 86400000) })
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
  private async issueInvoice(orgId: string, type: string, lines: any[], meta: any = {}) {
    const subtotal = lines.reduce((s, l) => s + Number(l.amount || 0), 0)
    const tax = Math.round(subtotal * 0.0825 * 100) / 100
    const invoice = await this.invoices.create({ ref: `INV-${Date.now().toString().slice(-7)}`, orgId, type, lines, subtotal, tax, total: subtotal + tax, status: 'issued', dueAt: new Date(Date.now() + 14 * 86400000), ...meta })
    const payment = await this.payments.create({ orgId, invoiceId: invoice.id, provider: process.env.PAYMENTS_PROVIDER || 'simulator', providerRef: `SIM-${Date.now().toString().slice(-8)}`, amount: invoice.total, status: 'succeeded', method: 'card' })
    invoice.status = 'paid'; invoice.paidAt = new Date(); invoice.provider = payment.provider; await invoice.save()
    await this.audit.notify({ orgId, subject: `Payment received · ${invoice.ref}`, body: `$${invoice.total} paid via ${payment.provider}.` })
    return { invoice, payment }
  }

  async invoicesFor(user: any) { return this.invoices.find({ orgId: user.orgId }).sort({ createdAt: -1 }).lean() }
  async adminInvoices() { return this.invoices.find().sort({ createdAt: -1 }).lean() }
  async adminInvoicePdf(id: string) { const invoice = await this.invoices.findById(id).lean(); if (!invoice) throw new NotFoundException('Invoice not found'); const org = await this.orgs.findById(invoice.orgId).lean(); return this.pdf.invoice(invoice, org) }
  async invoicePdf(user: any, id: string) {
    const invoice = await this.invoices.findOne({ _id: id, orgId: user.orgId }).lean()
    if (!invoice) throw new NotFoundException('Invoice not found')
    const org = await this.orgs.findById(user.orgId).lean()
    return this.pdf.invoice(invoice, org)
  }
  async payInvoice(user: any, id: string) {
    const invoice = await this.invoices.findOne({ _id: id, orgId: user.orgId })
    if (!invoice) throw new NotFoundException('Invoice not found')
    if (invoice.status === 'paid') return invoice
    const payment = await this.payments.create({ orgId: user.orgId, invoiceId: id, provider: 'simulator', providerRef: `SIM-${Date.now()}`, amount: invoice.total, status: 'succeeded', method: 'card' })
    invoice.status = 'paid'; invoice.paidAt = new Date(); invoice.provider = payment.provider; await invoice.save()
    await this.audit.log(user, 'invoice.paid', 'invoice', id, { amount: invoice.total })
    return { invoice, payment }
  }
  async refundInvoice(admin: any, id: string, body: any) {
    const invoice = await this.invoices.findById(id)
    if (!invoice) throw new NotFoundException('Invoice not found')
    const payment = await this.payments.findOne({ invoiceId: id, status: 'succeeded' })
    if (!payment) throw new NotFoundException('Payment not found')
    const amount = Math.min(Number(body.amount || invoice.total), Number(payment.amount))
    const refund = await this.refunds.create({ orgId: invoice.orgId, paymentId: payment.id, invoiceId: id, amount, status: 'succeeded', reason: body.reason || 'Admin refund', createdBy: admin.sub })
    invoice.status = 'refunded'; await invoice.save()
    await this.audit.log(admin, 'invoice.refunded', 'invoice', id, { amount, reason: body.reason })
    await this.audit.notify({ orgId: invoice.orgId, subject: `Refund issued · ${invoice.ref}`, body: `$${amount} refunded.` })
    return { refund, invoice }
  }

  async reportPdf(user: any, id: string) {
    const report = await this.reports.findOne({ _id: id, orgId: user.orgId }).lean()
    if (!report) throw new NotFoundException('Report not found')
    const asset = await this.assets.findById(report.assetId).lean()
    return this.pdf.report(report, asset)
  }

  async comparison(user: any, id: string) {
    const current: any = await this.reports.findOne({ _id: id, orgId: user.orgId }).lean()
    if (!current) throw new NotFoundException('Report not found')
    const previous = await this.reports.findOne({ orgId: user.orgId, assetId: current.assetId, _id: { $ne: current._id }, createdAt: { $lt: current.createdAt } }).sort({ createdAt: -1 }).lean()
    if (!previous) return { current, previous: null, changes: [] }
    const prev = new Map((previous.anomalies || []).map((a: any) => [Math.round(Number(a.distanceM)), Number(a.depthPct)]))
    const changes = (current.anomalies || []).map((a: any) => {
      const before = prev.get(Math.round(Number(a.distanceM)))
      return { ...a, previousDepthPct: before ?? null, deltaPct: before != null ? +(Number(a.depthPct) - before).toFixed(2) : null }
    })
    return { current, previous, changes }
  }

  async rentalAvailability(productId: string, from: string, to: string) {
    const overlap = await this.rentals.findOne({ productId, status: { $in: ['reserved', 'active'] }, from: { $lte: new Date(to) }, to: { $gte: new Date(from) } }).lean()
    return { available: !overlap, conflict: overlap }
  }
  async pickupRental(user: any, id: string) {
    const rental = await this.rentals.findOne({ _id: id, orgId: user.orgId })
    if (!rental) throw new NotFoundException('Rental not found')
    rental.status = 'active'; rental.pickupAt = new Date(); await rental.save()
    await this.audit.log(user, 'rental.picked_up', 'rental', id)
    return rental
  }
  async returnRental(user: any, id: string, body: any) {
    const rental = await this.rentals.findOne({ _id: id, orgId: user.orgId })
    if (!rental) throw new NotFoundException('Rental not found')
    const lateDays = Math.max(0, Math.ceil((Date.now() - new Date(rental.to).getTime()) / 86400000))
    const lateFee = lateDays * 75
    rental.status = 'returned'; rental.returnedAt = new Date(); rental.returnNotes = body.notes || ''; rental.lateFee = lateFee; rental.depositStatus = lateFee > 0 ? 'partially_refunded' : 'refunded'; await rental.save()
    if (lateFee > 0) await this.issueInvoice(user.orgId, 'rental_late_fee', [{ description: `Late return · ${rental.productName}`, qty: lateDays, amount: lateFee }])
    await this.audit.log(user, 'rental.returned', 'rental', id, { lateDays, lateFee })
    return rental
  }

  async contractorProfile(user: any) {
    const org = await this.orgs.findById(user.orgId).lean()
    let profile: any = await this.contractorProfiles.findOne({ orgId: user.orgId }).lean()
    if (!profile) profile = await this.contractorProfiles.create({ orgId: user.orgId, verificationStatus: 'pending', serviceAreas: ['Houston'], capabilities: [] })
    return { profile, org }
  }
  async saveContractorProfile(user: any, body: any) {
    return this.contractorProfiles.findOneAndUpdate({ orgId: user.orgId }, { $set: { licenseNumber: body.licenseNumber, insuranceProvider: body.insuranceProvider, insuranceExpiry: body.insuranceExpiry ? new Date(body.insuranceExpiry) : undefined, serviceAreas: body.serviceAreas || [], capabilities: body.capabilities || [], acceptingJobs: body.acceptingJobs !== false, verificationStatus: 'submitted' } }, { upsert: true, new: true })
  }
  async workOrdersFor(user: any) { return this.workOrders.find(user.role === 'contractor' ? { contractorOrgId: user.orgId } : {}).sort({ createdAt: -1 }).lean() }
  async completeWorkOrder(user: any, id: string, body: any) {
    const wo = await this.workOrders.findById(id)
    if (!wo) throw new NotFoundException('Work order not found')
    if (user.role !== 'admin' && wo.contractorOrgId !== user.orgId) throw new NotFoundException('Work order not found')
    wo.status = 'completed'; wo.completionNotes = body.notes || ''; wo.completionPhotos = body.photos || []; await wo.save()
    await this.jobs.findByIdAndUpdate(wo.jobId, { status: 'complete', completionNotes: body.notes, completionPhotos: body.photos || [] })
    await this.audit.log(user, 'work_order.completed', 'work_order', id)
    return wo
  }
  async verifyWorkOrder(admin: any, id: string) {
    const wo = await this.workOrders.findById(id)
    if (!wo) throw new NotFoundException('Work order not found')
    wo.status = 'verified'; wo.verifiedAt = new Date(); wo.verifiedBy = admin.name; await wo.save()
    await this.jobs.findByIdAndUpdate(wo.jobId, { status: 'complete', verifiedAt: new Date() })
    const escrow = await this.escrows.findOne({ jobId: wo.jobId })
    if (escrow) { escrow.milestones = escrow.milestones.map((m: any) => ({ ...m, status: 'released' })); escrow.status = 'released'; escrow.markModified('milestones'); await escrow.save() }
    await this.contractorProfiles.findOneAndUpdate({ orgId: wo.contractorOrgId }, { $inc: { completedJobs: 1 } })
    await this.audit.log(admin, 'work_order.verified', 'work_order', id)
    await this.audit.notify({ orgId: wo.contractorOrgId, subject: 'Work verified and released', body: `Work order ${id} was verified. Escrow released.` })
    return wo
  }

  async manufacturerOverview(user: any) {
    const org = await this.orgs.findById(user.orgId).lean()
    const products = await this.productModel.find({ vendor: org?.name }).lean()
    const partner = await this.manufacturers.findOne({ name: org?.name }).lean()
    return { org, products, partner }
  }
  async manufacturerProducts(user: any) {
    const org = await this.orgs.findById(user.orgId).lean()
    return this.productModel.find({ vendor: org?.name }).lean()
  }
  async updateManufacturerProduct(user: any, id: string, body: any) {
    const org = await this.orgs.findById(user.orgId).lean()
    return this.productModel.findOneAndUpdate({ _id: id, vendor: org?.name }, { $set: { priceUsd: body.priceUsd, stock: body.stock, active: body.active, leadTime: body.leadTime, description: body.description } }, { new: true })
  }
  async createManufacturerProduct(user: any, body: any) {
    const org = await this.orgs.findById(user.orgId).lean()
    const slug = String(body.name || 'product').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now().toString().slice(-4)
    return this.productModel.create({ ...body, slug, sku: body.sku || `VTK-${Date.now().toString().slice(-6)}`, vendor: org?.name, active: true, image: body.image || 'six-inch-pig' })
  }
  async applyPartner(body: any) {
    const lead = await this.leads.create({ name: body.name, email: body.email, company: body.company, type: 'manufacturer', message: body.message, source: 'partner-application' })
    await this.manufacturers.create({ name: body.company || body.name, contact: body.email, status: 'pending', plan: 'starter', monthlyFee: 450, listings: 0 })
    return lead
  }
  async approveManufacturer(admin: any, id: string) {
    const partner = await this.manufacturers.findByIdAndUpdate(id, { status: 'verified' }, { new: true })
    await this.audit.log(admin, 'manufacturer.approved', 'manufacturer', id)
    return partner
  }

  async myNotifications(user: any) { return this.notifications.find({ $or: [{ userId: user.sub }, { orgId: user.orgId, userId: '' }] }).sort({ createdAt: -1 }).limit(30).lean() }
  async readNotification(user: any, id: string) { await this.notifications.updateOne({ _id: id }, { $set: { readAt: new Date() } }); return { ok: true } }
  async adminAudit() { return this.audit.listAudit() }
  async adminNotifications() { return this.audit.listNotifications() }
  async adminContractors(): Promise<any> { const profiles = await this.contractorProfiles.find().sort({ createdAt: -1 }).lean(); const orgs = await this.orgs.find().lean(); return profiles.map(p => ({ ...p, org: orgs.find(o => o._id.toString() === p.orgId) })) }
  async verifyContractor(admin: any, id: string, body: any) { const res = await this.contractorProfiles.findByIdAndUpdate(id, { $set: { verificationStatus: body.status || 'verified' } }, { new: true }); await this.audit.log(admin, 'contractor.verified', 'contractor_profile', id, body); return res }
  async adminUsers() { return this.users.find().select('-passwordHash').sort({ createdAt: -1 }).lean() }
  async updateUser(admin: any, id: string, body: any) { const res = await this.users.findByIdAndUpdate(id, { $set: { role: body.role, active: body.active } }, { new: true }).select('-passwordHash').lean(); await this.audit.log(admin, 'user.updated', 'user', id, body); return res }
  async settingsList() { return this.settings.find().lean() }
  async setSetting(admin: any, key: string, value: any) { const res = await this.settings.findOneAndUpdate({ key }, { $set: { value } }, { upsert: true, new: true }); await this.audit.log(admin, 'setting.updated', 'setting', key); return res }

}
