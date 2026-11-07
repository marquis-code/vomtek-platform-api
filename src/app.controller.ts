import { Body, Controller, Get, Param, Post, Query, StreamableFile, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { diskStorage } from 'multer'
import { mkdirSync, readFileSync } from 'fs'
import { join, extname } from 'path'
import { AppService } from './app.service'
import { AuthUser, CurrentUser, JwtAuthGuard, Public, Roles, RolesGuard } from './auth'

const uploadStorage = diskStorage({
  destination: (_req, _file, cb) => { const dir = process.env.UPLOAD_DIR || join(process.cwd(), 'uploads'); mkdirSync(dir, { recursive: true }); cb(null, dir) },
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${extname(file.originalname) || '.csv'}`),
})

function parseCsv(text: string) {
  const lines = text.trim().split(/\r?\n/); const head = lines.shift()?.split(',').map(h => h.trim().toLowerCase()) || []
  const find = (...names: string[]) => names.map(n => head.indexOf(n)).find(i => i >= 0) ?? -1
  const distance = find('distance_m', 'distance', 'distancem'); const depth = find('depth_pct', 'depth', 'depthpct')
  if (distance < 0 || depth < 0) throw new Error('CSV requires distance_m and depth_pct columns')
  const length = find('length_mm', 'length', 'lengthmm'); const width = find('width_mm', 'width', 'widthmm'); const type = find('type', 'anomaly_type')
  return lines.filter(Boolean).slice(0, 5000).map(line => { const c = line.split(','); return { distanceM: Number(c[distance]), depthPct: Number(c[depth]), lengthMm: length >= 0 ? Number(c[length]) : 40, widthMm: width >= 0 ? Number(c[width]) : 20, type: type >= 0 ? c[type] : 'Metal loss' } })
}

@Controller()
export class PublicController {
  constructor(private app: AppService) {}
  @Public() @Get('health') health() { return { status: 'ok', service: 'vomtek-platform-api', at: new Date().toISOString() } }
  @Public() @Get('public/stats') stats() { return this.app.publicStats() }
  @Public() @Get('catalog/products') products(@Query() q: any) { return this.app.products(q) }
  @Public() @Get('catalog/products/:slug') product(@Param('slug') slug: string) { return this.app.product(slug) }
  @Public() @Get('plans') plans() { return this.app.plans() }
  @Public() @Post('configurator') recommend(@Body() body: any) { return this.app.recommend(body) }
  @Public() @Post('leads') lead(@Body() body: any) { return this.app.createLead(body) }
}

@UseGuards(JwtAuthGuard)
@Controller('portal')
export class PortalController {
  constructor(private app: AppService) {}
  @Get('overview') overview(@CurrentUser() user: AuthUser) { return this.app.overview(user) }
  @Get('assets') assets(@CurrentUser() user: AuthUser) { return this.app.assetsFor(user) }
  @Post('assets') createAsset(@CurrentUser() user: AuthUser, @Body() body: any) { return this.app.createAsset(user, body) }
  @Get('inspections') inspections(@CurrentUser() user: AuthUser) { return this.app.inspections(user) }
  @Post('inspections') run(@CurrentUser() user: AuthUser, @Body() body: any) { return this.app.runInspection(user, body) }
  @Post('inspections/upload')
  @UseInterceptors(FileInterceptor('file', { storage: uploadStorage, limits: { fileSize: 15 * 1024 * 1024 } }))
  upload(@CurrentUser() user: AuthUser, @UploadedFile() file: any, @Body() body: any) {
    if (!file) throw new Error('A CSV file is required')
    const rows = parseCsv(readFileSync(file.path, 'utf8'))
    return this.app.runInspection(user, { ...body, fileName: file.originalname, filePath: file.path, rows })
  }
  @Get('reports/:id') report(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.app.report(user, id) }
  @Get('reports/:id/pdf') async reportPdf(@CurrentUser() user: AuthUser, @Param('id') id: string) { const buffer = await this.app.reportPdf(user, id); return new StreamableFile(buffer, { type: 'application/pdf', disposition: `attachment; filename="vomtek-report-${id}.pdf"` }) }
  @Get('reports/:id/comparison') comparison(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.app.comparison(user, id) }
  @Get('invoices') invoices(@CurrentUser() user: AuthUser) { return this.app.invoicesFor(user) }
  @Get('invoices/:id/pdf') async invoicePdf(@CurrentUser() user: AuthUser, @Param('id') id: string) { const buffer = await this.app.invoicePdf(user, id); return new StreamableFile(buffer, { type: 'application/pdf', disposition: `attachment; filename="vomtek-invoice-${id}.pdf"` }) }
  @Post('invoices/:id/pay') payInvoice(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.app.payInvoice(user, id) }
  @Get('orders') orders(@CurrentUser() user: AuthUser) { return this.app.ordersFor(user) }
  @Post('orders') order(@CurrentUser() user: AuthUser, @Body() body: any) { return this.app.createOrder(user, body) }
  @Get('rentals') rentals(@CurrentUser() user: AuthUser) { return this.app.rentalsFor(user) }
  @Post('rentals') rental(@CurrentUser() user: AuthUser, @Body() body: any) { return this.app.createRental(user, body) }
  @Get('rentals/availability') availability(@Query('productId') productId: string, @Query('from') from: string, @Query('to') to: string) { return this.app.rentalAvailability(productId, from, to) }
  @Post('rentals/:id/pickup') pickup(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.app.pickupRental(user, id) }
  @Post('rentals/:id/return') returnRental(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: any) { return this.app.returnRental(user, id, body) }
  @Get('notifications') notifications(@CurrentUser() user: AuthUser) { return this.app.myNotifications(user) }
  @Post('notifications/:id/read') readNotification(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.app.readNotification(user, id) }
  @Get('contractor/profile') contractor(@CurrentUser() user: AuthUser) { return this.app.contractorProfile(user) }
  @Post('contractor/profile') saveContractor(@CurrentUser() user: AuthUser, @Body() body: any) { return this.app.saveContractorProfile(user, body) }
  @Get('contractor/work-orders') workOrders(@CurrentUser() user: AuthUser) { return this.app.workOrdersFor(user) }
  @Post('work-orders/:id/complete') complete(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: any) { return this.app.completeWorkOrder(user, id, body) }
  @Get('partner/overview') manufacturer(@CurrentUser() user: AuthUser) { return this.app.manufacturerOverview(user) }
  @Get('partner/products') manufacturerProducts(@CurrentUser() user: AuthUser) { return this.app.manufacturerProducts(user) }
  @Post('partner/products') createManufacturerProduct(@CurrentUser() user: AuthUser, @Body() body: any) { return this.app.createManufacturerProduct(user, body) }
  @Post('partner/products/:id') updateManufacturerProduct(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: any) { return this.app.updateManufacturerProduct(user, id, body) }
  @Get('subscription') subscription(@CurrentUser() user: AuthUser) { return this.app.subscription(user) }
  @Post('subscription') subscribe(@CurrentUser() user: AuthUser, @Body() body: any) { return this.app.subscribe(user, body) }
  @Get('jobs') jobs(@CurrentUser() user: AuthUser) { return this.app.jobsFor(user) }
  @Post('jobs') createJob(@CurrentUser() user: AuthUser, @Body() body: any) { return this.app.createJob(user, body) }
  @Get('jobs/:id') job(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.app.job(user, id) }
  @Post('jobs/:id/analyze') analyze(@Param('id') id: string) { return this.app.analyzeJob(id) }
  @Post('jobs/:id/bids') bid(@Param('id') id: string, @CurrentUser() user: AuthUser, @Body() body: any) { return this.app.addBid(id, user, body) }
  @Post('jobs/:id/award') award(@Param('id') id: string, @Body() body: any) { return this.app.award(id, body) }
  @Post('escrow/:jobId/release') release(@Param('jobId') jobId: string, @Body() body: any) { return this.app.releaseMilestone(jobId, body) }
  @Get('contractor/opportunities') opportunities(@CurrentUser() user: AuthUser) { return this.app.jobsFor(user) }
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('owner', 'admin', 'ops')
@Controller('admin')
export class AdminController {
  constructor(private app: AppService) {}
  @Get('overview') overview() { return this.app.adminOverview() }
  @Get('orgs') orgs() { return this.app.adminOrgs() }
  @Get('orders') orders() { return this.app.adminOrders() }
  @Get('rentals') rentals() { return this.app.adminRentals() }
  @Get('reports') reports() { return this.app.adminReports() }
  @Get('jobs') jobs() { return this.app.adminJobs() }
  @Get('products') products() { return this.app.adminProducts() }
  @Get('plans') plans() { return this.app.adminPlans() }
  @Get('subscriptions') subs() { return this.app.adminSubs() }
  @Get('manufacturers') manufacturers() { return this.app.adminManufacturers() }
  @Get('leads') leads() { return this.app.adminLeads() }
  @Get('invoices') invoices() { return this.app.adminInvoices() }
  @Get('invoices/:id/pdf') async invoicePdf(@Param('id') id: string) { const buffer = await this.app.adminInvoicePdf(id); return new StreamableFile(buffer, { type: 'application/pdf', disposition: `attachment; filename="vomtek-invoice-${id}.pdf"` }) }
  @Post('invoices/:id/refund') refund(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: any) { return this.app.refundInvoice(user, id, body) }
  @Get('work-orders') workOrders() { return this.app.workOrdersFor({ role: 'admin' }) }
  @Post('work-orders/:id/verify') verify(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.app.verifyWorkOrder(user, id) }
  @Get('users') users() { return this.app.adminUsers() }
  @Get('contractors') contractors() { return this.app.adminContractors() }
  @Post('contractors/:id/verify') verifyContractor(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: any) { return this.app.verifyContractor(user, id, body) }
  @Post('users/:id') updateUser(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: any) { return this.app.updateUser(user, id, body) }
  @Get('audit') audit() { return this.app.adminAudit() }
  @Get('notifications') notifications() { return this.app.adminNotifications() }
  @Get('settings') settings() { return this.app.settingsList() }
  @Post('settings/:key') setSetting(@CurrentUser() user: AuthUser, @Param('key') key: string, @Body() body: any) { return this.app.setSetting(user, key, body.value) }
  @Post('manufacturers/:id/approve') approve(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.app.approveManufacturer(user, id) }
  @Post('products/:id') updateProduct(@Param('id') id: string, @Body() body: any) { return this.app.updateProduct(id, body) }
  @Post('jobs/:id/status') updateJob(@Param('id') id: string, @Body() body: any) { return this.app.updateJob(id, body) }
  @Post('orders/:id/status') updateOrder(@Param('id') id: string, @Body() body: any) { return this.app.updateOrder(id, body) }
  @Post('rentals/:id/status') updateRental(@Param('id') id: string, @Body() body: any) { return this.app.updateRental(id, body) }
  @Post('leads/:id/status') updateLead(@Param('id') id: string, @Body() body: any) { return this.app.updateLead(id, body) }
}
