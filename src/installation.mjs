import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';
import { APP_ROOT, readBuildInfo } from './build-info.mjs';
import { backupData, recoverDeadWriter } from './data-maintenance.mjs';

const run = promisify(execFile);

export async function inspectEnvironment({ root = APP_ROOT, probeBrowser = true } = {}) {
  const checks = [];
  checks.push({
    name: 'Node.js',
    ready: Number(process.versions.node.split('.')[0]) >= 22,
    detail: process.versions.node,
  });
  try {
    const build = await readBuildInfo(root);
    checks.push({
      name: '程序文件',
      ready: true,
      detail: build.version + ' / ' + build.build_id.slice(0, 12),
    });
    const manifestPath = path.join(root, 'release-manifest.json');
    try {
      const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
      if (manifest.build_id !== build.build_id) throw new Error('BUILD_CHANGED');
      // The release manifest is a local integrity check, not a publisher signature.
      checks.push({ name: '候选包摘要', ready: true, detail: '与打包时一致（不代表发布验收）' });
    } catch (error) {
      if (error.code !== 'ENOENT')
        checks.push({
          name: '候选包摘要',
          ready: false,
          detail: '文件发生变化，请重新取得完整候选包',
        });
    }
  } catch {
    checks.push({ name: '程序文件', ready: false, detail: '无法核对，请重新解压完整安装包' });
  }
  let browser;
  try {
    const lock = JSON.parse(await fs.readFile(path.join(root, 'package-lock.json'), 'utf8'));
    for (const dependency of ['playwright', 'playwright-core']) {
      const installed = JSON.parse(
        await fs.readFile(path.join(root, 'node_modules', dependency, 'package.json'), 'utf8'),
      );
      if (installed.version !== lock.packages['node_modules/' + dependency].version)
        throw new Error('DEPENDENCY_VERSION_CHANGED');
    }
    const { chromium } = await import(
      pathToFileURL(path.join(root, 'node_modules/playwright/index.mjs')).href
    );
    if (probeBrowser) {
      browser = await chromium.launch({ headless: true });
      await browser.newPage();
    } else await fs.access(chromium.executablePath());
    checks.push({
      name: 'Chromium',
      ready: true,
      detail: probeBrowser ? '已启动并正常关闭独立空白浏览器' : '程序文件存在',
    });
  } catch {
    checks.push({ name: 'Chromium', ready: false, detail: '请运行 安装.cmd 安装固定依赖与浏览器' });
  } finally {
    await browser?.close();
  }
  const localPython = path.join(root, '.python-venv', 'Scripts', 'python.exe');
  const python =
    process.env.PYTHON ||
    (await fs.access(localPython).then(
      () => localPython,
      () => 'python',
    ));
  try {
    const { stdout } = await run(
      python,
      ['-c', 'import sys,openpyxl; assert sys.version_info >= (3,10); print(openpyxl.__version__)'],
      {
        timeout: 10000,
        windowsHide: true,
        env: { ...process.env, PYTHONUTF8: '1' },
      },
    );
    checks.push({
      name: 'Excel 导入',
      ready: true,
      optional: true,
      detail: 'Python 与 openpyxl ' + stdout.trim(),
    });
  } catch {
    checks.push({
      name: 'Excel 导入',
      ready: false,
      optional: true,
      detail: '需 Python 3.10+，再运行 安装.cmd；JSON/CSV 不受影响',
    });
  }
  return { ready: checks.every((check) => check.ready || check.optional), checks };
}

const messages = {
  DATA_MAINTENANCE_ACTIVE:
    '数据维护正在进行，或上次维护异常退出。请保留目录并联系维护者，不要手工删锁。',
  WRITER_STILL_RUNNING: '原服务进程仍存在。请先使用 停止.cmd；不会强制结束进程。',
  WRITER_OWNER_UNVERIFIED: '无法确认原进程已经退出。保留锁和历史数据，请联系维护者。',
  DATA_DIRECTORY_LOCK_CHANGED: '锁的归属已经改变，本次恢复停止。请核对当前服务。',
  BACKUP_REQUIRES_STOP: '请先正常停止服务，再备份。异常退出时先使用 恢复启动.cmd。',
  BACKUP_INSIDE_DATA_DIRECTORY: '备份位置必须位于数据目录之外。',
  BACKUP_SYMLINK_UNSUPPORTED: '数据目录包含链接，未完成备份。请联系维护者核对实际数据位置。',
  EEXIST: '目标目录已经存在，请选择一个新的备份目录。',
};

async function main() {
  const command = process.argv[2];
  const data = path.resolve(process.env.UI_AGENT_DATA_DIR || path.join(APP_ROOT, 'data', 'v02'));
  if (command === 'doctor') {
    const result = await inspectEnvironment();
    for (const check of result.checks)
      console.log(
        `${check.ready ? '就绪' : check.optional ? '可选项缺失' : '未就绪'} | ${check.name} | ${check.detail}`,
      );
    console.log('自检不访问被测站点、不调用 DeepSeek，也不验证业务用例。');
    process.exitCode = result.ready ? 0 : 1;
  } else if (command === 'recover') {
    const result = await recoverDeadWriter(data);
    console.log(
      result.status === 'RECOVERED'
        ? '已确认原进程退出并归档旧锁。历史、未清理状态保持原样；现在可重新启动。'
        : '没有需要恢复的进程锁，现在可正常启动。',
    );
  } else if (command === 'backup') {
    const destination = process.argv[3];
    if (!destination) throw new Error('需要指定一个尚不存在的备份目录。');
    const result = await backupData(data, destination);
    console.log(`备份完成：${result.directory}（${result.file_count} 个文件）`);
    console.log('备份包含业务资料和录像，不是脱敏支持包，请仅保存在获准的位置。');
  } else throw new Error('未知安装维护命令。');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(
      messages[error.code || error.message] ||
        '操作未完成，请保留原数据并联系维护者。错误代码：' + (error.code || 'MAINTENANCE_FAILED'),
    );
    process.exitCode = 1;
  });
}
