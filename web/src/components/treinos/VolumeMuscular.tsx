import type { PlanSessionData } from "$lib/server/queries";
import { muscleGroupVolume } from "$lib/training-metrics";
import { numero } from "@/lib/format";
import { plural } from "@/lib/treinos";

/** Séries por grupo muscular na semana (referência de volume). */
export function VolumeMuscular({ sessoes }: { sessoes: PlanSessionData[] }) {
  const vol = muscleGroupVolume(sessoes);
  if (vol.length === 0) return null;
  const max = Math.max(1, ...vol.map((m) => m.sets));
  return (
    <section aria-labelledby="volume" className="rounded-lg border border-line bg-bg-elevated p-5 shadow-card">
      <h2 id="volume" className="eyebrow">
        Volume semanal por grupo muscular
      </h2>
      <ul className="mt-4 space-y-2">
        {vol.map((m) => (
          <li key={m.group} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-caption">
            <span className="truncate text-ink-soft">{m.group}</span>
            <span className="h-1.5 overflow-hidden rounded-full bg-bg-muted" aria-hidden>
              <span className="block h-full rounded-full bg-brand" style={{ width: `${(m.sets / max) * 100}%` }} />
            </span>
            <span className="num whitespace-nowrap text-ink-mute">
              {numero(m.sets)} {plural(m.sets, "série", "séries")} · {numero(m.exercises)} ex
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-caption text-ink-mute">
        Soma de séries por grupo ao longo da semana. Referência de hipertrofia: cerca de 10 a 20 séries por grupo.
      </p>
    </section>
  );
}
