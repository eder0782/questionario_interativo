/* =========================================================
   MÓDULO 1 — PARSER
   ========================================================= */
function importarQuestoes(texto) {
  if (!texto || !texto.trim()) return [];
  const linhas = texto.replace(/\r\n/g, '\n').split('\n');
  const questoes = [];
  const textosBaseInfo = {}; // numero -> { de, ate, texto }

  const reQuestao = /^\s*(\d+)\s*[\.\)]\s*(.*)$/;
  const reModulo = /^\s*(?:[📝📌🔹📘📗📕🎯💡✨]\s*)*M[ÓO]DULO\b/i;
  const reRotulo = /^\s*Quest[õo]es\s+\d+\s+a\s+\d+\s*(?:\(.*?\))?\s*:?\s*$/i;
  const reSeparador = /^\s*[_\-–—=]{3,}\s*$/;

  // Função auxiliar para detectar se uma linha é um cabeçalho de texto-base
  const getCabecalhoTexto = (txt) => {
    const m = txt.match(/(?:quest[õo]es?|questions?)(?:\s+de\s+n[úu]meros?)?\s+(\d+)(?:\s*(?:a|até|à|to|–|-|—)\s*(\d+))?/i);
    if (m && /texto|trecho|considere|atenção|leia|text\b|read\b|responda|answer/i.test(txt)) {
      return { de: parseInt(m[1], 10), ate: m[2] ? parseInt(m[2], 10) : parseInt(m[1], 10) };
    }
    return null;
  };

  /* PASSO 1: mapear textos-base por intervalo */
  for (let i = 0; i < linhas.length; i++) {
    const t = linhas[i].trim();
    if (!t || reQuestao.test(t)) continue;

    const cab = getCabecalhoTexto(t);
    if (cab) {
      const { de, ate } = cab;
      let conteudoLinhas = [];
      let j = i;
      
      while (j < linhas.length) {
        const nt = linhas[j].trim();
        if (j > i && reQuestao.test(nt)) break;
        if (j > i && getCabecalhoTexto(nt)) break;
        
        conteudoLinhas.push(nt);
        j++;
      }
      
      let rawText = conteudoLinhas.join('\n');
      
      // Limpeza do cabeçalho para manter apenas o texto em si
      rawText = rawText.replace(/^Atenção:[\s\S]*?(?:considere|leia|texto|trecho)[^.]*\.\s*/i, '');
      rawText = rawText.replace(/^Para responder[\s\S]*?(?:considere|leia|texto|trecho)[^.]*\.\s*/i, '');
      rawText = rawText.replace(/^.*?quest[õo]es?\s+(\d+)(?:\s*a\s*(\d+))?[\s\S]*?:\s*/i, '');
      rawText = rawText.replace(/^.*?questions?\s+(\d+)(?:\s*to\s*(\d+))?[\s\S]*?:\s*/i, '');
      rawText = rawText.replace(/^["“”'‘’]+/, '').replace(/["“”'‘’]+$/, '').trim();
      
      // Algoritmo inteligente para separar parágrafos reais de quebras falsas de PDF
      let paragrafos = [];
      let atual = "";
      let linhasTexto = rawText.split('\n');
      
      for (let k = 0; k < linhasTexto.length; k++) {
          let linha = linhasTexto[k].trim();
          if (!linha) {
              if (atual) { paragrafos.push(atual); atual = ""; }
              continue;
          }
          
          if (atual === "") {
              atual = linha;
          } else {
              let terminaPontuacao = /[.!?:;]$/.test(atual);
              let comecaMaiuscula = /^[A-ZÀ-Ú"“]/.test(linha);
              let anteriorCurta = atual.length < 50 && !terminaPontuacao;
              
              if ((terminaPontuacao && comecaMaiuscula) || anteriorCurta) {
                  paragrafos.push(atual);
                  atual = linha;
              } else {
                  atual += " " + linha;
              }
          }
      }
      if (atual) paragrafos.push(atual);
      
      let conteudoFormatado = paragrafos.join('\n\n');
      
      if (conteudoFormatado) {
        for (let n = de; n <= ate; n++) {
          textosBaseInfo[n] = { de, ate, texto: conteudoFormatado };
        }
      }
      i = j - 1;
    }
  }

  /* PASSO 2: extrair questões */
  let i = 0;
  while (i < linhas.length) {
    const t = linhas[i].trim();

    if (!t || reModulo.test(t) || reRotulo.test(t) || reSeparador.test(t)) {
      i++; continue;
    }

    const m = t.match(reQuestao);
    if (!m) { i++; continue; }

    const numero = parseInt(m[1], 10);
    let bloco = m[2];

    let j = i + 1;
    while (j < linhas.length) {
      const nt = linhas[j].trim();
      if (!nt) { bloco += '\n'; j++; continue; }
      if (reModulo.test(nt) || reQuestao.test(nt) || getCabecalhoTexto(nt)) break;

      bloco += '\n' + nt;
      j++;
    }
    i = j;

    const blocoLinear = bloco.replace(/\n+/g, ' ').trim();
    const alternativas = {};
    const reAlt = /\(([A-E])\)\s*(.*?)(?=\s*\([A-E]\)|$)/g;
    let am;
    while ((am = reAlt.exec(blocoLinear)) !== null) {
      const txt = am[2].trim().replace(/[.;:]+\s*$/, '').trim();
      if (txt) alternativas[am[1]] = txt;
    }
    if (Object.keys(alternativas).length === 0) continue;

    const idxAlt = bloco.search(/\([A-E]\)/);
    const enunciadoRaw = idxAlt >= 0 ? bloco.slice(0, idxAlt) : bloco;
    
    // CORREÇÃO: Junta as linhas do enunciado (remove quebras falsas do PDF)
    // Mantém quebras duplas caso existam (para matrizes ou listas)
    const enunciado = enunciadoRaw
      .split('\n\n')
      .map(p => p.split('\n').map(l => l.trim()).filter(Boolean).join(' '))
      .join('\n\n')
      .trim();

    questoes.push({
      numero,
      enunciado,
      alternativas,
      textoBase: textosBaseInfo[numero] || null
    });
  }

  questoes.sort((a, b) => a.numero - b.numero);
  return questoes;
}

function importarGabarito(texto) {
  if (!texto || !texto.trim()) return {};
  const linhas = texto.replace(/\r\n/g, '\n').split('\n');
  const gabarito = {};
  const reInicio = /^\s*(\d+)\s*[\.\)]\s*([A-E])\s*[—\-–:.]\s*(.*)$/;
  let numeroAtual = null;

  for (const linha of linhas) {
    if (!linha.trim()) continue;
    const m = linha.match(reInicio);
    if (m) {
      numeroAtual = parseInt(m[1], 10);
      gabarito[numeroAtual] = { letra: m[2], comentario: m[3].trim() };
    } else if (numeroAtual !== null) {
      gabarito[numeroAtual].comentario += ' ' + linha.trim();
    }
  }
  return gabarito;
}

/* =========================================================
   MÓDULO 2 — ESTADO E ELEMENTOS
   ========================================================= */
const state = {
  questoes: [], gabarito: {},
  indiceAtual: 0, respostas: {}, acertos: 0,
  acertosVisivel: true
};

const els = {
  stepImport: document.getElementById('step-import'),
  stepQuiz: document.getElementById('step-quiz'),
  stepResult: document.getElementById('step-result'),
  inputQuestions: document.getElementById('input-questions'),
  inputGabarito: document.getElementById('input-gabarito'),
  statusQuestions: document.getElementById('status-questions'),
  statusGabarito: document.getElementById('status-gabarito'),
  btnStart: document.getElementById('btn-start'),
  btnExample: document.getElementById('btn-example'),
  btnRecheck: document.getElementById('btn-recheck'),
  btnNext: document.getElementById('btn-next'),
  btnPrev: document.getElementById('btn-prev'),
  btnFinish: document.getElementById('btn-finish'),
  btnQuit: document.getElementById('btn-quit'),
  btnToggleScore: document.getElementById('btn-toggle-score'),
  btnRestart: document.getElementById('btn-restart'),
  btnNew: document.getElementById('btn-new'),
  progressFill: document.getElementById('progress-fill'),
  questionCounter: document.getElementById('question-counter'),
  questionScore: document.getElementById('question-score'),
  textBaseContainer: document.getElementById('text-base-container'),
  questionText: document.getElementById('question-text'),
  optionsContainer: document.getElementById('options-container'),
  unansweredCount: document.getElementById('unanswered-count'),
  unansweredList: document.getElementById('unanswered-list'),
  scoreSummary: document.getElementById('score-summary'),
  resultList: document.getElementById('result-list')
};

/* =========================================================
   MÓDULO 3 — STATUS / VALIDAÇÃO DA IMPORTAÇÃO
   ========================================================= */
function setStatus(el, tipo, texto) {
  el.className = 'status ' + tipo;
  el.textContent = texto;
}

function atualizarStatusImportacao() {
  const textoQ = els.inputQuestions.value;
  const textoG = els.inputGabarito.value;

  const questoes = importarQuestoes(textoQ);
  if (!textoQ.trim()) {
    setStatus(els.statusQuestions, 'empty', 'Nenhuma questão importada.');
  } else if (questoes.length > 0) {
    const comTextoBase = questoes.filter(q => q.textoBase).length;
    setStatus(els.statusQuestions, 'ok',
      `✓ ${questoes.length} questão(ões) detectada(s)` +
      (comTextoBase ? ` — ${comTextoBase} com texto-base.` : '.'));
  } else {
    setStatus(els.statusQuestions, 'error',
      '✗ Não foi possível identificar questões. Verifique o formato.');
  }

  const gabarito = importarGabarito(textoG);
  const totalGab = Object.keys(gabarito).length;
  if (!textoG.trim()) {
    setStatus(els.statusGabarito, 'empty', 'Nenhum gabarito importado.');
  } else if (totalGab > 0) {
    setStatus(els.statusGabarito, 'ok', `✓ ${totalGab} resposta(s) no gabarito.`);
  } else {
    setStatus(els.statusGabarito, 'error',
      '✗ Não foi possível identificar o gabarito. Verifique o formato.');
  }

  els.btnStart.disabled = !(questoes.length > 0 && totalGab > 0);
}

['input', 'change', 'keyup', 'paste', 'blur'].forEach(evt => {
  els.inputQuestions.addEventListener(evt, atualizarStatusImportacao);
  els.inputGabarito.addEventListener(evt, atualizarStatusImportacao);
});

setInterval(() => {
  if (!els.stepImport.classList.contains('hidden')) {
    atualizarStatusImportacao();
  }
}, 800);

els.btnRecheck.addEventListener('click', atualizarStatusImportacao);

/* =========================================================
   MÓDULO 4 — EXEMPLO
   ========================================================= */
const EX_Q = `Texto-base para as questões 1 a 2:
"A adoção de inteligência artificial em processos seletivos públicos tem crescido. Ainda que a tecnologia traga ganhos de eficiência, especialistas alertam para riscos de vieses algorítmicos, que podem reproduzir desigualdades já existentes."
1. De acordo com o texto, é correto afirmar que: (A) A IA elimina totalmente os vieses. (B) O uso de IA tem diminuído. (C) A eficiência da IA vem acompanhada de riscos que exigem monitoramento. (D) As auditorias já eliminaram os riscos. (E) O texto defende o fim do uso de IA.
2. A expressão "ainda que" estabelece relação de: (A) causa (B) conclusão (C) concessão (D) finalidade (E) condição
3. Em textos técnicos institucionais (editais), predomina o tipo textual: (A) narrativo (B) descritivo (C) dissertativo-argumentativo (D) injuntivo (E) lírico`;

const EX_G = `1. C — O texto afirma "ganhos de eficiência" e, ao mesmo tempo, "riscos".
2. C — "Ainda que" introduz concessão.
3. D — Editais estabelecem normas e instruem sobre procedimentos.`;

els.btnExample.addEventListener('click', () => {
  els.inputQuestions.value = EX_Q;
  els.inputGabarito.value = EX_G;
  atualizarStatusImportacao();
});

/* =========================================================
   MÓDULO 5 — INÍCIO
   ========================================================= */
els.btnStart.addEventListener('click', () => {
  state.questoes = importarQuestoes(els.inputQuestions.value);
  state.gabarito = importarGabarito(els.inputGabarito.value);
  state.indiceAtual = 0;
  state.respostas = {};
  state.acertos = 0;
  state.acertosVisivel = true;
  atualizarBotaoToggleScore();

  if (state.questoes.length === 0) { alert('Nenhuma questão válida encontrada.'); return; }

  els.stepImport.classList.add('hidden');
  els.stepQuiz.classList.remove('hidden');
  renderizarQuestao();
});

/* =========================================================
   MÓDULO 6 — QUESTIONÁRIO
   ========================================================= */
function recalcularAcertos() {
  let a = 0;
  for (const q of state.questoes) {
    const r = state.respostas[q.numero];
    const g = state.gabarito[q.numero];
    if (r && g && r === g.letra) a++;
  }
  state.acertos = a;
}

function atualizarContadorAcertos() {
  if (state.acertosVisivel) {
    els.questionScore.textContent = `Acertos: ${state.acertos}`;
    els.questionScore.style.visibility = 'visible';
  } else {
    els.questionScore.textContent = 'Acertos: •••';
  }
}

function atualizarBotaoToggleScore() {
  if (state.acertosVisivel) {
    els.btnToggleScore.textContent = '👁️ Ocultar';
    els.btnToggleScore.title = 'Ocultar contador de acertos';
  } else {
    els.btnToggleScore.textContent = '👁️‍🗨️ Mostrar';
    els.btnToggleScore.title = 'Mostrar contador de acertos';
  }
}

els.btnToggleScore.addEventListener('click', () => {
  state.acertosVisivel = !state.acertosVisivel;
  atualizarContadorAcertos();
  atualizarBotaoToggleScore();
});

function todasResolvidas() {
  return state.questoes.every(q => state.respostas[q.numero]);
}

function atualizarBotaoFinalizar() {
  const pronto = todasResolvidas();
  els.btnFinish.disabled = !pronto;
  els.btnFinish.classList.toggle('ready', pronto);
}

function renderizarListaNaoResolvidas() {
  const naoResolvidas = state.questoes.filter(q => !state.respostas[q.numero]);
  els.unansweredCount.textContent = `(${naoResolvidas.length})`;

  els.unansweredList.innerHTML = '';
  if (naoResolvidas.length === 0) {
    const p = document.createElement('div');
    p.className = 'all-done';
    p.textContent = '🎉 Todas as questões foram respondidas! Clique em "Finalizar ✓" para ver o resultado.';
    els.unansweredList.appendChild(p);
    return;
  }

  naoResolvidas.forEach(q => {
    const btn = document.createElement('button');
    btn.className = 'unanswered-chip';
    btn.textContent = `Q${q.numero}`;
    btn.title = 'Ir para esta questão';
    btn.addEventListener('click', () => {
      const idx = state.questoes.findIndex(x => x.numero === q.numero);
      if (idx >= 0) {
        state.indiceAtual = idx;
        renderizarQuestao();
        els.stepQuiz.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
    els.unansweredList.appendChild(btn);
  });
}

function renderizarQuestao() {
  const q = state.questoes[state.indiceAtual];
  const total = state.questoes.length;

  els.progressFill.style.width = `${((state.indiceAtual) / total) * 100}%`;
  els.questionCounter.textContent = `Questão ${state.indiceAtual + 1} de ${total} — Q${q.numero}`;

  recalcularAcertos();
  atualizarContadorAcertos();

  // Lógica do Texto-Base (Aviso e Botão para abrir popup)
  if (q.textoBase) {
    els.textBaseContainer.classList.remove('hidden');
    els.textBaseContainer.innerHTML = `
      <div>
        📖 Texto para responder às questões de número <strong>${q.textoBase.de} a ${q.textoBase.ate}</strong>
      </div>
      <button class="btn-primary" id="btn-show-text" style="padding: 8px 16px; font-size: 0.85rem;">Mostrar Texto</button>
    `;
    
    // Adiciona o evento de clique para abrir o modal com o texto
    const btnShow = document.getElementById('btn-show-text');
    if (btnShow) {
      btnShow.addEventListener('click', () => {
        document.getElementById('modal-text-title').textContent = `Texto (Questões ${q.textoBase.de} a ${q.textoBase.ate})`;
        
        // Transforma as quebras de parágrafo (\n\n) em tags <p> para o HTML
        const formattedHTML = q.textoBase.texto
            .split('\n\n')
            .map(para => `<p>${para}</p>`)
            .join('');
            
        document.getElementById('modal-text-body').innerHTML = formattedHTML;
        document.getElementById('text-modal').classList.remove('hidden');
      });
    }
  } else {
    els.textBaseContainer.classList.add('hidden');
    els.textBaseContainer.innerHTML = '';
  }

  els.questionText.textContent = `${q.numero}. ${q.enunciado}`;

  els.optionsContainer.innerHTML = '';
  const letras = ['A', 'B', 'C', 'D', 'E'].filter(l => q.alternativas[l]);
  const respostaSalva = state.respostas[q.numero];

  letras.forEach(letra => {
    const div = document.createElement('div');
    div.className = 'option' + (respostaSalva === letra ? ' selected' : '');
    div.dataset.letra = letra;
    div.innerHTML = `<span class="option-letter">(${letra})</span><span>${q.alternativas[letra]}</span>`;
    div.addEventListener('click', () => selecionarAlternativa(letra));
    els.optionsContainer.appendChild(div);
  });

  els.btnPrev.disabled = state.indiceAtual === 0;
  els.btnNext.disabled = state.indiceAtual === total - 1;
  atualizarBotaoFinalizar();
  renderizarListaNaoResolvidas();
}

function selecionarAlternativa(letra) {
  const q = state.questoes[state.indiceAtual];
  state.respostas[q.numero] = letra;
  recalcularAcertos();
  atualizarContadorAcertos();

  document.querySelectorAll('.option').forEach(el => {
    el.classList.toggle('selected', el.dataset.letra === letra);
  });

  renderizarListaNaoResolvidas();
  atualizarBotaoFinalizar();
}

els.btnNext.addEventListener('click', () => {
  if (state.indiceAtual < state.questoes.length - 1) {
    state.indiceAtual++;
    renderizarQuestao();
  }
});

els.btnPrev.addEventListener('click', () => {
  if (state.indiceAtual > 0) {
    state.indiceAtual--;
    renderizarQuestao();
  }
});

els.btnFinish.addEventListener('click', () => {
  if (!todasResolvidas()) {
    alert('Responda todas as questões antes de finalizar.');
    return;
  }
  mostrarResultado();
});

els.btnQuit.addEventListener('click', () => {
  if (confirm('Deseja sair? Seu progresso será perdido.')) resetarApp();
});

/* =========================================================
   MÓDULO 7 — RESULTADO
   ========================================================= */
function mostrarResultado() {
  els.stepQuiz.classList.add('hidden');
  els.stepResult.classList.remove('hidden');

  recalcularAcertos();
  const total = state.questoes.length;
  const acertos = state.acertos;
  const erros = total - acertos;
  const percentual = Math.round((acertos / total) * 100);

  els.scoreSummary.innerHTML = `
    <div class="score-box correct"><span class="num">${acertos}</span><span class="label">Acertos</span></div>
    <div class="score-box wrong"><span class="num">${erros}</span><span class="label">Erros</span></div>
    <div class="score-box percent"><span class="num">${percentual}%</span><span class="label">Aproveitamento</span></div>
  `;

  els.resultList.innerHTML = '';
  state.questoes.forEach(q => {
    const gab = state.gabarito[q.numero];
    const resposta = state.respostas[q.numero];
    const acertou = gab && resposta === gab.letra;

    const item = document.createElement('div');
    item.className = 'result-item' + (acertou ? '' : ' incorrect');

    const letras = ['A', 'B', 'C', 'D', 'E'].filter(l => q.alternativas[l]);
    const opcoesHtml = letras.map(letra => {
      let cls = 'opt';
      if (gab && gab.letra === letra) cls += ' correct';
      if (resposta === letra && (!gab || gab.letra !== letra)) cls += ' wrong';
      return `<div class="${cls}">(${letra}) ${q.alternativas[letra]}</div>`;
    }).join('');

    const comentarioHtml = gab
      ? `<div class="comment"><strong>Gabarito:</strong> (${gab.letra}) — ${gab.comentario}</div>`
      : `<div class="comment"><em>Sem comentário disponível.</em></div>`;

    item.innerHTML = `
      <h3>
        <span class="badge ${acertou ? 'ok' : 'no'}">${acertou ? 'Acertou' : 'Errou'}</span>
        <span>Questão ${q.numero} — Sua resposta: (${resposta || '—'})</span>
      </h3>
      <div style="font-size:.92rem;margin-bottom:8px;white-space:pre-line">${q.enunciado}</div>
      <div class="result-options">${opcoesHtml}</div>
      ${comentarioHtml}
    `;
    els.resultList.appendChild(item);
  });
}

/* =========================================================
   MÓDULO 8 — RESET E MODAL
   ========================================================= */
els.btnRestart.addEventListener('click', () => {
  state.indiceAtual = 0;
  state.respostas = {};
  state.acertos = 0;
  state.acertosVisivel = true;
  atualizarBotaoToggleScore();
  els.stepResult.classList.add('hidden');
  els.stepQuiz.classList.remove('hidden');
  renderizarQuestao();
});

els.btnNew.addEventListener('click', resetarApp);

function resetarApp() {
  state.questoes = []; state.gabarito = {};
  state.indiceAtual = 0; state.respostas = {}; state.acertos = 0;
  state.acertosVisivel = true;
  atualizarBotaoToggleScore();
  els.stepQuiz.classList.add('hidden');
  els.stepResult.classList.add('hidden');
  els.stepImport.classList.remove('hidden');
  els.inputQuestions.value = '';
  els.inputGabarito.value = '';
  atualizarStatusImportacao();
}

// --- CONTROLE DO MODAL (POPUP) ---
function fecharModal() {
  document.getElementById('text-modal').classList.add('hidden');
}

document.getElementById('btn-close-modal').addEventListener('click', fecharModal);
document.getElementById('btn-close-modal-footer').addEventListener('click', fecharModal);

// Fecha o modal ao clicar fora da caixa branca
document.getElementById('text-modal').addEventListener('click', (e) => {
  if (e.target.id === 'text-modal') fecharModal();
});

// Fecha o modal com a tecla Esc
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const modal = document.getElementById('text-modal');
    if (!modal.classList.contains('hidden')) fecharModal();
  }
});

/* Init */
atualizarStatusImportacao();
atualizarBotaoToggleScore();