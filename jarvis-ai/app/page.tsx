import AssistantConsole from "@/components/assistant-console";

export default function Home() {
  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-800 text-zinc-50">
      <div className="pointer-events-none absolute inset-0 opacity-60">
        <div className="absolute -left-1/2 -top-1/2 h-[120%] w-[120%] rounded-full bg-[radial-gradient(circle_at_center,_rgba(60,130,246,0.18),_transparent_55%)] blur-3xl" />
        <div className="absolute inset-x-0 bottom-0 h-64 bg-[radial-gradient(circle_at_bottom,_rgba(255,255,255,0.08),_transparent_65%)]" />
      </div>
      <div className="relative z-10 flex-1 px-4 py-6 sm:px-8 lg:px-16">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
          <header className="flex flex-col gap-2">
            <p className="text-sm uppercase tracking-[0.5rem] text-zinc-400">
              Stark Systems
            </p>
            <h1 className="text-3xl font-semibold sm:text-4xl lg:text-5xl">
              Jarvis Adaptive Operator
            </h1>
            <p className="max-w-2xl text-balance text-sm text-zinc-400 sm:text-base">
              A multimodal-ready command center that blends conversational AI,
              situational awareness, and voice controls. Issue directives,
              orchestrate missions, and let Jarvis synthesize the next best
              action.
            </p>
          </header>
          <AssistantConsole />
        </div>
      </div>
    </main>
  );
}
