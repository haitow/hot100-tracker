# Hot 100 Local Tracker

A personal Hot 100 learning tracker for haitow: study two problems each day, record mastery and obstacles, then manually commit and push real progress to [GitHub](https://github.com/haitow/hot100-tracker). The goal is steady algorithm practice for Java interviews, with Git history as a record of the work.

This local web app uses the root-level `hot100-50-day-plan.md` and stores progress in `data/progress.json`. Reading preferences use browser local storage; learning progress remains file-based. No cookies, database, or third-party packages are required.

## Project layout

```text
hot100-tracker/
├── README.md
├── .gitignore
├── hot100-50-day-plan.md
├── server.js
├── start.cmd
├── build-launchers.cmd
├── start.exe          # Locally generated Windows launcher
├── stop.exe           # Locally generated stop entry
├── launcher/
│   └── Launcher.cs
├── public/
│   ├── index.html
│   ├── app.css
│   ├── app.js
│   ├── knowledge.html
│   ├── knowledge.css
│   ├── knowledge.js
│   └── knowledge-data.js
└── data/
    └── progress.json  # Created on the first save
```

`public/` contains the browser UI. `server.js` is the local service entry point. `data/` contains local progress and is created automatically when needed. The Markdown plan remains at the repository root.

## Start on Windows

1. Open the project root containing `server.js` and `hot100-50-day-plan.md`.
2. Install Node.js if it is not already available.
3. Double-click `start.exe`. The service starts without a console window and opens the default browser as soon as it is listening. If the executables are absent after cloning, run `build-launchers.cmd` once to build them using the Windows .NET Framework compiler. No compilation occurs during normal startup.

The service listens only on `127.0.0.1` and chooses an available port. Closing the webpage leaves the service running. Double-click `start.exe` again to reopen the current address without launching another service. Double-click `stop.exe` to stop this project's service after pending save requests complete. Both executables belong in the project root; optional desktop shortcuts should point to these files.

When switching from an older version already running in a command window, close that old window once before using the launcher. Updated launchers and updated command-line services recognize and reuse each other. Different project directories have separate services.

`start.cmd` and `node server.js` remain available for foreground debugging. When they start a fresh service, keep the command window open. Launcher failures show a small error dialog and write `.runtime/launcher.log`; background request/startup logs are written to `.runtime/server.log`. These runtime logs contain no learning notes or credentials.

The Markdown plan controls the stages and problem links. Checked questions, mastery ratings, and notes are saved to `data/progress.json`. Back up that file if you want to preserve your progress across computers or reinstalls. Notes save when you leave their input field; address any save-failure message before stopping the service.

The `.gitignore` excludes temporary files, compiled Java classes, locally generated launchers, and `.runtime/` logs. It intentionally does not exclude `data/progress.json`, so progress can be tracked in Git if desired.

## Daily study and GitHub sync

1. Open the next incomplete Day and study its two problems.
2. Mark completion, choose A (independent), B (after hints), or C (after reading and rewriting), and record the main obstacle.
3. Leave the note field to save and address any save-failure message.
4. Review `git status --short` and `git diff -- data/progress.json`, then manually stage, commit, and push the intended progress changes.

The first save creates `data/progress.json`. Include it in your own commits to synchronize check-ins; local saving does not commit or push. New, untracked progress appears in `git status` rather than `git diff`.

Day numbers represent learning order, not calendar dates. The completed-day total counts fully completed two-problem groups. C problems should be reviewed later; there are no automatic review reminders or dated check-in records.

Use the UI for progress. Leave the plan's Markdown checkboxes as `- [ ]`, because checked `- [x]` rows are not recognized by the current parser. The app does not update the Markdown's introductory current-Day text or review placeholders.

GitHub contribution visibility depends on commit attribution, the default branch, and private contribution settings. See the [GitHub workflow and contribution notes](docs/project-guide.md#github-contribution-records).

## Project documentation

- [Project guide](docs/project-guide.md): daily workflow, architecture, data/API contracts, verification, and troubleshooting.
- [Knowledge library guide](docs/knowledge-guide.md): reading, search, topic maintenance, and isolated verification.
- [Windows launcher guide](docs/windows-launcher.md): no-console startup, stopping, build steps, logs, and lifecycle verification.
- [Agent rules](AGENTS.md): project boundaries, safety, Git restrictions, and validation.
- [Project memory](MEMORY.md): confirmed learning goals and durable context.
- [Agent memory policy](docs/agent-memory-policy.md): maintenance rules for the agent documents.

## Development checks

The web app needs no package installation or build step. Windows launchers are built once with `build-launchers.cmd`. Run web checks from the project root:

```powershell
node --check server.js
node --check public/app.js
node --check public/knowledge.js
node --check public/knowledge-data.js
git diff --check
node server.js --no-open
```

Use the printed URL and dynamic port to inspect the app. Verify writes in an isolated copy to avoid changing personal learning records. See the [verification guide](docs/project-guide.md#verification-and-troubleshooting).
