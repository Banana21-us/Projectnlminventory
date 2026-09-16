import { api, requireCan, ApiError } from "@/lib/dal";
import { buildBuckets, type DashboardRange } from "@/lib/dashboard-buckets";
import { prisma } from "@/lib/prisma";
import { folioTotals, lockedThrough, notionalValue, toDateString } from "@/lib/booking";
import type { GuesthouseReport } from "@/lib/types";

const RANGES: DashboardRange[] = ["day", "week", "month", "year"];

/** Statuses that represent a stay that actually happened. */
const REAL_STAY = ["CHECKED_IN", "CHECKED_OUT"] as const;

const money = (n: number) => Math.round(n * 100) / 100;

/** Local calendar day of a bucket boundary, as "YYYY-MM-DD". */
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * GET /api/reports/guesthouse?range=day|week|month|year
 *
 * Revenue is accrued to the stay (bucketed by check-in), while supply cost
 * comes from the movement ledger — the two together give net contribution,
 * which is the number a standalone booking system could never produce.
 *
 * Guesthouse supply cost counts a dispense if *either* signal says
 * guesthouse: `purpose = GUESTHOUSE` or the recipient is a GUESTHOUSE
 * recipient. One OR'd query, so nothing is double-counted.
 */
export const GET = api(async (request) => {
  await requireCan("guesthouse.accounting");
  const range = (new URL(request.url).searchParams.get("range") ?? "month") as DashboardRange;
  if (!RANGES.includes(range)) throw new ApiError(422, "Unknown range");

  const buckets = buildBuckets(range);
  const windowStart = buckets[0].start;
  const windowEnd = buckets[buckets.length - 1].end;
  const bucketKeys = buckets.map((b) => ({ from: ymd(b.start), to: ymd(b.end), label: b.label }));

  const [bookings, supplyMovements, roomCount, openBookings, receivableRows, locked] =
    await Promise.all([
      // Everything whose stay starts inside the window, in any status —
      // cancellations and no-shows are counted separately below.
      prisma.booking.findMany({
        where: { checkIn: { gte: windowStart, lt: windowEnd } },
        include: {
          room: true,
          payments: true,
          adjustments: { include: { createdBy: true } },
        },
      }),
      prisma.movement.findMany({
        where: {
          type: "DISPENSE",
          cancelledAt: null,
          createdAt: { gte: windowStart, lt: windowEnd },
          OR: [{ purpose: "GUESTHOUSE" }, { recipient: { type: "GUESTHOUSE" } }],
        },
        select: { qty: true, unitCost: true, createdAt: true },
      }),
      prisma.room.count({ where: { active: true } }),
      // Live worklists are not window-scoped — an unpaid stay from two months
      // ago still needs chasing.
      prisma.booking.findMany({
        where: { status: "CHECKED_OUT", complimentary: false },
        include: { room: true, payments: true, adjustments: true },
      }),
      prisma.payment.findMany({
        where: { method: "CHARGE_TO_DEPARTMENT", settledAt: null },
        include: { payer: true, booking: { select: { id: true, guestName: true } } },
      }),
      lockedThrough(),
    ]);

  const series = bucketKeys.map((b) => ({ label: b.label, revenue: 0, cost: 0, nights: 0 }));
  const bucketFor = (dateYmd: string) =>
    bucketKeys.findIndex((b) => dateYmd >= b.from && dateYmd < b.to);

  let grossRevenue = 0;
  let discounts = 0;
  let extraCharges = 0;
  let netRevenue = 0;
  let roomNightsSold = 0;
  let paidNights = 0;
  let compedNights = 0;
  let compedValue = 0;
  let cancellations = 0;
  let noShows = 0;

  const discountsGiven: GuesthouseReport["discountsGiven"] = [];
  const perRoom = new Map<string, { nights: number; revenue: number }>();

  for (const b of bookings) {
    if (b.status === "CANCELLED") {
      cancellations++;
      continue;
    }
    if (b.status === "NO_SHOW") {
      noShows++;
      continue;
    }
    if (!REAL_STAY.includes(b.status as (typeof REAL_STAY)[number])) continue;

    const totals = folioTotals(b);
    grossRevenue += totals.charge;
    discounts += totals.discounts;
    extraCharges += totals.extraCharges;
    netRevenue += totals.netTotal;
    roomNightsSold += b.billedNights;

    if (b.complimentary) {
      compedNights += b.billedNights;
      compedValue += notionalValue(b);
    } else {
      paidNights += b.billedNights;
    }

    const idx = bucketFor(toDateString(b.checkIn));
    if (idx >= 0) {
      series[idx].revenue += totals.netTotal;
      series[idx].nights += b.billedNights;
    }

    const room = perRoom.get(b.room.name) ?? { nights: 0, revenue: 0 };
    room.nights += b.billedNights;
    room.revenue += totals.netTotal;
    perRoom.set(b.room.name, room);

    for (const a of b.adjustments) {
      if (a.kind !== "DISCOUNT") continue;
      discountsGiven.push({
        id: a.id,
        bookingId: b.id,
        guestName: b.guestName,
        amount: Number(a.amount),
        reason: a.reason,
        by: a.createdBy.name,
        at: a.createdAt.toISOString(),
      });
    }
  }

  let supplyCost = 0;
  for (const m of supplyMovements) {
    const cost = Math.abs(m.qty) * Number(m.unitCost);
    supplyCost += cost;
    const idx = buckets.findIndex((b) => m.createdAt >= b.start && m.createdAt < b.end);
    if (idx >= 0) series[idx].cost += cost;
  }

  // Cash actually received in the window, whatever stay it belonged to.
  const collectedRows = await prisma.payment.findMany({
    where: { paidAt: { gte: windowStart, lt: windowEnd } },
    select: { amount: true },
  });
  const collected = collectedRows.reduce((s, p) => s + Number(p.amount), 0);

  const outstandingBalances: GuesthouseReport["outstandingBalances"] = [];
  const refundsDue: GuesthouseReport["refundsDue"] = [];
  for (const b of openBookings) {
    const { balance } = folioTotals(b);
    if (balance > 0.005) {
      outstandingBalances.push({
        id: b.id,
        guestName: b.guestName,
        roomName: b.room.name,
        checkOut: toDateString(b.checkOut),
        balance: money(balance),
      });
    } else if (balance < -0.005) {
      refundsDue.push({
        id: b.id,
        guestName: b.guestName,
        roomName: b.room.name,
        checkOut: toDateString(b.checkOut),
        amount: money(Math.abs(balance)),
      });
    }
  }

  const days = Math.max(
    1,
    Math.round((windowEnd.getTime() - windowStart.getTime()) / 86_400_000),
  );
  const roomNightsAvailable = roomCount * days;

  const report: GuesthouseReport = {
    range,
    totals: {
      grossRevenue: money(grossRevenue),
      discounts: money(discounts),
      extraCharges: money(extraCharges),
      netRevenue: money(netRevenue),
      collected: money(collected),
      supplyCost: money(supplyCost),
      netContribution: money(netRevenue - supplyCost),
      compedNights,
      compedValue: money(compedValue),
      occupancyPct: roomNightsAvailable
        ? Math.round((roomNightsSold / roomNightsAvailable) * 1000) / 10
        : 0,
      avgNightlyRate: paidNights ? money(grossRevenue / paidNights) : 0,
      roomNightsSold,
      roomNightsAvailable,
      cancellations,
      noShows,
      outstanding: money(outstandingBalances.reduce((s, r) => s + r.balance, 0)),
      refundsDue: money(refundsDue.reduce((s, r) => s + r.amount, 0)),
      receivables: money(receivableRows.reduce((s, r) => s + Number(r.amount), 0)),
    },
    series: series.map((s) => ({
      label: s.label,
      revenue: money(s.revenue),
      cost: money(s.cost),
      nights: s.nights,
    })),
    roomPerformance: [...perRoom.entries()]
      .map(([name, v]) => ({
        name,
        nights: v.nights,
        revenue: money(v.revenue),
        occupancyPct: days ? Math.round((v.nights / days) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue),
    discountsGiven: discountsGiven.sort((a, b) => b.at.localeCompare(a.at)),
    outstandingBalances: outstandingBalances.sort((a, b) => b.balance - a.balance),
    refundsDue,
    receivables: receivableRows.map((r) => ({
      paymentId: r.id,
      bookingId: r.booking.id,
      guestName: r.booking.guestName,
      payerName: r.payer?.name ?? "—",
      amount: Number(r.amount),
      paidAt: r.paidAt.toISOString(),
    })),
    ...(locked ? { lockedThrough: toDateString(locked) } : {}),
  };

  return Response.json(report);
});
