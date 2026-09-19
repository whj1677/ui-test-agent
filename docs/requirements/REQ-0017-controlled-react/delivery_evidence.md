# Delivery Evidence

## Delivery Evidence (managed)

- Generated at: `2026-09-19T23:46:52+08:00`
- Record: `REQ-0017-controlled-react`
- Change fingerprint: `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`
- Verification source: `collector-executed-v1`
- Verification state: `真实结果只读核验已执行`
- Command: `node validation/req0017/v10-audit.mjs`
- Exit code: `0`
- Test count: `未解析`
- Failure count: `0`
- Skipped count: `未解析`
- Log path: `validation/req0017/v10-result-audit.log`
- Log SHA-256: `b0fb301f2596f6c9748cfecb84cee950e2405baab09da849b6f11e23d362de0b`

### Git Status

```text
 M docs/requirements/REQ-0017-controlled-react/delivery_evidence.md
```

### Git Diff Stat

```text
warning: in the working copy of 'docs/requirements/REQ-0017-controlled-react/delivery_evidence.md', LF will be replaced by CRLF the next time Git touches it
 .../REQ-0017-controlled-react/delivery_evidence.md | 709 ++++++++++++++++-----
 1 file changed, 542 insertions(+), 167 deletions(-)
```

### Untracked Files

```text
(none)
```

### Verification Log Excerpt

```text
ai-engineering-context verification-log-v1
Started at: 2026-09-19T23:46:50+08:00
Command: node validation/req0017/v10-audit.mjs
Exit code: 0
Parsed test count: unavailable
Parsed failure count: 0
Parsed skipped count: unavailable

--- command output ---
{
  "budget": {
    "calls": 86,
    "max_calls": 100,
    "started_at": "2026-09-19T15:32:45.196Z",
    "elapsed_ms": 418408,
    "max_ms": 900000
  },
  "cases": [
    {
      "case_id": "LAB-V01",
      "attempt": "0cfe299e-2aad-4134-90b5-0107437c99e5",
      "status": "PASS_ASSERTIONS",
      "steps": [
        {
          "id": "1",
          "status": "COMPLETE"
        },
        {
          "id": "2",
          "status": "COMPLETE"
        },
        {
          "id": "3",
          "status": "COMPLETE"
        },
        {
          "id": "4",
          "status": "COMPLETE"
        }
      ],
      "assertion_count": 13,
      "assertion_failures": 0,
      "build": {
        "schema_version": "ui-agent-build/v1",
        "application": "ui-test-agent",
        "version": "0.4.0-beta.1",
        "build_id": "1a2a95e7d15dcae8fd7eba7687919798689e5247cda28c2350d94b9376b43b12",
        "sources": [
          {
            "file": "package-lock.json",
            "sha256": "cdc20710b4ef93ac559cd7531c67a369619559c39cde91cef89df7facfbd1677"
          },
          {
            "file": "package.json",
            "sha256": "05eee169023bd9ab40239830c1b107b1423ea9d6153022b48110e506961942b8"
          },
          {
            "file": "public/app.js",
            "sha256": "a504d066e128ba3d5d3b630c49cdc55e6828cde9dbb3080557f219cc81443df3"
          },
          {
            "file": "public/evidence-view.js",
            "sha256": "d05a894c59b39d17006ddae4c9924310628d86f65e2fac35c090bfc77dfab756"
          },
          {
            "file": "public/evidence.css",
            "sha256": "d1149370a6c110613e737bed7cae4d8e35c94b7db84276c63aa0174784501462"
          },
          {
            "file": "public/index.html",
            "sha256": "957f05dceaa249663a3def1efb86e668c536251329543248fcdaae4b4a38729a"
          },
          {
            "file": "public/styles.css",
            "sha256": "aec9151d1d9efe9a6b2e66825137f2ecd39b83c6a5ab109e9c2fe495a6c5ddb4"
          },
          {
            "file": "requirements-import.txt",
            "sha256": "5ab8a239c1418483ead11ccd73008173fdd3af6ae97f912357ede24da823b30a"
          },
          {
            "file": "src/adapter-program.mjs",
            "sha256": "dde58696637bd2d80d43430802a6ec715b065d201c918b6fd3cd3fded1b73475"
          },
          {
            "file": "src/adapter-runtime.mjs",
            "sha256": "14c7bb6f41093260e7f6c950a1989b3fd33c068d8475ee5a904ef4417e22450c"
          },
          {
            "file": "src/adapter-worker.mjs",
            "sha256": "6283c4feafe973493e1ce1a4ebe2292940d261c78dd2d59ea736a2698ef273c1"
          },
          {
            "file": "src/adaptive-execution.mjs",
            "sha256": "a93e9002f002b081a37800cd31270076bc6481c7dafad2f4f1e815118242fa6e"
          },
          {
            "file": "src/adaptive-plan.mjs",
            "sha256": "5e55f1938cd557eada3b086dfe99113c35373144d5dbbf7a9f68560a20b89ba7"
          },
          {
            "file": "src/adaptive-preparation.mjs",
            "sha256": "ce7f03eaded454d3297be38b02dca7a5864f15e20a8f94ac7afcc398d2ed7d87"
          },
          {
            "file": "src/adaptive-protocol.mjs",
            "sha256": "04ff627ebe2a3d2896cecd5a776ae881112ccbf9ccb52f4e9305aeffe6c9e2b8"
          },
          {
            "file": "src/adaptive-recovery.mjs",
            "sha256": "f0d8d7f985bb3bb38d858e3b4ee66d3f5466e77dc9b9ae497be8aca684627f38"
          },
          {
            "file": "src/adaptive-review.mjs",
            "sha256": "2382f9556ea87fcd3c3404a756a8bfd110a00a83c5df54cae0bd2723976d71c0"
          },
          {
            "file": "src/autonomous-recovery.mjs",
            "sha256": "0e516e19fd2fb30229eca53e52398778ae4ccf18cdf7d6588d5de898a0bfecbd"
          },
          {
            "file": "src/block-audit.mjs",
            "sha256": "0c0ba72dbcb2ff08913b3dab3f1567db184ccf51b09e8e40f87365340f1bdeb5"
          },
          {
            "file": "src/browser.mjs",
            "sha256": "bc505a39b10d78b7a78002b462268db7d68b40da959e48c372e9df79e4cac68e"
          },
          {
            "file": "src/build-info.mjs",
            "sha256": "a63f5b07618176aafbde697b9491a608f5a4debb2fcea897609b63e48300c152"
          },
          {
            "file": "src/case-advice.mjs",
            "sha256": "de4fe8e40255e062d09e44e623dec41c07d4da982ffe975da04b73bbd4a87eac"
          },
          {
            "file": "src/case-entry-url.mjs",
            "sha256": "d92036609cc37f768b7de7c2d8dba7c047f202a1ef71e99c5bdfbc05a078e414"
          },
          {
            "file": "src/case-named.mjs",
            "sha256": "4bd6a3a7a44a9981d9ab743120a2a6cfa33954ed6e13f5f3c4853bd2ad603281"
          },
          {
            "file": "src/common.mjs",
            "sha256": "ebd4ce58b4ab2ff2acc9b7994118f71910f5423e566463aaf1f2addbbb9ab3a7"
          },
          {
            "file": "src/controlled-react.mjs",
            "sha256": "889b337ce878e332f3bd95109101711e8a95b9c1902f06eea33f1a64d48b3330"
          },
          {
            "file": "src/controller.mjs",
            "sha256": "cf74534e7303799dfa1b33edba521c5480df250967982a46d2564864fa44274e"
          },
          {
            "file": "src/credential-store.mjs",
            "sha256": "566c5ae27805909640255a0e99e4067493a2340e26c4773d133fe170512c11b4"
          },
          {
            "file": "src/data-maintenance.mjs",
            "sha256": "5d3840fb30a89e37776cae8fde1647b9260a3c9596baeaf64e8f20f38482e5b9"
          },
          {
            "file": "src/deepseek.mjs",
            "sha256": "76951b8c4e822faffeef16eb0ead4d9e4375534045eaf826dbc298c19ad629f8"
          },
          {
            "file": "src/demo.mjs",
            "sha256": "5976b4d0f633372c86326fe907b41e696ad48b6d386ee1ca81f753015b48a97c"
          },
          {
            "file": "src/discovery-browser.mjs",
            "sha256": "b10353cbc2fd69d8dd907d5025459da4f4b2d6daf8d2470a427b5f35ce40cf46"
          },
          {
            "file": "src/discovery-memory.mjs",
            "sha256": "79c66dacc36649de18ad2e9fc74ab4c021214c4b97a74f823414018ec230b612"
          },
          {
            "file": "src/discovery.mjs",
            "sha256": "cf8a2df356e58d0b7f1540dec7bf531c2301c138c8b0961e57e5b2504b71d521"
          },
          {
            "file": "src/distribution.mjs",
            "sha256": "bc19fef391e8316647197c8f9bfef0355cebf6beb5aa17bccf1bd035ff3775a8"
          },
          {
            "file": "src/dynamic-row-evidence.mjs",
            "sha256": "9d121ecba73e38c3957a385e1ed50efe940af74dc8f588373026a73a477c6c31"
          },
          {
            "file": "src/expectation-coverage.mjs",
            "sha256": "fafc7b023a827fa8ff1b79beb1912d211f5a877004a4e0ada287602a45bf1d0d"
          },
          {
            "file": "src/importer.mjs",
            "sha256": "fe3abf685e230b95f2b75a5fa0eee7450b9d67e28f9b894226cdcffea26e02a2"
          },
          {
            "file": "src/input-review.mjs",
            "sha256": "ac4ab3db63bf7ad75d7b374ac0b48ffa8a237b62f9c22403026dcc33207f351e"
          },
          {
            "file": "src/installation.mjs",
            "sha256": "8143c47b8c956e973dc211bb2b51f93f889d3552980d89df795af88e76f57e1f"
          },
          {
            "file": "src/intent-plan.mjs",
            "sha256": "ef0884107f9b3872ac3343430bfbe664388df42a8f34c6dbb5c04e761a987bb2"
          },
          {
            "file": "src/intent-preparation.mjs",
            "sha256": "e4bc6e91fa0df715479770d6dab6cf7116377f445e7ffede9f889038b2ff92ae"
          },
          {
            "file": "src/job-budget.mjs",
            "sha256": "977f08b3f2d0cc9cdbae69883555a2be7dcf622c68e6446c7a932158c3118911"
          },
          {
            "file": "src/model-transport.mjs",
            "sha256": "e03154f8d20864d88ee174c069fb719967acc0d788b4151490de3da5b415c96c"
          },
          {
            "file": "src/observation-diagnostics.mjs",
            "sha256": "5b76d41114279b23801255eb552fd5a30af83982fd9fc1869460c2695a640d4b"
          },
          {
            "file": "src/optional-dialog.mjs",
            "sha256": "8e2a17795f8ff9fb05706eb5018256eb2614c306beadeb3c770cb4a79d736c6c"
          },
          {
            "file": "src/plan-feedback.mjs",
            "sha256": "5fcac5b44775c428ec7d169cfb9485f699abae7bb855c5ebe5f719283b2a4440"
          },
          {
            "file": "src/plan-quality.mjs",
            "sha256": "c2f3c781cb4afe6441b49283030a9ff978b2f0c4d417cecc4460ee71e3ac8049"
          },
          {
            "file": "src/plan-repair.mjs",
            "sha256": "b7a265028c63f2ee2f7ccd2232131b1a3df8e38b270ac94a7752cbb1eadde543"
          },
          {
            "file": "src/plan-semantics.mjs",
            "sha256": "0ca74096f2b72b8e3e67c4fa5593b5db90615d9db687cc73a8b7c439381f2d58"
          },
          {
            "file": "src/plan-staged.mjs",
            "sha256": "8953cb2722a726975ae2def3af6c7cfff3471e16de45cd057716f5c5f36ef1bc"
          },
          {
            "file": "src/plan-steps.mjs",
            "sha256": "9e3ff2af66cd0549f35b844b0835985e9578c31c23fe3f2e4ccda9084601c725"
          },
          {
            "file": "src/planning-input.mjs",
            "sha256": "1db45624bff405664988f07668d6fb94fdccb01c64525d1e9630eab0aae96eb2"
          },
          {
            "file": "src/plans.mjs",
            "sha256": "2440d37331901b9a778ef9d5157f7a7497192a300e5609d3f6cce55ed14a48be"
          },
          {
            "file": "src/preparation.mjs",
            "sha256": "4c48f6fbfc71575cb7a90a990e26dc9b931b8c6a99d68cd2046dcb39bef92fe4"
          },
          {
            "file": "src/query-capability.mjs",
            "sha256": "3961b38405c705c0b5541a221c34651c9e71ad2b067d044332e14748c3be94cd"
          },
          {
            "file": "src/query-forms.mjs",
            "sha256": "80f3cc2578ae686b63f03d01253b0e261d0f5ca8fa71fa2a2655bee134ecad2d"
          },
          {
            "file": "src/reading-actions.mjs",
            "sha256": "deaadbecaf8842e2fdd84c0e0cb19d502525a537215194f65a638c076f33e336"
          },
          {
            "file": "src/recording-evidence.mjs",
            "sha256": "d48540356d992f3842940ec9697f9683c3d0765ba588e6183f6a7f08b199dd00"
          },
          {
            "file": "src/recovery-gap.mjs",
            "sha256": "3ae8e34c83fbdaf056f0a09c3ba4167151607c77c21c1a9e353bfcbaad0b84c1"
          },
          {
            "file": "src/report-supplement.mjs",
            "sha256": "9b019d4925c41aba0eb74306317aa5e5a8edfd695697ad03d6a9ae33a85d3e47"
          },
          {
            "file": "src/report-view.mjs",
            "sha256": "a11bfd07dcce4f1938ff18d750bd38142afdee323b4a3ceee443f2d9efe357ed"
          },
          {
            "file": "src/report.mjs",
            "sha256": "06bfad735fc6692309b274365b1e4087e7c3e3085a9dc51f9651e7419fa8ef8d"
          },
          {
            "file": "src/row-locator.mjs",
            "sha256": "1765644f102b1f3c19db257e97be06664c37ef17d6daf2e71a1cfad2fd50810e"
          },
          {
            "file": "src/runtime-binding.mjs",
            "sha256": "fa1552ca3d96d59532e72381ca2cad276ad85726c64909d2f17127411b36dea9"
          },
          {
            "file": "src/scope-guidance.mjs",
            "sha256": "bbcf146c6ae2e2b835c8dbbb78cd81d75172f955e4bd8e18d1203f62c3b7b11f"
          },
          {
            "file": "src/server.mjs",
            "sha256": "053b4e42a51e7d28a49b86ab560f4322ed0f78d591a32c54b299f1a28bb4779e"
          },
          {
            "file": "src/step-budget.mjs",
            "sha256": "c2e938385c8ff75dedbe436917c325afa21a97a4706a2a8d917a168b43d4c0c7"
          },
          {
            "file": "src/store.mjs",
            "sha256": "3f2feadce95c7a7f779b80015c44a2c672364fc0cd230b79c7db771b03efdd8a"
          },
          {
            "file": "src/table-assertion.mjs",
            "sha256": "b3a4090ebd18744d60c44212e5979aca5b6f1633c2c96764afb2157910aeb438"
          },
          {
            "file": "src/table-invariant.mjs",
            "sha256": "035a0288e0636aa7f1871843356cb6998c87433e2ea6f35134de56933eba541f"
          },
          {
            "file": "src/telemetry.mjs",
            "sha256": "ffafcb66c1303db0f56d7d297e742898b24849342049adca371719b23f202703"
          },
          {
            "file": "src/ui-experience-evidence.mjs",
            "sha256": "f716b3e7a7936c6f810ccff30a87bee0ac54c3f04ff97f05e1c37f7f17ff98a2"
          },
          {
            "file": "src/ui-experience.mjs",
            "sha256": "8daa2932e366a71d09bb2224cac041f61ba3273187cf3ce03da42c655fa53b6d"
          },
          {
            "file": "src/ui-patterns.mjs",
            "sha256": "d5d1ecfcb0ae38ce26429233fecc7a0131d47e1c5c34491a154cecccb84fa63a"
          },
          {
            "file": "src/within-locator.mjs",
            "sha256": "2da5b7c6bbbf9a7c2c6f758908925ebca6629b0987bbdf778eef76022df9a7e6"
          },
          {
            "file": "src/wizard-binding.mjs",
            "sha256": "908652c0a8d59e38f742f04502c79989c9763457d403386f5ea0b76fb82c370c"
          },
          {
            "file": "vendor/manual-ui/agent_repair_contract.mjs",
            "sha256": "055d60b7e3e637d82fe80ccb630f27f211a279b18df0d1d20e1d6b6a0f8b0c3c"
          },
          {
            "file": "vendor/manual-ui/case_handoff.mjs",
            "sha256": "50f889f710058b6d525ddef9e10c027f63736f09693629a60a89d0bbe21a741c"
          },
          {
            "file": "vendor/manual-ui/confirmed_expectations.mjs",
            "sha256": "29154826bc28b3209ad30ec2543b2a8bf63853512ec23993773771a33d098d78"
          },
          {
            "file": "vendor/manual-ui/generic_playwright_orchestrator.mjs",
            "sha256": "4e723ca8dd9825272a0de6269dae60e49c99eec7be84b58962fa19a5fccbcfff"
          },
          {
            "file": "vendor/manual-ui/handoff_runtime.mjs",
            "sha256": "942f27e52bc7ca57d910716581dd3a3bacebc224ba6d1e24a3692a55697120b0"
          },
          {
            "file": "vendor/manual-ui/offline_html_report.mjs",
            "sha256": "b3b69bfcc919148c047ce7bf2bc6b1a046fdd8b67c79b818597aeb64346ac80c"
          },
          {
            "file": "vendor/manual-ui/portable-ui-workflow.mjs",
            "sha256": "9698a7232f7e248ece294fac1aa3957d2366fa16c43307a1924a98120e736f47"
          },
          {
            "file": "vendor/manual-ui/portable_auth.mjs",
            "sha256": "79d968a404790318cd351fcb4861ea9871ee989f8f05ae122eaf7263f7837a57"
          },
          {
            "file": "vendor/manual-ui/portable_xlsx_rows.py",
            "sha256": "27b90bbbe39b59aa87b233a696d975446e2c6375ba3339b45e118fd7ff9f5953"
          },
          {
            "file": "vendor/manual-ui/readonly_playwright_discovery.mjs",
            "sha256": "5ef305ce3571acc9dbe9d5ca328deac6528483790673f45477fe4bf745fce151"
          },
          {
            "file": "vendor/manual-ui/semantic_inventory_binder.mjs",
            "sha256": "beebf183b5ee9ef911a2ed03cf711877cc4c4188025618890d2299b11b976855"
          },
          {
            "file": "vendor/manual-ui/session_command_file.mjs",
            "sha256": "09658068427aefaeeeebbb89c1ffe316a72c1578bf4bc3a6a1840c017b8d47f7"
          },
          {
            "file": "vendor/manual-ui/session_module_snapshot.mjs",
            "sha256": "6f11254aa94a05d480d6032373b51b66d11462ef3a555ade0aa008b083c5de93"
          },
          {
            "file": "vendor/manual-ui/step_evidence_contract.mjs",
            "sha256": "a96cb0b628e6e66362ce0de91149f7029d76fb4b71e7958ae10b13cd48e44c37"
          },
          {
            "file": "vendor/manual-ui/upstream-hashes.json",
            "sha256": "8bb7a0ac46d61ea05525dbe46b3072005c623acb18012382cb704e41a9ce1a9f"
          },
          {
            "file": "停止.cmd",
            "sha256": "1fd607ad7bd3960904f968f2778fd160f274ebe4991795c9642262cac59b1188"
          },
          {
            "file": "停止.ps1",
            "sha256": "358e83208dcf752767e145b010c4f88ce67f0794112864f64cfad937585669e6"
          },
          {
            "file": "启动.cmd",
            "sha256": "c114367bfa666c5eddd87c6334c8a143e77e140b24b8ae9f3e3d6104d54a2dfa"
          },
          {
            "file": "启动.ps1",
            "sha256": "47d18a44e10e615305ff226e3c0402f14bf318a5b62e5a7ed92b0f85b7a73feb"
          },
          {
            "file": "备份数据.cmd",
            "sha256": "2ed9587650f9c602b4e4b2a05876a87f61a7ddefee78451c91011e264ed60fce"
          },
          {
            "file": "备份数据.ps1",
            "sha256": "0f7a6e18da5880830ef9079be08c815f555e613b3c1169be444848bcc47301c7"
          },
          {
            "file": "安装.cmd",
            "sha256": "b841feae0704d77c8211ee5787eaf8c77999f3521407994d92c4f2ee5edf198f"
          },
          {
            "file": "安装.ps1",
            "sha256": "2cc371f380e16ec7e4cd080070ee64a64072788684c5302204273d1efdea3896"
          },
          {
            "file": "恢复启动.cmd",
            "sha256": "f85bca869d37f727a1cdc862e86c7810da7c87a9a3999d31adeee5eb8c71a856"
          },
          {
            "file": "恢复启动.ps1",
            "sha256": "824c49edd64913d266048500376471c6512a4375e69c46e8a67697be67586167"
          },
          {
            "file": "环境检查.cmd",
            "sha256": "63902019800c8ad74596aab84a1eff308018449564be5c3c295cbdad86b423bc"
          },
          {
            "file": "环境检查.ps1",
            "sha256": "64b9ae7d6a12533163ae113b707b7f0fc5bdc575c19e7ed11b169cae73e7b83c"
          }
        ]
      },
      "semantic_acceptance": "PENDING_REVIEW"
    },
    {
      "case_id": "LAB-V02",
      "attempt": "c17606c8-1955-4b32-9b3f-d15d89be3239",
      "status": "PASS_ASSERTIONS",
      "steps": [
        {
          "id": "1",
          "status": "COMPLETE"
        },
        {
          "id": "2",
          "status": "COMPLETE"
        },
        {
          "id": "3",
          "status": "COMPLETE"
        },
        {
          "id": "4",
          "status": "COMPLETE"
        }
      ],
      "assertion_count": 18,
      "assertion_failures": 0,
      "build": {
        "schema_version": "ui-agent-build/v1",
        "application": "ui-test-agent",
        "version": "0.4.0-beta.1",
        "build_id": "1a2a95e7d15dcae8fd7eba7687919798689e5247cda28c2350d94b9376b43b12",
        "sources": [
          {
            "file": "package-lock.json",
            "sha256": "cdc20710b4ef93ac559cd7531c67a369619559c39cde91cef89df7facfbd1677"
          },
          {
            "file": "package.json",
            "sha256": "05eee169023bd9ab40239830c1b107b1423ea9d6153022b48110e506961942b8"
          },
          {
            "file": "public/app.js",
            "sha256": "a504d066e128ba3d5d3b630c49cdc55e6828cde9dbb3080557f219cc81443df3"
          },
          {
            "file": "public/evidence-view.js",
            "sha256": "d05a894c59b39d17006ddae4c9924310628d86f65e2fac35c090bfc77dfab756"
          },
          {
            "file": "public/evidence.css",
            "sha256": "d1149370a6c110613e737bed7cae4d8e35c94b7db84276c63aa0174784501462"
          },
          {
            "file": "public/index.html",
            "sha256": "957f05dceaa249663a3def1efb86e668c536251329543248fcdaae4b4a38729a"
          },
          {
            "file": "public/styles.css",
            "sha256": "aec9151d1d9efe9a6b2e66825137f2ecd39b83c6a5ab109e9c2fe495a6c5ddb4"
          },
          {
            "file": "requirements-import.txt",
            "sha256": "5ab8a239c1418483ead11ccd73008173fdd3af6ae97f912357ede24da823b30a"
          },
          {
            "file": "src/adapter-program.mjs",
            "sha256": "dde58696637bd2d80d43430802a6e
... truncated ...
```

### Sync Record Status

```text
DRY-RUN: no derived changes for REQ-0017-controlled-react; explicit implementation states retained, never inferred from verification.
```

### Check AI Context

- Exit code: `0`

```text
PASS ai-engineering-context checks
```

### Notes

归档real-model-v10-result.md；此前新增报告尚未登记导致检查失败，现重新采集。核验原步骤与40份媒体摘要；2/3整例完成不是发布验收。86执行+4诊断调用，提示试改已撤回，未重跑模型。
