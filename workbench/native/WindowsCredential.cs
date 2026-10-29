// Small local DPAPI broker. No shell, network, hardware or model access.
// ProtectedData.CurrentUser + UTF-16LE hexadecimal is compatible with the
// existing Windows PowerShell ConvertFrom-SecureString DPAPI file format.
using System;
using System.IO;
using System.Text;
using System.Security.Cryptography;
using System.Web.Script.Serialization;
using Microsoft.Win32;

internal static class WindowsCredential {
    static readonly UTF8Encoding Utf8 = new UTF8Encoding(false);
    static string Validate(string value) {
        if (String.IsNullOrWhiteSpace(value) || value.Length > 4096) throw new Exception("MODEL_CREDENTIAL_INVALID");
        foreach (char c in value) if (Char.IsControl(c)) throw new Exception("MODEL_CREDENTIAL_INVALID");
        return value.Trim();
    }
    static string FilePath(string value) {
        if (String.IsNullOrWhiteSpace(value) || !Path.IsPathRooted(value)) throw new Exception("MODEL_CREDENTIAL_PATH_INVALID");
        string file = Path.GetFullPath(value);
        if (File.Exists(file) && (File.GetAttributes(file) & FileAttributes.ReparsePoint) != 0) throw new Exception("MODEL_CREDENTIAL_PATH_INVALID");
        return file;
    }
    static string HiddenInput() {
        if (Console.IsInputRedirected) throw new Exception("MODEL_CREDENTIAL_CONSOLE_REQUIRED");
        var result = new StringBuilder();
        for (;;) {
            ConsoleKeyInfo k = Console.ReadKey(true);
            if (k.Key == ConsoleKey.Enter) { Console.WriteLine(); return result.ToString(); }
            if (k.Key == ConsoleKey.Escape) throw new Exception("MODEL_CREDENTIAL_CANCELLED");
            if (k.Key == ConsoleKey.Backspace) { if (result.Length > 0) result.Length--; continue; }
            if (!Char.IsControl(k.KeyChar) && result.Length < 4096) result.Append(k.KeyChar);
        }
    }
    static void Write(string file, string key, bool replace) {
        byte[] plain = Encoding.Unicode.GetBytes(Validate(key));
        string temporary = null;
        try {
            byte[] protectedBytes = ProtectedData.Protect(plain, null, DataProtectionScope.CurrentUser);
            string directory = Path.GetDirectoryName(file);
            Directory.CreateDirectory(directory);
            temporary = Path.Combine(directory, "credential." + Guid.NewGuid().ToString("N") + ".tmp");
            using (var stream = new FileStream(temporary, FileMode.CreateNew, FileAccess.Write, FileShare.None)) {
                byte[] hex = Utf8.GetBytes(BitConverter.ToString(protectedBytes).Replace("-", "").ToLowerInvariant());
                stream.Write(hex, 0, hex.Length); stream.Flush(true);
            }
            if (File.Exists(file)) {
                if (!replace) throw new Exception("MODEL_CREDENTIAL_EXISTS");
                File.Replace(temporary, file, null);
            } else File.Move(temporary, file);
            temporary = null;
        } finally { Array.Clear(plain, 0, plain.Length); if (temporary != null && File.Exists(temporary)) File.Delete(temporary); }
    }
    static string Read(string file) {
        var info = new FileInfo(file);
        if (!info.Exists || info.Length < 1 || info.Length > 65536) throw new Exception("MODEL_CREDENTIAL_DPAPI_INVALID");
        string hex = File.ReadAllText(file, Utf8).Trim().TrimStart('\uFEFF');
        if (hex.Length % 2 != 0 || hex.Length == 0) throw new Exception("MODEL_CREDENTIAL_DPAPI_INVALID");
        byte[] encrypted = new byte[hex.Length / 2];
        for (int i = 0; i < encrypted.Length; i++) encrypted[i] = Convert.ToByte(hex.Substring(i * 2, 2), 16);
        byte[] plain = ProtectedData.Unprotect(encrypted, null, DataProtectionScope.CurrentUser);
        try {
            if (plain.Length % 2 != 0) throw new Exception("MODEL_CREDENTIAL_DPAPI_INVALID");
            return Validate(Encoding.Unicode.GetString(plain));
        } finally { Array.Clear(plain, 0, plain.Length); }
    }
    static int Main(string[] args) {
        try {
            Console.OutputEncoding = Utf8;
            if (args.Length == 1 && args[0] == "doctor") {
                using (var key = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\NET Framework Setup\NDP\v4\Full")) {
                    if (key == null || Convert.ToInt32(key.GetValue("Release", 0)) < 528040) throw new Exception("DOTNET48_REQUIRED");
                }
                Console.WriteLine("{\"status\":\"DOTNET48_READY\",\"credential_scope\":\"current-windows-user\"}"); return 0;
            }
            if (args.Length < 3 || args[1] != "--file") throw new Exception("MODEL_CREDENTIAL_ARGUMENTS_INVALID");
            string file = FilePath(args[2]);
            if (args[0] == "read" && args.Length == 3) {
                if (!Console.IsOutputRedirected) throw new Exception("MODEL_CREDENTIAL_PRIVATE_PIPE_REQUIRED");
                Console.WriteLine(new JavaScriptSerializer().Serialize(new { apiKey = Read(file) })); return 0;
            }
            if (args[0] == "write" && (args.Length == 4 || (args.Length == 5 && args[4] == "--replace")) && args[3] == "--stdin") {
                if (!Console.IsInputRedirected) throw new Exception("MODEL_CREDENTIAL_PRIVATE_PIPE_REQUIRED");
                Write(file, Console.ReadLine(), args.Length == 5);
            } else if (args[0] == "configure" && args.Length == 3) {
                bool replace = false;
                if (File.Exists(file)) {
                    Console.Write("已保存当前 Windows 用户密钥；输入 REPLACE 才会覆盖，其他输入取消：");
                    if (Console.ReadLine() != "REPLACE") { Console.WriteLine("凭据保持原样。"); return 0; }
                    replace = true;
                }
                Console.Write("请输入 DeepSeek API Key（输入隐藏，Esc 取消）：");
                Write(file, HiddenInput(), replace);
            } else throw new Exception("MODEL_CREDENTIAL_ARGUMENTS_INVALID");
            Console.WriteLine("已为当前 Windows 用户保存 DPAPI 加密凭据；没有写入明文或发送模型请求。"); return 0;
        } catch (Exception error) {
            // Never echo OS exception text, input, file bytes or a key.
            string code = error.Message;
            if (!code.StartsWith("MODEL_CREDENTIAL_", StringComparison.Ordinal) && code != "DOTNET48_REQUIRED") code = "MODEL_CREDENTIAL_DPAPI_UNAVAILABLE";
            Console.Error.WriteLine(code); return 1;
        }
    }
}
