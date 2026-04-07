import { Pool, type PoolClient } from 'pg'
import { expenseAmountsToUsdIqd, type ExpenseCurrency } from './expense-fx'
import { getAppStatsSinceSqlDate } from './app-stats'

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
// Singleton flag: her istek initializeDatabase çağırsa da yalnızca bir kez çalışır
let _dbInitialized = false
let _dbInitPromise: Promise<void> | null = null

// Veritabanı tablolarını oluştur
export async function initializeDatabase() {
  if (_dbInitialized) return
  if (_dbInitPromise) return _dbInitPromise
  _dbInitPromise = _doInitializeDatabase().then(() => { _dbInitialized = true }).catch((e) => { _dbInitPromise = null; throw e })
  return _dbInitPromise
}

async function _doInitializeDatabase() {
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
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'work_reports' AND column_name = 'daily_images') THEN
          ALTER TABLE work_reports ADD COLUMN daily_images JSONB DEFAULT '[]';
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
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'operator_entries' AND column_name = 'start_time') THEN
          ALTER TABLE operator_entries ADD COLUMN start_time VARCHAR(5);
          ALTER TABLE operator_entries ADD COLUMN end_time VARCHAR(5);
          ALTER TABLE operator_entries ADD COLUMN pile_depths JSONB DEFAULT '[]';
          ALTER TABLE operator_entries ADD COLUMN elmas_miktar VARCHAR(50);
          ALTER TABLE operator_entries ADD COLUMN elmas_degisim_yok BOOLEAN DEFAULT false;
          ALTER TABLE operator_entries ADD COLUMN bentonit_miktar VARCHAR(50);
        END IF;
      EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'operator_entries start_time/pile_depths/elmas/bentonit: %', SQLERRM;
      END $$
    `)
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'operator_entries' AND column_name = 'motor_saat_binis') THEN
          ALTER TABLE operator_entries ADD COLUMN motor_saat_binis VARCHAR(50);
          ALTER TABLE operator_entries ADD COLUMN motor_saat_inis VARCHAR(50);
        END IF;
      EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'operator_entries motor_saat: %', SQLERRM;
      END $$
    `)
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'operator_entries' AND column_name = 'kullanilan_malzeme') THEN
          ALTER TABLE operator_entries ADD COLUMN kullanilan_malzeme TEXT;
          ALTER TABLE operator_entries ADD COLUMN malzeme_ihtiyaci BOOLEAN DEFAULT false;
          ALTER TABLE operator_entries ADD COLUMN servis_ihtiyaci BOOLEAN DEFAULT false;
          ALTER TABLE operator_entries ADD COLUMN db_machine_id INTEGER;
        END IF;
      EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'operator_entries malzeme/servis: %', SQLERRM;
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
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sites' AND column_name = 'budget') THEN
          ALTER TABLE sites ADD COLUMN budget DECIMAL(14,2) DEFAULT NULL;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sites' AND column_name = 'contract_unit_price') THEN
          ALTER TABLE sites ADD COLUMN contract_unit_price DECIMAL(14,2) DEFAULT NULL;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sites' AND column_name = 'assigned_machine_operators') THEN
          ALTER TABLE sites ADD COLUMN assigned_machine_operators JSONB DEFAULT '[]';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sites' AND column_name = 'timezone') THEN
          ALTER TABLE sites ADD COLUMN timezone VARCHAR(64) DEFAULT NULL;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sites' AND column_name = 'iqd_per_usd') THEN
          ALTER TABLE sites ADD COLUMN iqd_per_usd DECIMAL(14,4) DEFAULT 1320;
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

    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'module_permissions') THEN
          ALTER TABLE users ADD COLUMN module_permissions JSONB DEFAULT '{}'::jsonb;
        END IF;
      EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'users module_permissions: %', SQLERRM;
      END $$
    `)

    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'must_change_password') THEN
          ALTER TABLE users ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT false;
        END IF;
      EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'users must_change_password: %', SQLERRM;
      END $$
    `)

    // ---------- İdari modül tabloları (Faz 1) ----------
    await client.query(`
      CREATE TABLE IF NOT EXISTS personeller (
        id SERIAL PRIMARY KEY,
        ad VARCHAR(100) NOT NULL,
        soyad VARCHAR(100) NOT NULL,
        tc_kimlik VARCHAR(20),
        dogum_tarihi DATE,
        kan_grubu VARCHAR(10),
        acil_iletisim VARCHAR(255),
        acil_telefon VARCHAR(50),
        gorev VARCHAR(100) NOT NULL DEFAULT 'İşçi',
        ise_giris_tarihi DATE,
        sigorta_durumu VARCHAR(50),
        iban VARCHAR(34),
        banka_adi VARCHAR(255),
        gunluk_yevmiye DECIMAL(12,2),
        aylik_maas DECIMAL(12,2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await client.query(`
      CREATE TABLE IF NOT EXISTS personel_atama (
        id SERIAL PRIMARY KEY,
        personel_id INTEGER NOT NULL REFERENCES personeller(id) ON DELETE CASCADE,
        site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
        baslangic_tarihi DATE NOT NULL,
        bitis_tarihi DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(personel_id, site_id, baslangic_tarihi)
      )
    `)
    await client.query(`
      CREATE TABLE IF NOT EXISTS harcama_kategorileri (
        id SERIAL PRIMARY KEY,
        kod VARCHAR(50) UNIQUE NOT NULL,
        ad VARCHAR(255) NOT NULL,
        aciklama TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await client.query(`
      CREATE TABLE IF NOT EXISTS islemler (
        id SERIAL PRIMARY KEY,
        site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
        kategori_id INTEGER NOT NULL REFERENCES harcama_kategorileri(id),
        tutar DECIMAL(12,2) NOT NULL,
        islem_tarihi DATE NOT NULL,
        odeme_kaynagi VARCHAR(30) NOT NULL,
        aciklama TEXT,
        evrak_yolu VARCHAR(500),
        olusturan_id INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await client.query(`
      CREATE TABLE IF NOT EXISTS puantaj (
        id SERIAL PRIMARY KEY,
        personel_id INTEGER NOT NULL REFERENCES personeller(id) ON DELETE CASCADE,
        site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
        tarih DATE NOT NULL,
        carpan DECIMAL(3,2) DEFAULT 1.0,
        durum_kod VARCHAR(5) DEFAULT 'G',
        mesai_saat DECIMAL(4,2) DEFAULT 0,
        notlar TEXT,
        durum VARCHAR(20) DEFAULT 'taslak',
        olusturan_id INTEGER REFERENCES users(id),
        onaylayan_id INTEGER REFERENCES users(id),
        onay_tarihi TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(personel_id, site_id, tarih)
      )
    `)
    await client.query(`
      CREATE TABLE IF NOT EXISTS personel_belge_tipleri (
        id SERIAL PRIMARY KEY,
        kod VARCHAR(50) UNIQUE NOT NULL,
        ad VARCHAR(255) NOT NULL
      )
    `)
    await client.query(`
      CREATE TABLE IF NOT EXISTS personel_belgeleri (
        id SERIAL PRIMARY KEY,
        personel_id INTEGER NOT NULL REFERENCES personeller(id) ON DELETE CASCADE,
        belge_tipi VARCHAR(50) NOT NULL,
        dosya_yolu VARCHAR(500) NOT NULL,
        gecerlilik_tarihi DATE,
        yukleme_tarihi TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Personel tablosuna yeni alanlar (migration)
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='personeller' AND column_name='pasaport_no')
        THEN ALTER TABLE personeller ADD COLUMN pasaport_no VARCHAR(50); END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='personeller' AND column_name='isten_cikis_tarihi')
        THEN ALTER TABLE personeller ADD COLUMN isten_cikis_tarihi DATE; END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='personeller' AND column_name='calistigi_bolum')
        THEN ALTER TABLE personeller ADD COLUMN calistigi_bolum VARCHAR(100); END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='personeller' AND column_name='foto_yolu')
        THEN ALTER TABLE personeller ADD COLUMN foto_yolu TEXT; END IF;
        -- Personel-User FK: operatör kullanıcıyla ilişki
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='personeller' AND column_name='user_id')
        THEN ALTER TABLE personeller ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE SET NULL; END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='personeller' AND column_name='gunluk_yevmiye_usd')
        THEN ALTER TABLE personeller ADD COLUMN gunluk_yevmiye_usd DECIMAL(12,2); END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='personeller' AND column_name='gunluk_yevmiye_iqd')
        THEN ALTER TABLE personeller ADD COLUMN gunluk_yevmiye_iqd DECIMAL(12,2); END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='personeller' AND column_name='aylik_maas_usd')
        THEN ALTER TABLE personeller ADD COLUMN aylik_maas_usd DECIMAL(12,2); END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='personeller' AND column_name='aylik_maas_iqd')
        THEN ALTER TABLE personeller ADD COLUMN aylik_maas_iqd DECIMAL(12,2); END IF;
      END $$
    `)
    await client.query(`
      UPDATE personeller SET gunluk_yevmiye_iqd = gunluk_yevmiye
      WHERE gunluk_yevmiye IS NOT NULL AND gunluk_yevmiye_iqd IS NULL
    `)
    await client.query(`
      UPDATE personeller SET aylik_maas_iqd = aylik_maas
      WHERE aylik_maas IS NOT NULL AND aylik_maas_iqd IS NULL
    `)
    // Migrate foto_yolu to TEXT if it was created as VARCHAR(500)
    await client.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='personeller' AND column_name='foto_yolu' AND data_type='character varying')
        THEN ALTER TABLE personeller ALTER COLUMN foto_yolu TYPE TEXT; END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='envanter' AND column_name='fotograf_yolu' AND data_type='character varying')
        THEN ALTER TABLE envanter ALTER COLUMN fotograf_yolu TYPE TEXT; END IF;
      EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'foto column migration: %', SQLERRM;
      END $$
    `)
    // islemler tablosuna work_report_id ekle (rapor harcamalarını islemler'e sync edince kaynak takibi)
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='islemler' AND column_name='work_report_id')
        THEN ALTER TABLE islemler ADD COLUMN work_report_id INTEGER REFERENCES work_reports(id) ON DELETE CASCADE; END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='islemler' AND column_name='para_birimi')
        THEN ALTER TABLE islemler ADD COLUMN para_birimi VARCHAR(3) DEFAULT 'IQD'; END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='islemler' AND column_name='kur_iqd_per_usd')
        THEN ALTER TABLE islemler ADD COLUMN kur_iqd_per_usd DECIMAL(14,4); END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='islemler' AND column_name='tutar_usd')
        THEN ALTER TABLE islemler ADD COLUMN tutar_usd DECIMAL(14,2); END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='islemler' AND column_name='tutar_iqd')
        THEN ALTER TABLE islemler ADD COLUMN tutar_iqd DECIMAL(14,2); END IF;
      EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'islemler work_report_id: %', SQLERRM;
      END $$
    `)
    await client.query(`
      UPDATE islemler i SET
        para_birimi = COALESCE(i.para_birimi, 'IQD'),
        kur_iqd_per_usd = COALESCE(i.kur_iqd_per_usd, (SELECT COALESCE(s.iqd_per_usd, 1320) FROM sites s WHERE s.id = i.site_id), 1320),
        tutar_iqd = COALESCE(i.tutar_iqd, i.tutar),
        tutar_usd = COALESCE(i.tutar_usd, ROUND((i.tutar::numeric / NULLIF(COALESCE((SELECT s2.iqd_per_usd FROM sites s2 WHERE s2.id = i.site_id), 1320), 0)), 2))
      WHERE i.tutar_usd IS NULL OR i.tutar_iqd IS NULL
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS envanter (
        id SERIAL PRIMARY KEY,
        kod VARCHAR(50) UNIQUE NOT NULL,
        malzeme_adi VARCHAR(255) NOT NULL,
        aciklama TEXT,
        adet INTEGER NOT NULL DEFAULT 1,
        fotograf_yolu VARCHAR(500),
        fiyat DECIMAL(12,2),
        yer VARCHAR(255),
        site_id INTEGER REFERENCES sites(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // envanter_hareket tablosu
    await client.query(`
      CREATE TABLE IF NOT EXISTS envanter_hareket (
        id SERIAL PRIMARY KEY,
        envanter_id INTEGER NOT NULL REFERENCES envanter(id) ON DELETE CASCADE,
        hareket_tipi VARCHAR(10) NOT NULL CHECK (hareket_tipi IN ('gelen','giden')),
        kaynak_yer VARCHAR(255),
        hedef_yer VARCHAR(255),
        site_id INTEGER REFERENCES sites(id) ON DELETE SET NULL,
        tarih DATE NOT NULL,
        adet INTEGER NOT NULL DEFAULT 1,
        notlar TEXT,
        olusturan_id INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    // envanter tablosuna durum alanı ekle (migration)
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='envanter' AND column_name='durum')
        THEN ALTER TABLE envanter ADD COLUMN durum VARCHAR(30) DEFAULT 'aktif'; END IF;
      EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'envanter durum: %', SQLERRM; END $$
    `)

    // Makine defteri tablosu
    await client.query(`
      CREATE TABLE IF NOT EXISTS machines (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        machine_type VARCHAR(100) NOT NULL DEFAULT 'Kazık Makinesi',
        marka VARCHAR(100),
        model VARCHAR(100),
        plaka_no VARCHAR(50),
        seri_no VARCHAR(100),
        status VARCHAR(30) NOT NULL DEFAULT 'aktif' CHECK (status IN ('aktif','bakimda','hurda','depoda')),
        current_site_id INTEGER REFERENCES sites(id) ON DELETE SET NULL,
        notlar TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    // machine_operator_atama: hangi operatörler hangi makinede çalışıyor
    await client.query(`
      CREATE TABLE IF NOT EXISTS machine_operator_atama (
        id SERIAL PRIMARY KEY,
        machine_id INTEGER NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
        personel_id INTEGER NOT NULL REFERENCES personeller(id) ON DELETE CASCADE,
        baslangic_tarihi DATE NOT NULL DEFAULT CURRENT_DATE,
        bitis_tarihi DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(machine_id, personel_id, baslangic_tarihi)
      )
    `)

    // personel_izin tablosu
    await client.query(`
      CREATE TABLE IF NOT EXISTS personel_izin (
        id SERIAL PRIMARY KEY,
        personel_id INTEGER NOT NULL REFERENCES personeller(id) ON DELETE CASCADE,
        izin_tipi VARCHAR(50) NOT NULL DEFAULT 'Yıllık',
        baslangic_tarihi DATE NOT NULL,
        bitis_tarihi DATE NOT NULL,
        gun_sayisi INTEGER GENERATED ALWAYS AS (bitis_tarihi - baslangic_tarihi + 1) STORED,
        notlar TEXT,
        olusturan_id INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Genel admin paneli ayarları (e-posta listesi vb.) — tek satır id=1
    await client.query(`
      CREATE TABLE IF NOT EXISTS global_admin_settings (
        id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
        emails JSONB NOT NULL DEFAULT '["admin@company.com", "manager@company.com"]'::jsonb,
        users JSONB NOT NULL DEFAULT '["admin", "manager"]'::jsonb,
        custom_fields JSONB NOT NULL DEFAULT '["Extra Field 1", "Extra Field 2"]'::jsonb,
        total_piles VARCHAR(64) NOT NULL DEFAULT '100',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await client.query(`
      INSERT INTO global_admin_settings (id) VALUES (1)
      ON CONFLICT (id) DO NOTHING
    `)

    await seedIdariInitialData(client)

    // ---------- Performans indeksleri ----------
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_work_reports_site_id ON work_reports(site_id);
      CREATE INDEX IF NOT EXISTS idx_work_reports_date ON work_reports(date);
      CREATE INDEX IF NOT EXISTS idx_work_reports_site_date ON work_reports(site_id, date);
      CREATE INDEX IF NOT EXISTS idx_operator_entries_site_date ON operator_entries(site_id, report_date);
      CREATE INDEX IF NOT EXISTS idx_operator_entries_user ON operator_entries(user_id);
      CREATE INDEX IF NOT EXISTS idx_puantaj_site_tarih ON puantaj(site_id, tarih);
      CREATE INDEX IF NOT EXISTS idx_puantaj_personel ON puantaj(personel_id);
      CREATE INDEX IF NOT EXISTS idx_puantaj_durum ON puantaj(durum);
      CREATE INDEX IF NOT EXISTS idx_envanter_hareket_envanter ON envanter_hareket(envanter_id);
      CREATE INDEX IF NOT EXISTS idx_envanter_hareket_site ON envanter_hareket(site_id);
      CREATE INDEX IF NOT EXISTS idx_islemler_site_tarih ON islemler(site_id, islem_tarihi);
      CREATE INDEX IF NOT EXISTS idx_islemler_kategori ON islemler(kategori_id);
      CREATE INDEX IF NOT EXISTS idx_personel_atama_personel ON personel_atama(personel_id);
      CREATE INDEX IF NOT EXISTS idx_personel_atama_site ON personel_atama(site_id);
      CREATE INDEX IF NOT EXISTS idx_users_site_id ON users(site_id);
      CREATE INDEX IF NOT EXISTS idx_personel_izin_personel ON personel_izin(personel_id);
      CREATE INDEX IF NOT EXISTS idx_machines_site ON machines(current_site_id);
      CREATE INDEX IF NOT EXISTS idx_machine_operator_machine ON machine_operator_atama(machine_id);
      CREATE INDEX IF NOT EXISTS idx_machine_operator_personel ON machine_operator_atama(personel_id);
    `)

    console.log('Database tables created successfully')
  } catch (error) {
    console.error('Error initializing database:', error)
    throw error
  } finally {
    client.release()
  }
}

async function seedIdariInitialData(client: { query: (arg0: string, arg1?: any[]) => Promise<any> }) {
  const cat = await client.query(`SELECT COUNT(*) FROM harcama_kategorileri`)
  if (parseInt(cat.rows[0]?.count || '0', 10) === 0) {
    await client.query(`
      INSERT INTO harcama_kategorileri (kod, ad) VALUES
        ('sarf', 'Sarf Malzeme'),
        ('akaryakit', 'Akaryakıt'),
        ('yemek', 'Yemek'),
        ('tason', 'Taşeron Ödemesi'),
        ('maas', 'Maaş Ödemesi'),
        ('diger', 'Diğer')
    `)
  }
  const tip = await client.query(`SELECT COUNT(*) FROM personel_belge_tipleri`)
  if (parseInt(tip.rows[0]?.count || '0', 10) === 0) {
    await client.query(`
      INSERT INTO personel_belge_tipleri (kod, ad) VALUES
        ('kimlik', 'Kimlik Fotokopisi'),
        ('pasaport_kimlik', 'Pasaport / Kimlik'),
        ('personel_foto', 'Personel Fotoğrafı'),
        ('isg', 'İSG Eğitim Sertifikası'),
        ('mesleki', 'Mesleki Yeterlilik Belgesi'),
        ('saglik', 'Sağlık Raporu'),
        ('adli_sicil', 'Adli Sicil Kaydı')
    `)
  }
  const tipCount = parseInt(tip.rows[0]?.count || '0', 10)
  if (tipCount > 0) {
    const hasPasaport = await client.query(`SELECT 1 FROM personel_belge_tipleri WHERE kod IN ('pasaport_kimlik','personel_foto') LIMIT 1`)
    if (hasPasaport.rows.length === 0) {
      await client.query(`
        INSERT INTO personel_belge_tipleri (kod, ad) VALUES ('pasaport_kimlik', 'Pasaport / Kimlik'), ('personel_foto', 'Personel Fotoğrafı')
      `)
    }
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
        daily_fuel_usage, expenses, pile_details, notes, daily_notes, daily_image1, daily_image2, next_day_planned, daily_images
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40)
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
      JSON.stringify(Array.isArray(reportData.dailyImages) ? reportData.dailyImages : []),
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
  dbMachineId?: number | null
  machineHours?: string
  startTime?: string
  endTime?: string
  motorSaatBinis?: string
  motorSaatInis?: string
  pileDepths?: { depth: string | number; onForaj: boolean; bosForaj: boolean }[]
  usedFuel?: string
  workDone?: string
  note?: string
  dailyPileCount?: string
  totalProduction?: string
  emptyBorehole?: string
  preBorehole?: string
  concretePoured?: string
  elmasMiktar?: string
  elmasDegisimYok?: boolean
  bentonitMiktar?: string
  kullanılanMalzeme?: string
  malzemeIhtiyaci?: boolean
  servisIhtiyaci?: boolean
  image1?: string | null
  image2?: string | null
  notes?: string
}) {
  const client = await pool.connect()
  try {
    const dateStr = (data.reportDate || "").slice(0, 10)
    const pileDepthsJson = JSON.stringify(data.pileDepths ?? [])
    await client.query(`
      INSERT INTO operator_entries (site_id, report_date, user_id, machine_id, machine_name, machine_hours, start_time, end_time, motor_saat_binis, motor_saat_inis, pile_depths, used_fuel, work_done, note, daily_pile_count, total_production, empty_borehole, pre_borehole, concrete_poured, elmas_miktar, elmas_degisim_yok, bentonit_miktar, kullanilan_malzeme, malzeme_ihtiyaci, servis_ihtiyaci, db_machine_id, image1, image2, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29)
      ON CONFLICT (site_id, report_date, user_id, machine_id)
      DO UPDATE SET
        machine_name = EXCLUDED.machine_name, machine_hours = EXCLUDED.machine_hours,
        start_time = EXCLUDED.start_time, end_time = EXCLUDED.end_time, motor_saat_binis = EXCLUDED.motor_saat_binis, motor_saat_inis = EXCLUDED.motor_saat_inis,
        pile_depths = EXCLUDED.pile_depths, used_fuel = EXCLUDED.used_fuel, work_done = EXCLUDED.work_done, note = EXCLUDED.note,
        daily_pile_count = EXCLUDED.daily_pile_count, total_production = EXCLUDED.total_production,
        empty_borehole = EXCLUDED.empty_borehole, pre_borehole = EXCLUDED.pre_borehole, concrete_poured = EXCLUDED.concrete_poured,
        elmas_miktar = EXCLUDED.elmas_miktar, elmas_degisim_yok = EXCLUDED.elmas_degisim_yok, bentonit_miktar = EXCLUDED.bentonit_miktar,
        kullanilan_malzeme = EXCLUDED.kullanilan_malzeme, malzeme_ihtiyaci = EXCLUDED.malzeme_ihtiyaci, servis_ihtiyaci = EXCLUDED.servis_ihtiyaci,
        db_machine_id = EXCLUDED.db_machine_id,
        image1 = EXCLUDED.image1, image2 = EXCLUDED.image2, notes = EXCLUDED.notes
    `, [
      data.siteId,
      dateStr,
      data.userId,
      data.machineId,
      data.machineName,
      data.machineHours ?? "",
      (data.startTime || "").slice(0, 5) || null,
      (data.endTime || "").slice(0, 5) || null,
      data.motorSaatBinis ?? null,
      data.motorSaatInis ?? null,
      pileDepthsJson,
      data.usedFuel ?? "",
      data.workDone ?? "",
      data.note ?? "",
      data.dailyPileCount ?? "",
      data.totalProduction ?? "",
      data.emptyBorehole ?? "",
      data.preBorehole ?? "",
      data.concretePoured ?? "",
      data.elmasMiktar ?? null,
      data.elmasDegisimYok === true,
      data.bentonitMiktar ?? null,
      data.kullanılanMalzeme ?? null,
      data.malzemeIhtiyaci === true,
      data.servisIhtiyaci === true,
      data.dbMachineId ?? null,
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

/** Super admin: tüm şantiyelerdeki operatör makine girişleri listesi */
export async function getAdminOperatorEntriesList(options: {
  startDate?: string
  endDate?: string
  siteId?: number | null
  limit?: number
}): Promise<Record<string, unknown>[]> {
  const client = await pool.connect()
  try {
    const limit = Math.min(Math.max(options.limit ?? 200, 1), 500)
    let q = `
      SELECT
        oe.id,
        oe.site_id,
        oe.report_date,
        oe.user_id,
        oe.machine_id,
        oe.machine_name,
        oe.machine_hours,
        oe.start_time,
        oe.end_time,
        oe.motor_saat_binis,
        oe.motor_saat_inis,
        oe.used_fuel,
        oe.work_done,
        oe.note,
        oe.daily_pile_count,
        oe.total_production,
        oe.empty_borehole,
        oe.pre_borehole,
        oe.concrete_poured,
        oe.elmas_miktar,
        oe.elmas_degisim_yok,
        oe.bentonit_miktar,
        oe.kullanilan_malzeme,
        oe.malzeme_ihtiyaci,
        oe.servis_ihtiyaci,
        oe.notes,
        oe.created_at,
        u.username AS operator_username,
        s.name AS site_name,
        s.code AS site_code
      FROM operator_entries oe
      LEFT JOIN users u ON u.id = oe.user_id
      LEFT JOIN sites s ON s.id = oe.site_id
      WHERE 1=1
    `
    const params: (string | number)[] = []
    let i = 1
    if (options.startDate) {
      q += ` AND oe.report_date >= $${i++}`
      params.push(options.startDate.slice(0, 10))
    }
    if (options.endDate) {
      q += ` AND oe.report_date <= $${i++}`
      params.push(options.endDate.slice(0, 10))
    }
    if (options.siteId != null && options.siteId > 0) {
      q += ` AND oe.site_id = $${i++}`
      params.push(options.siteId)
    }
    q += ` ORDER BY oe.report_date DESC, oe.id DESC LIMIT $${i}`
    params.push(limit)
    const r = await client.query(q, params)
    return r.rows
  } finally {
    client.release()
  }
}

/** Ülke kodu veya ismine göre IANA timezone döndürür (basit eşleme). */
export function getTimezoneForCountry(country: string | null | undefined): string {
  if (!country || !String(country).trim()) return "Europe/Istanbul"
  const c = String(country).trim().toUpperCase().slice(0, 2)
  const map: Record<string, string> = {
    TR: "Europe/Istanbul",
    IQ: "Asia/Baghdad",
    DE: "Europe/Berlin",
    FR: "Europe/Paris",
    GB: "Europe/London",
    US: "America/New_York",
    SA: "Asia/Riyadh",
    AE: "Asia/Dubai",
  }
  return map[c] || "Europe/Istanbul"
}

/** Operatör biniş/iniş ok butonu: bölgesel saati ve motor saatini kaydet. Satır yoksa minimal satır oluşturur. */
export async function updateOperatorEntryTime(data: {
  siteId: number
  reportDate: string
  userId: number
  machineId: string
  machineName: string
  type: "start" | "end"
  motorSaati: string
  timezone: string
}): Promise<{ startTime?: string; endTime?: string }> {
  const client = await pool.connect()
  try {
    const dateStr = (data.reportDate || "").slice(0, 10)
    const now = new Date()
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: data.timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
    const regionalTime = formatter.format(now).replace("24", "00")
    const hhmm = regionalTime.slice(0, 5)
    const motorVal = (data.motorSaati || "").trim() || null
    if (data.type === "start") {
      await client.query(
        `INSERT INTO operator_entries (site_id, report_date, user_id, machine_id, machine_name, start_time, motor_saat_binis)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (site_id, report_date, user_id, machine_id)
         DO UPDATE SET start_time = EXCLUDED.start_time, motor_saat_binis = EXCLUDED.motor_saat_binis`,
        [data.siteId, dateStr, data.userId, data.machineId, data.machineName, hhmm, motorVal]
      )
      return { startTime: hhmm }
    } else {
      await client.query(
        `INSERT INTO operator_entries (site_id, report_date, user_id, machine_id, machine_name, end_time, motor_saat_inis)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (site_id, report_date, user_id, machine_id)
         DO UPDATE SET end_time = EXCLUDED.end_time, motor_saat_inis = EXCLUDED.motor_saat_inis`,
        [data.siteId, dateStr, data.userId, data.machineId, data.machineName, hhmm, motorVal]
      )
      return { endTime: hhmm }
    }
  } catch (error) {
    console.error("Error updating operator entry time:", error)
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

  // İdari modülden eklenen harcamaları (work_report_id IS NULL) ayrıca istatistiklere ekle
  try {
    const client2 = await pool.connect()
    try {
      let iQuery = `SELECT i.islem_tarihi, i.tutar, hk.kod as kat_kod
        FROM islemler i
        JOIN harcama_kategorileri hk ON hk.id = i.kategori_id
        WHERE i.work_report_id IS NULL`
      const iParams: (string | number)[] = []
      let pi = 1
      if (options.siteId != null) { iQuery += ` AND i.site_id = $${pi++}`; iParams.push(options.siteId) }
      if (options.startDate) { iQuery += ` AND i.islem_tarihi >= $${pi++}`; iParams.push(options.startDate.slice(0, 10)) }
      if (options.endDate) { iQuery += ` AND i.islem_tarihi <= $${pi++}`; iParams.push(options.endDate.slice(0, 10)) }
      const iRows = await client2.query(iQuery, iParams)
      // Kategori kodu → form kategorisi eşleştirmesi
      const idariCatMap: Record<string, string> = { sarf: 'santiye', akaryakit: 'yakit', yemek: 'personel', tason: 'diger', maas: 'personel', diger: 'diger' }
      for (const ir of iRows.rows) {
        const dateStr = typeof ir.islem_tarihi === 'string' ? ir.islem_tarihi.slice(0, 10) : ir.islem_tarihi?.toISOString?.()?.slice(0, 10) ?? ''
        if (!dateStr) continue
        const d = new Date(dateStr)
        const dayLabel = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`
        const weekKey = getWeekKey(d)
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        const amt = parseFloat(ir.tutar) || 0

        if (!daily[dateStr]) daily[dateStr] = { date: dateStr, dayLabel, piles: 0, fuel: 0, production: 0, expenses: 0, reportCount: 0 }
        daily[dateStr].expenses += amt
        if (!weekly[weekKey]) weekly[weekKey] = { piles: 0, fuel: 0, production: 0, expenses: 0, reportCount: 0 }
        weekly[weekKey].expenses += amt
        if (!monthly[monthKey]) monthly[monthKey] = { piles: 0, fuel: 0, production: 0, expenses: 0, reportCount: 0 }
        monthly[monthKey].expenses += amt
      }
    } finally {
      client2.release()
    }
  } catch { /* İdari harcamalar getirilemezse sessizce devam et */ }

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

  // Harcama dağılımı: rapor harcamaları + idari modül harcamaları (work_report_id IS NULL)
  const expenseDistribution: Record<string, number> = { santiye: 0, makine: 0, personel: 0, yakit: 0, diger: 0 }
  for (const r of rows) {
    if (r.expenses && Array.isArray(r.expenses)) {
      for (const e of r.expenses as { amount?: number; category?: string }[]) {
        const cat = (e?.category && expenseDistribution.hasOwnProperty(e.category)) ? e.category : 'diger'
        expenseDistribution[cat] = (expenseDistribution[cat] || 0) + (e?.amount || 0)
      }
    }
  }
  // İdari modül harcamalarını (work_report_id IS NULL) expenseDistribution'a ekle
  try {
    const client3 = await pool.connect()
    try {
      let dQuery = `SELECT i.tutar, hk.kod as kat_kod FROM islemler i JOIN harcama_kategorileri hk ON hk.id = i.kategori_id WHERE i.work_report_id IS NULL`
      const dParams: (string | number)[] = []
      let pi = 1
      if (options.siteId != null) { dQuery += ` AND i.site_id = $${pi++}`; dParams.push(options.siteId) }
      if (options.startDate) { dQuery += ` AND i.islem_tarihi >= $${pi++}`; dParams.push(options.startDate.slice(0, 10)) }
      if (options.endDate) { dQuery += ` AND i.islem_tarihi <= $${pi++}`; dParams.push(options.endDate.slice(0, 10)) }
      const dRows = await client3.query(dQuery, dParams)
      const idariCatMap: Record<string, string> = { sarf: 'santiye', akaryakit: 'yakit', yemek: 'personel', tason: 'diger', maas: 'personel', diger: 'diger' }
      for (const dr of dRows.rows) {
        const cat = idariCatMap[dr.kat_kod] ?? 'diger'
        expenseDistribution[cat] = (expenseDistribution[cat] || 0) + (parseFloat(dr.tutar) || 0)
      }
    } finally {
      client3.release()
    }
  } catch { /* İdari harcamalar getirilemezse sessizce devam et */ }

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

// Makine id -> ad (eski şema / sabit liste; DB makineleri önceliklidir)
const MACHINE_ID_TO_NAME: Record<string, string> = {
  'xcmg-sr220': 'XCMG SR220',
  'sany-sr235': 'SANY SR235',
  'sany-sr285': 'SANY SR285',
  'soiltec-sr60': 'SOILMEC SR60',
}

async function resolveMachineLabelForPersonel(client: { query: (q: string, p?: unknown[]) => Promise<{ rows: { name?: string }[] }> }, machineId: string): Promise<string> {
  const num = parseInt(machineId, 10)
  if (!Number.isNaN(num) && num > 0) {
    const r = await client.query(`SELECT name FROM machines WHERE id = $1`, [num])
    if (r.rows[0]?.name) return String(r.rows[0].name)
  }
  return MACHINE_ID_TO_NAME[machineId] || machineId
}

/** Şantiyedeki tüm makinelerin konumunu sıfırlar; bu makinelerdeki açık operatör atamalarına bitiş tarihi verir. */
export async function releaseMachinesFromSite(siteId: number): Promise<void> {
  const client = await pool.connect()
  try {
    await client.query(
      `UPDATE machine_operator_atama moa
       SET bitis_tarihi = CURRENT_DATE
       FROM machines m
       WHERE moa.machine_id = m.id AND m.current_site_id = $1 AND moa.bitis_tarihi IS NULL`,
      [siteId],
    )
    await client.query(
      `UPDATE machines SET current_site_id = NULL, updated_at = NOW() WHERE current_site_id = $1`,
      [siteId],
    )
  } finally {
    client.release()
  }
}

/** Şantiyeyi pasif yapar. releaseMachines true ise makineler şantiyeden çıkarılır (operatör atamaları kapatılır). */
export async function softDeleteSite(siteId: number, releaseMachines = true): Promise<boolean> {
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    if (releaseMachines) {
      await client.query(
        `UPDATE machine_operator_atama moa
         SET bitis_tarihi = CURRENT_DATE
         FROM machines m
         WHERE moa.machine_id = m.id AND m.current_site_id = $1 AND moa.bitis_tarihi IS NULL`,
        [siteId],
      )
      await client.query(
        `UPDATE machines SET current_site_id = NULL, updated_at = NOW() WHERE current_site_id = $1`,
        [siteId],
      )
    }
    const r = await client.query(
      `UPDATE sites SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id`,
      [siteId],
    )
    await client.query("COMMIT")
    return (r.rowCount ?? 0) > 0
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {})
    throw e
  } finally {
    client.release()
  }
}

/** İdari makineler tablosu: seçilen makineleri şantiyeye bağlar, operatör atamalarını günceller. */
export async function syncSiteMachineAssignments(
  siteId: number,
  assignedMachineIds: string[],
  assignedMachineOperators: { machineId: string; personelId: number }[],
): Promise<void> {
  const numericIds = [...new Set(assignedMachineIds.map((x) => parseInt(String(x), 10)).filter((n) => !Number.isNaN(n) && n > 0))]
  const client = await pool.connect()
  try {
    if (numericIds.length === 0) {
      await client.query(
        `UPDATE machine_operator_atama moa
         SET bitis_tarihi = CURRENT_DATE
         FROM machines m
         WHERE moa.machine_id = m.id AND m.current_site_id = $1 AND moa.bitis_tarihi IS NULL`,
        [siteId],
      )
      await client.query(`UPDATE machines SET current_site_id = NULL, updated_at = NOW() WHERE current_site_id = $1`, [siteId])
    } else {
      await client.query(
        `UPDATE machines SET current_site_id = NULL, updated_at = NOW() WHERE current_site_id = $1 AND NOT (id = ANY($2::int[]))`,
        [siteId, numericIds],
      )
      await client.query(
        `UPDATE machines SET current_site_id = $1, updated_at = NOW() WHERE id = ANY($2::int[])`,
        [siteId, numericIds],
      )
    }
  } finally {
    client.release()
  }
  for (const mid of numericIds) {
    const pids = assignedMachineOperators
      .filter((o) => String(o.machineId) === String(mid))
      .map((o) => o.personelId)
      .filter((id) => id > 0)
    await upsertMachineOperators(mid, pids)
  }
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
export async function getSitesWithReportCount(
  siteId?: number | null,
  options?: { includeInactive?: boolean },
) {
  const includeInactive = options?.includeInactive === true
  const client = await pool.connect()
  try {
    const activeClause = includeInactive ? "TRUE" : "s.is_active = true"
    const query = siteId != null
      ? `
      SELECT s.*,
        (SELECT COUNT(*) FROM work_reports wr WHERE wr.site_id = s.id) AS report_count
      FROM sites s
      WHERE ${activeClause} AND s.id = $1
      ORDER BY s.is_active DESC, s.name
      `
      : `
      SELECT s.*,
        (SELECT COUNT(*) FROM work_reports wr WHERE wr.site_id = s.id) AS report_count
      FROM sites s
      WHERE ${activeClause}
      ORDER BY s.is_active DESC, s.name
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

export type RecalculateRemainingPilesRow = {
  id: number
  date: string
  oldRemaining: string | null
  newRemaining: string
}

/**
 * Şantiye kartında toplam kazık, "devam eden proje" ve rapor öncesi yapılan kazık güncellendikten sonra
 * o şantiyeye ait tüm raporların `remaining_piles` değerini tarih sırasıyla yeniden yazar.
 * Mantık `app/api/send-report/route.ts` ile uyumludur.
 */
export async function recalculateRemainingPilesForSite(siteId: number): Promise<{
  skippedReason?: "NO_TOTAL_PILES" | "SITE_NOT_FOUND"
  updatedCount: number
  rows: RecalculateRemainingPilesRow[]
}> {
  const site = await getSiteById(siteId)
  if (!site) {
    return { skippedReason: "SITE_NOT_FOUND", updatedCount: 0, rows: [] }
  }
  const totalPiles = site.total_piles != null ? Number(site.total_piles) : null
  if (totalPiles == null || Number.isNaN(totalPiles)) {
    return { skippedReason: "NO_TOTAL_PILES", updatedCount: 0, rows: [] }
  }
  const isOngoing = site.is_ongoing === true
  const initialPilesDone =
    site.initial_piles_done != null && !Number.isNaN(Number(site.initial_piles_done))
      ? Number(site.initial_piles_done)
      : null

  const client = await pool.connect()
  const rows: RecalculateRemainingPilesRow[] = []
  try {
    await client.query("BEGIN")
    const result = await client.query<{
      id: number
      date: string
      daily_pile_count: string | null
      concrete_poured: string | null
      remaining_piles: string | null
    }>(
      `SELECT id, date::text AS date, daily_pile_count, concrete_poured, remaining_piles
       FROM work_reports WHERE site_id = $1 ORDER BY date ASC, id ASC`,
      [siteId]
    )
    let prevRemaining: number | null = null
    for (const row of result.rows) {
      let cumulativeDoneBeforeToday = 0
      if (prevRemaining != null) {
        cumulativeDoneBeforeToday = totalPiles - prevRemaining
      } else if (isOngoing && initialPilesDone != null) {
        cumulativeDoneBeforeToday = initialPilesDone
      }
      let todayPiles = 0
      const dailyRaw = row.daily_pile_count != null ? String(row.daily_pile_count).trim() : ""
      const concRaw = row.concrete_poured != null ? String(row.concrete_poured).trim() : ""
      const dailyParsed = dailyRaw ? parseInt(dailyRaw, 10) : NaN
      if (!Number.isNaN(dailyParsed)) {
        todayPiles = Math.max(0, dailyParsed)
      } else {
        const concParsed = concRaw ? parseInt(concRaw, 10) : NaN
        if (!Number.isNaN(concParsed)) todayPiles = Math.max(0, concParsed)
      }
      const newRemaining = Math.max(0, totalPiles - cumulativeDoneBeforeToday - todayPiles)
      const newRemainingStr = String(newRemaining)
      const dateStr = (row.date || "").slice(0, 10)
      const oldStr = row.remaining_piles != null ? String(row.remaining_piles) : null
      if (oldStr !== newRemainingStr) {
        await client.query(
          `UPDATE work_reports SET remaining_piles = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
          [newRemainingStr, row.id]
        )
        rows.push({ id: row.id, date: dateStr, oldRemaining: oldStr, newRemaining: newRemainingStr })
      }
      prevRemaining = newRemaining
    }
    await client.query("COMMIT")
    return { updatedCount: rows.length, rows }
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {})
    console.error("recalculateRemainingPilesForSite:", error)
    throw error
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
  assignedMachineOperators?: { machineId: string; personelId: number }[]
  timezone?: string | null
  contractUnitPrice?: number | null
  /** 1 USD = kaç IQD */
  iqdPerUsd?: number | null
}) {
  const client = await pool.connect()
  try {
    const ops = data.assignedMachineOperators || []
    const iqdUsd = data.iqdPerUsd != null && !Number.isNaN(Number(data.iqdPerUsd)) && Number(data.iqdPerUsd) > 0 ? Number(data.iqdPerUsd) : 1320
    const result = await client.query(
      `INSERT INTO sites (name, code, email_list, total_piles, region, city, country, authorized_person, employer, project_start_date, is_ongoing, initial_piles_done, assigned_machine_ids, assigned_operator_ids, assigned_machine_operators, timezone, contract_unit_price, iqd_per_usd)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) RETURNING *`,
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
        JSON.stringify(ops),
        data.timezone ?? null,
        data.contractUnitPrice ?? null,
        iqdUsd,
      ]
    )
    const newSite = result.rows[0]
    await syncSiteMachineAssignments(newSite.id, data.assignedMachineIds || [], ops)
    const today = new Date().toISOString().slice(0, 10)
    const seenCreate = new Set<number>()
    for (const { machineId, personelId } of ops) {
      const machineName = await resolveMachineLabelForPersonel(client, machineId)
      await client.query(`UPDATE personeller SET calistigi_bolum = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [machineName, personelId])
      if (!seenCreate.has(personelId)) {
        seenCreate.add(personelId)
        await client.query(`
          INSERT INTO personel_atama (personel_id, site_id, baslangic_tarihi)
          VALUES ($1, $2, $3)
          ON CONFLICT (personel_id, site_id, baslangic_tarihi) DO NOTHING
        `, [personelId, newSite.id, today])
      }
    }
    return newSite
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
  assignedMachineOperators?: { machineId: string; personelId: number }[]
  budget?: number | null
  timezone?: string | null
  contractUnitPrice?: number | null
  iqdPerUsd?: number | null
}) {
  const client = await pool.connect()
  try {
    const updates: string[] = []
    const values: (string | number | boolean | null)[] = []
    let i = 1
    if (data.name !== undefined) { updates.push(`name = $${i++}`); values.push(data.name) }
    if (data.budget !== undefined) { updates.push(`budget = $${i++}`); values.push(data.budget) }
    if (data.contractUnitPrice !== undefined) { updates.push(`contract_unit_price = $${i++}`); values.push(data.contractUnitPrice) }
    if (data.iqdPerUsd !== undefined) { updates.push(`iqd_per_usd = $${i++}`); values.push(data.iqdPerUsd) }
    if (data.timezone !== undefined) { updates.push(`timezone = $${i++}`); values.push(data.timezone) }
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
    if (data.assignedMachineOperators !== undefined) { updates.push(`assigned_machine_operators = $${i++}`); values.push(JSON.stringify(data.assignedMachineOperators)) }
    if (updates.length === 0) return await getSiteById(id)
    updates.push(`updated_at = CURRENT_TIMESTAMP`)
    values.push(id)
    const result = await client.query(
      `UPDATE sites SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    )
    const ops = data.assignedMachineOperators || []
    if (data.assignedMachineIds !== undefined) {
      await syncSiteMachineAssignments(id, data.assignedMachineIds, ops)
    }
    const today = new Date().toISOString().slice(0, 10)
    const seenPersonelIds = new Set<number>()
    for (const { machineId, personelId } of ops) {
      const machineName = await resolveMachineLabelForPersonel(client, machineId)
      await client.query(`UPDATE personeller SET calistigi_bolum = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [machineName, personelId])
      // personel_atama sync: eğer bu şantiyede aktif atama yoksa yeni kayıt oluştur
      if (!seenPersonelIds.has(personelId)) {
        seenPersonelIds.add(personelId)
        await client.query(`
          INSERT INTO personel_atama (personel_id, site_id, baslangic_tarihi)
          VALUES ($1, $2, $3)
          ON CONFLICT (personel_id, site_id, baslangic_tarihi) DO NOTHING
        `, [personelId, id, today])
      }
    }
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

export type GlobalAdminPanelSettings = {
  emails: string[]
  users: string[]
  customFields: string[]
  totalPiles: string
}

const GLOBAL_ADMIN_DEFAULTS: GlobalAdminPanelSettings = {
  emails: ["admin@company.com", "manager@company.com"],
  users: ["admin", "manager"],
  customFields: ["Extra Field 1", "Extra Field 2"],
  totalPiles: "100",
}

function parseJsonStringArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.map((x) => String(x).trim()).filter(Boolean)
  if (val != null && typeof val === "object") return []
  return []
}

function uniqueEmailAddresses(addresses: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of addresses) {
    const t = String(raw ?? "").trim()
    if (!t) continue
    const k = t.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    out.push(t)
  }
  return out
}

export async function getGlobalAdminPanelSettings(): Promise<GlobalAdminPanelSettings> {
  await initializeDatabase()
  const client = await pool.connect()
  try {
    const r = await client.query(
      `SELECT emails, users, custom_fields, total_piles FROM global_admin_settings WHERE id = 1`
    )
    const row = r.rows[0]
    if (!row) {
      return {
        emails: [...GLOBAL_ADMIN_DEFAULTS.emails],
        users: [...GLOBAL_ADMIN_DEFAULTS.users],
        customFields: [...GLOBAL_ADMIN_DEFAULTS.customFields],
        totalPiles: GLOBAL_ADMIN_DEFAULTS.totalPiles,
      }
    }
    return {
      emails: parseJsonStringArray(row.emails),
      users: parseJsonStringArray(row.users),
      customFields: parseJsonStringArray(row.custom_fields),
      totalPiles: String(row.total_piles ?? GLOBAL_ADMIN_DEFAULTS.totalPiles),
    }
  } finally {
    client.release()
  }
}

export async function saveGlobalAdminPanelSettings(data: {
  emails: string[]
  users: string[]
  customFields: string[]
  totalPiles: string
}): Promise<GlobalAdminPanelSettings> {
  await initializeDatabase()
  const client = await pool.connect()
  try {
    await client.query(
      `INSERT INTO global_admin_settings (id, emails, users, custom_fields, total_piles, updated_at)
       VALUES (1, $1::jsonb, $2::jsonb, $3::jsonb, $4, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO UPDATE SET
         emails = EXCLUDED.emails,
         users = EXCLUDED.users,
         custom_fields = EXCLUDED.custom_fields,
         total_piles = EXCLUDED.total_piles,
         updated_at = CURRENT_TIMESTAMP`,
      [
        JSON.stringify(data.emails.filter((e) => e?.trim())),
        JSON.stringify(data.users.filter((u) => u?.trim())),
        JSON.stringify(data.customFields.filter((f) => f?.trim())),
        data.totalPiles,
      ]
    )
    return await getGlobalAdminPanelSettings()
  } finally {
    client.release()
  }
}

/**
 * Rapor / günlük özet bildirimleri: SMTP_USER + global_admin_settings.emails + sites.email_list + isteğe bağlı ek adresler (tekilleştirilmiş).
 */
export async function getMergedNotificationEmails(options: {
  siteId: number | null
  extraRecipients?: string[]
}): Promise<string[]> {
  await initializeDatabase()
  const smtp = process.env.SMTP_USER?.trim() || ""
  const global = await getGlobalAdminPanelSettings()
  const siteEmails = await getSiteReportEmails(options.siteId)
  const extra = (options.extraRecipients ?? []).map((e) => String(e).trim()).filter(Boolean)
  return uniqueEmailAddresses([smtp, ...global.emails, ...siteEmails, ...extra])
}

export async function getSuperAdminEmails(): Promise<string[]> {
  const client = await pool.connect()
  try {
    const r = await client.query(
      `SELECT email FROM users WHERE role = 'super_admin' AND email IS NOT NULL AND TRIM(email) <> '' ORDER BY id`
    )
    return r.rows.map((row: { email: string }) => String(row.email).trim()).filter(Boolean)
  } finally {
    client.release()
  }
}

/** Şantiye bazında verilen tarihe kadar kümülatif toplam imalat (metre). */
export async function getCumulativeTotalProduction(siteId: number, date: string): Promise<number> {
  const client = await pool.connect()
  try {
    const d = (date || "").slice(0, 10)
    const r = await client.query(
      `SELECT COALESCE(SUM(
          CASE
            WHEN COALESCE(total_production_summary, '') ~ '^[0-9]+([\\.,][0-9]+)?$'
              THEN REPLACE(total_production_summary, ',', '.')::numeric
            ELSE 0
          END
        ), 0) AS toplam
       FROM work_reports
       WHERE site_id = $1 AND date <= $2`,
      [siteId, d]
    )
    return parseFloat(String(r.rows[0]?.toplam ?? "0")) || 0
  } finally {
    client.release()
  }
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

const GOREV_YERI_ORDER_SUBQ = `(SELECT s2.name FROM personel_atama pa2 LEFT JOIN sites s2 ON s2.id = pa2.site_id WHERE pa2.personel_id = p.id AND (pa2.bitis_tarihi IS NULL OR pa2.bitis_tarihi >= CURRENT_DATE) ORDER BY pa2.baslangic_tarihi DESC NULLS LAST LIMIT 1)`

/** Takvim ayı — onaylı puantaj adam-gün toplamı (liste kolonu). */
const AY_PUANTAJ_CARPAN_SUB = `(SELECT COALESCE(SUM(pu.carpan), 0)::numeric FROM puantaj pu WHERE pu.personel_id = p.id AND pu.durum = 'onaylandi' AND pu.tarih >= date_trunc('month', CURRENT_DATE)::date AND pu.tarih < (date_trunc('month', CURRENT_DATE) + interval '1 month')::date)`

/** Görev metnine göre şantiye hiyerarşisi (düşük sayı = üst kademe). */
const PERSONEL_GOREV_RANK_SQL = `(CASE
  WHEN p.gorev ~* 'proje.*(müdür|mudur)|project.*manager' THEN 1
  WHEN p.gorev ~* 'şantiye.*şef|santiye.*sef' THEN 2
  WHEN p.gorev ~* 'mühendis|muhendis' THEN 3
  WHEN p.gorev ~* 'formen|foreman' THEN 4
  WHEN p.gorev ~* 'operatör|operator' THEN 5
  WHEN p.gorev ~* 'satın.*alma|satin.*alma' THEN 6
  WHEN p.gorev ~* 'yağcı|yagci' THEN 7
  WHEN p.gorev ~* 'teknisyen' THEN 8
  WHEN p.gorev ~* 'işçi|isci|işci' THEN 99
  ELSE 50
END)`

function personelOrderClause(sortBy?: string | null, sortDir?: string | null): string {
  const dir = sortDir?.toLowerCase() === "desc" ? "DESC" : "ASC"
  const key = String(sortBy || "").trim() || "ad_soyad"
  let order: string
  switch (key) {
    case "gorev_oncelik":
      order = `${PERSONEL_GOREV_RANK_SQL} ${dir} NULLS LAST, p.soyad ASC, p.ad ASC`
      break
    case "gorev":
      order = `p.gorev ${dir} NULLS LAST`
      break
    case "kimlik":
      order = `COALESCE(NULLIF(TRIM(p.tc_kimlik), ''), NULLIF(TRIM(p.pasaport_no), '')) ${dir} NULLS LAST`
      break
    case "gorev_yeri":
      order = `${GOREV_YERI_ORDER_SUBQ} ${dir} NULLS LAST`
      break
    case "ucret":
      order = `GREATEST(
        COALESCE(p.gunluk_yevmiye_iqd, 0), COALESCE(p.gunluk_yevmiye_usd, 0),
        COALESCE(p.aylik_maas_iqd, 0), COALESCE(p.aylik_maas_usd, 0),
        COALESCE(p.gunluk_yevmiye, 0), COALESCE(p.aylik_maas, 0)
      ) ${dir} NULLS LAST`
      break
    case "ad_soyad":
    default:
      order = `p.soyad ${dir} NULLS LAST, p.ad ${dir} NULLS LAST`
      break
  }
  return ` ORDER BY ${order}, p.id ASC`
}

// ---------- İdari modül: Personel ----------
export async function getPersoneller(options: {
  siteId?: number | null
  gorev?: string | null
  limit?: number
  offset?: number
  search?: string
  arsiv?: boolean
  sortBy?: string | null
  sortDir?: "asc" | "desc" | null
} = {}) {
  const client = await pool.connect()
  try {
    const { siteId, gorev, limit, offset, search, arsiv } = options
    const params: (number | string | boolean)[] = []
    let i = 1
    const atamalarSubq = `(SELECT json_agg(json_build_object('id', pa.id, 'site_id', pa.site_id, 'site_name', s.name, 'baslangic_tarihi', pa.baslangic_tarihi, 'bitis_tarihi', pa.bitis_tarihi)) FROM personel_atama pa LEFT JOIN sites s ON pa.site_id = s.id WHERE pa.personel_id = p.id) AS atamalar`

    // Aktif/arşiv filtresi
    const arsivFilter = arsiv === true
      ? `AND (p.isten_cikis_tarihi IS NOT NULL AND p.isten_cikis_tarihi <= CURRENT_DATE)`
      : arsiv === false
        ? `AND (p.isten_cikis_tarihi IS NULL OR p.isten_cikis_tarihi > CURRENT_DATE)`
        : ``

    if (siteId != null && siteId > 0) {
      const query = `SELECT p.*, ${atamalarSubq}, ${AY_PUANTAJ_CARPAN_SUB} AS ay_puantaj_carpan FROM personeller p WHERE EXISTS (SELECT 1 FROM personel_atama pa WHERE pa.personel_id = p.id AND pa.site_id = $1 AND (pa.bitis_tarihi IS NULL OR pa.bitis_tarihi >= CURRENT_DATE)) ${arsivFilter}${personelOrderClause(options.sortBy, options.sortDir)}`
      const result = await client.query(query, [siteId])
      return result.rows
    }

    let query = `SELECT p.*, ${atamalarSubq}, ${AY_PUANTAJ_CARPAN_SUB} AS ay_puantaj_carpan FROM personeller p WHERE 1=1 ${arsivFilter}`
    if (gorev && String(gorev).trim()) {
      query += ` AND p.gorev = $${i++}`
      params.push(String(gorev).trim())
    }
    if (search && String(search).trim()) {
      const s = `%${String(search).trim()}%`
      query += ` AND (p.ad ILIKE $${i} OR p.soyad ILIKE $${i} OR p.gorev ILIKE $${i})`
      params.push(s)
      i++
    }
    query += personelOrderClause(options.sortBy, options.sortDir)
    if (limit && limit > 0) {
      query += ` LIMIT $${i++}`
      params.push(limit)
    }
    if (offset && offset > 0) {
      query += ` OFFSET $${i++}`
      params.push(offset)
    }
    const result = params.length ? await client.query(query, params) : await client.query(query)
    return result.rows
  } finally {
    client.release()
  }
}

export async function getPersonellerCount(options: { siteId?: number | null; gorev?: string | null; search?: string; arsiv?: boolean } = {}): Promise<number> {
  const client = await pool.connect()
  try {
    const { siteId, gorev, search, arsiv } = options
    const params: (number | string)[] = []
    let i = 1

    const arsivFilter = arsiv === true
      ? `AND (p.isten_cikis_tarihi IS NOT NULL AND p.isten_cikis_tarihi <= CURRENT_DATE)`
      : arsiv === false
        ? `AND (p.isten_cikis_tarihi IS NULL OR p.isten_cikis_tarihi > CURRENT_DATE)`
        : ``

    if (siteId != null && siteId > 0) {
      const r = await client.query(`SELECT COUNT(*) FROM personeller p WHERE EXISTS (SELECT 1 FROM personel_atama pa WHERE pa.personel_id = p.id AND pa.site_id = $1 AND (pa.bitis_tarihi IS NULL OR pa.bitis_tarihi >= CURRENT_DATE)) ${arsivFilter}`, [siteId])
      return parseInt(r.rows[0].count, 10)
    }
    let query = `SELECT COUNT(*) FROM personeller p WHERE 1=1 ${arsivFilter}`
    if (gorev && String(gorev).trim()) {
      query += ` AND p.gorev = $${i++}`
      params.push(String(gorev).trim())
    }
    if (search && String(search).trim()) {
      const s = `%${String(search).trim()}%`
      query += ` AND (p.ad ILIKE $${i} OR p.soyad ILIKE $${i} OR p.gorev ILIKE $${i})`
      params.push(s)
      i++
    }
    const r = params.length ? await client.query(query, params) : await client.query(query)
    return parseInt(r.rows[0].count, 10)
  } finally {
    client.release()
  }
}

export async function upsertPersonelAtama(personelId: number, siteId: number, baslangicTarihi?: string) {
  const client = await pool.connect()
  try {
    const today = baslangicTarihi || new Date().toISOString().slice(0, 10)
    // Yeni şantiye başlangıcından itibaren tek aktif atama kalsın:
    // diğer şantiyelerdeki aktif atamaları bir gün önce bitir.
    await client.query(
      `UPDATE personel_atama
       SET bitis_tarihi = ($1::date - INTERVAL '1 day')::date
       WHERE personel_id = $2
         AND site_id != $3
         AND (bitis_tarihi IS NULL OR bitis_tarihi >= $1::date)`,
      [today, personelId, siteId]
    )
    // Upsert active atama for this site
    const exists = await client.query(
      `SELECT id FROM personel_atama
       WHERE personel_id = $1 AND site_id = $2 AND (bitis_tarihi IS NULL OR bitis_tarihi >= $3::date)
       LIMIT 1`,
      [personelId, siteId, today]
    )
    if (exists.rowCount === 0) {
      await client.query(
        `INSERT INTO personel_atama (personel_id, site_id, baslangic_tarihi) VALUES ($1, $2, $3)`,
        [personelId, siteId, today]
      )
    }
  } finally {
    client.release()
  }
}

export async function getPersonelById(id: number) {
  const client = await pool.connect()
  try {
    const r = await client.query(
      `SELECT * FROM personeller WHERE id = $1`,
      [id]
    )
    if (!r.rows[0]) return null
    const atamalar = await client.query(
      `SELECT pa.*, s.name AS site_name FROM personel_atama pa LEFT JOIN sites s ON pa.site_id = s.id WHERE pa.personel_id = $1 ORDER BY pa.baslangic_tarihi DESC`,
      [id]
    )
    return { ...r.rows[0], atamalar: atamalar.rows }
  } finally {
    client.release()
  }
}

export async function createPersonel(data: {
  ad: string
  soyad: string
  tc_kimlik?: string | null
  pasaport_no?: string | null
  dogum_tarihi?: string | null
  kan_grubu?: string | null
  acil_iletisim?: string | null
  acil_telefon?: string | null
  gorev: string
  ise_giris_tarihi?: string | null
  isten_cikis_tarihi?: string | null
  calistigi_bolum?: string | null
  sigorta_durumu?: string | null
  iban?: string | null
  banka_adi?: string | null
  /** Eski tek sütun; IQD yevmiye olarak saklanır (Excel/import uyumu) */
  gunluk_yevmiye?: number | null
  aylik_maas?: number | null
  gunluk_yevmiye_usd?: number | null
  gunluk_yevmiye_iqd?: number | null
  aylik_maas_usd?: number | null
  aylik_maas_iqd?: number | null
  foto_yolu?: string | null
}) {
  const client = await pool.connect()
  try {
    const gIqd = data.gunluk_yevmiye_iqd ?? data.gunluk_yevmiye ?? null
    const gUsd = data.gunluk_yevmiye_usd ?? null
    const aIqd = data.aylik_maas_iqd ?? data.aylik_maas ?? null
    const aUsd = data.aylik_maas_usd ?? null
    const r = await client.query(`
      INSERT INTO personeller (ad, soyad, tc_kimlik, pasaport_no, dogum_tarihi, kan_grubu, acil_iletisim, acil_telefon, gorev, ise_giris_tarihi, isten_cikis_tarihi, calistigi_bolum, sigorta_durumu, iban, banka_adi, gunluk_yevmiye, aylik_maas, gunluk_yevmiye_usd, gunluk_yevmiye_iqd, aylik_maas_usd, aylik_maas_iqd, foto_yolu)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NULL, NULL, $16, $17, $18, $19, $20)
      RETURNING id
    `, [
      data.ad, data.soyad, data.tc_kimlik ?? null, data.pasaport_no ?? null, data.dogum_tarihi ?? null, data.kan_grubu ?? null,
      data.acil_iletisim ?? null, data.acil_telefon ?? null, data.gorev || 'İşçi', data.ise_giris_tarihi ?? null,
      data.isten_cikis_tarihi ?? null, data.calistigi_bolum ?? null, data.sigorta_durumu ?? null, data.iban ?? null, data.banka_adi ?? null,
      gUsd, gIqd, aUsd, aIqd, data.foto_yolu ?? null,
    ])
    return r.rows[0].id
  } finally {
    client.release()
  }
}

export async function updatePersonel(id: number, data: Partial<{
  ad: string
  soyad: string
  tc_kimlik: string | null
  pasaport_no: string | null
  dogum_tarihi: string | null
  kan_grubu: string | null
  acil_iletisim: string | null
  acil_telefon: string | null
  gorev: string
  ise_giris_tarihi: string | null
  isten_cikis_tarihi: string | null
  calistigi_bolum: string | null
  sigorta_durumu: string | null
  iban: string | null
  banka_adi: string | null
  gunluk_yevmiye: number | null
  aylik_maas: number | null
  gunluk_yevmiye_usd: number | null
  gunluk_yevmiye_iqd: number | null
  aylik_maas_usd: number | null
  aylik_maas_iqd: number | null
  foto_yolu: string | null
}>) {
  const client = await pool.connect()
  try {
    const fields = ['ad', 'soyad', 'tc_kimlik', 'pasaport_no', 'dogum_tarihi', 'kan_grubu', 'acil_iletisim', 'acil_telefon', 'gorev', 'ise_giris_tarihi', 'isten_cikis_tarihi', 'calistigi_bolum', 'sigorta_durumu', 'iban', 'banka_adi', 'gunluk_yevmiye', 'aylik_maas', 'gunluk_yevmiye_usd', 'gunluk_yevmiye_iqd', 'aylik_maas_usd', 'aylik_maas_iqd', 'foto_yolu']
    const updates: string[] = []
    const values: unknown[] = []
    let i = 1
    for (const f of fields) {
      if (data[f as keyof typeof data] !== undefined) {
        updates.push(`${f} = $${i++}`)
        values.push(data[f as keyof typeof data])
      }
    }
    if (updates.length === 0) return
    updates.push(`updated_at = CURRENT_TIMESTAMP`)
    values.push(id)
    await client.query(`UPDATE personeller SET ${updates.join(', ')} WHERE id = $${i}`, values)
  } finally {
    client.release()
  }
}

export async function deletePersonel(id: number) {
  const client = await pool.connect()
  try {
    const result = await client.query(`DELETE FROM personeller WHERE id = $1 RETURNING id`, [id])
    return (result.rowCount ?? 0) > 0
  } finally {
    client.release()
  }
}

export async function getPersonelAtamalar(personelId: number) {
  const client = await pool.connect()
  try {
    const r = await client.query(
      `SELECT pa.*, s.name AS site_name FROM personel_atama pa LEFT JOIN sites s ON pa.site_id = s.id WHERE pa.personel_id = $1 ORDER BY pa.baslangic_tarihi DESC`,
      [personelId]
    )
    return r.rows
  } finally {
    client.release()
  }
}

export async function addPersonelAtama(data: { personel_id: number; site_id: number; baslangic_tarihi: string; bitis_tarihi?: string | null }) {
  const client = await pool.connect()
  try {
    const start = (data.baslangic_tarihi || '').slice(0, 10)
    // Personel yeni şantiyeye geçtiği tarihten itibaren eski aktif atamalar sonlandırılır.
    await client.query(
      `UPDATE personel_atama
       SET bitis_tarihi = ($1::date - INTERVAL '1 day')::date
       WHERE personel_id = $2
         AND site_id != $3
         AND (bitis_tarihi IS NULL OR bitis_tarihi >= $1::date)`,
      [start, data.personel_id, data.site_id]
    )
    const r = await client.query(`
      INSERT INTO personel_atama (personel_id, site_id, baslangic_tarihi, bitis_tarihi)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (personel_id, site_id, baslangic_tarihi) DO NOTHING
      RETURNING id
    `, [data.personel_id, data.site_id, start, data.bitis_tarihi ? (data.bitis_tarihi as string).slice(0, 10) : null])
    return r.rows[0]?.id
  } finally {
    client.release()
  }
}

export async function updatePersonelAtamaById(
  personelId: number,
  atamaId: number,
  patch: { site_id?: number; baslangic_tarihi?: string; bitis_tarihi?: string | null }
): Promise<{ ok: true } | { ok: false; error: 'not_found' | 'duplicate' }> {
  const client = await pool.connect()
  try {
    const cur = await client.query(`SELECT * FROM personel_atama WHERE id = $1 AND personel_id = $2`, [atamaId, personelId])
    if (!cur.rows[0]) return { ok: false, error: 'not_found' }
    const row = cur.rows[0]
    const site_id = patch.site_id ?? row.site_id
    const bas = String(patch.baslangic_tarihi ?? row.baslangic_tarihi).slice(0, 10)
    const bit = patch.bitis_tarihi !== undefined
      ? (patch.bitis_tarihi ? String(patch.bitis_tarihi).slice(0, 10) : null)
      : row.bitis_tarihi
    const dup = await client.query(
      `SELECT id FROM personel_atama WHERE personel_id = $1 AND site_id = $2 AND baslangic_tarihi = $3::date AND id <> $4`,
      [personelId, site_id, bas, atamaId]
    )
    if (dup.rowCount && dup.rowCount > 0) return { ok: false, error: 'duplicate' }
    await client.query(
      `UPDATE personel_atama SET site_id = $1, baslangic_tarihi = $2::date, bitis_tarihi = $3 WHERE id = $4 AND personel_id = $5`,
      [site_id, bas, bit, atamaId, personelId]
    )
    return { ok: true }
  } finally {
    client.release()
  }
}

export async function deletePersonelAtamaById(personelId: number, atamaId: number): Promise<boolean> {
  const client = await pool.connect()
  try {
    const r = await client.query(`DELETE FROM personel_atama WHERE id = $1 AND personel_id = $2`, [atamaId, personelId])
    return (r.rowCount ?? 0) > 0
  } finally {
    client.release()
  }
}

/** Onaylı puantaja dayalı aylık özet (APP_STATS_SINCE_DATE sonrası). Güncel yevmiye/maaş tarifesi kullanılır (IQD/USD ayrı). */
export async function getPersonelFinansOzet(personelId: number) {
  const since = getAppStatsSinceSqlDate()
  const client = await pool.connect()
  try {
    const pr = await client.query(
      `SELECT gunluk_yevmiye, gunluk_yevmiye_usd, gunluk_yevmiye_iqd, aylik_maas, aylik_maas_usd, aylik_maas_iqd
       FROM personeller WHERE id = $1`,
      [personelId]
    )
    if (!pr.rows[0]) return null
    const row0 = pr.rows[0]
    const gunluk_yevmiye_legacy = row0.gunluk_yevmiye != null ? Number(row0.gunluk_yevmiye) : null
    const gunluk_yevmiye_usd = row0.gunluk_yevmiye_usd != null ? Number(row0.gunluk_yevmiye_usd) : null
    const gunluk_yevmiye_iqd = row0.gunluk_yevmiye_iqd != null ? Number(row0.gunluk_yevmiye_iqd) : null
    const aylik_maas_legacy = row0.aylik_maas != null ? Number(row0.aylik_maas) : null
    const aylik_maas_usd = row0.aylik_maas_usd != null ? Number(row0.aylik_maas_usd) : null
    const aylik_maas_iqd = row0.aylik_maas_iqd != null ? Number(row0.aylik_maas_iqd) : null

    const effYevIqd = gunluk_yevmiye_iqd ?? (gunluk_yevmiye_usd == null || gunluk_yevmiye_usd === 0 ? gunluk_yevmiye_legacy : null)
    const effMaasIqd = aylik_maas_iqd ?? (aylik_maas_usd == null || aylik_maas_usd === 0 ? aylik_maas_legacy : null)

    const r = await client.query(
      `SELECT
        date_trunc('month', pu.tarih)::date AS ay_baslangic,
        to_char(pu.tarih, 'YYYY-MM') AS ay,
        COALESCE(SUM(pu.carpan), 0)::numeric AS toplam_carpan,
        COALESCE(SUM(CASE
          WHEN COALESCE(pr.gunluk_yevmiye_iqd, pr.gunluk_yevmiye) IS NOT NULL
           AND COALESCE(pr.gunluk_yevmiye_iqd, pr.gunluk_yevmiye) > 0
          THEN pu.carpan * COALESCE(pr.gunluk_yevmiye_iqd, pr.gunluk_yevmiye)
          ELSE 0 END), 0)::numeric AS yevmiye_hak_edis_iqd,
        COALESCE(SUM(CASE
          WHEN pr.gunluk_yevmiye_usd IS NOT NULL AND pr.gunluk_yevmiye_usd > 0
          THEN pu.carpan * pr.gunluk_yevmiye_usd
          ELSE 0 END), 0)::numeric AS yevmiye_hak_edis_usd
      FROM puantaj pu
      INNER JOIN personeller pr ON pr.id = pu.personel_id
      WHERE pu.personel_id = $1 AND pu.durum = 'onaylandi' AND pu.tarih >= $2::date
      GROUP BY 1, 2
      ORDER BY 1`,
      [personelId, since]
    )
    const maasTarifeIqd = effMaasIqd != null && effMaasIqd > 0 ? effMaasIqd : null
    const maasTarifeUsd = aylik_maas_usd != null && aylik_maas_usd > 0 ? aylik_maas_usd : null

    const aylar = r.rows.map((row: Record<string, unknown>) => {
      const tc = Number(row.toplam_carpan) || 0
      const yhIqd = Number(row.yevmiye_hak_edis_iqd) || 0
      const yhUsd = Number(row.yevmiye_hak_edis_usd) || 0
      const maasSatirIqd = maasTarifeIqd != null && tc > 0 ? maasTarifeIqd : null
      const maasSatirUsd = maasTarifeUsd != null && tc > 0 ? maasTarifeUsd : null
      return {
        ay: String(row.ay),
        ay_baslangic: row.ay_baslangic,
        toplam_carpan: tc,
        yevmiye_hak_edis_iqd: yhIqd,
        yevmiye_hak_edis_usd: yhUsd,
        aylik_maas_goster_iqd: maasSatirIqd,
        aylik_maas_goster_usd: maasSatirUsd,
      }
    })
    return {
      stats_since: since,
      gunluk_yevmiye_usd: gunluk_yevmiye_usd != null && gunluk_yevmiye_usd > 0 ? gunluk_yevmiye_usd : null,
      gunluk_yevmiye_iqd: effYevIqd != null && effYevIqd > 0 ? effYevIqd : null,
      aylik_maas_usd: maasTarifeUsd,
      aylik_maas_iqd: maasTarifeIqd,
      aylar,
    }
  } finally {
    client.release()
  }
}

// ---------- İdari modül: Puantaj ----------
/** O şantiyede o tarihte atanmış personel + o günkü puantaj kayıtları (işten ayrılmış / henüz işe başlamamış olanlar hariç) */
export async function getPuantajForSiteAndDate(siteId: number, tarih: string) {
  const client = await pool.connect()
  const dateStr = (tarih || '').slice(0, 10)
  try {
    const r = await client.query(`
      SELECT t.personel_id, t.ad, t.soyad, t.gorev, t.puantaj_id, t.carpan, t.durum_kod, t.mesai_saat, t.notlar, t.puantaj_durum
      FROM (
        SELECT DISTINCT ON (p.id) p.id AS personel_id, p.ad, p.soyad, p.gorev,
          pu.id AS puantaj_id, pu.carpan, pu.durum_kod, pu.mesai_saat, pu.notlar, pu.durum AS puantaj_durum
        FROM personeller p
        INNER JOIN personel_atama pa ON pa.personel_id = p.id AND pa.site_id = $1
          AND pa.baslangic_tarihi <= $2::date AND (pa.bitis_tarihi IS NULL OR pa.bitis_tarihi >= $2::date)
        LEFT JOIN puantaj pu ON pu.personel_id = p.id AND pu.site_id = $1 AND pu.tarih = $2::date
        WHERE (p.isten_cikis_tarihi IS NULL OR p.isten_cikis_tarihi > $2::date)
          AND (p.ise_giris_tarihi IS NULL OR p.ise_giris_tarihi <= $2::date)
        ORDER BY p.id
      ) t
      ORDER BY t.soyad, t.ad
    `, [siteId, dateStr])
    return r.rows.map((row: Record<string, unknown>) => ({
      personel_id: row.personel_id,
      ad: row.ad,
      soyad: row.soyad,
      gorev: row.gorev,
      puantaj_id: row.puantaj_id,
      carpan: row.carpan != null ? Number(row.carpan) : 1,
      durum_kod: row.durum_kod || 'G',
      mesai_saat: row.mesai_saat != null ? Number(row.mesai_saat) : 0,
      notlar: row.notlar ?? '',
      puantaj_durum: row.puantaj_durum ?? 'taslak',
    }))
  } finally {
    client.release()
  }
}

/** Toplu puantaj kaydet (taslak). Onaylı kayıtlar güncellenmez. */
export async function savePuantajBulk(data: {
  siteId: number
  tarih: string
  userId: number
  rows: { personel_id: number; carpan?: number; durum_kod?: string; mesai_saat?: number; notlar?: string }[]
}) {
  const client = await pool.connect()
  const dateStr = (data.tarih || '').slice(0, 10)
  try {
    for (const row of data.rows) {
      await client.query(`
        INSERT INTO puantaj (personel_id, site_id, tarih, carpan, durum_kod, mesai_saat, notlar, durum, olusturan_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'taslak', $8)
        ON CONFLICT (personel_id, site_id, tarih) DO UPDATE SET
          carpan = EXCLUDED.carpan,
          durum_kod = EXCLUDED.durum_kod,
          mesai_saat = EXCLUDED.mesai_saat,
          notlar = EXCLUDED.notlar,
          updated_at = CURRENT_TIMESTAMP
        WHERE puantaj.durum <> 'onaylandi'
      `, [
        row.personel_id,
        data.siteId,
        dateStr,
        row.carpan ?? 1,
        (row.durum_kod || 'G').slice(0, 5),
        row.mesai_saat ?? 0,
        row.notlar ?? null,
        data.userId,
      ])
    }
    return true
  } catch (e) {
    throw e
  } finally {
    client.release()
  }
}

/** Onay bekleyen (taslak) puantaj grupları: site + tarih bazlı */
export async function getTaslakPuantajGroups(options: { siteId?: number | null; baslangic?: string; bitis?: string } = {}) {
  const client = await pool.connect()
  try {
    let query = `
      SELECT p.site_id, s.name AS site_name, p.tarih, COUNT(*) AS adet
      FROM puantaj p
      LEFT JOIN sites s ON s.id = p.site_id
      WHERE p.durum = 'taslak'
    `
    const params: (number | string)[] = []
    let i = 1
    if (options.siteId != null && options.siteId > 0) {
      query += ` AND p.site_id = $${i++}`
      params.push(options.siteId)
    }
    if (options.baslangic) {
      query += ` AND p.tarih >= $${i++}`
      params.push((options.baslangic as string).slice(0, 10))
    }
    if (options.bitis) {
      query += ` AND p.tarih <= $${i++}`
      params.push((options.bitis as string).slice(0, 10))
    }
    query += ` GROUP BY p.site_id, s.name, p.tarih ORDER BY p.tarih DESC, s.name`
    const r = params.length ? await client.query(query, params) : await client.query(query)
    return r.rows
  } finally {
    client.release()
  }
}

/** Puantaj onayla: belirtilen şantiye ve tarih aralığındaki taslak kayıtları kilitle */
export async function approvePuantaj(siteId: number, baslangicTarih: string, bitisTarih: string, userId: number) {
  const client = await pool.connect()
  const bas = (baslangicTarih || '').slice(0, 10)
  const bit = (bitisTarih || '').slice(0, 10)
  try {
    const r = await client.query(`
      UPDATE puantaj SET durum = 'onaylandi', onaylayan_id = $1, onay_tarihi = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE site_id = $2 AND tarih >= $3 AND tarih <= $4 AND durum = 'taslak'
    `, [userId, siteId, bas, bit])
    return r.rowCount ?? 0
  } finally {
    client.release()
  }
}

// ---------- İdari modül: Harcama / İşlemler ----------
export async function getHarcamaKategorileri() {
  const client = await pool.connect()
  try {
    const r = await client.query(`SELECT id, kod, ad, aciklama FROM harcama_kategorileri ORDER BY kod`)
    return r.rows
  } finally {
    client.release()
  }
}

export async function getIslemler(options: { siteId?: number | null; baslangic?: string; bitis?: string } = {}) {
  const client = await pool.connect()
  try {
    let query = `
      SELECT i.*, k.ad AS kategori_adi, k.kod AS kategori_kod
      FROM islemler i
      LEFT JOIN harcama_kategorileri k ON k.id = i.kategori_id
      WHERE 1=1
    `
    const params: (number | string)[] = []
    let i = 1
    if (options.siteId != null && options.siteId > 0) {
      query += ` AND i.site_id = $${i++}`
      params.push(options.siteId)
    }
    if (options.baslangic) {
      query += ` AND i.islem_tarihi >= $${i++}`
      params.push(String(options.baslangic).slice(0, 10))
    }
    if (options.bitis) {
      query += ` AND i.islem_tarihi <= $${i++}`
      params.push(String(options.bitis).slice(0, 10))
    }
    query += ` ORDER BY i.islem_tarihi DESC, i.id DESC`
    const r = params.length ? await client.query(query, params) : await client.query(query)
    return r.rows
  } finally {
    client.release()
  }
}

export async function createIslem(data: {
  site_id: number
  kategori_id: number
  tutar: number
  islem_tarihi: string
  odeme_kaynagi: string
  aciklama?: string | null
  evrak_yolu?: string | null
  olusturan_id?: number | null
  work_report_id?: number | null
  para_birimi?: ExpenseCurrency
}) {
  const client = await pool.connect()
  try {
    const siteR = await client.query(`SELECT COALESCE(iqd_per_usd, 1320) AS r FROM sites WHERE id = $1`, [data.site_id])
    const iqdPer = Number(siteR.rows[0]?.r) || 1320
    const cur: ExpenseCurrency = data.para_birimi === 'USD' ? 'USD' : 'IQD'
    const { tutar_usd, tutar_iqd, kur_iqd_per_usd } = expenseAmountsToUsdIqd(data.tutar, cur, iqdPer)
    const r = await client.query(`
      INSERT INTO islemler (site_id, kategori_id, tutar, islem_tarihi, odeme_kaynagi, aciklama, evrak_yolu, olusturan_id, work_report_id, para_birimi, kur_iqd_per_usd, tutar_usd, tutar_iqd)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING id
    `, [
      data.site_id,
      data.kategori_id,
      data.tutar,
      (data.islem_tarihi || '').slice(0, 10),
      data.odeme_kaynagi,
      data.aciklama ?? null,
      data.evrak_yolu ?? null,
      data.olusturan_id ?? null,
      data.work_report_id ?? null,
      cur,
      kur_iqd_per_usd,
      tutar_usd,
      tutar_iqd,
    ])
    return r.rows[0]?.id
  } finally {
    client.release()
  }
}

// ---------- Envanter Hareket ----------
function envanterHareketContribution(tipi: string, adet: number): number {
  return tipi === 'gelen' ? adet : -adet
}

function parseEnvanterSiteId(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = parseInt(String(v), 10)
  return Number.isFinite(n) ? n : null
}

type EnvanterHareketSt = { adet: number; yer: string | null; site_id: number | null }

function forwardEnvanterHareketOne(
  st: EnvanterHareketSt,
  h: { hareket_tipi: string; adet: unknown; hedef_yer: string | null; site_id: unknown },
): EnvanterHareketSt {
  const n = parseInt(String(h.adet), 10)
  let adet = st.adet
  if (h.hareket_tipi === 'gelen') adet += n
  else adet = Math.max(0, adet - n)
  return {
    adet,
    yer: h.hedef_yer ?? st.yer,
    site_id: parseEnvanterSiteId(h.site_id) ?? st.site_id,
  }
}

function undoEnvanterHareketOne(
  st: EnvanterHareketSt,
  h: {
    hareket_tipi: string
    adet: unknown
    hedef_yer: string | null
    kaynak_yer: string | null
    site_id: unknown
  },
): EnvanterHareketSt {
  const n = parseInt(String(h.adet), 10)
  let adet = st.adet
  if (h.hareket_tipi === 'gelen') adet -= n
  else adet += n
  let yer = st.yer
  if (h.hedef_yer != null) {
    const ky = h.kaynak_yer != null ? String(h.kaynak_yer).trim() : ''
    if (ky) yer = ky
  }
  let site_id = st.site_id
  if (parseEnvanterSiteId(h.site_id) != null) {
    site_id = null
  }
  return { adet, yer, site_id }
}

/** Tüm hareketleri kronolojik sırayla yeniden uygula; envanter satırı ile tutarlılık (yer / şantiye) için kullanılır. */
export async function recalculateEnvanterFromHareketler(client: PoolClient, envanterId: number) {
  const evR = await client.query(`SELECT adet, yer, site_id FROM envanter WHERE id = $1 FOR UPDATE`, [envanterId])
  if (!evR.rows[0]) throw new Error('Envanter bulunamadı')
  const hR = await client.query(
    `SELECT id, hareket_tipi, adet, hedef_yer, kaynak_yer, site_id
     FROM envanter_hareket WHERE envanter_id = $1
     ORDER BY tarih ASC, id ASC`,
    [envanterId],
  )
  const rows = hR.rows
  let st: EnvanterHareketSt = {
    adet: parseInt(String(evR.rows[0].adet ?? '0'), 10),
    yer: evR.rows[0].yer != null ? String(evR.rows[0].yer) : null,
    site_id: parseEnvanterSiteId(evR.rows[0].site_id),
  }
  if (rows.length === 0) return
  for (const h of [...rows].reverse()) {
    st = undoEnvanterHareketOne(st, h)
  }
  for (const h of rows) {
    st = forwardEnvanterHareketOne(st, h)
  }
  await client.query(
    `UPDATE envanter SET adet = $1, yer = $2, site_id = $3, updated_at = NOW() WHERE id = $4`,
    [st.adet, st.yer, st.site_id, envanterId],
  )
}

export async function deleteEnvanterHareketById(envanterId: number, hareketId: number): Promise<boolean> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const r = await client.query(
      `SELECT id, hareket_tipi, adet FROM envanter_hareket WHERE id = $1 AND envanter_id = $2`,
      [hareketId, envanterId],
    )
    if (!r.rows[0]) {
      await client.query('ROLLBACK')
      return false
    }
    const tip = String(r.rows[0].hareket_tipi)
    const n = parseInt(String(r.rows[0].adet), 10)
    const c = envanterHareketContribution(tip, n)
    await client.query(`UPDATE envanter SET adet = adet - ($1::int) WHERE id = $2`, [c, envanterId])
    await client.query(`DELETE FROM envanter_hareket WHERE id = $1`, [hareketId])
    await recalculateEnvanterFromHareketler(client, envanterId)
    await client.query('COMMIT')
    return true
  } catch (e) {
    try {
      await client.query('ROLLBACK')
    } catch {
      /* ignore */
    }
    throw e
  } finally {
    client.release()
  }
}

export async function updateEnvanterHareketById(
  envanterId: number,
  hareketId: number,
  patch: Partial<{
    hareket_tipi: 'gelen' | 'giden'
    kaynak_yer: string | null
    hedef_yer: string | null
    site_id: number | null
    tarih: string
    adet: number
    notlar: string | null
  }>,
): Promise<{ ok: true } | {ok: false; error: 'not_found' | 'no_changes' | 'invalid_adet' | 'negative_stock'}> {
  if (Object.keys(patch).length === 0) {
    return { ok: false, error: 'no_changes' }
  }
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const oldR = await client.query(
      `SELECT * FROM envanter_hareket WHERE id = $1 AND envanter_id = $2 FOR UPDATE`,
      [hareketId, envanterId],
    )
    if (!oldR.rows[0]) {
      await client.query('ROLLBACK')
      return { ok: false, error: 'not_found' }
    }
    const o = oldR.rows[0]
    const oldTip = String(o.hareket_tipi)
    const oldN = parseInt(String(o.adet), 10)
    const newTip = patch.hareket_tipi ?? (oldTip as 'gelen' | 'giden')
    const newN = patch.adet != null ? patch.adet : oldN
    if (!Number.isFinite(newN) || newN < 1) {
      await client.query('ROLLBACK')
      return { ok: false, error: 'invalid_adet' }
    }
    const newKaynak = patch.kaynak_yer !== undefined ? patch.kaynak_yer : o.kaynak_yer
    const newHedef = patch.hedef_yer !== undefined ? patch.hedef_yer : o.hedef_yer
    const newSite = 'site_id' in patch ? patch.site_id : parseEnvanterSiteId(o.site_id)
    const newTarih = patch.tarih != null ? String(patch.tarih).slice(0, 10) : String(o.tarih).slice(0, 10)
    const newNotlar = patch.notlar !== undefined ? patch.notlar : o.notlar

    const same =
      oldTip === newTip &&
      oldN === newN &&
      (o.kaynak_yer ?? null) === (newKaynak ?? null) &&
      (o.hedef_yer ?? null) === (newHedef ?? null) &&
      parseEnvanterSiteId(o.site_id) === newSite &&
      String(o.tarih).slice(0, 10) === newTarih &&
      (o.notlar ?? null) === (newNotlar ?? null)
    if (same) {
      await client.query('ROLLBACK')
      return { ok: false, error: 'no_changes' }
    }

    const cOld = envanterHareketContribution(oldTip, oldN)
    const cNew = envanterHareketContribution(newTip, newN)
    await client.query(`UPDATE envanter SET adet = adet - ($1::int) + ($2::int) WHERE id = $3`, [cOld, cNew, envanterId])

    await client.query(
      `UPDATE envanter_hareket SET
        hareket_tipi = $1, kaynak_yer = $2, hedef_yer = $3, site_id = $4, tarih = $5, adet = $6, notlar = $7
       WHERE id = $8`,
      [newTip, newKaynak ?? null, newHedef ?? null, newSite, newTarih, newN, newNotlar, hareketId],
    )

    await recalculateEnvanterFromHareketler(client, envanterId)
    const chk = await client.query(`SELECT adet FROM envanter WHERE id = $1`, [envanterId])
    if (parseInt(String(chk.rows[0]?.adet ?? '0'), 10) < 0) {
      await client.query('ROLLBACK')
      return { ok: false, error: 'negative_stock' }
    }
    await client.query('COMMIT')
    return { ok: true }
  } catch (e) {
    try {
      await client.query('ROLLBACK')
    } catch {
      /* ignore */
    }
    throw e
  } finally {
    client.release()
  }
}

export async function getEnvanterHareketler(envanterI: number) {
  const client = await pool.connect()
  try {
    const r = await client.query(
      `SELECT eh.*, s.name AS site_name, u.username AS olusturan
       FROM envanter_hareket eh
       LEFT JOIN sites s ON s.id = eh.site_id
       LEFT JOIN users u ON u.id = eh.olusturan_id
       WHERE eh.envanter_id = $1
       ORDER BY eh.tarih DESC, eh.created_at DESC`,
      [envanterI]
    )
    return r.rows
  } finally {
    client.release()
  }
}

export async function createEnvanterHareket(data: {
  envanter_id: number
  hareket_tipi: 'gelen' | 'giden'
  kaynak_yer?: string | null
  hedef_yer?: string | null
  site_id?: number | null
  tarih: string
  adet: number
  notlar?: string | null
  olusturan_id?: number | null
}) {
  const client = await pool.connect()
  try {
    // envanter'in mevcut yerini ve adetini güncelle
    const ev = await client.query(`SELECT adet, yer, site_id FROM envanter WHERE id = $1`, [data.envanter_id])
    if (!ev.rows[0]) throw new Error('Envanter bulunamadı')
    const currentAdet = parseInt(ev.rows[0].adet ?? '0', 10)
    const newAdet = data.hareket_tipi === 'gelen' ? currentAdet + data.adet : Math.max(0, currentAdet - data.adet)
    const newYer = data.hareket_tipi === 'gelen' ? (data.hedef_yer ?? ev.rows[0].yer) : (data.hedef_yer ?? ev.rows[0].yer)
    await client.query(
      `UPDATE envanter SET adet=$1, yer=$2, site_id=$3, updated_at=NOW() WHERE id=$4`,
      [newAdet, newYer, data.site_id ?? ev.rows[0].site_id, data.envanter_id]
    )
    const r = await client.query(
      `INSERT INTO envanter_hareket (envanter_id, hareket_tipi, kaynak_yer, hedef_yer, site_id, tarih, adet, notlar, olusturan_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [data.envanter_id, data.hareket_tipi, data.kaynak_yer ?? null, data.hedef_yer ?? null,
       data.site_id ?? null, data.tarih, data.adet, data.notlar ?? null, data.olusturan_id ?? null]
    )
    return r.rows[0]?.id
  } finally {
    client.release()
  }
}

// ---------- İdari modül: Personel belgeleri ----------
export async function getPersonelBelgeleri(personelId: number) {
  const client = await pool.connect()
  try {
    const r = await client.query(
      `SELECT * FROM personel_belgeleri WHERE personel_id = $1 ORDER BY yukleme_tarihi DESC`,
      [personelId]
    )
    return r.rows
  } finally {
    client.release()
  }
}

export async function getPersonelBelgeById(personelId: number, belgeId: number) {
  const client = await pool.connect()
  try {
    const r = await client.query(
      `SELECT id, personel_id, belge_tipi, dosya_yolu FROM personel_belgeleri WHERE id = $1 AND personel_id = $2`,
      [belgeId, personelId]
    )
    return r.rows[0] ?? null
  } finally {
    client.release()
  }
}

export async function addPersonelBelge(data: {
  personel_id: number
  belge_tipi: string
  dosya_yolu: string
  gecerlilik_tarihi?: string | null
}) {
  const client = await pool.connect()
  try {
    const r = await client.query(`
      INSERT INTO personel_belgeleri (personel_id, belge_tipi, dosya_yolu, gecerlilik_tarihi)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `, [
      data.personel_id,
      data.belge_tipi,
      data.dosya_yolu,
      data.gecerlilik_tarihi ? (data.gecerlilik_tarihi as string).slice(0, 10) : null,
    ])
    return r.rows[0]?.id
  } finally {
    client.release()
  }
}

/** Süresi dolan veya 15 gün içinde dolacak belgeler (dashboard uyarı) */
export async function getBelgeUyarilari(options: { siteId?: number | null } = {}) {
  const client = await pool.connect()
  try {
    const limitDate = new Date()
    limitDate.setDate(limitDate.getDate() + 15)
    const limitStr = limitDate.toISOString().slice(0, 10)
    let query = `
      SELECT b.*, p.ad, p.soyad, p.gorev
      FROM personel_belgeleri b
      INNER JOIN personeller p ON p.id = b.personel_id
      WHERE b.gecerlilik_tarihi IS NOT NULL AND b.gecerlilik_tarihi <= $1
    `
    const params: string[] = [limitStr]
    if (options.siteId != null && options.siteId > 0) {
      query += ` AND EXISTS (SELECT 1 FROM personel_atama pa WHERE pa.personel_id = p.id AND pa.site_id = $2 AND (pa.bitis_tarihi IS NULL OR pa.bitis_tarihi >= CURRENT_DATE))`
      params.push(String(options.siteId))
    }
    query += ` ORDER BY b.gecerlilik_tarihi ASC`
    const r = await client.query(query, params)
    return r.rows
  } finally {
    client.release()
  }
}

export async function getPersonelBelgeTipleri() {
  const client = await pool.connect()
  try {
    const r = await client.query(`SELECT id, kod, ad FROM personel_belge_tipleri ORDER BY kod`)
    return r.rows
  } finally {
    client.release()
  }
}

function envanterOrderClause(sortBy?: string | null, sortDir?: string | null): string {
  const dir = sortDir?.toLowerCase() === "desc" ? "DESC" : "ASC"
  const colMap: Record<string, string> = {
    malzeme_adi: "e.malzeme_adi",
    kod: "e.kod",
    adet: "e.adet",
    yer: "e.yer",
    durum: "e.durum",
    fiyat: "e.fiyat",
    site_name: "s.name",
  }
  const col = colMap[String(sortBy || "").trim()] ?? "e.kod"
  return ` ORDER BY ${col} ${dir} NULLS LAST, e.id ASC`
}

// ---------- İdari modül: Envanter ----------
export async function getEnvanter(options: {
  siteId?: number | null
  yer?: string | null
  limit?: number
  offset?: number
  search?: string
  sortBy?: string | null
  sortDir?: "asc" | "desc" | null
} = {}) {
  const client = await pool.connect()
  try {
    let query = `SELECT e.*, s.name AS site_name FROM envanter e LEFT JOIN sites s ON e.site_id = s.id WHERE 1=1`
    const params: (number | string)[] = []
    let i = 1
    if (options.siteId != null && options.siteId > 0) {
      query += ` AND (e.site_id = $${i++} OR e.site_id IS NULL)`
      params.push(options.siteId)
    }
    if (options.yer != null && String(options.yer).trim()) {
      query += ` AND e.yer = $${i++}`
      params.push(String(options.yer).trim())
    }
    if (options.search && String(options.search).trim()) {
      const s = `%${String(options.search).trim()}%`
      query += ` AND (e.kod ILIKE $${i} OR e.malzeme_adi ILIKE $${i} OR e.yer ILIKE $${i})`
      params.push(s)
      i++
    }
    query += envanterOrderClause(options.sortBy, options.sortDir)
    if (options.limit && options.limit > 0) {
      query += ` LIMIT $${i++}`
      params.push(options.limit)
    }
    if (options.offset && options.offset > 0) {
      query += ` OFFSET $${i++}`
      params.push(options.offset)
    }
    const r = params.length ? await client.query(query, params) : await client.query(query)
    return r.rows
  } finally {
    client.release()
  }
}

export async function getEnvanterCount(options: { siteId?: number | null; yer?: string | null; search?: string } = {}): Promise<number> {
  const client = await pool.connect()
  try {
    let query = `SELECT COUNT(*) FROM envanter e WHERE 1=1`
    const params: (number | string)[] = []
    let i = 1
    if (options.siteId != null && options.siteId > 0) {
      query += ` AND (e.site_id = $${i++} OR e.site_id IS NULL)`
      params.push(options.siteId)
    }
    if (options.yer != null && String(options.yer).trim()) {
      query += ` AND e.yer = $${i++}`
      params.push(String(options.yer).trim())
    }
    if (options.search && String(options.search).trim()) {
      const s = `%${String(options.search).trim()}%`
      query += ` AND (e.kod ILIKE $${i} OR e.malzeme_adi ILIKE $${i} OR e.yer ILIKE $${i})`
      params.push(s)
      i++
    }
    const r = params.length ? await client.query(query, params) : await client.query(query)
    return parseInt(r.rows[0].count, 10)
  } finally {
    client.release()
  }
}

export async function getEnvanterById(id: number) {
  const client = await pool.connect()
  try {
    const r = await client.query(`SELECT e.*, s.name AS site_name FROM envanter e LEFT JOIN sites s ON e.site_id = s.id WHERE e.id = $1`, [id])
    return r.rows[0] ?? null
  } finally {
    client.release()
  }
}

export async function getEnvanterByKod(kod: string) {
  const k = String(kod ?? "").trim()
  if (!k) return null
  const client = await pool.connect()
  try {
    const r = await client.query(
      `SELECT e.*, s.name AS site_name FROM envanter e LEFT JOIN sites s ON e.site_id = s.id WHERE e.kod = $1 LIMIT 1`,
      [k],
    )
    return r.rows[0] ?? null
  } finally {
    client.release()
  }
}

export async function createEnvanter(data: {
  kod: string
  malzeme_adi: string
  aciklama?: string | null
  adet?: number
  fotograf_yolu?: string | null
  fiyat?: number | null
  yer?: string | null
  site_id?: number | null
  durum?: string | null
}) {
  const client = await pool.connect()
  try {
    const r = await client.query(`
      INSERT INTO envanter (kod, malzeme_adi, aciklama, adet, fotograf_yolu, fiyat, yer, site_id, durum)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `, [
      data.kod.trim(),
      data.malzeme_adi.trim(),
      data.aciklama ?? null,
      data.adet ?? 1,
      data.fotograf_yolu ?? null,
      data.fiyat ?? null,
      data.yer ?? null,
      data.site_id ?? null,
      data.durum ?? 'aktif',
    ])
    return r.rows[0].id
  } finally {
    client.release()
  }
}

export async function updateEnvanter(id: number, data: Partial<{
  kod: string
  malzeme_adi: string
  aciklama: string | null
  adet: number
  fotograf_yolu: string | null
  fiyat: number | null
  yer: string | null
  site_id: number | null
  durum: string | null
}>) {
  const client = await pool.connect()
  try {
    const fields = ['kod', 'malzeme_adi', 'aciklama', 'adet', 'fotograf_yolu', 'fiyat', 'yer', 'site_id', 'durum']
    const updates: string[] = []
    const values: unknown[] = []
    let i = 1
    for (const f of fields) {
      if (data[f as keyof typeof data] !== undefined) {
        updates.push(`${f} = $${i++}`)
        values.push(data[f as keyof typeof data])
      }
    }
    if (updates.length === 0) return
    updates.push(`updated_at = CURRENT_TIMESTAMP`)
    values.push(id)
    await client.query(`UPDATE envanter SET ${updates.join(', ')} WHERE id = $${i}`, values)
  } finally {
    client.release()
  }
}

export async function deleteEnvanter(id: number) {
  const client = await pool.connect()
  try {
    const result = await client.query(`DELETE FROM envanter WHERE id = $1 RETURNING id`, [id])
    return (result.rowCount ?? 0) > 0
  } finally {
    client.release()
  }
}

// ---------- İdari modül: Raporlar ----------
/** Şantiye bütçe vs gerçekleşen (islemler toplamı) */
export async function getButceRaporu(siteId: number, baslangic?: string, bitis?: string) {
  const client = await pool.connect()
  try {
    const site = await client.query(`SELECT id, name, budget FROM sites WHERE id = $1`, [siteId])
    if (!site.rows[0]) return null
    let query = `SELECT COALESCE(SUM(COALESCE(tutar_iqd, tutar)), 0) AS toplam_iqd, COALESCE(SUM(tutar_usd), 0) AS toplam_usd FROM islemler WHERE site_id = $1`
    const params: (number | string)[] = [siteId]
    let i = 2
    if (baslangic) { query += ` AND islem_tarihi >= $${i++}`; params.push((baslangic as string).slice(0, 10)) }
    if (bitis) { query += ` AND islem_tarihi <= $${i++}`; params.push((bitis as string).slice(0, 10)) }
    const sum = await client.query(query, params)
    const toplam = parseFloat(sum.rows[0]?.toplam_iqd ?? '0')
    const toplam_usd = parseFloat(sum.rows[0]?.toplam_usd ?? '0')
    return {
      site_id: siteId,
      site_name: site.rows[0].name,
      budget: site.rows[0].budget != null ? parseFloat(site.rows[0].budget) : null,
      toplam,
      toplam_usd,
      fark: site.rows[0].budget != null ? parseFloat(site.rows[0].budget) - toplam : null,
    }
  } finally {
    client.release()
  }
}

/** İş gücü: şantiye + tarih aralığı puantaj özeti (adam/gün) */
export async function getIsGucuRaporu(siteId: number, baslangic: string, bitis: string) {
  const client = await pool.connect()
  try {
    const bas = (baslangic || '').slice(0, 10)
    const bit = (bitis || '').slice(0, 10)
    const r = await client.query(`
      SELECT tarih, COUNT(*) AS kisi_sayi, SUM(carpan) AS adam_gun, SUM(mesai_saat) AS toplam_mesai
      FROM puantaj
      WHERE site_id = $1 AND tarih >= $2 AND tarih <= $3 AND durum = 'onaylandi'
      GROUP BY tarih
      ORDER BY tarih
    `, [siteId, bas, bit])
    return r.rows
  } finally {
    client.release()
  }
}

/**
 * Günlük çalışma raporundaki harcamaları islemler tablosuna senkronize eder.
 * Aynı rapor tekrar gönderilirse eskiler silinip yeniden yazılır.
 * Yalnızca siteId ve reportId mevcutsa ve en az bir harcama varsa çalışır.
 */
export async function syncExpensesToIslemler(
  reportId: number,
  siteId: number,
  reportDate: string, // YYYY-MM-DD
  userId: number,
  expenses: Array<{ description?: string; amount?: number; category?: string; currency?: string }>
): Promise<void> {
  if (!siteId || !reportId || !Array.isArray(expenses)) return
  const validExpenses = expenses.filter(e => e && Number(e.amount) > 0)
  if (validExpenses.length === 0) return

  const client = await pool.connect()
  try {
    const siteR = await client.query(`SELECT COALESCE(iqd_per_usd, 1320) AS r FROM sites WHERE id = $1`, [siteId])
    const iqdPer = Number(siteR.rows[0]?.r) || 1320

    // Kategori kodu → id haritası
    const catRows = await client.query(`SELECT id, kod FROM harcama_kategorileri`)
    const catMap: Record<string, number> = {}
    for (const row of catRows.rows) catMap[row.kod] = row.id

    // Form'daki kategori → DB kodu eşleştirmesi
    const categoryMapping: Record<string, string> = {
      santiye: 'sarf',
      makine:  'sarf',
      personel: 'maas',
      yakit:   'akaryakit',
      diger:   'diger',
    }

    const digerKatId = catMap['diger']
    if (!digerKatId) return // kategori tablosu henüz seed edilmemişse atla

    // Aynı rapor için önceki kayıtları sil (idempotent sync)
    await client.query(`DELETE FROM islemler WHERE work_report_id = $1`, [reportId])

    const date = (reportDate || '').slice(0, 10)
    for (const exp of validExpenses) {
      const catKod = categoryMapping[exp.category ?? ''] ?? 'diger'
      const katId = catMap[catKod] ?? digerKatId
      const cur: ExpenseCurrency = exp.currency === 'USD' ? 'USD' : 'IQD'
      const amt = Number(exp.amount)
      const { tutar_usd, tutar_iqd, kur_iqd_per_usd } = expenseAmountsToUsdIqd(amt, cur, iqdPer)
      await client.query(
        `INSERT INTO islemler (site_id, kategori_id, tutar, islem_tarihi, odeme_kaynagi, aciklama, olusturan_id, work_report_id, para_birimi, kur_iqd_per_usd, tutar_usd, tutar_iqd)
         VALUES ($1, $2, $3, $4, 'rapor', $5, $6, $7, $8, $9, $10, $11)`,
        [siteId, katId, amt, date, exp.description ?? '', userId, reportId, cur, kur_iqd_per_usd, tutar_usd, tutar_iqd]
      )
    }
  } finally {
    client.release()
  }
}

// ---------- Makine Defteri ----------

export interface MachineRow {
  id: number
  name: string
  machine_type: string
  marka: string | null
  model: string | null
  plaka_no: string | null
  seri_no: string | null
  status: string
  current_site_id: number | null
  site_name: string | null
  notlar: string | null
  operators: { personel_id: number; ad: string; soyad: string; gorev: string; baslangic_tarihi: string; bitis_tarihi: string | null }[]
}

export async function getMachines(opts: { siteId?: number | null; status?: string | null } = {}): Promise<MachineRow[]> {
  const client = await pool.connect()
  try {
    const conditions: string[] = []
    const params: unknown[] = []
    let i = 1
    if (opts.siteId != null) { conditions.push(`m.current_site_id = $${i++}`); params.push(opts.siteId) }
    if (opts.status) { conditions.push(`m.status = $${i++}`); params.push(opts.status) }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const r = await client.query(
      `SELECT m.*, s.name AS site_name,
        COALESCE(
          json_agg(json_build_object('personel_id', p.id, 'ad', p.ad, 'soyad', p.soyad, 'gorev', p.gorev,
            'baslangic_tarihi', moa.baslangic_tarihi, 'bitis_tarihi', moa.bitis_tarihi))
          FILTER (WHERE p.id IS NOT NULL), '[]'
        ) AS operators
       FROM machines m
       LEFT JOIN sites s ON m.current_site_id = s.id
       LEFT JOIN machine_operator_atama moa ON moa.machine_id = m.id AND (moa.bitis_tarihi IS NULL OR moa.bitis_tarihi >= CURRENT_DATE)
       LEFT JOIN personeller p ON moa.personel_id = p.id
       ${where}
       GROUP BY m.id, s.name
       ORDER BY s.name NULLS LAST, m.name`,
      params
    )
    return r.rows
  } finally {
    client.release()
  }
}

export async function createMachine(data: {
  name: string; machine_type: string; marka?: string | null; model?: string | null;
  plaka_no?: string | null; seri_no?: string | null; status?: string; current_site_id?: number | null; notlar?: string | null
}): Promise<number> {
  const client = await pool.connect()
  try {
    const r = await client.query(
      `INSERT INTO machines (name, machine_type, marka, model, plaka_no, seri_no, status, current_site_id, notlar)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [data.name, data.machine_type, data.marka ?? null, data.model ?? null, data.plaka_no ?? null,
       data.seri_no ?? null, data.status ?? 'aktif', data.current_site_id ?? null, data.notlar ?? null]
    )
    return r.rows[0].id
  } finally {
    client.release()
  }
}

export async function updateMachine(id: number, data: Partial<{
  name: string; machine_type: string; marka: string | null; model: string | null;
  plaka_no: string | null; seri_no: string | null; status: string; current_site_id: number | null; notlar: string | null
}>): Promise<void> {
  const client = await pool.connect()
  try {
    const sets: string[] = []
    const vals: unknown[] = []
    let i = 1
    const addField = (col: string, val: unknown) => { sets.push(`${col} = $${i++}`); vals.push(val) }
    if (data.name !== undefined) addField('name', data.name)
    if (data.machine_type !== undefined) addField('machine_type', data.machine_type)
    if (data.marka !== undefined) addField('marka', data.marka)
    if (data.model !== undefined) addField('model', data.model)
    if (data.plaka_no !== undefined) addField('plaka_no', data.plaka_no)
    if (data.seri_no !== undefined) addField('seri_no', data.seri_no)
    if (data.status !== undefined) addField('status', data.status)
    if ('current_site_id' in data) addField('current_site_id', data.current_site_id)
    if (data.notlar !== undefined) addField('notlar', data.notlar)
    if (sets.length === 0) return
    sets.push(`updated_at = NOW()`)
    vals.push(id)
    await client.query(`UPDATE machines SET ${sets.join(', ')} WHERE id = $${i}`, vals)
  } finally {
    client.release()
  }
}

export async function upsertMachineOperators(machineId: number, personelIds: number[]): Promise<void> {
  const client = await pool.connect()
  try {
    // Aktif atamaları kapat (bitis_tarihi = bugün)
    await client.query(
      `UPDATE machine_operator_atama SET bitis_tarihi = CURRENT_DATE
       WHERE machine_id = $1 AND bitis_tarihi IS NULL AND personel_id != ALL($2::int[])`,
      [machineId, personelIds.length > 0 ? personelIds : [0]]
    )
    // Yeni atamaları ekle
    for (const pId of personelIds) {
      await client.query(
        `INSERT INTO machine_operator_atama (machine_id, personel_id, baslangic_tarihi)
         VALUES ($1, $2, CURRENT_DATE)
         ON CONFLICT (machine_id, personel_id, baslangic_tarihi) DO NOTHING`,
        [machineId, pId]
      )
    }
  } finally {
    client.release()
  }
}

/** Operatörün user_id üzerinden o şantiyedeki makinelerini bulur */
export async function getOperatorMachinesForSite(userId: number, siteId: number): Promise<{ id: number; name: string; machine_type: string; marka: string | null; model: string | null; plaka_no: string | null }[]> {
  const client = await pool.connect()
  try {
    // First: find personel linked to this user
    const personelRes = await client.query(`SELECT id FROM personeller WHERE user_id = $1 LIMIT 1`, [userId])
    const personelId = personelRes.rows[0]?.id

    if (personelId) {
      // Find machines at this site where this personel is assigned as operator
      const r = await client.query(`
        SELECT m.id, m.name, m.machine_type, m.marka, m.model, m.plaka_no
        FROM machines m
        INNER JOIN machine_operator_atama moa ON moa.machine_id = m.id
          AND moa.personel_id = $1
          AND (moa.bitis_tarihi IS NULL OR moa.bitis_tarihi >= CURRENT_DATE)
        WHERE m.current_site_id = $2 AND m.status = 'aktif'
        ORDER BY m.name
      `, [personelId, siteId])
      if (r.rows.length > 0) return r.rows
    }

    // Fallback: all active machines at this site
    const fallback = await client.query(`
      SELECT id, name, machine_type, marka, model, plaka_no
      FROM machines
      WHERE current_site_id = $1 AND status = 'aktif'
      ORDER BY name
    `, [siteId])
    return fallback.rows
  } finally {
    client.release()
  }
}

/** Şantiyedeki tüm aktif makineleri döner (site dialog ve form için) */
export async function getMachinesForSite(siteId: number): Promise<{ id: number; name: string; machine_type: string; marka: string | null; model: string | null; operators: { personel_id: number; ad: string; soyad: string }[] }[]> {
  const client = await pool.connect()
  try {
    const r = await client.query(`
      SELECT m.id, m.name, m.machine_type, m.marka, m.model,
        COALESCE((
          SELECT json_agg(json_build_object('personel_id', p.id, 'ad', p.ad, 'soyad', p.soyad))
          FROM machine_operator_atama moa
          INNER JOIN personeller p ON p.id = moa.personel_id
          WHERE moa.machine_id = m.id AND (moa.bitis_tarihi IS NULL OR moa.bitis_tarihi >= CURRENT_DATE)
        ), '[]') AS operators
      FROM machines m
      WHERE m.current_site_id = $1 AND m.status = 'aktif'
      ORDER BY m.name
    `, [siteId])
    return r.rows
  } finally {
    client.release()
  }
}

export async function createPersonelIzin(data: {
  personel_id: number
  izin_tipi: string
  baslangic_tarihi: string
  bitis_tarihi: string
  notlar?: string | null
  olusturan_id?: number | null
}): Promise<number> {
  const client = await pool.connect()
  try {
    const r = await client.query(
      `INSERT INTO personel_izin (personel_id, izin_tipi, baslangic_tarihi, bitis_tarihi, notlar, olusturan_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [data.personel_id, data.izin_tipi, data.baslangic_tarihi, data.bitis_tarihi, data.notlar ?? null, data.olusturan_id ?? null]
    )
    return r.rows[0].id
  } finally {
    client.release()
  }
}

export default pool