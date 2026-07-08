# Weekly Planner

A beautiful, responsive, and secure weekly planner application to organize your daily schedule, track goals, and sync tasks seamlessly across all your devices.

## 🚀 Live Site
Check out the live application here: **[https://weekly-schedule-mu.vercel.app](https://weekly-schedule-mu.vercel.app)**

## ✨ Key Features
* **Supabase Authentication**: Secure private sign-up and log-in options. Each account gets an isolated database store.
* **Database Synchronization**: Real-time reads and writes to Supabase database. Automatically falls back to browser local storage if offline.
* **Drag-and-Drop Task Reordering**: Grab any task and slide it up or down to organize your day. Enabled by SortableJS.
* **Automatic Completed Task Sorting**: Checked tasks automatically snap to the bottom of the list, while unchecked tasks remain at the top. Relative order is preserved inside both lists.
* **Week-by-Week Planning**: Move forward and backward across weeks (-1 week to +2 weeks navigation) to plan ahead.
* **Visual Priority Indicators**: Low (Green), Medium (Amber), and High (Red) color tags and border accents.
* **Weekly Goals Note Pad**: A debounced auto-saving text area to write general weekly notes.
* **Responsive Layouts**: Designed using premium cream and navy blue CSS variables. Mobile responsive and adaptive desktop layouts.

## 🛠 Tech Stack
* **Frontend**: HTML5, Vanilla JavaScript, CSS3
* **Icons & Animation**: Lucide Icons, SortableJS
* **Database & Auth**: Supabase JS SDK (PostgreSQL, Row Level Security)
* **Hosting & Deploy**: Vercel

---

*Note: This project was built using AI-assisted coding tools (Google Antigravity).*