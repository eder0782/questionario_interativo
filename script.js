/* =========================================================
   Simulado Interativo — script.js (interface)
   Depende de: parser.js (SimuladoParser) e storage.js (SimuladoStorage)
   ========================================================= */
(function () {
  'use strict';

  const P = window.SimuladoParser;
  const { Repositorio: Repo, LocalStorageAdapter } = window.SimuladoStorage;

  /* =========================================================
     MÓDULO 1 — UTILIDADES
     ========================================================= */
  const $ = id => document.getElementById(id);
  const LETRAS = 'ABCDE';

  // Escapa HTML: texto como "<script>" ou "x < y" aparece literalmente
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const uid = () => (window.crypto && crypto.randomUUID)
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2);

  const clonar = obj => JSON.parse(JSON.stringify(obj));

  const embaralhar = arr => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const fmtTempo = seg => {
    seg = Math.max(0, Math.floor(seg || 0));
    const h = Math.floor(seg / 3600), m = Math.floor(seg % 3600 / 60), s = seg % 60;
    const mm = String(m).padStart(2, '0'), ss = String(s).padStart(2, '0');
    return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  };

  const fmtData = iso => {
    try {
      return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch (e) { return iso; }
  };

  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

  const listaCurta = (arr, max = 12) =>
    arr.length <= max ? arr.join(', ') : `${arr.slice(0, max).join(', ')} e mais ${arr.length - max}`;

  function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }

  function toast(msg) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => el.classList.remove('show'), 2800);
  }

  function baixarArquivo(nome, conteudo, tipo = 'text/plain;charset=utf-8') {
    const blob = new Blob([conteudo], { type: tipo });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = nome;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const paragrafosHtml = texto => String(texto || '').split(/\n{2,}/).map(p => `<p>${esc(p)}</p>`).join('');

  /* =========================================================
     MÓDULO 2 — ESTADO E ELEMENTOS
     ========================================================= */
  const app = {
    prefs: {},
    sessao: null,           // simulado atual (é o que vai para o banco)
    sessaoPendente: null,   // sessão em andamento encontrada no armazenamento
    pausado: false,
    analise: null,          // resultado do parser na tela de importação
    resumo: null,           // resultado calculado ao finalizar
    filtro: 'todas'
  };

  const IDS = [
    'app-container', 'step-import', 'step-quiz', 'step-result',
    'resume-card', 'resume-info', 'btn-resume', 'btn-discard',
    'input-questions', 'file-questions', 'status-questions',
    'input-gabarito', 'file-gabarito', 'status-gabarito', 'import-warnings',
    'input-title', 'opt-meta', 'opt-shuffle-q', 'opt-shuffle-alt',
    'btn-example', 'btn-clear', 'btn-start',
    'history-list', 'hist-toolbar', 'hist-search', 'hist-per-page', 'hist-pagination', 'btn-export-backup', 'file-backup', 'btn-clear-history', 'storage-note',
    'btn-help', 'btn-theme',
    'account-area', 'btn-login', 'account-user', 'account-photo', 'account-name', 'btn-copy-uid', 'btn-logout',
    'quiz-layout', 'text-side', 'text-side-title', 'text-side-body',
    'question-card', 'progress-bar', 'progress-fill', 'question-counter', 'question-origin',
    'timer-total', 'timer-question', 'question-score', 'btn-toggle-score',
    'btn-flag-review', 'btn-flag-guess', 'btn-pause',
    'comando-container', 'text-base-container', 'text-base-label', 'btn-show-text',
    'question-text', 'options-container', 'feedback',
    'btn-quit', 'btn-prev', 'btn-next', 'btn-finish',
    'pause-overlay', 'btn-unpause', 'map-pending', 'question-map',
    'result-title', 'score-summary', 'result-extra', 'module-table-wrap',
    'btn-back-history', 'result-date', 'btn-redo-all', 'btn-redo-wrong', 'btn-redo-wrong-guess', 'btn-new',
    'btn-copy-result', 'btn-download-result', 'result-filters', 'shuffle-note', 'result-list',
    'text-modal', 'modal-text-title', 'modal-text-body', 'help-modal'
  ];
  const els = {};
  IDS.forEach(id => { els[id.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = $(id); });

  /* =========================================================
     MÓDULO 3 — PERSISTÊNCIA (via Repositorio)
     ========================================================= */
  let tSalvar = null;

  // Agrupa várias mudanças seguidas (cliques, cronômetro) em uma gravação
  function agendarSalvamento() {
    if (tSalvar) return;
    const intervalo = (Repo.adapter && Repo.adapter.intervaloSalvamento) || 1500;
    tSalvar = setTimeout(() => { tSalvar = null; salvarAgora(); }, intervalo);
  }

  async function salvarAgora() {
    if (tSalvar) { clearTimeout(tSalvar); tSalvar = null; }
    const s = app.sessao;
    if (!s || s.status !== 'andamento') return;
    try {
      await Repo.salvarSessao(s);
    } catch (e) {
      console.error(e);
      toast('⚠ Não foi possível salvar o progresso (armazenamento cheio?).');
    }
  }

  const salvarPreferencias = debounce(async () => {
    try { await Repo.salvarPreferencias(app.prefs); } catch (e) { console.error(e); }
  }, 600);

  document.addEventListener('visibilitychange', () => { if (document.hidden) salvarAgora(); });
  window.addEventListener('pagehide', () => { salvarAgora(); });

  /* =========================================================
     MÓDULO 4 — TEMA
     ========================================================= */
  function aplicarTema(tema) {
    document.documentElement.dataset.theme = tema;
    els.btnTheme.textContent = tema === 'escuro' ? '☀️' : '🌙';
    els.btnTheme.title = tema === 'escuro' ? 'Usar tema claro' : 'Usar tema escuro';
  }
  els.btnTheme.addEventListener('click', () => {
    const novo = document.documentElement.dataset.theme === 'escuro' ? 'claro' : 'escuro';
    aplicarTema(novo);
    app.prefs.tema = novo;
    salvarPreferencias();
  });

  /* =========================================================
     MÓDULO 5 — IMPORTAÇÃO E VALIDAÇÃO
     ========================================================= */
  function setStatus(el, tipo, texto) {
    el.className = 'status ' + tipo;
    el.textContent = texto;
  }

  function atualizarStatusImportacao() {
    const tq = els.inputQuestions.value;
    const tg = els.inputGabarito.value;
    const a = P.montarSimulado(tq, tg);
    app.analise = a;
    const qs = a.questoes;

    if (!tq.trim()) {
      setStatus(els.statusQuestions, 'empty', 'Nenhuma questão importada.');
    } else if (qs.length) {
      const me = qs.filter(q => q.tipo === 'multipla').length;
      const ce = qs.length - me;
      const tb = qs.filter(q => q.textoBase).length;
      const mods = new Set(qs.map(q => q.modulo).filter(Boolean)).size;
      const partes = [];
      if (me && ce) partes.push(`${me} múltipla escolha, ${ce} certo/errado`);
      else if (ce) partes.push('certo/errado');
      if (tb) partes.push(`${tb} com texto-base`);
      if (mods) partes.push(plural(mods, 'módulo', 'módulos'));
      setStatus(els.statusQuestions, 'ok',
        `✓ ${plural(qs.length, 'questão detectada', 'questões detectadas')}` + (partes.length ? ` — ${partes.join(' · ')}` : ''));
    } else {
      setStatus(els.statusQuestions, 'error', '✗ Não foi possível identificar questões. Verifique o formato.');
    }

    if (!tg.trim()) {
      setStatus(els.statusGabarito, 'empty', 'Nenhum gabarito importado.');
    } else if (a.totalGabarito) {
      setStatus(els.statusGabarito, 'ok', `✓ ${plural(a.totalGabarito, 'resposta', 'respostas')} no gabarito.`);
    } else {
      setStatus(els.statusGabarito, 'error', '✗ Não foi possível identificar o gabarito. Verifique o formato.');
    }

    renderizarAvisos(a, tq, tg);
    els.btnStart.disabled = !(qs.length && qs.some(q => q.gabarito));
  }

  function renderizarAvisos(a, tq, tg) {
    const av = a.avisos;
    const itens = [];
    if (tq.trim() && tg.trim()) {
      if (av.semGabarito.length) itens.push(`<li>Sem gabarito: <strong>${esc(listaCurta(av.semGabarito))}</strong> — ficarão fora da contagem.</li>`);
      if (av.gabaritoSemQuestao.length) itens.push(`<li>No gabarito, mas sem questão correspondente: <strong>${esc(listaCurta(av.gabaritoSemQuestao))}</strong>.</li>`);
      if (av.letraInvalida.length) itens.push(`<li>Gabarito aponta alternativa que não existe: <strong>${esc(listaCurta(av.letraInvalida))}</strong>.</li>`);
    }
    if (av.descartadas) itens.push(`<li>${plural(av.descartadas, 'bloco numerado foi ignorado', 'blocos numerados foram ignorados')} por não ter alternativas reconhecíveis nem gabarito Certo/Errado.</li>`);
    if (av.numerosRepetidos && a.questoes.length) itens.push('<li class="info">Há números de questão repetidos (ex.: módulos que recomeçam em 1). Eles são pareados com o gabarito pela ordem em que aparecem.</li>');

    if (!itens.length) { els.importWarnings.classList.add('hidden'); return; }
    els.importWarnings.innerHTML = `<h2>⚠ Confira antes de começar</h2><ul>${itens.join('')}</ul>`;
    els.importWarnings.classList.remove('hidden');
  }

  const salvarRascunho = debounce(() => {
    app.prefs.rascunho = { questoes: els.inputQuestions.value, gabarito: els.inputGabarito.value };
    salvarPreferencias();
  }, 800);

  const analisarDepois = debounce(atualizarStatusImportacao, 250);
  [els.inputQuestions, els.inputGabarito].forEach(ta => {
    ta.addEventListener('input', () => { analisarDepois(); salvarRascunho(); });
    // Arrastar e soltar arquivo .txt
    ta.addEventListener('dragover', e => { e.preventDefault(); ta.classList.add('drag-over'); });
    ta.addEventListener('dragleave', () => ta.classList.remove('drag-over'));
    ta.addEventListener('drop', async e => {
      ta.classList.remove('drag-over');
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (!f) return; // texto arrastado: comportamento padrão
      e.preventDefault();
      ta.value = await f.text();
      atualizarStatusImportacao(); salvarRascunho();
    });
  });

  function ligarArquivo(input, textarea) {
    input.addEventListener('change', async () => {
      const f = input.files[0];
      if (!f) return;
      textarea.value = await f.text();
      input.value = '';
      atualizarStatusImportacao(); salvarRascunho();
    });
  }
  ligarArquivo(els.fileQuestions, els.inputQuestions);
  ligarArquivo(els.fileGabarito, els.inputGabarito);

  // <label> com input file escondido: Enter/Espaço abrem o seletor
  document.querySelectorAll('.btn-file').forEach(lbl => {
    lbl.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); lbl.querySelector('input').click(); }
    });
  });

  /* Exemplo */
  const EX_Q = `MÓDULO 1 — Língua Portuguesa
Texto para as questões 1 a 2:
"A adoção de inteligência artificial em processos seletivos públicos tem crescido. Ainda que a tecnologia traga ganhos de eficiência, especialistas alertam para riscos de vieses algorítmicos, que podem reproduzir desigualdades já existentes."
1. De acordo com o texto, é correto afirmar que: (A) A IA elimina totalmente os vieses. (B) O uso de IA tem diminuído. (C) A eficiência da IA vem acompanhada de riscos que exigem monitoramento. (D) As auditorias já eliminaram os riscos. (E) O texto defende o fim do uso de IA.
2. A expressão "ainda que" estabelece relação de: (A) causa (B) conclusão (C) concessão (D) finalidade (E) condição

MÓDULO 2 — Tecnologia da Informação
1. Em HTML, a tag usada para incluir código JavaScript em uma página é:
a) <link>
b) <script>
c) <js>
d) <code>
e) <style>
Julgue os itens a seguir, acerca de bancos de dados relacionais.
2. A chave primária de uma tabela pode conter valores nulos, desde que não se repitam.
3. Uma chave estrangeira referencia a chave primária (ou candidata) de outra tabela, garantindo a integridade referencial.`;

  const EX_G = `MÓDULO 1
1. C — O texto afirma "ganhos de eficiência" e, ao mesmo tempo, aponta "riscos".
2. C — "Ainda que" introduz oração concessiva.
MÓDULO 2
1. B — A tag <script> incorpora ou referencia código JavaScript.
2. Errado — A chave primária não admite valores nulos (integridade de entidade).
3. Certo — É exatamente o papel da chave estrangeira.`;

  els.btnExample.addEventListener('click', () => {
    els.inputQuestions.value = EX_Q;
    els.inputGabarito.value = EX_G;
    atualizarStatusImportacao(); salvarRascunho();
  });

  els.btnClear.addEventListener('click', () => {
    if ((els.inputQuestions.value || els.inputGabarito.value) && !confirm('Limpar as questões e o gabarito colados?')) return;
    els.inputQuestions.value = '';
    els.inputGabarito.value = '';
    els.inputTitle.value = '';
    atualizarStatusImportacao(); salvarRascunho();
  });

  /* =========================================================
     MÓDULO 6 — CONFIGURAÇÃO E INÍCIO
     ========================================================= */
  function lerConfig() {
    const modo = (document.querySelector('input[name="modo"]:checked') || {}).value || 'prova';
    const meta = parseFloat(els.optMeta.value);
    return {
      modo,
      embaralharQuestoes: els.optShuffleQ.checked,
      embaralharAlternativas: els.optShuffleAlt.checked,
      metaSegundos: isFinite(meta) && meta > 0 ? Math.round(meta * 60) : 0
    };
  }

  function aplicarConfigNaTela(c) {
    if (!c) return;
    const r = document.querySelector(`input[name="modo"][value="${c.modo}"]`);
    if (r) r.checked = true;
    els.optShuffleQ.checked = !!c.embaralharQuestoes;
    els.optShuffleAlt.checked = !!c.embaralharAlternativas;
    els.optMeta.value = c.metaSegundos ? c.metaSegundos / 60 : 0;
  }

  [els.optMeta, els.optShuffleQ, els.optShuffleAlt, ...document.querySelectorAll('input[name="modo"]')]
    .forEach(el => el.addEventListener('change', () => { app.prefs.ultimaConfig = lerConfig(); salvarPreferencias(); }));

  function tituloPadrao(questoes) {
    const mods = [...new Set(questoes.map(q => q.modulo).filter(Boolean))];
    if (mods.length === 1) return mods[0];
    if (mods.length > 1) return `${mods[0]} + ${mods.length - 1}`;
    return `Simulado de ${fmtData(new Date().toISOString())}`;
  }

  async function iniciarSimulado(questoes, { titulo, config }) {
    const lista = config.embaralharQuestoes ? embaralhar(questoes) : questoes.slice();
    const ordemAlt = {};
    if (config.embaralharAlternativas) {
      lista.forEach(q => {
        if (q.tipo === 'multipla') ordemAlt[q.key] = embaralhar(LETRAS.split('').filter(l => q.alternativas[l]));
      });
    }
    // Modelo do documento salvo — tudo JSON puro, pronto para Firestore
    app.sessao = {
      id: uid(),
      status: 'andamento',
      criadoEm: new Date().toISOString(),
      titulo,
      config,
      questoes: lista,
      ordemAlt,
      indiceAtual: 0,
      respostas: {},    // { [key]: letra original }
      marcacoes: {},    // { [key]: { revisar, chute } }
      riscadas: {},     // { [key]: [letras] }
      tempos: {},       // { [key]: segundos }
      tempoTotal: 0,
      acertosVisivel: config.modo === 'estudo'
    };
    app.pausado = false;
    await salvarAgora();
    mostrarEtapa('quiz');
    renderizarQuestao();
    iniciarRelogio();
  }

  els.btnStart.addEventListener('click', async () => {
    atualizarStatusImportacao();
    const a = app.analise;
    if (!a || !a.questoes.length) { toast('Nenhuma questão válida encontrada.'); return; }
    if (app.sessaoPendente) {
      if (!confirm('Há um simulado em andamento salvo. Iniciar um novo vai descartá-lo. Continuar?')) return;
      await Repo.excluirSessoesEmAndamento();
      app.sessaoPendente = null;
    }
    const config = lerConfig();
    app.prefs.ultimaConfig = config;
    salvarPreferencias();
    const titulo = els.inputTitle.value.trim() || tituloPadrao(a.questoes);
    iniciarSimulado(clonar(a.questoes), { titulo, config });
  });

  /* Retomar sessão salva */
  async function verificarSessaoPendente() {
    let s = null;
    try { s = await Repo.carregarSessaoEmAndamento(); } catch (e) { console.error(e); }
    if (s && app.sessao && s.id === app.sessao.id) s = null; // é o simulado aberto agora
    app.sessaoPendente = s;
    if (!s) { els.resumeCard.classList.add('hidden'); return; }
    const resp = s.questoes.filter(q => s.respostas[q.key]).length;
    els.resumeInfo.textContent =
      `${s.titulo} — ${resp}/${s.questoes.length} respondidas · ${fmtTempo(s.tempoTotal)} · modo ${s.config.modo} · salvo em ${fmtData(s.atualizadoEm)}`;
    els.resumeCard.classList.remove('hidden');
  }

  els.btnResume.addEventListener('click', () => {
    if (!app.sessaoPendente) return;
    app.sessao = app.sessaoPendente;
    app.sessaoPendente = null;
    app.pausado = false;
    els.resumeCard.classList.add('hidden');
    mostrarEtapa('quiz');
    renderizarQuestao();
    iniciarRelogio();
  });

  els.btnDiscard.addEventListener('click', async () => {
    if (!app.sessaoPendente || !confirm('Descartar o simulado em andamento? O progresso será perdido.')) return;
    await Repo.excluirSessao(app.sessaoPendente.id);
    app.sessaoPendente = null;
    els.resumeCard.classList.add('hidden');
  });

  /* =========================================================
     MÓDULO 7 — NAVEGAÇÃO ENTRE ETAPAS
     ========================================================= */
  function mostrarEtapa(nome) {
    els.stepImport.classList.toggle('hidden', nome !== 'import');
    els.stepQuiz.classList.toggle('hidden', nome !== 'quiz');
    els.stepResult.classList.toggle('hidden', nome !== 'result');
    const temTexto = nome === 'quiz' && app.sessao && app.sessao.questoes.some(q => q.textoBase);
    els.appContainer.classList.toggle('wide', !!temTexto);
    els.quizLayout.classList.toggle('has-text', !!temTexto);
    window.scrollTo({ top: 0 });
  }

  /* =========================================================
     MÓDULO 8 — QUESTIONÁRIO
     ========================================================= */
  const qAtual = () => app.sessao.questoes[app.sessao.indiceAtual];
  const estaRespondida = q => !!app.sessao.respostas[q.key];

  // Alternativas na ordem exibida: rótulo na tela × letra original
  function opcoesExibicao(q) {
    if (q.tipo === 'ce') {
      return [{ rotulo: 'C', orig: 'C', texto: 'Certo' }, { rotulo: 'E', orig: 'E', texto: 'Errado' }];
    }
    const ordem = (app.sessao.ordemAlt && app.sessao.ordemAlt[q.key]) || LETRAS.split('').filter(l => q.alternativas[l]);
    return ordem.map((orig, i) => ({ rotulo: LETRAS[i], orig, texto: q.alternativas[orig] }));
  }
  const rotuloNaTela = (q, orig) => (opcoesExibicao(q).find(o => o.orig === orig) || {}).rotulo || orig;
  const nomeResposta = (q, letra) => q.tipo === 'ce' ? (letra === 'C' ? 'Certo' : letra === 'E' ? 'Errado' : letra) : letra;

  function situacao(q, s = app.sessao) {
    const g = q.gabarito;
    if (!g) return 'sem-gabarito';
    if (g.resposta === 'X') return 'anulada';
    const r = s.respostas[q.key];
    if (!r) return 'branco';
    return r === g.resposta ? 'certa' : 'errada';
  }

  function renderizarQuestao() {
    const s = app.sessao;
    const q = qAtual();
    const total = s.questoes.length;
    const estudo = s.config.modo === 'estudo';
    const focoAnterior = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.orig : null;

    els.stepQuiz.classList.toggle('mode-estudo', estudo);

    // Progresso = respondidas / total
    const respondidas = s.questoes.filter(estaRespondida).length;
    const pct = Math.round(respondidas / total * 100);
    els.progressFill.style.width = `${pct}%`;
    els.progressBar.setAttribute('aria-valuenow', pct);
    els.questionCounter.textContent = `Questão ${s.indiceAtual + 1} de ${total}`;
    els.questionOrigin.textContent = `· ${P.rotulo(q)}${q.tipo === 'ce' ? ' · Certo/Errado' : ''}`;

    atualizarPlacar();
    atualizarRelogios();

    // Marcações
    const marc = s.marcacoes[q.key] || {};
    els.btnFlagReview.setAttribute('aria-pressed', !!marc.revisar);
    els.btnFlagGuess.setAttribute('aria-pressed', !!marc.chute);

    // Comando (ex.: "Julgue os itens a seguir")
    if (q.comando) {
      els.comandoContainer.textContent = q.comando;
      els.comandoContainer.classList.remove('hidden');
    } else {
      els.comandoContainer.classList.add('hidden');
    }

    // Texto-base: barra com botão (telas estreitas) + painel lateral (telas largas)
    if (q.textoBase) {
      const intervalo = q.textoBase.de === q.textoBase.ate ? `${q.textoBase.de}` : `${q.textoBase.de} a ${q.textoBase.ate}`;
      els.textBaseLabel.innerHTML = `📖 Texto para as questões <strong>${esc(intervalo)}</strong>`;
      els.textBaseContainer.classList.remove('hidden');
      els.textSideTitle.textContent = `📖 Texto — questões ${intervalo}`;
      els.textSideBody.innerHTML = paragrafosHtml(q.textoBase.texto);
    } else {
      els.textBaseContainer.classList.add('hidden');
      els.textSideTitle.textContent = 'Texto-base';
      els.textSideBody.innerHTML = '<p class="empty-text">Esta questão não tem texto-base.</p>';
    }

    els.questionText.textContent = q.enunciado ? `${q.numero}. ${q.enunciado}` : `${q.numero}.`;

    // Alternativas
    const resp = s.respostas[q.key];
    const riscadas = new Set(s.riscadas[q.key] || []);
    const travada = estudo && !!resp;
    const g = q.gabarito;
    els.optionsContainer.innerHTML = '';

    opcoesExibicao(q).forEach(o => {
      const row = document.createElement('div');
      row.className = 'option-row';

      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'option';
      b.dataset.orig = o.orig;
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', resp === o.orig);
      if (resp === o.orig) b.classList.add('selected');
      if (riscadas.has(o.orig)) b.classList.add('struck');
      if (travada) {
        b.classList.add('locked');
        b.setAttribute('aria-disabled', 'true');
        if (g && g.resposta !== 'X') {
          if (o.orig === g.resposta) b.classList.add('correct');
          else if (o.orig === resp) b.classList.add('wrong');
        }
      }
      b.innerHTML = `<span class="option-letter">(${o.rotulo})</span><span class="option-text">${esc(o.texto)}</span>`;
      b.addEventListener('click', () => selecionar(o.orig));
      b.addEventListener('contextmenu', e => { e.preventDefault(); alternarRisco(o.orig); });
      row.appendChild(b);

      if (q.tipo === 'multipla' && !travada) {
        const r = document.createElement('button');
        r.type = 'button';
        r.className = 'btn-strike';
        r.textContent = '✂';
        r.title = 'Riscar/desriscar (Shift + letra ou botão direito)';
        r.setAttribute('aria-label', `Riscar alternativa ${o.rotulo}`);
        r.setAttribute('aria-pressed', riscadas.has(o.orig));
        r.addEventListener('click', () => alternarRisco(o.orig));
        row.appendChild(r);
      }
      els.optionsContainer.appendChild(row);
    });

    renderizarFeedback(q, resp);

    els.btnPrev.disabled = s.indiceAtual === 0;
    els.btnNext.disabled = s.indiceAtual === total - 1;
    els.btnFinish.classList.toggle('ready', respondidas === total);

    renderizarMapa();
    alternarPausa(app.pausado);

    if (focoAnterior) {
      const alvo = els.optionsContainer.querySelector(`.option[data-orig="${focoAnterior}"]`);
      if (alvo) alvo.focus({ preventScroll: true });
    }
  }

  function renderizarFeedback(q, resp) {
    const s = app.sessao;
    if (s.config.modo !== 'estudo' || !resp) { els.feedback.classList.add('hidden'); return; }
    const g = q.gabarito;
    let cls, titulo, nota = '';
    if (!g) { cls = 'neutral'; titulo = 'Sem gabarito para esta questão.'; }
    else if (g.resposta === 'X') { cls = 'neutral'; titulo = 'Questão anulada.'; }
    else if (resp === g.resposta) { cls = 'ok'; titulo = '✓ Resposta correta!'; }
    else {
      cls = 'no';
      titulo = q.tipo === 'ce'
        ? `✗ Resposta incorreta. O item está ${nomeResposta(q, g.resposta).toUpperCase()}.`
        : `✗ Resposta incorreta. Correta: (${rotuloNaTela(q, g.resposta)}).`;
    }
    if (g && g.resposta !== 'X' && s.ordemAlt[q.key] && rotuloNaTela(q, g.resposta) !== g.resposta) {
      nota = `Alternativas embaralhadas — no gabarito original a correta é (${g.resposta}).`;
    }
    els.feedback.className = `feedback ${cls}`;
    els.feedback.innerHTML =
      `<div class="fb-title">${esc(titulo)}</div>` +
      (g && g.comentario ? `<div>${esc(g.comentario)}</div>` : '') +
      (nota ? `<div class="fb-note">${esc(nota)}</div>` : '');
  }

  function atualizarPlacar() {
    const s = app.sessao;
    const acertos = s.questoes.filter(q => situacao(q) === 'certa').length;
    els.questionScore.textContent = s.acertosVisivel ? `Acertos: ${acertos}` : 'Acertos: •••';
    els.btnToggleScore.textContent = s.acertosVisivel ? '👁️ Ocultar' : '👁️‍🗨️ Mostrar';
    els.btnToggleScore.title = s.acertosVisivel ? 'Ocultar contador de acertos' : 'Mostrar contador de acertos';
  }

  els.btnToggleScore.addEventListener('click', () => {
    app.sessao.acertosVisivel = !app.sessao.acertosVisivel;
    atualizarPlacar();
    agendarSalvamento();
  });

  function selecionar(orig) {
    const s = app.sessao;
    const q = qAtual();
    if (app.pausado) return;
    if (s.config.modo === 'estudo' && s.respostas[q.key]) return; // estudo: resposta travada
    if (s.respostas[q.key] === orig && s.config.modo === 'prova') {
      delete s.respostas[q.key]; // clicar de novo desmarca (útil no Certo/Errado)
    } else {
      s.respostas[q.key] = orig;
      const r = s.riscadas[q.key];
      if (r) {
        s.riscadas[q.key] = r.filter(l => l !== orig);
        if (!s.riscadas[q.key].length) delete s.riscadas[q.key];
      }
    }
    renderizarQuestao();
    agendarSalvamento();
  }

  function alternarRisco(orig) {
    const s = app.sessao;
    const q = qAtual();
    if (app.pausado || q.tipo !== 'multipla') return;
    if (s.config.modo === 'estudo' && s.respostas[q.key]) return;
    const set = new Set(s.riscadas[q.key] || []);
    if (set.has(orig)) set.delete(orig);
    else {
      set.add(orig);
      if (s.respostas[q.key] === orig) delete s.respostas[q.key];
    }
    if (set.size) s.riscadas[q.key] = [...set]; else delete s.riscadas[q.key];
    renderizarQuestao();
    agendarSalvamento();
  }

  function alternarMarcacao(tipo) {
    const s = app.sessao;
    const q = qAtual();
    const m = s.marcacoes[q.key] || {};
    m[tipo] = !m[tipo];
    if (m.revisar || m.chute) s.marcacoes[q.key] = m; else delete s.marcacoes[q.key];
    renderizarQuestao();
    agendarSalvamento();
  }
  els.btnFlagReview.addEventListener('click', () => alternarMarcacao('revisar'));
  els.btnFlagGuess.addEventListener('click', () => alternarMarcacao('chute'));

  function irPara(idx, rolar = false) {
    const s = app.sessao;
    if (idx < 0 || idx >= s.questoes.length) return;
    s.indiceAtual = idx;
    renderizarQuestao();
    agendarSalvamento();
    if (rolar) els.questionCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  els.btnNext.addEventListener('click', () => irPara(app.sessao.indiceAtual + 1));
  els.btnPrev.addEventListener('click', () => irPara(app.sessao.indiceAtual - 1));

  function renderizarMapa() {
    const s = app.sessao;
    const estudo = s.config.modo === 'estudo';
    const pendentes = s.questoes.filter(q => !estaRespondida(q)).length;
    const revisar = Object.values(s.marcacoes).filter(m => m.revisar).length;
    els.mapPending.textContent = `— ${plural(pendentes, 'pendente', 'pendentes')}` + (revisar ? ` · ${revisar} para revisar` : '');

    els.questionMap.innerHTML = '';
    s.questoes.forEach((q, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'map-cell';
      const resp = estaRespondida(q);
      const sit = situacao(q);
      if (resp) b.classList.add(estudo && sit === 'certa' ? 'right' : estudo && sit === 'errada' ? 'wrong' : 'answered');
      if (i === s.indiceAtual) { b.classList.add('current'); b.setAttribute('aria-current', 'true'); }
      const m = s.marcacoes[q.key] || {};
      const flags = (m.revisar ? '🚩' : '') + (m.chute ? '🎲' : '');
      b.innerHTML = `${i + 1}${flags ? `<span class="flags">${flags}</span>` : ''}`;
      b.title = `${P.rotulo(q)} — ${resp ? 'respondida' : 'pendente'}${m.revisar ? ' · revisar' : ''}${m.chute ? ' · chute' : ''}`;
      b.addEventListener('click', () => irPara(i, true));
      els.questionMap.appendChild(b);
    });
  }

  /* Cronômetro */
  let relogio = null;
  function iniciarRelogio() { pararRelogio(); relogio = setInterval(tick, 1000); }
  function pararRelogio() { if (relogio) clearInterval(relogio); relogio = null; }

  function tick() {
    const s = app.sessao;
    if (!s || s.status !== 'andamento' || app.pausado || document.hidden || els.stepQuiz.classList.contains('hidden')) return;
    const q = qAtual();
    s.tempoTotal = (s.tempoTotal || 0) + 1;
    s.tempos[q.key] = (s.tempos[q.key] || 0) + 1;
    atualizarRelogios();
    agendarSalvamento();
  }

  function atualizarRelogios() {
    const s = app.sessao;
    const q = qAtual();
    const t = s.tempos[q.key] || 0;
    const meta = s.config.metaSegundos;
    els.timerTotal.textContent = `⏱ ${fmtTempo(s.tempoTotal)}`;
    els.timerQuestion.textContent = `Nesta: ${fmtTempo(t)}${meta ? ` / ${fmtTempo(meta)}` : ''}`;
    els.timerQuestion.classList.toggle('over', !!meta && t > meta);
    els.timerQuestion.title = meta ? `Meta: ${fmtTempo(meta)} por questão` : 'Tempo nesta questão';
  }

  /* Pausa */
  function alternarPausa(forcar) {
    app.pausado = typeof forcar === 'boolean' ? forcar : !app.pausado;
    els.pauseOverlay.classList.toggle('hidden', !app.pausado);
    els.btnPause.textContent = app.pausado ? '▶ Continuar' : '⏸ Pausar';
    els.btnPause.setAttribute('aria-pressed', app.pausado);
  }
  els.btnPause.addEventListener('click', () => alternarPausa());
  els.btnUnpause.addEventListener('click', () => alternarPausa(false));

  /* Sair (progresso fica salvo) */
  els.btnQuit.addEventListener('click', async () => {
    if (!confirm('Sair do simulado? O progresso fica salvo e você pode continuar depois pela tela inicial.')) return;
    await salvarAgora();
    pararRelogio();
    app.sessao = null;
    mostrarEtapa('import');
    verificarSessaoPendente();
  });

  /* Finalizar */
  els.btnFinish.addEventListener('click', async () => {
    const s = app.sessao;
    const pend = s.questoes.filter(q => !estaRespondida(q)).length;
    if (pend && !confirm(`Ainda há ${plural(pend, 'questão sem resposta', 'questões sem resposta')}. Elas contarão como "em branco". Finalizar mesmo assim?`)) return;
    pararRelogio();
    s.status = 'finalizada';
    s.finalizadoEm = new Date().toISOString();
    app.resumo = calcularResumo(s);
    app.filtro = 'todas';
    app.origemResultado = 'simulado';
    try {
      await Repo.registrarResultado(app.resumo);
      await Repo.excluirSessao(s.id);
    } catch (e) {
      console.error(e);
      toast('⚠ Não foi possível salvar no histórico.');
    }
    try {
      await Repo.salvarDetalhes(s); // permite reabrir este resultado pelo histórico
    } catch (e) {
      console.error(e);
      toast('⚠ Resumo salvo, mas sem espaço para guardar os detalhes. Exclua simulados antigos do histórico.');
    }
    mostrarResultado();
    renderizarHistorico();
  });

  /* =========================================================
     MÓDULO 9 — RESULTADO
     ========================================================= */
  function calcularResumo(s) {
    const itens = s.questoes.map(q => ({ q, sit: situacao(q, s), chute: !!(s.marcacoes[q.key] || {}).chute }));
    const conta = sit => itens.filter(i => i.sit === sit).length;
    const acertos = conta('certa'), erros = conta('errada'), brancos = conta('branco');
    const consideradas = acertos + erros + brancos;
    const chutes = itens.filter(i => i.chute && (i.sit === 'certa' || i.sit === 'errada'));
    const ce = itens.filter(i => i.q.tipo === 'ce' && ['certa', 'errada', 'branco'].includes(i.sit));
    const liquido = ce.length ? ce.filter(i => i.sit === 'certa').length - ce.filter(i => i.sit === 'errada').length : null;

    const porModulo = [];
    if (s.questoes.some(q => q.modulo)) {
      const grupos = new Map();
      itens.forEach(i => {
        const nome = i.q.modulo || 'Sem módulo';
        if (!grupos.has(nome)) grupos.set(nome, { nome, total: 0, acertos: 0, erros: 0, brancos: 0 });
        const g = grupos.get(nome);
        if (i.sit === 'certa') g.acertos++;
        if (i.sit === 'errada') g.erros++;
        if (i.sit === 'branco') g.brancos++;
        if (['certa', 'errada', 'branco'].includes(i.sit)) g.total++;
      });
      grupos.forEach(g => porModulo.push({ ...g, percentual: g.total ? Math.round(g.acertos / g.total * 100) : 0 }));
    }

    // Documento salvo no histórico (resumo, sem o texto das questões)
    return {
      id: s.id,
      titulo: s.titulo,
      data: s.finalizadoEm,
      modo: s.config.modo,
      total: s.questoes.length,
      consideradas, acertos, erros, brancos,
      anuladas: conta('anulada'),
      semGabarito: conta('sem-gabarito'),
      percentual: consideradas ? Math.round(acertos / consideradas * 100) : 0,
      itensCE: ce.length,
      liquidoCE: liquido,
      chutes: chutes.length,
      chutesCertos: chutes.filter(i => i.sit === 'certa').length,
      ...contarMarcacoes(s),
      tempoTotal: s.tempoTotal || 0,
      porModulo
    };
  }

  // Quantas questões foram marcadas como chute e para revisar (todas, respondidas ou não)
  function contarMarcacoes(s) {
    const m = Object.values(s.marcacoes || {});
    return {
      marcadasChute: m.filter(x => x && x.chute).length,
      marcadasRevisar: m.filter(x => x && x.revisar).length
    };
  }

  const classePct = p => p >= 70 ? 'bom' : p < 50 ? 'ruim' : '';

  function mostrarResultado() {
    const s = app.sessao;
    const r = app.resumo;
    mostrarEtapa('result');

    els.resultTitle.textContent = `Resultado — ${s.titulo}`;
    const doHistorico = app.origemResultado === 'historico';
    els.btnBackHistory.classList.toggle('hidden', !doHistorico);
    els.resultDate.textContent = `Finalizado em ${fmtData(r.data)} · modo ${r.modo}`;
    const caixas = [
      ['correct', r.acertos, 'Acertos'],
      ['wrong', r.erros, 'Erros'],
      ...(r.brancos ? [['blank', r.brancos, 'Em branco']] : []),
      ['percent', `${r.percentual}%`, 'Aproveitamento'],
      ...(r.liquidoCE !== null ? [['net', r.liquidoCE, `Nota líquida C/E (de ${r.itensCE})`]] : []),
      ['', fmtTempo(r.tempoTotal), 'Tempo total']
    ];
    els.scoreSummary.innerHTML = caixas.map(([c, n, l]) =>
      `<div class="score-box ${c}"><span class="num">${esc(n)}</span><span class="label">${esc(l)}</span></div>`).join('');

    const extra = [];
    if (r.consideradas) extra.push(`Tempo médio: <strong>${fmtTempo(r.tempoTotal / r.total)}</strong> por questão` +
      (s.config.metaSegundos ? ` (meta: ${fmtTempo(s.config.metaSegundos)})` : '') + '.');
    if (r.chutes) {
      const certeza = r.acertos - r.chutesCertos;
      extra.push(`🎲 Você marcou <strong>${plural(r.chutes, 'chute', 'chutes')}</strong> e acertou ${r.chutesCertos}. ` +
        `Acertos com segurança: <strong>${certeza}</strong> (${r.consideradas ? Math.round(certeza / r.consideradas * 100) : 0}%).`);
    }
    if (r.liquidoCE !== null) extra.push('Nota líquida C/E: cada item errado anula um certo; itens em branco não contam.');
    if (r.anuladas) extra.push(`${plural(r.anuladas, 'questão anulada ficou', 'questões anuladas ficaram')} fora da contagem.`);
    if (r.semGabarito) extra.push(`${plural(r.semGabarito, 'questão sem gabarito ficou', 'questões sem gabarito ficaram')} fora da contagem.`);
    els.resultExtra.innerHTML = extra.map(t => `<p>${t}</p>`).join('');

    if (r.porModulo.length) {
      els.moduleTableWrap.innerHTML = `
        <h3 class="field-label" style="margin-bottom:6px">Desempenho por módulo</h3>
        <div class="table-scroll"><table class="data-table">
          <thead><tr><th>Módulo</th><th class="num">Acertos</th><th class="num">Erros</th><th class="num">Branco</th><th class="num">Aproveitamento</th></tr></thead>
          <tbody>${r.porModulo.map(m => `
            <tr><td>${esc(m.nome)}</td><td class="num">${m.acertos}/${m.total}</td><td class="num">${m.erros}</td><td class="num">${m.brancos}</td>
            <td class="num"><span class="pct-bar ${classePct(m.percentual)}"><i style="width:${m.percentual}%"></i></span>${m.percentual}%</td></tr>`).join('')}
          </tbody></table></div>`;
    } else {
      els.moduleTableWrap.innerHTML = '';
    }

    const nErradas = s.questoes.filter(q => ['errada', 'branco'].includes(situacao(q))).length;
    const nErrChute = s.questoes.filter(q => ['errada', 'branco'].includes(situacao(q)) || (s.marcacoes[q.key] || {}).chute).length;
    els.btnRedoWrong.disabled = !nErradas;
    els.btnRedoWrong.textContent = `Refazer erradas (${nErradas})`;
    els.btnRedoWrongGuess.disabled = !nErrChute;
    els.btnRedoWrongGuess.textContent = `Refazer erradas + chutes (${nErrChute})`;

    els.shuffleNote.classList.toggle('hidden', !Object.keys(s.ordemAlt || {}).length);
    renderizarFiltros();
    renderizarListaResultado();
  }

  const FILTROS = [
    ['todas', 'Todas', () => true],
    ['erradas', 'Erradas/branco', q => ['errada', 'branco'].includes(situacao(q))],
    ['certas', 'Certas', q => situacao(q) === 'certa'],
    ['chutes', '🎲 Chutes', q => (app.sessao.marcacoes[q.key] || {}).chute],
    ['revisar', '🚩 Revisar', q => (app.sessao.marcacoes[q.key] || {}).revisar]
  ];

  function renderizarFiltros() {
    els.resultFilters.innerHTML = '';
    FILTROS.forEach(([id, nome, fn]) => {
      const n = app.sessao.questoes.filter(fn).length;
      if (id !== 'todas' && !n) return;
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', app.filtro === id);
      b.textContent = `${nome} (${n})`;
      b.addEventListener('click', () => { app.filtro = id; renderizarFiltros(); renderizarListaResultado(); });
      els.resultFilters.appendChild(b);
    });
  }

  const ROTULO_SIT = { certa: 'Acertou', errada: 'Errou', branco: 'Em branco', anulada: 'Anulada', 'sem-gabarito': 'Sem gabarito' };

  function renderizarListaResultado() {
    const s = app.sessao;
    const fn = (FILTROS.find(f => f[0] === app.filtro) || FILTROS[0])[2];
    const lista = s.questoes.filter(fn);
    els.resultList.innerHTML = lista.length ? '' : '<p class="empty-list">Nenhuma questão neste filtro.</p>';

    lista.forEach(q => {
      const g = q.gabarito;
      const resp = s.respostas[q.key];
      const sit = situacao(q);
      const m = s.marcacoes[q.key] || {};
      const embaralhada = s.ordemAlt[q.key] && resp && rotuloNaTela(q, resp) !== resp;

      const opcoes = LETRAS.split('').filter(l => q.alternativas[l]).map(l => {
        let cls = 'opt';
        if (g && g.resposta === l) cls += ' correct';
        if (resp === l && (!g || g.resposta !== l)) cls += ' wrong';
        return `<div class="${cls}">(${l}) ${esc(q.alternativas[l])}</div>`;
      }).join('');

      const comentario = g
        ? (g.resposta === 'X'
          ? `<div class="comment"><strong>Questão anulada.</strong> ${esc(g.comentario)}</div>`
          : `<div class="comment"><strong>Gabarito:</strong> (${esc(nomeResposta(q, g.resposta))})${g.comentario ? ' — ' + esc(g.comentario) : ''}</div>`)
        : '<div class="comment"><em>Sem gabarito disponível.</em></div>';

      const item = document.createElement('div');
      item.className = `result-item ${sit}`;
      item.innerHTML = `
        <h3>
          <span class="badge ${sit}">${ROTULO_SIT[sit]}</span>
          <span>Questão ${q.numero}${q.modulo ? ` · ${esc(q.modulo)}` : ''} — Sua resposta: (${esc(resp ? nomeResposta(q, resp) : '—')})${embaralhada ? ` <span class="item-meta">[na tela: (${rotuloNaTela(q, resp)})]</span>` : ''}</span>
          ${m.chute ? '<span title="Chute">🎲</span>' : ''}${m.revisar ? '<span title="Marcada para revisar">🚩</span>' : ''}
          <span class="item-meta">⏱ ${fmtTempo(s.tempos[q.key] || 0)}</span>
        </h3>
        ${q.comando ? `<div class="comando">${esc(q.comando)}</div>` : ''}
        <div class="enunciado">${esc(q.enunciado)}</div>
        <div class="result-options">${opcoes}</div>
        ${comentario}`;
      els.resultList.appendChild(item);
    });
  }

  function textoResultado() {
    const s = app.sessao, r = app.resumo;
    let t = `=== ${s.titulo} ===\n`;
    t += `Data: ${fmtData(r.data)} · Modo: ${r.modo}\n`;
    t += `Acertos: ${r.acertos} · Erros: ${r.erros} · Em branco: ${r.brancos} · Aproveitamento: ${r.percentual}%\n`;
    if (r.liquidoCE !== null) t += `Nota líquida C/E: ${r.liquidoCE} (de ${r.itensCE} itens)\n`;
    t += `Tempo total: ${fmtTempo(r.tempoTotal)}\n`;
    if (r.porModulo.length) {
      t += '\nPor módulo:\n';
      r.porModulo.forEach(m => { t += `- ${m.nome}: ${m.acertos}/${m.total} (${m.percentual}%)\n`; });
    }
    t += '\n=== GABARITO COMENTADO ===\n\n';
    s.questoes.forEach(q => {
      const g = q.gabarito, resp = s.respostas[q.key], m = s.marcacoes[q.key] || {};
      t += `Questão ${q.numero}${q.modulo ? ` (${q.modulo})` : ''} - Sua resposta: (${resp ? nomeResposta(q, resp) : '—'}) [${ROTULO_SIT[situacao(q)].toUpperCase()}]`;
      t += `${m.chute ? ' [CHUTE]' : ''}${m.revisar ? ' [REVISAR]' : ''}\n`;
      if (q.comando) t += `${q.comando}\n`;
      t += `${q.enunciado}\n\n`;
      if (q.tipo === 'multipla') LETRAS.split('').filter(l => q.alternativas[l]).forEach(l => { t += `(${l}) ${q.alternativas[l]}\n`; });
      t += '\n';
      t += g ? `Gabarito: (${nomeResposta(q, g.resposta)}) — ${g.comentario || ''}\n` : 'Gabarito: sem gabarito disponível.\n';
      t += '----------------------------------------\n\n';
    });
    return t;
  }

  els.btnCopyResult.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(textoResultado());
      toast('✅ Gabarito copiado!');
    } catch (e) {
      console.error(e);
      toast('Não foi possível copiar — use "Baixar .txt".');
    }
  });

  els.btnDownloadResult.addEventListener('click', () => {
    const data = new Date().toISOString().slice(0, 10);
    const nome = `${app.sessao.titulo}`.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 60);
    baixarArquivo(`resultado-${nome || 'simulado'}-${data}.txt`, textoResultado());
  });

  async function refazer(tipo) {
    const s = app.sessao;
    if (app.sessaoPendente) {
      if (!confirm('Há um simulado em andamento salvo. Começar este vai descartá-lo. Continuar?')) return;
      await Repo.excluirSessoesEmAndamento();
      app.sessaoPendente = null;
      els.resumeCard.classList.add('hidden');
    }
    let qs = s.questoes;
    if (tipo === 'erradas') qs = qs.filter(q => ['errada', 'branco'].includes(situacao(q)));
    if (tipo === 'erradas-chutes') qs = qs.filter(q => ['errada', 'branco'].includes(situacao(q)) || (s.marcacoes[q.key] || {}).chute);
    if (!qs.length) { toast('Nenhuma questão nesse filtro.'); return; }
    const titulo = tipo === 'todas' ? s.titulo : `${s.titulo.replace(/ — revisão$/, '')} — revisão`;
    iniciarSimulado(clonar(qs), { titulo, config: { ...s.config } });
  }
  els.btnRedoAll.addEventListener('click', () => refazer('todas'));
  els.btnRedoWrong.addEventListener('click', () => refazer('erradas'));
  els.btnRedoWrongGuess.addEventListener('click', () => refazer('erradas-chutes'));

  els.btnNew.addEventListener('click', () => {
    app.sessao = null;
    app.resumo = null;
    mostrarEtapa('import');
    verificarSessaoPendente();
  });

  els.btnBackHistory.addEventListener('click', () => {
    app.sessao = null;
    app.resumo = null;
    mostrarEtapa('import');
    verificarSessaoPendente();
    const card = els.historyList.closest('.card');
    if (card && card.scrollIntoView) card.scrollIntoView({ block: 'start' });
  });

  /* =========================================================
     MÓDULO 10 — HISTÓRICO E BACKUP
     ========================================================= */
  /* Estado da lista: todos os resumos ficam em memória; pesquisa e
     paginação são feitas aqui, sem novas leituras no banco. */
  const hist = { todos: [], busca: '', pagina: 1, porPagina: 5, editando: null, ordem: { campo: 'data', dir: 'desc' } };

  /* Colunas ordenáveis: valor usado na comparação de cada uma */
  const totalMarcacoes = r => (r.marcadasChute || 0) + (r.marcadasRevisar || 0);
  const COLUNAS_HIST = [
    { campo: 'data', rotulo: 'Data', valor: r => r.data || '' },
    { campo: 'titulo', rotulo: 'Simulado', valor: r => r.titulo || '', texto: true },
    { campo: 'modo', rotulo: 'Modo', valor: r => r.modo || '', texto: true },
    { campo: 'acertos', rotulo: 'Acertos', num: true, valor: r => r.acertos || 0 },
    { campo: 'marcacoes', rotulo: '🎲+🚩', num: true, valor: totalMarcacoes, dica: 'Questões marcadas como chute ou para revisar (soma dos dois)' },
    { campo: 'percentual', rotulo: '%', num: true, valor: r => r.percentual || 0 },
    { campo: 'tempoTotal', rotulo: 'Tempo', num: true, valor: r => r.tempoTotal || 0 }
  ];
  const comparaTexto = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });

  function ordenarHistorico(lista) {
    const col = COLUNAS_HIST.find(c => c.campo === hist.ordem.campo) || COLUNAS_HIST[0];
    const sinal = hist.ordem.dir === 'asc' ? 1 : -1;
    return lista.slice().sort((a, b) => {
      const va = col.valor(a), vb = col.valor(b);
      const r = col.texto ? comparaTexto.compare(va, vb) : (va < vb ? -1 : va > vb ? 1 : 0);
      if (r) return r * sinal;
      return (a.data < b.data ? 1 : a.data > b.data ? -1 : 0); // desempate: mais recente primeiro
    });
  }

  function cabecalhoHistorico() {
    return COLUNAS_HIST.map(c => {
      const ativa = hist.ordem.campo === c.campo;
      const seta = ativa ? (hist.ordem.dir === 'asc' ? '▲' : '▼') : '';
      const aria = ativa ? (hist.ordem.dir === 'asc' ? 'ascending' : 'descending') : 'none';
      const dica = (c.dica ? c.dica + ' — ' : '') + 'Clique para ordenar';
      return `<th class="${c.num ? 'num ' : ''}th-sort${ativa ? ' active' : ''}" aria-sort="${aria}">` +
        `<button type="button" class="th-sort-btn" data-sort="${c.campo}" title="${esc(dica)}">${esc(c.rotulo)}<span class="sort-arrow" aria-hidden="true">${seta}</span></button></th>`;
    }).join('') + '<th><span class="sr-only">Ações</span></th>';
  }

  function alternarOrdem(campo) {
    if (hist.ordem.campo === campo) hist.ordem.dir = hist.ordem.dir === 'asc' ? 'desc' : 'asc';
    else hist.ordem = { campo, dir: 'asc' }; // 1º clique num campo novo: crescente
    hist.pagina = 1;
    hist.editando = null;
    desenharHistorico();
    const btn = els.historyList.querySelector(`[data-sort="${campo}"]`);
    if (btn) btn.focus();
  }

  const normalizar = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const textoBusca = r => normalizar([r.titulo, fmtData(r.data), r.modo, ...(r.porModulo || []).map(m => m.nome)].join(' '));

  function destacar(texto, termo) {
    const seguro = esc(texto);
    if (!termo) return seguro;
    // Procura no texto sem acento, mas destaca o trecho original
    const base = normalizar(texto);
    const i = base.indexOf(termo);
    if (i < 0) return seguro;
    return esc(texto.slice(0, i)) + '<mark>' + esc(texto.slice(i, i + termo.length)) + '</mark>' + esc(texto.slice(i + termo.length));
  }

  // Recarrega do banco e redesenha (após finalizar, excluir, importar, trocar de conta...)
  async function renderizarHistorico() {
    try { hist.todos = await Repo.listarHistorico(null); } catch (e) { console.error(e); hist.todos = []; }
    desenharHistorico();
    if (await completarMarcacoes(hist.todos)) desenharHistorico();
  }

  // Simulados salvos antes desta versão não têm a contagem de marcações no resumo.
  // Calcula uma única vez a partir dos detalhes e grava no resumo (migração).
  let completando = false;
  async function completarMarcacoes(lista) {
    const faltando = lista.filter(r => r.marcadasChute === undefined);
    if (!faltando.length || completando) return false;
    completando = true;
    try {
      for (const r of faltando) {
        let det = null;
        try { det = await Repo.carregarDetalhes(r.id); } catch (e) { console.error(e); }
        if (det) Object.assign(r, contarMarcacoes(det));
        else Object.assign(r, { marcadasChute: r.chutes || 0, marcadasRevisar: null }); // sem detalhes: revisar desconhecido
        try { await Repo.atualizarResumo(r); } catch (e) { console.error(e); }
      }
    } finally { completando = false; }
    return true;
  }

  function celulaMarcacoes(r) {
    if (r.marcadasChute === undefined) return '<span class="muted">…</span>';
    const ch = r.marcadasChute || 0;
    if (r.marcadasRevisar === null) {
      return `<span title="🎲 ${ch} chute(s) · 🚩 revisar não registrado (simulado antigo, sem detalhes)">${ch}<span class="muted">*</span></span>`;
    }
    const rv = r.marcadasRevisar || 0;
    const total = ch + rv;
    return `<span class="${total ? 'marc-count' : 'muted'}" title="🎲 ${ch} chute(s) · 🚩 ${rv} para revisar">${total}</span>`;
  }

  function filtrarHistorico() {
    const termos = normalizar(hist.busca).split(/\s+/).filter(Boolean);
    if (!termos.length) return hist.todos;
    return hist.todos.filter(r => { const t = textoBusca(r); return termos.every(x => t.includes(x)); });
  }

  function desenharHistorico() {
    const temAlgum = hist.todos.length > 0;
    els.histToolbar.classList.toggle('hidden', !temAlgum);
    if (!temAlgum) {
      els.historyList.innerHTML = '<p class="empty-list">Nenhum simulado finalizado ainda.</p>';
      els.histPagination.innerHTML = '';
      return;
    }

    const lista = ordenarHistorico(filtrarHistorico());
    const total = lista.length;
    const paginas = Math.max(1, Math.ceil(total / hist.porPagina));
    hist.pagina = Math.min(Math.max(1, hist.pagina), paginas);
    const ini = (hist.pagina - 1) * hist.porPagina;
    const pagina = lista.slice(ini, ini + hist.porPagina);
    const termo = normalizar(hist.busca.trim());
    const termoUnico = termo && !/\s/.test(termo) ? termo : '';

    if (!total) {
      els.historyList.innerHTML = `<p class="empty-list">Nenhum simulado encontrado para “${esc(hist.busca.trim())}”.</p>`;
      els.histPagination.innerHTML = '';
      return;
    }

    els.historyList.innerHTML = `
      <div class="table-scroll"><table class="data-table">
        <thead><tr>${cabecalhoHistorico()}</tr></thead>
        <tbody>${pagina.map(r => {
          const editando = hist.editando === r.id;
          const ce = r.liquidoCE !== null && r.liquidoCE !== undefined ? ` <span class="muted">· líquida C/E: ${r.liquidoCE}</span>` : '';
          const tituloHtml = editando
            ? `<span class="hist-edit">
                 <input type="text" class="hist-edit-input" data-edit-input="${esc(r.id)}" value="${esc(r.titulo)}" maxlength="120" aria-label="Novo nome do simulado">
                 <button type="button" class="btn-row-icon ok" data-save="${esc(r.id)}" title="Salvar (Enter)" aria-label="Salvar nome">✓</button>
                 <button type="button" class="btn-row-icon" data-cancel="${esc(r.id)}" title="Cancelar (Esc)" aria-label="Cancelar">✕</button>
               </span>`
            : `<span class="hist-title">${destacar(r.titulo, termoUnico)}</span>${ce}`;
          return `
          <tr class="hist-row${editando ? ' editing' : ''}" data-id="${esc(r.id)}" ${editando ? '' : 'tabindex="0" role="button" title="Ver detalhes deste simulado"'}>
            <td>${esc(fmtData(r.data))}</td>
            <td>${tituloHtml}</td>
            <td>${esc(r.modo)}</td>
            <td class="num">${r.acertos}/${r.consideradas}</td>
            <td class="num">${celulaMarcacoes(r)}</td>
            <td class="num"><span class="pct-bar ${classePct(r.percentual)}"><i style="width:${r.percentual}%"></i></span>${r.percentual}%</td>
            <td class="num">${fmtTempo(r.tempoTotal)}</td>
            <td class="hist-actions">${editando ? '' : `<span class="hist-open">Ver ›</span>
              <button type="button" class="btn-row-icon" data-edit="${esc(r.id)}" title="Renomear" aria-label="Renomear simulado">✏️</button>
              <button type="button" class="btn-row-icon danger" data-del="${esc(r.id)}" title="Excluir do histórico" aria-label="Excluir do histórico">🗑</button>`}</td>
          </tr>`;
        }).join('')}
        </tbody></table></div>`;

    desenharPaginacao(total, paginas, ini, pagina.length);

    if (hist.editando) {
      const inp = els.historyList.querySelector('.hist-edit-input');
      if (inp) { inp.focus(); inp.select(); }
    }
  }

  function desenharPaginacao(total, paginas, ini, qtd) {
    const info = `<span class="pg-info">${ini + 1}–${ini + qtd} de ${plural(total, 'simulado', 'simulados')}</span>`;
    if (paginas <= 1) { els.histPagination.innerHTML = info; return; }
    const p = hist.pagina;
    // Janela de páginas: 1 … p-1 p p+1 … última
    const nums = new Set([1, paginas, p - 1, p, p + 1].filter(n => n >= 1 && n <= paginas));
    const ordem = [...nums].sort((x, y) => x - y);
    let botoes = '';
    ordem.forEach((n, i) => {
      if (i && n - ordem[i - 1] > 1) botoes += '<span class="pg-gap">…</span>';
      botoes += `<button type="button" class="pg-btn${n === p ? ' active' : ''}" data-page="${n}" ${n === p ? 'aria-current="page"' : ''}>${n}</button>`;
    });
    els.histPagination.innerHTML = `${info}
      <div class="pg-buttons">
        <button type="button" class="pg-btn" data-page="${p - 1}" ${p === 1 ? 'disabled' : ''} aria-label="Página anterior">‹</button>
        ${botoes}
        <button type="button" class="pg-btn" data-page="${p + 1}" ${p === paginas ? 'disabled' : ''} aria-label="Próxima página">›</button>
      </div>`;
  }

  els.histPagination.addEventListener('click', e => {
    const b = e.target.closest('[data-page]');
    if (!b || b.disabled) return;
    hist.pagina = parseInt(b.dataset.page, 10);
    hist.editando = null;
    desenharHistorico();
  });

  els.histSearch.addEventListener('input', debounce(() => {
    hist.busca = els.histSearch.value;
    hist.pagina = 1;
    hist.editando = null;
    desenharHistorico();
  }, 200));

  els.histPerPage.addEventListener('change', () => {
    hist.porPagina = parseInt(els.histPerPage.value, 10) || 5;
    hist.pagina = 1;
    app.prefs.histPorPagina = hist.porPagina;
    salvarPreferencias();
    desenharHistorico();
  });

  async function salvarTitulo(id) {
    const inp = els.historyList.querySelector('.hist-edit-input'); // só uma linha é editada por vez
    if (!inp) return;
    const novo = inp.value.replace(/\s+/g, ' ').trim();
    const reg = hist.todos.find(r => r.id === id);
    if (!novo) { toast('O nome não pode ficar vazio.'); inp.focus(); return; }
    if (reg && novo === reg.titulo) { hist.editando = null; desenharHistorico(); return; }
    inp.disabled = true;
    try {
      await Repo.renomearResultado(id, novo);
      if (reg) reg.titulo = novo;
      if (app.sessao && app.sessao.id === id) { app.sessao.titulo = novo; els.resultTitle.textContent = `Resultado — ${novo}`; }
      hist.editando = null;
      desenharHistorico();
      toast('✅ Nome atualizado.');
    } catch (e) {
      console.error(e);
      inp.disabled = false;
      toast('⚠ Não foi possível renomear: ' + (e.code || e.message));
    }
  }

  async function abrirDoHistorico(id) {
    let det = null;
    try { det = await Repo.carregarDetalhes(id); } catch (e) { console.error(e); }
    if (!det) {
      toast('Este simulado foi feito antes de o app guardar os detalhes — só o resumo está disponível.');
      return;
    }
    app.sessao = det;
    app.resumo = calcularResumo(det);
    app.filtro = 'todas';
    app.origemResultado = 'historico';
    mostrarResultado();
  }

  els.historyList.addEventListener('click', async e => {
    const t = e.target;
    const sortBtn = t.closest('[data-sort]');
    if (sortBtn) { alternarOrdem(sortBtn.dataset.sort); return; }
    const del = t.closest('[data-del]');
    if (del) {
      if (!confirm('Excluir este simulado do histórico?')) return;
      await Repo.excluirResultado(del.dataset.del);
      await renderizarHistorico();
      toast('Simulado excluído do histórico.');
      return;
    }
    const edit = t.closest('[data-edit]');
    if (edit) { hist.editando = edit.dataset.edit; desenharHistorico(); return; }
    const save = t.closest('[data-save]');
    if (save) { salvarTitulo(save.dataset.save); return; }
    if (t.closest('[data-cancel]')) { hist.editando = null; desenharHistorico(); return; }
    const row = t.closest('.hist-row');
    if (row && !row.classList.contains('editing')) abrirDoHistorico(row.dataset.id);
  });

  els.historyList.addEventListener('keydown', e => {
    const inp = e.target.closest('[data-edit-input]');
    if (inp) {
      if (e.key === 'Enter') { e.preventDefault(); salvarTitulo(inp.dataset.editInput); }
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); hist.editando = null; desenharHistorico(); }
      return;
    }
    const row = e.target.closest('.hist-row');
    if (row && e.target === row && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      abrirDoHistorico(row.dataset.id);
    }
  });

  els.btnClearHistory.addEventListener('click', async () => {
    if (!confirm('Apagar todo o histórico de simulados? Esta ação não pode ser desfeita.')) return;
    await Repo.limparHistorico();
    renderizarHistorico();
    toast('Histórico apagado.');
  });

  els.btnExportBackup.addEventListener('click', async () => {
    const dados = await Repo.exportarBackup();
    baixarArquivo(`simulado-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(dados, null, 2), 'application/json');
  });

  els.fileBackup.addEventListener('change', async () => {
    const f = els.fileBackup.files[0];
    els.fileBackup.value = '';
    if (!f) return;
    try {
      const dados = JSON.parse(await f.text());
      if (!confirm('Importar este backup? Registros com o mesmo identificador serão substituídos.')) return;
      await Repo.importarBackup(dados);
      app.prefs = await Repo.carregarPreferencias();
      if (app.prefs.tema) aplicarTema(app.prefs.tema);
      await renderizarHistorico();
      await verificarSessaoPendente();
      toast('✅ Backup importado.');
    } catch (e) {
      console.error(e);
      toast('⚠ ' + (e.message || 'Arquivo inválido.'));
    }
  });

  /* =========================================================
     MÓDULO 11 — MODAIS E TECLADO
     ========================================================= */
  let focoAntesModal = null;
  function abrirModal(el) {
    focoAntesModal = document.activeElement;
    el.classList.remove('hidden');
    const btn = el.querySelector('[data-close-modal]');
    if (btn) btn.focus();
  }
  function fecharModais() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden'));
    if (focoAntesModal && focoAntesModal.focus) focoAntesModal.focus();
  }
  const modalAberto = () => !!document.querySelector('.modal-overlay:not(.hidden)');

  document.querySelectorAll('[data-close-modal]').forEach(b => b.addEventListener('click', fecharModais));
  document.querySelectorAll('.modal-overlay').forEach(m =>
    m.addEventListener('click', e => { if (e.target === m) fecharModais(); }));

  function abrirTexto(q) {
    if (!q.textoBase) return;
    const tb = q.textoBase;
    els.modalTextTitle.textContent = `Texto (questões ${tb.de === tb.ate ? tb.de : `${tb.de} a ${tb.ate}`})`;
    els.modalTextBody.innerHTML = paragrafosHtml(tb.texto);
    abrirModal(els.textModal);
    els.modalTextBody.scrollTop = 0;
  }
  els.btnShowText.addEventListener('click', () => abrirTexto(qAtual()));
  els.btnHelp.addEventListener('click', () => abrirModal(els.helpModal));

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { if (modalAberto()) fecharModais(); return; }
    if (modalAberto()) return;
    if (e.target.closest && e.target.closest('input, textarea, select, [contenteditable]')) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === '?') { e.preventDefault(); abrirModal(els.helpModal); return; }
    if (!app.sessao || els.stepQuiz.classList.contains('hidden')) return;

    const k = e.key.toLowerCase();
    if (k === 'p') { e.preventDefault(); alternarPausa(); return; }
    if (app.pausado) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); irPara(app.sessao.indiceAtual + 1); return; }
    if (e.key === 'ArrowLeft') { e.preventDefault(); irPara(app.sessao.indiceAtual - 1); return; }

    const q = qAtual();
    const ops = opcoesExibicao(q);
    let alvo = null;
    if (/^[a-e]$/.test(k)) alvo = ops.find(o => o.rotulo === k.toUpperCase());
    else if (/^[1-5]$/.test(k)) alvo = ops[parseInt(k, 10) - 1];
    if (alvo) {
      e.preventDefault();
      if (e.shiftKey) alternarRisco(alvo.orig); else selecionar(alvo.orig);
      return;
    }
    if (k === 't' && q.textoBase) { e.preventDefault(); abrirTexto(q); return; }
    if (k === 'r') { e.preventDefault(); alternarMarcacao('revisar'); return; }
    if (k === 'g') { e.preventDefault(); alternarMarcacao('chute'); }
  });

  /* =========================================================
     MÓDULO 12 — INICIALIZAÇÃO
     ========================================================= */
  /* =========================================================
     MÓDULO 12 — CONTA (Firebase) E INICIALIZAÇÃO
     Sem login: dados no navegador (LocalStorageAdapter).
     Com login Google: dados na nuvem (FirestoreAdapter).
     ========================================================= */
  const FB = window.SIMULADO_FIREBASE;
  const fb = { auth: null, db: null, local: null, usuario: null };

  function atualizarNotaArmazenamento() {
    const a = Repo.adapter;
    if (a && a.tipo === 'nuvem') {
      els.storageNote.textContent = `☁️ Sincronizado com a conta ${fb.usuario && fb.usuario.email || 'Google'}. Funciona offline e envia as mudanças quando a conexão voltar.`;
    } else if (a && !a.persistente) {
      els.storageNote.textContent = '⚠ O navegador bloqueou o armazenamento local: o progresso e o histórico valem só enquanto a página estiver aberta.';
    } else {
      els.storageNote.textContent = fb.auth
        ? 'Dados salvos só neste navegador. Entre com Google para sincronizar entre dispositivos.'
        : 'Progresso e histórico ficam salvos neste navegador. Use "Exportar backup" para levá-los a outro lugar.';
    }
  }

  // Recarrega preferências, rascunho, sessão pendente e histórico do armazenamento ativo
  async function recarregarDados() {
    try {
      app.prefs = await Repo.carregarPreferencias();
    } catch (e) {
      console.error(e);
      app.prefs = {};
      if (e && e.code === 'permission-denied') toast('⚠ O Firestore negou o acesso. Confira se as regras foram publicadas.');
    }
    const temaSistema = window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro';
    aplicarTema(app.prefs.tema || temaSistema);
    aplicarConfigNaTela(app.prefs.ultimaConfig);
    if (app.prefs.histPorPagina) {
      hist.porPagina = app.prefs.histPorPagina;
      els.histPerPage.value = String(hist.porPagina);
    }
    if (app.prefs.rascunho && els.stepImport && !els.stepImport.classList.contains('hidden')) {
      els.inputQuestions.value = app.prefs.rascunho.questoes || '';
      els.inputGabarito.value = app.prefs.rascunho.gabarito || '';
    }
    atualizarStatusImportacao();
    atualizarNotaArmazenamento();
    await verificarSessaoPendente();
    await renderizarHistorico();
  }

  function renderizarConta() {
    const u = fb.usuario;
    els.btnLogin.classList.toggle('hidden', !!u);
    els.accountUser.classList.toggle('hidden', !u);
    if (u) {
      els.accountName.textContent = u.displayName || u.email || 'Conectado';
      els.accountUser.title = u.email || '';
      if (u.photoURL) els.accountPhoto.src = u.photoURL; else els.accountPhoto.removeAttribute('src');
    }
  }

  // Primeiro login: conta vazia na nuvem + dados neste navegador → oferece enviar
  async function oferecerMigracao() {
    try {
      if (!(await Repo.estaVazio())) return;
      const bk = await Repo.exportarBackup(fb.local);
      const n = (bk.historico || []).length;
      const temSessao = (bk.sessoes || []).some(x => x.status === 'andamento');
      if (!n && !temSessao && !bk.preferencias) return;
      const partes = [];
      if (n) partes.push(plural(n, 'simulado no histórico', 'simulados no histórico'));
      if (temSessao) partes.push('1 simulado em andamento');
      if (!partes.length) partes.push('suas preferências');
      if (!confirm(`Sua conta na nuvem ainda está vazia. Enviar os dados deste navegador (${partes.join(' e ')}) para ela?\n\nOs dados locais continuam guardados aqui.`)) return;
      await Repo.importarBackup(bk);
      toast('✅ Dados enviados para a nuvem.');
    } catch (e) {
      console.error(e);
      toast('⚠ Não foi possível enviar os dados locais: ' + (e.code || e.message));
    }
  }

  async function aoMudarUsuario(user) {
    // Grava o que estiver pendente no armazenamento antigo antes de trocar
    await salvarAgora();
    fb.usuario = user || null;
    if (user) {
      Repo.usar(new window.SimuladoStorage.FirestoreAdapter(fb.db, user.uid));
      renderizarConta();
      await oferecerMigracao();
    } else {
      Repo.usar(fb.local);
      renderizarConta();
    }
    // Simulado aberto continua na tela; passa a ser salvo no novo armazenamento
    if (app.sessao && app.sessao.status === 'andamento') await salvarAgora();
    await recarregarDados();
  }

  function iniciarFirebase() {
    if (!window.firebase || !FB || !FB.config) return false;   // SDK não carregou (offline?) → modo local
    if (location.protocol === 'file:') return false;          // login com Google não funciona em file://
    try {
      firebase.initializeApp(FB.config);
      if (FB.appCheckSiteKey && firebase.appCheck) {
        firebase.appCheck().activate(new firebase.appCheck.ReCaptchaEnterpriseProvider(FB.appCheckSiteKey), true);
      }
      fb.db = firebase.firestore();
      fb.db.enablePersistence({ synchronizeTabs: true })
        .catch(e => console.warn('Cache offline do Firestore indisponível:', e.code));
      fb.auth = firebase.auth();
    } catch (e) {
      console.error('Falha ao iniciar o Firebase', e);
      return false;
    }

    els.accountArea.classList.remove('hidden');
    let primeiraVez = true;
    fb.auth.onAuthStateChanged(async user => {
      if (primeiraVez && !user) { primeiraVez = false; renderizarConta(); atualizarNotaArmazenamento(); return; }
      primeiraVez = false;
      await aoMudarUsuario(user);
    });

    els.btnLogin.addEventListener('click', async () => {
      const provider = new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      try {
        await fb.auth.signInWithPopup(provider);
      } catch (e) {
        if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') {
          await fb.auth.signInWithRedirect(provider);
        } else if (e.code === 'auth/unauthorized-domain') {
          toast(`⚠ Domínio não autorizado: adicione ${location.hostname} em Authentication → Configurações → Domínios autorizados.`);
        } else if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') {
          console.error(e);
          toast('⚠ Não foi possível entrar: ' + (e.code || e.message));
        }
      }
    });

    els.btnLogout.addEventListener('click', async () => {
      if (!confirm('Sair da conta? Seus dados continuam na nuvem; neste navegador o app volta ao modo local.')) return;
      await salvarAgora();
      await fb.auth.signOut();
    });

    els.btnCopyUid.addEventListener('click', async () => {
      if (!fb.usuario) return;
      try { await navigator.clipboard.writeText(fb.usuario.uid); toast('UID copiado: ' + fb.usuario.uid); }
      catch (e) { prompt('Seu UID:', fb.usuario.uid); }
    });
    return true;
  }

  async function init() {
    fb.local = new LocalStorageAdapter({ namespace: 'simulado-interativo' });
    Repo.usar(fb.local);
    await recarregarDados();   // mostra os dados locais imediatamente
    iniciarFirebase();         // se houver login salvo, troca para a nuvem em seguida
  }

  init();
})();
