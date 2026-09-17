import fs from 'node:fs/promises';
import path from 'node:path';
import { keys, fail, semanticHash, now, publicError } from './common.mjs';
import { caseHash, validateLocator } from './plans.mjs';
import { ADAPTER_REPAIR_PROMPT, DEFAULT_ADAPTER_SOURCE } from './adapter-program.mjs';
import { prepareWithRepair } from './plan-repair.mjs';
import { recoveryKind, recoveryEvidence, usefulProbe } from './recovery-gap.mjs';
import { planningInput } from './planning-input.mjs';
import {
  DISCOVERY_PROMPT,
  validateDiscoveryResponse,
  normalizeDiscoveryResponse,
} from './discovery.mjs';

const RECOVERY_PROMPT =
  DISCOVERY_PROMPT +
  `
This is TECHNICAL RECOVERY of a blocked plan, not a new business task. missing_fact is the specific diagnosed obstacle. First seek fresh evidence instead of repeating a plan on unchanged input. Use safe supplied menu candidates to find the relevant page. You may additionally return exactly {"probe":{"target":locator},"reason":"Chinese explanation"} to inspect uniqueness and visibility of a locator grounded in the observed page. A probe never clicks and never reads input values. prior_probes are facts, not business outcomes. Do not repeat failed probes or transitions. If the obstacle is a real oracle/permission gap, explain it instead of changing expectations or authorizations.`;

export async function repairObservedAdapter(controller, job, explorer, observation) {
  const mappingGaps =
    observation.snapshot.adapter_gaps?.filter((g) => !g.code?.startsWith('ROW_')) ?? [];
  if (!mappingGaps.length || !explorer.repairAdapter) return observation;
  const state = await controller.store.read(job.id);
  if ((state.adapter_repair_attempts ?? []).length >= 2) return observation;
  const attempt = {
    at: now(),
    status: 'STARTED',
    previous_hash: observation.snapshot.adapter_hash,
  };
  await controller.store.update(job.id, (s) => {
    controller.assertCurrent(job);
    (s.adapter_repair_attempts ??= []).push(attempt);
    controller.store.event(s, 'ADAPTER_REPAIR_STARTED', {
      message: '发现适配映射缺口，正在生成并验证受限源码修复。',
    });
  });
  const previousSource = controller.browser.adapterSource ?? DEFAULT_ADAPTER_SOURCE;
  let source;
  try {
    const reply = await controller.ask(
      job,
      ADAPTER_REPAIR_PROMPT,
      {
        source: previousSource,
        gaps: mappingGaps,
        boundary:
          'Only mapping of observed DOM metadata; no browser, filesystem, network, oracle or permission access.',
      },
      { phase: 'adapter_repair' },
    );
    keys(reply, ['source', 'reason'], ['source', 'reason']);
    if (typeof reply.source !== 'string' || typeof reply.reason !== 'string')
      fail('ADAPTER_PROGRAM_REJECTED');
    source = reply.source;
    const receipt = await explorer.repairAdapter(source);
    const refreshed = await explorer.observe();
    controller.assertCurrent(job);
    const directory = path.join(controller.store.dir(job.id), 'adapters');
    await fs.mkdir(directory, { recursive: true });
    const filename = receipt.hash + '.mjs';
    try {
      await fs.writeFile(path.join(directory, filename), source, { flag: 'wx' });
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      if ((await fs.readFile(path.join(directory, filename), 'utf8')) !== source)
        fail('ADAPTER_HASH_MISMATCH');
    }
    await controller.store.update(job.id, (s) => {
      controller.assertCurrent(job);
      s.adapter_program = {
        source,
        hash: receipt.hash,
        at: now(),
        artifact: 'adapters/' + filename,
      };
      Object.assign(s.adapter_repair_attempts.at(-1), receipt, {
        status: 'VERIFIED',
        artifact: 'adapters/' + filename,
      });
      controller.store.event(s, 'ADAPTER_REPAIR_VERIFIED', receipt);
    });
    return refreshed;
  } catch (error) {
    controller.browser.adapterSource = previousSource;
    await controller.store.update(job.id, (s) => {
      Object.assign(s.adapter_repair_attempts.at(-1), {
        status: 'REJECTED',
        code: publicError(error),
        ...(typeof source === 'string' ? { proposed_hash: semanticHash(source) } : {}),
      });
      controller.store.event(s, 'ADAPTER_REPAIR_REJECTED', {
        code: publicError(error),
        message: '修复未获验证，保留原适配版本与失败证据。',
      });
    });
    if (
      job.abort.signal.aborted ||
      job.diagnostic_failed ||
      String(error.code).startsWith('DEEPSEEK_')
    )
      throw error;
    return observation;
  }
}

export async function prepareAutonomously(controller, job, baseline, c, suppliedExplorer = null) {
  for (;;) {
    await prepareWithRepair(controller, job, baseline, c);
    const state = await controller.store.read(job.id),
      row = state.cases.find((r) => r.case_id === c.case_id);
    if (
      row.status !== 'BLOCKED_MAPPING' ||
      !row.reviewed ||
      row.attempts.length ||
      !controller.browser.active?.(job.id) ||
      !controller.browser.authenticated ||
      !state.authorization.nonproduction ||
      (row.preparation_budget?.used ?? 0) >= 3
    )
      return;
    await controller.requireCleanSite(state);
    const repairs = row.evidence_recoveries ?? [];
    if (repairs.length >= 2) return;
    const kind = recoveryKind(row);
    if (kind !== 'TARGETED_EVIDENCE') return;
    const reason = row.mapping_reason ?? '';
    const knownFacts = new Set(
      recoveryEvidence(planningInput(state, c, row, caseHash(c)).pages, reason),
    );
    let addedFacts = 0;
    const previousProbes = repairs.flatMap((r) => r.probes ?? []);
    const usefulProbes = [];
    await controller.store.update(job.id, (s) => {
      controller.assertInput(job, s, baseline, c.case_id, caseHash(c));
      const current = s.cases.find((r) => r.case_id === c.case_id);
      (current.evidence_recoveries ??= []).push({
        at: now(),
        status: 'STARTED',
        reason: row.mapping_reason,
        kind,
        parent_input_hash: row.self_repair?.input_hash,
      });
      controller.store.event(s, 'EVIDENCE_RECOVERY_STARTED', {
        case_id: c.case_id,
        reason: row.mapping_reason,
        message: '计划缺少技术事实，正在重新观察、探测与寻找相关页面。',
      });
    });
    let explorer = suppliedExplorer,
      observation,
      outcome = 'NO_PROGRESS';
    const probes = [],
      visited = new Set(repairs.flatMap((r) => r.visited ?? []));
    try {
      if (!explorer) {
        explorer = controller.discoveryFactory(controller.browser, state, {
          signal: job.abort.signal,
          maxSteps: 6,
          timeoutMs: 45000,
        });
        observation = await explorer.open();
      } else observation = await explorer.observe();
      explorer.beginCase?.(c);
      const deadline = Date.now() + 45000;
      for (let step = 0; step < 6; step++) {
        controller.assertCurrent(job);
        if (Date.now() >= deadline) fail('DISCOVERY_TIMEOUT');
        observation = await repairObservedAdapter(controller, job, explorer, observation);
        const newFacts = recoveryEvidence([observation.snapshot], reason).filter(
          (f) => !knownFacts.has(f),
        );
        if (newFacts.length)
          await controller.store.update(job.id, (s) => {
            controller.assertInput(job, s, baseline, c.case_id, caseHash(c));
            const page = {
              ...observation.snapshot,
              captured_at: now(),
              discovery_case_id: c.case_id,
              discovery_job_id:
                s.cases.find((r) => r.case_id === c.case_id).discovery?.job_id ?? job.run_id,
            };
            if (page.login_page) fail('AUTH_REQUIRED');
            if (
              !s.snapshots.some(
                (p) =>
                  (!p.discovery_case_id ||
                    (p.discovery_case_id === c.case_id &&
                      p.discovery_job_id === page.discovery_job_id)) &&
                  semanticHash({ url: p.url, controls: p.controls, text: p.text }) ===
                    semanticHash({ url: page.url, controls: page.controls, text: page.text }),
              )
            )
              s.snapshots.push(page);
            s.snapshots = s.snapshots.slice(-128);
          });
        for (const fact of newFacts) knownFacts.add(fact);
        addedFacts += newFacts.length;
        const candidates = observation.candidates.filter(
          (v) => !visited.has(semanticHash({ url: observation.snapshot.url, locator: v.locator })),
        );
        const raw = await controller.ask(
          job,
          RECOVERY_PROMPT,
          {
            purpose: 'case_ui_recovery',
            case: c,
            current: observation.snapshot,
            candidates,
            missing_fact: row.mapping_reason,
            prior_probes: [...previousProbes, ...probes],
            visited: [...visited],
            remaining: { steps: 6 - step, model_calls: 6 - step },
          },
          {
            phase: 'evidence_recovery',
            signal: AbortSignal.any([
              job.abort.signal,
              AbortSignal.timeout(Math.max(1, deadline - Date.now())),
            ]),
          },
        );
        if (raw.probe) {
          keys(raw, ['probe', 'reason'], ['probe', 'reason']);
          keys(raw.probe, ['target'], ['target']);
          validateLocator(raw.probe.target);
          if (
            [...previousProbes, ...probes].some(
              (p) => semanticHash(p.locator) === semanticHash(raw.probe.target),
            )
          )
            break;
          const probe = {
            ...(await explorer.probe(raw.probe.target)),
            url: observation.snapshot.url,
          };
          probes.push(probe);
          if (usefulProbe(probe, reason)) usefulProbes.push(probe);
          continue;
        }
        const response = validateDiscoveryResponse(normalizeDiscoveryResponse(raw), {
          candidates,
          caseIds: [c.case_id],
          currentCaseId: c.case_id,
        });
        if (response.done || response.blocked) break;
        const selected = candidates.find((v) => v.candidate_id === response.action.candidate_id);
        visited.add(semanticHash({ url: observation.snapshot.url, locator: selected.locator }));
        observation = await explorer.act(response.action);
      }
      if (addedFacts || usefulProbes.length) outcome = 'NEW_EVIDENCE';
    } catch (error) {
      outcome = publicError(error);
      if (outcome === 'AUTH_REQUIRED') controller.browser.authenticated = false;
      if (
        job.abort.signal.aborted ||
        job.diagnostic_failed ||
        String(error.code).startsWith('DEEPSEEK_')
      )
        throw error;
    } finally {
      if (!suppliedExplorer) await explorer?.close();
      await controller.store.update(job.id, (s) => {
        const current = s.cases.find((r) => r.case_id === c.case_id);
        Object.assign(current.evidence_recoveries.at(-1), {
          status: outcome,
          probes,
          useful_probes: usefulProbes,
          visited: [...visited],
          added_binding_facts: addedFacts,
          finished_at: now(),
        });
        controller.store.event(s, 'EVIDENCE_RECOVERY_FINISHED', { case_id: c.case_id, outcome });
      });
    }
    if (outcome !== 'NEW_EVIDENCE') return;
  }
}
