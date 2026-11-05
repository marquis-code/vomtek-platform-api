import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { AuditLog, Doc, Notification } from './schemas/entities'

@Injectable()
export class AuditService {
  constructor(
    @InjectModel(AuditLog.name) private auditModel: Model<Doc<AuditLog>>,
    @InjectModel(Notification.name) private notificationModel: Model<Doc<Notification>>,
  ) {}

  async log(user: any, action: string, entity: string, entityId: string, meta: Record<string, unknown> = {}) {
    return this.auditModel.create({ orgId: user?.orgId || '', userId: user?.sub || '', action, entity, entityId, meta })
  }

  async notify(data: { orgId?: string; userId?: string; subject: string; body?: string; channel?: string }) {
    return this.notificationModel.create({ ...data, status: 'queued' })
  }

  async listAudit() { return this.auditModel.find().sort({ createdAt: -1 }).limit(100).lean() }
  async listNotifications() { return this.notificationModel.find().sort({ createdAt: -1 }).limit(100).lean() }
}
