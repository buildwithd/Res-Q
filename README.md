# Res-Q
**Hostel Issue Reporting & Resolution System**

ResQ is a Progressive Web App that simplifies how hostel residents report and track maintenance issues. Students submit problems anonymously, upvote what matters most, and watch resolution happen in real time — while admins manage everything from a clean, dedicated panel.

---

## Features

- **Anonymous Reporting** — Students report issues without revealing their identity
- **Upvoting System** — Residents upvote issues to push urgent problems to the top
- **Live Dashboard** — Visual analytics with Chart.js showing issue trends, categories, and resolution rates
- **Admin Panel** — Full control to view, filter, prioritize, and resolve reports
- **Dark / Light Mode** — Persistent theme preference across sessions
- **Offline Support** — Service worker caches the app so it works without internet
- **PWA Installable** — Runs like a native app when added to home screen on Android or iOS

---

## Tech Stack

- **Frontend** — HTML, CSS, Vanilla JavaScript
- **Backend** — Supabase (PostgreSQL, Realtime, Row Level Security)
- **Charts** — Chart.js
- **PWA** — Web App Manifest + Service Worker
- **Hosting** — Vercel

---

## Project Structure

```
resq/
├── index.html        # Issue feed and landing page
├── report.js         # Issue submission logic
├── dashboard.html    # Analytics and stats view
├── dashboard.js      # Chart rendering and data fetching
├── admin.html        # Admin panel interface
├── admin.js          # Admin operations
├── styles.css        # Global styles and theme variables
├── config.js         # Supabase client setup
├── manifest.json     # PWA configuration
└── sw.js             # Service worker for offline caching
```

---

## Author

**Sudrita Deb**  
First Year CSE — Kalaignarkarunanidhi Institute of Technology, Coimbatore  
📧 sudr2008.deb@gmail.com · [github.com/buildwithd](https://github.com/buildwithd)

---

## License

MIT
