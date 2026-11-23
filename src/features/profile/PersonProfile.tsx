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
import { QRCodeSVG } from "qrcode.react";
import {
  ArrowLeft,
  BadgePlus,
  CheckCircle2,
  ChevronDown,
  Clock,
  ExternalLink,
  Flag,
  Gem,
  Globe,
  Lock,
  Mail,
  MapPin,
  MessageCircle,
  Minus,
  MoreHorizontal,
  Plus,
  Settings2,
  QrCode,
  UserPlus,
  UserRound,
  Users,
  VolumeX,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Blank } from "@/components/ui/Blank";
import { ConfirmDialog, Modal, PromptDialog } from "@/components/overlays/Modal";
import { PageSkeleton } from "@/components/ui/States";
import { VerifiedTick } from "@/components/icons/Tick";
import { ConvoSheet } from "@/features/convo/ConvoSheet";
import { aliasOf, rememberName, useNames } from "@/features/convo/names";
import { MomentViewer } from "@/features/moments/MomentViewer";
import { PosedBio } from "@/features/profile/PosedBio";
import { SparkSheet } from "@/features/sparks/SparkSheet";
import { BirthdayFall } from "@/features/profile/BirthdayFall";
import { isBirthdayTodayIn } from "@/features/profile/birthday";
import { MemoriesShelf } from "@/features/profile/MemoriesShelf";
import {
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
  ProfileCover,
  QUIET_PILL,
  SOLID_PILL,
  SheetRow,
  Sparkline,
  StatCard,
  TILE_CONTROL,
  askPulse,
} from "@/features/profile/parts";
import { PinnedStrip, ProfileShelf } from "@/features/profile/ProfileShelf";
import { ProfessionalLead, linkPillIcon } from "@/features/professional/parts";
import { linkLabel } from "@/features/professional/model";
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
import { count, firstName } from "@/utils/format";
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

interface Metric {
  key: string;
  label: string;
  value?: number | null;
  icon: LucideIcon;
  tone: string;
  sparkline?: boolean;
  onOpen?: () => void;
}

interface Detail {
  icon: LucideIcon;
  text: string;
  onClick?: () => void;
}

/** The mark for a gate's action, from the server's own name for it. */
function gateIcon(hint: string | null | undefined, className = "size-[19px]") {
  const Mark =
    {
      plus: Plus,
      clock: Clock,
      lock: Lock,
      user: UserPlus,
    }[String(hint ?? "")] ?? MoreHorizontal;
  return <Mark className={className} aria-hidden />;
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

  /** Their day, once it has been fetched — the walk the viewer plays. */
  const [day, setDay] = useState<Moment[] | null>(null);
  const [dayBusy, setDayBusy] = useState(false);
  const [faceOpen, setFaceOpen] = useState(false);

  const links = useMemo(() => profile?.links ?? [], [profile?.links]);
  const open = profile?.is_private ? t("private") : t("public");
  const handle = profile?.username ?? username;
  const mine = isMe ? null : aliasOf(profile?.id, profile?.username ?? username);
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

  function keepName(next: string) {
    if (!profile) return;
    rememberName(profile.id, profile.username, next);
    setRenameOpen(false);
    toast({
      title: next.trim() ? t("Saved on this device.") : t("Back to their own name."),
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
        navigate(`/app/convo/${result.thread.id}`);
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
            icon={<ArrowLeft className="size-[19px]" />}
            label={t("Back")}
            onTap={() =>
              window.history.length > 1 ? navigate(-1) : navigate("/app/drops")
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
              onClick={() => navigate("/app/search")}
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
  const keepDoor =
    isPublic && !isMe && ((canKeep && !following) || (justKept && following));
  const first = firstName(name);
  const followerCount = profile.followers_count;
  const keepCount =
    followerCount === null || followerCount === undefined
      ? null
      : followerCount <= 0
        ? t("Be the first in their Crew")
        : t(`${count(followerCount)} in their Crew`);

  const metrics: Metric[] = [];
  if (canView) {
    metrics.push({
      key: "drops",
      label: t("Drops"),
      value: profile.posts_count,
      icon: Gem,
      tone: "var(--tone-pink)",
      sparkline: true,
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
      icon: Zap,
      tone: "var(--tone-violet)",
      sparkline: true,
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
      icon: Users,
      tone: "var(--tone-blue)",
      sparkline: true,
    });
  }

  const details: Detail[] = [];
  const address = String(profile.address ?? "").trim();
  const email = String(profile.contact_email ?? "").trim();
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

  const bio = String(profile.bio ?? "").trim();
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


  const actionRow = (
    <div className="flex flex-wrap items-center gap-2">
      {canSend ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void message()}
          style={following && !busy ? askPulse(palette.isDark) : undefined}
          className={SOLID_PILL}
        >
          <MessageCircle className="size-[17px]" aria-hidden />
          {gate?.text_only === true ? t("Start one convo") : t("Message")}
        </button>
      ) : null}
      {following || canKeep ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void act(following ? "unfollow" : "follow")}
          aria-label={following ? t("Let go") : t("Keep")}
          title={following ? t("Let go") : t("Keep")}
          style={!following && !canSend && !busy ? askPulse(palette.isDark) : undefined}
          className={cn(
            "relative inline-flex size-[52px] shrink-0 items-center justify-center rounded-full border transition-[transform,background-color,border-color,color,opacity] duration-200 ease-out active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-55",
            following || canSend
              ? "border-line bg-card text-ink hover:bg-[color-mix(in_srgb,var(--ink)_4%,transparent)]"
              : "border-transparent bg-[linear-gradient(135deg,var(--accent),var(--accent-pill))] text-on-accent shadow-[0_12px_26px_-14px_color-mix(in_srgb,var(--accent)_90%,transparent)] hover:brightness-105",
          )}
        >
          <span className="relative flex size-[19px] items-center justify-center">
            <Plus
              className={cn(
                "size-[19px] transition-[opacity,transform] duration-200 ease-out",
                following ? "scale-75 opacity-0" : "scale-100 opacity-100",
              )}
              aria-hidden
            />
            <Minus
              className={cn(
                "absolute inset-0 m-auto size-[19px] transition-[opacity,transform] duration-200 ease-out",
                following ? "scale-100 opacity-100" : "scale-75 opacity-0",
              )}
              aria-hidden
            />
          </span>
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
          {gateIcon(gate?.icon, "size-[17px]")}
          {t(cta)}
        </button>
      ) : ask ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void act(ask.action)}
          style={!busy && ask.action === "request" ? askPulse(palette.isDark) : undefined}
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
        <QrCode className="size-[19px]" aria-hidden />
      </button>
    </div>
  );

  return (
    <div className="relative isolate min-h-dvh bg-card pb-[calc(96px+env(safe-area-inset-bottom,0px))] md:pb-24">
      <article className="overflow-hidden bg-card">
        <ProfileCover url={profile.cover} art={design.coverArt}>
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
            aria-haspopup="menu"
            aria-expanded={menu}
            onClick={openMenuAt}
            className={COVER_CONTROL}
          >
            <MoreHorizontal className="size-5" aria-hidden />
          </button>
        </ProfileCover>

        <div className={cn(PROFILE_MAX, PROFILE_GUTTER, "relative pb-4 sm:pb-5")}>
          <div className={PROFILE_HEAD}>
            <div className={PROFILE_FACE}>
              <div className="relative rounded-full bg-[color-mix(in_srgb,var(--accent)_84%,transparent)] p-[4px] shadow-[0_20px_38px_-22px_color-mix(in_srgb,var(--ink)_72%,transparent)]">
                <div className="relative rounded-full border-[3px] border-card bg-card p-[3px]">
                  <FaceButton
                    user={profile}
                    size={wide ? PROFILE_PHOTO.wide : PROFILE_PHOTO.narrow}
                    tone={liveRow ? (liveRow.seen ? "faded" : "accent") : "page"}
                    label={liveRow ? t("Open their day") : t("Their photo")}
                    title={t("Hold to see their photo")}
                    onTap={() => {
                      if (liveRow) void openDay();
                      else setFaceOpen(true);
                    }}
                    onHold={() => setFaceOpen(true)}
                  />
                  {profile.online ? (
                    <span className="absolute bottom-[6px] right-[6px] size-5 rounded-full border-[3px] border-card bg-[var(--good)]" />
                  ) : null}
                </div>
              </div>
            </div>

            <div className={PROFILE_HEAD_TEXT}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-3 sm:justify-between">
                <div className="min-w-0">
                  {trading ? (
                    <ProfessionalLead trade={trading} t={t} className="mb-1 justify-start" />
                  ) : null}
                  <div className="flex min-w-0 items-center gap-2">
                    <h1 className="truncate text-[28px] font-extrabold leading-[1.05] tracking-[-0.045em] sm:text-[34px]">
                      {name}
                    </h1>
                    {profile.verified ? (
                      <span className="flex shrink-0">
                        <VerifiedTick size={22} />
                      </span>
                    ) : null}
                  </div>
                </div>
                {actionRow}
              </div>

              <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-2 text-[13.5px] font-semibold text-dim">
                <span className="truncate">@{handle}</span>
                <span aria-hidden>&middot;</span>
                <span className="shrink-0">{t("Privacy:")}</span>
                <button
                  type="button"
                  onClick={() => setPrivacyOpen(true)}
                  aria-expanded={privacyOpen}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[color-mix(in_srgb,var(--accent)_22%,var(--line))] bg-[color-mix(in_srgb,var(--accent)_8%,var(--card))] px-3 py-1 text-[12.5px] font-bold capitalize text-accent transition hover:bg-[color-mix(in_srgb,var(--accent)_13%,var(--card))]"
                >
                  {profile.is_private ? (
                    <Lock className="size-3" aria-hidden />
                  ) : (
                    <Globe className="size-3" aria-hidden />
                  )}
                  {open}
                  <ChevronDown className="size-3" aria-hidden />
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
                <span className="mt-2.5 flex max-w-full items-center gap-[7px] rounded-full border border-[color-mix(in_srgb,var(--accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] px-3 py-[7px]">
                  <BirthdayCake />
                  <span className="min-w-0 truncate text-[12px] font-bold text-accent">
                    {t(`${name}'s birthday is today`)}
                  </span>
                </span>
              ) : null}
            </div>
          </div>

          {metrics.length > 0 ? (
            <div
              className={cn(
                "mt-5 grid gap-2 sm:gap-3",
                metrics.length === 1
                  ? "grid-cols-1"
                  : metrics.length === 2
                    ? "grid-cols-2"
                    : "grid-cols-3",
              )}
            >
              {metrics.map(({ key, ...metric }) => (
                <StatCard
                  key={key}
                  label={metric.label}
                  value={metric.value}
                  icon={metric.icon}
                  tone={metric.tone}
                  onTap={metric.onOpen}
                  trailing={metric.sparkline ? <Sparkline tone={metric.tone} /> : null}
                />
              ))}
            </div>
          ) : null}

          {keepDoor ? (
            justKept ? (
              <div className="mt-3.5 flex items-center rounded-[18px] border border-[color-mix(in_srgb,var(--good)_38%,transparent)] bg-[color-mix(in_srgb,var(--good)_12%,var(--card))] px-3.5 py-3">
                <span className="flex size-[38px] shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--good)_16%,transparent)] text-[var(--good)]">
                  <CheckCircle2 className="size-[18px]" aria-hidden />
                </span>
                <span className="ml-[11px] min-w-0 flex-1">
                  <span className="block text-[14px] font-bold">{t(`${first} is in your Kept.`)}</span>
                  {keepCount ? (
                    <span className="mt-0.5 block text-[12px] font-semibold text-dim">
                      {keepCount}
                    </span>
                  ) : null}
                </span>
              </div>
            ) : (
              <div className="mt-3.5 rounded-[18px] border border-[color-mix(in_srgb,var(--accent)_22%,transparent)] bg-[color-mix(in_srgb,var(--accent)_9%,var(--card))] px-3.5 pb-3 pt-3.5">
                <div className="flex items-start">
                  <span className="flex size-[38px] shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] text-accent">
                    <UserPlus className="size-[18px]" aria-hidden />
                  </span>
                  <span className="ml-3 min-w-0 flex-1">
                    <span className="block text-[15.5px] font-extrabold tracking-[-0.2px]">
                      {t(`Keep ${first}`)}
                    </span>
                    <span className="mt-[3px] block text-[12.5px] leading-[1.35] text-dim">
                      {t("They join your Kept, and can message you, call you and send you a moment.")}
                    </span>
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void act("follow")}
                    className="inline-flex select-none items-center justify-center rounded-full bg-accent px-[18px] py-2.5 text-[13px] font-extrabold text-on-accent transition-[transform,background-color,color,opacity] duration-200 ease-out active:scale-[0.97] hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    {t("Keep")}
                  </button>
                  {keepCount ? (
                    <span className="inline-flex items-center gap-[5px] rounded-full bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] px-2.5 py-[7px] text-[11.5px] font-semibold text-dim">
                      <Users className="size-[13px]" aria-hidden />
                      {keepCount}
                    </span>
                  ) : null}
                </div>
              </div>
            )
          ) : null}

          {mutualShown ? (
            <MutualStrip
              count={mutualCount}
              faces={profile.mutuals}
              onOpen={() => setMutuals(true)}
            />
          ) : null}
        </div>
      </article>

      <div className={cn(PROFILE_MAX, PROFILE_GUTTER)}>
        <section className={cn(PROFILE_CARD, "mt-3 p-4 sm:p-5")}>
          <div
            className={cn(
              "grid gap-5",
              details.length > 0 &&
                "md:grid-cols-[minmax(0,1fr)_240px] md:gap-6",
            )}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-[15px] bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-accent">
                  <UserRound className="size-[21px]" aria-hidden />
                </span>
                <h2 className="text-[22px] font-extrabold tracking-[-0.03em]">
                  {t("About Me")}
                </h2>
              </div>
              {bio ? (
                <PosedBio
                  text={bio}
                  character={profile.character ?? null}
                  show={profile.show_character ?? null}
                  className="mt-2 px-0 pt-0"
                />
              ) : (
                <p className="mt-3 text-[14.5px] leading-7 text-ink/75">{t("No bio yet.")}</p>
              )}
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

        {gate?.title && gate.text_only !== true ? (
          <div className="mt-3 flex items-start gap-3 rounded-[22px] border border-[color-mix(in_srgb,var(--accent)_22%,transparent)] bg-[color-mix(in_srgb,var(--accent)_8%,var(--card))] px-4 py-3.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] text-accent">
              <Lock className="size-[17px]" aria-hidden />
            </span>
            <span className="min-w-0 pt-0.5">
              <span className="block text-[14.5px] font-bold">
                {gate.title}
              </span>
              {gate.text ? (
                <span className="mt-1 block text-[12.5px] leading-[1.45] text-dim">
                  {gate.text}
                </span>
              ) : null}
            </span>
          </div>
        ) : null}

        <MemoriesShelf
          username={handle}
          mine={false}
          author={profile ?? null}
          variant="showcase"
          className={cn(PROFILE_CARD, "mt-3 overflow-hidden p-3.5 sm:p-4")}
        />

        {canView ? (
          <div className={cn(PROFILE_CARD, "mt-3 overflow-hidden p-3.5 sm:p-4")}>
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
                className="absolute w-[min(19rem,calc(100vw-1.5rem))] overflow-y-auto overscroll-contain rounded-[20px] border border-line bg-card p-1.5 shadow-[0_18px_50px_-18px_color-mix(in_srgb,var(--ink)_40%,transparent)]"
              >
        <div className="py-1.5">
          {!isMe ? (
            <SheetRow
              icon={<BadgePlus className="size-[21px]" />}
              label={mine ? t("Change the name") : t("Rename")}
              line={t("A name only you see")}
              onClick={() => {
                setMenu(false);
                setRenameOpen(true);
              }}
            />
          ) : null}
          <SheetRow
            icon={<VolumeX className="size-[21px]" />}
            label={muted ? t("Unmute their posts") : t("Mute their posts")}
            onClick={() => void mutePosts()}
          />
          {!isMe ? (
            <SheetRow
              icon={<Flag className="size-[21px]" />}
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
                icon={<Zap className="size-[21px]" />}
                label={t("Spark")}
                line={t("The run the two of you are on.")}
                onClick={() => {
                  setMenu(false);
                  setSparkOpen(true);
                }}
              />
              <SheetRow
                icon={<Settings2 className="size-[21px]" />}
                label={t("Convo settings")}
                line={t("Wallpaper, theme, disappearing and the rest.")}
                onClick={() => {
                  setMenu(false);
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
        <ConvoSheet
          open={convoOpen}
          onClose={() => setConvoOpen(false)}
          thread={convo}
          kind="convo"
          onChanged={() => void queryClient.invalidateQueries({ queryKey: ["threads"] })}
          onGone={() => {
            setConvoOpen(false);
            void queryClient.invalidateQueries({ queryKey: ["threads"] });
          }}
        />
      ) : null}

      {convo ? (
        <SparkSheet
          open={sparkOpen}
          threadId={String(convo.id)}
          title={name}
          spark={spark.data ?? null}
          face={profile}
          onClose={() => setSparkOpen(false)}
          onChanged={() => void spark.refetch()}
        />
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
          navigate(`/app/u/${person.username}`);
        }}
      />

      <Modal
        open={privacyOpen}
        onClose={() => setPrivacyOpen(false)}
        title={t("Privacy")}
        size="sm"
      >
        <div className="flex items-start gap-3 px-5 py-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-accent">
            {profile.is_private ? (
              <Lock className="size-[19px]" aria-hidden />
            ) : (
              <Globe className="size-[19px]" aria-hidden />
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
        <div className="relative flex flex-col items-center px-5 pb-6 pt-6">
          <button
            type="button"
            onClick={() => setQr(false)}
            aria-label={t("Close")}
            className="inline-flex h-10 w-10 flex-none items-center justify-center rounded-full border border-transparent text-dim transition-[background-color,color,transform] duration-[160ms] hover:bg-ink-6 hover:text-ink active:scale-[0.94] absolute right-3 top-3"
          >
            <X className="size-4" />
          </button>
          <span className="flex items-center gap-2.5">
            <Avatar user={profile} size={40} />
            <span className="min-w-0 text-left">
              <span className="block truncate text-[15px] font-bold">
                {name}
              </span>
              <span className="block truncate text-[12px] text-dim">
                @{handle}
              </span>
            </span>
          </span>
          <div className="mt-4 rounded-[20px] border border-[color-mix(in_srgb,var(--accent)_30%,transparent)] bg-card p-3.5">
            {/* Drawn in the theme's accent rather than the app's near-black: the
                accent is the one colour a theme guarantees reads as text on its
                own page, which is the contrast a scanner wants off the card. */}
            <QRCodeSVG
              value={`xelvic://u/@${handle}`}
              size={200}
              level="M"
              includeMargin={false}
              fgColor="currentColor"
              bgColor="transparent"
              className="text-accent"
            />
          </div>
          <p className="mt-3.5 text-center text-[12.5px] leading-[1.4] text-dim">
            {t("Point the Xelvic scanner at this to open their profile.")}
          </p>
          <button
            type="button"
            className="inline-flex min-h-11 select-none items-center justify-center gap-2 rounded-control px-[1.1rem] font-bold tracking-[-0.01em] transition-[transform,background-color,color,border-color,opacity] duration-[160ms] ease-out-soft active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 border border-line bg-card text-ink hover:[&:not(:disabled)]:border-accent-30 hover:[&:not(:disabled)]:bg-accent-5 mt-4"
            onClick={() => {
              void navigator.clipboard
                .writeText(`@${handle}`)
                .then(() =>
                  toast({ title: t("Handle copied"), tone: "success" }),
                )
                .catch(() =>
                  toast({ title: t("Copy it from the page"), tone: "info" }),
                );
            }}
          >
            {t("Copy the handle")}
          </button>
        </div>
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

function DetailRow({ icon: Icon, text, onClick }: Detail) {
  const body = (
    <>
      <span className="flex size-5 shrink-0 items-center justify-center text-[color-mix(in_srgb,var(--ink)_45%,transparent)]">
        <Icon className="size-[19px]" aria-hidden />
      </span>
      <span className="min-w-0 truncate text-[13.5px] font-semibold text-ink/80">
        {text}
      </span>
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

/** The cake on a birthday line, drawn rather than taken from a font. */
function BirthdayCake() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 14 14"
      aria-hidden
      className="shrink-0 text-accent"
    >
      <path
        d="M7 1.1c.7.9 1.1 1.5 1.1 2a1.1 1.1 0 1 1-2.2 0c0-.5.4-1.1 1.1-2Z"
        fill="currentColor"
      />
      <path
        d="M2.4 6.2h9.2v1.1c0 .6-.5 1.1-1.1 1.1-.6 0-1.1-.5-1.1-1.1 0 .6-.5 1.1-1.1 1.1-.6 0-1.1-.5-1.1-1.1 0 .6-.5 1.1-1.1 1.1-.6 0-1.1-.5-1.1-1.1 0 .6-.5 1.1-1.1 1.1-.6 0-1.1-.5-1.1-1.1V6.2Z"
        fill="currentColor"
        opacity="0.45"
      />
      <rect
        x="2.4"
        y="9.2"
        width="9.2"
        height="3.4"
        rx="1"
        fill="currentColor"
      />
    </svg>
  );
}
