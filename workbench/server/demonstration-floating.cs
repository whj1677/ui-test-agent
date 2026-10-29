using System;
using System.Collections.Generic;
using System.Drawing;
using System.Net.Http;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using System.Windows.Forms;
using System.Web.Script.Serialization;

public sealed class DemonstrationFloating : Form {
  const string Origin = "http://127.0.0.1:4322";
  readonly string projectId, demonstrationId, endpoint;
  readonly HttpClient client;
  readonly bool emitReady;
  readonly JavaScriptSerializer json = new JavaScriptSerializer();
  readonly Label title = new Label(), state = new Label(), notice = new Label(), actionText = new Label();
  readonly ComboBox steps = new ComboBox();
  readonly TextBox expectedText = new TextBox();
  readonly FlowLayoutPanel buttons = new FlowLayoutPanel();
  readonly Button collapse = new Button(), next = new Button(), expectedToggle = new Button();
  readonly Timer poll = new Timer();
  readonly ToolTip details = new ToolTip();
  Dictionary<string, object> recording;
  string actionError = "";
  bool busy, collapsed, expectedOpen, closingApproved, identityValid, readySent;
  string lastButtonStatus;
  [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr hWnd);

  public DemonstrationFloating(string projectId, string demonstrationId) : this(projectId, demonstrationId,
    new HttpClientHandler { UseProxy = false, AllowAutoRedirect = false }, true) {}

  DemonstrationFloating(string projectId, string demonstrationId, HttpMessageHandler handler, bool emitReady) {
    this.projectId = projectId; this.demonstrationId = demonstrationId;
    this.emitReady = emitReady; client = new HttpClient(handler);
    endpoint = Origin + "/api/case-library/projects/" + Uri.EscapeDataString(projectId) +
      "/demonstrations/" + Uri.EscapeDataString(demonstrationId);
    client.Timeout = TimeSpan.FromSeconds(12);
    client.DefaultRequestHeaders.Add("Origin", Origin);
    TopMost = true; ShowInTaskbar = true; StartPosition = FormStartPosition.Manual;
    Location = new Point(Math.Max(0, Screen.PrimaryScreen.WorkingArea.Right - 395),
      Math.Max(0, Screen.PrimaryScreen.WorkingArea.Top + 45));
    Size = new Size(385, 305); MinimumSize = new Size(385, 166); MaximumSize = new Size(385, 400);
    FormBorderStyle = FormBorderStyle.FixedToolWindow; Text = "人工录制 · 悬浮控制";
    BackColor = Color.FromArgb(244, 248, 251); Font = new Font("Microsoft YaHei UI", 9F);
    title.SetBounds(12, 8, 325, 23); title.AutoEllipsis = true; title.Text = projectId + " / " + demonstrationId;
    state.SetBounds(12, 34, 350, 24); state.Font = new Font("Microsoft YaHei UI", 9F, FontStyle.Bold);
    state.Text = "正在连接正式工作台…";
    collapse.SetBounds(341, 8, 30, 26); collapse.Text = "−";
    collapse.Click += (s, e) => { collapsed = !collapsed; SetCollapsed(); };
    actionText.SetBounds(12, 64, 355, 42); actionText.Text = "当前操作：等待连接";
    steps.SetBounds(12, 109, 155, 26); steps.DropDownStyle = ComboBoxStyle.DropDownList;
    steps.SelectedIndexChanged += async (s, e) => {
      if (!busy && identityValid && !Selecting() && steps.Focused && steps.SelectedIndex >= 0)
        await ControlAsync("step", "step_index", steps.SelectedIndex);
    };
    next.SetBounds(178, 108, 189, 28); next.Text = "下一步 →"; next.BackColor = Color.FromArgb(28, 95, 160);
    next.ForeColor = Color.White; next.FlatStyle = FlatStyle.Flat;
    next.Click += async (s, e) => {
      if (!identityValid || busy || recording == null || Selecting()) return;
      var allSteps = ArrayField(Field(recording, "steps"));
      int current = Convert.ToInt32(Field(recording, "current_step_index"));
      if (current + 1 < allSteps.Length) await ControlAsync("step", "step_index", current + 1);
      else await ControlAsync("stop", null, null);
    };
    expectedText.SetBounds(12, 230, 355, 68); expectedText.Multiline = true; expectedText.ReadOnly = true;
    expectedText.ScrollBars = ScrollBars.Vertical; expectedText.TabStop = false;
    expectedToggle.SetBounds(12, 203, 140, 23); expectedToggle.Text = "查看原预期 ▼";
    expectedToggle.Click += (s, e) => { expectedOpen = !expectedOpen; SetCollapsed(); };
    buttons.SetBounds(8, 144, 365, 52); buttons.WrapContents = true;
    notice.SetBounds(12, 231, 355, 28); notice.AutoEllipsis = true; notice.ForeColor = Color.FromArgb(130, 50, 15);
    Controls.AddRange(new Control[] { title, state, collapse, actionText, steps, next,
      buttons, expectedToggle, expectedText, notice });
    SetCollapsed();
    poll.Interval = 1500;
    poll.Tick += async (s, e) => await RefreshAsync();
    Shown += async (s, e) => { WatchFocusCommands(); poll.Start(); await RefreshAsync(); };
    FormClosing += async (s, e) => {
      if (closingApproved || !RequiresPauseForClose()) return;
      e.Cancel = true;
      if (await PauseForCloseAsync()) { closingApproved = true; Close(); }
      else notice.Text = "暂停失败，窗口保持打开；请重试。";
    };
    FormClosed += (s, e) => { poll.Stop(); client.Dispose(); };
  }

  static object Field(Dictionary<string, object> item, string key) {
    object value; return item != null && item.TryGetValue(key, out value) ? value : null;
  }
  static string StringField(Dictionary<string, object> item, string key) {
    return Convert.ToString(Field(item, key)) ?? "";
  }
  static Dictionary<string, object> ObjectField(object value) { return value as Dictionary<string, object>; }
  static object[] ArrayField(object value) { return value as object[] ?? new object[0]; }
  string Status() { return StringField(recording, "status"); }
  bool Selecting() { return !String.IsNullOrEmpty(StringField(recording, "selection_mode")); }
  bool RequiresPauseForClose() {
    return Status() == "RECORDING";
  }
  async Task<bool> PauseForCloseAsync() {
    if (!RequiresPauseForClose()) return true;
    if (busy) { notice.Text = "请等待当前操作完成后关闭。"; return false; }
    return await ControlAsync("pause", null, null);
  }
  void SetCollapsed() {
    steps.Visible = next.Visible = buttons.Visible = expectedToggle.Visible = notice.Visible = !collapsed;
    expectedText.Visible = !collapsed && expectedOpen;
    notice.Top = expectedOpen && !collapsed ? 311 : 231;
    Height = collapsed ? 166 : expectedOpen ? 400 : 305;
    collapse.Text = collapsed ? "+" : "−";
    expectedToggle.Text = expectedOpen ? "收起原预期 ▲" : "查看原预期 ▼";
  }
  void WatchFocusCommands() {
    Task.Run((Action)(() => {
      string line;
      while ((line = Console.ReadLine()) != null) {
        if (line != "FOCUS" || IsDisposed || !IsHandleCreated) continue;
        try { BeginInvoke((Action)(() => {
          if (IsDisposed) return;
          WindowState = FormWindowState.Normal; Activate(); BringToFront(); SetForegroundWindow(Handle);
        })); } catch (InvalidOperationException) { return; }
      }
    }));
  }
  async Task<Dictionary<string, object>> RequestAsync(bool post, Dictionary<string, object> payload) {
    HttpResponseMessage response;
    if (post) {
      using (var content = new StringContent(json.Serialize(payload), Encoding.UTF8, "application/json"))
        response = await client.PostAsync(endpoint + "/control", content);
    } else response = await client.GetAsync(endpoint);
    using (response) {
      string body = await response.Content.ReadAsStringAsync();
      if (!response.IsSuccessStatusCode) {
        string code = "";
        try { code = StringField(ObjectField(json.DeserializeObject(body)), "error"); } catch {}
        if (code == "AUTH_LOGIN_TARGET_UNREACHABLE")
          throw new Exception("登录站点无法连接，请先恢复被测系统后重试。");
        if (code == "AUTH_LOGIN_PAGE_UNAVAILABLE")
          throw new Exception("登录页面加载失败，请检查被测系统后重试。");
        throw new Exception("HTTP " + (int)response.StatusCode);
      }
      var item = ObjectField(json.DeserializeObject(body));
      if (item == null || StringField(item, "project_id") != projectId ||
          StringField(item, "demonstration_id") != demonstrationId)
        throw new Exception("DEMONSTRATION_FLOATING_IDENTITY_MISMATCH");
      return item;
    }
  }
  async Task RefreshAsync() {
    if (busy || IsDisposed) return;
    busy = true;
    try {
      var nextRecording = await RequestAsync(false, null);
      if (IsDisposed) return;
      recording = nextRecording; identityValid = true; notice.Text = actionError;
      if (!readySent && emitReady) { readySent = true; Console.WriteLine("DEMONSTRATION_FLOATING_READY"); Console.Out.Flush(); }
    }
    catch (Exception error) {
      if (!IsDisposed) { identityValid = false; notice.Text = "连接或身份核验失败：" + error.Message; }
    }
    finally { busy = false; if (!IsDisposed) Render(); }
  }
  async Task<bool> ControlAsync(string verb, string field, object value) {
    if (busy || !identityValid || recording == null) return false;
    actionError = ""; busy = true; Render();
    try {
      var payload = new Dictionary<string, object>(); payload["action"] = verb;
      if (field != null) payload[field] = value;
      var nextRecording = await RequestAsync(true, payload);
      if (IsDisposed) return false;
      recording = nextRecording;
      notice.Text = ""; return true;
    } catch (Exception error) { if (!IsDisposed) { actionError = "操作失败：" + error.Message; notice.Text = actionError; } return false; }
    finally { busy = false; if (!IsDisposed) Render(); }
  }
  async Task<bool> PickAsync(string mode) {
    if (busy || !identityValid || Selecting() || (Status() != "PAUSED" && Status() != "RECORDING")) return false;
    if (Status() == "RECORDING") {
      if (!await ControlAsync("pause", null, null)) return false;
      if (Status() != "PAUSED" || Selecting()) {
        actionError = "暂停状态未确认，未开始断言标记。"; notice.Text = actionError; return false;
      }
    }
    return await ControlAsync("pick", "pick_mode", mode);
  }
  void AddButton(string text, string verb, string field, object value, bool pickEntry = false) {
    var button = new Button(); button.Text = text; button.AutoSize = true; button.Enabled = !busy && identityValid;
    button.Tag = pickEntry ? "pick-entry" : verb;
    if (pickEntry) {
      details.SetToolTip(button, "按原预期选择检查对象；不会生成或修改预期值。");
      button.Click += async (s, e) => await PickAsync((string)value);
    } else button.Click += async (s, e) => await ControlAsync(verb, field, value);
    buttons.Controls.Add(button);
  }
  void Render() {
    string status = Status();
    int index = 0; try { index = Convert.ToInt32(Field(recording, "current_step_index")); } catch {}
    var allSteps = ArrayField(Field(recording, "steps"));
    var allEvents = ArrayField(Field(recording, "events"));
    string caseId = StringField(recording, "case_id");
    string version = Convert.ToString(Field(recording, "case_version")) ?? "";
    string display = StringField(recording, "case_title");
    if (String.IsNullOrWhiteSpace(display)) display = StringField(recording, "case_external_id");
    if (String.IsNullOrWhiteSpace(display)) display = "用例 " +
      (caseId.Length > 18 ? caseId.Substring(0, 18) + "…" : caseId);
    title.Text = display + " v" + version;
    details.SetToolTip(title, "项目：" + projectId + "\n用例：" + caseId + " v" + version);
    string selectionMode = StringField(recording, "selection_mode");
    string statusLabel = !String.IsNullOrEmpty(selectionMode) ?
      (selectionMode == "box" ? "框选中 · 请在业务页拖框" : "点选中 · 请在业务页点选") :
      status == "RECORDING" ? "● 正在录制" : status == "PAUSED" ? "Ⅱ 已暂停" :
      status == "WAITING_LOGIN" ? "等待登录" : status;
    state.Text = statusLabel + " · 步骤 " + (index + 1) + "/" + allSteps.Length + " · 已录 " + allEvents.Length + " 事件";
    state.ForeColor = status == "RECORDING" || !String.IsNullOrEmpty(selectionMode) ?
      Color.FromArgb(184, 37, 31) : Color.FromArgb(35, 68, 95);
    details.SetToolTip(state, !String.IsNullOrEmpty(selectionMode) ?
      "请在业务页" + (selectionMode == "box" ? "拖框" : "点选") + "检查对象，Esc 取消。" : state.Text);
    if (steps.Items.Count != allSteps.Length) {
      steps.Items.Clear(); for (int i = 0; i < allSteps.Length; i++) steps.Items.Add("步骤 " + (i + 1));
    }
    if (index >= 0 && index < steps.Items.Count && steps.SelectedIndex != index) steps.SelectedIndex = index;
    steps.Enabled = !busy && identityValid && !Selecting() && (status == "PAUSED" || status == "RECORDING");
    var current = index >= 0 && index < allSteps.Length ? ObjectField(allSteps[index]) : null;
    actionText.Text = "当前操作：" + StringField(current, "action");
    details.SetToolTip(actionText, actionText.Text);
    expectedText.Text = "原预期：" + StringField(current, "expected");
    next.Enabled = !busy && identityValid && !Selecting() &&
      (status == "PAUSED" || status == "RECORDING") && allSteps.Length > 0;
    next.Text = index + 1 < allSteps.Length ? "下一步 →" : "停止录制 · 回主窗核对";
    if (lastButtonStatus != status) {
      while (buttons.Controls.Count > 0) {
        var old = buttons.Controls[0]; buttons.Controls.RemoveAt(0); old.Dispose();
      }
      if (status == "WAITING_LOGIN") {
        AddButton("打开登录", "login-open", null, null);
        AddButton("检查登录", "login-check", null, null);
      } else if (status == "PAUSED") {
        AddButton("▶ 继续", "start", null, null);
        AddButton("断言点选", "pick", "pick_mode", "point", true);
        AddButton("断言框选", "pick", "pick_mode", "box", true);
      } else if (status == "RECORDING") {
        AddButton("Ⅱ 暂停", "pause", null, null);
        AddButton("断言点选", "pick", "pick_mode", "point", true);
        AddButton("断言框选", "pick", "pick_mode", "box", true);
      }
      if (status == "WAITING_LOGIN" || status == "PAUSED" || status == "RECORDING")
        AddButton("停止", "stop", null, null);
      lastButtonStatus = status;
    }
    foreach (Control control in buttons.Controls) control.Enabled = !busy && identityValid &&
      (!Selecting() || (string)control.Tag == "pause");
    if (!String.IsNullOrEmpty(actionError) && identityValid) notice.Text = actionError;
    else if (!String.IsNullOrEmpty(selectionMode) && identityValid)
      notice.Text = "请在业务页" + (selectionMode == "box" ? "拖框" : "点选") + "检查对象，Esc 取消。";
    else if (status == "WAITING_LOGIN" && identityValid && String.IsNullOrEmpty(notice.Text))
      notice.Text = "请在登录浏览器人工登录，再点击检查登录。";
    else if (identityValid && !String.IsNullOrEmpty(StringField(recording, "selection_notice")))
      notice.Text = StringField(recording, "selection_notice");
  }
  public static void VerifyStateBehavior(string projectId, string demonstrationId) {
    var fixture = new Dictionary<string, object> {
      { "project_id", projectId }, { "demonstration_id", demonstrationId }, { "case_id", "case-fixture" },
      { "case_version", 1 }, { "current_step_index", 0 },
      { "steps", new object[] { new Dictionary<string, object> { { "action", "检查模板" }, { "expected", "列表符合原预期" } },
                                new Dictionary<string, object> { { "action", "下一项" }, { "expected", "可见" } } } },
      { "events", new object[0] }, { "status", "PAUSED" }
    };
    string fixtureBody = new JavaScriptSerializer().Serialize(fixture);
    var handler = new FixtureHandler(fixtureBody);
    using (var form = new DemonstrationFloating(projectId, demonstrationId, handler, false)) {
      var step = new Dictionary<string, object>(); step["action"] = "检查模板"; step["expected"] = "列表符合原预期";
      form.recording = fixture;
      form.identityValid = true; form.busy = true; form.Render();
      if (form.next.Enabled || form.steps.Enabled || form.buttons.Controls.Count == 0 ||
          ((Button)form.buttons.Controls[0]).Enabled) throw new Exception("SELFTEST_BUSY_GUARD_FAILED");
      form.busy = false; form.Render();
      if (!form.next.Enabled || !form.steps.Enabled || !((Button)form.buttons.Controls[0]).Enabled ||
          !form.actionText.Text.Contains("检查模板")) throw new Exception("SELFTEST_REFRESH_ENABLE_FAILED");
      var originalButton = form.buttons.Controls[0];
      WaitForSelfTest(form.RefreshAsync());
      if (!form.next.Enabled || !((Button)form.buttons.Controls[0]).Enabled ||
          !Object.ReferenceEquals(originalButton, form.buttons.Controls[0]))
        throw new Exception("SELFTEST_REAL_REFRESH_FAILED");
      form.recording["status"] = "WAITING_LOGIN"; form.Render();
      if (form.next.Enabled || form.buttons.Controls.Count != 3 ||
          !form.notice.Text.Contains("登录")) throw new Exception("SELFTEST_LOGIN_ACTIONS_FAILED");
      form.identityValid = false; form.notice.Text = "连接或身份核验失败：fixture"; form.Render();
      if (!form.notice.Text.Contains("连接或身份核验失败")) throw new Exception("SELFTEST_ERROR_HIDDEN");
      form.recording["status"] = "RECORDING"; form.identityValid = true; form.notice.Text = ""; form.Render();
      if (!form.state.Text.Contains("正在录制") || !form.next.Enabled) throw new Exception("SELFTEST_RECORDING_STATE_FAILED");
      form.recording["selection_mode"] = "box"; form.Render();
      if (!form.state.Text.Contains("框选中") || !form.notice.Text.Contains("Esc"))
        throw new Exception("SELFTEST_SELECTION_GUIDANCE_FAILED");
      form.recording["status"] = "RECORDING";
      if (!form.RequiresPauseForClose()) throw new Exception("SELFTEST_SELECTION_CLOSE_GUARD_FAILED");
      if (!WaitForSelfTest(form.PauseForCloseAsync()) || handler.PauseRequests != 1 ||
          !String.IsNullOrEmpty(StringField(form.recording, "selection_mode")))
        throw new Exception("SELFTEST_SELECTION_CLOSE_PAUSE_FAILED");
      form.recording["selection_mode"] = "point"; form.recording["status"] = "RECORDING";
      handler.FailPause = true;
      if (WaitForSelfTest(form.PauseForCloseAsync()) || handler.PauseRequests != 2 || form.IsDisposed)
        throw new Exception("SELFTEST_SELECTION_CLOSE_FAILURE_GUARD_FAILED");
      handler.FailPause = false; handler.FailAction = "login-open";
      handler.ErrorCode = "AUTH_LOGIN_TARGET_UNREACHABLE";
      if (WaitForSelfTest(form.ControlAsync("login-open", null, null)) || !form.notice.Text.Contains("登录站点无法连接"))
        throw new Exception("SELFTEST_LOGIN_ERROR_UNREADABLE");
      WaitForSelfTest(form.RefreshAsync());
      if (!form.notice.Text.Contains("登录站点无法连接")) throw new Exception("SELFTEST_ACTION_ERROR_LOST_ON_REFRESH");
    }
  }
  public static void VerifyAssertionEntry(string projectId, string demonstrationId) {
    var fixture = new Dictionary<string, object> {
      { "project_id", projectId }, { "demonstration_id", demonstrationId },
      { "case_id", "case-fixture" }, { "case_version", 1 }, { "current_step_index", 0 },
      { "steps", new object[] { new Dictionary<string, object> { { "action", "检查模板" }, { "expected", "原预期" } } } },
      { "events", new object[0] }, { "status", "PAUSED" }, { "selection_mode", null }
    };
    var handler = new FixtureHandler(new JavaScriptSerializer().Serialize(fixture));
    using (var form = new DemonstrationFloating(projectId, demonstrationId, handler, false)) {
      form.recording = fixture; form.identityValid = true; form.Render();
      if (!form.HasPickButtons() || !WaitForSelfTest(form.PickAsync("point")) ||
          handler.PickRequests != 1 || !form.Selecting() || form.next.Enabled || form.steps.Enabled ||
          form.EnabledPickButtons() || !form.EnabledPauseButton())
        throw new Exception("SELFTEST_PAUSED_PICK_GUARD_FAILED");
      if (WaitForSelfTest(form.PickAsync("box")) || handler.PickRequests != 1)
        throw new Exception("SELFTEST_REPEAT_PICK_GUARD_FAILED");
      if (!WaitForSelfTest(form.ControlAsync("pause", null, null)) || form.Selecting() ||
          !form.next.Enabled || !form.steps.Enabled || !form.EnabledPickButtons())
        throw new Exception("SELFTEST_PICK_CANCEL_RECOVERY_FAILED");
      if (!WaitForSelfTest(form.ControlAsync("start", null, null)) ||
          form.Status() != "RECORDING" || !form.HasPickButtons())
        throw new Exception("SELFTEST_RECORDING_PICK_ENTRY_MISSING");
      int before = handler.Actions.Count;
      if (!WaitForSelfTest(form.PickAsync("box")) || handler.Actions.Count != before + 2 ||
          handler.Actions[before] != "pause" || handler.Actions[before + 1] != "pick:box" ||
          !form.Selecting() || form.next.Enabled || form.steps.Enabled || form.EnabledPickButtons())
        throw new Exception("SELFTEST_RECORDING_PAUSE_THEN_PICK_FAILED");
      if (!WaitForSelfTest(form.ControlAsync("pause", null, null)) || form.Selecting() ||
          !form.next.Enabled || !form.EnabledPickButtons())
        throw new Exception("SELFTEST_SELECTION_COMPLETION_RECOVERY_FAILED");
      WaitForSelfTest(form.ControlAsync("start", null, null));
      handler.FailPause = true; before = handler.PickRequests;
      if (WaitForSelfTest(form.PickAsync("point")) || handler.PickRequests != before ||
          form.Status() != "RECORDING" || !form.notice.Text.Contains("操作失败"))
        throw new Exception("SELFTEST_FAILED_PAUSE_STARTED_PICK");
      form.buttons.PerformLayout();
      foreach (Control button in form.buttons.Controls)
        if (button.Right > form.buttons.ClientSize.Width || button.Bottom > form.buttons.ClientSize.Height)
          throw new Exception("SELFTEST_ASSERTION_BUTTON_CLIPPED");
    }
  }
  bool HasPickButtons() {
    int count = 0;
    foreach (Control button in buttons.Controls) if ((string)button.Tag == "pick-entry") count++;
    return count == 2;
  }
  bool EnabledPickButtons() {
    foreach (Control button in buttons.Controls)
      if ((string)button.Tag == "pick-entry" && !button.Enabled) return false;
    return true;
  }
  bool EnabledPauseButton() {
    foreach (Control button in buttons.Controls)
      if ((string)button.Tag == "pause") return button.Enabled;
    return false;
  }
  static void WaitForSelfTest(Task task) {
    var deadline = DateTime.UtcNow.AddSeconds(5);
    while (!task.IsCompleted && DateTime.UtcNow < deadline) {
      Application.DoEvents(); System.Threading.Thread.Sleep(5);
    }
    if (!task.IsCompleted) throw new Exception("SELFTEST_ASYNC_TIMEOUT");
    task.GetAwaiter().GetResult();
  }
  static T WaitForSelfTest<T>(Task<T> task) {
    WaitForSelfTest((Task)task);
    return task.GetAwaiter().GetResult();
  }
  sealed class FixtureHandler : HttpMessageHandler {
    readonly Dictionary<string, object> state;
    readonly JavaScriptSerializer json = new JavaScriptSerializer();
    public int PauseRequests;
    public int PickRequests;
    public readonly List<string> Actions = new List<string>();
    public bool FailPause;
    public string FailAction = "";
    public string ErrorCode = "";
    public FixtureHandler(string body) { state = json.DeserializeObject(body) as Dictionary<string, object>; }
    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request,
      System.Threading.CancellationToken cancellationToken) {
      if (request.Method == HttpMethod.Post) {
        var payload = json.DeserializeObject(request.Content.ReadAsStringAsync().GetAwaiter().GetResult()) as Dictionary<string, object>;
        string action = StringField(payload, "action");
        Actions.Add(action == "pick" ? "pick:" + StringField(payload, "pick_mode") : action);
        if (action == "pause") PauseRequests++;
        if (action == "pick") PickRequests++;
        if (action == FailAction || action == "pause" && FailPause)
          return Task.FromResult(new HttpResponseMessage(System.Net.HttpStatusCode.Conflict) {
          Content = new StringContent(json.Serialize(new { error = ErrorCode }), Encoding.UTF8, "application/json")
        });
        if (action == "pause") { state["status"] = "PAUSED"; state["selection_mode"] = null; }
        else if (action == "start") { state["status"] = "RECORDING"; state["selection_mode"] = null; }
        else if (action == "pick") { state["status"] = "RECORDING"; state["selection_mode"] = StringField(payload, "pick_mode"); }
      }
      return Task.FromResult(new HttpResponseMessage(System.Net.HttpStatusCode.OK) {
        Content = new StringContent(json.Serialize(state), Encoding.UTF8, "application/json")
      });
    }
  }
  public static void Run(string projectId, string demonstrationId) {
    Application.EnableVisualStyles(); Application.SetCompatibleTextRenderingDefault(false);
    Application.Run(new DemonstrationFloating(projectId, demonstrationId));
  }
}

public static class Program {
  [STAThread]
  public static int Main(string[] args) {
    const string fixtureProject = "project-b705d9dd-e30b-47f0-bff0-ab65d65b6fa9";
    const string fixtureDemo = "demo-473f0000-0000-0000-0000-000000000000";
    try {
      if (args.Length == 1 && args[0] == "--self-test") {
        DemonstrationFloating.VerifyStateBehavior(fixtureProject, fixtureDemo);
        DemonstrationFloating.VerifyAssertionEntry(fixtureProject, fixtureDemo);
        Console.WriteLine("DEMONSTRATION_FLOATING_SELFTEST_OK"); Console.Out.Flush(); return 0;
      }
      if (args.Length == 1 && args[0] == "--pipe-self-test") {
        if (Console.ReadLine() != "FOCUS") return 1;
        Console.WriteLine("DEMONSTRATION_FLOATING_PIPE_OK"); Console.Out.Flush(); return 0;
      }
      if (args.Length != 2 || !Regex.IsMatch(args[0], @"^project-[a-z0-9-]{8,80}$") ||
          !Regex.IsMatch(args[1], @"^demo-[a-f0-9-]{36}$")) {
        Console.Error.WriteLine("DEMONSTRATION_FLOATING_ID_INVALID"); return 2;
      }
      DemonstrationFloating.Run(args[0], args[1]);
      return 0;
    } catch (Exception) {
      Console.Error.WriteLine("DEMONSTRATION_FLOATING_FAILED"); return 1;
    }
  }
}
