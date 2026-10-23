import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getManagerContext } from "@/lib/manager";
import { getReportData, resolvePeriod } from "@/lib/reports";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function money(value: number) {
  return value.toFixed(2);
}

function Card({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-sm">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}

async function Reports({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await connection();
  const params = await searchParams;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) {
    redirect("/login");
  }
  const manager = await getManagerContext();
  if (!manager) {
    notFound();
  }

  const { from, to } = resolvePeriod(params.from, params.to);
  const result = await getReportData(manager.hotelId, manager.hotelName, from, to);
  if (!result.ok) {
    return <p>Could not load the report: {result.error}</p>;
  }
  const { summary, finance, rooms } = result.data;
  const query = `from=${from}&to=${to}`;

  return (
    <div className="flex flex-col gap-8">
      <form method="get" className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="from">From (check-in)</Label>
          <Input id="from" name="from" type="date" defaultValue={from} required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="to">To (check-in)</Label>
          <Input id="to" name="to" type="date" defaultValue={to} required />
        </div>
        <Button type="submit">Show report</Button>
      </form>

      <div className="flex flex-wrap items-center gap-4 text-sm">
        <span>
          {manager.hotelName}: bookings with check-in from {from} to {to}.
          Amounts are in RM.
        </span>
        <a href={`/manage/reports/download?format=xlsx&${query}`} className="underline">
          Download Excel
        </a>
        <a href={`/manage/reports/download?format=pdf&${query}`} className="underline">
          Download PDF
        </a>
      </div>

      <section>
        <h2 className="mb-3 text-xl">Booking report</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Card label="Confirmed bookings" value={summary.confirmed} />
          <Card label="Cancelled bookings" value={summary.cancelled} />
          <Card label="Nights booked" value={summary.nights} />
          <Card label="Registered customers" value={summary.registered} />
          <Card label="Guests" value={summary.guests} />
          <Card label="Cancellation requests waiting" value={summary.waiting} />
        </div>

        <h3 className="mb-2 mt-6 text-lg">By room</h3>
        {rooms.length === 0 ? (
          <p className="text-sm">No confirmed bookings in this period.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 pr-6">Room</th>
                <th className="py-2 pr-6">Bookings</th>
                <th className="py-2 pr-6">Nights</th>
                <th className="py-2 pr-6">Revenue (RM)</th>
              </tr>
            </thead>
            <tbody>
              {rooms.map((r) => (
                <tr key={r.name} className="border-b">
                  <td className="py-2 pr-6">{r.name}</td>
                  <td className="py-2 pr-6">{r.bookings}</td>
                  <td className="py-2 pr-6">{r.nights}</td>
                  <td className="py-2 pr-6">{money(r.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-xl">Financial report</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Card label="Payments received (RM)" value={money(finance.gross)} />
          <Card label="Refunded (RM)" value={money(finance.refunded)} />
          <Card label="Net revenue (RM)" value={money(finance.net)} />
        </div>
      </section>
    </div>
  );
}

export default function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  return (
    <main className="mx-auto max-w-5xl p-8">
      <Link href="/manage" className="text-sm underline">
        Back to dashboard
      </Link>
      <h1 className="my-6 text-2xl font-semibold">Reports</h1>
      <Suspense fallback={<p>Loading...</p>}>
        <Reports searchParams={searchParams} />
      </Suspense>
    </main>
  );
}