:root {
  --primary:#2563eb; --primary-dark:#1d4ed8;
  --success:#16a34a; --success-bg:#dcfce7;
  --danger:#dc2626; --danger-bg:#fee2e2;
  --bg:#f1f5f9; --card:#fff; --text:#1e293b;
  --muted:#64748b; --border:#e2e8f0;
}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
     background:var(--bg);color:var(--text);line-height:1.6;min-height:100vh;padding:20px}
.container{max-width:850px;margin:0 auto}
header{text-align:center;margin-bottom:24px}
header h1{font-size:1.8rem;color:var(--primary-dark);margin-bottom:4px}
header p{color:var(--muted);font-size:.95rem}
.card{background:var(--card);border-radius:12px;padding:24px;
      box-shadow:0 1px 3px rgba(0,0,0,.08);margin-bottom:20px}
h2{font-size:1.15rem;margin-bottom:6px}
.hint{font-size:.85rem;color:var(--muted);margin-bottom:12px}
textarea{width:100%;min-height:180px;padding:12px;border:1px solid var(--border);
         border-radius:8px;font-family:ui-monospace,Consolas,monospace;font-size:.85rem;
         resize:vertical;background:#fafafa}
textarea:focus{outline:none;border-color:var(--primary);background:#fff}
.status{font-size:.85rem;margin-top:8px;padding:6px 10px;border-radius:6px;display:inline-block}
.status.ok{background:var(--success-bg);color:var(--success)}
.status.error{background:var(--danger-bg);color:var(--danger)}
.status.empty{background:#f1f5f9;color:var(--muted)}
button{font-family:inherit;font-size:.95rem;font-weight:600;border:none;
       border-radius:8px;padding:12px 22px;cursor:pointer;transition:all .15s}
.btn-primary{background:var(--primary);color:#fff}
.btn-primary:hover:not(:disabled){background:var(--primary-dark)}
.btn-secondary{background:#e2e8f0;color:var(--text)}
.btn-secondary:hover:not(:disabled){background:#cbd5e1}
button:disabled{opacity:.5;cursor:not-allowed}
.actions{display:flex;gap:12px;flex-wrap:wrap;justify-content:space-between;align-items:center}
.progress-bar{height:8px;background:var(--border);border-radius:4px;overflow:hidden;margin-bottom:20px}
.progress-fill{height:100%;background:var(--primary);transition:width .3s ease}
.question-meta{font-size:.85rem;color:var(--muted);margin-bottom:8px;
               display:flex;justify-content:space-between;align-items:center}
.question-meta .right{display:flex;align-items:center;gap:8px}
.btn-toggle{background:transparent;border:1px solid var(--border);border-radius:6px;
            padding:3px 8px;font-size:.8rem;cursor:pointer;color:var(--muted);
            font-weight:500;line-height:1.2}
.btn-toggle:hover{background:#f1f5f9;color:var(--text)}

/* Alteração na caixa de aviso do texto base */
.text-base{background:#f8fafc;border-left:4px solid var(--primary);padding:12px 16px;
           border-radius:6px;font-size:.95rem;color:var(--text);margin-bottom:16px;
           display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;}

.question-text{font-size:1.05rem;font-weight:600;margin-bottom:18px;white-space:pre-line}
.options{display:flex;flex-direction:column;gap:10px}
.option{display:flex;align-items:flex-start;gap:12px;padding:14px 16px;
        border:2px solid var(--border);border-radius:8px;cursor:pointer;
        transition:all .15s;background:#fff;font-size:.95rem}
.option:hover{border-color:#cbd5e1;background:#f8fafc}
.option.selected{border-color:var(--primary);background:#eff6ff}
.option-letter{font-weight:700;color:var(--primary);min-width:22px;flex-shrink:0}
.score-summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));
               gap:16px;margin-bottom:24px}
.score-box{text-align:center;padding:20px;border-radius:10px;background:#f8fafc}
.score-box .num{font-size:2.2rem;font-weight:700;display:block;line-height:1}
.score-box .label{font-size:.85rem;color:var(--muted);margin-top:6px}
.score-box.correct .num{color:var(--success)}
.score-box.wrong .num{color:var(--danger)}
.score-box.percent .num{color:var(--primary)}
.result-item{border-left:4px solid var(--success);background:#f8fafc;
             border-radius:6px;padding:16px;margin-bottom:14px}
.result-item.incorrect{border-left-color:var(--danger);background:var(--danger-bg)}
.result-item h3{font-size:.95rem;margin-bottom:10px;display:flex;
                align-items:center;gap:8px;flex-wrap:wrap}
.badge{font-size:.75rem;font-weight:700;padding:3px 9px;border-radius:20px;text-transform:uppercase}
.badge.ok{background:var(--success);color:#fff}
.badge.no{background:var(--danger);color:#fff}
.result-options{display:flex;flex-direction:column;gap:6px;margin:10px 0;font-size:.88rem}
.result-options .opt{padding:6px 10px;border-radius:5px;color:#475569}
.result-options .opt.correct{background:var(--success-bg);color:var(--success);font-weight:600}
.result-options .opt.wrong{background:#fef2f2;color:var(--danger);text-decoration:line-through}
.comment{margin-top:10px;padding-top:10px;border-top:1px dashed #cbd5e1;
         font-size:.88rem;color:#475569}
.comment strong{color:var(--text)}
.hidden{display:none}

.unanswered-card h2{display:flex;align-items:center;gap:8px;margin-bottom:4px}
.unanswered-count{font-size:.85rem;color:var(--muted);font-weight:500}
.unanswered-list{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;min-height:34px}
.unanswered-chip{padding:6px 14px;background:#eff6ff;color:var(--primary);
                 border:1px solid #bfdbfe;border-radius:20px;cursor:pointer;
                 font-size:.85rem;font-weight:600;font-family:inherit;
                 transition:all .15s;line-height:1.2}
.unanswered-chip:hover{background:var(--primary);color:#fff;border-color:var(--primary);
                       transform:translateY(-1px)}
.all-done{color:var(--success);font-size:.9rem;font-weight:600;display:flex;align-items:center;gap:6px}

.btn-finish.ready{animation:pulse 1.6s infinite}
@keyframes pulse{
  0%,100%{box-shadow:0 0 0 0 rgba(37,99,235,.55)}
  50%{box-shadow:0 0 0 10px rgba(37,99,235,0)}
}

/* --- ESTILOS DO MODAL (POPUP) --- */
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  padding: 20px;
}
.modal-overlay.hidden {
  display: none;
}
.modal-content {
  background: #fff;
  border-radius: 12px;
  width: 100%;
  max-width: 800px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 25px rgba(0,0,0,0.2);
  animation: modalFadeIn 0.2s ease;
}
@keyframes modalFadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  border-bottom: 1px solid var(--border);
  background: #f8fafc;
  border-radius: 12px 12px 0 0;
}
.modal-header h3 {
  font-size: 1.1rem;
  color: var(--primary-dark);
  margin: 0;
}
.btn-close {
  background: transparent;
  border: none;
  font-size: 1.8rem;
  line-height: 1;
  color: var(--muted);
  cursor: pointer;
  padding: 0;
  transition: color 0.15s;
}
.btn-close:hover {
  color: var(--danger);
}
.modal-body {
  padding: 24px;
  overflow-y: auto;
  font-size: 1rem;
  color: var(--text);
  line-height: 1.8;
  white-space: pre-wrap; /* Preserva os parágrafos pulados */
  text-align: justify;   /* Texto justificado */
}
.modal-footer {
  padding: 16px 24px;
  border-top: 1px solid var(--border);
  text-align: right;
  background: #f8fafc;
  border-radius: 0 0 12px 12px;
}
