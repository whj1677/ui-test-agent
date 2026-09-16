# 可选的 DeepSeek 提示优化实验

这里优化的是“把用例和页面事实映射为声明式计划”的提示。程序的计划校验、用例确认、操作权限、断言、清理和报告逻辑仍在主程序中。实验只产生待审查的提示文件，不修改主程序，也不打开浏览器或连接业务环境。

## 为什么固定 Agent Lightning 0.3.0

2026-09-15 核查时，Agent Lightning 当前版本为 1.0.1，主分支已改为 Trainer、API Gateway、Rollout Controller 组成的 VERL/vLLM 训练架构；旧 APO 接口在 0.x。这里只在独立 Python 环境固定 `agentlightning[apo]==0.3.0`，调用它的 `APO.textual_gradient_and_apply_edit()`。`gradient_model` 和 `apply_edit_model` 均显式设置为用户选择的 DeepSeek 模型，默认与规划模型相同。见 [当前官方项目](https://github.com/microsoft/agent-lightning)、[0.3.0 官方 APO 源码](https://github.com/microsoft/agent-lightning/blob/v0.3.0/agentlightning/algorithm/apo/apo.py) 和 [官方 APO 示例](https://github.com/microsoft/agent-lightning/blob/v0.3.0/examples/apo/room_selector_apo.py)。

DeepSeek 官方提供兼容 OpenAI SDK 的 API；因此该外部 API 可以承担规划、文字反馈和提示修改。这个接口没有给本项目提供 DeepSeek 托管模型的权重训练能力。本实验不声称在训练 DeepSeek 权重。[DeepSeek 官方接口说明](https://api-docs.deepseek.com/)

0.3.0 的 PyPI wheel SHA-256 和实际接口签名已静态核验，记录在 `research/api-verification.json`。**尚未安装第三方 APO 依赖，尚未执行真实 APO 或 DeepSeek 请求。** 本地验证只涵盖下面的评分器和本项目编排桥接。0.3.0 是有意固定的旧版本，后续升级需要重新验证接口；不能直接换成 1.x。

## 有限实验与评分

`dataset.mjs` 内有 14 个人工编写的合成样本，和真实产品用例无关：

| 分组 | 样本数 | 业务域 | 用途 |
| --- | ---: | --- | --- |
| train | 6 | 商品查询、任务查询 | 给 APO 提供反馈 |
| dev | 4 | 资产查询 | 选择候选提示 |
| holdout | 4 | 服务工单查询 | 候选冻结后检查，结果不回传优化器 |

每组同时含可以执行的标准 DOM 查询和应该阻塞的情况；正例包含“无结果”的正常业务预期。缺少弹窗事实、请求任意 JavaScript/命令、要求“持续始终成立”但协议不能表达时应给出具体阻塞原因。另有页面文字提示注入。模型只能看到输入用例、确认的义务和合成页面事实，不能看到标准答案和结果标签。

评分器复用主程序的 v2 计划校验，再核对本合成场景中的动作、对象、输入、预期、全部义务、同时断言与指定时间窗口。改变断言、遗漏数量检查、换业务对象或请求禁用能力得 0 分。有效计划率、正确阻塞率和安全违规数分别统计；缺失响应仍进入分母。把所有用例都阻塞不会提高有效计划率，也不能成为候选优胜者。

默认 1 轮：基线 train/dev、2 次 APO 请求（反馈和改写）、候选 train/dev、基线和已选候选各一次 holdout，最多 30 次请求；全局上限默认 40 次，输出最多 6000 token/次，15 分钟总时限，SDK 重试关闭。所有请求共用计数器，超预算在发请求之前停止。`--rounds` 最多 3，`--max-calls` 最多 80，脚本会事先核对完整实验预算。调用数和 token 限制不等于精确费用承诺，实际用量写入本地记录。

基线协议提示固定，APO 只修改补充规划提示。候选必须不降低 dev 的有效计划率/正确阻塞率且无新增安全违规；选择后先落盘冻结记录，再看 holdout。实验结束后只输出 `review-candidate.json`，`enabled:false`；即使指标提升，也需要结合真实模型用例证据审查才能纳入主程序。

这是小样本的协议与合成场景映射评估，**不是产品测试成功率，不证明复杂 UI 泛化，也不替代真实浏览器执行和独立人工语义评审**。评分器对这里已知的定位方式、动作序列和观测语义有意严格。新业务样本需要先由人审定标准答案，并建立新的保留集；不能反复使用同一 holdout 调参后继续称其独立。

## 本地检查（不消耗 API）

从 `ui-test-agent` 目录运行：

```powershell
node --test tests/optimization.test.mjs
node optimization/evaluate.mjs fixtures
python -m unittest discover -s optimization -p test_apo_bridge.py
python optimization/apo_deepseek.py
```

最后一条只检查数据、分组和预算；没有 `--run` 时不导入第三方包、不发网络请求。Python 编排测试用计数的模拟回复完整走 30 次请求路径，并检查保留集隔离和取消自动部署。

## 在用户提供真实 API 后运行

主程序不依赖这些 Python 包。需要实际 APO 实验时，单独安装：

```powershell
python -m venv optimization/.venv
optimization/.venv/Scripts/python.exe -m pip install -r optimization/requirements-apo.txt
```

密钥只在本机环境变量 `DEEPSEEK_API_KEY` 中配置。不要在聊天、命令参数或结果文件中填写密钥。控制台中填写的密钥只在主服务进程内存中，不会自动同步到这个独立实验进程。可以在 PowerShell 中使用隐藏输入设置当前进程环境：

```powershell
$experimentSecret = Read-Host 'DeepSeek API Key' -AsSecureString
$experimentPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($experimentSecret)
try {
    $env:DEEPSEEK_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($experimentPointer)
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($experimentPointer)
    $experimentSecret.Dispose()
}
```

先做非付费检查，再启动已授权的实验：

```powershell
optimization/.venv/Scripts/python.exe optimization/apo_deepseek.py
optimization/.venv/Scripts/python.exe optimization/apo_deepseek.py --run --rounds 1 --max-calls 40
```

可用 `--model`、`--gradient-model`、`--edit-model` 指定当前账户可调用的官方模型。没有代理地址参数，固定访问 `https://api.deepseek.com`。键值不会打印、写入提示或日志。运行后如不再使用，清除当前 PowerShell 的环境变量：`Remove-Item Env:DEEPSEEK_API_KEY`。

## 产物与证据边界

每轮产生新的 `optimization/runs/<UTC时间>/`，不会覆盖旧运行：

- `manifest.json`：版本、模型实验预算、范围；不含密钥。
- `calls.jsonl`：每次调用的开始、返回或失败状态、模型名和 token 用量。
- `responses.jsonl`：纯合成输入对应的响应与评分；不包含业务环境数据。
- `baseline.json`、`candidate-*.json`：固定协议提示与候选补充提示。
- `selection-before-holdout.json`：查看保留集前已冻结的选择。
- `summary.json`：train/dev/holdout 指标，自动部署恒为 false。
- `review-candidate.json`：供审查的候选，默认未启用。
- `interrupted.json`：发生网络错误、预算/时限耗尽或中断时记录阶段；不把半轮实验记为优化完成。

下一步真实模型联调应先验证主程序的模型调用、计划生成与人工确认，再使用这套小实验比较候选。真实业务运行权限仍由原测试任务单独定义。
