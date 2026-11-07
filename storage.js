/* =========================================================
   Simulado Interativo — storage.js
   Camada de persistência em DUAS partes:

   1) ADAPTADOR — sabe falar com um banco específico.
      Interface (todos os métodos são assíncronos / retornam Promise):
        getDoc(colecao, id)                    → objeto | null
        setDoc(colecao, id, dados)             → dados
        deleteDoc(colecao, id)                 → void
        listDocs(colecao, { where, orderBy, direction, limit }) → objeto[]
        deleteCollection(colecao)              → void
      O modelo "coleção / documento" é o mesmo do Firestore, então a
      troca para Firebase é só escrever outro adaptador (modelo no fim).

   2) REPOSITÓRIO — regras do app (sessões, histórico, preferências).
      O resto do app SÓ conversa com o Repositorio, nunca com o banco.

   Uso: Repositorio.usar(new LocalStorageAdapter(...))  — sem login
        Repositorio.usar(new FirestoreAdapter(db, uid))   — logado
   ========================================================= */
(function (global) {
  'use strict';

  const SCHEMA_VERSION = 1;

  const COLECOES = {
    PREFERENCIAS: 'preferencias', // doc único "app": tema, última configuração, rascunho
    SESSOES: 'sessoes',           // simulados em andamento (estado completo)
    HISTORICO: 'historico',       // resumo de cada simulado finalizado (lista leve)
    RESULTADOS: 'resultados'      // simulado finalizado completo (questões + respostas), mesmo id do histórico
  };

  /* ---------------------------------------------------------
     Adaptador localStorage (com fallback em memória se o
     navegador bloquear o armazenamento, ex.: modo privado)
     --------------------------------------------------------- */
  class LocalStorageAdapter {
    constructor({ namespace = 'simulado', userId = 'local' } = {}) {
      this.ns = `${namespace}:${userId}`;
      this.memoria = null;
      this.tipo = 'local';
      this.intervaloSalvamento = 1500; // ms entre gravações automáticas
      try {
        const k = '__teste__';
        global.localStorage.setItem(k, '1');
        global.localStorage.removeItem(k);
      } catch (e) {
        this.memoria = new Map();
      }
    }
    get persistente() { return !this.memoria; }

    _chave(col, id) { return `${this.ns}:${col}:${id}`; }
    _ler(k) { return this.memoria ? (this.memoria.get(k) ?? null) : global.localStorage.getItem(k); }
    _gravar(k, v) { this.memoria ? this.memoria.set(k, v) : global.localStorage.setItem(k, v); }
    _apagar(k) { this.memoria ? this.memoria.delete(k) : global.localStorage.removeItem(k); }
    _chaves() {
      if (this.memoria) return [...this.memoria.keys()];
      const ls = global.localStorage;
      return Array.from({ length: ls.length }, (_, i) => ls.key(i));
    }

    async getDoc(col, id) {
      const raw = this._ler(this._chave(col, id));
      if (!raw) return null;
      try { return JSON.parse(raw); } catch (e) { return null; }
    }
    async setDoc(col, id, dados) {
      this._gravar(this._chave(col, id), JSON.stringify(dados)); // pode lançar QuotaExceededError
      return dados;
    }
    async deleteDoc(col, id) { this._apagar(this._chave(col, id)); }

    async listDocs(col, { where, orderBy, direction = 'desc', limit } = {}) {
      const prefixo = this._chave(col, '');
      let docs = this._chaves()
        .filter(k => k && k.startsWith(prefixo))
        .map(k => { try { return JSON.parse(this._ler(k)); } catch (e) { return null; } })
        .filter(Boolean);
      if (where) docs = docs.filter(d => Object.entries(where).every(([c, v]) => d[c] === v));
      if (orderBy) {
        const sinal = direction === 'desc' ? -1 : 1;
        docs.sort((a, b) => (a[orderBy] < b[orderBy] ? -1 : a[orderBy] > b[orderBy] ? 1 : 0) * sinal);
      }
      if (limit) docs = docs.slice(0, limit);
      return docs;
    }
    async deleteCollection(col) {
      const prefixo = this._chave(col, '');
      this._chaves().filter(k => k && k.startsWith(prefixo)).forEach(k => this._apagar(k));
    }
  }

  /* ---------------------------------------------------------
     Adaptador Firestore (SDK "compat" do Firebase, carregado por
     <script>). Caminho: usuarios/{uid}/{colecao}/{id}
     --------------------------------------------------------- */
  const ESPERA_MAX_GRAVACAO = 4000;

  class FirestoreAdapter {
    constructor(db, userId) {
      this.db = db;
      this.userId = userId;
      this.tipo = 'nuvem';
      // Cada gravação conta na cota gratuita: o cronômetro salva a cada 10 s
      this.intervaloSalvamento = 10000;
    }
    get persistente() { return true; }
    _col(c) { return this.db.collection('usuarios').doc(this.userId).collection(c); }

    // Offline, o Firestore guarda a gravação na fila local e só confirma quando
    // a conexão volta. Não deixamos a tela travada esperando essa confirmação.
    async _semTravar(promessa) {
      let falhou = null;
      const p = promessa.catch(e => { falhou = e; console.error('[Firestore]', e); });
      await Promise.race([p, new Promise(r => setTimeout(r, ESPERA_MAX_GRAVACAO))]);
      if (falhou) throw falhou;
    }

    async getDoc(c, id) {
      const snap = await this._col(c).doc(id).get();
      return snap.exists ? snap.data() : null;
    }
    async setDoc(c, id, dados) {
      await this._semTravar(this._col(c).doc(id).set(dados));
      return dados;
    }
    async deleteDoc(c, id) {
      await this._semTravar(this._col(c).doc(id).delete());
    }
    async listDocs(c, { where, orderBy, direction = 'desc', limit } = {}) {
      let q = this._col(c);
      if (where) {
        // where + orderBy exigiria índice composto: filtramos no servidor e ordenamos aqui
        for (const [k, v] of Object.entries(where)) q = q.where(k, '==', v);
      } else {
        if (orderBy) q = q.orderBy(orderBy, direction);
        if (limit) q = q.limit(limit);
      }
      const snap = await q.get();
      let docs = snap.docs.map(d => d.data());
      if (where) {
        if (orderBy) {
          const sinal = direction === 'desc' ? -1 : 1;
          docs.sort((a, b) => (a[orderBy] < b[orderBy] ? -1 : a[orderBy] > b[orderBy] ? 1 : 0) * sinal);
        }
        if (limit) docs = docs.slice(0, limit);
      }
      return docs;
    }
    async deleteCollection(c) {
      const snap = await this._col(c).get();
      for (let i = 0; i < snap.docs.length; i += 400) {
        const lote = this.db.batch();
        snap.docs.slice(i, i + 400).forEach(d => lote.delete(d.ref));
        await this._semTravar(lote.commit());
      }
    }
  }

  /* ---------------------------------------------------------
     Repositório — API usada pelo app
     --------------------------------------------------------- */
  const agora = () => new Date().toISOString();
  // Remove undefined/funções (o Firestore rejeita undefined) e desacopla referências
  const serializavel = obj => JSON.parse(JSON.stringify(obj));

  // Ponto único para atualizar documentos antigos quando o formato mudar
  function migrar(doc) {
    if (!doc) return doc;
    // if ((doc.schemaVersion || 1) < 2) { ...converter...; doc.schemaVersion = 2; }
    return doc;
  }

  const Repositorio = {
    adapter: null,

    usar(adapter) { this.adapter = adapter; return this; },

    /* Preferências */
    async carregarPreferencias() {
      return migrar(await this.adapter.getDoc(COLECOES.PREFERENCIAS, 'app')) || { schemaVersion: SCHEMA_VERSION };
    },
    async salvarPreferencias(prefs) {
      const doc = serializavel({ ...prefs, schemaVersion: SCHEMA_VERSION, atualizadoEm: agora() });
      return this.adapter.setDoc(COLECOES.PREFERENCIAS, 'app', doc);
    },

    /* Sessões (simulado em andamento) */
    async salvarSessao(sessao) {
      sessao.schemaVersion = SCHEMA_VERSION;
      sessao.atualizadoEm = agora();
      return this.adapter.setDoc(COLECOES.SESSOES, sessao.id, serializavel(sessao));
    },
    async carregarSessao(id) {
      return migrar(await this.adapter.getDoc(COLECOES.SESSOES, id));
    },
    async carregarSessaoEmAndamento() {
      const docs = await this.adapter.listDocs(COLECOES.SESSOES, {
        where: { status: 'andamento' }, orderBy: 'atualizadoEm', direction: 'desc', limit: 1
      });
      return migrar(docs[0] || null);
    },
    async excluirSessao(id) { return this.adapter.deleteDoc(COLECOES.SESSOES, id); },
    async excluirSessoesEmAndamento() {
      const docs = await this.adapter.listDocs(COLECOES.SESSOES, { where: { status: 'andamento' } });
      await Promise.all(docs.map(d => this.adapter.deleteDoc(COLECOES.SESSOES, d.id)));
    },

    /* Histórico */
    async registrarResultado(resumo) {
      const doc = serializavel({ ...resumo, schemaVersion: SCHEMA_VERSION });
      return this.adapter.setDoc(COLECOES.HISTORICO, doc.id, doc);
    },
    async listarHistorico(limite = null) { // null = todos (pesquisa e paginação são feitas no app)
      const docs = await this.adapter.listDocs(COLECOES.HISTORICO, { orderBy: 'data', direction: 'desc', limit: limite });
      return docs.map(migrar);
    },
    async renomearResultado(id, titulo) {
      const h = await this.adapter.getDoc(COLECOES.HISTORICO, id);
      if (!h) throw new Error('Simulado não encontrado.');
      await this.adapter.setDoc(COLECOES.HISTORICO, id, serializavel({ ...h, titulo }));
      const r = await this.adapter.getDoc(COLECOES.RESULTADOS, id);
      if (r) await this.adapter.setDoc(COLECOES.RESULTADOS, id, serializavel({ ...r, titulo }));
    },
    async limparHistorico() {
      await this.adapter.deleteCollection(COLECOES.HISTORICO);
      await this.adapter.deleteCollection(COLECOES.RESULTADOS);
    },

    /* Detalhes de um simulado finalizado (carregados só ao abrir) */
    async salvarDetalhes(sessao) {
      const doc = serializavel({ ...sessao, schemaVersion: SCHEMA_VERSION });
      return this.adapter.setDoc(COLECOES.RESULTADOS, doc.id, doc);
    },
    async carregarDetalhes(id) {
      return migrar(await this.adapter.getDoc(COLECOES.RESULTADOS, id));
    },
    async excluirResultado(id) {
      await this.adapter.deleteDoc(COLECOES.HISTORICO, id);
      await this.adapter.deleteDoc(COLECOES.RESULTADOS, id);
    },

    /* Conta nova? (sem preferências e sem histórico) */
    async estaVazio(adapter = this.adapter) {
      const prefs = await adapter.getDoc(COLECOES.PREFERENCIAS, 'app');
      const hist = await adapter.listDocs(COLECOES.HISTORICO, { limit: 1 });
      return !prefs && !hist.length;
    },

    /* Backup — também é usado para copiar os dados locais para a nuvem */
    async exportarBackup(adapter = this.adapter) {
      const a = adapter;
      return {
        app: 'simulado-interativo',
        schemaVersion: SCHEMA_VERSION,
        exportadoEm: agora(),
        preferencias: await a.getDoc(COLECOES.PREFERENCIAS, 'app'),
        sessoes: await a.listDocs(COLECOES.SESSOES),
        historico: await a.listDocs(COLECOES.HISTORICO),
        resultados: await a.listDocs(COLECOES.RESULTADOS)
      };
    },
    async importarBackup(backup) {
      if (!backup || backup.app !== 'simulado-interativo') throw new Error('Arquivo de backup inválido.');
      if (backup.preferencias) await this.adapter.setDoc(COLECOES.PREFERENCIAS, 'app', backup.preferencias);
      for (const s of backup.sessoes || []) if (s && s.id) await this.adapter.setDoc(COLECOES.SESSOES, s.id, s);
      for (const h of backup.historico || []) if (h && h.id) await this.adapter.setDoc(COLECOES.HISTORICO, h.id, h);
      for (const r of backup.resultados || []) if (r && r.id) await this.adapter.setDoc(COLECOES.RESULTADOS, r.id, r);
    }
  };

  global.SimuladoStorage = { SCHEMA_VERSION, COLECOES, LocalStorageAdapter, FirestoreAdapter, Repositorio };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.SimuladoStorage;
})(typeof window !== 'undefined' ? window : globalThis);

/* =========================================================
   Para trocar de banco no futuro (Supabase, API própria etc.):
   escreva outra classe com os mesmos 5 métodos assíncronos
   (getDoc, setDoc, deleteDoc, listDocs, deleteCollection)
   e passe-a para Repositorio.usar(...). O resto do app não muda.
   ========================================================= */
