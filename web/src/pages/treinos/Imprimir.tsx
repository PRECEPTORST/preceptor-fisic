import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer } from "lucide-react";
import type { PlanSessionData } from "$lib/server/queries";
import { api } from "@/lib/api";
import {
  dataBR,
  fmtAcao,
  fmtCadencia,
  fmtIntensidade,
  fmtPausa,
  fmtSeries,
  idade,
  letraSessao,
  linhasForca,
  objetivoCapa,
} from "@/lib/treinos";
import { chaves, type ImpressaoResposta } from "@/lib/treinos-tipos";
import { QueryState, SkeletonLista } from "@/components/QueryState";
import { Button } from "@/components/ui/button";

const DIAS = [
  ["dom", "Dom"],
  ["seg", "Seg"],
  ["ter", "Ter"],
  ["qua", "Qua"],
  ["qui", "Qui"],
  ["sex", "Sex"],
  ["sab", "Sáb"],
] as const;

/**
 * Impressão / PDF da prescrição em A4. A folha é renderizada num portal no
 * body, sobre o shell; no @media print o app (#root) some e só a folha sai.
 * O papel é branco em qualquer tema; a lavanda marca títulos e cabeçalhos.
 */
const CSS_IMPRESSAO = `
@page { size: A4; margin: 0; }
@media print {
  body > #root { display: none !important; }
  .folha-raiz { position: static !important; overflow: visible !important; padding: 0 !important; }
  .folha-raiz .sem-impressao { display: none !important; }
  .folha-raiz .folha { border: 0 !important; margin: 0 !important; }
  .folha-raiz .quebra { break-before: page; }
  .folha-raiz tr { break-inside: avoid; }
}
.folha-raiz { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
`;

export default function TreinoImprimir() {
  const { id = "" } = useParams();
  const q = useQuery({ queryKey: chaves.impressao(id), queryFn: () => api<ImpressaoResposta>(`/treinos/${id}/imprimir`) });
  return (
    <QueryState query={q} skeleton={<SkeletonLista linhas={8} />}>
      {(d) => createPortal(<Folhas d={d} />, document.body)}
    </QueryState>
  );
}

function Folhas({ d }: { d: ImpressaoResposta }) {
  // O título vira o nome sugerido do PDF.
  useEffect(() => {
    const antes = document.title;
    document.title = `Prescrição · ${d.student?.name ?? "—"} · ${new Date().toLocaleDateString("pt-BR")}`;
    return () => {
      document.title = antes;
    };
  }, [d.student?.name]);
  const pd = d.plan.planData;
  const sessoes = pd.weekly_sessions ?? [];
  const aerobios = pd.aerobic_prescriptions ?? [];
  const anos = idade(d.student?.birthDate);
  const inicio = new Date(d.plan.publishedAt ?? d.plan.createdAt);
  const semanas = pd.program_weeks ?? null;
  const fim = semanas ? new Date(inicio.getTime() + semanas * 7 * 86_400_000) : null;
  const titulo = d.professional.specialty ? d.professional.specialty.replace(/_/g, " ") : "Profissional de Educação Física";
  const agenda = [
    ...sessoes.map((s, i) => ({ label: `Treino de Força ${letraSessao(i)}`, dia: s.day_of_week ?? null })),
    ...aerobios.map((a) => ({
      label: `Treino Aeróbio${a.means ? " · " + a.means : ""}${a.weekly_frequency ? " (" + a.weekly_frequency + ")" : ""}`,
      dia: null as string | null,
    })),
  ];

  const cabecalho = (
    <div className="mb-5 flex items-end justify-between gap-4 border-b-2 border-brand pb-2">
      <p className="text-[15px] font-bold text-brand">{d.professional.name}</p>
      <p className="text-right text-[10.5px] text-black/60">
        {d.student?.name ?? "—"}
        {d.student?.birthDate && <> · Nasc.: {dataBR(d.student.birthDate)}</>}
        {anos != null && <> · {anos} anos</>}
      </p>
    </div>
  );
  const assinatura = (
    <div className="mt-auto self-center pt-7 text-center">
      <div className="mx-auto mb-1.5 w-60 border-t border-black/70" />
      <p className="text-[12px] font-bold">{d.professional.name}</p>
      <p className="text-[10px] capitalize text-black/60">{titulo}</p>
      <p className="text-[10px] text-black/60">
        {d.professional.cref ? `CREF ${d.professional.cref.replace(/^CREF\s*/i, "")}` : "CREF —"}
      </p>
    </div>
  );

  return (
    <div className="folha-raiz fixed inset-0 z-50 overflow-y-auto bg-bg-muted py-6 print:bg-white">
      <style>{CSS_IMPRESSAO}</style>
      <div className="sem-impressao sticky top-0 z-10 mx-auto mb-4 flex max-w-[210mm] items-center justify-between gap-2 px-4">
        <Button variant="outline" asChild>
          <Link to={`/treinos/${d.plan.id}`}>
            <ArrowLeft aria-hidden /> Voltar
          </Link>
        </Button>
        <Button onClick={() => window.print()}>
          <Printer aria-hidden /> Imprimir ou salvar PDF
        </Button>
      </div>

      <div className="overflow-x-auto">
        {/* Capa */}
        <article className="folha mx-auto mb-4 flex min-h-[297mm] w-[210mm] flex-col bg-white px-[16mm] pb-[16mm] pt-[18mm] text-[11px] leading-[1.45] text-black shadow-card">
          {cabecalho}
          <h1 className="mb-6 mt-2 text-[26px] font-bold tracking-tight text-brand">Prescrição de Exercício Físico</h1>
          <Capa rotulo="Aluno(a)">
            <p className="text-[18px] font-semibold">{d.student?.name ?? "—"}</p>
            <p className="mt-0.5 text-black/60">
              {d.student?.birthDate && <>Data de nascimento: {dataBR(d.student.birthDate)}</>}
              {anos != null && <> · Idade: {anos} anos</>}
            </p>
          </Capa>
          <Capa rotulo="Objetivo">
            <p className="text-[12.5px] leading-relaxed">{objetivoCapa(pd.objective, d.goals, pd.summary)}</p>
          </Capa>
          <Capa rotulo="Programa semanal">
            <table className="w-full border-collapse text-[10.5px]">
              <thead>
                <tr>
                  {DIAS.map(([k, l]) => (
                    <Th key={k}>{l}</Th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {DIAS.map(([k]) => (
                    <td key={k} className="h-14 w-[14.28%] border border-black/15 p-1.5 text-center align-top text-[9.5px] leading-tight">
                      {agenda
                        .filter((a) => a.dia === k)
                        .map((a) => (
                          <div key={a.label} className="mb-0.5">
                            {a.label}
                          </div>
                        ))}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
            <ul className="mt-2.5 list-disc pl-5 text-black/80">
              {agenda.map((a) => (
                <li key={a.label}>
                  {a.label}
                  {a.dia ? ` — ${DIAS.find(([k]) => k === a.dia)?.[1]}` : ""}
                </li>
              ))}
            </ul>
          </Capa>
          <Capa rotulo="Período de realização do programa">
            <p className="text-[14px] font-semibold">
              {semanas && fim
                ? `${dataBR(inicio)} a ${dataBR(fim)} (${semanas} semanas)`
                : `Início em ${dataBR(inicio)} · término a definir pelo profissional`}
            </p>
          </Capa>
          {assinatura}
        </article>

        {sessoes.map((s, i) => (
          <article
            key={i}
            className="folha quebra mx-auto mb-4 flex min-h-[297mm] w-[210mm] flex-col bg-white px-[16mm] pb-[16mm] pt-[18mm] text-[11px] leading-[1.45] text-black shadow-card"
          >
            {cabecalho}
            <TabelaForca s={s} letra={letraSessao(i)} />
            {s.observations && <Obs>{s.observations}</Obs>}
            {assinatura}
          </article>
        ))}

        {aerobios.length > 0 && (
          <article className="folha quebra mx-auto mb-4 flex min-h-[297mm] w-[210mm] flex-col bg-white px-[16mm] pb-[16mm] pt-[18mm] text-[11px] leading-[1.45] text-black shadow-card">
            {cabecalho}
            <TituloTreino>TREINO AERÓBIO</TituloTreino>
            {aerobios.map((a, i) => (
              <table key={i} className="w-full border-collapse text-[10.5px]">
                <thead>
                  <tr>
                    {["Meio", "Método", "Pausa", "Intensidade", "Volume"].map((h) => (
                      <Th key={h}>{h}</Th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <Td>
                      {a.means}
                      {a.weekly_frequency ? ` (${a.weekly_frequency})` : ""}
                    </Td>
                    <Td>{a.method}</Td>
                    <Td>{a.pause || "-"}</Td>
                    <Td>{a.intensity}</Td>
                    <Td>{a.volume}</Td>
                  </tr>
                </tbody>
              </table>
            ))}
            {aerobios.some((a) => a.observations) && (
              <Obs>
                {aerobios
                  .map((a) => a.observations)
                  .filter(Boolean)
                  .join(" ")}
              </Obs>
            )}
            {assinatura}
          </article>
        )}
      </div>
    </div>
  );
}

function TabelaForca({ s, letra }: { s: PlanSessionData; letra: string }) {
  return (
    <>
      <TituloTreino>TREINO DE FORÇA {letra}</TituloTreino>
      {s.focus && <p className="mb-2.5 mt-1.5 text-black/60">{s.focus}</p>}
      {/* table-fixed + colgroup: as 8 colunas cabem no A4 e o texto quebra em vez de vazar. */}
      <table className="w-full table-fixed border-collapse text-[10.5px]">
        <colgroup>
          {["23%", "13%", "7%", "10%", "8%", "13%", "10%", "16%"].map((w, i) => (
            <col key={i} style={{ width: w }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {["Exercício", "Intensidade", "Séries", "Repetições", "Pausa", "Ação muscular", "Cadência", "Amplitude"].map((h, i) => (
              <Th key={h} esquerda={i === 0}>
                {h}
              </Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhasForca(s).map(({ ex, tag }, i) => (
            <tr key={ex.name + (tag ?? "") + i} className="even:bg-brand/5">
              <Td esquerda>
                <span className="font-semibold">{ex.name}</span>
                {tag && <span className="block text-[9px] italic text-black/50">({tag})</span>}
              </Td>
              <Td>{fmtIntensidade(ex)}</Td>
              <Td>{fmtSeries(ex)}</Td>
              <Td>{ex.reps ?? "-"}</Td>
              <Td>{fmtPausa(ex)}</Td>
              <Td>{fmtAcao(ex)}</Td>
              <Td>{fmtCadencia(ex)}</Td>
              <Td>{ex.range_of_motion || "-"}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

const Capa = ({ rotulo, children }: { rotulo: string; children: React.ReactNode }) => (
  <section className="mb-5">
    <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-brand">{rotulo}</p>
    {children}
  </section>
);
const TituloTreino = ({ children }: { children: React.ReactNode }) => (
  <h2 className="rounded-t bg-brand px-3.5 py-2 text-[18px] font-bold italic tracking-wide text-brand-on">{children}</h2>
);
const Th = ({ children, esquerda }: { children: React.ReactNode; esquerda?: boolean }) => (
  <th className={`border border-brand bg-brand px-1.5 py-1.5 font-semibold text-brand-on ${esquerda ? "text-left" : "text-center"}`}>
    {children}
  </th>
);
const Td = ({ children, esquerda }: { children: React.ReactNode; esquerda?: boolean }) => (
  <td className={`break-words border border-black/15 px-1.5 py-1.5 align-middle ${esquerda ? "text-left" : "text-center"}`}>{children}</td>
);
const Obs = ({ children }: { children: React.ReactNode }) => (
  <p className="mt-2.5 border-l-[3px] border-brand bg-brand/5 px-2.5 py-2 text-black/80">
    <strong>Observações:</strong> {children}
  </p>
);
