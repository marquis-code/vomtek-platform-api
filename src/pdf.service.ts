import { Injectable } from '@nestjs/common'
import PDFDocument from 'pdfkit'

@Injectable()
export class PdfService {
  async report(report: any, asset: any): Promise<Buffer> {
    return this.build((doc) => {
      this.header(doc, 'VOMTEK · INTEGRITY REPORT', report.ref)
      doc.fontSize(22).fillColor('#07100e').text(asset?.name || 'Pipeline asset', { continued: false })
      doc.moveDown(0.2).fontSize(9).fillColor('#6b766f').text(`${asset?.location || ''} · ${asset?.diameterMm || ''} mm OD · ${asset?.lengthKm || ''} km · MAOP ${asset?.maopKpa || ''} kPa`)
      doc.moveDown(1.2)
      this.metrics(doc, [
        ['Deepest loss', `${report.maxDepthPct}%`], ['Corrosion rate', `${report.cgr} mm/y`],
        ['Safe pressure', `${(Number(report.safePressureKpa) / 1000).toFixed(1)} MPa`], ['Remaining life', `${report.remainingLifeYears} y`],
      ])
      doc.moveDown(1.4).fontSize(11).fillColor('#c83b09').text(`RISK: ${String(report.risk).toUpperCase()}`)
      doc.moveDown(0.4).fontSize(10).fillColor('#07100e').text(report.summary, { lineGap: 3 })
      doc.moveDown(1.2).fontSize(9).fillColor('#6b766f').text('ANOMALY REGISTER')
      doc.moveDown(0.4)
      const cols = [50, 85, 80, 70, 85]
      let y = doc.y
      const rows = (report.anomalies || []).slice(0, 30)
      doc.fontSize(7.5).fillColor('#6b766f')
      ;['ID', 'Distance', 'Type', 'Depth', 'B31G'].forEach((h, i) => doc.text(h, cols.slice(0, i).reduce((a, b) => a + b, 0) + 40, y, { width: cols[i] }))
      y += 14
      doc.fillColor('#07100e')
      for (const a of rows) {
        if (y > 720) { doc.addPage(); y = 50 }
        const vals = [a.id, `${(Number(a.distanceM) / 1000).toFixed(2)} km`, String(a.type).slice(0, 18), `${a.depthPct}%`, Number(a.safePressureKpa) >= Number(asset?.maopKpa) ? 'Acceptable' : 'Below MAOP']
        vals.forEach((v, i) => doc.text(v, cols.slice(0, i).reduce((s, b) => s + b, 0) + 40, y, { width: cols[i] }))
        y += 14
      }
      doc.fontSize(7).fillColor('#78857c').text('Screening calculation only. A qualified integrity engineer must review before pressure or repair decisions.', 40, 760, { width: 500 })
    })
  }

  async invoice(invoice: any, org: any): Promise<Buffer> {
    return this.build((doc) => {
      this.header(doc, 'VOMTEK · INVOICE', invoice.ref)
      doc.fontSize(20).fillColor('#07100e').text(org?.name || 'Vomtek customer')
      doc.fontSize(9).fillColor('#6b766f').text(`Issued ${new Date(invoice.createdAt || Date.now()).toLocaleDateString('en-US')} · Due ${new Date(invoice.dueAt || Date.now()).toLocaleDateString('en-US')} · ${invoice.status.toUpperCase()}`)
      doc.moveDown(1.5)
      doc.fontSize(10).fillColor('#07100e')
      const items = invoice.lines || []
      let y = doc.y
      doc.fontSize(8).fillColor('#6b766f').text('DESCRIPTION', 40, y).text('QTY', 360, y).text('AMOUNT', 430, y, { align: 'right', width: 120 })
      y += 16
      for (const line of items) {
        doc.fillColor('#07100e').fontSize(9).text(line.description || 'Line item', 40, y, { width: 300 }).text(String(line.qty || 1), 360, y).text(`$${Number(line.amount || 0).toLocaleString()}`, 430, y, { align: 'right', width: 120 })
        y += 18
      }
      doc.moveTo(40, y + 8).lineTo(550, y + 8).strokeColor('#d8d3c6').stroke()
      y += 22
      doc.fontSize(9).fillColor('#6b766f').text('Subtotal', 360, y).text(`$${Number(invoice.subtotal || 0).toLocaleString()}`, 430, y, { align: 'right', width: 120 })
      y += 14
      doc.text('Tax', 360, y).text(`$${Number(invoice.tax || 0).toLocaleString()}`, 430, y, { align: 'right', width: 120 })
      y += 18
      doc.fontSize(13).fillColor('#07100e').text('Total', 360, y).text(`$${Number(invoice.total || 0).toLocaleString()}`, 430, y, { align: 'right', width: 120 })
      doc.fontSize(8).fillColor('#78857c').text('Vomtek platform invoice. Payment and refund records are available in Studio.', 40, 740)
    })
  }

  private header(doc: PDFKit.PDFDocument, label: string, ref: string) {
    doc.fillColor('#07100e').rect(0, 0, 612, 8).fill()
    doc.fontSize(8).fillColor('#0b6b4e').text(label, 40, 36)
    doc.fontSize(8).fillColor('#78857c').text(ref, 440, 36, { align: 'right', width: 132 })
    doc.moveTo(40, 52).lineTo(572, 52).strokeColor('#d8d3c6').stroke()
    doc.y = 70
  }

  private metrics(doc: PDFKit.PDFDocument, items: [string, string][]) {
    const y = doc.y
    items.forEach((item, i) => {
      const x = 40 + i * 132
      doc.fontSize(7).fillColor('#78857c').text(item[0].toUpperCase(), x, y, { width: 120 })
      doc.fontSize(16).fillColor('#07100e').text(item[1], x, y + 12, { width: 120 })
    })
    doc.y = y + 44
  }

  private build(paint: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'LETTER', margin: 40 })
      const chunks: Buffer[] = []
      doc.on('data', (chunk: Buffer) => chunks.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)
      paint(doc)
      doc.end()
    })
  }
}
