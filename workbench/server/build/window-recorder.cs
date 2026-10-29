using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;

// Captures only the window owned by the explicitly supplied browser process.
// Never reads the desktop DC or copies pixels from the screen.
public static class BrowserWindowRecorder {
  delegate bool WindowCallback(IntPtr hwnd, IntPtr state);
  [StructLayout(LayoutKind.Sequential)] struct Rect { public int Left, Top, Right, Bottom; }
  [DllImport("user32.dll")] static extern bool EnumWindows(WindowCallback callback, IntPtr state);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint processId);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr hwnd, StringBuilder name, int count);
  [DllImport("user32.dll")] static extern bool IsWindow(IntPtr hwnd);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr hwnd);
  [DllImport("user32.dll")] static extern bool IsIconic(IntPtr hwnd);
  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr hwnd, out Rect rectangle);
  [DllImport("user32.dll")] static extern bool PrintWindow(IntPtr hwnd, IntPtr dc, uint flags);
  [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] static extern int GetWindowLong(IntPtr hwnd, int index);
  [DllImport("user32.dll")] static extern int SetWindowLong(IntPtr hwnd, int index, int value);
  [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr hwnd, IntPtr after, int x, int y, int cx, int cy, uint flags);
  [DllImport("user32.dll")] static extern bool ShowWindowAsync(IntPtr hwnd, int command);
  static volatile bool stop;
  static string stopReason = "STOPPED";
  static readonly JavaScriptSerializer Json = new JavaScriptSerializer();
  static readonly object EventLock = new object();
  static int frameCount, capturedFrames, duplicatedFrames, width, height;
  static long maxGap;
  static DateTime started, ended;
  static IntPtr window;
  static int browserPid;
  static int originalStyle;
  static bool guarded, originallyTopmost;
  static readonly List<Dictionary<string, object>> recoveries = new List<Dictionary<string, object>>();

  // The PID/HWND is validated before acquiring and before releasing this lease.
  // Keep the automation window visible without taking keyboard focus, and remove
  // its minimize button for this recording only. OS-forced minimize/close still
  // fails CheckWindow; no interruption is silently labelled complete.
  static void GuardWindow() {
    CheckWindow();
    originalStyle = GetWindowLong(window, -16);
    originallyTopmost = (GetWindowLong(window, -20) & 8) != 0;
    SetWindowLong(window, -16, originalStyle & ~0x20000);
    guarded = true;
    if (!SetWindowPos(window, new IntPtr(-1), 0, 0, 0, 0, 0x0033))
      throw new Exception("WINDOW_GUARD_FAILED");
    if ((GetWindowLong(window, -16) & 0x20000) != 0 || (GetWindowLong(window, -20) & 8) == 0)
      throw new Exception("WINDOW_GUARD_FAILED");
  }
  static void ReleaseWindow() {
    if (!guarded || !IsWindow(window)) return;
    uint owner; GetWindowThreadProcessId(window, out owner);
    if (owner != browserPid) return;
    SetWindowLong(window, -16, originalStyle);
    if (!SetWindowPos(window, new IntPtr(originallyTopmost ? -1 : -2), 0, 0, 0, 0, 0x0033))
      throw new Exception("WINDOW_GUARD_RELEASE_FAILED");
    guarded = false;
  }

  static void Event(string type, string reason) {
    lock (EventLock) {
      var item = new Dictionary<string, object> {
        { "event", type }, { "reason", reason }, { "pid", browserPid },
        { "hwnd", window.ToInt64().ToString() }, { "width", width }, { "height", height },
        { "frame_count", frameCount }, { "captured_frames", capturedFrames },
        { "duplicated_frames", duplicatedFrames }, { "max_gap_ms", maxGap },
        { "started_at", started == default(DateTime) ? null : started.ToString("o") },
        { "ended_at", ended == default(DateTime) ? null : ended.ToString("o") },
        { "at", DateTime.UtcNow.ToString("o") }
      };
      item["window_guard"] = guarded ? "OWNED_WINDOW_NO_MINIMIZE" : null;
      item["minimization_recoveries"] = recoveries;
      Console.Error.WriteLine(Json.Serialize(item)); Console.Error.Flush();
    }
  }

  static IntPtr FindWindow(int pid) {
    var matches = new List<IntPtr>();
    EnumWindows((hwnd, unused) => {
      uint owner; GetWindowThreadProcessId(hwnd, out owner);
      if (owner != pid || !IsWindowVisible(hwnd)) return true;
      var name = new StringBuilder(256); GetClassName(hwnd, name, name.Capacity);
      if (name.ToString() == "Chrome_WidgetWin_1") matches.Add(hwnd);
      return true;
    }, IntPtr.Zero);
    if (matches.Count > 1) throw new Exception("WINDOW_IDENTITY_AMBIGUOUS");
    return matches.Count == 1 ? matches[0] : IntPtr.Zero;
  }

  static Rect CheckWindow() {
    if (!IsWindow(window)) throw new Exception("WINDOW_CLOSED");
    uint owner; GetWindowThreadProcessId(window, out owner);
    if (owner != browserPid) throw new Exception("WINDOW_IDENTITY_CHANGED");
    if (!IsWindowVisible(window)) throw new Exception("WINDOW_HIDDEN");
    if (IsIconic(window)) throw new Exception("WINDOW_MINIMIZED");
    Rect rect;
    if (!GetWindowRect(window, out rect)) throw new Exception("WINDOW_BOUNDS_UNAVAILABLE");
    int w = rect.Right - rect.Left, h = rect.Bottom - rect.Top;
    if (w < 200 || h < 120 || w > 7680 || h > 4320) throw new Exception("WINDOW_BOUNDS_INVALID");
    if (width != 0 && (w != width || h != height)) throw new Exception("WINDOW_SIZE_CHANGED");
    return rect;
  }

  static byte[] Capture() {
    try { return CaptureFrame(); }
    catch (Exception error) {
      if (error.Message != "WINDOW_MINIMIZED" || stop || recoveries.Count >= 3) throw;
      // Restore only this still-owned HWND. Never continue with pixels obtained
      // while minimized, and never restart the recording clock. The existing
      // 1500ms capture-gap gate below still includes all recovery time.
      uint owner; GetWindowThreadProcessId(window, out owner);
      if (!IsWindow(window) || owner != browserPid) throw new Exception("WINDOW_IDENTITY_CHANGED");
      var item = new Dictionary<string, object> { {"started_at",DateTime.UtcNow.ToString("o")}, {"status","FAILED"} };
      recoveries.Add(item);
      var deadline = Stopwatch.StartNew();
      ShowWindowAsync(window, 3);
      while (IsIconic(window) && deadline.ElapsedMilliseconds < 500 && !stop) Thread.Sleep(10);
      if (IsIconic(window)) throw new Exception("WINDOW_MINIMIZED");
      // Restored HWND state can precede the compositor's first real repaint.
      // Drain the in-flight frame even if STOP arrives; never encode the blank
      // restore animation or reset the gap clock to hide this wait.
      byte[] frame;
      while (true) {
        try { frame = CaptureFrame(); break; }
        catch (Exception repaint) {
          // IsIconic can clear while GetWindowRect still reports the restore
          // animation's temporary geometry. Retry only inside this already
          // owned minimization recovery; CaptureFrame still requires the exact
          // original size before and after PrintWindow. Persistent changes and
          // every identity error remain failures, and the gap clock is unchanged.
          bool transient = repaint.Message == "WINDOW_FRAME_EMPTY" ||
            repaint.Message == "WINDOW_BOUNDS_INVALID" || repaint.Message == "WINDOW_SIZE_CHANGED" ||
            repaint.Message == "WINDOW_MINIMIZED";
          if (!transient || deadline.ElapsedMilliseconds >= 500) throw;
          Thread.Sleep(10);
        }
      }
      item["duration_ms"] = deadline.ElapsedMilliseconds;
      item["ended_at"] = DateTime.UtcNow.ToString("o");
      item["status"] = "RESTORED";
      return frame;
    }
  }
  static byte[] CaptureFrame() {
    CheckWindow();
    using (var image = new Bitmap(width, height, PixelFormat.Format24bppRgb)) {
      using (var graphics = Graphics.FromImage(image)) {
        graphics.Clear(Color.Magenta);
        var dc = graphics.GetHdc();
        bool ok;
        try { ok = PrintWindow(window, dc, 2); }
        finally { graphics.ReleaseHdc(dc); }
        if (!ok) throw new Exception("WINDOW_PRINT_FAILED");
      }
      CheckWindow();
      // A successful native return does not prove the compositor painted pixels.
      // Reject essentially uniform/sentinel captures; semantic completeness is
      // separately verified by the actual browser recording acceptance checks.
      int count = 0, sentinel = 0, dark = 0, low = 255, high = 0;
      for (int y = Math.Max(1, height / 30); y < height; y += Math.Max(1, height / 30))
        for (int x = Math.Max(1, width / 40); x < width; x += Math.Max(1, width / 40)) {
          Color c = image.GetPixel(x, y); count++;
          if (c.R > 245 && c.G < 10 && c.B > 245) sentinel++;
          int value = (c.R + c.G + c.B) / 3;
          if (value < 4) dark++;
          low = Math.Min(low, value); high = Math.Max(high, value);
        }
      if (count == 0 || sentinel > count / 2 || dark > count * 0.99 || high - low < 3)
        throw new Exception("WINDOW_FRAME_EMPTY");
      using (var bytes = new MemoryStream()) {
        image.Save(bytes, ImageFormat.Jpeg); return bytes.ToArray();
      }
    }
  }

  static void WriteFrame(Stream output, byte[] bytes) {
    output.Write(bytes, 0, bytes.Length); output.Flush(); frameCount++;
  }

  public static int Main(string[] args) {
    int fps = 10, maxMs = 120000;
    string reason = "STOPPED";
    bool successful = false;
    try {
      if (args.Length != 3 || !Int32.TryParse(args[0], out browserPid) || browserPid <= 0 ||
          !Int32.TryParse(args[1], out fps) || fps < 1 || fps > 30 ||
          !Int32.TryParse(args[2], out maxMs) || maxMs < 1000 || maxMs > 3600000)
        throw new Exception("WINDOW_ARGUMENT_INVALID");
      SetProcessDPIAware();
      // Console input is independent of a possibly blocked PrintWindow call.
      var input = new Thread(() => {
        try { while (true) { string line = Console.ReadLine(); if (line == null || line == "STOP") {
          stopReason = line == null ? "PARENT_PIPE_CLOSED" : "STOPPED"; stop = true; return;
        } } } catch { stopReason = "PARENT_PIPE_CLOSED"; stop = true; }
      });
      input.IsBackground = true; input.Start();
      var locating = Stopwatch.StartNew();
      while (window == IntPtr.Zero && locating.ElapsedMilliseconds < 5000 && !stop) {
        window = FindWindow(browserPid);
        if (window == IntPtr.Zero) Thread.Sleep(50);
      }
      if (window == IntPtr.Zero) throw new Exception("WINDOW_NOT_FOUND");
      Rect rect = CheckWindow(); width = rect.Right - rect.Left; height = rect.Bottom - rect.Top;
      GuardWindow();
      using (Stream output = Console.OpenStandardOutput()) {
        byte[] previous = Capture(); capturedFrames++;
        started = DateTime.UtcNow;
        var clock = Stopwatch.StartNew(); long lastCaptured = 0, lastHeartbeat = 0;
        WriteFrame(output, previous); Event("ready", null);
        while (!stop) {
          long now = clock.ElapsedMilliseconds;
          if (now >= maxMs) throw new Exception("WINDOW_RECORDING_LIMIT");
          long next = (long)frameCount * 1000 / fps;
          if (now < next) { Thread.Sleep((int)Math.Min(25, next - now)); continue; }
          byte[] frame = Capture(); capturedFrames++;
          now = clock.ElapsedMilliseconds;
          long gap = now - lastCaptured; lastCaptured = now; maxGap = Math.Max(maxGap, gap);
          if (gap > 1500) throw new Exception("WINDOW_CAPTURE_GAP");
          int target = (int)(now * fps / 1000);
          while (frameCount < target) { WriteFrame(output, previous); duplicatedFrames++; }
          WriteFrame(output, frame); previous = frame;
          if (now - lastHeartbeat >= 500) { Event("progress", null); lastHeartbeat = now; }
        }
        reason = stopReason;
        successful = reason == "STOPPED";
        // STOP can arrive while the final frame is blocked on the encoder pipe.
        // Account for that real capture gap before freezing the clock; otherwise
        // the constant-rate video silently loses its tail. Retain the same
        // bounded-gap rule and hold the last observed frame for those slots.
        long finalElapsed = clock.ElapsedMilliseconds;
        long finalGap = finalElapsed - lastCaptured;
        maxGap = Math.Max(maxGap, finalGap);
        if (finalElapsed > maxMs) throw new Exception("WINDOW_RECORDING_LIMIT");
        if (finalGap > 1500) throw new Exception("WINDOW_CAPTURE_GAP");
        ended = DateTime.UtcNow;
        int finalTarget = (int)Math.Ceiling(finalElapsed * fps / 1000.0);
        while (frameCount < finalTarget) { WriteFrame(output, previous); duplicatedFrames++; }
      }
    } catch (Exception error) {
      successful = false;
      reason = error is IOException ? "WINDOW_OUTPUT_CLOSED" : error.Message;
      if (reason == null || !System.Text.RegularExpressions.Regex.IsMatch(reason, "^[A-Z_]{3,80}$")) reason = "WINDOW_CAPTURE_FAILED";
    } finally {
      // The capture clock ends before restoring window styles/z-order. Native
      // window release may block; that cleanup time has no frames in the video.
      if (ended == default(DateTime)) ended = DateTime.UtcNow;
      try { ReleaseWindow(); }
      catch { reason = "WINDOW_GUARD_RELEASE_FAILED"; successful = false; }
    }
    Event("end", reason);
    return successful && frameCount > 0 ? 0 : 2;
  }
}
