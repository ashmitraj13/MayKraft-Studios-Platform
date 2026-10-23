// Demo data for MayKraft Studios. Dates are relative to "now" so the demo always looks live.
const users = {
  manager: { name: 'Ashmit Raj', email: 'manager@maykraft.studio', password: 'Manager@123', role: 'manager' },
  editors: [
    { key: 'kabir', name: 'Kabir Sharma', email: 'kabir@maykraft.studio', skills: ['Motion graphics', 'After Effects'] },
    { key: 'isha', name: 'Isha Verma', email: 'isha@maykraft.studio', skills: ['Colour grading', 'DaVinci Resolve'] },
    { key: 'arjun', name: 'Arjun Nair', email: 'arjun@maykraft.studio', skills: ['Short-form reels', 'Premiere Pro'] },
  ],
  editorPassword: 'Editor@123',
  clients: [
    { key: 'chai', name: 'Rohan Mehta', email: 'rohan@chaiwalajunction.in', company: 'Chaiwala Junction' },
    { key: 'vidya', name: 'Priya Iyer', email: 'priya@vidyaspark.in', company: 'Vidya Spark Academy' },
    { key: 'kesari', name: 'Meera Joshi', email: 'meera@kesarinaturals.in', company: 'Kesari Naturals' },
  ],
  clientPassword: 'Client@123',
};

const projects = [
  { key: 'monsoon', client: 'chai', title: 'Monsoon Menu Launch', totalVideos: 6, deadline: 12,
    description: 'Six reels for the monsoon menu across 40 outlets: pakoras, kulhad chai and the rainy-day combo.' },
  { key: 'bandra', client: 'chai', title: 'Bandra Flagship Opening', totalVideos: 3, deadline: 3,
    description: 'Teaser, opening-day highlights and a store walkthrough for the new Bandra flagship.' },
  { key: 'boards', client: 'vidya', title: 'Board Exam Bootcamp Ads', totalVideos: 5, deadline: 20,
    description: 'Performance ads for the Class 12 board exam bootcamp — testimonials, explainers and parent trust.' },
  { key: 'serum', client: 'kesari', title: 'Saffron Glow Serum Launch', totalVideos: 4, deadline: 6,
    description: 'Launch assets for the Kashmiri saffron serum: macro textures, ASMR unboxing and influencer cutdowns.' },
  { key: 'founder', client: 'kesari', title: 'Founder Story Documentary', totalVideos: 2, deadline: 30,
    description: 'A short documentary on the founder and the saffron farms of Pampore.' },
];

// ed = editor deadline (days from now), cd = client deadline (days from now), late = first cut missed the editor deadline
const videos = [
  { project: 'monsoon', title: 'Masala Chai Pour — 15s Reel', status: 'delivered', editor: 'arjun', ed: -10, cd: -6, late: true },
  { project: 'monsoon', title: 'Monsoon Pakora Combo — 30s', status: 'approved', editor: 'arjun', ed: -3, cd: 2 },
  { project: 'monsoon', title: 'Behind the Counter — Barista Story', status: 'client_review', editor: 'isha', ed: -1, cd: 4 },
  { project: 'monsoon', title: 'Rainy Day Offer — Story Ad', status: 'in_progress', editor: 'arjun', ed: 1, cd: 5 },
  { project: 'monsoon', title: 'Kulhad Craft Close-ups', status: 'assigned', editor: 'kabir', ed: 6, cd: 12 },
  { project: 'monsoon', title: 'Menu Board Motion Graphic', status: 'footage_uploaded', cd: 12 },

  { project: 'bandra', title: 'Opening Day Teaser', status: 'submitted', editor: 'kabir', ed: -1, cd: 2 },
  { project: 'bandra', title: 'Ribbon Cutting Highlights', status: 'in_progress', editor: 'isha', ed: -2, cd: 3 },
  { project: 'bandra', title: 'Walkthrough — Bandra Store', status: 'assigned', editor: 'arjun', ed: 5, cd: 3 },

  { project: 'boards', title: 'Topper Testimonial — Class of 2026', status: 'delivered', editor: 'isha', ed: -14, cd: -10 },
  { project: 'boards', title: 'Physics in 60 Seconds', status: 'changes_requested', editor: 'kabir', ed: 2, cd: 9 },
  { project: 'boards', title: 'Parent Trust Ad — 45s', status: 'client_changes', editor: 'kabir', ed: 4, cd: 10 },
  { project: 'boards', title: 'Mock Test Countdown Reel', status: 'in_progress', editor: 'arjun', ed: 7, cd: 20 },
  { project: 'boards', title: 'Faculty Intro Series — Ep 1', status: 'footage_uploaded', cd: 20 },

  { project: 'serum', title: 'Serum Texture Macro — 10s', status: 'approved', editor: 'isha', ed: -5, cd: 1, late: true },
  { project: 'serum', title: 'Unboxing ASMR Reel', status: 'client_review', editor: 'kabir', ed: -3, cd: 1 },
  { project: 'serum', title: 'Before / After — 7 Day Glow', status: 'in_progress', editor: 'arjun', ed: -1, cd: -1 },
  { project: 'serum', title: 'Influencer Cutdown — 20s', status: 'submitted', editor: 'isha', ed: 0, cd: 6 },

  { project: 'founder', title: 'Founder Interview — Rough Assembly', status: 'in_progress', editor: 'kabir', ed: 10, cd: 30 },
  { project: 'founder', title: 'Kesar Farms, Pampore — B-roll Edit', status: 'assigned', editor: 'isha', ed: 14, cd: 28 },
];

module.exports = { users, projects, videos };
