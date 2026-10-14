import { Suspense } from "react";
import { AuthStatus } from "@/components/auth-status";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center gap-4 p-8">
      <Suspense fallback={<p>Loading...</p>}>
        <AuthStatus />
      </Suspense>
      <h1 className="text-2xl font-semibold">Hotel Reservation System</h1>
    </main>
  );
}