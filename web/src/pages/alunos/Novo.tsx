import { useCallback, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Copy } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { FORM_VAZIO, campoDoErro, payloadDoForm, semPrefixo, type FormAluno } from "@/lib/alunos";
import { PageHeader } from "@/components/PageHeader";
import { FormActions, FormSection, Campo, useAvisoSaida } from "@/components/Form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CamposClinicos, CamposIdentidade, CamposPreferencias, ErroForm, type Erros } from "@/components/alunos/CamposAluno";
import { copiar } from "@/components/alunos/copiar";
import { CHAVE_ALUNOS, CHAVE_EQUIPE, type RespostaCadastro, type RespostaEquipe } from "./dados";

type Modo = "completo" | "link";

/** Cadastro: fluxo longo, por isso página própria. Dois modos: completo agora, ou link para o aluno preencher. */
export default function NovoAluno() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [modo, setModo] = useState<Modo>("completo");
  const [f, setF] = useState<FormAluno>(FORM_VAZIO);
  const [sujo, setSujo] = useState(false);
  const [responsavelId, setResponsavelId] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [erros, setErros] = useState<Erros>({});
  const [linkGerado, setLinkGerado] = useState<{ url: string; nome: string; id: string } | null>(null);
  const set = useCallback((p: Partial<FormAluno>) => {
    setF((x) => ({ ...x, ...p }));
    setSujo(true);
  }, []);
  useAvisoSaida(sujo && !linkGerado);

  // Seletor de responsável só para o dono da clínica; para os outros `equipe` vem vazio.
  const equipe = useQuery({ queryKey: CHAVE_EQUIPE, queryFn: () => api<RespostaEquipe>("/alunos/equipe") });
  const time = equipe.data?.equipe ?? [];

  const criar = useMutation({
    mutationFn: () =>
      api<RespostaCadastro>("/alunos", {
        method: "POST",
        json:
          modo === "link"
            ? { mode: "link", name: f.name.trim(), email: f.email.trim(), birthDate: f.birthDate, responsavelId: responsavelId || undefined }
            : { mode: "completo", ...payloadDoForm(f), responsavelId: responsavelId || undefined },
      }),
    onSuccess: (r) => {
      setSujo(false);
      void qc.invalidateQueries({ queryKey: CHAVE_ALUNOS });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      void qc.invalidateQueries({ queryKey: ["sessao"] });
      if (r.mode === "link") {
        setLinkGerado({ url: r.fillUrl, nome: r.studentName, id: r.id });
        toast.success("Aluno criado. Agora envie o link.");
      } else {
        toast.success("Aluno cadastrado.");
        navigate(`/alunos/${r.id}`);
      }
    },
    onError: (e: Error) => {
      const campo = campoDoErro(e.message);
      if (campo) setErros({ [campo]: semPrefixo(e.message) });
      else setErro(e.message);
      toast.error(`Não consegui cadastrar: ${semPrefixo(e.message)}`);
    },
  });

  function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setErros({});
    criar.mutate();
  }

  const voltar = (
    <Button variant="ghost" asChild>
      <Link to="/alunos">
        <ArrowLeft aria-hidden /> Alunos
      </Link>
    </Button>
  );

  if (linkGerado) {
    return (
      <div className="mx-auto max-w-3xl animate-soft-fade">
        <PageHeader eyebrow="Cadastro" title="Novo aluno" actions={voltar} />
        <section className="rounded-lg border border-line bg-bg-elevated p-5 shadow-card" aria-labelledby="link-ok">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="size-5 text-positive" aria-hidden />
            <h2 id="link-ok" className="text-h6 font-medium">
              {linkGerado.nome} foi criado
            </h2>
          </div>
          <p className="mt-2 text-body text-ink-mute">
            Mandei o link por e-mail. Se preferir, copie e envie pelo WhatsApp: o aluno preenche o perfil clínico, os objetivos e as preferências, e
            a ficha se completa sozinha.
          </p>
          <Label htmlFor="link-preencher" className="mt-4 block">
            Link de preenchimento
          </Label>
          <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
            <Input id="link-preencher" readOnly value={linkGerado.url} onFocus={(e) => e.currentTarget.select()} className="font-mono text-caption" />
            <Button onClick={() => copiar(linkGerado.url, "Link copiado.")}>
              <Copy aria-hidden /> Copiar link
            </Button>
          </div>
          <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
            <Button asChild>
              <Link to={`/alunos/${linkGerado.id}`}>Abrir ficha</Link>
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setLinkGerado(null);
                setF(FORM_VAZIO);
                setSujo(false);
              }}
            >
              Cadastrar outro
            </Button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow="Cadastro" title="Novo aluno" description="Comece pelo básico. O risco cardiovascular sai do escore SBC, aqui mesmo." actions={voltar} />
      <form onSubmit={enviar} className="space-y-6">
        <div className="space-y-1.5">
          <p id="modo-rotulo" className="eyebrow">
            Quem preenche
          </p>
          <ToggleGroup
            type="single"
            variant="outline"
            value={modo}
            onValueChange={(v) => v && setModo(v as Modo)}
            aria-labelledby="modo-rotulo"
            className="grid grid-cols-2"
          >
            <ToggleGroupItem value="completo" className="h-auto flex-col items-start py-2.5 text-left data-[state=on]:border-brand/50 data-[state=on]:bg-brand-soft">
              <span className="text-body font-medium">Eu preencho agora</span>
              <span className="text-caption font-normal text-ink-mute">Cadastro completo</span>
            </ToggleGroupItem>
            <ToggleGroupItem value="link" className="h-auto flex-col items-start py-2.5 text-left data-[state=on]:border-brand/50 data-[state=on]:bg-brand-soft">
              <span className="text-body font-medium">O aluno preenche</span>
              <span className="text-caption font-normal text-ink-mute">Envio um link para ele</span>
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <ErroForm msg={erro} />

        {time.length > 1 && (
          <FormSection titulo="Responsável">
            <Campo id="responsavel" label="Profissional responsável" dica="Quem atende o aluno e enxerga a ficha clínica.">
              <Select value={responsavelId || equipe.data?.euId || ""} onValueChange={setResponsavelId}>
                <SelectTrigger id="responsavel" aria-describedby="responsavel-dica">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {time.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                      {p.id === equipe.data?.euId ? " (você)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>
          </FormSection>
        )}

        <CamposIdentidade f={f} set={set} erros={erros} link={modo === "link"} />
        {modo === "completo" && (
          <>
            <CamposClinicos f={f} set={set} erros={erros} risco="calculadora" />
            <CamposPreferencias f={f} set={set} erros={erros} />
          </>
        )}

        <FormActions enviando={criar.isPending} rotulo={modo === "link" ? "Criar e gerar link" : "Cadastrar aluno"} onCancelar={() => navigate("/alunos")} />
      </form>
    </div>
  );
}
