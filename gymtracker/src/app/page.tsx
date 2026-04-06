import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  getOptionalAuthenticatedAppContext,
  resolvePostAuthDestination,
} from '@/lib/access-control'

const whatsappUrl =
  process.env.NEXT_PUBLIC_CONTACT_WHATSAPP_URL ??
  'https://wa.me/5500000000000?text=Quero%20conhecer%20o%20GymTracker'
const contactEmail =
  process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? 'contato@gymtracker.app'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const context = await getOptionalAuthenticatedAppContext()

  if (context.profile) {
    redirect(resolvePostAuthDestination(context.profile, context.todayISO))
  }

  return (
    <main className="min-h-dvh bg-[radial-gradient(circle_at_top,_rgba(139,92,246,0.18),_transparent_35%),linear-gradient(180deg,_#09090b_0%,_#111827_100%)] text-white">
      <section className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-6 pb-16 pt-8 sm:px-10 lg:px-12">
        <header className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-violet-300/80">
              GymTracker
            </p>
            <p className="mt-2 max-w-xl text-sm text-zinc-300">
              Controle de treinos para alunos acompanhados de perto, com agenda,
              calendário, métricas corporais e gestão simples de acesso.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-zinc-100 transition hover:border-violet-400/60 hover:bg-white/5"
            >
              Falar no WhatsApp
            </a>
            <Link
              href="/login"
              className="rounded-full bg-violet-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-400"
            >
              Entrar
            </Link>
          </div>
        </header>

        <div className="grid flex-1 items-center gap-12 py-14 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <div className="inline-flex items-center rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-emerald-300">
              App pronto para acompanhamento real
            </div>
            <h1 className="mt-6 max-w-3xl text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
              Um tracker de treino feito para usar todo dia, e não para ficar
              abandonado.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-300">
              O GymTracker organiza agenda semanal com rotações, registra treino do
              dia, cardio, exercícios pulados, histórico em calendário e evolução
              corporal em gráficos fáceis de acompanhar.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200"
              >
                Quero conhecer o app
              </a>
              <a
                href={`mailto:${contactEmail}`}
                className="rounded-2xl border border-white/15 px-5 py-3 text-sm font-semibold text-white transition hover:border-violet-400/60 hover:bg-white/5"
              >
                {contactEmail}
              </a>
            </div>

            <dl className="mt-10 grid gap-4 sm:grid-cols-3">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
                <dt className="text-xs uppercase tracking-[0.2em] text-zinc-400">
                  Treino do dia
                </dt>
                <dd className="mt-3 text-2xl font-bold text-white">
                  Series, cardio e observacoes
                </dd>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
                <dt className="text-xs uppercase tracking-[0.2em] text-zinc-400">
                  Agenda inteligente
                </dt>
                <dd className="mt-3 text-2xl font-bold text-white">
                  Rotacoes, remarcacao e aderencia
                </dd>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
                <dt className="text-xs uppercase tracking-[0.2em] text-zinc-400">
                  Evolucao corporal
                </dt>
                <dd className="mt-3 text-2xl font-bold text-white">
                  Graficos e correlacao
                </dd>
              </div>
            </dl>
          </div>

          <div className="grid gap-4">
            <div className="rounded-[2rem] border border-white/10 bg-zinc-950/70 p-5 shadow-2xl shadow-violet-900/20 backdrop-blur">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-violet-300">
                    Hoje
                  </p>
                  <h2 className="mt-1 text-2xl font-bold text-white">
                    Upper 3 + cardio pos-treino
                  </h2>
                </div>
                <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-semibold text-emerald-300">
                  5 de 6 itens concluidos
                </span>
              </div>
              <div className="mt-5 space-y-3">
                {[
                  'Supino Inclinado no Smith - 4 series',
                  'Puxada Neutra - 4 series',
                  'Elevacao Lateral - pulado',
                  'Esteira intervalada - 30 min / 3,8 km',
                ].map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-white/5 bg-white/5 px-4 py-3 text-sm text-zinc-200"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 backdrop-blur">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">
                  Calendario
                </p>
                <p className="mt-3 text-3xl font-bold text-white">86%</p>
                <p className="mt-2 text-sm text-zinc-300">
                  de aderencia semanal com volume consolidado e sessoes remarcadas.
                </p>
              </div>
              <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 backdrop-blur">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">
                  Metricas corporais
                </p>
                <p className="mt-3 text-3xl font-bold text-white">+12 sessoes</p>
                <p className="mt-2 text-sm text-zinc-300">
                  na janela de correlacao entre composicao corporal e performance.
                </p>
              </div>
            </div>
          </div>
        </div>

        <section className="grid gap-4 rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">
              Perguntas rapidas
            </p>
            <div className="mt-4 space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-white">
                  O app tem cadastro aberto?
                </h3>
                <p className="mt-1 text-sm text-zinc-300">
                  Nao. O acesso e liberado manualmente para cada aluno, com
                  acompanhamento e suporte direto.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">
                  Como funciona o pagamento?
                </h3>
                <p className="mt-1 text-sm text-zinc-300">
                  O pagamento e tratado fora do app. Depois, o acesso e liberado ou
                  renovado de forma manual no painel administrativo.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">
                  Da para acompanhar cardio e medidas corporais?
                </h3>
                <p className="mt-1 text-sm text-zinc-300">
                  Sim. O treino do dia aceita cardio com duracao, distancia e
                  intervalos, e o perfil concentra graficos e correlacoes.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-violet-400/20 bg-violet-500/10 p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-violet-200/80">
              Proximo passo
            </p>
            <h3 className="mt-3 text-2xl font-bold text-white">
              Quer apresentar o GymTracker para um aluno?
            </h3>
            <p className="mt-3 text-sm leading-7 text-violet-100/85">
              Me chama e eu te explico como funciona a liberacao de conta, o fluxo
              de pagamento e a operacao do painel admin.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl bg-white px-4 py-3 text-center text-sm font-semibold text-zinc-950 transition hover:bg-zinc-100"
              >
                Falar agora
              </a>
              <Link
                href="/login"
                className="rounded-2xl border border-white/15 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-white/5"
              >
                Ja tenho acesso
              </Link>
            </div>
          </div>
        </section>

        <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-6 text-sm text-zinc-400">
          <p>GymTracker</p>
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/privacy" className="transition hover:text-white">
              Privacidade
            </Link>
            <Link href="/terms" className="transition hover:text-white">
              Termos
            </Link>
            <Link href="/login" className="transition hover:text-white">
              Login
            </Link>
          </div>
        </footer>
      </section>
    </main>
  )
}
