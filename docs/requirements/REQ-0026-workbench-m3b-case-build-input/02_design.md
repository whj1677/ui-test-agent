<!-- generated from requirement.source.json; do not edit directly -->
# REQ-0026 设计

## 设计标识

| DD | 关联 DR | 状态 | 方案摘要 | 设计理由 |
|---|---|---|---|---|
| DD-0026-01 | DR-0026-01 / DR-0026-04 | 已确认 | 在BuildTaskManager新增project-case提交方法，由CaseLibraryStore按四元组解析确切版本；request_id同时绑定项目、用例、版本、内容哈希和环境的确定指纹，内存处理中和持久化复用均先核对身份。 | 复用现有任务存储与历史，不建立第二套任务系统；旧任务从source与environment_ref推导身份，无法确定时拒绝而不猜测。 |
| DD-0026-02 | DR-0026-02 / DR-0026-04 | 已确认 | 任务根目录保存input/case-snapshot.json、task.md和agent-instruction.txt，task.json登记冻结input_bundle和受控文件索引；后续启动组装复用同一来源。 | 机器输入、可读任务和固定指令都可哈希核对，创建后不依赖项目当前状态。 |
| DD-0026-03 | DR-0026-01 / DR-0026-02 | 已确认 | 环境固定为现有synthetic-probe无登录合成环境引用，运行URL留到受控执行时绑定；项目用例内容从不回退到PROBE-42模板。 | 不从自然语言猜URL且保留固定探针兼容性。 |
| DD-0026-04 | DR-0026-03 / DR-0026-04 | 已确认 | 双向关联由build task的source字段作为权威事实，项目页面从现有任务列表派生关联；INPUT_ONLY策略同时禁用UI启动并由后端拒绝。 | 避免跨存储双写和部分提交，同时封闭额度绕过路径。 |
| DD-0026-05 | DR-0026-05 | 已确认 | 在现有单页详情中增加版本/环境选择、明确只创建CTA、关联历史及真实输入查看区；使用原生语义控件和文字状态。 | 保持M3-A/M2-C视觉与交互一致，并使状态不依赖颜色理解。 |

## 接口与数据流

- 项目详情选择版本/固定环境 -> POST project-case build task -> 服务端读取project/case/version并核哈希 -> BuildTaskStore原子创建任务和三份输入文件。
- build task source保存项目/用例/版本/哈希；项目详情按source派生关联任务，任务详情用source返回项目用例。
- 未来受控启动只可读取冻结input_bundle并渲染已登记task.md/指令；本批execution_policy禁止启动。

## 模块文档影响

- 更新workbench case-library与candidate-build模块文档，记录项目用例输入契约、冻结文件、双向关联和INPUT_ONLY执行边界。

## 风险与回滚

- 任务与项目分属两个JSON存储；使用单向不可变source引用避免双写，项目删除本批不支持。
- 重复提交以request_id与五项请求身份共同幂等；同键异身份返回409冲突，不返回旧任务也不创建新任务。不同request_id仍是用户明确创建的新任务，不按内容哈希自动吞并。
- 删除新增project-case提交入口与显示区即可回滚；既有build task和case project schema仍兼容。
