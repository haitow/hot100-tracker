# Hot 100 Local Tracker

This local web app uses the root-level `hot100-50-day-plan.md` and stores progress in `data/progress.json`. It does not use browser local storage, cookies, a database, or third-party packages.

## Project layout

```text
hot100-tracker/
├── README.md
├── .gitignore
├── hot100-50-day-plan.md
├── server.js
├── start.cmd
├── public/
│   ├── index.html
│   ├── app.css
│   └── app.js
└── data/
    └── progress.json  # Created on the first save
```

`public/` contains the browser UI. `server.js` is the local service entry point. `data/` contains local progress and is created automatically when needed. The Markdown plan remains at the repository root.

## Start on Windows

1. Open the project root containing `server.js` and `hot100-50-day-plan.md`.
2. Install Node.js if it is not already available.
3. Double-click `start.cmd`, or run `node server.js` from the project root. The default browser opens automatically on Windows. Keep the command window open while using the tracker.

The service listens only on `127.0.0.1` and chooses an available port. Closing the command window stops the service. Opening it again loads the saved `data/progress.json` file.

The Markdown plan controls the stages and problem links. Checked questions, mastery ratings, and notes are saved to `data/progress.json`. Back up that file if you want to preserve your progress across computers or reinstalls. Notes save when you leave their input field; wait for the green saved message before closing the window.

The `.gitignore` excludes temporary files and compiled Java classes. It intentionally does not exclude `data/progress.json`, so progress can be tracked in Git if desired.
