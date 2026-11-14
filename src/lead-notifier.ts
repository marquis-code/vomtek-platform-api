import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import nodemailer from 'nodemailer'

type Delivery = 'sent' | 'queued' | 'not_configured' | 'failed'

@Injectable()
export class LeadNotifier {
  private readonly log = new Logger(LeadNotifier.name)

  constructor(private config: ConfigService) {}

  private message(lead: any) {
    return [
      'New Vomtek website enquiry',
      '',
      `Name: ${lead.name || '—'}`,
      `Email: ${lead.email || '—'}`,
      `Company: ${lead.company || '—'}`,
      `Division: ${lead.type || '—'}`,
      `Source: ${lead.source || 'website'}`,
      '',
      'Message:',
      lead.message || '—',
      '',
      `Received: ${new Date().toISOString()}`,
    ].join('\n')
  }

  async deliver(lead: any): Promise<{ email: Delivery; whatsapp: Delivery; errors: string[] }> {
    const text = this.message(lead)
    const [email, whatsapp] = await Promise.all([this.sendEmail(lead, text), this.sendWhatsApp(text)])
    return { email: email.status, whatsapp: whatsapp.status, errors: [email.error, whatsapp.error].filter(Boolean) as string[] }
  }

  private async sendEmail(lead: any, text: string): Promise<{ status: Delivery; error?: string }> {
    const host = this.config.get<string>('SMTP_HOST')
    const user = this.config.get<string>('SMTP_USER')
    const pass = this.config.get<string>('SMTP_PASS')
    const to = this.config.get<string>('LEAD_NOTIFY_EMAIL')
    if (!host || !user || !pass || !to) {
      this.log.warn('Lead email not sent: SMTP_HOST, SMTP_USER, SMTP_PASS or LEAD_NOTIFY_EMAIL is missing')
      return { status: 'not_configured' }
    }
    try {
      const transporter = nodemailer.createTransport({
        host,
        port: Number(this.config.get('SMTP_PORT') || 587),
        secure: String(this.config.get('SMTP_SECURE') || 'false') === 'true',
        auth: { user, pass },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
      })
      await transporter.sendMail({
        from: this.config.get('SMTP_FROM') || user,
        to,
        replyTo: lead.email,
        subject: `New website enquiry — ${lead.name || lead.email}`,
        text,
      })
      return { status: 'sent' }
    } catch (error: any) {
      this.log.error(`Lead email failed: ${error?.message || error}`)
      return { status: 'failed', error: error?.message || 'Email delivery failed' }
    }
  }

  private async sendWhatsApp(text: string): Promise<{ status: Delivery; error?: string }> {
    const token = this.config.get<string>('WHATSAPP_ACCESS_TOKEN')
    const phoneId = this.config.get<string>('WHATSAPP_PHONE_NUMBER_ID')
    const to = this.config.get<string>('WHATSAPP_TO')?.replace(/\D/g, '')
    if (!token || !phoneId || !to) {
      this.log.warn('Lead WhatsApp not sent: WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_TO is missing')
      return { status: 'not_configured' }
    }
    try {
      const version = this.config.get('WHATSAPP_API_VERSION') || 'v23.0'
      const template = this.config.get('WHATSAPP_TEMPLATE_NAME')
      const language = this.config.get('WHATSAPP_TEMPLATE_LANG') || 'en_US'
      const body: any = template
        ? {
            messaging_product: 'whatsapp',
            to,
            type: 'template',
            template: { name: template, language: { code: language }, components: [{ type: 'body', parameters: [{ type: 'text', text }] }] },
          }
        : { messaging_product: 'whatsapp', to, type: 'text', text: { preview_url: false, body: text.slice(0, 4000) } }
      const response = await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(12000),
      })
      if (!response.ok) throw new Error(`WhatsApp API returned ${response.status}: ${(await response.text()).slice(0, 300)}`)
      return { status: 'sent' }
    } catch (error: any) {
      this.log.error(`Lead WhatsApp failed: ${error?.message || error}`)
      return { status: 'failed', error: error?.message || 'WhatsApp delivery failed' }
    }
  }
}
