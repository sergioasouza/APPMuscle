export const metadata = {
  title: "Termos de uso",
};

export default function TermsPage() {
  return (
    <main className="min-h-dvh bg-zinc-50 px-4 py-10 text-zinc-900 dark:bg-zinc-950 dark:text-white">
      <div className="mx-auto max-w-3xl rounded-[2rem] border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm uppercase tracking-[0.25em] text-violet-500">
          GymTracker
        </p>
        <h1 className="mt-4 text-4xl font-black tracking-tight">
          Termos de uso
        </h1>
        <div className="mt-8 space-y-6 text-sm leading-7 text-zinc-600 dark:text-zinc-300">
          <p>
            O GymTracker e um aplicativo de acompanhamento de treino e organizacao
            de rotina fisica. Ele nao substitui avaliacao medica, nutricional ou
            orientacao profissional individualizada.
          </p>
          <p>
            O acesso e pessoal e pode ser suspenso quando houver inadimplencia,
            uso indevido da conta ou encerramento do servico. O pagamento da
            mensalidade e tratado fora do app e a renovacao de acesso e manual.
          </p>
          <p>
            O usuario e responsavel por conferir as informacoes registradas,
            preservar sua senha e utilizar o produto de maneira compativel com sua
            propria condicao fisica.
          </p>
          <p>
            O uso continuado do GymTracker representa concordancia com estes termos.
          </p>
        </div>
      </div>
    </main>
  );
}
