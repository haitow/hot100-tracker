using System;
using System.Collections.Generic;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Windows.Forms;

internal static class ConsoleObserver
{
    private delegate void EventCallback(IntPtr hook, uint kind, IntPtr window, int objectId, int childId, uint thread, uint time);
    [DllImport("user32.dll")] private static extern IntPtr SetWinEventHook(uint min, uint max, IntPtr module, EventCallback callback, uint process, uint thread, uint flags);
    [DllImport("user32.dll")] private static extern bool UnhookWinEvent(IntPtr hook);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern int GetClassName(IntPtr window, StringBuilder name, int capacity);
    private static readonly List<string> Events = new List<string>();
    private static EventCallback callback;

    [STAThread]
    private static int Main(string[] args)
    {
        callback = delegate(IntPtr hook, uint kind, IntPtr window, int objectId, int childId, uint thread, uint time)
        {
            if (objectId != 0 || childId != 0) return;
            StringBuilder name = new StringBuilder(256);
            GetClassName(window, name, name.Capacity);
            string value = name.ToString();
            if (value == "ConsoleWindowClass" || value == "PseudoConsoleWindow" || value == "CASCADIA_HOSTING_WINDOW_CLASS")
                Events.Add(value);
        };
        IntPtr observer = SetWinEventHook(0x8002, 0x8002, IntPtr.Zero, callback, 0, 0, 0);
        if (observer == IntPtr.Zero) return 1;
        File.WriteAllText(args[2], "ready");
        using (Timer timer = new Timer())
        {
            timer.Interval = 50;
            timer.Tick += delegate
            {
                if (!File.Exists(args[0])) return;
                UnhookWinEvent(observer);
                File.WriteAllLines(args[1], Events);
                Application.ExitThread();
            };
            timer.Start();
            Application.Run();
        }
        return 0;
    }
}
