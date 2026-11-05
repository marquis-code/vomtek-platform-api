import { Body, Controller, Get, Post, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import * as bcrypt from 'bcryptjs'
import { IsEmail, IsString, MinLength } from 'class-validator'
import { Organization, PasswordReset, User, Doc } from './schemas/entities'
import { AuthUser, CurrentUser, JwtAuthGuard, Public } from './auth'
import { randomUUID } from 'crypto'
import { UseGuards } from '@nestjs/common'

class LoginDto {
  @IsEmail() email: string
  @IsString() @MinLength(6) password: string
}

@Controller('auth')
export class AuthController {
  constructor(
    @InjectModel(User.name) private users: Model<Doc<User>>,
    @InjectModel(Organization.name) private orgs: Model<Doc<Organization>>,
    @InjectModel(PasswordReset.name) private resets: Model<Doc<PasswordReset>>,
    private jwt: JwtService,
  ) {}

  @Public()
  @Post('login')
  async login(@Body() dto: LoginDto) {
    const user = await this.users.findOne({ email: dto.email.toLowerCase(), active: true })
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) throw new UnauthorizedException('Invalid email or password')
    const org = await this.orgs.findById(user.orgId)
    const payload: AuthUser = { sub: user.id, email: user.email, name: user.name, role: user.role, orgId: user.orgId, orgName: org?.name }
    user.lastLoginAt = new Date()
    await user.save()
    return { token: await this.jwt.signAsync(payload, { expiresIn: '7d' }), user: { ...payload, orgType: org?.type, plan: org?.plan } }
  }

  @Public()
  @Post('register')
  async register(@Body() body: any) {
    const email = String(body.email || '').toLowerCase()
    if (await this.users.findOne({ email })) throw new UnauthorizedException('An account with this email already exists')
    const type = body.type || 'operator'
    const name = body.orgName || `${body.name}'s account`
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now().toString().slice(-4)
    const org = await this.orgs.create({ name, slug, type, plan: 'none', status: 'active' })
    const user = await this.users.create({ email, name: body.name, passwordHash: await bcrypt.hash(body.password, 12), role: type === 'homeowner' ? 'homeowner' : type === 'contractor' ? 'contractor' : type === 'manufacturer' ? 'manufacturer' : 'owner', orgId: org.id })
    const payload: AuthUser = { sub: user.id, email: user.email, name: user.name, role: user.role, orgId: org.id, orgName: org.name }
    return { token: await this.jwt.signAsync(payload, { expiresIn: '7d' }), user: { ...payload, orgType: org.type } }
  }

  @Public()
  @Post('forgot')
  async forgot(@Body() body: any) {
    const user = await this.users.findOne({ email: String(body.email || '').toLowerCase() })
    if (!user) return { ok: true }
    const token = randomUUID()
    await this.resets.create({ userId: user.id, token, expiresAt: new Date(Date.now() + 3600000) })
    return { ok: true, resetToken: process.env.NODE_ENV === 'production' ? undefined : token }
  }

  @Public()
  @Post('reset')
  async reset(@Body() body: any) {
    const reset = await this.resets.findOne({ token: body.token, used: false, expiresAt: { $gt: new Date() } })
    if (!reset) throw new UnauthorizedException('Reset link is invalid or expired')
    const user = await this.users.findById(reset.userId)
    if (!user) throw new UnauthorizedException('Account not found')
    user.passwordHash = await bcrypt.hash(body.password, 12); await user.save()
    reset.used = true; await reset.save()
    return { ok: true }
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@CurrentUser() user: AuthUser) {
    const org = await this.orgs.findById(user.orgId)
    return { user: { ...user, orgType: org?.type, plan: org?.plan } }
  }
}
