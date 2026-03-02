# Client Notes (Phone-Friendly PWA)

This project is a lightweight Progressive Web App (PWA) for entering **client session notes** and saving each entry as a **new row in Google Sheets**.

## Features

- Mobile-friendly single-page UI for quick session entry.
- Installable on phone home screen (manifest + service worker).
- Google OAuth sign-in from the browser.
- Appends each note to a shared spreadsheet via Google Sheets API.
- Persists admin setup fields in browser localStorage.

## Data saved per entry

When staff tap **Save Entry**, the app appends one row to columns **A:D** in this order:

1. Date
2. Therapist
3. Patient Code
4. Note

## Setup

1. Create a **Google Cloud OAuth Client ID** for a Web application.
2. Enable the **Google Sheets API** in that Google Cloud project.
3. Add your app URL(s) to **Authorized JavaScript origins** (for local testing include your localhost URL).
4. Share the target Google Sheet with the Google account(s) that will log in.
5. Open the app and enter:
   - OAuth Client ID
   - Spreadsheet ID
6. Connect Google, then enter session fields and tap **Save Entry**.

## Find your Spreadsheet ID

Open your sheet URL:

`https://docs.google.com/spreadsheets/d/<SPREADSHEET_ID>/edit`

Copy the `<SPREADSHEET_ID>` part into the app.

## Local run

Use any static server (example):

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Important notes

- Admin settings are stored in `localStorage` under `client-notes-settings-v1`.
- Saves happen only when **Save Entry** is tapped.
- OAuth scope used: `https://www.googleapis.com/auth/spreadsheets`.
- The app includes offline asset caching via `service-worker.js`; API calls still require internet.
