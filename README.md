<div align="center">

# EUROEXPLORER

[![HTML](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/HTML)
[![CSS](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/CSS)
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Mapbox](https://img.shields.io/badge/Mapbox-000000?style=for-the-badge&logo=mapbox&logoColor=white)](https://www.mapbox.com/)
[![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com/)

*An interactive territorial atlas to explore the European Union — combining a dynamic map, a digital passport, and a full-stack backend, built as an academic project graded 20/20.*

[![Live Demo](https://img.shields.io/badge/Live%20Demo-euroexplorer.vercel.app-6366f1?style=for-the-badge&logo=vercel&logoColor=white)](https://euroexplorer.vercel.app)
[![Grade](https://img.shields.io/badge/Academic%20Grade-20%20%2F%2020-brightgreen?style=for-the-badge)](https://www.sefo.pt/)

🇺🇸 This project is documented and implemented entirely in English.

</div>

---

> [!NOTE]
> **Want to try it?** Head over to [euroexplorer.vercel.app](https://euroexplorer.vercel.app), create your digital passport, and start exploring all 27 EU Member States.

---

## Table of Contents

- [About](#-about)
- [Features](#-features)
- [Tech Stack](#️-tech-stack)
- [Prerequisites](#-prerequisites)
- [Getting Started](#-getting-started)
- [Configuration](#️-configuration)
- [Project Structure](#-project-structure)
- [Architecture Overview](#️-architecture-overview)
- [Known Limitations](#️-known-limitations)
- [What I Learned](#-what-i-learned)

---

## 🧩 About

EUROEXPLORER is an interactive territorial atlas developed as an academic project by class PSI9 at [Escola de Serviços e Comércio do Oeste (ESCO)](https://www.sefo.pt/). **The project was graded 20 out of 20 — the highest possible score.** It features an interactive map powered by Mapbox GL JS, letting users explore all 27 EU Member States with real territorial data, fun facts, and imagery for each country.

The standout feature is the **digital passport**: users create a personalised identity, visit countries on the map, and collect stamps until they've completed all 27 — generating an exportable passport with a full record of their European journey.

The project also includes an **admin panel** backed by a FastAPI API for content management, cleanly separating the public experience from the administration interface.

---

## ✨ Features

| Component / Feature           | Description                                                                                                                                      |
|-------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------|
| 🗺️ **Interactive Map**         | Dynamic territorial map with Mapbox GL JS showing all 27 EU Member States with highlight and click-based navigation.                            |
| 🛂 **Digital Passport**        | Users create a profile with name, date of birth, and nationality; visit countries and collect stamps; the passport is fully exportable.          |
| 🌍 **Territorial Atlas**       | Each Member State displays its capital, fun facts, flag via FlagCDN, and photos via Unsplash — content researched by the PSI9 class.            |
| 🎬 **Orbital Animations**      | Cinematic entrance sequence with a NASA Earth-from-space image and smooth transitions powered by Anime.js for a premium feel.                    |
| 🖥️ **Admin Panel**             | Separate administration interface for managing territorial content, with a dedicated frontend and FastAPI backend.                               |
| ⚡ **FastAPI Backend**          | Async Python API running on Render, handling admin panel logic and atlas content management.                                                     |
| 💾 **Local Persistence**       | Passport data and user progress are stored via `localStorage` — no account or login required for the public experience.                         |

---

## 🛠️ Tech Stack

| Technology     | Role                                              |
|----------------|---------------------------------------------------|
| HTML5          | Page structure                                    |
| CSS3           | UI styling and animations                         |
| JavaScript     | Map logic, passport system, and interactivity     |
| TypeScript     | Static typing in the admin frontend              |
| Python 3.11+   | Core backend language                             |
| FastAPI        | Backend API framework                             |
| Mapbox GL JS   | Territorial map rendering and interaction         |
| Anime.js       | Entrance animations and transitions               |
| FlagCDN        | Country flags as SVGs                             |
| NASA Imagery   | Orbital Earth photography                         |
| Vercel         | Frontend deployment                               |
| Render         | Backend deployment                                |

---

## 📦 Prerequisites

- Python 3.11+
- Node.js 18+ (for the admin frontend)
- A Mapbox account with a public access token
- Backend running locally or pointed to via environment variable

---

## 🚀 Getting Started

**1. Clone the repository**

```bash
git clone https://github.com/EduhxH/EUROEXPLORER.git
cd EUROEXPLORER
```

**2. Open the main frontend**

The public frontend is vanilla HTML/CSS/JS — open it directly in the browser or serve it with any static server:

```bash
# Simple option with Python
python -m http.server 8080
# Visit http://localhost:8080
```

**3. Set up and start the backend**

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env   # fill in your credentials
uvicorn main:app --reload
```

**4. Admin panel**

```bash
cd admin-panel
# Open admin-dashboard.html directly in the browser
# or serve it alongside the main frontend static server
```

---

## ⚙️ Configuration

The `backend/` directory includes a `.env.example` file. Copy and populate it before running the project.

```env
# App
ENVIRONMENT=development

# Mapbox
MAPBOX_TOKEN=pk.eyJ1...   # your Mapbox public access token

# Backend (Render or local)
API_BASE_URL=https://euroexplorer-a6yk.onrender.com

# Frontend
FRONTEND_URL=http://localhost:8080
```

---

## 📁 Project Structure

```
EUROEXPLORER/
├── EUROEXPLORER/               # Territorial atlas assets and data
├── admin-panel/                # Administration panel (HTML/CSS/JS)
├── assets/                     # Static assets (logos, icons)
├── backend/                    # FastAPI backend (Python)
│   ├── main.py                 # Application entrypoint
│   └── requirements.txt
├── frontend-admin/             # Admin frontend (TypeScript)
├── admin-dashboard.html        # Administration dashboard
├── admin-dashboard.css
├── admin-dashboard.js
├── admin.css
├── admin.js
├── europa_explorer.html        # Main atlas + passport experience
├── index.html                  # Landing page with orbital animation
└── .gitignore
```

---

## 🏗️ Architecture Overview

The public frontend is completely static — `index.html` serves as the landing page with the orbital entrance animation, and `europa_explorer.html` hosts the interactive map and passport system. All user state (passport, stamps, progress) is managed via `localStorage`, with no server dependency for the public experience.

The FastAPI backend runs separately on Render and serves the admin panel exclusively, exposing endpoints for managing the territorial content displayed in the atlas.

```
Browser (User)
      │
      ▼
index.html  ──────►  europa_explorer.html
                            │
                     Mapbox GL JS  (territorial map)
                     Anime.js      (animations)
                     FlagCDN       (SVG flags)
                     localStorage  (passport + progress)

Admin (Content Manager)
      │
      ▼
admin-dashboard.html
      │
      ▼
FastAPI Backend  ──── Render ────►  Territorial content management
```

---

## ⚠️ Known Limitations

- **No user account** — the digital passport is stored only in `localStorage`; clearing the browser wipes all progress.
- **Backend is admin-only** — the public experience doesn't depend on the backend, but the admin panel requires the Render service to be active (may have cold starts on the free tier).
- **No internationalisation** — territorial content is currently in Portuguese; no i18n system has been implemented.
- **Student-created content** — country texts and fun facts were researched by the PSI9 class and may contain inaccuracies.
- **Partial mobile support** — the experience was built with a desktop-first focus; some map interactions may be limited on smaller screens.

---

## 🧠 What I Learned

- **Mapbox GL JS** — integrating a territorial map with layers, per-country click events, and smooth camera transitions in a vanilla HTML project.
- **Anime.js for onboarding** — building a cinematic entrance sequence (orbital splash screen → map transition) without heavy frameworks.
- **localStorage as a lightweight database** — managing persistent user state (passport, stamps, progress) without a backend, using simple JSON serialisation.
- **Frontend/backend separation in admin** — keeping the public experience fully static while the admin panel consumes a separate FastAPI API is a clean architecture for academic projects.
- **Multi-service deployment** — managing the frontend on Vercel and the backend on Render, with separate environment variables and cross-origin communication.
- **Digital passport design** — visually reproducing the structure of a real passport (MRZ, stamps, biometric data fields) with pure HTML and CSS.
- **Academic teamwork** — coordinating content division (territorial research by the class) with technical implementation (dev team), maintaining visual and factual consistency across all 27 countries.

---

## 🤝 Contributing

Contributions are welcome. If you find a bug or want to propose a feature, open an issue first so we can discuss it before any code is written. When submitting a pull request, keep the scope focused — one fix or feature per PR.

---

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for details.

---

<div align="center">
  Made with 💜 by <a href="https://github.com/EduhxH">EduhxH</a> and class PSI9 — ESCO 2026
</div>
