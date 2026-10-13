-- Market prices from EnergyZero. Electricity per quarter hour, gas per gas day (06:00-06:00 local).
-- base: market price excl. VAT, tax: energy tax excl. VAT (both in EUR per kWh or m3)
CREATE TABLE prices (
	kind TEXT NOT NULL CHECK (kind IN ('electricity', 'gas')),
	start TEXT NOT NULL,
	end TEXT NOT NULL,
	base REAL NOT NULL,
	tax REAL NOT NULL,
	PRIMARY KEY (kind, start)
);

-- Local calendar days for which all price points have been stored (complete: covered minutes = day length)
CREATE TABLE fetched_days (
	kind TEXT NOT NULL,
	day TEXT NOT NULL,
	minutes INTEGER NOT NULL,
	fetched_at TEXT NOT NULL,
	PRIMARY KEY (kind, day)
);

-- Web Push subscriptions with per-subscriber alert preferences (JSON)
CREATE TABLE push_subscriptions (
	endpoint TEXT PRIMARY KEY,
	p256dh TEXT NOT NULL,
	auth TEXT NOT NULL,
	preferences TEXT NOT NULL,
	last_threshold_alert TEXT,
	last_digest_day TEXT,
	created_at TEXT NOT NULL
);

-- Daily AI-written summary of tomorrow's prices
CREATE TABLE summaries (
	day TEXT PRIMARY KEY,
	text TEXT NOT NULL,
	model TEXT NOT NULL,
	created_at TEXT NOT NULL
);
