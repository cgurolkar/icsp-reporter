import { Pool } from 'pg'

const pool = new Pool({
  user: process.env.POSTGRES_USER || 'postgres',
  host: process.env.POSTGRES_HOST || 'localhost',
  database: process.env.POSTGRES_DB || 'work_report_db',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
// Veritabanı tablolarını oluştur
export async function initializeDatabase() {
  const client = await pool.connect()
  
  try {
    // Work reports tablosu
    await client.query(`
      CREATE TABLE IF NOT EXISTS work_reports (
        id SERIAL PRIMARY KEY,
        date DATE NOT NULL,
        project VARCHAR(255) NOT NULL,
        selected_machine_id VARCHAR(100),
        selected_machine_name VARCHAR(255),
        machine_hours VARCHAR(50),
        total_production VARCHAR(100),
        pile_count VARCHAR(50),
        drilled_pile VARCHAR(50),
        concrete_pile VARCHAR(50),
        total_production_summary VARCHAR(100),
        total_pile_count VARCHAR(50),
        daily_pile_count VARCHAR(50),
        total_completed_piles VARCHAR(50),
        remaining_piles VARCHAR(50),
        steel_lowered_piles VARCHAR(50),
        concrete_poured VARCHAR(100),
        engineer_count INTEGER DEFAULT 0,
        foreman_count INTEGER DEFAULT 0,
        operator_count INTEGER DEFAULT 0,
        oiler_count INTEGER DEFAULT 0,
        welder_count INTEGER DEFAULT 0,
        other_count INTEGER DEFAULT 0,
        personnel_total INTEGER DEFAULT 0,
        crane_count INTEGER DEFAULT 0,
        loader_count INTEGER DEFAULT 0,
        truck_count INTEGER DEFAULT 0,
        pickup_count INTEGER DEFAULT 0,
        car_count INTEGER DEFAULT 0,
        service_count INTEGER DEFAULT 0,
        vehicles_total INTEGER DEFAULT 0,
        daily_fuel_usage VARCHAR(100),
        expenses JSONB,
        pile_details JSONB,
        notes TEXT,
        daily_notes TEXT,
        daily_image1 TEXT,
        daily_image2 TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'work_reports' AND column_name = 'daily_notes') THEN
          ALTER TABLE work_reports ADD COLUMN daily_notes TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'work_reports' AND column_name = 'daily_image1') THEN
          ALTER TABLE work_reports ADD COLUMN daily_image1 TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'work_reports' AND column_name = 'daily_image2') THEN
          ALTER TABLE work_reports ADD COLUMN daily_image2 TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'work_reports' AND column_name = 'next_day_planned') THEN
          ALTER TABLE work_reports ADD COLUMN next_day_planned TEXT;
        END IF;
      EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'daily_* columns: %', SQLERRM;
      END $$
    `)

    // Makine seçimleri tablosu
    await client.query(`
      CREATE TABLE IF NOT EXISTS machine_selections (
        id SERIAL PRIMARY KEY,
        report_id INTEGER REFERENCES work_reports(id) ON DELETE CASCADE,
        machine_id VARCHAR(100) NOT NULL,
        machine_name VARCHAR(255) NOT NULL,
        machine_type VARCHAR(100) NOT NULL,
        is_primary BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Yakıt kayıtları tablosu
    await client.query(`
      CREATE TABLE IF NOT EXISTS fuel_records (
        id SERIAL PRIMARY KEY,
        report_id INTEGER REFERENCES work_reports(id) ON DELETE CASCADE,
        machine_name VARCHAR(255) NOT NULL,
        shift VARCHAR(50),
        incoming VARCHAR(50),
        remaining VARCHAR(50),
        used VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Operatör makine girişleri (şantiye + tarih bazlı; rapora merge edilir)
    await client.query(`
      CREATE TABLE IF NOT EXISTS operator_entries (
        id SERIAL PRIMARY KEY,
        site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
        report_date DATE NOT NULL,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        machine_id VARCHAR(100) NOT NULL,
        machine_name VARCHAR(255) NOT NULL,
        machine_hours VARCHAR(50),
        used_fuel VARCHAR(50),
        work_done VARCHAR(255),
        note TEXT,
        daily_pile_count VARCHAR(50),
        total_production VARCHAR(50),
        empty_borehole VARCHAR(50),
        pre_borehole VARCHAR(50),
        concrete_poured VARCHAR(50),
        image1 TEXT,
        image2 TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(site_id, report_date, user_id, machine_id)
      )
    `)
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'operator_entries' AND column_name = 'daily_pile_count') THEN
          ALTER TABLE operator_entries ADD COLUMN daily_pile_count VARCHAR(50);
          ALTER TABLE operator_entries ADD COLUMN total_production VARCHAR(50);
          ALTER TABLE operator_entries ADD COLUMN empty_borehole VARCHAR(50);
          ALTER TABLE operator_entries ADD COLUMN pre_borehole VARCHAR(50);
          ALTER TABLE operator_entries ADD COLUMN concrete_poured VARCHAR(50);
          ALTER TABLE operator_entries ADD COLUMN image1 TEXT;
          ALTER TABLE operator_entries ADD COLUMN image2 TEXT;
          ALTER TABLE operator_entries ADD COLUMN notes TEXT;
        END IF;
      EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'operator_entries columns: %', SQLERRM;
      END $$
    `)

    // Kullanıcılar tablosu
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'user',
        email VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Projeler tablosu
    await client.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        total_piles INTEGER DEFAULT 0,
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Kullanıcı-proje ilişki tablosu
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_projects (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, project_id)
      )
    `)

    // Şantiyeler tablosu (multi-site: farklı şantiyeler tek veritabanında)
    await client.query(`
      CREATE TABLE IF NOT EXISTS sites (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        code VARCHAR(50) UNIQUE NOT NULL,
        email_list JSONB DEFAULT '[]',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // work_reports'a site_id ekle (mevcut tabloya sonradan eklenirse ALTER)
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = 'work_reports' AND column_name = 'site_id'
        ) THEN
          ALTER TABLE work_reports ADD COLUMN site_id INTEGER REFERENCES sites(id) ON DELETE SET NULL;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'site_id column may already exist or work_reports missing: %', SQLERRM;
      END $$
    `)
    // sites tablosuna projedeki toplam kazık sayısı
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = 'sites' AND column_name = 'total_piles'
        ) THEN
          ALTER TABLE sites ADD COLUMN total_piles INTEGER DEFAULT NULL;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'total_piles column: %', SQLERRM;
      END $$
    `)
    // Proje yeri: bölge, şehir, ülke
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sites' AND column_name = 'region') THEN
          ALTER TABLE sites ADD COLUMN region VARCHAR(255) DEFAULT NULL;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sites' AND column_name = 'city') THEN
          ALTER TABLE sites ADD COLUMN city VARCHAR(255) DEFAULT NULL;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sites' AND column_name = 'country') THEN
          ALTER TABLE sites ADD COLUMN country VARCHAR(255) DEFAULT NULL;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sites' AND column_name = 'authorized_person') THEN
          ALTER TABLE sites ADD COLUMN authorized_person VARCHAR(255) DEFAULT NULL;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sites' AND column_name = 'employer') THEN
          ALTER TABLE sites ADD COLUMN employer VARCHAR(255) DEFAULT NULL;
        END IF;
      EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'sites location columns: %', SQLERRM;
      END $$
    `)
    // Proje durumu: Yeni / Devam Eden (işin başlama tarihi, rapor başlangıcında yapılan kazık)
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sites' AND column_name = 'project_start_date') THEN
          ALTER TABLE sites ADD COLUMN project_start_date DATE DEFAULT NULL;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sites' AND column_name = 'is_ongoing') THEN
          ALTER TABLE sites ADD COLUMN is_ongoing BOOLEAN DEFAULT false;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sites' AND column_name = 'initial_piles_done') THEN
          ALTER TABLE sites ADD COLUMN initial_piles_done INTEGER DEFAULT NULL;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sites' AND column_name = 'assigned_machine_ids') THEN
          ALTER TABLE sites ADD COLUMN assigned_machine_ids JSONB DEFAULT '[]';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sites' AND column_name = 'assigned_operator_ids') THEN
          ALTER TABLE sites ADD COLUMN assigned_operator_ids JSONB DEFAULT '[]';
        END IF;
      EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'sites project columns: %', SQLERRM;
      END $$
    `)

    // users tablosuna sorumlu şantiye (site_id)
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'site_id') THEN
          ALTER TABLE users ADD COLUMN site_id INTEGER REFERENCES sites(id) ON DELETE SET NULL;
        END IF;
      EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'users site_id: %', SQLERRM;
      END $$
    `)

    console.log('Database tables created successfully')
  } catch (error) {
    console.error('Error initializing database:', error)
    throw error
  } finally {
    client.release()
  }
}

// Work report kaydet
export async function saveWorkReport(reportData: any) {
  const client = await pool.connect()
  
  try {
    const result = await client.query(`
      INSERT INTO work_reports (
        date, project, site_id, selected_machine_id, selected_machine_name,
        machine_hours, total_production, pile_count, drilled_pile, concrete_pile,
        total_production_summary, total_pile_count, daily_pile_count,
        total_completed_piles, remaining_piles, steel_lowered_piles, concrete_poured,
        engineer_count, foreman_count, operator_count, oiler_count, welder_count, other_count, personnel_total,
        crane_count, loader_count, truck_count, pickup_count, car_count, service_count, vehicles_total,
        daily_fuel_usage, expenses, pile_details, notes, daily_notes, daily_image1, daily_image2, next_day_planned
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39)
      RETURNING id
    `, [
      reportData.date,
      reportData.project,
      reportData.siteId != null && reportData.siteId !== "" ? (Number(reportData.siteId) || null) : null,
      reportData.selectedMachineId ?? null,
      reportData.selectedMachineName ?? null,
      reportData.machineHours,
      reportData.totalProduction,
      reportData.pileCount,
      reportData.drilledPile,
      reportData.concretePile,
      reportData.totalProductionSummary,
      reportData.totalPileCount,
      reportData.dailyPileCount,
      reportData.totalCompletedPiles,
      reportData.remainingPiles,
      reportData.steelLoweredPiles,
      reportData.concretePoured,
      reportData.engineerCount,
      reportData.foremanCount,
      reportData.operatorCount,
      reportData.oilerCount,
      reportData.welderCount,
      reportData.otherCount,
      reportData.personnelTotal,
      reportData.craneCount,
      reportData.loaderCount,
      reportData.truckCount,
      reportData.pickupCount,
      reportData.carCount,
      reportData.serviceCount,
      reportData.vehiclesTotal,
      reportData.dailyFuelUsage,
      JSON.stringify(reportData.expenses),
      JSON.stringify(reportData.pileDetails),
      reportData.notes,
      reportData.dailyNotes ?? null,
      reportData.dailyImage1 ?? null,
      reportData.dailyImage2 ?? null,
      reportData.nextDayPlanned ?? null,
    ])

    const reportId = result.rows[0].id

    // Makine seçimlerini kaydet
    if (reportData.selectedMachine) {
      await client.query(`
        INSERT INTO machine_selections (report_id, machine_id, machine_name, machine_type, is_primary)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        reportId,
        reportData.selectedMachine.id,
        reportData.selectedMachine.name,
        reportData.selectedMachine.type,
        true
      ])
    }

    // Ek makineleri kaydet
    for (const machine of reportData.additionalMachines || []) {
      await client.query(`
        INSERT INTO machine_selections (report_id, machine_id, machine_name, machine_type, is_primary)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        reportId,
        machine.id,
        machine.name,
        machine.type,
        false
      ])
    }

    // Yakıt kayıtlarını kaydet
    for (const fuelRecord of reportData.fuelMachines || []) {
      await client.query(`
        INSERT INTO fuel_records (report_id, machine_name, shift, incoming, remaining, used)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        reportId,
        fuelRecord.name,
        fuelRecord.shift,
        fuelRecord.incoming,
        fuelRecord.remaining,
        fuelRecord.used
      ])
    }

    return reportId
  } catch (error) {
    console.error('Error saving work report:', error)
    throw error
  } finally {
    client.release()
  }
}

// Tüm raporları getir
export async function getAllWorkReports() {
  const client = await pool.connect()
  
  try {
    const result = await client.query(`
      SELECT wr.*, s.name as site_name, s.code as site_code 
      FROM work_reports wr 
      LEFT JOIN sites s ON wr.site_id = s.id
      ORDER BY wr.created_at DESC
    `)
    return result.rows
  } catch (error) {
    console.error('Error fetching work reports:', error)
    throw error
  } finally {
    client.release()
  }
}

// Raporları filtrele (tarih ve şantiye) - istatistikler için
export async function getWorkReportsFiltered(options: { siteId?: number | null; startDate?: string; endDate?: string } = {}) {
  const client = await pool.connect()
  const { siteId, startDate, endDate } = options
  try {
    let query = `
      SELECT wr.*, s.name as site_name, s.code as site_code 
      FROM work_reports wr 
      LEFT JOIN sites s ON wr.site_id = s.id
      WHERE 1=1
    `
    const params: (number | string)[] = []
    let i = 1
    if (siteId != null && siteId > 0) {
      query += ` AND wr.site_id = $${i++}`
      params.push(siteId)
    }
    if (startDate) {
      query += ` AND wr.date >= $${i++}`
      params.push(startDate)
    }
    if (endDate) {
      query += ` AND wr.date <= $${i++}`
      params.push(endDate)
    }
    query += ` ORDER BY wr.date ASC`
    const result = await client.query(query, params)
    return result.rows
  } catch (error) {
    console.error('Error fetching filtered work reports:', error)
    throw error
  } finally {
    client.release()
  }
}

// Operatör makine girişi kaydet (şantiye + tarih + kullanıcı + makine bazlı; aynı gün aynı makine varsa güncelle)
export async function saveOperatorEntry(data: {
  siteId: number
  reportDate: string
  userId: number
  machineId: string
  machineName: string
  machineHours?: string
  usedFuel?: string
  workDone?: string
  note?: string
  dailyPileCount?: string
  totalProduction?: string
  emptyBorehole?: string
  preBorehole?: string
  concretePoured?: string
  image1?: string | null
  image2?: string | null
  notes?: string
}) {
  const client = await pool.connect()
  try {
    const dateStr = (data.reportDate || "").slice(0, 10)
    await client.query(`
      INSERT INTO operator_entries (site_id, report_date, user_id, machine_id, machine_name, machine_hours, used_fuel, work_done, note, daily_pile_count, total_production, empty_borehole, pre_borehole, concrete_poured, image1, image2, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      ON CONFLICT (site_id, report_date, user_id, machine_id)
      DO UPDATE SET
        machine_name = EXCLUDED.machine_name, machine_hours = EXCLUDED.machine_hours, used_fuel = EXCLUDED.used_fuel,
        work_done = EXCLUDED.work_done, note = EXCLUDED.note,
        daily_pile_count = EXCLUDED.daily_pile_count, total_production = EXCLUDED.total_production,
        empty_borehole = EXCLUDED.empty_borehole, pre_borehole = EXCLUDED.pre_borehole, concrete_poured = EXCLUDED.concrete_poured,
        image1 = EXCLUDED.image1, image2 = EXCLUDED.image2, notes = EXCLUDED.notes
    `, [
      data.siteId,
      dateStr,
      data.userId,
      data.machineId,
      data.machineName,
      data.machineHours ?? "",
      data.usedFuel ?? "",
      data.workDone ?? "",
      data.note ?? "",
      data.dailyPileCount ?? "",
      data.totalProduction ?? "",
      data.emptyBorehole ?? "",
      data.preBorehole ?? "",
      data.concretePoured ?? "",
      data.image1 && String(data.image1).startsWith("data:") ? data.image1 : null,
      data.image2 && String(data.image2).startsWith("data:") ? data.image2 : null,
      data.notes ?? "",
    ])
    return true
  } catch (error) {
    console.error("Error saving operator entry:", error)
    throw error
  } finally {
    client.release()
  }
}

// Şantiye + tarih için operatör girişlerini getir (rapora merge için)
export async function getOperatorEntriesBySiteAndDate(siteId: number, reportDate: string) {
  const client = await pool.connect()
  try {
    const dateStr = (reportDate || "").slice(0, 10)
    const result = await client.query(
      `SELECT oe.*, u.username
       FROM operator_entries oe
       LEFT JOIN users u ON oe.user_id = u.id
       WHERE oe.site_id = $1 AND oe.report_date = $2
       ORDER BY oe.machine_name, oe.id`,
      [siteId, dateStr]
    )
    return result.rows
  } catch (error) {
    console.error("Error fetching operator entries:", error)
    throw error
  } finally {
    client.release()
  }
}

// Günlük/haftalık/aylık agregasyon (istatistik sayfası için)
export async function getAggregatedStats(options: { siteId?: number | null; startDate?: string; endDate?: string } = {}) {
  const rows = await getWorkReportsFiltered(options)
  const daily: Record<string, { date: string; dayLabel: string; piles: number; fuel: number; production: number; expenses: number; reportCount: number }> = {}
  const weekly: Record<string, { piles: number; fuel: number; production: number; expenses: number; reportCount: number }> = {}
  const monthly: Record<string, { piles: number; fuel: number; production: number; expenses: number; reportCount: number }> = {}

  for (const r of rows) {
    const d = new Date(r.date)
    const dateStr = typeof r.date === 'string' ? r.date.slice(0, 10) : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const dayLabel = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`
    const weekKey = getWeekKey(d)
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

    const piles = parseInt(r.total_pile_count || r.daily_pile_count || r.concrete_poured || '0', 10) || 0
    const production = parseFloat(r.total_production_summary || r.total_production || '0') || 0
    const fuelStr = String(r.daily_fuel_usage || '').trim()
    const fuel = (() => {
      const n = parseFloat(fuelStr.replace(',', '.'))
      if (!Number.isNaN(n)) return n
      const m = fuelStr.match(/\d+([.,]\d+)?/)
      return m ? parseFloat(m[0].replace(',', '.')) : 0
    })()
    let expenses = 0
    if (r.expenses && Array.isArray(r.expenses)) {
      expenses = r.expenses.reduce((sum: number, e: { amount?: number }) => sum + (e?.amount || 0), 0)
    }

    if (!daily[dateStr]) daily[dateStr] = { date: dateStr, dayLabel, piles: 0, fuel: 0, production: 0, expenses: 0, reportCount: 0 }
    daily[dateStr].piles += piles
    daily[dateStr].fuel += fuel
    daily[dateStr].production += production
    daily[dateStr].expenses += expenses
    daily[dateStr].reportCount += 1

    if (!weekly[weekKey]) weekly[weekKey] = { piles: 0, fuel: 0, production: 0, expenses: 0, reportCount: 0 }
    weekly[weekKey].piles += piles
    weekly[weekKey].fuel += fuel
    weekly[weekKey].production += production
    weekly[weekKey].expenses += expenses
    weekly[weekKey].reportCount += 1

    if (!monthly[monthKey]) monthly[monthKey] = { piles: 0, fuel: 0, production: 0, expenses: 0, reportCount: 0 }
    monthly[monthKey].piles += piles
    monthly[monthKey].fuel += fuel
    monthly[monthKey].production += production
    monthly[monthKey].expenses += expenses
    monthly[monthKey].reportCount += 1
  }

  const weekLabels: Record<string, string> = {}
  Object.keys(weekly).sort().forEach((key) => {
    const parts = key.split('-')
    const y = parseInt(parts[0], 10)
    const w = parseInt(parts[1], 10)
    const start = getWeekStart(y, w)
    const end = new Date(start)
    end.setDate(end.getDate() + 6)
    const fmt = (d: Date) => `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`
    weekLabels[key] = `${fmt(start)}-${fmt(end)}`
  })

  const monthNames = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']

  // Makine bazlı özet (aynı şantiyede birden çok makine karşılaştırması)
  const byMachine: Record<string, { machineName: string; totalProduction: number; totalPiles: number; reportCount: number }> = {}
  for (const r of rows) {
    const name = r.selected_machine_name || 'Belirtilmemiş'
    const rPiles = parseInt(r.total_pile_count || r.daily_pile_count || r.concrete_poured || '0', 10) || 0
    const rProduction = parseFloat(r.total_production_summary || r.total_production || '0') || 0
    if (!byMachine[name]) byMachine[name] = { machineName: name, totalProduction: 0, totalPiles: 0, reportCount: 0 }
    byMachine[name].totalProduction += rProduction
    byMachine[name].totalPiles += rPiles
    byMachine[name].reportCount += 1
  }
  const machineComparison = Object.values(byMachine).sort((a, b) => b.totalProduction - a.totalProduction)

  // Harcama dağılımı (türe göre toplam tutar)
  const expenseDistribution: Record<string, number> = { santiye: 0, makine: 0, personel: 0, yakit: 0, diger: 0 }
  for (const r of rows) {
    if (r.expenses && Array.isArray(r.expenses)) {
      for (const e of r.expenses as { amount?: number; category?: string }[]) {
        const cat = (e?.category && expenseDistribution.hasOwnProperty(e.category)) ? e.category : 'diger'
        expenseDistribution[cat] = (expenseDistribution[cat] || 0) + (e?.amount || 0)
      }
    }
  }

  const dailyList = Object.entries(daily)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v)

  return {
    daily: dailyList,
    weekly: Object.entries(weekly)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => ({ week: weekLabels[key] || key, ...v })),
    monthly: Object.entries(monthly)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => {
        const [y, m] = key.split('-').map(Number)
        return { month: monthNames[m - 1] || key, monthKey: key, ...v }
      }),
    totalReports: rows.length,
    machineComparison,
    expenseDistribution,
  }
}

function getWeekKey(d: Date): string {
  const date = new Date(d)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(date)
  monday.setDate(diff)
  const y = monday.getFullYear()
  const jan1 = new Date(y, 0, 1)
  const jan1Day = jan1.getDay()
  const firstMonday = new Date(jan1)
  firstMonday.setDate(jan1.getDate() + (jan1Day === 0 ? -6 : 1 - jan1Day))
  const w = Math.round((monday.getTime() - firstMonday.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1
  return `${y}-${String(Math.max(1, w)).padStart(2, '0')}`
}

function getWeekStart(year: number, week: number): Date {
  const jan1 = new Date(year, 0, 1)
  const day = jan1.getDay()
  const toMonday = day === 0 ? -6 : 1 - day
  const firstMonday = new Date(jan1)
  firstMonday.setDate(jan1.getDate() + toMonday)
  firstMonday.setDate(firstMonday.getDate() + (week - 1) * 7)
  return firstMonday
}

// ----- Şantiyeler (sites) -----
export async function getAllSites() {
  const client = await pool.connect()
  try {
    const result = await client.query(`SELECT * FROM sites WHERE is_active = true ORDER BY name`)
    return result.rows
  } catch (error) {
    console.error('Error fetching sites:', error)
    throw error
  } finally {
    client.release()
  }
}

/** Şantiyeleri rapor sayılarıyla getir; siteId verilirse sadece o şantiye (kullanıcı kendi şantiyesini görsün) */
export async function getSitesWithReportCount(siteId?: number | null) {
  const client = await pool.connect()
  try {
    const query = siteId != null
      ? `
      SELECT s.*,
        (SELECT COUNT(*) FROM work_reports wr WHERE wr.site_id = s.id) AS report_count
      FROM sites s
      WHERE s.is_active = true AND s.id = $1
      ORDER BY s.name
      `
      : `
      SELECT s.*,
        (SELECT COUNT(*) FROM work_reports wr WHERE wr.site_id = s.id) AS report_count
      FROM sites s
      WHERE s.is_active = true
      ORDER BY s.name
      `
    const result = siteId != null
      ? await client.query(query, [siteId])
      : await client.query(query)
    return result.rows.map((r: any) => ({
      ...r,
      report_count: parseInt(r.report_count, 10) || 0,
    }))
  } catch (error) {
    console.error('Error fetching sites with report count:', error)
    throw error
  } finally {
    client.release()
  }
}

/** Bir şantiyenin bir önceki rapor tarihine ait kalan kazık (son rapor) */
export async function getLastReportRemainingBySite(siteId: number | null) {
  if (siteId == null) return null
  const client = await pool.connect()
  try {
    const result = await client.query(
      `SELECT date, remaining_piles FROM work_reports WHERE site_id = $1 ORDER BY date DESC LIMIT 1`,
      [siteId]
    )
    const row = result.rows[0]
    return row ? { date: row.date, remainingPiles: row.remaining_piles } : null
  } catch (error) {
    console.error('Error fetching last report remaining:', error)
    return null
  } finally {
    client.release()
  }
}

/** Belirli bir şantiye ve tarihteki raporu getir (örn. dünkü raporun next_day_planned için) */
export async function getReportBySiteAndDate(siteId: number, dateStr: string) {
  const client = await pool.connect()
  try {
    const d = (dateStr || "").slice(0, 10)
    const result = await client.query(
      `SELECT id, date, next_day_planned FROM work_reports WHERE site_id = $1 AND date = $2 ORDER BY id DESC LIMIT 1`,
      [siteId, d]
    )
    return result.rows[0] || null
  } catch (error) {
    console.error('Error fetching report by site and date:', error)
    return null
  } finally {
    client.release()
  }
}

/** Verilen user id listesi için id ve username döner (şantiye atanmış operatörler için) */
export async function getUsersByIds(ids: number[]) {
  if (!ids.length) return []
  const client = await pool.connect()
  try {
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',')
    const result = await client.query(
      `SELECT id, username FROM users WHERE id IN (${placeholders})`,
      ids
    )
    return result.rows
  } catch (error) {
    console.error('Error fetching users by ids:', error)
    return []
  } finally {
    client.release()
  }
}

export async function getSiteById(id: number) {
  const client = await pool.connect()
  try {
    const result = await client.query(`SELECT * FROM sites WHERE id = $1`, [id])
    return result.rows[0] || null
  } catch (error) {
    console.error('Error fetching site:', error)
    throw error
  } finally {
    client.release()
  }
}

export async function getSiteByCode(code: string) {
  const client = await pool.connect()
  try {
    const result = await client.query(`SELECT * FROM sites WHERE code = $1 AND is_active = true`, [code])
    return result.rows[0] || null
  } catch (error) {
    console.error('Error fetching site by code:', error)
    throw error
  } finally {
    client.release()
  }
}

export async function createSite(data: {
  name: string
  code: string
  emailList?: string[]
  totalPiles?: number | null
  region?: string | null
  city?: string | null
  country?: string | null
  authorizedPerson?: string | null
  employer?: string | null
  projectStartDate?: string | null
  isOngoing?: boolean
  initialPilesDone?: number | null
  assignedMachineIds?: string[]
  assignedOperatorIds?: number[]
}) {
  const client = await pool.connect()
  try {
    const result = await client.query(
      `INSERT INTO sites (name, code, email_list, total_piles, region, city, country, authorized_person, employer, project_start_date, is_ongoing, initial_piles_done, assigned_machine_ids, assigned_operator_ids)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
      [
        data.name,
        data.code,
        JSON.stringify(data.emailList || []),
        data.totalPiles ?? null,
        data.region ?? null,
        data.city ?? null,
        data.country ?? null,
        data.authorizedPerson ?? null,
        data.employer ?? null,
        data.projectStartDate?.trim() || null,
        data.isOngoing ?? false,
        data.initialPilesDone ?? null,
        JSON.stringify(data.assignedMachineIds || []),
        JSON.stringify(data.assignedOperatorIds || []),
      ]
    )
    return result.rows[0]
  } catch (error) {
    console.error('Error creating site:', error)
    throw error
  } finally {
    client.release()
  }
}

export async function updateSite(id: number, data: {
  name?: string
  code?: string
  emailList?: string[]
  isActive?: boolean
  totalPiles?: number | null
  region?: string | null
  city?: string | null
  country?: string | null
  authorizedPerson?: string | null
  employer?: string | null
  projectStartDate?: string | null
  isOngoing?: boolean
  initialPilesDone?: number | null
  assignedMachineIds?: string[]
  assignedOperatorIds?: number[]
}) {
  const client = await pool.connect()
  try {
    const updates: string[] = []
    const values: (string | number | boolean | null)[] = []
    let i = 1
    if (data.name !== undefined) { updates.push(`name = $${i++}`); values.push(data.name) }
    if (data.code !== undefined) { updates.push(`code = $${i++}`); values.push(data.code) }
    if (data.emailList !== undefined) { updates.push(`email_list = $${i++}`); values.push(JSON.stringify(data.emailList)) }
    if (data.isActive !== undefined) { updates.push(`is_active = $${i++}`); values.push(data.isActive) }
    if (data.totalPiles !== undefined) { updates.push(`total_piles = $${i++}`); values.push(data.totalPiles) }
    if (data.region !== undefined) { updates.push(`region = $${i++}`); values.push(data.region) }
    if (data.city !== undefined) { updates.push(`city = $${i++}`); values.push(data.city) }
    if (data.country !== undefined) { updates.push(`country = $${i++}`); values.push(data.country) }
    if (data.authorizedPerson !== undefined) { updates.push(`authorized_person = $${i++}`); values.push(data.authorizedPerson) }
    if (data.employer !== undefined) { updates.push(`employer = $${i++}`); values.push(data.employer) }
    if (data.projectStartDate !== undefined) { updates.push(`project_start_date = $${i++}`); values.push(data.projectStartDate?.trim() || null) }
    if (data.isOngoing !== undefined) { updates.push(`is_ongoing = $${i++}`); values.push(data.isOngoing) }
    if (data.initialPilesDone !== undefined) { updates.push(`initial_piles_done = $${i++}`); values.push(data.initialPilesDone) }
    if (data.assignedMachineIds !== undefined) { updates.push(`assigned_machine_ids = $${i++}`); values.push(JSON.stringify(data.assignedMachineIds)) }
    if (data.assignedOperatorIds !== undefined) { updates.push(`assigned_operator_ids = $${i++}`); values.push(JSON.stringify(data.assignedOperatorIds)) }
    if (updates.length === 0) return await getSiteById(id)
    updates.push(`updated_at = CURRENT_TIMESTAMP`)
    values.push(id)
    const result = await client.query(
      `UPDATE sites SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    )
    return result.rows[0] || null
  } catch (error) {
    console.error('Error updating site:', error)
    throw error
  } finally {
    client.release()
  }
}

export async function getSiteReportEmails(siteId: number | null): Promise<string[]> {
  if (siteId) {
    const site = await getSiteById(siteId)
    if (site?.email_list && Array.isArray(site.email_list)) return site.email_list as string[]
  }
  return []
}

// Rapor detayını getir (site_name, site_code ile)
export async function getWorkReportById(id: number) {
  const client = await pool.connect()
  try {
    const reportResult = await client.query(`
      SELECT wr.*, s.name as site_name, s.code as site_code
      FROM work_reports wr
      LEFT JOIN sites s ON wr.site_id = s.id
      WHERE wr.id = $1
    `, [id])
    const machinesResult = await client.query(`SELECT * FROM machine_selections WHERE report_id = $1`, [id])
    const fuelResult = await client.query(`SELECT * FROM fuel_records WHERE report_id = $1`, [id])
    return {
      report: reportResult.rows[0],
      machines: machinesResult.rows,
      fuelRecords: fuelResult.rows
    }
  } catch (error) {
    console.error('Error fetching work report:', error)
    throw error
  } finally {
    client.release()
  }
}

// Rapor güncelle (ana alanlar)
export async function updateWorkReport(id: number, data: {
  date?: string
  project?: string
  siteId?: number | null
  selectedMachineName?: string
  totalProductionSummary?: string
  totalPileCount?: string
  dailyPileCount?: string
  remainingPiles?: string
  concretePoured?: string
  personnelTotal?: number
  dailyFuelUsage?: string
  notes?: string
  [key: string]: unknown
}) {
  const client = await pool.connect()
  try {
    const updates: string[] = []
    const values: unknown[] = []
    let i = 1
    if (data.date !== undefined) { updates.push(`date = $${i++}`); values.push(data.date) }
    if (data.project !== undefined) { updates.push(`project = $${i++}`); values.push(data.project) }
    if (data.siteId !== undefined) { updates.push(`site_id = $${i++}`); values.push(data.siteId) }
    if (data.selectedMachineName !== undefined) { updates.push(`selected_machine_name = $${i++}`); values.push(data.selectedMachineName) }
    if (data.totalProductionSummary !== undefined) { updates.push(`total_production_summary = $${i++}`); values.push(data.totalProductionSummary) }
    if (data.totalPileCount !== undefined) { updates.push(`total_pile_count = $${i++}`); values.push(data.totalPileCount) }
    if (data.dailyPileCount !== undefined) { updates.push(`daily_pile_count = $${i++}`); values.push(data.dailyPileCount) }
    if (data.remainingPiles !== undefined) { updates.push(`remaining_piles = $${i++}`); values.push(data.remainingPiles) }
    if (data.concretePoured !== undefined) { updates.push(`concrete_poured = $${i++}`); values.push(data.concretePoured) }
    if (data.personnelTotal !== undefined) { updates.push(`personnel_total = $${i++}`); values.push(data.personnelTotal) }
    if (data.dailyFuelUsage !== undefined) { updates.push(`daily_fuel_usage = $${i++}`); values.push(data.dailyFuelUsage) }
    if (data.notes !== undefined) { updates.push(`notes = $${i++}`); values.push(data.notes) }
    if (updates.length === 0) return (await getWorkReportById(id))?.report ?? null
    updates.push(`updated_at = CURRENT_TIMESTAMP`)
    values.push(id)
    await client.query(`UPDATE work_reports SET ${updates.join(', ')} WHERE id = $${i}`, values)
    return (await getWorkReportById(id))?.report ?? null
  } catch (error) {
    console.error('Error updating work report:', error)
    throw error
  } finally {
    client.release()
  }
}

// Rapor sil (ilişkili kayıtlar CASCADE veya manuel silinir)
export async function deleteWorkReport(id: number) {
  const client = await pool.connect()
  try {
    await client.query(`DELETE FROM machine_selections WHERE report_id = $1`, [id])
    await client.query(`DELETE FROM fuel_records WHERE report_id = $1`, [id])
    const result = await client.query(`DELETE FROM work_reports WHERE id = $1 RETURNING id`, [id])
    return (result.rowCount ?? 0) > 0
  } catch (error) {
    console.error('Error deleting work report:', error)
    throw error
  } finally {
    client.release()
  }
}

export default pool 