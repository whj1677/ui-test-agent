import fs from 'node:fs/promises';
import path from 'node:path';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import {
  uiFeatures,
  structureKey,
  retrievePatterns,
  PATTERN_IDS,
  PATTERN_VERSION,
  EXPERIENCE_NOTICE,
} from './ui-patterns.mjs';
import { consumeExperienceReceipt } from './ui-experience-evidence.mjs';

const MAX_BYTES = 1024 * 1024;
const TTL = 30 * 24 * 60 * 60 * 1000;
const outcomes = ['POSITIVE', 'UNKNOWN', 'INEFFECTIVE', 'COUNTEREXAMPLE'];
const hex = (s) => typeof s === 'string' && /^[a-f0-9]{64}$/.test(s);
const exact = (x, fields) =>
  x &&
  typeof x === 'object' &&
  !Array.isArray(x) &&
  Object.keys(x).length === fields.length &&
  fields.every((k) => Object.hasOwn(x, k));
const validTime = (x, now) => Number.isSafeInteger(x) && x >= 0 && x <= now + 60000;
const keyOf = (r) => [r.site, r.structure, r.pattern].join(':');
function validate(data, now) {
  if (
    !exact(data, ['schema_version', 'catalog', 'records']) ||
    data.schema_version !== 'ui-experience/v1' ||
    data.catalog !== PATTERN_VERSION ||
    !Array.isArray(data.records) ||
    data.records.length > 1000
  )
    throw Error('EXPERIENCE_INVALID');
  const keys = new Set();
  for (const r of data.records) {
    if (
      !exact(r, ['site', 'structure', 'pattern', 'samples', 'revoked', 'updated_at']) ||
      !hex(r.site) ||
      !/^[01]{4}$/.test(r.structure) ||
      !PATTERN_IDS.includes(r.pattern) ||
      typeof r.revoked !== 'boolean' ||
      !validTime(r.updated_at, now) ||
      !Array.isArray(r.samples) ||
      r.samples.length > 20 ||
      keys.has(keyOf(r))
    )
      throw Error('EXPERIENCE_INVALID');
    keys.add(keyOf(r));
    const runs = new Set();
    for (const s of r.samples) {
      if (
        !exact(s, ['run', 'outcome', 'at']) ||
        !hex(s.run) ||
        !outcomes.includes(s.outcome) ||
        !validTime(s.at, now) ||
        runs.has(s.run) ||
        s.at > r.updated_at
      )
        throw Error('EXPERIENCE_INVALID');
      runs.add(s.run);
    }
    if (r.samples.some((s) => s.outcome === 'COUNTEREXAMPLE') && !r.revoked)
      throw Error('EXPERIENCE_INVALID');
  }
  return data;
}
async function boundedRead(file, max = MAX_BYTES) {
  const stat = await fs.lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > max) throw Error('EXPERIENCE_INVALID');
  const handle = await fs.open(file, 'r');
  try {
    const buffer = Buffer.alloc(max + 1);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    if (bytesRead > max) throw Error('EXPERIENCE_INVALID');
    return buffer.subarray(0, bytesRead).toString('utf8');
  } finally {
    await handle.close();
  }
}

export class UiExperienceStore {
  #records = new Map();
  #salt;
  #loaded;
  #queue = Promise.resolve();
  #pending = 0;
  #failure = null;
  #diskBytes = null;
  constructor(root, { mode = 'observe', clock = Date.now } = {}) {
    if (!['off', 'observe', 'assist'].includes(mode))
      throw Object.assign(Error('EXPERIENCE_MODE_INVALID'), { code: 'EXPERIENCE_MODE_INVALID' });
    this.root = root;
    this.mode = mode;
    this.clock = clock;
  }
  #digest(value) {
    return createHmac('sha256', this.#salt).update(value).digest('hex');
  }
  #fail() {
    this.#failure = 'EXPERIENCE_UNAVAILABLE';
  }
  async #load() {
    if (this.mode === 'off') return;
    try {
      if (typeof this.root !== 'string' || !this.root) throw Error('EXPERIENCE_INVALID');
      let raw;
      try {
        raw = await boundedRead(path.join(this.root, 'ui-experience.json'));
      } catch (e) {
        if (e.code !== 'ENOENT') throw e;
      }
      try {
        this.#salt = await boundedRead(path.join(this.root, 'ui-experience.salt'), 64);
      } catch (e) {
        if (e.code !== 'ENOENT' || raw !== undefined) throw e;
        this.#salt = randomBytes(32).toString('hex');
      }
      if (!hex(this.#salt)) throw Error('EXPERIENCE_INVALID');
      if (raw !== undefined) {
        const now = this.clock();
        for (const record of validate(JSON.parse(raw), now).records)
          if (record.updated_at > now - TTL) this.#records.set(keyOf(record), record);
        this.#diskBytes = raw;
      }
    } catch {
      this.#fail();
    }
  }
  async begin({ origin, runId }) {
    if (this.mode !== 'off') await (this.#loaded ??= this.#load());
    let site;
    try {
      const url = new URL(origin);
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.username ||
        url.password ||
        typeof runId !== 'string' ||
        runId.length > 100 ||
        !runId
      )
        throw Error('EXPERIENCE_INVALID');
      site = this.mode === 'off' || this.#failure ? null : this.#digest('site:' + url.origin);
    } catch {
      this.#fail();
    }
    const frozen = structuredClone([...this.#records.values()]);
    const run = site ? this.#digest('run:' + runId) : null;
    return {
      mode: this.mode,
      retrieve: (snapshot) => {
        const features = uiFeatures(snapshot);
        const structure = structureKey(features);
        const now = this.clock();
        const verified = new Set(
          frozen
            .filter(
              (r) =>
                r.site === site &&
                r.structure === structure &&
                !r.revoked &&
                !this.#records.get(keyOf(r))?.revoked &&
                r.samples.filter((s) => s.outcome === 'POSITIVE' && s.at > now - TTL).length >= 3,
            )
            .map((r) => r.pattern),
        );
        const hints =
          this.mode === 'off' || this.#failure ? [] : retrievePatterns(features, verified);
        const advice = hints.length
          ? {
              kind: 'UI_ADVICE_NOT_EVIDENCE',
              catalog: PATTERN_VERSION,
              notice: EXPERIENCE_NOTICE,
              patterns: hints,
            }
          : null;
        if (advice && JSON.stringify(advice).length > 3000) throw Error('EXPERIENCE_ADVICE_LIMIT');
        return {
          mode: this.mode,
          degraded: this.#failure,
          structure,
          matches: hints.map((h) => ({ id: h.id, version: h.version, experience: h.experience })),
          advice: this.mode === 'assist' ? advice : null,
        };
      },
      record: async (receipt, snapshot) => {
        if (this.mode === 'off' || this.#failure || !site)
          return { status: 'DISABLED', reason: this.#failure };
        const proof = consumeExperienceReceipt(receipt);
        if (!proof) return { status: 'REJECTED', reason: 'UNTRUSTED_OR_REPLAYED_RECEIPT' };
        const features = uiFeatures(snapshot);
        if (
          proof.pattern_version !== PATTERN_VERSION ||
          proof.pattern_id !== 'scoped_repeat' ||
          !features.scoped_repeat ||
          !validTime(proof.completed_at, this.clock()) ||
          proof.completed_at < this.clock() - 60000
        )
          return { status: 'REJECTED', reason: 'INAPPLICABLE_RECEIPT' };
        if (this.#pending >= 32) {
          this.#fail();
          return { status: 'DISABLED', reason: this.#failure };
        }
        this.#pending++;
        const operation = this.#queue.then(async () => {
          if (this.#failure) return { status: 'DISABLED', reason: this.#failure };
          const now = this.clock(),
            structure = structureKey(features);
          const base = {
            site,
            structure,
            pattern: proof.pattern_id,
            samples: [],
            revoked: false,
            updated_at: now,
          };
          const key = keyOf(base);
          const record = structuredClone(this.#records.get(key) ?? base);
          record.samples = record.samples.filter((s) => s.at > now - TTL);
          const old = record.samples.find((s) => s.run === run);
          if (old)
            old.outcome =
              outcomes[Math.max(outcomes.indexOf(old.outcome), outcomes.indexOf(proof.outcome))];
          else record.samples.push({ run, outcome: proof.outcome, at: now });
          record.samples = record.samples.slice(-20);
          record.revoked ||= proof.outcome === 'COUNTEREXAMPLE';
          record.updated_at = now;
          this.#records.set(key, record);
          try {
            await this.#persist();
          } catch {
            this.#fail();
            return { status: 'DISABLED', reason: this.#failure };
          }
          return {
            status: record.revoked
              ? 'REVOKED'
              : record.samples.filter((s) => s.outcome === 'POSITIVE').length >= 3
                ? 'ELIGIBLE_NEXT_JOB'
                : 'QUARANTINED',
            pattern_id: proof.pattern_id,
            outcome: proof.outcome,
          };
        });
        this.#queue = operation.catch(() => {});
        try {
          return await operation;
        } finally {
          this.#pending--;
        }
      },
    };
  }
  async #persist() {
    const saltFile = path.join(this.root, 'ui-experience.salt');
    try {
      await fs.writeFile(saltFile, this.#salt, { flag: 'wx', mode: 0o600 });
    } catch (e) {
      if (e.code !== 'EEXIST' || (await boundedRead(saltFile, 64)) !== this.#salt) throw e;
    }
    const now = this.clock();
    const records = [...this.#records.values()]
      .filter((r) => r.updated_at > now - TTL)
      .sort((a, b) => b.updated_at - a.updated_at)
      .slice(0, 1000);
    const envelope = { schema_version: 'ui-experience/v1', catalog: PATTERN_VERSION, records };
    let bytes = JSON.stringify(envelope);
    while (Buffer.byteLength(bytes) > MAX_BYTES && records.length) {
      records.pop();
      bytes = JSON.stringify(envelope);
    }
    const temporary = path.join(this.root, '.ui-experience-' + randomUUID() + '.tmp');
    try {
      await fs.writeFile(temporary, bytes, { flag: 'wx', mode: 0o600 });
      const file = path.join(this.root, 'ui-experience.json');
      let previous = null;
      try {
        previous = await boundedRead(file);
      } catch (e) {
        if (e.code !== 'ENOENT') throw e;
      }
      if (previous !== this.#diskBytes) throw Error('EXPERIENCE_CHANGED_EXTERNALLY');
      await fs.rename(temporary, file);
      this.#diskBytes = bytes;
      this.#records = new Map(records.map((r) => [keyOf(r), r]));
    } finally {
      await fs.unlink(temporary).catch((e) => {
        if (e.code !== 'ENOENT') throw e;
      });
    }
  }
}
