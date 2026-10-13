using System;
using System.Diagnostics;
using System.IO;
using System.IO.Pipes;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Win32.SafeHandles;

internal static class Launcher
{
    private static string controlPipe;
    private static string projectDirectory;
    [DllImport("kernel32.dll")] private static extern IntPtr GetConsoleWindow();
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern SafeFileHandle CreateFile(string name, uint access, uint share, IntPtr security, uint creation, uint flags, IntPtr template);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern uint GetFinalPathNameByHandle(SafeFileHandle file, StringBuilder name, uint size, uint flags);

    private sealed class Service
    {
        internal string State;
        internal int Pid;
        internal int Port;
        internal string Id;
        internal string Url { get { return "http://127.0.0.1:" + Port + "/"; } }
    }

    [STAThread]
    private static int Main(string[] args)
    {
        string root = Path.GetDirectoryName(typeof(Launcher).Assembly.Location);
        bool quiet = Array.IndexOf(args, "--quiet") >= 0;
        bool diagnostics = Array.IndexOf(args, "--diagnostics") >= 0;
        bool noOpen = Array.IndexOf(args, "--no-open") >= 0;
        Stopwatch timer = Stopwatch.StartNew();
        try
        {
            root = CanonicalDirectory(root);
            projectDirectory = root.Replace('\\', '/');
            string key = ProjectKey(root);
            string pipe = "hot100-" + key;
            controlPipe = pipe;
            using (Mutex gate = new Mutex(false, "Local\\Hot100Launcher-" + key))
            {
                bool entered = false;
                try
                {
                    try { entered = gate.WaitOne(15000); }
                    catch (AbandonedMutexException) { entered = true; }
                    if (!entered) throw new InvalidOperationException("另一个启动操作尚未完成，请稍后再试。");
#if STOP_ENTRY
                    Service active = Query(pipe);
                    if (active != null)
                    {
                        if (Request(pipe, "STOP " + active.Id, 10000) != "STOPPED")
                            throw new InvalidOperationException("服务仍在处理请求，请稍后再试。");
                        WaitForStop(pipe);
                    }
                    if (diagnostics) WriteReport("stopped", active, true, timer.ElapsedMilliseconds);
#else
                    if (!File.Exists(Path.Combine(root, "server.js")) || !File.Exists(Path.Combine(root, "hot100-50-day-plan.md")))
                        throw new InvalidOperationException("请将启动器放在包含 server.js 和题单的项目根目录。");
                    Service active = Query(pipe);
                    bool reused = active != null;
                    Process child = null;
                    if (active == null)
                    {
                        ProcessStartInfo start = new ProcessStartInfo();
                        start.FileName = FindNode();
                        start.Arguments = Quote(Path.Combine(root, "server.js")) + " --no-open --background";
                        start.WorkingDirectory = root;
                        start.UseShellExecute = false;
                        start.CreateNoWindow = true;
                        child = Process.Start(start);
                    }
                    try
                    {
                        Stopwatch ready = Stopwatch.StartNew();
                        while (active == null || active.State != "READY")
                        {
                            if (ready.ElapsedMilliseconds > 10000)
                                throw new InvalidOperationException("服务未能及时就绪，请运行 start.cmd 查看原因。");
                            if (child != null && child.HasExited && child.ExitCode != 0)
                                throw new InvalidOperationException("Node 服务启动失败，请运行 start.cmd 查看原因。");
                            active = Query(pipe);
                            if (active == null || active.State != "READY") Thread.Sleep(10);
                        }
                        if (!noOpen)
                        {
                            // Do not let a long-lived browser keep the project directory in use.
                            using (Process browser = Process.Start(new ProcessStartInfo(active.Url) {
                                UseShellExecute = true, WorkingDirectory = Environment.GetFolderPath(Environment.SpecialFolder.Windows),
                            })) { }
                        }
                        if (diagnostics) WriteReport("started", active, reused, timer.ElapsedMilliseconds);
                    }
                    finally { if (child != null) child.Dispose(); }
#endif
                }
                finally { if (entered) gate.ReleaseMutex(); }
            }
            return 0;
        }
        catch (Exception error)
        {
            try
            {
                Directory.CreateDirectory(Path.Combine(root, ".runtime"));
                File.AppendAllText(Path.Combine(root, ".runtime", "launcher.log"),
                    DateTime.UtcNow.ToString("o") + " " + error.GetType().Name + ": " + error.Message + Environment.NewLine);
            }
            catch (IOException) { }
            catch (UnauthorizedAccessException) { }
            if (diagnostics) Console.WriteLine("{\"error\":\"launcher_failed\",\"consoleWindow\":" + GetConsoleWindow().ToInt64() + "}");
            if (!quiet) MessageBox.Show(error.Message, "Hot 100", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return 1;
        }
    }

    private static Service Query(string pipe)
    {
        string reply;
        try { reply = Request(pipe, "STATUS", 500); }
        catch (TimeoutException) { return null; }
        catch (IOException) { return null; }
        string[] fields = reply.Split('\t');
        int pid, port;
        Guid id;
        if (fields.Length != 5 || fields[0] != "HOT100" ||
            (fields[1] != "READY" && fields[1] != "STARTING" && fields[1] != "STOPPING") ||
            !Int32.TryParse(fields[2], out pid) || pid <= 0 ||
            !Int32.TryParse(fields[3], out port) || port < 0 || port > 65535 ||
            (fields[1] == "READY" && port == 0) || !Guid.TryParse(fields[4], out id))
            throw new InvalidOperationException("项目服务返回了无效状态，请运行 start.cmd 排查。");
        return new Service { State = fields[1], Pid = pid, Port = port, Id = id.ToString() };
    }

    private static string Request(string pipe, string command, int timeout)
    {
        using (NamedPipeClientStream client = new NamedPipeClientStream(".", pipe, PipeDirection.InOut))
        {
            client.Connect(25);
            using (StreamWriter writer = new StreamWriter(client, new UTF8Encoding(false), 256, true))
            using (StreamReader reader = new StreamReader(client, Encoding.UTF8, false, 256, true))
            {
                writer.WriteLine(command);
                writer.Flush();
                Task<string> read = Task.Factory.StartNew(delegate
                {
                    StringBuilder line = new StringBuilder();
                    int value;
                    while ((value = reader.Read()) != -1 && value != '\n')
                    {
                        if (line.Length >= 256) throw new IOException("Service reply exceeded its limit.");
                        if (value != '\r') line.Append((char)value);
                    }
                    return line.ToString();
                });
                if (!read.Wait(timeout)) throw new TimeoutException("Service response timed out.");
                return read.Result;
            }
        }
    }

    private static void WaitForStop(string pipe)
    {
        Stopwatch timer = Stopwatch.StartNew();
        while (Query(pipe) != null)
        {
            if (timer.ElapsedMilliseconds > 10000) throw new InvalidOperationException("服务正在退出，请稍后再试。");
            Thread.Sleep(10);
        }
    }

    private static string FindNode()
    {
        foreach (string entry in (Environment.GetEnvironmentVariable("PATH") ?? "").Split(';'))
        {
            string directory = entry.Trim().Trim('"');
            if (directory.Length == 0 || !Path.IsPathRooted(directory)) continue;
            try
            {
                string executable = Path.Combine(directory, "node.exe");
                if (File.Exists(executable)) return executable;
            }
            catch (ArgumentException) { }
        }
        throw new InvalidOperationException("未找到 Node.js，请先安装 Node.js，再运行启动器。");
    }

    private static string CanonicalDirectory(string root)
    {
        using (SafeFileHandle handle = CreateFile(root, 0, 7, IntPtr.Zero, 3, 0x02000000, IntPtr.Zero))
        {
            if (handle.IsInvalid) throw new IOException("Could not resolve the project directory.");
            StringBuilder resolved = new StringBuilder(1024);
            uint length = GetFinalPathNameByHandle(handle, resolved, (uint)resolved.Capacity, 0);
            if (length == 0 || length >= resolved.Capacity) throw new IOException("Could not resolve the project directory.");
            string value = resolved.ToString();
            if (value.StartsWith("\\\\?\\UNC\\")) return "\\\\" + value.Substring(8);
            return value.StartsWith("\\\\?\\") ? value.Substring(4) : value;
        }
    }

    private static string ProjectKey(string root)
    {
        string canonical = root.Replace('\\', '/').TrimEnd('/').ToLowerInvariant();
        using (SHA256 hash = SHA256.Create())
            return BitConverter.ToString(hash.ComputeHash(Encoding.UTF8.GetBytes(canonical))).Replace("-", "").ToLowerInvariant().Substring(0, 32);
    }

    private static string Quote(string value)
    {
        StringBuilder result = new StringBuilder("\"");
        int slashes = 0;
        foreach (char character in value)
        {
            if (character == '\\') { slashes++; continue; }
            if (character == '"') result.Append('\\', slashes * 2 + 1);
            else result.Append('\\', slashes);
            result.Append(character);
            slashes = 0;
        }
        result.Append('\\', slashes * 2).Append('"');
        return result.ToString();
    }

    private static void WriteReport(string action, Service service, bool reused, long milliseconds)
    {
        Console.WriteLine("{\"action\":\"" + action + "\",\"pid\":" + (service == null ? 0 : service.Pid) +
            ",\"port\":" + (service == null ? 0 : service.Port) + ",\"id\":\"" + (service == null ? "" : service.Id) +
            "\",\"reused\":" + (reused ? "true" : "false") + ",\"elapsedMs\":" + milliseconds +
            ",\"pipe\":\"" + controlPipe + "\",\"project\":\"" + JsonText(projectDirectory) + "\",\"consoleWindow\":" + GetConsoleWindow().ToInt64() + "}");
    }

    private static string JsonText(string value)
    {
        StringBuilder escaped = new StringBuilder();
        foreach (char character in value)
        {
            if (character < 32 || character > 126) escaped.Append("\\u").Append(((int)character).ToString("x4"));
            else if (character == '\\' || character == '"') escaped.Append('\\').Append(character);
            else escaped.Append(character);
        }
        return escaped.ToString();
    }
}
