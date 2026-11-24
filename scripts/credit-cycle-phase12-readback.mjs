import { readFileSync, existsSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  handleCreditCycleLatest,
  handleCreditCycleHistory,
  handleCreditCycleIndicators,
} from '../api/_lib/creditCycleApiHandlers.js';
import {
  CREDIT_CYCLE_STAGING_REF,
  CREDIT_CYCLE_PRODUCTION_REF,
  classifyCreditCycleSupabaseUrl,
} from '../api/_lib/creditCycleEnv.js';
import { isStagingTestSeedPoint } from '../src/credit-cycle/stagingTestSeed.js';

function parseEnvFile(filePath) {
  const map = {};
  if (!existsSync(filePath)) return map;
  for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i <= 0) continue;
    map[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return map;
}

function mockRes() {
  const out = { status: 0, body: null };
  return {
    out,
    res: {
      setHeader() {},
      end(s) {
        out.body = JSON.parse(String(s));
      },
      set statusCode(v) {
        out.status = v;
      },
      get statusCode() {
        return out.status;
      },
    },
  };
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = {
  ...process.env,
  ...parseEnvFile(path.join(ROOT, '.env.staging.local')),
  CREDIT_CYCLE_API_ENABLED: '1',
  CREDIT_CYCLE_DATA_MODE: 'staging',
  CREDIT_CYCLE_ALLOW_REMOTE: '1',
};

const url = String(env.CREDIT_CYCLE_SUPABASE_URL || '');
if (
  classifyCreditCycleSupabaseUrl(url) !== 'staging' ||
  url.includes(CREDIT_CYCLE_PRODUCTION_REF)
) {
  console.log(JSON.stringify({ ok: false, reason: 'not_staging' }, null, 2));
  process.exit(2);
}

const L = mockRes();
await handleCreditCycleLatest(
  { url: '/api/credit-cycle?mode=latest', method: 'GET' },
  L.res,
  { env },
);

const H = mockRes();
await handleCreditCycleHistory(
  { url: '/api/credit-cycle?mode=history&limit=500', method: 'GET' },
  H.res,
  { env },
);

const I = mockRes();
await handleCreditCycleIndicators(
  { url: '/api/credit-cycle?mode=indicators', method: 'GET' },
  I.res,
  { env },
);

const points = Array.isArray(H.out.body?.points) ? H.out.body.points : [];
const market = points.filter((p) => !isStagingTestSeedPoint(p));
const inds = Array.isArray(I.out.body?.indicators) ? I.out.body.indicators : [];
const hy = inds.filter((x) =>
  ['hy', 'bbb'].includes(String(x.id || x.indicator_code || '').toLowerCase()),
);
const hyLeak = hy.some(
  (x) => x.value != null || x.riskScore != null || x.raw_value != null,
);
const blob = JSON.stringify({ L: L.out.body, H: H.out.body, I: I.out.body });
const latestIsTest = isStagingTestSeedPoint({
  asOf: L.out.body?.asOf,
  calculationVersion: L.out.body?.calculationVersion,
});

const report = {
  ok:
    L.out.status === 200 &&
    H.out.status === 200 &&
    I.out.status === 200 &&
    !latestIsTest &&
    !hyLeak &&
    !/"payload"\s*:/.test(blob),
  stagingRef: CREDIT_CYCLE_STAGING_REF,
  latest: {
    status: L.out.status,
    asOf: L.out.body?.asOf,
    cci: L.out.body?.cci,
    coverage: L.out.body?.coverage,
    pitStatus: L.out.body?.pitStatus,
    calc: L.out.body?.calculationVersion,
    isTestSeed: latestIsTest,
    hasPayload: Object.prototype.hasOwnProperty.call(
      L.out.body || {},
      'payload',
    ),
  },
  history: {
    status: H.out.status,
    totalPoints: points.length,
    marketPoints: market.length,
    includesTest1900: points.some((p) => p.asOf === '1900-01-01'),
    maxMarketAsOf: market.map((p) => p.asOf).sort().at(-1) || null,
  },
  indicators: {
    status: I.out.status,
    count: inds.length,
    codes: inds.map((x) =>
      String(x.id || x.indicator_code).toLowerCase(),
    ),
    hyBbbNumericLeak: hyLeak,
    qualities: Object.fromEntries(
      inds
        .filter(
          (x) =>
            !['hy', 'bbb'].includes(
              String(x.id || x.indicator_code || '').toLowerCase(),
            ),
        )
        .map((x) => [
          x.id || x.indicator_code,
          x.qualityStatus || x.quality || null,
        ]),
    ),
  },
  dashboard: {
    stagingWouldPreferRealLatest: !latestIsTest && market.length > 0,
    testSeedNotSelectedAsLatest: !latestIsTest,
  },
  security: {
    payloadExposed: /"payload"\s*:/.test(blob),
    hyBbbNumericLeak: hyLeak,
  },
};

writeFileSync(
  path.join(ROOT, 'reports/credit-cycle-phase12-readback.json'),
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);
