import { useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Bookmark,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Gem,
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
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Backdrop } from "@/components/layout/Backdrop";
import { ConfirmDialog, Modal } from "@/components/overlays/Modal";
import { PrivacyConfirm } from "@/components/overlays/PrivacyConfirm";
import { VerifiedTick } from "@/components/icons/Tick";
import { BirthdayFall } from "@/features/profile/BirthdayFall";
import { isBirthdayTodayIn } from "@/features/profile/birthday";
import { MemoriesShelf } from "@/features/profile/MemoriesShelf";
import { PosedBio } from "@/features/profile/PosedBio";
import { PinnedStrip, ProfileShelf } from "@/features/profile/ProfileShelf";
import {
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
  ProfileCover,
  QUIET_PILL,
  SheetRow,
  SOLID_PILL,
  Sparkline,
  StatCard,
  TILE_CONTROL,
} from "@/features/profile/parts";
import { ProfessionalLead, linkPillIcon } from "@/features/professional/parts";
import { linkLabel } from "@/features/professional/model";
import { sparksService } from "@/services/sparks.service";
import { cn } from "@/utils/cn";
import { useAuth } from "@/hooks/useAuth";
import { usePreferences } from "@/hooks/usePreferences";
import { useTheme } from "@/hooks/useTheme";
import { useWideScreen } from "@/hooks/useWideScreen";
import { useToast } from "@/hooks/useToast";
import { authService } from "@/services/auth.service";
import type { Me } from "@/types/api";

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
  const [photo, setPhoto] = useState(false);
  const [privacyGoing, setPrivacyGoing] = useState<boolean | null>(null);
  const [privacyBusy, setPrivacyBusy] = useState(false);
  /** The link a tap is asking about, before it is taken. See `openLink`. */
  const [going, setGoing] = useState<{ url: string; word: string } | null>(null);

  const me = user as Me | null;
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
  const details: { icon: LucideIcon; text: string; onClick?: () => void }[] = [];
  const address = me.is_company ? String(me.address ?? "").trim() : "";
  const email = me.is_company ? String(me.contact_email ?? "").trim() : "";
  if (address) details.push({ icon: MapPin, text: address });
  if (email) {
    details.push({
      icon: Mail,
      text: email,
      onClick: () => {
        window.location.href = `mailto:${email}`;
      },
    });
  }

  const counts = (
    <div className="mt-5 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
      <StatCard
        label={t("Drops")}
        value={me.posts_count}
        icon={Gem}
        tone="var(--tone-pink)"
        trailing={<Sparkline tone="var(--tone-pink)" />}
      />
      <StatCard
        label={t("Crew")}
        value={me.followers_count}
        icon={Users}
        tone="var(--tone-blue)"
        onTap={() => navigate(`/app/u/${handle}/crew/followers`)}
        faded={me.show_crew !== true}
      />
      <StatCard
        label={t("Kept")}
        value={me.following_count}
        icon={Bookmark}
        tone="var(--tone-teal)"
        onTap={() => navigate(`/app/u/${handle}/crew/following`)}
      />
      <StatCard
        label={t("Spark")}
        value={typeof sparks.data?.total === "number" ? sparks.data.total : null}
        icon={Zap}
        tone="var(--tone-violet)"
        onTap={() => navigate("/app/sparks")}
        faded={me.show_sparks === false}
        trailing={<Sparkline tone="var(--tone-violet)" />}
      />
    </div>
  );

  const actionRow = (
    <div className="flex flex-wrap items-center gap-2">
      <Link to="/app/settings?section=profile" className={SOLID_PILL}>
        <Pencil className="size-[18px]" aria-hidden />
        {t("Edit profile")}
      </Link>
      <Link to="/app/saved" className={QUIET_PILL}>
        <Bookmark className="size-[18px]" aria-hidden />
        {t("Saved")}
      </Link>
      <Link
        to="/app/qr"
        aria-label={t("My QR code")}
        title={t("My QR code")}
        className={TILE_CONTROL}
      >
        <QrCode className="size-[19px]" aria-hidden />
      </Link>
    </div>
  );

  return (
    <div className="relative isolate min-h-dvh bg-card pb-[calc(96px+env(safe-area-inset-bottom,0px))] md:pb-24">
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
              window.history.length > 1 ? navigate(-1) : navigate("/app/drops")
            }
            className={COVER_CONTROL}
          >
            <ArrowLeft className="size-5" aria-hidden />
          </button>
          <button
            type="button"
            aria-label={t("More")}
            title={t("More")}
            onClick={() => setMenu(true)}
            className={COVER_CONTROL}
          >
            <MoreHorizontal className="size-5" aria-hidden />
          </button>
        </ProfileCover>

        <div className={cn(PROFILE_MAX, PROFILE_GUTTER, "relative pb-4 sm:pb-5")}>
          <div className={PROFILE_HEAD}>
            <div className={PROFILE_FACE}>
              <div className="relative rounded-full bg-[color-mix(in_srgb,var(--accent)_84%,transparent)] p-[4px] shadow-[0_20px_38px_-22px_color-mix(in_srgb,var(--ink)_72%,transparent)]">
                <div className="rounded-full border-[3px] border-card bg-card p-[3px]">
                  <FaceButton
                    user={me}
                    size={wide ? PROFILE_PHOTO.wide : PROFILE_PHOTO.narrow}
                    tone="page"
                    label={t("Your photo")}
                    onTap={() => setPhoto(true)}
                  />
                </div>
              </div>
            </div>

            <div className={PROFILE_HEAD_TEXT}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-3 sm:justify-between">
                <div className="min-w-0">
                  {/* The trade stands above the name: `Developer` on its own
                      line, `Daudi` under it. It led the name on one line for
                      part of 2026-10-24, until the owner asked for it above
                      instead. */}
                  {trade ? (
                    <ProfessionalLead trade={trade} t={t} className="mb-1 justify-start" />
                  ) : null}
                  <div className="flex min-w-0 items-center gap-2">
                    <h1 className="truncate text-[28px] font-extrabold leading-[1.05] tracking-[-0.045em] sm:text-[34px]">
                      {name}
                    </h1>
                    {me.verified ? (
                      <span className="flex shrink-0">
                        <VerifiedTick size={22} />
                      </span>
                    ) : null}
                  </div>
                </div>
                {actionRow}
              </div>

              <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-2 text-[13.5px] font-semibold text-dim">
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
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[color-mix(in_srgb,var(--accent)_22%,var(--line))] bg-[color-mix(in_srgb,var(--accent)_8%,var(--card))] px-3 py-1 text-[12.5px] font-bold capitalize text-accent transition hover:bg-[color-mix(in_srgb,var(--accent)_13%,var(--card))] disabled:opacity-55"
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

              {bio ? (
                <p className="mt-2.5 line-clamp-2 max-w-[62ch] text-[14.5px] font-semibold leading-[1.45] text-[color-mix(in_srgb,var(--ink)_76%,transparent)]">
                  {bio}
                </p>
              ) : null}

              {chips.length ? (
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
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

              {birthdayToday ? (
                <span className="mt-2.5 inline-flex max-w-full items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] px-3.5 py-2 text-[13px] font-bold text-accent">
                  {t(`Happy birthday, ${name}!`)}
                </span>
              ) : null}
            </div>
          </div>

          {counts}
        </div>
      </article>

      <div className={cn(PROFILE_MAX, PROFILE_GUTTER)}>
        <section className={cn(PROFILE_CARD, "mt-3 p-4 sm:p-5")}>
          <div
            className={cn(
              "grid gap-5",
              details.length > 0 && "md:grid-cols-[minmax(0,1fr)_240px] md:gap-6",
            )}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-[15px] bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-accent">
                  <UserRound className="size-[21px]" aria-hidden />
                </span>
                <h2 className="text-[22px] font-extrabold tracking-[-0.03em]">{t("About Me")}</h2>
              </div>
              {/* The era, said by the figure the account wears — the same
                  widget their own page draws, so one person is described one
                  way on both halves of the pair. */}
              <PosedBio
                text={bio || t("No era yet.")}
                character={me.character ?? null}
                show={null}
                className="mt-2 px-0 pt-0"
              />
            </div>
            {details.length > 0 ? (
              <div className="space-y-4 md:border-l md:border-line md:pl-6">
                {details.map((detail, index) => (
                  <DetailRow key={`${detail.text}-${index}`} {...detail} />
                ))}
              </div>
            ) : null}
          </div>
        </section>

        {/* The way in to Insights: a card of its own, because it opens a screen
            rather than answering anything the counts above already asked. Only
            ever here, on my own page. */}
        <Link
          to="/app/insights"
          className={cn(
            PROFILE_CARD,
            "mt-3 flex items-center px-4 py-3.5 transition hover:bg-[color-mix(in_srgb,var(--ink)_3%,transparent)]",
          )}
        >
          <LineChart className="size-5 shrink-0 text-accent" aria-hidden />
          <span className="ml-3 min-w-0 flex-1">
            <span className="block text-[14.5px] font-bold">{t("Insights")}</span>
            <span className="mt-0.5 block truncate text-[11.5px] text-dim">
              {t("Views, new crew, interactions and what worked")}
            </span>
          </span>
          <ChevronRight className="size-[18px] shrink-0 text-dim" aria-hidden />
        </Link>

        {/* Memories, kept where they have always been: their own strip up the
            page, above the row of tabs, not folded into it. Drawn even with
            nothing on it, because this is my own and the card at the end of it
            is how one gets made. */}
        <MemoriesShelf
          username={handle}
          mine
          author={user}
          variant="showcase"
          onAdd={() => navigate("/app/moments?memories=1")}
          className={cn(PROFILE_CARD, "mt-3 overflow-hidden p-3.5 sm:p-4")}
        />

        {/* What was dropped, under what was kept. */}
        <div className={cn(PROFILE_CARD, "mt-3 overflow-hidden p-3.5 sm:p-4")}>
          <PinnedStrip username={handle} className="pb-3" />
          <ProfileShelf username={handle} mine hasShowcase={Boolean(me.is_company)} variant="showcase" />
        </div>
      </div>

      {/* And the day itself, falling down my own page — the same balloons that
          fall on everybody else's. Last in the stack so they draw over
          everything, and they take nothing back: the layer ignores the pointer,
          so the buttons under it are still buttons and the list under it still
          scrolls. */}
      {birthdayToday ? <BirthdayFall /> : null}

      <Modal open={menu} onClose={() => setMenu(false)} size="sm" hideClose>
        <div className="py-1.5">
          <SheetRow
            icon={<UserRound className="size-[21px]" />}
            label={t("Profile")}
            line={t("Your photo, your name and your era.")}
            onClick={() => {
              setMenu(false);
              navigate("/app/settings?section=profile");
            }}
          />
          <SheetRow
            icon={<Settings className="size-[21px]" />}
            label={t("Settings")}
            line={t("Privacy, notifications and the way out.")}
            onClick={() => {
              setMenu(false);
              navigate("/app/settings");
            }}
          />
        </div>
      </Modal>

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
    </div>
  );
}

/** One line of the About card: a mark and the thing it names. */
function DetailRow({ icon: Icon, text, onClick }: { icon: LucideIcon; text: string; onClick?: () => void }) {
  const body = (
    <>
      <span className="flex size-5 shrink-0 items-center justify-center text-[color-mix(in_srgb,var(--ink)_45%,transparent)]">
        <Icon className="size-[19px]" aria-hidden />
      </span>
      <span className="min-w-0 truncate text-[13.5px] font-semibold text-ink/80">{text}</span>
    </>
  );
  if (!onClick) {
    return <div className="flex min-w-0 items-center gap-2.5">{body}</div>;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full min-w-0 items-center gap-2.5 text-left transition hover:text-accent"
    >
      {body}
    </button>
  );
}
