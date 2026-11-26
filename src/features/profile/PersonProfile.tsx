import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  BadgePlus,
  CheckCircle2,
  ChevronDown,
  Clock,
  ExternalLink,
  Flag,
  Globe,
  Lock,
  Mail,
  MapPin,
  MoreHorizontal,
  Plus,
  QrCode,
  Settings2,
  UserPlus,
  Users,
  VolumeX,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { MdVerified } from "react-icons/md";
import { FaRegCommentDots, FaUserPlus, FaUserCheck } from "react-icons/fa6";
import { Blank } from "@/components/ui/Blank";
import { Spinner } from "@/components/ui/Button";
import {
  ConfirmDialog,
  Modal,
  PromptDialog,
} from "@/components/overlays/Modal";
import { PageSkeleton } from "@/components/ui/States";
import { ConvoSheet } from "@/features/convo/ConvoSheet";
import { aliasOf, rememberName, useNames } from "@/features/convo/names";
import { MomentViewer } from "@/features/moments/MomentViewer";
import { PosedFigure } from "@/features/profile/PosedBio";
import { ProfileQr } from "@/features/profile/ProfileQr";
import { SparkSheet } from "@/features/sparks/SparkSheet";
import { BirthdayFall } from "@/features/profile/BirthdayFall";
import { isBirthdayTodayIn } from "@/features/profile/birthday";
import { MemoriesShelf } from "@/features/profile/MemoriesShelf";
import {
  BirthdayPill,
  Chip,
  COVER_CONTROL,
  FaceButton,
  FaceDialog,
  Floating,
  MutualsModal,
  MutualStrip,
  PROFILE_CARD,
  PROFILE_FACE,
  PROFILE_GUTTER,
  PROFILE_HEAD,
  PROFILE_HEAD_TEXT,
  PROFILE_MAX,
  PROFILE_PHOTO,
  PROFILE_SECTION,
  ProfileCover,
  ProfileStats,
  QUIET_PILL,
  SOLID_PILL,
  SheetRow,
  TILE_CONTROL,
  ProfileAbout,
  askPulse,
  profileArt,
  type ProfileDetail,
  type ProfileStat,
} from "@/features/profile/parts";
import { PinnedStrip, ProfileShelf } from "@/features/profile/ProfileShelf";
import { ProfessionalLead, linkPillIcon } from "@/features/professional/parts";
import {
  linkLabel,
  websiteAddress,
  websiteLink,
} from "@/features/professional/model";
import { chatService } from "@/services/chat.service";
import { sparksService } from "@/services/sparks.service";
import { dropsService } from "@/services/drops.service";
import { momentsService } from "@/services/moments.service";
import { useAuth } from "@/hooks/useAuth";
import { useLooking } from "@/hooks/useLooking";
import { usePreferences } from "@/hooks/usePreferences";
import { useWideScreen } from "@/hooks/useWideScreen";
import { useTheme } from "@/hooks/useTheme";
import { useToast } from "@/hooks/useToast";
import { cn } from "@/utils/cn";
import { firstName } from "@/utils/format";
import { profileService } from "@/services/profile.service";
import { socialService } from "@/services/social.service";
import type {
  ChatGate,
  Moment,
  Profile,
  Relation,
  UserCard,
} from "@/types/api";

interface PeopleState {
  user?: UserCard;
  relation: Relation;
  gate: ChatGate | null;
  cta: string | null;
}

/** The mark for a gate's action, from the server's own name for it. */
function gateIcon(hint: string | null | undefined, className = "size-[18px]") {
  const Mark =
    {
      plus: Plus,
      clock: Clock,
      lock: Lock,
      user: UserPlus,
    }[String(hint ?? "")] ?? MoreHorizontal;
  return <Mark className={className} aria-hidden />;
}

function ProfilePanel({
  icon: Icon,
  title,
  tone = "var(--accent)",
  meta,
  children,
  className,
}: {
  icon: LucideIcon;
  title: string;
  tone?: string;
  meta?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-[12px] border border-line bg-card px-3 py-1.5 shadow-[0_1px_2px_color-mix(in_srgb,var(--ink)_5%,transparent)]",
        className,
      )}
    >
      <div className="flex items-center gap-2.5">
        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-lg"
          style={{
            backgroundColor: `color-mix(in srgb, ${tone} 12%, transparent)`,
            color: tone,
          }}
        >
          <Icon className="size-4" aria-hidden />
        </span>
        <h2 className="min-w-0 flex-1 truncate text-[14px] font-bold">
          {title}
        </h2>
        {meta}
      </div>
      {children ? <div className="mt-1">{children}</div> : null}
    </section>
  );
}

export function PersonProfile() {
  const { username = "" } = useParams();
  const { user } = useAuth();
  const { design, palette } = useTheme();
  useNames();
  const wide = useWideScreen("(min-width: 1024px)");
  const { t } = usePreferences();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [state, setState] = useState<PeopleState | null>(null);
  const [busy, setBusy] = useState(false);
  const [justKept, setJustKept] = useState(false);
  const [menu, setMenu] = useState(false);
  const [menuPos, setMenuPos] = useState<{
    top: number;
    right: number;
    maxHeight: number;
  } | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("spam");
  const [muted, setMuted] = useState<boolean | null>(null);
  const [going, setGoing] = useState<{ url: string; word: string } | null>(
    null,
  );
  const [qr, setQr] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [mutuals, setMutuals] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [convoOpen, setConvoOpen] = useState(false);
  const [sparkOpen, setSparkOpen] = useState(false);
  const panelOpen = sparkOpen || convoOpen;

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

  const answer = useQuery({
    queryKey: ["profile", username],
    queryFn: () => profileService.byUsername(username),
    enabled: Boolean(username),
    retry: (count, error) =>
      (error as { status?: number }).status !== 410 && count < 2,
  });

  const profile = answer.data;
  const isMe = Boolean(
    profile?.relation?.self || (user && profile?.id === user.id),
  );
  const relation = state?.relation ?? profile?.relation ?? null;
  const gate = state?.gate ?? profile?.gate ?? null;
  const personId = String(profile?.id ?? "");

  const visited = useRef<string | null>(null);
  useEffect(() => {
    if (!personId || isMe || visited.current === personId) return;
    visited.current = personId;
    void socialService.seen(personId).catch(() => {
      // Swallowed on purpose — see above.
    });
  }, [personId, isMe]);

  const deleted = (answer.error as { status?: number } | null)?.status === 410;

  const { say: sayLooking, leave: leaveLooking } = useLooking();
  useEffect(() => {
    if (!personId || isMe) return;
    sayLooking(personId, "profile");
    return () => leaveLooking(personId);
  }, [personId, isMe, sayLooking, leaveLooking]);

  const tray = useQuery({
    queryKey: ["moments-tray"],
    queryFn: () => momentsService.tray(),
    enabled: !isMe && Boolean(personId) && !deleted,
    staleTime: 30_000,
    retry: false,
  });
  const liveRow = useMemo(
    () =>
      [...(tray.data?.unseen ?? []), ...(tray.data?.seen ?? [])].find(
        (row) => row.author?.id === personId,
      ),
    [tray.data, personId],
  );
  const liveFresh = useMemo(
    () =>
      Boolean(
        (tray.data?.unseen ?? []).some((row) => row.author?.id === personId),
      ),
    [tray.data, personId],
  );

  /** Their day, once it has been fetched — the walk the viewer plays. */
  const [day, setDay] = useState<Moment[] | null>(null);
  const [dayBusy, setDayBusy] = useState(false);
  const [faceOpen, setFaceOpen] = useState(false);

  const links = useMemo(() => profile?.links ?? [], [profile?.links]);
  const open = profile?.is_private ? t("private") : t("public");
  const handle = profile?.username ?? username;
  const mine = isMe
    ? null
    : aliasOf(profile?.id, profile?.username ?? username);
  const name = mine || profile?.name || handle;
  const trading = profile?.is_company
    ? String(profile?.category ?? "").trim()
    : "";

  const threadsAside = useQuery({
    queryKey: ["threads", "for-person", personId],
    queryFn: () => chatService.threads(),
    enabled: menu && !isMe && Boolean(personId),
    staleTime: 20_000,
  });

  const convo = useMemo(() => {
    const rows = threadsAside.data?.threads ?? [];
    return (
      rows.find((row) => {
        const ids = [
          row.member?.id,
          row.other?.id,
          ...(row.members ?? []).map((member) => member.user?.id),
        ];
        return ids.some((id) => String(id ?? "") === personId);
      }) ?? null
    );
  }, [threadsAside.data, personId]);

  const spark = useQuery({
    queryKey: ["spark", convo?.id],
    queryFn: () => sparksService.one(String(convo?.id)),
    enabled: sparkOpen && Boolean(convo?.id),
    staleTime: 10_000,
  });

  useEffect(() => {
    if (!panelOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setSparkOpen(false);
        setConvoOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [panelOpen]);

  useEffect(() => {
    if (sparkOpen && spark.isFetched && spark.data == null) {
      setSparkOpen(false);
    }
  }, [sparkOpen, spark.isFetched, spark.data]);

  function keepName(next: string) {
    if (!profile) return;
    rememberName(profile.id, profile.username, next);
    setRenameOpen(false);
    toast({
      title: next.trim()
        ? t("Saved on this device.")
        : t("Back to their own name."),
      tone: "success",
    });
  }

  const birthdayToday = isBirthdayTodayIn(profile);

  const following = relation?.following === true;
  const blocked =
    relation?.blocked_by_me === true || relation?.blocked_me === true;
  const isPublic = profile?.is_private !== true;
  const canKeep = isPublic && !blocked && !isMe;
  const canSend = gate?.can_send === true;
  const cta = gate?.cta ?? state?.cta ?? null;
  const action = gate?.action ?? null;

  const ask = useMemo(() => {
    if (isPublic || blocked || isMe || following) return null;
    const followState = String(relation?.follow_state ?? "");
    if (followState === "requested") {
      return {
        label: t("Withdraw"),
        icon: gateIcon("clock"),
        action: "withdraw",
      };
    }
    if (followState === "none") {
      return {
        label: t("Send request"),
        icon: gateIcon("user"),
        action: "request",
      };
    }
    // `declined`, and anything the server adds later: a closed door, and one
    // this page should not be the one to lean on.
    return null;
  }, [isPublic, blocked, isMe, following, relation?.follow_state, t]);

  function apply(next: PeopleState) {
    setState(next);
    queryClient.setQueryData<Profile>(["profile", username], (current) =>
      current
        ? {
            ...current,
            relation: next.relation,
            gate: next.gate,
            cta: next.cta,
            ...(next.user ?? {}),
          }
        : current,
    );
  }

  /** The gate hands back an action name; each one is a single endpoint. */
  async function act(what: string) {
    if (!profile || busy) return;
    setBusy(true);
    try {
      const next =
        what === "unfollow"
          ? await socialService.unfollow<PeopleState>(profile.id)
          : what === "withdraw"
            ? await socialService.withdraw<PeopleState>(profile.id)
            : what === "unblock"
              ? await socialService.unblock<PeopleState>(profile.id)
              : await socialService.follow<PeopleState>(profile.id);
      apply(next);
      if (what === "follow") setJustKept(true);
      else if (what === "unfollow") setJustKept(false);
      await queryClient.invalidateQueries({ queryKey: ["profile", username] });
      await queryClient.invalidateQueries({ queryKey: ["feed"] });
      await queryClient.invalidateQueries({ queryKey: ["profile-shelf"] });
    } catch (error) {
      toast({
        title: t("That did not work"),
        description: error instanceof Error ? error.message : t("Try again."),
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  /** The convo, opened — or the gate's own sentence about why it cannot be. */
  async function message() {
    if (!profile || busy) return;
    setBusy(true);
    try {
      const result = await chatService.start<{
        thread?: { id: string } | null;
        gate?: ChatGate;
      }>(profile.id);
      if (result.thread?.id) {
        navigate(`/convo/${result.thread.id}`);
      } else if (result.gate) {
        toast({
          title: result.gate.title || t("This convo is closed"),
          description:
            result.gate.text || t("You cannot message this account right now."),
          tone: "info",
        });
      }
    } catch (error) {
      toast({
        title: t("Could not open the convo"),
        description: error instanceof Error ? error.message : t("Try again."),
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  async function openDay() {
    if (!handle || dayBusy) return;
    setDayBusy(true);
    try {
      const response = await momentsService.byUser(handle);
      if (response.moments?.length) {
        setDay(response.moments);
      } else {
        // Answered rather than assumed: a rail row can be a minute older than
        // the moment it names, and "there is nothing there" is the server's
        // sentence, not this page's guess.
        toast({ title: t("Nothing is up right now"), tone: "info" });
        await tray.refetch();
      }
    } catch (error) {
      toast({
        title: t("Could not open those moments"),
        description: error instanceof Error ? error.message : t("Try again."),
        tone: "error",
      });
    } finally {
      setDayBusy(false);
    }
  }

  async function mutePosts() {
    if (!profile) return;
    const next = !(muted ?? false);
    try {
      await dropsService.muteAuthor(profile.id, next);
      setMuted(next);
      setMenu(false);
      toast({
        title: next ? t("Posts muted") : t("Posts unmuted"),
        tone: "success",
      });
    } catch (error) {
      toast({
        title: t("Could not change that"),
        description: error instanceof Error ? error.message : t("Try again."),
        tone: "error",
      });
    }
  }

  async function report() {
    if (!profile) return;
    try {
      await socialService.report({
        target_user: profile.id,
        reason: reportReason,
      });
      setReportOpen(false);
      setMenu(false);
      toast({
        title: t("Report sent"),
        description: t("Thank you. We will look at it."),
        tone: "success",
      });
    } catch (error) {
      toast({
        title: t("Could not send the report"),
        description: error instanceof Error ? error.message : t("Try again."),
        tone: "error",
      });
    }
  }

  if (answer.isLoading) {
    return (
      <div className="mx-auto max-w-[760px] px-4 py-4">
        <PageSkeleton rows={4} />
      </div>
    );
  }

  if (deleted) {
    return (
      <div className="relative isolate mx-auto w-full max-w-[760px] pb-24">
        <Blank
          top="pt-[140px]"
          icon={<Users className="size-[46px]" />}
          title={t("This account is deleted.")}
          line={t("There is nothing here to see.")}
        />
        <div className="absolute inset-x-0 top-0 z-20 p-3">
          <Floating
            icon={<ArrowLeft className="size-[18px]" />}
            label={t("Back")}
            onTap={() =>
              window.history.length > 1 ? navigate(-1) : navigate("/drops")
            }
          />
        </div>
      </div>
    );
  }

  if (answer.isError || !profile) {
    return (
      <div className="mx-auto max-w-[600px] px-4 py-10">
        <Blank
          top="pt-16"
          icon={<Users className="size-[46px]" />}
          title={t("No such account")}
          line={t("That username is not here.")}
          action={
            <button
              type="button"
              className="inline-flex min-h-11 select-none items-center justify-center gap-2 rounded-control px-[1.1rem] font-bold tracking-[-0.01em] transition-[transform,background-color,color,border-color,opacity] duration-[160ms] ease-out-soft active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 border border-line bg-card text-ink hover:[&:not(:disabled)]:border-accent-30 hover:[&:not(:disabled)]:bg-accent-5 mt-4"
              onClick={() => navigate("/search")}
            >
              {t("Search people")}
            </button>
          }
        />
      </div>
    );
  }

  const canView = profile.can_view !== false;
  const mutualCount = Number(profile.mutuals_count ?? 0);
  const mutualShown = !isMe && mutualCount > 0;
  const showsFigure = profile.show_character !== false;
  const keepDoor =
    isPublic && !isMe && ((canKeep && !following) || (justKept && following));
  const first = firstName(name);

  const metrics: ProfileStat[] = [];
  if (canView) {
    metrics.push({
      key: "drops",
      label: t("Drops"),
      value: profile.posts_count,
    });
  }
  if (
    canView &&
    profile.sparks_count !== null &&
    profile.sparks_count !== undefined
  ) {
    metrics.push({
      key: "sparks",
      label: t("Sparks"),
      value: profile.sparks_count,
    });
  }
  if (
    profile.followers_count !== null &&
    profile.followers_count !== undefined
  ) {
    metrics.push({
      key: "crew",
      label: t("Crew"),
      value: profile.followers_count,
    });
  }

  const details: ProfileDetail[] = [];
  const address = String(profile.address ?? "").trim();
  const email = String(profile.contact_email ?? "").trim();
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

  const bio = String(profile.bio ?? "").trim();
  const linkRows = links.filter((row) => String(row.url ?? "").trim());

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

  const privacyBadge =
    "inline-flex shrink-0 items-center gap-1.5 rounded-[8px] border border-[color-mix(in_srgb,var(--accent)_22%,var(--line))] bg-[color-mix(in_srgb,var(--accent)_8%,var(--card))] px-2.5 py-1 text-[12px] font-semibold capitalize text-accent";

  const actionRow = (
    <div className="flex flex-wrap items-center gap-2">
      {canSend ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void message()}
          className={SOLID_PILL}
        >
          <FaRegCommentDots className="size-[18px]" aria-hidden />
          {gate?.text_only === true ? t("Start one convo") : t("Convo")}
        </button>
      ) : null}
      {following || (canKeep && !keepDoor) ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void act(following ? "unfollow" : "follow")}
          aria-label={following ? t("Let go") : t("Keep")}
          aria-pressed={following}
          title={following ? t("Let go") : t("Keep")}
          className={following ? QUIET_PILL : SOLID_PILL}
        >
          {following ? (
            <FaUserCheck className="size-[17px]" aria-hidden />
          ) : (
            <FaUserPlus className="size-[17px]" aria-hidden />
          )}
          {following ? t("Keeping") : t("Keep")}
        </button>
      ) : cta && action ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void act(action)}
          style={
            !busy && (action === "follow" || action === "request")
              ? askPulse(palette.isDark)
              : undefined
          }
          className={canSend ? QUIET_PILL : SOLID_PILL}
        >
          {gateIcon(gate?.icon, "size-[18px]")}
          {t(cta)}
        </button>
      ) : ask ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void act(ask.action)}
          style={
            !busy && ask.action === "request"
              ? askPulse(palette.isDark)
              : undefined
          }
          className={canSend ? QUIET_PILL : SOLID_PILL}
        >
          {ask.icon}
          {ask.label}
        </button>
      ) : null}
      <button
        type="button"
        aria-label={t("Their QR code")}
        title={t("Their QR code")}
        onClick={() => setQr(true)}
        className={TILE_CONTROL}
      >
        <QrCode className="size-[20px]" aria-hidden />
      </button>
    </div>
  );

  return (
    <div
      className={cn(
        "relative isolate min-h-dvh bg-card pb-24 transition-[padding] duration-300 ease-out motion-reduce:transition-none sm:pb-[calc(26px+env(safe-area-inset-bottom,0px))]",
        convo && panelOpen && "md:pr-[350px]",
      )}
    >
      <article className="overflow-hidden bg-card">
        <ProfileCover url={profile.cover} art={design.coverArt}>
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

        <div className={cn(PROFILE_MAX, PROFILE_GUTTER, "relative pb-5 sm:pb-6")}>
          <div className={PROFILE_HEAD}>
            <div className={PROFILE_FACE}>
              <FaceButton
                user={profile}
                size={wide ? PROFILE_PHOTO.wide : PROFILE_PHOTO.narrow}
                ring={liveRow ? (liveFresh ? "new" : "seen") : null}
                label={liveRow ? t("Open their day") : t("Their photo")}
                title={t("Hold to see their photo")}
                onTap={() => {
                  if (liveRow) void openDay();
                  else setFaceOpen(true);
                }}
                onHold={() => setFaceOpen(true)}
              />
            </div>

            <div className={PROFILE_HEAD_TEXT}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <h1 className="truncate text-[26px] font-extrabold leading-[1.08] tracking-[-0.02em] sm:text-[32px]">
                      {name}
                    </h1>
                    {profile.verified ? (
                      <span className="flex shrink-0 self-center">
                        <MdVerified
                          size={22}
                          className="translate-y-[1px] text-[#1D9BF0] sm:translate-y-[2px]"
                          aria-label="Verified"
                        />
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[13px] font-medium text-dim">
                    {trading ? (
                      <>
                        <ProfessionalLead
                          trade={trading}
                          t={t}
                          className="justify-start"
                        />
                        <span aria-hidden>&middot;</span>
                      </>
                    ) : null}
                    <span className="truncate font-bold text-[13px]">
                      @{handle}
                    </span>
                    <span aria-hidden>&middot;</span>
                    {isMe ? (
                      <button
                        type="button"
                        onClick={() => setPrivacyOpen(true)}
                        aria-expanded={privacyOpen}
                        className={`${privacyBadge} transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--accent)_13%,var(--card))]`}
                      >
                        {profile.is_private ? (
                          <Lock className="size-3.5" aria-hidden />
                        ) : (
                          <Globe className="size-3.5" aria-hidden />
                        )}
                        {open}
                        <ChevronDown className="size-3.5" aria-hidden />
                      </button>
                    ) : (
                      <span className="inline-flex shrink-0 items-center gap-1 text-[12px] font-semibold capitalize leading-none">
                        {profile.is_private ? (
                          <Lock className="size-3.5 shrink-0" aria-hidden />
                        ) : (
                          <Globe className="size-3.5 shrink-0" aria-hidden />
                        )}
                        <span className="translate-y-[0.5px]">{open}</span>
                      </span>
                    )}
                  </div>
                </div>
                <div className="shrink-0">{actionRow}</div>
              </div>

              {chips.length ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
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
              <ProfileStats items={metrics} />

              {keepDoor ? (
                justKept ? (
                  <ProfilePanel
                    icon={CheckCircle2}
                    title={t(`${first} is in your Kept`)}
                    tone="var(--good)"
                    className="border-[color-mix(in_srgb,var(--good)_28%,var(--line))] bg-[linear-gradient(120deg,color-mix(in_srgb,var(--good)_7%,var(--card)),var(--card))]"
                  />
                ) : (
                  <ProfilePanel
                    icon={UserPlus}
                    title={t(`Keep ${first}`)}
                    className="border-[color-mix(in_srgb,var(--accent)_20%,var(--line))] bg-[linear-gradient(140deg,color-mix(in_srgb,var(--accent)_5%,var(--card)),var(--card))]"
                    meta={
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void act("follow")}
                        className={cn(SOLID_PILL, "shrink-0")}
                      >
                        {t("Keep")}
                      </button>
                    }
                  >
                    <p className="max-w-[58ch] text-[12.5px] leading-5 text-dim">
                      {t(
                        "They join your Kept, and can message you, call you and send you a moment",
                      )}
                    </p>
                  </ProfilePanel>
                )
              ) : null}
            </div>

            <ProfileAbout
              bio={bio}
              character={profile.character ?? null}
              empty={t("No bio yet")}
              art={profileArt(personId || username)}
              details={details}
            >
              {gate?.title && gate.text_only !== true ? (
                <div className="mt-4 flex gap-3 rounded-[10px] border border-line bg-[color-mix(in_srgb,var(--accent)_5%,var(--card))] px-3 py-2">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]">
                    <Lock className="size-4 text-accent" aria-hidden />
                  </div>

                  <div className="min-w-0">
                    <h3 className="text-[13px] font-semibold">{gate.title}</h3>

                    {gate.text ? (
                      <p className="mt-0.5 text-[12px] leading-5 text-dim">
                        {gate.text}
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </ProfileAbout>
          </div>

          {showsFigure ? (
            <aside className="relative order-first flex min-h-[220px] items-center justify-center overflow-hidden border-b border-line px-6 py-8 lg:order-none lg:min-h-0 lg:border-b-0 lg:border-l">
              <span className="pointer-events-none absolute bottom-8 h-4 w-2/5 rounded-full bg-[color-mix(in_srgb,var(--ink)_12%,transparent)] blur-lg" />
              <PosedFigure
                character={profile.character ?? null}
                show={profile.show_character ?? null}
                className="relative w-full max-w-[190px] drop-shadow-[0_8px_12px_color-mix(in_srgb,var(--ink)_18%,transparent)]"
              />
            </aside>
          ) : null}
        </div>

        {mutualShown ? (
          <div className={cn(PROFILE_MAX, PROFILE_GUTTER)}>
            <MutualStrip
              count={mutualCount}
              faces={profile.mutuals}
              onOpen={() => setMutuals(true)}
            />
          </div>
        ) : null}

        <div className="mt-4 space-y-4 lg:mt-5 lg:space-y-5">
          <MemoriesShelf
            username={handle}
            mine={false}
            author={profile ?? null}
            variant="showcase"
            className={cn(PROFILE_CARD, "overflow-hidden p-4 sm:p-5")}
          />

          {canView ? (
            <div className={cn(PROFILE_CARD, "overflow-hidden p-4 sm:p-5")}>
              <PinnedStrip username={handle} className="pb-3" />
              <ProfileShelf
                username={handle}
                mine={false}
                hasShowcase={Boolean(profile.is_company)}
                variant="showcase"
              />
            </div>
          ) : null}
        </div>
      </div>

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
                  {!isMe ? (
                    <SheetRow
                      icon={<BadgePlus className="size-[18px]" />}
                      label={mine ? t("Change the name") : t("Rename")}
                      line={t("A name only you see")}
                      onClick={() => {
                        setMenu(false);
                        setRenameOpen(true);
                      }}
                    />
                  ) : null}
                  <SheetRow
                    icon={<VolumeX className="size-[18px]" />}
                    label={
                      muted ? t("Unmute their posts") : t("Mute their posts")
                    }
                    onClick={() => void mutePosts()}
                  />
                  {!isMe ? (
                    <SheetRow
                      icon={<Flag className="size-[18px]" />}
                      label={t("Report")}
                      onClick={() => {
                        setMenu(false);
                        setReportOpen(true);
                      }}
                    />
                  ) : null}
                  {convo ? (
                    <>
                      <div className="my-1.5 border-t border-line" />
                      <SheetRow
                        icon={<Zap className="size-[18px]" />}
                        label={t("Spark")}
                        line={t("The run the two of you are on.")}
                        onClick={() => {
                          setMenu(false);
                          setConvoOpen(false);
                          setSparkOpen(true);
                        }}
                      />
                      <SheetRow
                        icon={<Settings2 className="size-[18px]" />}
                        label={t("Convo settings")}
                        line={t("Wallpaper, theme, disappearing and the rest.")}
                        onClick={() => {
                          setMenu(false);
                          setSparkOpen(false);
                          setConvoOpen(true);
                        }}
                      />
                    </>
                  ) : null}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      <PromptDialog
        open={renameOpen}
        onClose={() => setRenameOpen(false)}
        title={t("Rename")}
        label={t("A name only you see")}
        placeholder={profile.name || handle}
        initial={mine ?? ""}
        submitLabel={t("Save")}
        note={t("It stays on this device.")}
        maxLength={24}
        onSubmit={(next) => keepName(next)}
      />

      {convo ? (
        <aside
          className={cn(
            "fixed inset-0 z-[80] flex w-full flex-col overflow-hidden border-line bg-card transition-[transform,opacity] duration-300 ease-out motion-reduce:transition-none md:inset-auto md:right-0 md:top-0 md:z-30 md:h-dvh md:w-[350px] md:border-l",
            panelOpen
              ? "translate-x-0 opacity-100"
              : "pointer-events-none translate-x-full opacity-0 md:opacity-100",
          )}
          aria-hidden={!panelOpen}
          aria-label={sparkOpen ? t("Spark") : t("Convo settings")}
        >
          <div className="flex h-full w-full shrink-0 flex-col md:w-[350px]">
            {sparkOpen ? (
              spark.data ? (
                <SparkSheet
                  open={sparkOpen}
                  variant="panel"
                  threadId={String(convo.id)}
                  title={name}
                  spark={spark.data}
                  face={profile}
                  onClose={() => setSparkOpen(false)}
                  onChanged={() => void spark.refetch()}
                />
              ) : (
                <div className="grid h-full place-items-center">
                  <Spinner className="size-6 text-accent" />
                </div>
              )
            ) : convoOpen ? (
              <ConvoSheet
                open={convoOpen}
                variant="panel"
                onClose={() => setConvoOpen(false)}
                thread={convo}
                kind="convo"
                onChanged={() =>
                  void queryClient.invalidateQueries({ queryKey: ["threads"] })
                }
                onGone={() => {
                  setConvoOpen(false);
                  void queryClient.invalidateQueries({ queryKey: ["threads"] });
                }}
              />
            ) : null}
          </div>
        </aside>
      ) : null}

      <Modal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        title={t("Report this account")}
        description={t("Tell us what is wrong. They will not be told.")}
      >
        <div className="px-5 py-4">
          <label
            className="text-[12px] font-bold text-dim"
            htmlFor="report-reason"
          >
            {t("Reason")}
          </label>
          <select
            id="report-reason"
            value={reportReason}
            onChange={(event) => setReportReason(event.target.value)}
            className="w-full min-h-10 rounded-control border border-line bg-card px-4 py-3 text-ink transition-[border-color,box-shadow] duration-[160ms] placeholder:text-dim-80 focus:border-accent focus:shadow-field-focus focus:outline-none mt-1.5"
          >
            <option value="spam">{t("Spam")}</option>
            <option value="abuse">{t("Abuse")}</option>
            <option value="fake">{t("Fake account")}</option>
            <option value="other">{t("Something else")}</option>
          </select>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              className="inline-flex min-h-11 select-none items-center justify-center gap-2 rounded-control px-[1.1rem] font-bold tracking-[-0.01em] transition-[transform,background-color,color,border-color,opacity] duration-[160ms] ease-out-soft active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 border border-line bg-card text-ink hover:[&:not(:disabled)]:border-accent-30 hover:[&:not(:disabled)]:bg-accent-5"
              onClick={() => setReportOpen(false)}
            >
              {t("Cancel")}
            </button>
            <button
              type="button"
              className="inline-flex min-h-11 select-none items-center justify-center gap-2 rounded-control px-[1.1rem] font-bold tracking-[-0.01em] transition-[transform,background-color,color,border-color,opacity] duration-[160ms] ease-out-soft active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 border border-transparent bg-accent text-on-accent hover:[&:not(:disabled)]:brightness-105"
              onClick={() => void report()}
            >
              {t("Send report")}
            </button>
          </div>
        </div>
      </Modal>

      {/* Where a tap goes is worth being told before it is taken, and a link on
          somebody's profile is somebody else's address. */}
      <ConfirmDialog
        open={Boolean(going)}
        onClose={() => setGoing(null)}
        onConfirm={() => {
          const url = going?.url ?? "";
          setGoing(null);
          if (url) window.open(url, "_blank", "noopener,noreferrer");
        }}
        title={going?.word ? t(`Open ${going.word}?`) : t("Open this link?")}
        body={
          going
            ? going.url.length <= 60
              ? going.url
              : `${going.url.slice(0, 60)}...`
            : ""
        }
        note={t("It opens away from Xelvic.")}
        confirmLabel={t("Open now")}
        icon={<ExternalLink className="size-5" />}
      />

      <MutualsModal
        open={mutuals}
        onClose={() => setMutuals(false)}
        personId={personId}
        personName={name}
        onPick={(person) => {
          setMutuals(false);
          navigate(`/profile/${person.username}`);
        }}
      />

      <Modal
        open={privacyOpen}
        onClose={() => setPrivacyOpen(false)}
        title={t("Privacy")}
        size="sm"
      >
        <div className="flex items-start gap-3 px-5 py-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-accent">
            {profile.is_private ? (
              <Lock className="size-[18px]" aria-hidden />
            ) : (
              <Globe className="size-[18px]" aria-hidden />
            )}
          </span>
          <p className="pt-0.5 text-[13px] leading-6 text-dim">
            {profile.is_private
              ? t("Only the people this account keeps can see what it puts up.")
              : t("Anyone can see this profile and what this account puts up.")}
          </p>
        </div>
      </Modal>

      <Modal open={qr} onClose={() => setQr(false)} size="sm" hideClose>
        <ProfileQr
          user={profile}
          handle={handle}
          name={name}
          onClose={() => setQr(false)}
        />
      </Modal>

      {/* Their day, walked over the page that named them — the app's
          `_openLive`, which puts the viewer on top of the profile rather than
          leaving it. The ring is asked again as this closes, because watching
          is what makes it quiet. */}
      {day ? (
        <MomentViewer
          moments={day}
          onClose={() => {
            setDay(null);
            void tray.refetch();
          }}
          onChanged={() => {
            void tray.refetch();
          }}
        />
      ) : null}

      {/* As large as their picture goes, on a hold or — for a face with nothing
          live behind it — a tap. */}
      <FaceDialog
        open={faceOpen}
        onClose={() => setFaceOpen(false)}
        user={profile}
      />
    </div>
  );
}

/** One line of the About card: a mark and the thing it names. */
