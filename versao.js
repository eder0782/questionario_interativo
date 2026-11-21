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
  atual: '2.6.3',
  historico: [
    {
      versao: '2.6.3',
      data: '2026-11-21',
      titulo: 'Correção em questões de SQL',
      itens: [
        'Expressões como COUNT(*) não são mais confundidas com marcação de itálico: o trecho entre dois COUNT(*) na mesma linha deixava de aparecer normal.'
      ]
    },
    {
      versao: '2.6.2',
      data: '2026-11-16',
      titulo: 'Menu de ações no histórico',
      itens: [
        'As ações de cada simulado (Ver detalhes/Ver evolução, Renomear e Excluir) agora ficam num botão "⋯", liberando espaço na tabela.',
        'Clicar na linha continua abrindo os detalhes (ou a evolução, quando há várias tentativas).',
        'O menu pode ser usado pelo teclado: setas para navegar, Enter para escolher e Esc para fechar.'
      ]
    },
    {
      versao: '2.6.1',
      data: '2026-11-16',
      titulo: 'Histórico mais compacto',
      itens: [
        'Linhas do histórico com altura fixa: cada simulado ocupa uma única linha.',
        'Nomes longos terminam em "…"; o nome completo aparece ao passar o mouse.',
        'Tela inicial e tela de evolução mais largas em telas grandes, sem barra de rolagem no histórico.',
        'No celular, o histórico mostra só o essencial: data, simulado, tentativas, acertos e nota.'
      ]
    },
    {
      versao: '2.6.0',
      data: '2026-11-16',
      titulo: 'Tentativas, revisões e evolução',
      itens: [
        '"Refazer tudo" grava uma nova tentativa do mesmo simulado; as notas anteriores ficam guardadas para comparar.',
        '"Revisar erradas" grava uma revisão ligada ao simulado, comparada questão a questão, sem entrar na evolução da nota.',
        'Ao importar de novo um simulado já feito, o app oferece registrar como nova tentativa.',
        'Histórico com uma linha por simulado: coluna Tentativas e nota da última com a evolução (ex.: 80% → 90% ▲).',
        'Nova tela de evolução: gráfico das notas, lista de tentativas e matriz questão × tentativa.',
        'Filtros da matriz: errou sempre, corrigiu, regrediu e sempre acertou; exportar as que errou sempre para o caderno de erros.',
        'Ao terminar uma nova tentativa, o resultado mostra a comparação com a anterior (pontos, corrigidas e novas erradas).'
      ]
    },
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
