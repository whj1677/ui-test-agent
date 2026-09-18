import { redact } from './common.mjs';

// Technical rejection accounting only: never values, URLs, exception messages or permissions.
export function rejectionLog() {
  return { total: 0, counts: {}, samples: [], omitted_samples: 0 };
}
export function recordRejection(log, code, name, index) {
  log.total++;
  log.counts[code] = (log.counts[code] ?? 0) + 1;
  if (log.samples.length >= 24 || log.counts[code] > 3) {
    log.omitted_samples++;
    return;
  }
  const safeName =
    /password|token|secret|credential|api.?key|cookie|authorization|session|otp|email|phone|密码|口令|密钥|验证码|银行卡|身份证|手机号|账号|账户|邮箱/iu.test(
      name ?? '',
    )
      ? '敏感控件（名称省略）'
      : redact(String(name ?? ''))
          .replace(/[\u0000-\u001f]/g, ' ')
          .slice(0, 120);
  log.samples.push({ code, name: safeName, control_index: index });
}
