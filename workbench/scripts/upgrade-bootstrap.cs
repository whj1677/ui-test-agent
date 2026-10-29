using System;
using System.IO;
using System.Text;
using System.Linq;
using System.Diagnostics;
using System.Threading;
using System.Collections;
using System.Collections.Generic;
using System.Security.Cryptography;
using System.Windows.Forms;
using System.Drawing;
using System.Web.Script.Serialization;
using Microsoft.Win32;

internal static class UpgradeBootstrap {
    static string Bundle = AppDomain.CurrentDomain.BaseDirectory;
    static TextBox Installation;
    static Form Window;
    static Label Status;
    static List<Button> Buttons = new List<Button>();
    static string PreviousInstallation() {
        string key = "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\{ACB05159-C0F8-4B5B-8E57-6F734FA1A2AC}_is1";
        foreach (RegistryKey hive in new[] { Registry.CurrentUser, Registry.LocalMachine }) {
            using (var entry = hive.OpenSubKey(key)) {
                string value = entry == null ? null : entry.GetValue("InstallLocation") as string;
                if (!String.IsNullOrEmpty(value) && (File.Exists(Path.Combine(value,"program","portable-manifest.json")) || File.Exists(Path.Combine(value,"portable-manifest.json")))) return value;
            }
        }
        string fallback = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "UITestAgent");
        return Directory.Exists(fallback) ? fallback : "";
    }
    static string Hash(string file) { using (var hash = SHA256.Create()) using (var stream = File.OpenRead(file)) return BitConverter.ToString(hash.ComputeHash(stream)).Replace("-", "").ToLowerInvariant(); }
    static string Quote(string value) {
        if (value.IndexOf('"') >= 0) throw new Exception("安装路径包含无效字符。");
        return "\"" + value.TrimEnd('\\', '/') + "\"";
    }
    static void Run(string mode) {
        foreach (var button in Buttons) button.Enabled = false;
        Installation.ReadOnly = true;
        Window.ControlBox = false;
        Status.Text = "正在检查旧目录、工作台状态和备份，请勿启动工作台……";
        Application.DoEvents();
        try {
            string root = Path.GetFullPath(Installation.Text.Trim());
            if (!File.Exists(Path.Combine(root, "portable-manifest.json")) && File.Exists(Path.Combine(root, "program", "portable-manifest.json"))) root = Path.Combine(root, "program");
            string node = Path.Combine(root, "runtime", "node", "node.exe");
            if (!File.Exists(node) || !File.Exists(Path.Combine(root, "portable-manifest.json"))) throw new Exception("请选择旧版测试工作台安装目录，目录中应包含 program，或同时包含 runtime 与 workbench。");
            var json = new JavaScriptSerializer { MaxJsonLength = 4 * 1024 * 1024 };
            var manifest = json.Deserialize<Dictionary<string, object>>(File.ReadAllText(Path.Combine(Bundle, "upgrade.json"), Encoding.UTF8));
            bool known = false;
            foreach (var value in (IEnumerable)manifest["node_sha256"]) if (String.Equals(Convert.ToString(value), Hash(node), StringComparison.OrdinalIgnoreCase)) known = true;
            if (!known) throw new Exception("旧版 Node 运行组件未通过兼容性校验，未执行更新。请核对是否选择了原安装目录。");
            string script = Path.Combine(Bundle, "upgrade.mjs");
            string arguments = Quote(script) + " --target " + Quote(root) + " --bundle " + Quote(Bundle);
            if (mode == "check") arguments += " --check-only";
            if (mode == "rollback") arguments += " --rollback";
            var start = new ProcessStartInfo(node, arguments) { UseShellExecute = false, CreateNoWindow = true, RedirectStandardOutput = true, RedirectStandardError = true, StandardOutputEncoding = Encoding.UTF8, StandardErrorEncoding = Encoding.UTF8, WorkingDirectory = Bundle };
            using (var process = Process.Start(start)) {
                while (!process.WaitForExit(60)) Application.DoEvents();
                string output = process.StandardOutput.ReadToEnd(), error = process.StandardError.ReadToEnd();
                if (process.ExitCode != 0) throw new Exception(error.Length > 0 ? error : "更新未完成，请保留原目录和升级备份。");
                var result = json.Deserialize<Dictionary<string, object>>(output);
                string state = Convert.ToString(result["status"]);
                if (state == "READY_TO_UPGRADE") Status.Text = "检查通过，可以升级。升级期间请保持工作台关闭。";
                else if (state == "ALREADY_CURRENT") Status.Text = "该目录已安装本次功能，无需重复升级。";
                else if (state == "ROLLED_BACK") Status.Text = "已回退本次升级。原环境和项目数据保留。";
                else Status.Text = "升级完成。请使用原来的快捷方式启动工作台。";
                MessageBox.Show(Window, Status.Text, "测试工作台", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
        } catch (Exception error) {
            Status.Text = "未完成操作；请查看说明并保留错误信息。";
            MessageBox.Show(Window, error.Message, "操作未完成", MessageBoxButtons.OK, MessageBoxIcon.Warning);
        } finally {
            foreach (var button in Buttons) button.Enabled = true;
            Installation.ReadOnly = false;
            Window.ControlBox = true;
        }
    }
    [STAThread]
    public static void Main() {
        Application.EnableVisualStyles();
        Window = new Form { Text = "测试工作台 · 功能升级", Width = 630, Height = 285, FormBorderStyle = FormBorderStyle.FixedDialog, MaximizeBox = false, StartPosition = FormStartPosition.CenterScreen, Font = new Font("Microsoft YaHei UI", 9F) };
        var heading = new Label { Left = 22, Top = 20, Width = 570, Height = 38, Text = "Word / WPS 本机读取功能升级\n请先保存输入，等待任务结束并正常退出测试工作台。" };
        Installation = new TextBox { Left = 22, Top = 75, Width = 465, AccessibleName = "旧版安装目录" };
        Installation.Text = PreviousInstallation();
        var browse = new Button { Left = 496, Top = 73, Width = 94, Height = 27, Text = "选择旧目录" };
        browse.Click += delegate { using (var dialog = new FolderBrowserDialog { Description = "选择之前安装的测试工作台目录", ShowNewFolderButton = false, SelectedPath = Installation.Text }) if (dialog.ShowDialog(Window) == DialogResult.OK) Installation.Text = dialog.SelectedPath; };
        Buttons.Add(browse);
        var help = new Label { Left = 22, Top = 111, Width = 570, Height = 35, Text = "复用已安装的环境，不重新安装依赖。\n密钥、设置、项目和历史记录保留；更新前自动备份本次改动的程序文件。" };
        string[] labels = { "检查目录", "升级功能", "回退本次升级" }, modes = { "check", "upgrade", "rollback" };
        for (int n = 0; n < labels.Length; n++) {
            string mode = modes[n];
            var button = new Button { Left = 22 + n * 160, Top = 157, Width = 145, Height = 33, Text = labels[n] };
            button.Click += delegate { Run(mode); };
            Buttons.Add(button);Window.Controls.Add(button);
        }
        Status = new Label { Left = 22, Top = 205, Width = 570, Height = 30, Text = "选择旧版目录后，可先检查再升级。" };
        Window.Controls.AddRange(new Control[] { heading, Installation, browse, help, Status });
        Application.Run(Window);
    }
}
