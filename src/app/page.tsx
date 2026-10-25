import Link from "next/link";
import { SiteFooter, SiteHeader, bigButton } from "@/components/saas/chrome";

const steps = [
  {
    title: "Buy observation time",
    body: "Pick a package of minutes. Checkout runs on Stripe in test mode, and your time is added only after the payment is verified.",
  },
  {
    title: "Prepare your window",
    body: "Choose Mars and let the terrain load. Loading is free: nothing is charged until you press Start.",
  },
  {
    title: "Explore until the clock runs out",
    body: "Drive a first-person camera across the landscape. Time runs while your session is active, even when you stand still. Exit any time to keep the rest.",
  },
];

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="flex-1">
        <section className="horizon relative overflow-hidden">
          <div className="stars absolute inset-0" aria-hidden="true" />
          <div className="relative mx-auto max-w-6xl px-4 pb-44 pt-20 sm:px-6 sm:pt-28 sm:pb-56">
            <p className="mb-6 text-sm text-primary">Planetary exploration as a service</p>
            <h1 className="max-w-3xl text-[clamp(2.4rem,7.2vw,4.5rem)] font-extrabold leading-[1.02] [overflow-wrap:anywhere]">
              Rent a window on another world, by the minute.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
              LUNARA imagines how people could book time on robotic explorers beyond 2030. Today you can try the
              service itself: buy minutes, open a simulated Mars, and watch your balance run down as you explore.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/register" className={bigButton()}>
                Start exploring
              </Link>
              <Link href="/pricing" className={bigButton("outline")}>
                See packages
              </Link>
            </div>
            <p className="mt-6 text-sm text-foreground/80">
              Simulated exploration. Test payments only.
            </p>
          </div>
          <div className="horizon-ridge absolute inset-x-0 bottom-0 h-44 sm:h-56" aria-hidden="true" />
        </section>

        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6" aria-labelledby="how">
          <h2 id="how" className="text-3xl font-bold sm:text-4xl">
            How a session works
          </h2>
          <ol className="mt-10 grid gap-x-10 gap-y-10 md:grid-cols-3">
            {steps.map((s, i) => (
              <li key={s.title} className="border-t border-border pt-5">
                <span className="font-heading text-sm font-bold text-mars tabular">Step {i + 1}</span>
                <h3 className="mt-2 text-xl font-bold">{s.title}</h3>
                <p className="mt-3 leading-relaxed text-muted-foreground">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="border-y border-border/70 bg-panel/60">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 md:grid-cols-2">
            <div>
              <h2 className="text-3xl font-bold">What is real, and what is not</h2>
              <p className="mt-4 leading-relaxed text-muted-foreground">
                The account, the time balance, the payment verification and the session clock are real software.
                The landscape is a 3D model that stands in for Mars, rendered on your computer. No robot is moving
                and no images come from Mars.
              </p>
            </div>
            <dl className="grid gap-5 text-sm">
              <div>
                <dt className="font-semibold">Your time is held on our server</dt>
                <dd className="mt-1 text-muted-foreground">
                  Refreshing the page or opening another tab never resets or doubles your minutes.
                </dd>
              </div>
              <div>
                <dt className="font-semibold">You stop the clock with Exit</dt>
                <dd className="mt-1 text-muted-foreground">
                  Unused minutes stay on your account for next time. If your connection drops, billing stops within 15
                  seconds.
                </dd>
              </div>
              <div>
                <dt className="font-semibold">Desktop with keyboard and mouse</dt>
                <dd className="mt-1 text-muted-foreground">
                  Z or W moves forward, S backward, Q/A and D turn, the mouse looks around.
                </dd>
              </div>
            </dl>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
