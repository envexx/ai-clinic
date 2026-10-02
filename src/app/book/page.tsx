import { BookingFlow } from "@/components/booking/booking-flow";

export default function BookPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-12">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          Book an appointment
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Times are shown in the clinic timezone (Asia/Dubai). Demo data only.
        </p>
      </header>
      <BookingFlow />
    </main>
  );
}
