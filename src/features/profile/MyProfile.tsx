import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Bookmark,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Globe,
  LineChart,
  Lock,
  Mail,
  MapPin,
  MoreHorizontal,
  Pencil,
  QrCode,
  Settings,
  UserRound,
  X,
} from "lucide-react";
import { Backdrop } from "@/components/layout/Backdrop";
import { ConfirmDialog, Modal } from "@/components/overlays/Modal";
import { PrivacyConfirm } from "@/components/overlays/PrivacyConfirm";
import { VerifiedTick } from "@/components/icons/Tick";
import { BirthdayFall } from "@/features/profile/BirthdayFall";
import { isBirthdayTodayIn } from "@/features/profile/birthday";
import { MemoriesShelf } from "@/features/profile/MemoriesShelf";
import { PosedFigure, usePosedFigure } from "@/features/profile/PosedBio";
import { PinnedStrip, ProfileShelf } from "@/features/profile/ProfileShelf";
import {
  BirthdayPill,
  Chip,
  COVER_CONTROL,
  FaceButton,
  FaceDialog,
  PROFILE_CARD,
  PROFILE_FACE,
  PROFILE_GUTTER,
  PROFILE_HEAD,
  PROFILE_HEAD_TEXT,
  PROFILE_MAX,
  PROFILE_PHOTO,
  PROFILE_SECTION,
  ProfileAbout,
  ProfileCover,
  ProfileStats,
  profileArt,
  type ProfileDetail,
  QUIET_PILL,
  SheetRow,
  SOLID_PILL,
  TILE_CONTROL,
  type ProfileStat,
} from "@/features/profile/parts";
import { ProfessionalLead, linkPillIcon } from "@/features/professional/parts";
import {
  linkLabel,
  websiteAddress,
  websiteLink,
} from "@/features/professional/model";
import { sparksService } from "@/services/sparks.service";
import { cn } from "@/utils/cn";
import { useAuth } from "@/hooks/useAuth";
import { usePreferences } from "@/hooks/usePreferences";
import { useTheme } from "@/hooks/useTheme";
import { useWideScreen } from "@/hooks/useWideScreen";
import { useToast } from "@/hooks/useToast";
import { authService } from "@/services/auth.service";
import { CrewList } from "@/pages/CrewPage";
import type { Me } from "@/types/api";

const SparksWallet = lazy(() =>
  import("@/pages/SparksPage").then((mod) => ({ default: mod.SparksPage })),
);

/**
 * My own profile — the page about me, drawn from my account rather than from
 * somebody else's copy of it.
 *
 * Ported from `app/lib/screens/profile.dart`. The two pages wear one design —
 * the owner asked for that on 2026-11-21, having read the same head drawn two
 * ways — and they differ only in what they offer: this one carries the privacy
 * pill, the four counts with their taps, the way in to Insights, my Memories
 * with the card that makes one, and my own controls where the other page has
 * the convo's.
 *
 * The numbers are read from `Me` and never from the profile endpoint. The app
 * makes the same choice — `_me` on this screen is the session's own account —
 * and for the same reason: my Crew and my Spark are mine to read whatever the
 * switches say, so a page that asked somebody else's endpoint would draw a
 * number that had been hidden from nobody.
 *
 * The head, the row of numbers, the controls and the sheet rows are shared
 * with the page about somebody else — see `profile/parts.tsx` — because
 * the two pages describe one person and the app's own copies of these have
 * already drifted apart once.
 */

export function MyProfile() {  const { user, updateUser } = useAuth();
  const { design, profileBackdrop } = useTheme();
  const { t } = usePreferences();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [menu, setMenu] = useState(false);
  const [menuPos, setMenuPos] = useState<{
    top: number;
    right: number;
    maxHeight: number;
  } | null>(null);
  const [photo, setPhoto] = useState(false);
  const [privacyGoing, setPrivacyGoing] = useState<boolean | null>(null);
  const [privacyBusy, setPrivacyBusy] = useState(false);
  /** The link a tap is asking about, before it is taken. See `openLink`. */
  const [going, setGoing] = useState<{ url: string; word: string } | null>(null);
  const [panel, setPanel] = useState<null | "crew" | "kept" | "spark">(null);

  const openMenuAt = (event: MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setMenuPos({
      top: rect.bottom + 8,
      right: Math.max(12, window.innerWidth - rect.right),
      maxHeight: Math.max(180, window.innerHeight - rect.bottom - 16),
    });
    setMenu(true);
  };

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(false);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    };
    window.addEventListener("scroll", close, { passive: true });
    window.addEventListener("resize", close);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", close);
      window.removeEventListener("resize", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  useEffect(() => {
    if (!panel) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setPanel(null);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [panel]);

  const me = user as Me | null;
  const figure = usePosedFigure(me?.character ?? null, null);
  const wide = useWideScreen("(min-width: 1024px)");

  /**
   * The Spark, live.
   *
   * `Sparks.it.total` is the same reading the wallet and the Convo band take —
   * one request to `/sparks/`, whose `total` is the sum of every run alive
   * right now. Drawn as a dash until it has answered for the same reason a
   * hidden count is: a zero on a cold start would be a claim about how much a
   * person has been talking, made before anybody asked.
   */
  const sparks = useQuery({
    queryKey: ["sparks"],
    queryFn: () => sparksService.list(),
    enabled: Boolean(me?.id),
    retry: false,
  });

  const showsFigure = figure.shows;
  const privateAccount = Boolean(me?.is_private);
  const handle = me?.username ?? "";
  const name = me?.name || handle;
  const birthdayToday = isBirthdayTodayIn(me);

  const trade = me?.is_company ? String(me?.category ?? "").trim() : "";
  const links = useMemo(() => me?.links ?? [], [me?.links]);

  /** The figure the bio is said by, and the art the band wears when I have no cover. */
  const build = useMemo(() => design, [design]);

  async function flipPrivacy(going: boolean) {
    setPrivacyGoing(null);
    if (privacyBusy) return;
    setPrivacyBusy(true);
    try {
      const answer = await authService.setPrivacy({ is_private: going });
      updateUser(answer);
      toast({
        title: going
          ? t("Private. Only people you accept can see your posts now.")
          : t("Public again. Anyone can see your posts."),
        tone: "success",
      });
      // Every shelf this moved is now describing a moment that has passed.
      await queryClient.invalidateQueries({ queryKey: ["profile-shelf"] });
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : t("That did not work"), tone: "error" });
    } finally {
      setPrivacyBusy(false);
    }
  }

  if (!me) return null;

  const linkRows = links.filter((row) => String(row.url ?? "").trim());
  const chips: { text: string; mark: ReactNode; onOpen?: () => void }[] = [];
  for (const row of linkRows) {
    const url = String(row.url ?? "").trim();
    const word = linkLabel(row, t("Link"));
    chips.push({
      text: word,
      mark: linkPillIcon(row.label, url),
      onOpen: () => setGoing({ url, word }),
    });
  }

  const bio = String(me.bio ?? "").trim();
  const details: ProfileDetail[] = [];
  const address = me.is_company ? String(me.address ?? "").trim() : "";
  const email = me.is_company ? String(me.contact_email ?? "").trim() : "";
  if (address) {
    details.push({ icon: MapPin, text: address, tone: "var(--tone-teal)" });
  }
  if (email) {
    details.push({
      icon: Mail,
      text: email,
      tone: "var(--tone-blue)",
      onClick: () => {
        window.location.href = `mailto:${email}`;
      },
    });
  }
  const site = websiteLink(linkRows);
  if (site) {
    const url = String(site.url ?? "").trim();
    const word = linkLabel(site, t("Website"));
    details.push({
      icon: Globe,
      text: websiteAddress(url),
      tone: "var(--tone-violet)",
      onClick: () => setGoing({ url, word }),
    });
  }

  const stats: ProfileStat[] = [
    {
      key: "drops",
      label: t("Drops"),
      value: me.posts_count,
    },
    {
      key: "crew",
      label: t("Crew"),
      value: me.followers_count,
      onTap: () => setPanel("crew"),
      faded: me.show_crew !== true,
    },
    {
      key: "kept",
      label: t("Kept"),
      value: me.following_count,
      onTap: () => setPanel("kept"),
    },
    {
      key: "spark",
      label: t("Spark"),
      value: typeof sparks.data?.total === "number" ? sparks.data.total : null,
      onTap: () => setPanel("spark"),
      faded: me.show_sparks === false,
    },
  ];

  const actionRow = (
    <div className="flex flex-wrap items-center gap-2">
      <Link to="/settings?section=profile" className={SOLID_PILL}>
        <Pencil className="size-[18px]" aria-hidden />
        {t("Edit profile")}
      </Link>
      <Link to="/saved" className={QUIET_PILL}>
        <Bookmark className="size-[18px]" aria-hidden />
        {t("Saved")}
      </Link>
      <Link
        to="/qr"
        aria-label={t("My QR code")}
        title={t("My QR code")}
        className={TILE_CONTROL}
      >
        <QrCode className="size-[18px]" aria-hidden />
      </Link>
    </div>
  );

  return (
    <div
      className={cn(
        "relative isolate min-h-dvh bg-card pb-24 transition-[padding] duration-300 ease-out motion-reduce:transition-none sm:pb-[calc(26px+env(safe-area-inset-bottom,0px))]",
        panel && "md:pr-[350px]",
      )}
    >
      {/* The page's own ground, and the lowest thing on it: a theme that drew a
          profile stands behind this whole page, the same way it stands behind
          the five the shell holds. Drawn first so the card and everything in the
          list sit on it rather than under it — and only on this page, which is
          the half of the pair the app gives one to. */}
      <Backdrop backdrop={profileBackdrop} position="absolute" />

      <article className="overflow-hidden bg-card">
        <ProfileCover url={me.cover} art={build.coverArt}>
          <button
            type="button"
            aria-label={t("Back")}
            title={t("Back")}
            onClick={() =>
              window.history.length > 1 ? navigate(-1) : navigate("/drops")
            }
            className={COVER_CONTROL}
          >
            <ArrowLeft className="size-[18px]" aria-hidden />
          </button>
          <button
            type="button"
            aria-label={t("More")}
            title={t("More")}
            aria-haspopup="menu"
            aria-expanded={menu}
            onClick={openMenuAt}
            className={COVER_CONTROL}
          >
            <MoreHorizontal className="size-[18px]" aria-hidden />
          </button>
        </ProfileCover>

        <div className={cn(PROFILE_MAX, PROFILE_GUTTER, "relative")}>
          <div className={PROFILE_HEAD}>
            <div className={PROFILE_FACE}>
              <FaceButton
                user={me}
                size={wide ? PROFILE_PHOTO.wide : PROFILE_PHOTO.narrow}
                label={t("Your photo")}
                onTap={() => setPhoto(true)}
              />
            </div>

            <div className={PROFILE_HEAD_TEXT}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  {/* The trade stands above the name: `Developer` on its own
                      line, `Daudi` under it. It led the name on one line for
                      part of 2026-10-24, until the owner asked for it above
                      instead. */}
                  {trade ? (
                    <ProfessionalLead trade={trade} t={t} className="mb-1.5 justify-start" />
                  ) : null}
                  <div className="flex min-w-0 items-center gap-2">
                    <h1 className="truncate text-[26px] font-extrabold leading-[1.08] tracking-[-0.02em] sm:text-[32px]">
                      {name}
                    </h1>
                    {me.verified ? (
                      <span className="flex shrink-0">
                        <VerifiedTick size={20} />
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2 text-[13px] font-medium text-dim">
                    <span className="truncate">{t(`@${handle} · you`)}</span>
                    {/* What this page shows to somebody who is not me, said in one
                        pill and changeable from here. A private account is the
                        case the pill exists for — it is the only page that says so
                        — but a public one wears it too, because the way to close
                        the door should not be three taps away in Controls when the
                        page about it is right here. */}
                    <button
                      type="button"
                      disabled={privacyBusy}
                      onClick={() => setPrivacyGoing(!privateAccount)}
                      aria-expanded={privacyGoing !== null}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-[8px] border border-[color-mix(in_srgb,var(--accent)_22%,var(--line))] bg-[color-mix(in_srgb,var(--accent)_8%,var(--card))] px-2.5 py-1 text-[12px] font-semibold capitalize text-accent transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--accent)_13%,var(--card))] disabled:opacity-55"
                    >
                      {privateAccount ? (
                        <Lock className="size-3.5" aria-hidden />
                      ) : (
                        <Globe className="size-3.5" aria-hidden />
                      )}
                      {privacyBusy ? t("Saving...") : privateAccount ? t("Private") : t("Public")}
                      <ChevronDown className="size-3.5" aria-hidden />
                    </button>
                  </div>
                </div>
                <div className="shrink-0">{actionRow}</div>
              </div>

              {chips.length ? (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {chips.map((chip, index) => (
                    <Chip
                      key={`${chip.text}-${index}`}
                      icon={chip.mark}
                      label={chip.text}
                      onClick={chip.onOpen}
                    />
                  ))}
                </div>
              ) : null}

              {birthdayToday ? <BirthdayPill name={name} /> : null}
            </div>
          </div>
        </div>
      </article>

      <div className={cn(PROFILE_MAX, PROFILE_GUTTER, PROFILE_SECTION)}>
        <div
          className={cn(
            "grid overflow-hidden",
            showsFigure && "lg:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]",
          )}
        >
          <div className="min-w-0 space-y-4 px-4 sm:px-5 lg:px-6">
            <div className="space-y-3">
              <ProfileStats items={stats} />

              <Link
                to="/insights"
                className={cn(
                  PROFILE_CARD,
                  "flex items-center gap-3 px-4 py-3.5 transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--ink)_3%,transparent)]",
                )}
              >
                <LineChart className="size-[18px] shrink-0 text-accent" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-semibold">{t("Insights")}</span>
                  <span className="mt-0.5 block truncate text-[12px] text-dim">
                    {t("Views, new crew, interactions and what worked")}
                  </span>
                </span>
                <ChevronRight className="size-[18px] shrink-0 text-dim" aria-hidden />
              </Link>
            </div>

            <ProfileAbout
              bio={bio}
              character={me.character ?? null}
              empty={t("No era yet")}
              art={profileArt(String(me.id ?? handle))}
              details={details}
            />
          </div>

          {showsFigure ? (
            <aside className="relative order-first flex min-h-[220px] items-center justify-center overflow-hidden border-b border-line px-6 py-8 lg:order-none lg:min-h-0 lg:border-b-0 lg:border-l">
              <span className="pointer-events-none absolute bottom-8 h-4 w-2/5 rounded-full bg-[color-mix(in_srgb,var(--ink)_12%,transparent)] blur-lg" />
              <PosedFigure
                character={me.character ?? null}
                show={null}
                className="relative w-full max-w-[190px] drop-shadow-[0_8px_12px_color-mix(in_srgb,var(--ink)_18%,transparent)]"
              />
            </aside>
          ) : null}
        </div>

        <div className="mt-4 space-y-4 lg:mt-5 lg:space-y-5">
          <MemoriesShelf
            username={handle}
            mine
            author={user}
            variant="showcase"
            onAdd={() => navigate("/moments?memories=1")}
            className={cn(PROFILE_CARD, "overflow-hidden p-4 sm:p-5")}
          />

          <div className={cn(PROFILE_CARD, "overflow-hidden p-4 sm:p-5")}>
            <PinnedStrip username={handle} className="pb-3" />
            <ProfileShelf username={handle} mine hasShowcase={Boolean(me.is_company)} variant="showcase" />
          </div>
        </div>
      </div>

      {/* And the day itself, falling down my own page — the same balloons that
          fall on everybody else's. Last in the stack so they draw over
          everything, and they take nothing back: the layer ignores the pointer,
          so the buttons under it are still buttons and the list under it still
          scrolls. */}
      {birthdayToday ? <BirthdayFall /> : null}

      {menu && menuPos
        ? createPortal(
            <div className="fixed inset-0 z-[70]">
              <button
                type="button"
                className="absolute inset-0 bg-transparent"
                onClick={() => setMenu(false)}
                aria-label={t("Close")}
                tabIndex={-1}
              />
              <div
                role="menu"
                style={{
                  top: menuPos.top,
                  right: menuPos.right,
                  maxHeight: menuPos.maxHeight,
                }}
                className="absolute w-[min(19rem,calc(100vw-1.5rem))] overflow-y-auto overscroll-contain rounded-[14px] border border-line bg-card p-1.5 shadow-[0_18px_50px_-18px_color-mix(in_srgb,var(--ink)_40%,transparent)]"
              >
                <div className="py-1.5">
                  <SheetRow
                    icon={<UserRound className="size-[18px]" />}
                    label={t("Profile")}
                    line={t("Your photo, your name and your era.")}
                    onClick={() => {
                      setMenu(false);
                      navigate("/settings?section=profile");
                    }}
                  />
                  <SheetRow
                    icon={<Settings className="size-[18px]" />}
                    label={t("Settings")}
                    line={t("Privacy, notifications and the way out.")}
                    onClick={() => {
                      setMenu(false);
                      navigate("/settings");
                    }}
                  />
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {/* The photo, as large as it goes — the one place it is shown at more than
          the size of a thumbnail, and the same dialog the app opens on a tap. */}
      <FaceDialog open={photo} onClose={() => setPhoto(false)} user={me} />

      <Modal open={privacyGoing !== null} onClose={() => setPrivacyGoing(null)} size="sm" hideClose>
        <PrivacyConfirm
          going={privacyGoing === true}
          onStay={() => setPrivacyGoing(null)}
          onGo={() => void flipPrivacy(privacyGoing === true)}
        />
      </Modal>

      {/* Where a tap goes is worth being told before it is taken, and a link on
          a profile is somebody else's address — the app's own reason for putting
          this card in front of it. The card leads with the word the bare mark
          does not draw, which is where "which of these is Instagram" gets its
          answer, and then the address itself, shortened only when it is long. */}
      <ConfirmDialog
        open={Boolean(going)}
        onClose={() => setGoing(null)}
        onConfirm={() => {
          const url = going?.url ?? "";
          setGoing(null);
          if (url) window.open(url, "_blank", "noopener,noreferrer");
        }}
        title={going?.word ? t(`Open ${going.word}?`) : t("Open this link?")}
        body={going ? (going.url.length <= 60 ? going.url : `${going.url.slice(0, 60)}...`) : ""}
        note={t("It opens away from Xelvic.")}
        confirmLabel={t("Open now")}
        icon={<ExternalLink className="size-5" />}
      />

      <aside
        className={cn(
          "fixed inset-0 z-[80] flex w-full flex-col overflow-hidden border-line bg-card transition-[transform,opacity] duration-300 ease-out motion-reduce:transition-none md:inset-auto md:right-0 md:top-0 md:z-30 md:h-dvh md:w-[350px] md:border-l",
          panel
            ? "translate-x-0 opacity-100"
            : "pointer-events-none translate-x-full opacity-0 md:opacity-100",
        )}
        aria-hidden={!panel}
        aria-label={
          panel === "crew" ? t("Crew") : panel === "kept" ? t("Kept") : t("Wallet")
        }
      >
        <div className="flex h-full w-full shrink-0 flex-col md:w-[350px]">
          {panel ? (
            <>
              <header className="flex shrink-0 items-center gap-3 border-b border-line px-3.5 py-2.5">
                <h2 className="min-w-0 flex-1 truncate text-[14px] font-extrabold tracking-[-0.02em]">
                  {panel === "crew"
                    ? t("Crew")
                    : panel === "kept"
                      ? t("Kept")
                      : t("Wallet")}
                </h2>
                <button
                  type="button"
                  onClick={() => setPanel(null)}
                  aria-label={t("Close")}
                  className="flex size-8 shrink-0 items-center justify-center rounded-full text-dim transition hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] hover:text-ink active:scale-95"
                >
                  <X className="size-5" />
                </button>
              </header>
              <div className="min-h-0 flex-1 overflow-y-auto scroll-thin">
                {panel === "crew" ? (
                  <CrewList username={handle} kind="followers" />
                ) : panel === "kept" ? (
                  <CrewList username={handle} kind="following" />
                ) : (
                  <Suspense
                    fallback={
                      <div className="flex justify-center py-16">
                        <span className="size-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                      </div>
                    }
                  >
                    <SparksWallet panel />
                  </Suspense>
                )}
              </div>
            </>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
