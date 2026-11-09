# Sistema Inteligente de Geração de Escalas — Colégio Militar

Aplicação web completa para geração automática, auditoria e otimização das escalas de serviço semanais de um Colégio Militar.

O sistema utiliza **Otimização Combinatória Global (Algoritmo Húngaro / Kuhn-Munkres para Problema de Atribuição de Custo Mínimo — LSAP)** para distribuir os oficiais de maneira justa, equilibrada e transparente entre postos físicos e pelotões (com funções de comando), analisando o histórico completo de semanas anteriores.

---

## 🎖️ Características Principais

1. **Algoritmo de Otimização Combinatória (Kuhn-Munkres)**
   - Otimiza todas as vagas simultaneamente em $O(N^3)$ tempo determinístico, evitando armadilhas de decisões locais gulosas (greedy).
   - Equaciona custos matemáticos baseados em histórico, ociosidade, repetição e rotatividade de comando.

2. **Regras de Negócio Implementadas com Rigor Militar**
   - **Regra 1 (Não repetição de postos):** Evita ao máximo que o oficial tire o mesmo posto (ex: Guarita) ou comande o mesmo pelotão em semanas consecutivas ou com alta frequência histórica.
   - **Regra 2 (Prioridade por ociosidade):** Oficiais que estão há mais semanas sem participar recebem bônus de prioridade máxima para serem escalados.
   - **Regra 3 (Equilíbrio de carga):** Minimiza a variância e o desvio padrão do total acumulado de escalas entre todos os oficiais ativos.
   - **Regra 4 (Comando de Pelotões):** Histórico de comando **totalmente separado** do histórico de participação. Oficiais que **não comandaram na semana anterior** têm preferência forte para comandar; rotatividade contínua de comandantes.
   - **Regra 5 (Restrições Obrigatórias):** Oficiais inativos nunca são escalados; impedimentos individuais expressos são estritamente respeitados ($C = \infty$); 1 oficial por vaga por semana; vagas sem candidatos elegíveis são notificadas como **pendentes**.

3. **Interatividade e Bloqueios (Locks)**
   - Permite fixar oficiais em vagas com o botão de **Cadeado (Lock)**.
   - Botão **"Regerar mantendo bloqueados"** preserva as escolhas manuais e reotimiza as demais vagas.
   - Edição manual direta via seletores de oficiais com atualização imediata da lista de descanso.

4. **Persistência Confiável de Dados**
   - Gravação atômica em arquivo local (`data/database.json`) com backups automáticos timestamped em `data/backups/`.
   - Proteção contra sobrescrita acidental: aviso e confirmação em modal caso a semana já tenha sido gravada.
   - Importação e Exportação de backup completo em JSON.

5. **Modo Impressão Militar Oficial (Quadro de Serviço)**
   - Layout formal no padrão das Forças Armadas com brasão, cabeçalho ministerial, divisão clara entre Pelotões/Comandos e Postos Físicos, lista de folga e campos para visto do Comandante do Corpo de Alunos e Oficial de Dia.

---

## 🏛️ Estrutura do Projeto

```
escala-colegio-militar/
├── data/
│   ├── database.json              # Banco persistente com oficiais, postos, pelotões e histórico
│   └── backups/                   # Backups automáticos gerados a cada confirmação
├── server/
│   ├── index.js                   # API REST Express + Servidor estático
│   ├── storage.js                 # Camada de persistência atômica com backups
│   ├── defaultData.js             # 50 oficiais, 17 postos físicos e 20 pelotões padrão
│   ├── dev-runner.js              # Runner para desenvolvimento integrado
│   └── algorithm/
│       ├── hungarian.js           # Algoritmo de Kuhn-Munkres para Atribuição de Custo Mínimo
│       ├── costMatrix.js          # Construção da matriz de custo e regras 1 a 5
│       ├── historyMetrics.js      # Métricas acumuladas e separação comando vs serviço
│       ├── optimizer.js           # Orquestrador da geração semanal com locks e dummies
│       └── stats.js               # Análise de equidade, desvio padrão e Coeficiente de Gini
├── src/
│   ├── index.html                 # Ponto de entrada HTML
│   ├── main.jsx                   # Ponto de entrada React
│   ├── App.jsx                    # Container mestre com abas e navegação
│   ├── index.css                  # Estilização Tailwind e regras de impressão A4
│   ├── api.js                     # Cliente de API frontend
│   └── components/
│       ├── Navbar.jsx             # Barra de navegação e indicadores de prontidão
│       ├── DashboardTab.jsx       # Painel geral, KPIs e resumo da última escala
│       ├── SchedulerTab.jsx       # Gerador semanal, cadeados, overrides e alertas
│       ├── OfficersTab.jsx        # Cadastro, bulk import, status e restrições
│       ├── SlotsTab.jsx           # Gestão de postos físicos e pelotões
│       ├── HistoryTab.jsx         # Consulta e auditoria de semanas confirmadas
│       ├── StatisticsTab.jsx      # Gráficos de distribuição, histograma e Gini
│       ├── SettingsTab.jsx        # Ajuste fino de pesos e simulador em lote (sandbox)
│       └── PrintView.jsx          # Quadro de Serviço pronto para impressão militar
├── test/
│   ├── hungarian.test.js          # Testes unitários do algoritmo matemático
│   ├── optimizer.test.js          # Testes das 11 regras e cenários obrigatórios
│   └── multiweek.test.js          # Simulação de 6 semanas consecutivas completas
├── package.json
└── vite.config.js
```

---

## 🚀 Como Executar

### Pré-requisitos
- Node.js versão 18 ou superior.

### 1. Iniciar Aplicação em Produção (Recomendado)
```bash
npm start
```
Acesse a aplicação no seu navegador em:
👉 **http://localhost:3001**

### 2. Modo Desenvolvimento
```bash
npm run dev
```
Inicia simultaneamente o servidor backend com watch e o servidor Vite com HMR em `http://localhost:5173`.

### 3. Executar os Testes Automatizados
```bash
npm test
```
Executa a suíte de testes com `node:test`, cobrindo todos os requisitos e simulações do sistema.
