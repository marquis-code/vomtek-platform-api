import { Body, Controller, Get, Post, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import * as bcrypt from 'bcryptjs'
import { IsEmail, IsString, MinLength } from 'class-validator'
import { Organization, User, Doc } from './schemas/entities'
import { AuthUser, CurrentUser, JwtAuthGuard, Public } from './auth'
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

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@CurrentUser() user: AuthUser) {
    const org = await this.orgs.findById(user.orgId)
    return { user: { ...user, orgType: org?.type, plan: org?.plan } }
  }
}
