import "@fontsource-variable/manrope";
import "@/styles/index.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import api from "@/config/axios";
import { PersonProfile } from "@/features/profile/PersonProfile";
import { AuthProvider } from "@/providers/AuthProvider";
import { LookingProvider } from "@/providers/LookingProvider";
import { PreferencesProvider } from "@/providers/PreferencesProvider";
import { SocketProvider } from "@/providers/SocketProvider";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { ToastProvider } from "@/providers/ToastProvider";

const avatar = "/auth/sign_in.png";
const cover = "/walls/studio.jpg";
const walls = [
  "/walls/mehfil.jpg",
  "/walls/raat.jpg",
  "/walls/safar.jpg",
  "/walls/sheher.jpg",
  "/walls/xelvic.jpg",
  "/walls/xellom.jpg",
];

const faces = [
  { id: "f1", username: "aanya", name: "Aanya Rao", avatar, initials: "AR" },
  { id: "f2", username: "kabir", name: "Kabir Shah", avatar, initials: "KS" },
  { id: "f3", username: "meera", name: "Meera Iyer", avatar, initials: "MI" },
  { id: "f4", username: "zoya", name: "Zoya Khan", avatar, initials: "ZK" },
];

const profile = {
  id: "p1",
  username: "ansh",
  name: "Ansh Mehra",
  avatar,
  cover,
  initials: "AM",
  verified: true,
  bio: "Product designer, educator and occasional photographer. I build calm interfaces and tell stories about the people who use them.",
  is_private: false,
  is_company: true,
  category: "Product designer & educator",
  address: "Bandra West, Mumbai",
  contact_email: "hello@ansh.design",
  links: [
    { label: "instagram", url: "https://instagram.com/ansh" },
    { label: "website", url: "https://ansh.design" },
    { label: "linkedin", url: "https://linkedin.com/in/ansh" },
  ],
  posts_count: 128,
  followers_count: 12400,
  following_count: 318,
  sparks_count: 46,
  mutuals_count: 12,
  mutuals: faces,
  can_view: true,
  relation: { self: false, following: false, follow_state: "none" },
  gate: { can_send: true, can_type: true, can_call: true },
  character: null,
  show_character: true,
};

function drop(id: string, kind: string, title: string, index: number) {
  const asset = {
    id,
    kind: "image",
    content_url: walls[index % walls.length],
    thumbnail_url: walls[index % walls.length],
  };
  return {
    id,
    kind,
    title,
    body: title,
    author: profile,
    asset,
    cover: kind === "audio" ? asset : null,
    sound_kind: kind === "audio" ? "podcast" : null,
    created_at: new Date(2026, 10, 20 - index).toISOString(),
    likes: 120 + index * 14,
    comments: 12 + index,
    shares: 4 + index,
    saves: 8 + index,
    liked: false,
    saved: false,
    mine: false,
    views: 1200 + index * 100,
  };
}

const drops = [
  drop("d1", "image", "A quiet corner", 0),
  drop("d2", "image", "Sunday light", 1),
  drop("d3", "video", "Behind the scenes", 2),
  drop("d4", "audio", "The design hour", 3),
  drop("d5", "text", "Notes from the studio", 4),
  drop("d6", "image", "Mumbai, after rain", 5),
];

const vibes = [
  drop("v1", "vibe", "Studio walk", 1),
  drop("v2", "vibe", "Rooftop, 6pm", 4),
];

const memory = {
  id: "m1",
  title: "Studio days",
  items: [],
  cover_upload: {
    id: "mc1",
    kind: "image",
    content_url: walls[0],
    thumbnail_url: walls[0],
  },
};

const page = { results: drops, next: null, count: drops.length, previous: null };

api.defaults.adapter = async (config) => {
  const url = String(config.url ?? "");
  let data: unknown = { results: [], next: null };
  if (url.includes("/auth/users/")) {
    data = profile;
  } else if (url.includes("/moments/tray/")) {
    data = {
      unseen: [{ id: "t1", author: profile, seen: false }],
      seen: [],
      mine: [],
      silenced: [],
      answered: [],
    };
  } else if (url.includes("/moments/memories/users/")) {
    data = { memories: [memory, { ...memory, id: "m2", title: "City walks" }] };
  } else if (url.includes("/moments/users/")) {
    data = { moments: [] };
  } else if (url.includes("/drops/users/") && url.includes("/vibes/")) {
    data = { ...page, results: vibes };
  } else if (url.includes("/drops/users/")) {
    data = page;
  } else if (url.includes("/drops/") && url.includes("/pinned/")) {
    data = { pinned: drops.slice(0, 2) };
  } else if (url.includes("/catalogue/")) {
    data = { themes: [], logos: [], characters: [], occasions: [] };
  }
  return {
    data,
    status: 200,
    statusText: "OK",
    headers: {},
    config,
  };
};

const client = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/app/u/ansh"]}>
        <ToastProvider>
          <AuthProvider>
            <PreferencesProvider>
              <ThemeProvider>
                <SocketProvider>
                  <LookingProvider>
                    <Routes>
                      <Route path="/app/u/:username" element={<PersonProfile />} />
                    </Routes>
                  </LookingProvider>
                </SocketProvider>
              </ThemeProvider>
            </PreferencesProvider>
          </AuthProvider>
        </ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>
  </StrictMode>,
);
