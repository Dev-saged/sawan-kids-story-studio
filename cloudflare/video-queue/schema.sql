-- اختياري: الـWorker ينشئ الجداول تلقائياً عند أول طلب؛ هذا الملف للتنفيذ اليدوي فقط.
CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, ckey TEXT UNIQUE, status TEXT NOT NULL, prompt TEXT NOT NULL, aspect TEXT NOT NULL, seconds INTEGER NOT NULL, mime TEXT, vmime TEXT, error TEXT, created INTEGER NOT NULL, updated INTEGER NOT NULL, claimed INTEGER);
CREATE INDEX IF NOT EXISTS jobs_status ON jobs (status, created);
CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v INTEGER NOT NULL);
