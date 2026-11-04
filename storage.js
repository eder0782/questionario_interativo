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

   Para migrar: Repositorio.usar(new FirestoreAdapter(db, uid));
   ========================================================= */
(function (global) {
  'use strict';

  const SCHEMA_VERSION = 1;

  const COLECOES = {
    PREFERENCIAS: 'preferencias', // doc único "app": tema, última configuração, rascunho
    SESSOES: 'sessoes',           // simulados em andamento (estado completo)
    HISTORICO: 'historico'        // resumo de cada simulado finalizado
  };

  /* ---------------------------------------------------------
     Adaptador localStorage (com fallback em memória se o
     navegador bloquear o armazenamento, ex.: modo privado)
     --------------------------------------------------------- */
  class LocalStorageAdapter {
    constructor({ namespace = 'simulado', userId = 'local' } = {}) {
      this.ns = `${namespace}:${userId}`;
      this.memoria = null;
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
    async listarHistorico(limite = 20) {
      const docs = await this.adapter.listDocs(COLECOES.HISTORICO, { orderBy: 'data', direction: 'desc', limit: limite });
      return docs.map(migrar);
    },
    async limparHistorico() { return this.adapter.deleteCollection(COLECOES.HISTORICO); },

    /* Backup — também serve para importar os dados no Firebase depois */
    async exportarBackup() {
      return {
        app: 'simulado-interativo',
        schemaVersion: SCHEMA_VERSION,
        exportadoEm: agora(),
        preferencias: await this.adapter.getDoc(COLECOES.PREFERENCIAS, 'app'),
        sessoes: await this.adapter.listDocs(COLECOES.SESSOES),
        historico: await this.adapter.listDocs(COLECOES.HISTORICO)
      };
    },
    async importarBackup(backup) {
      if (!backup || backup.app !== 'simulado-interativo') throw new Error('Arquivo de backup inválido.');
      if (backup.preferencias) await this.adapter.setDoc(COLECOES.PREFERENCIAS, 'app', backup.preferencias);
      for (const s of backup.sessoes || []) if (s && s.id) await this.adapter.setDoc(COLECOES.SESSOES, s.id, s);
      for (const h of backup.historico || []) if (h && h.id) await this.adapter.setDoc(COLECOES.HISTORICO, h.id, h);
    }
  };

  global.SimuladoStorage = { SCHEMA_VERSION, COLECOES, LocalStorageAdapter, Repositorio };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.SimuladoStorage;
})(typeof window !== 'undefined' ? window : globalThis);

/* =========================================================
   MODELO — Adaptador Firebase (Firestore), para o futuro.
   ---------------------------------------------------------
   1. No index.html, troque as tags <script> por módulos e carregue o SDK:
        <script type="module">
          import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
          import { getAuth, signInAnonymously } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
          import { getFirestore, doc, getDoc, setDoc, deleteDoc, collection,
                   query, where, orderBy, limit, getDocs }
            from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
          ...
        </script>

   2. Adaptador com a MESMA interface do LocalStorageAdapter:

      class FirestoreAdapter {
        constructor(db, userId) { this.db = db; this.userId = userId; }
        _col(c) { return collection(this.db, 'usuarios', this.userId, c); }  // usuarios/{uid}/{colecao}/{id}
        async getDoc(c, id) { const s = await getDoc(doc(this._col(c), id)); return s.exists() ? s.data() : null; }
        async setDoc(c, id, d) { await setDoc(doc(this._col(c), id), d); return d; }
        async deleteDoc(c, id) { await deleteDoc(doc(this._col(c), id)); }
        async listDocs(c, { where: w, orderBy: o, direction = 'desc', limit: l } = {}) {
          const filtros = [];
          if (w) for (const [k, v] of Object.entries(w)) filtros.push(where(k, '==', v));
          if (o) filtros.push(orderBy(o, direction));
          if (l) filtros.push(limit(l));
          const snap = await getDocs(query(this._col(c), ...filtros));
          return snap.docs.map(d => d.data());
        }
        async deleteCollection(c) {
          const snap = await getDocs(this._col(c));
          await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
        }
      }

   3. Na inicialização (script.js, função init), troque UMA linha:
        Repositorio.usar(new LocalStorageAdapter({ namespace: 'simulado-interativo' }));
      por:
        const cred = await signInAnonymously(getAuth(app));
        Repositorio.usar(new FirestoreAdapter(getFirestore(app), cred.user.uid));

   4. Observações:
      - A consulta de sessão em andamento usa where(status) + orderBy(atualizadoEm):
        o Firestore vai pedir um índice composto (o link aparece no console).
      - Regras de segurança sugeridas:
          match /usuarios/{uid}/{doc=**} { allow read, write: if request.auth.uid == uid; }
      - Para levar os dados atuais: "Exportar backup" aqui, e depois
        Repositorio.importarBackup(json) já com o FirestoreAdapter ativo.
   ========================================================= */
