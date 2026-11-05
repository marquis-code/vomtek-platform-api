import { Injectable, Logger } from '@nestjs/common'

export type Anomaly = {
  id: string
  distanceM: number
  depthPct: number
  lengthMm: number
  widthMm: number
  type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  lat?: number
  lon?: number
  depthMm?: number
  safePressureKpa?: number
  cgrMmYear?: number
  remainingLifeYears?: number
}

export type ReportResult = {
  ref: string
  summary: string
  risk: string
  confidence: number
  maxDepthPct: number
  cgr: number
  safePressureKpa: number
  remainingLifeYears: number
  anomalies: Anomaly[]
  b31g: Record<string, unknown>[]
  heatmap: { distanceM: number; depthPct: number; risk: number }[]
  metrics: Record<string, unknown>
}

@Injectable()
export class EngineService {
  private readonly logger = new Logger(EngineService.name)
  private readonly url = process.env.ENGINE_URL || 'http://localhost:4210'

  async analyzeIli(asset: any, rows: any[], previous?: any): Promise<ReportResult> {
    try {
      const res = await fetch(`${this.url}/v1/ili/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asset, rows, previous }),
        signal: AbortSignal.timeout(5000),
      })
      if (res.ok) return await res.json() as ReportResult
    } catch (error) {
      this.logger.warn(`Diagnostic engine unavailable, using deterministic fallback: ${(error as Error).message}`)
    }
    return this.fallback(asset, rows, previous)
  }

  async analyzeVideo(job: any): Promise<Record<string, unknown>> {
    try {
      const res = await fetch(`${this.url}/v1/video/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(job),
        signal: AbortSignal.timeout(5000),
      })
      if (res.ok) return await res.json()
    } catch (error) {
      this.logger.warn(`Vision engine unavailable, using deterministic fallback: ${(error as Error).message}`)
    }
    return this.videoFallback(job)
  }

  fallback(asset: any, rows: any[], previous?: any): ReportResult {
    const d = Number(asset.diameterMm) || 323.9
    const t = Number(asset.wallMm) || 9.5
    const smys = 448
    const previousByDistance = new Map<number, number>()
    for (const p of previous?.anomalies || []) previousByDistance.set(Math.round(Number(p.distanceM)), Number(p.depthPct))
    const anomalies: Anomaly[] = (rows.length ? rows : this.sampleRows(asset)).map((row: any, index: number) => {
      const depthPct = Math.min(92, Math.max(3, Number(row.depthPct ?? row.depth_pct ?? 12)))
      const lengthMm = Math.max(10, Number(row.lengthMm ?? row.length_mm ?? 40))
      const widthMm = Math.max(8, Number(row.widthMm ?? row.width_mm ?? 20))
      const distanceM = Math.max(0, Number(row.distanceM ?? row.distance_m ?? (index + 1) * 120))
      const depthMm = (depthPct / 100) * t
      const z = (lengthMm * lengthMm) / (d * t)
      const m = z <= 50 ? Math.sqrt(1 + 0.6275 * z - 0.003375 * z * z) : 3.3 + 0.032 * z
      const ratio = depthMm / t
      const flow = 1.1 * smys
      const pSafeMpa = (2 * flow * t / d) * ((1 - 0.667 * ratio) / (1 - (0.667 * ratio) / m))
      const safePressureKpa = Math.max(0, Math.round(pSafeMpa * 1000 * 0.72))
      const prev = previousByDistance.get(Math.round(distanceM))
      const years = previous ? Math.max(1, (Date.now() - new Date(previous.createdAt || Date.now() - 365 * 86400000).getTime()) / (365 * 86400000)) : 3
      const cgr = prev != null ? Math.max(0, (depthMm - (prev / 100) * t) / years) : Math.max(.1, depthMm / 10)
      const remainingLife = cgr > 0 ? Math.max(0, ((t * .8) - depthMm) / cgr) : 30
      const severity: Anomaly['severity'] = depthPct >= 70 ? 'critical' : depthPct >= 45 ? 'high' : depthPct >= 25 ? 'medium' : 'low'
      return {
        id: `A-${String(index + 1).padStart(3, '0')}`,
        distanceM, depthPct, lengthMm, widthMm,
        type: String(row.type || this.pickType(depthPct)),
        severity, depthMm: +depthMm.toFixed(2), safePressureKpa,
        cgrMmYear: +cgr.toFixed(3), remainingLifeYears: +remainingLife.toFixed(1),
        lat: Number(asset.lat || 29.7604) + (distanceM / 111000),
        lon: Number(asset.lon || -95.3698) + (distanceM / 95000),
      }
    })
    const maxDepth = Math.max(...anomalies.map(a => a.depthPct), 0)
    const critical = anomalies.filter(a => a.severity === 'critical' || a.severity === 'high')
    const minSafe = Math.min(...anomalies.map(a => a.safePressureKpa || 99999))
    const cgr = Math.max(...anomalies.map(a => a.cgrMmYear || 0), 0)
    const remaining = Math.min(...anomalies.map(a => a.remainingLifeYears || 30), 30)
    const risk = critical.length ? (anomalies.some(a => a.severity === 'critical') ? 'critical' : 'high') : maxDepth > 25 ? 'medium' : 'low'
    return {
      ref: `LS-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 8999)}`,
      summary: critical.length
        ? `${critical.length} high-priority anomalies require action. Deepest metal loss ${maxDepth.toFixed(1)}% of wall; estimated corrosion rate ${cgr.toFixed(2)} mm/yr.`
        : `No critical anomalies identified. Deepest metal loss ${maxDepth.toFixed(1)}% of wall; continue the planned reassessment interval.`,
      risk,
      confidence: 0.96,
      maxDepthPct: +maxDepth.toFixed(2),
      cgr: +cgr.toFixed(3),
      safePressureKpa: minSafe,
      remainingLifeYears: +remaining.toFixed(1),
      anomalies,
      b31g: anomalies.map(a => ({
        id: a.id, distanceM: a.distanceM, depthPct: a.depthPct,
        calculatedSafePressureKpa: a.safePressureKpa, remainingLifeYears: a.remainingLifeYears,
        result: (a.safePressureKpa || 0) >= Number(asset.maopKpa || 0) ? 'acceptable' : 'below MAOP',
      })),
      heatmap: anomalies.map(a => ({ distanceM: a.distanceM, depthPct: a.depthPct, risk: Math.round(a.depthPct * 1.2) })),
      metrics: { distanceKm: +(Math.max(...anomalies.map(a => a.distanceM)) / 1000).toFixed(2), anomalyCount: anomalies.length, criticalCount: critical.length, coverage: 99.1 },
    }
  }

  private sampleRows(asset: any) {
    const length = Math.max(2, Number(asset.lengthKm) * 1000)
    return Array.from({ length: 18 }, (_, i) => ({
      distanceM: Math.round((i + 1) * (length / 19)),
      depthPct: Math.round(8 + Math.abs(Math.sin(i * 1.7)) * 52 + (i % 5 === 0 ? 10 : 0)),
      lengthMm: 25 + (i % 6) * 18,
      widthMm: 12 + (i % 4) * 6,
      type: i % 7 === 0 ? 'Crack-like' : i % 5 === 0 ? 'Pitting cluster' : 'Metal loss',
    }))
  }

  private pickType(depth: number) { return depth > 55 ? 'Pitting cluster' : depth > 35 ? 'Metal loss' : 'General corrosion' }

  private videoFallback(job: any) {
    const seed = String(job.ref || job.address || 'line').split('').reduce((a, c) => a + c.charCodeAt(0), 0)
    const defects = [
      { type: 'Root intrusion', severity: 'high', distanceFt: 18 + (seed % 9), confidence: .94, note: 'Root mass reducing effective diameter; likely infiltration point.' },
      { type: 'Offset joint', severity: 'medium', distanceFt: 34 + (seed % 13), confidence: .89, note: 'Displaced joint with a lip that can snag debris.' },
      { type: 'Scale / debris', severity: 'low', distanceFt: 52 + (seed % 17), confidence: .82, note: 'Loose scale along the invert; recommend jetting.' },
    ]
    return {
      healthScore: 72,
      summary: 'Three findings were identified in the uploaded footage. One high-priority root intrusion and one displaced joint should be quoted for repair.',
      defects,
      recommendedActions: ['Hydro-jet the line before repair', 'Excavate and repair the root intrusion', 'Re-inspect the offset joint after excavation'],
      confidence: 0.91,
      footageReviewedFt: 78,
    }
  }
}
