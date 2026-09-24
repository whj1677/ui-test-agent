"""Export one committed tree, install locked dependencies, run zero-model engineering checks.

Run from the normal Git checkout. Evidence stays there; the disposable export has no .git.
No private configuration, node_modules, sessions or historical media are copied.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import zipfile


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--browser-cache', help='Explicit preinstalled Playwright browser cache; retained external dependency, never copied')
    args = parser.parse_args()
    repo = Path(__file__).resolve().parents[2]
    sha = subprocess.check_output(['git', 'rev-parse', args.source + '^{commit}'], cwd=repo).decode().strip()
    output = (repo / args.output).resolve()
    output.relative_to(repo)
    output.mkdir(parents=True, exist_ok=True)
    # Inherit only OS/tool discovery settings, never model credentials or project configuration.
    allowed = {'systemroot', 'windir', 'path', 'pathext', 'comspec', 'temp', 'tmp', 'userprofile', 'appdata', 'localappdata', 'programfiles', 'programfiles(x86)', 'programdata'}
    env = {k: v for k, v in os.environ.items() if k.lower() in allowed}
    results = {'source_commit': sha, 'real_harness_starts': 0, 'model_calls': 0, 'product_runs': 0, 'checks': []}
    private = repo / 'workbench/.local'
    private.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='clean-baseline-', dir=private) as folder:
        temp = Path(folder)
        archive = temp / 'source.zip'
        subprocess.run(['git', 'archive', '--format=zip', '--output', str(archive), sha], cwd=repo, check=True)
        expected = set(filter(None, subprocess.check_output(['git', 'ls-tree', '-rz', '--name-only', sha], cwd=repo).decode().split('\0')))
        clean = temp / 'source'
        with zipfile.ZipFile(archive) as z:
            actual = {i.filename for i in z.infolist() if not i.is_dir()}
            missing = sorted(expected - actual)
            if missing:
                raise RuntimeError('git archive omitted tracked files: ' + repr(missing))
            z.extractall(clean)
        results.update(archive_sha256=hashlib.sha256(archive.read_bytes()).hexdigest(), exported_files=len(actual), export_missing=missing)
        results['locks'] = {p: hashlib.sha256((clean / p).read_bytes()).hexdigest() for p in ['package-lock.json', 'workbench/package-lock.json', 'harness-probe/package-lock.json']}
        env['DSH_HOME'] = str(temp / 'no-model-runtime')
        env['PLAYWRIGHT_BROWSERS_PATH'] = str(Path(args.browser_cache).resolve()) if args.browser_cache else str(temp / 'browsers')
        if args.browser_cache:
            cache = Path(args.browser_cache).resolve()
            if not cache.is_dir():
                raise ValueError('Explicit browser cache does not exist')
            results['retained_browser_cache'] = str(cache)
            results['browser_executables'] = {str(p.relative_to(cache)): hashlib.sha256(p.read_bytes()).hexdigest() for p in cache.glob('**/*.exe')}
        env['npm_config_userconfig'] = str(temp / 'empty.npmrc')
        env['npm_config_globalconfig'] = str(temp / 'empty-global.npmrc')
        (temp / 'empty.npmrc').write_text('')
        (temp / 'empty-global.npmrc').write_text('')
        Path(env['DSH_HOME']).mkdir()
        npm = shutil.which('npm.cmd') or shutil.which('npm')
        commands = [
            ('install-root', [npm, 'ci', '--no-audit', '--no-fund'], '.'),
            ('install-workbench', [npm, 'ci', '--no-audit', '--no-fund'], 'workbench'),
            ('install-harness', [npm, 'ci', '--no-audit', '--no-fund'], 'harness-probe'),
            ('install-browser', ['node', 'node_modules/playwright/cli.js', 'install', 'chromium'], 'workbench'),
            ('workbench', [npm, 'test'], 'workbench'),
            ('harness', [npm, 'test'], 'harness-probe'),
            ('browser-history', ['node', 'tests/browser.integration.mjs'], 'workbench'),
            ('browser-auth', ['node', 'tests/auth-session-browser.integration.mjs'], 'workbench'),
            ('browser-ui-d2a', ['node', 'tests/ui-d2a-browser.integration.mjs'], 'workbench'),
        ]
        if args.browser_cache:
            commands = [entry for entry in commands if entry[0] != 'install-browser']
        results['external_dependencies'] = ['Windows, Node >=22, npm, Python, PowerShell 7, installed Microsoft Edge at test default path', 'npm registry required; Chromium downloaded into disposable cache unless --browser-cache explicitly registers a retained installation', 'Real Harness requires separately retained private DSH runtime; not loaded, packaged or verified here']
        for name, command, cwd in commands:
            log = output / (name + '.log')
            print('RUN ' + name, flush=True)
            with log.open('w', encoding='utf-8') as stream:
                run = subprocess.run(command, cwd=clean / cwd, env=env, stdout=stream, stderr=subprocess.STDOUT)
            content = log.read_text(encoding='utf-8', errors='replace')
            counts = {key: int(m.group(1)) for key in ['tests', 'pass', 'fail', 'skipped'] if (m := re.search(r'^# ' + key + r' (\d+)', content, re.M))}
            item = {'name': name, 'command': command, 'cwd': cwd, 'exit_code': run.returncode, 'counts': counts, 'log': log.relative_to(repo).as_posix(), 'log_sha256': hashlib.sha256(log.read_bytes()).hexdigest()}
            results['checks'].append(item)
            (output / 'result.json').write_text(json.dumps(results, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
            print(name + ': exit=' + str(run.returncode) + ' ' + json.dumps(counts), flush=True)
            if run.returncode:
                return run.returncode
    results['disposable_export_removed'] = True
    (output / 'result.json').write_text(json.dumps(results, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
