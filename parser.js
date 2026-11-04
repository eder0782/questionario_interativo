/* =========================================================
   Simulado Interativo — parser.js
   Funções puras (sem DOM): leem o texto colado e devolvem
   estruturas de dados. Podem ser testadas no Node.
   ========================================================= */
(function (global) {
  'use strict';

  /* ---------- Expressões regulares ---------- */
  const RE_MODULO = /^[^\p{L}\p{N}]*(?:M[ÓO]DULO\b|(?:DISCIPLINA|ASSUNTO|MAT[ÉE]RIA)\s*:)/iu;
  const RE_ROTULO = /^\s*Quest[õo]es\s+\d+\s+a\s+\d+\s*(?:\(.*?\))?\s*:?\s*$/i;
  const RE_SEPARADOR = /^\s*[_\-–—=*]{3,}\s*$/;
  // "1." / "1)" — não aceita "1.5" (número decimal)
  const RE_QUESTAO = /^\s*(\d{1,3})\s*[.)](?!\d)\s*(.*)$/;
  // "Questão 1", "QUESTÃO 01 -", "Questão nº 3:"
  const RE_QUESTAO_PREFIXO = /^\s*quest[ãa]o\s*(?:n[º°o.]?\s*)?(\d{1,3})\b\s*[.):\-–—]?\s*(.*)$/i;
  // Comando típico do Cebraspe: "Julgue os itens a seguir..."
  const RE_COMANDO_CE = /julgue\s+(?:o|os)\s+(?:\S+\s+){0,2}ite(?:m|ns)\b/i;
  // Marcas explícitas de item Certo/Errado
  const MARCA_CE = String.raw`\(\s*\)\s*(?:certo|errado)\b|\b(?:certo|errado)\s*\(\s*\)|\[\s*\]\s*(?:certo|errado)\b|\(\s*C\s*\)\s*\(\s*E\s*\)|\bC\s*\(\s*\)\s*E\s*\(\s*\)`;
  const RE_MARCA_CE = new RegExp(MARCA_CE, 'i');
  const RE_MARCA_CE_G = new RegExp(MARCA_CE, 'gi');

  const SEQ = 'ABCDE';

  /* ---------- Utilidades ---------- */
  function matchQuestao(t) {
    let m = t.match(RE_QUESTAO_PREFIXO);
    if (m) return { numero: parseInt(m[1], 10), resto: m[2] || '', prefixado: true };
    m = t.match(RE_QUESTAO);
    if (m) return { numero: parseInt(m[1], 10), resto: m[2] || '', prefixado: false };
    return null;
  }

  function nomeModulo(t) {
    return t.replace(/^[^\p{L}\p{N}]+/u, '').replace(/\s+/g, ' ').trim();
  }

  function getCabecalhoTexto(txt) {
    const m = txt.match(/(?:quest[õo]es?|questions?)(?:\s+de\s+n[úu]meros?)?\s+(\d+)(?:\s*(?:a|até|à|to|–|-|—)\s*(\d+))?/i);
    if (m && /texto|trecho|considere|atenção|leia|text\b|read\b|responda|answer/i.test(txt)) {
      return {
        de: parseInt(m[1], 10),
        ate: m[2] ? parseInt(m[2], 10) : parseInt(m[1], 10),
        fimIntervalo: m.index + m[0].length
      };
    }
    return null;
  }

  /**
   * Junta linhas quebradas (copiadas de PDF) em parágrafos.
   * Quebra quando: linha em branco, início de lista (I -, a), •, 1.),
   * ou frase anterior terminou e a nova começa com maiúscula.
   */
  function juntarParagrafos(linhas, { quebraCurta = false } = {}) {
    const pars = [];
    let atual = '';
    const inicioLista = /^(?:[IVXLC]+\s*[.)\-–—]\s|[-•▪●–]\s|\d{1,2}\s*[.)]\s|[a-e]\)\s)/;
    for (const bruta of linhas) {
      const l = bruta.trim();
      if (!l) {
        if (atual) { pars.push(atual); atual = ''; }
        continue;
      }
      if (!atual) { atual = l; continue; }
      const fimFrase = /[.!?:;]["”»)]?$/.test(atual);
      const comecaMaiuscula = /^[A-ZÀ-ÚÇ"“(«]/.test(l);
      const anteriorCurta = quebraCurta && atual.length < 50 && !fimFrase && !/,$/.test(atual);
      if (inicioLista.test(l) || (fimFrase && comecaMaiuscula) || anteriorCurta) {
        pars.push(atual);
        atual = l;
      } else {
        atual += ' ' + l;
      }
    }
    if (atual) pars.push(atual);
    return pars;
  }

  /**
   * Procura a sequência de alternativas A, B, C… dentro do bloco.
   * Aceita (A), [A], A) e a). Usa a ÚLTIMA sequência válida (≥ 2 letras
   * consecutivas começando em A), o que evita confundir "(a)" no enunciado.
   */
  function extrairAlternativas(bloco) {
    const re = /(^|[\s:])(?:\(([A-Ea-e])\)|\[([A-Ea-e])\]|([A-Ea-e])\))/g;
    const marcas = [];
    let m;
    while ((m = re.exec(bloco)) !== null) {
      marcas.push({
        letra: (m[2] || m[3] || m[4]).toUpperCase(),
        inicio: m.index + m[1].length,
        fim: re.lastIndex
      });
    }
    let melhor = null;
    let atual = null;
    for (const mk of marcas) {
      if (mk.letra === 'A') { atual = [mk]; continue; }
      if (atual && mk.letra === SEQ[atual.length]) {
        atual.push(mk);
        if (atual.length >= 2) melhor = atual;
      }
    }
    if (!melhor) return null;

    const mapa = {};
    melhor.forEach((mk, k) => {
      const fimTxt = k + 1 < melhor.length ? melhor[k + 1].inicio : bloco.length;
      const txt = bloco.slice(mk.fim, fimTxt).replace(/\s+/g, ' ').trim().replace(/[.;:]+\s*$/, '').trim();
      if (txt) mapa[mk.letra] = txt;
    });
    if (Object.keys(mapa).length < 2) return null;
    return { inicio: melhor[0].inicio, mapa };
  }

  function lerTextoBase(linhas, i, cab) {
    const conteudo = [];
    let j = i;
    while (j < linhas.length) {
      const nt = linhas[j].trim();
      if (j > i && (RE_QUESTAO.test(nt) || RE_QUESTAO_PREFIXO.test(nt) || getCabecalhoTexto(nt) ||
                    RE_MODULO.test(nt) || RE_COMANDO_CE.test(nt))) break;
      conteudo.push(nt);
      j++;
    }
    // Remove do cabeçalho a instrução ("...questões 1 a 3, considere o texto abaixo:")
    const cabecalho = conteudo[0] || '';
    const depois = cabecalho.slice(cab.fimIntervalo);
    const corte = depois.search(/[.:]/);
    const sobra = corte >= 0 ? depois.slice(corte + 1).trim() : '';
    let raw = [sobra, ...conteudo.slice(1)].join('\n').trim();
    raw = raw.replace(/^["“”'‘’]+/, '').replace(/["“”'‘’]+$/, '').trim();

    const pars = juntarParagrafos(raw.split('\n'), { quebraCurta: true });
    return { de: cab.de, ate: cab.ate, texto: pars.join('\n\n'), proximo: j };
  }

  function construirQuestao(cur) {
    const bloco = cur.linhas.join('\n').trim();
    const alts = extrairAlternativas(bloco);
    const base = {
      numero: cur.numero,
      modulo: cur.modulo,
      moduloIdx: cur.moduloIdx,
      textoBase: cur.textoBase,
      comando: cur.comando
    };
    if (alts) {
      const enunciado = juntarParagrafos(bloco.slice(0, alts.inicio).split('\n')).join('\n');
      return { ...base, tipo: 'multipla', enunciado, alternativas: alts.mapa, ceExplicito: false };
    }
    const ceExplicito = RE_MARCA_CE.test(bloco);
    const limpo = bloco.replace(RE_MARCA_CE_G, ' ');
    const enunciado = juntarParagrafos(limpo.split('\n')).join('\n').trim();
    if (!enunciado) return null;
    return { ...base, tipo: 'ce', enunciado, alternativas: { C: 'Certo', E: 'Errado' }, ceExplicito };
  }

  /* =========================================================
     QUESTÕES
     ========================================================= */
  function importarQuestoes(texto) {
    if (!texto || !texto.trim()) return [];
    const linhas = texto.replace(/\r\n?/g, '\n').split('\n');
    const questoes = [];

    let modulo = null;
    let moduloIdx = 0;
    let textos = {};          // texto-base por número, válido dentro do módulo atual
    let comando = null;       // linhas do comando "Julgue os itens..."
    let comandoAberto = false;
    let cur = null;

    const fechar = () => {
      if (cur) {
        const q = construirQuestao(cur);
        if (q) {
          // Comando "Julgue os itens" vale só para o grupo de itens Certo/Errado
          if (q.tipo === 'multipla') { q.comando = null; comando = null; comandoAberto = false; }
          questoes.push(q);
        }
        cur = null;
      }
    };
    const podeIniciar = (qm) =>
      !cur || qm.prefixado || qm.numero > cur.numero || extrairAlternativas(cur.linhas.join('\n')) !== null;

    for (let i = 0; i < linhas.length; i++) {
      const t = linhas[i].trim();

      if (!t) { if (cur) cur.linhas.push(''); continue; }

      if (RE_MODULO.test(t)) {
        fechar();
        modulo = nomeModulo(t);
        moduloIdx++;
        textos = {};
        comando = null; comandoAberto = false;
        continue;
      }
      if (RE_SEPARADOR.test(t) || RE_ROTULO.test(t)) { fechar(); comandoAberto = false; continue; }

      const qm = matchQuestao(t);
      if (!qm) {
        const cab = getCabecalhoTexto(t);
        if (cab) {
          fechar();
          comando = null; comandoAberto = false;
          const tb = lerTextoBase(linhas, i, cab);
          if (tb.texto) {
            for (let n = tb.de; n <= tb.ate; n++) textos[n] = { de: tb.de, ate: tb.ate, texto: tb.texto };
          }
          i = tb.proximo - 1;
          continue;
        }
        if (RE_COMANDO_CE.test(t)) { fechar(); comando = [t]; comandoAberto = true; continue; }
        if (cur) { cur.linhas.push(t); continue; }
        if (comandoAberto) { comando.push(t); continue; }
        continue; // linha solta antes de qualquer questão: ignorada
      }

      if (podeIniciar(qm)) {
        fechar();
        comandoAberto = false;
        cur = {
          numero: qm.numero,
          linhas: [qm.resto],
          modulo,
          moduloIdx,
          textoBase: textos[qm.numero] || null,
          comando: comando ? juntarParagrafos(comando).join('\n') : null
        };
      } else {
        cur.linhas.push(t); // número dentro do enunciado (lista, ano etc.)
      }
    }
    fechar();
    return questoes;
  }

  /* =========================================================
     GABARITO
     ========================================================= */
  const RE_GAB = /^\s*(?:quest[ãa]o\s*(?:n[º°o.]?\s*)?)?(\d{1,3})(?:\s*[.)\-–—:]\s*|\s+)(?:(?:letra|gabarito|resposta|alternativa)\s*:?\s*)?\(?([A-Za-zÀ-ú]+)\)?(.*)$/i;
  const RE_GAB_COMPACTO = /(\d{1,3})\s*[.)\-–—:]?\s*\(?(certo|errado|anulad[ao]|[A-E])\)?(?=[\s,;|/]|$)/gi;

  function normalizarResposta(token, resto) {
    const up = token.toUpperCase();
    if (up === 'CERTO') return 'C';
    if (up === 'ERRADO') return 'E';
    if (up === 'ANULADA' || up === 'ANULADO') return 'X';
    if (/^[A-E]$/.test(up)) {
      // Letra isolada precisa vir seguida de separador ou fim de linha
      // (evita confundir "1. A lei diz..." com resposta A)
      if (!/^\s*(?:[—\-–:.)]|$)/.test(resto)) return null;
      return up;
    }
    return null;
  }

  function importarGabarito(texto) {
    if (!texto || !texto.trim()) return [];
    const linhas = texto.replace(/\r\n?/g, '\n').split('\n');
    const entradas = [];
    let atual = null;

    for (const linha of linhas) {
      const t = linha.trim();
      if (!t) continue;
      if (RE_MODULO.test(t) || RE_SEPARADOR.test(t)) { atual = null; continue; }

      // Formato compacto: "1-A 2-C 3-E" (duas ou mais respostas na mesma linha)
      const compactos = [...t.matchAll(RE_GAB_COMPACTO)];
      if (compactos.length >= 2 && t.replace(RE_GAB_COMPACTO, '').replace(/[\s,;|/]/g, '') === '') {
        compactos.forEach(m => {
          const r = normalizarResposta(m[2], '');
          if (r) entradas.push({ numero: parseInt(m[1], 10), resposta: r, comentario: '' });
        });
        atual = null;
        continue;
      }

      const m = t.match(RE_GAB);
      const resp = m ? normalizarResposta(m[2], m[3]) : null;
      if (m && resp) {
        atual = {
          numero: parseInt(m[1], 10),
          resposta: resp,
          comentario: m[3].replace(/^\s*[.)\-–—:]+\s*/, '').trim()
        };
        entradas.push(atual);
      } else if (atual) {
        atual.comentario += (atual.comentario ? ' ' : '') + t;
      }
    }
    return entradas;
  }

  /* =========================================================
     MONTAGEM: pareia questões e gabarito
     A chave é "número#ocorrência": a 1ª Q1 casa com a 1ª linha
     "1." do gabarito, a 2ª Q1 (outro módulo) com a 2ª, e assim por diante.
     ========================================================= */
  function rotulo(q) {
    return q.modulo ? `Q${q.numero} · ${q.modulo}` : `Q${q.numero}`;
  }

  function montarSimulado(textoQuestoes, textoGabarito) {
    const qs = importarQuestoes(textoQuestoes);
    const gs = importarGabarito(textoGabarito);

    const contQ = {};
    qs.forEach(q => {
      contQ[q.numero] = (contQ[q.numero] || 0) + 1;
      q.key = `${q.numero}#${contQ[q.numero]}`;
    });
    const contG = {};
    const mapaG = {};
    gs.forEach(g => {
      contG[g.numero] = (contG[g.numero] || 0) + 1;
      g.key = `${g.numero}#${contG[g.numero]}`;
      mapaG[g.key] = g;
    });

    const avisos = {
      semGabarito: [], gabaritoSemQuestao: [], letraInvalida: [],
      descartadas: 0, numerosRepetidos: Object.values(contQ).some(c => c > 1)
    };
    const finais = [];
    const usadas = new Set();

    for (const q of qs) {
      const g = mapaG[q.key];
      // Bloco numerado sem alternativas só vira item Certo/Errado se tiver
      // marca explícita "( ) Certo" ou se o gabarito disser Certo/Errado.
      if (q.tipo === 'ce' && !q.ceExplicito && (!g || !['C', 'E', 'X'].includes(g.resposta))) {
        avisos.descartadas++;
        continue;
      }
      q.gabarito = g ? { resposta: g.resposta, comentario: g.comentario } : null;
      if (!g) avisos.semGabarito.push(rotulo(q));
      else {
        usadas.add(g.key);
        if (g.resposta !== 'X' && !q.alternativas[g.resposta]) {
          avisos.letraInvalida.push(`${rotulo(q)} (gabarito: ${g.resposta})`);
        }
      }
      delete q.ceExplicito;
      finais.push(q);
    }
    gs.forEach(g => { if (!usadas.has(g.key)) avisos.gabaritoSemQuestao.push(`${g.numero}`); });

    return { questoes: finais, totalGabarito: gs.length, avisos };
  }

  const api = { importarQuestoes, importarGabarito, montarSimulado, extrairAlternativas, rotulo };
  global.SimuladoParser = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
