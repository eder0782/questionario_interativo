/* =========================================================
   Simulado Interativo — versao.js
   Histórico de versões exibido na janela "Sobre".
   A cada atualização: aumente "atual" e acrescente a nova
   versão no INÍCIO da lista "historico".
   Numeração: MAIOR.MENOR.CORREÇÃO
     - MAIOR: mudança grande, de estrutura;
     - MENOR: funcionalidade nova;
     - CORREÇÃO: ajuste ou correção pequena.
   ========================================================= */
window.SIMULADO_VERSAO = {
  atual: '2.5.0',
  historico: [
    {
      versao: '2.5.0',
      data: '2026-11-16',
      titulo: 'Destaques no texto e janela "Sobre"',
      itens: [
        'Palavras em **negrito** e *itálico* aparecem destacadas no enunciado, nas alternativas, no texto-base e no gabarito comentado.',
        'Ao colar do Word ou do Google Docs, o negrito, o itálico e o sublinhado são convertidos sozinhos.',
        'Número da questão ou letra da alternativa em negrito continuam sendo reconhecidos.',
        'Nova janela "Sobre", com a versão atual e o histórico de melhorias.'
      ]
    },
    {
      versao: '2.4.0',
      data: '2026-11-12',
      titulo: 'Histórico: marcações e ordenação',
      itens: [
        'Nova coluna 🎲+🚩 com a soma das questões marcadas como chute e para revisar.',
        'Ordenação por clique no título da coluna (crescente e depois decrescente), com seta indicando a direção.',
        'O histórico abre ordenado por data, com os mais recentes primeiro.'
      ]
    },
    {
      versao: '2.3.1',
      data: '2026-11-10',
      titulo: 'Paginação',
      itens: ['Opção de 5 simulados por página, que passou a ser o padrão (também 10, 20 e 50).']
    },
    {
      versao: '2.3.0',
      data: '2026-11-07',
      titulo: 'Histórico: renomear, pesquisar e paginar',
      itens: [
        'Renomear um simulado direto na linha do histórico (✏️).',
        'Pesquisa por nome, módulo ou data, sem diferenciar acentos e maiúsculas.',
        'Paginação do histórico.'
      ]
    },
    {
      versao: '2.2.0',
      data: '2026-11-06',
      titulo: 'Login com Google e sincronização',
      itens: [
        'Entrar com Google para guardar os simulados na nuvem (Firebase) e usar no celular e no computador.',
        'Funciona offline e sincroniza quando a conexão volta.',
        'No primeiro login, oferece enviar o histórico do navegador para a conta.'
      ]
    },
    {
      versao: '2.1.0',
      data: '2026-11-06',
      titulo: 'Detalhes dos simulados no histórico',
      itens: [
        'Clicar num simulado do histórico abre o resultado completo, com filtros e opção de refazer.',
        'Excluir um simulado do histórico (🗑).'
      ]
    },
    {
      versao: '2.0.1',
      data: '2026-11-04',
      titulo: 'Leitura do texto-base',
      itens: [
        'Reconhece cabeçalhos como "questões de 1 a 8", "questões 1 e 2" e, em inglês, "questions 1 through 6".'
      ]
    },
    {
      versao: '2.0.0',
      data: '2026-11-04',
      titulo: 'Nova versão do app',
      itens: [
        'Itens Certo/Errado, alternativas no formato A) ou a), gabarito em vários formatos e questões anuladas.',
        'Módulos: resultado por assunto e números de questão repetidos entre módulos.',
        'Modo Prova e modo Estudo (correção a cada questão).',
        'Marcar 🎲 chute e 🚩 revisar, riscar alternativas, cronômetro com meta e pausa.',
        'Embaralhar questões e alternativas; mapa de questões; refazer só as erradas.',
        'Progresso salvo automaticamente, histórico, backup, tema escuro e atalhos de teclado.'
      ]
    },
    {
      versao: '1.0.0',
      data: null,
      titulo: 'Versão original',
      itens: ['Importação de questões e gabarito comentado, simulado e resultado com gabarito.']
    }
  ]
};
