import { useEffect, useRef, useState, type ComponentProps } from "react";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  Bell,
  Bookmark,
  ChevronDown,
  Clapperboard,
  GalleryVerticalEnd,
  Headphones,
  LogOut,
  MessageCircle,
  Palette,
  Plus,
  QrCode,
  Radio,
  Search,
  Settings,
  Sparkles,
  UserRound,
  CirclePlay,
  Wallet,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Backdrop } from "@/components/layout/Backdrop";
import { BrandMark } from "@/components/icons/Brand";
import { PlayerBar } from "@/components/layout/PlayerBar";
import { cn } from "@/utils/cn";
import { useAuth } from "@/hooks/useAuth";
import { useIdlePrefetch, useRoutePrefetch } from "@/hooks/useRoutePrefetch";
import { useTheme } from "@/hooks/useTheme";
import { NOINDEX, usePageMeta } from "@/seo";
import { SHELL_ROUTES } from "@/routes/lazyPages";
import type { ShellPage } from "@/theme/catalog";

/**
 * The shell's own links, with their page's code fetched a beat early.
 *
 * Every tab in the sidebar and the bottom bar goes through here, which is the
 * whole point: a reader who taps Drops should land on Drops, not on a spinner
 * while the Drops chunk downloads. See `useRoutePrefetch`.
 */
function PrefetchNavLink({
  to,
  ...rest
}: Omit<ComponentProps<typeof NavLink>, "to"> & { to: string }) {
  const warm = useRoutePrefetch(to);
  return <NavLink to={to} {...warm} {...rest} />;
}

function PrefetchLink({
  to,
  ...rest
}: Omit<ComponentProps<typeof Link>, "to"> & { to: string }) {
  const warm = useRoutePrefetch(to);
  return <Link to={to} {...warm} {...rest} />;
}

const primary = [
  {
    to: "/drops",
    label: "Drops",
    icon: GalleryVerticalEnd,
    page: "drops" as ShellPage,
  },
  {
    to: "/moments",
    label: "Moments",
    icon: CirclePlay,
    page: "moments" as ShellPage,
  },
  {
    to: "/convo",
    label: "Convo",
    icon: MessageCircle,
    page: "convo" as ShellPage,
  },
  {
    to: "/videos",
    label: "Videos",
    icon: Clapperboard,
    page: "videos" as ShellPage,
  },
  {
    to: "/audio",
    label: "Audio",
    icon: Headphones,
    page: "audio" as ShellPage,
  },
  {
    to: "/live",
    label: "Live",
    icon: Radio,
    page: "live" as ShellPage,
  },
];

const secondary = [
  { to: "/search", label: "Search", icon: Search },
  { to: "/alerts", label: "Notifications", icon: Bell },
  { to: "/saved", label: "Saved", icon: Bookmark },
  // Named for where it goes. The screen behind this row is the app's Wallet —
  // the balance, the two numbers beside it, and the ledger that explains them —
  // so a row called "Sparks" would be promising a different page.
  { to: "/sparks", label: "Wallet", icon: Wallet },
];

/** The name a signed-in screen gives the tab, for the document title. */
function titleForPath(pathname: string): string {
  if (pathname.startsWith("/convo")) return "Convo";
  if (pathname.startsWith("/moments")) return "Moments";
  if (pathname.startsWith("/videos")) return "Videos";
  if (pathname.startsWith("/kids")) return "Kids";
  if (pathname.startsWith("/audio")) return "Audio";
  if (pathname.startsWith("/live")) return "Live";
  if (pathname.startsWith("/search")) return "Search";
  if (pathname.startsWith("/alerts")) return "Notifications";
  if (pathname.startsWith("/saved")) return "Saved";
  if (pathname.startsWith("/settings")) return "Settings";
  if (pathname.startsWith("/profile/")) return "Profile";
  if (pathname.startsWith("/drops")) return "Drops";
  return "Xelvic";
}

function pageForPath(pathname: string): ShellPage | null {
  if (pathname === "/drops") return "drops";
  if (pathname.startsWith("/drops")) return "drops";
  if (pathname.startsWith("/moments")) return "moments";
  if (pathname.startsWith("/convo")) return "convo";
  if (pathname.startsWith("/videos")) return "videos";
  if (pathname.startsWith("/audio")) return "audio";
  if (pathname.startsWith("/live")) return "live";
  return null;
}

function ProfileMenu({ compact = false }: { compact?: boolean }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) return null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg border border-transparent px-1.5 py-1 text-left transition hover:bg-[color-mix(in_srgb,var(--ink)_5%,transparent)]",
          compact ? "justify-center" : "justify-center lg:justify-start",
          open && "bg-[color-mix(in_srgb,var(--ink)_5%,transparent)]",
        )}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <Avatar user={user} size={34} />
        <span
          className={cn(
            "min-w-0 flex-1",
            compact ? "hidden" : "hidden lg:block",
          )}
        >
          <span className="block truncate text-[13px] font-semibold">
            {user.name || user.username}
          </span>
          <span className="block truncate text-[11.5px] text-dim">
            @{user.username}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "size-3.5 text-dim",
            compact ? "hidden" : "hidden lg:block",
          )}
          aria-hidden
        />
      </button>
      {open ? (
        <div
          className="absolute bottom-full left-0 z-50 mb-2 w-56 overflow-hidden rounded-[16px] border border-line bg-card p-1.5 shadow-xl animate-fade-up"
          role="menu"
        >
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-[13px] font-semibold hover:bg-[color-mix(in_srgb,var(--ink)_5%,transparent)]"
            onClick={() => {
              setOpen(false);
              navigate(`/profile/${user.username}`);
            }}
          >
            <UserRound className="size-4 text-dim" /> Your profile
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-[13px] font-semibold hover:bg-[color-mix(in_srgb,var(--ink)_5%,transparent)]"
            onClick={() => {
              setOpen(false);
              navigate("/qr");
            }}
          >
            <QrCode className="size-4 text-dim" /> My QR code
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-[13px] font-semibold hover:bg-[color-mix(in_srgb,var(--ink)_5%,transparent)]"
            onClick={() => {
              setOpen(false);
              navigate("/settings");
            }}
          >
            <Settings className="size-4 text-dim" /> Settings
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-[13px] font-semibold text-[var(--bad)] hover:bg-[color-mix(in_srgb,var(--bad)_8%,transparent)]"
            onClick={() => {
              setOpen(false);
              void logout();
            }}
          >
            <LogOut className="size-4" /> Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function AppShell() {
  const location = useLocation();
  const { backdropFor, design } = useTheme();
  const { user } = useAuth();
  const page = pageForPath(location.pathname);
  const backdrop = backdropFor(page);
  const art = backdrop?.art ?? null;
  const inChat = location.pathname.startsWith("/convo");

  /*
   * Everything behind this shell is the account's own room. It is not a page a
   * crawler should index, and it is not a page a share sheet should describe —
   * a public drop has its own address (`/d/...`) for that.
   */
  usePageMeta({
    title: titleForPath(location.pathname),
    path: location.pathname,
    description: "Your Xelvic account.",
    robots: NOINDEX,
  });

  // The tabs behind the bottom bar are the pages a signed-in reader moves
  // between most, so their code is fetched in the first quiet moment after the
  // page they opened has painted. Failure is silent and harmless — see
  // `preloadRoute`.
  useIdlePrefetch(SHELL_ROUTES, !!user);

  return (
    // `isolate` is load-bearing and not decoration: it is what keeps the
    // backdrop's negative stack level inside this element, so the picture lands
    // over this page's own ground and under every card and line the pages draw.
    <div className="relative isolate min-h-dvh bg-page text-ink">
      <a
        href="#main-content"
        className="fixed left-3 top-3 z-[100] -translate-y-20 rounded-[12px] bg-card px-4 py-3 font-bold text-ink shadow-lg focus:translate-y-0"
      >
        Skip to main content
      </a>
      <Backdrop backdrop={backdrop} />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-line bg-[color-mix(in_srgb,var(--card)_86%,transparent)] py-4 backdrop-blur-xl transition-[width,padding] duration-300 md:flex",
          inChat ? "w-[76px] px-3" : "w-[88px] px-3 lg:w-[240px] lg:px-4",
        )}
      >
        <PrefetchLink
          to="/convo"
          className={cn(
            "mb-4 flex shrink-0 items-center gap-2.5",
            inChat
              ? "justify-center"
              : "justify-center lg:justify-start lg:px-3",
          )}
          aria-label="Xelvic home"
        >
          <BrandMark size={36} />
          <span
            className={cn(
              "text-[17px] font-semibold tracking-[-0.01em]",
              inChat ? "hidden" : "hidden lg:block",
            )}
          >
            Xelvic
          </span>
        </PrefetchLink>

        <div className="scroll-thin -mx-1 min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-1 [mask-image:linear-gradient(to_bottom,black_calc(100%_-_18px),transparent)]">
          <nav className="space-y-0.5" aria-label="Main">
            {primary.map((item) => (
              <PrefetchNavLink
                key={item.to}
                to={item.to}
                title={item.label}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2.5 rounded-[10px] py-2 text-[14px] font-medium transition-colors",
                    inChat
                      ? "justify-center px-0"
                      : "justify-center px-0 lg:justify-start lg:px-3",
                    isActive
                      ? "bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-accent"
                      : "text-dim hover:bg-[color-mix(in_srgb,var(--ink)_5%,transparent)] hover:text-ink",
                  )
                }
              >
                <item.icon
                  className="size-[18px] shrink-0"
                  strokeWidth={1.75}
                  aria-hidden
                />
                <span className={cn(inChat ? "hidden" : "hidden lg:block")}>
                  {item.label}
                </span>
              </PrefetchNavLink>
            ))}
          </nav>

          <div className="my-2 h-px bg-line" />

          <nav className="space-y-0.5" aria-label="More">
            {secondary.map((item) => (
              <PrefetchNavLink
                key={item.to}
                to={item.to}
                title={item.label}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2.5 rounded-[10px] py-2 text-[13px] font-medium transition-colors",
                    inChat
                      ? "justify-center px-0"
                      : "justify-center px-0 lg:justify-start lg:px-3",
                    isActive
                      ? "bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-accent"
                      : "text-dim hover:bg-[color-mix(in_srgb,var(--ink)_5%,transparent)] hover:text-ink",
                  )
                }
              >
                <item.icon
                  className="size-[18px] shrink-0"
                  strokeWidth={1.75}
                  aria-hidden
                />
                <span className={cn(inChat ? "hidden" : "hidden lg:block")}>
                  {item.label}
                </span>
              </PrefetchNavLink>
            ))}
          </nav>
        </div>

        <div className="mt-auto shrink-0 space-y-2 border-t border-line pt-3">
          <PrefetchLink
            to="/drops?compose=1"
            className="flex min-h-10 items-center justify-center gap-2 rounded-[10px] bg-accent px-3 text-[13.5px] font-semibold text-on-accent transition-[filter,transform] duration-150 hover:brightness-105 active:scale-[.98]"
            title="Create a drop"
          >
            <Plus
              className="size-[18px] shrink-0"
              strokeWidth={2}
              aria-hidden
            />
            <span className={cn(inChat ? "hidden" : "hidden lg:block")}>
              New drop
            </span>
          </PrefetchLink>
          <PrefetchLink
            to="/settings?section=marketplace"
            className={cn(
              "flex min-h-9 items-center justify-center gap-2.5 rounded-[10px] border border-line bg-card px-3 text-dim transition-colors hover:text-ink",
              !inChat && "lg:justify-start",
            )}
            title="Themes and appearance"
          >
            <Palette
              className="size-[18px] shrink-0"
              strokeWidth={1.75}
              aria-hidden
            />
            <span
              className={cn(
                "truncate text-[13px] font-medium",
                inChat ? "hidden" : "hidden lg:block",
              )}
            >
              {design.name}
            </span>
          </PrefetchLink>
          <ProfileMenu compact={inChat} />
        </div>
      </aside>

      <div
        className={cn(
          "transition-[padding] duration-300",
          inChat ? "md:pl-[76px]" : "md:pl-[88px] lg:pl-[240px]",
        )}
      >
        <header className="flex items-center gap-3 border-b border-line bg-[color-mix(in_srgb,var(--page)_88%,transparent)] px-4 py-3 backdrop-blur-xl md:hidden">
          <PrefetchLink
            to="/convo"
            className="flex items-center gap-2"
            aria-label="Xelvic home"
          >
            <BrandMark size={30} />
            <span className="text-[15px] font-extrabold tracking-[-0.04em]">
              Xelvic
            </span>
          </PrefetchLink>
          <div className="ml-auto flex items-center gap-0.5">
            <PrefetchLink
              to="/search"
              className="inline-flex h-10 w-10 flex-none items-center justify-center rounded-full border border-transparent text-dim transition-[background-color,color,transform] duration-[160ms] hover:bg-ink-6 hover:text-ink active:scale-[0.94]"
              aria-label="Search"
            >
              <Search className="size-[18px]" />
            </PrefetchLink>
            <PrefetchLink
              to="/alerts"
              className="inline-flex h-10 w-10 flex-none items-center justify-center rounded-full border border-transparent text-dim transition-[background-color,color,transform] duration-[160ms] hover:bg-ink-6 hover:text-ink active:scale-[0.94]"
              aria-label="Notifications"
            >
              <Bell className="size-[18px]" />
            </PrefetchLink>
            <PrefetchLink
              to="/sparks"
              className="inline-flex h-10 w-10 flex-none items-center justify-center rounded-full border border-transparent text-dim transition-[background-color,color,transform] duration-[160ms] hover:bg-ink-6 hover:text-ink active:scale-[0.94]"
              aria-label="Rewards and themes"
            >
              <Sparkles className="size-[18px]" />
            </PrefetchLink>
            {user ? (
              <PrefetchLink
                to={`/profile/${user.username}`}
                aria-label="Your profile"
                className="ml-1"
              >
                <Avatar user={user} size={32} />
              </PrefetchLink>
            ) : null}
          </div>
        </header>

        <main
          id="main-content"
          tabIndex={-1}
          className={cn(
            "relative min-h-[calc(100dvh-57px)] md:min-h-dvh",
            !art && "bg-page",
          )}
        >
          <Outlet />
        </main>
      </div>

      <PlayerBar offset="desktop" compact={inChat} />
      <PlayerBar offset="mobile" />

      {!inChat ? (
        <nav
          className="fixed inset-x-2 bottom-2 z-50 md:hidden"
          aria-label="Main navigation"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          <div className="border border-nav-edge-38 bg-nav-glass shadow-[0_1px_2px_rgb(var(--nav)/0.08),0_18px_48px_rgb(var(--nav)/0.22)] backdrop-blur-[22px] backdrop-saturate-[1.4] flex items-center justify-around rounded-[22px] px-1.5 py-1.5">
            {primary.map((item) => (
              <PrefetchNavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-[16px] px-1 py-1.5 text-[9.5px] font-bold transition",
                    isActive
                      ? "text-[var(--accent-pill)]"
                      : "text-[var(--nav-quiet)] hover:text-[var(--nav-ink)]",
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon
                      className={cn("size-[20px]", isActive && "stroke-[2.5]")}
                      aria-hidden
                    />
                    <span>{item.label}</span>
                  </>
                )}
              </PrefetchNavLink>
            ))}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
