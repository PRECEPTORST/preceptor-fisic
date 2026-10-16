import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { ESPECIALIDADES, especialidadeValida, type Especialidade } from "@/lib/conta";
import { CHAVE_SESSAO, useSessao, type Sessao } from "@/hooks/useSessao";
import { PageHeader } from "@/components/PageHeader";
import { QueryState } from "@/components/QueryState";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusChip } from "@/components/ui/status-chip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";

// O que ainda não existe aparece como roadmap honesto, nunca como mock com dado falso.
const EM_BREVE = [
  { label: "Plano e cobrança", desc: "Faturas e troca de plano dentro das configurações" },
  { label: "Integrações", desc: "Google Calendar, WhatsApp" },
  { label: "Notificações", desc: "Alertas de aderência e mensagens" },
];

export default function Configuracoes() {
  const sessao = useSessao();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow="Configurações" title="Conta e preferências" />
      <QueryState query={sessao} skeleton={<Skeleton className="h-96 w-full" />}>
        {(s) => <FormPerfil pro={s.professional} />}
      </QueryState>

      <section aria-labelledby="seguranca" className="mt-8">
        <h2 id="seguranca" className="mb-3 text-h6 font-medium">
          Senha e segurança
        </h2>
        <div className="rounded-lg border border-line bg-bg-elevated p-5 text-body text-ink-soft">
          Para trocar a senha agora, saia da conta e use{" "}
          <Link to="/recuperar" className="text-brand underline-offset-4 hover:underline">
            Esqueci minha senha
          </Link>{" "}
          na tela de entrada. Verificação em duas etapas e sessões ativas chegam depois.
        </div>
      </section>

      <section aria-labelledby="em-breve" className="mt-8">
        <h2 id="em-breve" className="mb-3 text-h6 font-medium">
          Em desenvolvimento
        </h2>
        <ul className="divide-y divide-line rounded-lg border border-line bg-bg-elevated">
          {EM_BREVE.map((r) => (
            <li key={r.label} className="flex items-center gap-3 px-5 py-3">
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-ink-soft">{r.label}</span>
                <span className="block text-caption text-ink-mute">{r.desc}</span>
              </span>
              <StatusChip dot={false}>em breve</StatusChip>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function FormPerfil({ pro }: { pro: Sessao["professional"] }) {
  const qc = useQueryClient();
  const [name, setName] = useState(pro.name);
  const [cref, setCref] = useState(pro.cref ?? "");
  const [specialty, setSpecialty] = useState<Especialidade>(
    especialidadeValida(pro.specialty) ? pro.specialty : "prescricao_clinica",
  );

  const salvar = useMutation({
    mutationFn: () => api("/configuracoes/perfil", { method: "PUT", json: { name, cref: cref || null, specialty } }),
    onSuccess: () => {
      toast.success("Perfil atualizado.");
      qc.invalidateQueries({ queryKey: CHAVE_SESSAO });
    },
    onError: (e) => toast.error(`Não consegui salvar: ${e.message}`),
  });

  function enviar(e: FormEvent) {
    e.preventDefault();
    salvar.mutate();
  }

  return (
    <form onSubmit={enviar} aria-labelledby="identidade">
      <h2 id="identidade" className="mb-3 text-h6 font-medium">
        Identidade profissional
      </h2>
      <div className="space-y-5 rounded-lg border border-line bg-bg-elevated p-5 shadow-card">
        <div className="flex items-center gap-4">
          <Avatar nome={name || "Profissional"} size={64} />
          <div className="min-w-0">
            <p className="truncate font-medium text-ink">{name || "Profissional"}</p>
            <p className="truncate text-caption text-ink-mute">{pro.cref || "Sem registro informado"}</p>
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="cfg-name">Nome</Label>
          <Input id="cfg-name" required minLength={2} maxLength={120} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="cfg-email">E-mail</Label>
          <Input id="cfg-email" type="email" disabled value={pro.email} />
          <p className="text-caption text-ink-mute">É o e-mail de entrada. Para trocar, fale com o time.</p>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="cfg-cref">CREF / CREFITO</Label>
          <Input id="cfg-cref" maxLength={40} placeholder="CREF 123456-G/SP" value={cref} onChange={(e) => setCref(e.target.value)} />
          <p className="text-caption text-ink-mute">Aparece para os seus alunos.</p>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="cfg-spec">Especialidade</Label>
          <Select value={specialty} onValueChange={(v) => setSpecialty(v as Especialidade)}>
            <SelectTrigger id="cfg-spec">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ESPECIALIDADES.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex justify-end border-t border-line pt-4">
          <Button type="submit" disabled={salvar.isPending || name.trim().length < 2}>
            {salvar.isPending ? "Salvando…" : "Salvar perfil"}
          </Button>
        </div>
      </div>
    </form>
  );
}
