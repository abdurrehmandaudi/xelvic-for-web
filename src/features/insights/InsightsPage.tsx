import { Fragment, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { keepPreviousData } from "@tanstack/react-query";
import { LineChart as InsightsMark, RefreshCw, WifiOff } from "lucide-react";
import { Blank } from "@/components/ui/Blank";
import { PageHeader } from "@/components/layout/Page";
import { errorMessage } from "@/utils/errors";
import { clock, count, fullDay, monthName, shortDay } from "@/utils/format";
import { cn } from "@/utils/cn";
import { useAuth } from "@/hooks/useAuth";
import { usePreferences } from "@/hooks/usePreferences";
import { useTheme } from "@/hooks/useTheme";
import { useWideScreen } from "@/hooks/useWideScreen";
import { socialService } from "@/services/social.service";
import { BarRow, Chip, DeltaChip, MetricCard, Panel, Sparkline, TrendChart } from "./Charts";
import {
  BUCKETS,
  RANGES,
  cardsOf,
  fits,
  inGroup,
  paired,
  readsFrom,
  repeats,
  type Buckets,
  type InsightContent,
  type InsightMetric,
  type Reads,
} from "./model";

/**
 * Insights: what a page has been doing, for the person whose page it is.
 *
 * Ported from `app/lib/screens/insights.dart`. This is the one screen in the app
 * that is about the account rather than about anybody's conversation, and it is
 * reachable only from your own profile — the server refuses it to everybody else
 * with a named code, and this screen has no entry point anywhere but there.
 *
 * **Read downward, and in the order the questions come in.** How the whole thing
 * has moved; how many people came; who stayed; what they did; what I put up; and
 * what it was that worked. The page is numbers all the way down — the list of
 * *who* looked was taken out by the owner's own ask on 2026-10-18: a page's
 * analytics should say how it is growing, not hand somebody a roster of who was
 * looking. So the request asks the server not to work it out (`?visitors=0`).
 *
 * **Growth comes first, and it is the only chart on the screen.** Everything
 * below it is a number with a shape beside it; this is the one drawing that is
 * the whole account at once, and it is the reason to open the screen. Day, week
 * and month are its granularity, and the bucketing is done here — see `bucket`
 * in the model for why a sum of days is the only honest way to do it.
 *
 * **A page with nothing on it says so rather than drawing zeroes at length.**
 * Four cards reading `0` over four flat lines is a screen that looks broken, and
 * it is the state every account starts in. The window is still drawn — the dates
 * and the range chips are true — but the numbers give way to one line saying
 * what fills them in.
 *
 * **It says nothing in sentences.** Every panel is a title and numbers, and the
 * titles come from the server. Nothing here counts anything: every figure comes
 * from `apps/social/insights.py`, including the engagement rate and the two
 * numbers behind it, so the screen never divides on its own.
 *
 * **The phone column becomes a board on a wide screen.** The app reads top to
 * bottom on one narrow column because that is all a phone has; here the same
 * blocks stay in the same order and the grid gives them room — the chart full
 * width across the top, the four numbers in one row under it, the groups and
 * the rankings side by side. The reading order is the app's at every width, and
 * nothing is added or dropped between the two.
 */
export function InsightsPage() {
  const { user } = useAuth();
  const { t } = usePreferences();
  const { accentAt } = useTheme();
  const wide = useWideScreen("(min-width: 1024px)");
  const roomy = useWideScreen("(min-width: 1280px)");
  const mid = useWideScreen("(min-width: 768px)");

  const [days, setDays] = useState<number>(RANGES[1].days);
  const [by, setBy] = useState<Buckets>("day");
  /** Which metric the growth chart is drawing. Null means the first card. */
  const [pick, setPick] = useState<string | null>(null);

  const owner = String(user?.id ?? "");

  const answer = useQuery({
    queryKey: ["insights", owner, days],
    queryFn: () => socialService.insights(owner, days),
    enabled: Boolean(owner),
    // The chips re-ask, and a screen that blanked on every tap would redraw a
    // moment later. Keeping the last reading while the next one is in flight is
    // what makes the range chips feel like a filter rather than a page load.
    placeholderData: keepPreviousData,
  });

  const reads = useMemo<Reads | null>(
    () => (answer.data ? readsFrom(answer.data) : null),
    [answer.data],
  );

  /** The metric the growth chart is on, or null when there is nothing to draw. */
  const charting = useMemo<InsightMetric | null>(() => {
    if (!reads) return null;
    const cards = cardsOf(reads);
    if (cards.length === 0) return null;
    // A stored pick the server has stopped sending falls back to the first card
    // rather than leaving the chart blank.
    return cards.find((one) => one.key === pick) ?? cards[0];
  }, [reads, pick]);

  /**
   * Whether there is anything at all to say about this window.
   *
   * The test is on the *facts* and not on the numbers: a page with no views and
   * no breakdown has nothing behind it, and drawing four zeroes over four flat
   * lines would be a screen that looks broken rather than a page nobody has
   * found yet. One metric with something in it is enough to draw the whole board.
   */
  const blank = useMemo(() => {
    if (!reads) return false;
    if (reads.breakdown.moments.length > 0 || reads.breakdown.content.length > 0) return false;
    return !reads.metrics.some((one) => one.total > 0);
  }, [reads]);

  /** What a point is called under the plot. */
  const axisAs = (day: string, cut: Buckets) => (cut === "month" ? monthName(day) : shortDay(day));

  /** What the readout above the plot says about the point under the pointer. */
  const readAs = (day: string, cut: Buckets) => {
    if (cut === "day") return fullDay(day);
    if (cut === "week") return t(`Week of ${shortDay(day)}`);
    return `${monthName(day)} ${day.slice(0, 4)}`;
  };

  const growth = useMemo(() => {
    if (!charting) return null;
    const cut = fits(charting, by) ? by : "day";
    return { cut, ...paired(charting.points, charting.previousPoints, cut) };
  }, [charting, by]);

  const chooser =
    reads && charting ? (
      <div className="no-scrollbar flex gap-2 overflow-x-auto">
        {cardsOf(reads).map((one) => (
          <Chip
            key={one.key}
            label={one.title}
            on={one.key === charting.key}
            onTap={one.key === charting.key ? null : () => setPick(one.key)}
          />
        ))}
      </div>
    ) : null;

  const buckets =
    charting && growth ? (
      <div className="no-scrollbar flex gap-2 overflow-x-auto">
        {BUCKETS.map((cut) => (
          <Chip
            key={cut.key}
            label={t(cut.label)}
            on={cut.key === growth.cut}
            enabled={fits(charting, cut.key)}
            onTap={cut.key === growth.cut ? null : () => setBy(cut.key)}
          />
        ))}
      </div>
    ) : null;

  const columns = roomy ? 3 : mid ? 2 : 1;

  const board = useMemo(() => {
    const slabs: { key: string; tall: number; node: ReactNode }[] = [];
    if (reads) {
      const rowsOf = (group: string) =>
        inGroup(reads, group).filter((one) => !reads.headline.includes(one.key));

      slabs.push({
        key: "interactions",
        tall: 104,
        node: (
          <Panel title={t("Interactions")}>
            <div className="flex items-end">
              <span className="text-[30px] font-extrabold leading-none tracking-[-0.8px] tabular-nums md:text-[38px] md:tracking-[-1px]">
                {reads.engagement.rate === null
                  ? "—"
                  : `${Math.round(reads.engagement.rate * 100)}%`}
              </span>
              <div className="ml-3 min-w-0 flex-1 pb-1">
                <p className="text-[12px] leading-[1.3] text-dim md:text-[12.5px]">
                  {didSomething(reads, t)}
                </p>
                {repeats(reads.engagement) ? (
                  <p className="pt-0.5 text-[11px] leading-[1.3] text-dim md:text-[11.5px]">
                    {t(`${count(reads.engagement.interactions)} actions in all, repeats counted`)}
                  </p>
                ) : null}
              </div>
            </div>
          </Panel>
        ),
      });

      reads.groups.forEach((group) => {
        const rows = rowsOf(group.key);
        if (rows.length === 0) return;
        slabs.push({
          key: group.key,
          tall: 56 + rows.length * 96,
          node: (
            <Panel title={group.title}>
              {rows.map((one, index) => (
                <div
                  key={one.key}
                  className={cn(
                    index > 0 && "border-t border-[color-mix(in_srgb,var(--line)_70%,transparent)]",
                  )}
                >
                  <Tally metric={one} color={accentAt(index)} t={t} first={t("first this period")} />
                </div>
              ))}
            </Panel>
          ),
        });
      });

      const moments = reads.breakdown.moments;
      if (moments.length > 0) {
        slabs.push({
          key: "moments",
          tall: 56 + moments.length * 78,
          node: (
            <Ranked
              title={t("Your moments")}
              rows={moments}
              label={(one) => one.body || t("A moment")}
              note={(one) =>
                [
                  t(`${count(one.watchers)} watched`),
                  t(`${count(one.faces)} faces`),
                  t(`${count(one.items)} items`),
                ].join(" · ")
              }
            />
          ),
        });
      }

      const content = reads.breakdown.content;
      if (content.length > 0) {
        slabs.push({
          key: "content",
          tall: 56 + content.length * 78,
          node: (
            <Ranked
              title={t("Your drops and vibes")}
              rows={content}
              label={(one) => one.body || (one.kind === "vibe" ? t("A vibe") : t("A drop"))}
              note={(one) =>
                [
                  t(`${count(one.likes)} felt`),
                  t(`${count(one.comments)} replies`),
                  t(`${count(one.shares)} passed on`),
                ].join(" · ")
              }
            />
          ),
        });
      }

      const reactions = reads.breakdown.reactions;
      if (reactions.length > 0) {
        slabs.push({
          key: "reactions",
          tall: 56 + reactions.length * 62,
          node: (
            <Panel title={t("How they answered")}>
              {reactions.map((one) => (
                <BarRow
                  key={one.label}
                  label={one.label}
                  value={one.count}
                  top={reactions.reduce((best, row) => Math.max(best, row.count), 0)}
                />
              ))}
            </Panel>
          ),
        });
      }

      if (reads.vibeViews > 0) {
        slabs.push({
          key: "vibes",
          tall: 104,
          node: (
            <Panel title={t("Vibes, all time")}>
              <div className="flex items-end">
                <span className="text-[30px] font-extrabold leading-none tracking-[-0.8px] tabular-nums md:text-[38px] md:tracking-[-1px]">
                  {count(reads.vibeViews)}
                </span>
                <span className="ml-2 pb-1 text-[12px] text-dim md:text-[12.5px]">
                  {t(reads.vibeViews === 1 ? "look, ever" : "looks, ever")}
                </span>
              </div>
            </Panel>
          ),
        });
      }
    }

    const lanes = Math.max(1, Math.min(columns, slabs.length));
    const held: { key: string; tall: number; node: ReactNode }[][] = Array.from(
      { length: lanes },
      () => [],
    );
    const load = new Array<number>(lanes).fill(0);
    for (const slab of slabs) {
      let at = 0;
      for (let index = 1; index < lanes; index += 1) {
        if (load[index] < load[at]) at = index;
      }
      held[at].push(slab);
      load[at] += slab.tall;
    }
    return held;
  }, [reads, t, accentAt, columns]);

  const rangeChips = (
    <div className="no-scrollbar flex items-center gap-2 overflow-x-auto">
      {RANGES.map((range) => (
        <Chip
          key={range.days}
          label={t(range.label)}
          on={days === range.days}
          onTap={days === range.days ? null : () => setDays(range.days)}
        />
      ))}
    </div>
  );

  return (
    <div className="pb-[calc(96px+env(safe-area-inset-bottom,0px))] md:pb-12">
      <PageHeader
        title={t("Insights")}
        back
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void answer.refetch()}
              disabled={answer.isFetching}
              aria-label={t("Refresh")}
              title={t("Refresh")}
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-line bg-card text-dim transition-colors duration-150 hover:text-ink disabled:opacity-60"
            >
              <RefreshCw className={cn("size-[15px]", answer.isFetching && "animate-spin")} aria-hidden />
            </button>
            <div className="hidden md:flex">{rangeChips}</div>
          </div>
        }
      >
        <div className="md:hidden px-4 pb-2.5">{rangeChips}</div>
      </PageHeader>

      {answer.isError && !reads ? (
        <div className="mx-auto w-full max-w-[1240px] px-4 md:px-7">
          <Blank
            top="pt-20"
            icon={<WifiOff className="size-[46px]" />}
            title={t("No answer from the server")}
            line={errorMessage(answer.error)}
            action={
              <button type="button" className="inline-flex min-h-11 select-none items-center justify-center gap-2 rounded-control px-[1.1rem] font-bold tracking-[-0.01em] transition-[transform,background-color,color,border-color,opacity] duration-[160ms] ease-out-soft active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 border border-line bg-card text-ink hover:[&:not(:disabled)]:border-accent-30 hover:[&:not(:disabled)]:bg-accent-5 mt-4" onClick={() => void answer.refetch()}>
                {t("Try again")}
              </button>
            }
          />
        </div>
      ) : !reads ? (
        <div className="flex justify-center py-24">
          <span className="size-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      ) : (
        <div className="mx-auto w-full max-w-[1240px] px-4 pt-4 md:px-7 md:pt-5">
          {/* The two dates the board covers, and what it is being compared
              against. Said plainly and near the top, because every number under
              it is a number *for that window*. */}
          <div className="flex items-baseline gap-3 px-0.5 pb-4">
            <p className="min-w-0 flex-1 truncate text-[13.5px] font-semibold md:text-[14px]">
              {`${shortDay(reads.from)} – ${shortDay(reads.to)}`}
            </p>
            <p className="shrink-0 text-[11.5px] text-dim md:text-[12px]">
              {t(`vs the ${reads.days} days before`)}
            </p>
          </div>

          {blank ? (
            <div className="pt-10">
              <Blank
                icon={<InsightsMark className="size-[46px]" />}
                title={t("Nothing yet in these days")}
                line={t(
                  "Insights fill in as people find your page and do something with what you put up.\n\nTry a longer window, or share a moment.",
                )}
              />
            </div>
          ) : (
            <>
              <div className="space-y-3 md:space-y-4">
                {/* ---------------------------------------------- growth -- */}
                {charting && growth ? (
                  <Panel
                    title={t("Growth")}
                    action={<div className="hidden min-w-0 flex-1 justify-end lg:flex">{chooser}</div>}
                  >
                    <div className="lg:hidden">{chooser}</div>
                    <div className="mt-3 lg:mt-2">
                      <TrendChart
                        points={growth.points}
                        previous={growth.previous}
                        color="var(--accent)"
                        height={wide ? 220 : 170}
                        hint={t("Drag along the chart")}
                        axisLabel={(day) => axisAs(day, growth.cut)}
                        readoutLabel={(day) => readAs(day, growth.cut)}
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap items-end gap-x-3 gap-y-2">
                      {/* The window's own total, the same number the card below
                          says and in the same rule as every other count here. */}
                      <span className="text-[26px] font-extrabold leading-none tracking-[-0.6px] tabular-nums md:text-[32px] md:tracking-[-0.8px]">
                        {count(charting.total)}
                      </span>
                      <span className="min-w-0 pb-1 text-[12px] text-dim md:text-[13px]">
                        {t(`in the last ${reads.days} days`)}
                      </span>
                      <div className="ml-auto hidden min-w-0 justify-end lg:flex">{buckets}</div>
                      <span className="shrink-0 pb-1 md:ml-auto lg:ml-0">
                        <DeltaChip change={charting.change} first={t("first this period")} />
                      </span>
                    </div>
                    <div className="mt-3 lg:hidden">{buckets}</div>
                  </Panel>
                ) : null}

                {/* -------------------------------------------- headline -- */}
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
                  {cardsOf(reads).map((one, index) => (
                    <MetricCard
                      key={one.key}
                      metric={one}
                      color={accentAt(index)}
                      first={t("first this period")}
                    />
                  ))}
                </div>
              </div>

              <div className="mt-3 flex gap-3 md:mt-4 md:gap-4">
                {board.map((column, index) => (
                  <div key={index} className="flex min-w-0 flex-1 flex-col gap-3 md:gap-4">
                    {column.map((slab) => (
                      <Fragment key={slab.key}>{slab.node}</Fragment>
                    ))}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* When this was counted. The last line on the page, and the only place
              the word *now* appears: a board that says nothing about its own age
              invites the reader to assume it is live. */}
          <p className="pb-1 pt-4 text-center text-[11px] text-dim">
            {reads.generatedAt
              ? t(`Counted ${shortDay(reads.generatedAt)} at ${clock(reads.generatedAt)}.`)
              : t("Counted in the last few minutes.")}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * How much of the audience did anything, as the app's own sentence.
 *
 * The rate above it is a boast on its own: a dashboard that shows one without
 * saying what it is a fraction *of* makes a person feel good about a quiet
 * month. Every number here is people, which is why this is built from `engaged`
 * and `reached` and never from the action count.
 */
function didSomething(reads: Reads, t: (key: string) => string): string {
  const { engaged, reached } = reads.engagement;
  const who = reached === 1 ? "person" : "people";
  return t(`${count(engaged)} of ${count(reached)} ${who} did something`);
}

/** One day-counted number: what it is, how much, which way it went, and its shape. */
function Tally({
  metric,
  color,
  t,
  first,
}: {
  metric: InsightMetric;
  color: string;
  t: (key: string) => string;
  first: string;
}) {
  return (
    <div className="py-3">
      <div className="flex items-center">
        <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">{metric.title}</span>
        <span className="ml-2 shrink-0 text-[15px] font-extrabold tabular-nums">
          {count(metric.total)}
        </span>
      </div>
      <div className="mt-1 flex items-center">
        {/* The period it is being compared with, always written out. A bare
            arrow asks the reader to remember what last month was, and nobody
            does. */}
        <span className="min-w-0 flex-1 text-[11px] text-dim">
          {t(
            metric.previous === 1
              ? `${count(metric.previous)} in the day before`
              : `${count(metric.previous)} in the ${count(metric.previous)} days before`,
          )}
        </span>
        <DeltaChip change={metric.change} first={first} bare />
      </div>
      <div className="mt-2">
        <Sparkline points={metric.points} color={color} height={24} />
      </div>
    </div>
  );
}

/** One ranked list of things. */
function Ranked({
  title,
  rows,
  label,
  note,
  className,
}: {
  title: string;
  rows: InsightContent[];
  label: (one: InsightContent) => string;
  note: (one: InsightContent) => string;
  className?: string;
}) {
  if (rows.length === 0) return null;
  const top = rows.reduce((best, one) => Math.max(best, one.score), 0);
  return (
    <Panel title={title} className={className}>
      {rows.map((one) => (
        <BarRow key={one.id} label={label(one)} value={one.score} top={top} note={note(one)} />
      ))}
    </Panel>
  );
}