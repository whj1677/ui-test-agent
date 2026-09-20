<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0020 验证

## Schema

- schema: ai-engineering-context/req-package-v1

## 验证项

| VT | DR | 确认状态 | 执行状态 | 验证项 | 证据标准 | 当前证据 | 命令 | 退出码 | 测试数量 | 失败数量 | 跳过数量 | 证据路径 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| VT-0020-01 | DR-0020-01 | 已确认 | 基础验证通过 | 独立工程基础启动、健康接口、批准源哈希和Git隔离核查。 | 命令、退出码、健康响应、哈希和提交/远端SHA。 | npm test退出码0，2项通过；npm start后GET /api/health返回200及ready；批准脚本SHA-256为280A7875...；原src/public/pilot/heldout-lab无内容差异。提交与远端SHA待本批推送后补充。 | - | - | - | - | - | - |
| VT-0020-02 | DR-0020-01 | 已确认 | 工程验证通过 | 登记真实性、原用例版本、非法/哈希不符拒绝、持久化和启动恢复测试。 | Node测试、临时数据目录和实际catalog/run记录。 | npm test退出码0，7项通过；真实登记首次REGISTERED、再次ALREADY_REGISTERED；资产API返回来源提交、280A...哈希、两份批准依据、配置/锁摘要及normal/fault固定入口；运行目录持久化、路径越界拒绝和重启中断状态由自动化测试覆盖。 | - | - | - | - | - | - |
| VT-0020-03 | DR-0020-02 | 已确认 | 工程验证通过 | 固定Playwright参数、独立进程、环境脱敏、互斥、取消、异常中断和前后哈希测试。 | Node测试、子进程事实和受控模拟夹具。 | npm test退出码0，12项通过；受控模拟核对shell=false参数数组、workers=1/retries=0、入口固定映射、模型Key/Cookie不继承、来源与运行副本哈希、重复启动拒绝、仅自有PID停止、取消终态、未批准/错哈希/越界/非法环境拒绝；API同源与固定字段校验通过。真实Playwright组合留待T4。 | - | - | - | - | - | - |
| VT-0020-04 | DR-0020-03 | 已确认 | 未运行 | 正常/断言失败/缺失损坏/未运行/跳过报告、路径越界/非法入口及真实浏览器Web流程。 | Node测试、浏览器截图和三方记录核对。 | 无 | - | - | - | - | - | - |
| VT-0020-05 | DR-0020-04 | 已确认 | 未运行 | 真实正常/故障各一次、重启历史/附件、原资产与旧历史不变、零模型/零重试和GitHub远端一致性。 | 运行ID、哈希表、Playwright报告、Web截图、验收报告、提交及远端SHA。 | 无 | - | - | - | - | - | - |

## 本轮命令与环境

- 工作目录：D:\01_AI工程\01_工程项目\ui-test-agent-workbench-m1
- 命令：cd workbench; npm ci
- 命令：npm test
- 命令：npm start
- 命令：npm run register:approved
- 命令：npm run test:browser
- 环境：Windows PowerShell
- 环境：Node.js v22.19.0 / npm 10.9.3
- 环境：127.0.0.1:4210；冻结heldout站点127.0.0.1:4198
- 环境：@playwright/test 1.62.1；Chromium；workers=1；retries=0

## 结论

- 实施中；必须以实际执行证据更新。
