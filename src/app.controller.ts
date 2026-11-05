import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common'
import { AppService } from './app.service'
import { AuthUser, CurrentUser, JwtAuthGuard, Public, Roles, RolesGuard } from './auth'

@Controller()
export class PublicController {
  constructor(private app: AppService) {}
  @Public() @Get('health') health() { return { status: 'ok', service: 'linesight-api', at: new Date().toISOString() } }
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
  @Get('reports/:id') report(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.app.report(user, id) }
  @Get('orders') orders(@CurrentUser() user: AuthUser) { return this.app.ordersFor(user) }
  @Post('orders') order(@CurrentUser() user: AuthUser, @Body() body: any) { return this.app.createOrder(user, body) }
  @Get('rentals') rentals(@CurrentUser() user: AuthUser) { return this.app.rentalsFor(user) }
  @Post('rentals') rental(@CurrentUser() user: AuthUser, @Body() body: any) { return this.app.createRental(user, body) }
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
  @Post('products/:id') updateProduct(@Param('id') id: string, @Body() body: any) { return this.app.updateProduct(id, body) }
  @Post('jobs/:id/status') updateJob(@Param('id') id: string, @Body() body: any) { return this.app.updateJob(id, body) }
  @Post('orders/:id/status') updateOrder(@Param('id') id: string, @Body() body: any) { return this.app.updateOrder(id, body) }
  @Post('rentals/:id/status') updateRental(@Param('id') id: string, @Body() body: any) { return this.app.updateRental(id, body) }
  @Post('leads/:id/status') updateLead(@Param('id') id: string, @Body() body: any) { return this.app.updateLead(id, body) }
}
