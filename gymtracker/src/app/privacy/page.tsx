export const metadata = {
  title: "Privacidade",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-dvh bg-zinc-50 px-4 py-10 text-zinc-900 dark:bg-zinc-950 dark:text-white">
      <div className="mx-auto max-w-3xl rounded-[2rem] border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm uppercase tracking-[0.25em] text-violet-500">
          GymTracker
        </p>
        <h1 className="mt-4 text-4xl font-black tracking-tight">Privacidade</h1>
        <div className="mt-8 space-y-6 text-sm leading-7 text-zinc-600 dark:text-zinc-300">
          <p>
            O GymTracker coleta os dados necessarios para operar o produto:
            identificacao da conta, treinos cadastrados, historico de sessoes,
            metricas corporais e preferencias basicas do aplicativo.
          </p>
          <p>
            Esses dados sao usados exclusivamente para permitir o uso do app,
            acompanhar evolucao fisica e administrar o acesso da conta. Nao existe
            venda de dados para terceiros.
          </p>
          <p>
            O pagamento e a liberacao de acesso sao tratados manualmente fora do
            app. Caso voce queira correcao ou exclusao dos seus dados, o atendimento
            e feito por solicitacao direta ao responsavel pelo servico.
          </p>
          <p>
            Ao usar o GymTracker, voce concorda com esse tratamento minimo de dados
            para a operacao do produto.
          </p>
        </div>
      </div>
    </main>
  );
}
