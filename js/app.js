// Gerador de Atas — lógica da interface
(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const CH_CFG = 'atas.config.v1', CH_ATAS = 'atas.lista.v1', CH_ATUAL = 'atas.atual.v1';

  // ---------- armazenamento ----------
  const ler = (ch, padrao) => { try { const v = JSON.parse(localStorage.getItem(ch)); return v ?? padrao; } catch (_) { return padrao; } };
  const gravar = (ch, v) => { try { localStorage.setItem(ch, JSON.stringify(v)); } catch (e) { toast('Não foi possível salvar no navegador: ' + e.message, true); } };

  function mesclar(base, extra) {
    const out = Array.isArray(base) ? [...base] : { ...base };
    for (const k in extra || {}) {
      if (extra[k] && typeof extra[k] === 'object' && !Array.isArray(extra[k]) && base && typeof base[k] === 'object') out[k] = mesclar(base[k], extra[k]);
      else if (extra[k] !== undefined) out[k] = extra[k];
    }
    return out;
  }

  let cfg = mesclar(Ata.CONFIG_PADRAO, ler(CH_CFG, {}));
  if (typeof cfg.documento.timbre === 'boolean') cfg.documento.timbre = cfg.documento.timbre ? 'moderno' : 'nenhum';
  let atas = ler(CH_ATAS, []);
  let ata = null;
  {
    const idAtual = ler(CH_ATUAL, null);
    const salva = atas.find((a) => a.id === idAtual);
    const rascunho = ler('atas.rascunho.v1', null);
    ata = mesclar(Ata.novaAta(cfg), rascunho && (!salva || rascunho.id === idAtual) ? rascunho : salva || {});
  }

  const pegar = (obj, cam) => cam.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
  const por = (obj, cam, v) => { const ks = cam.split('.'); const ult = ks.pop(); ks.reduce((o, k) => (o[k] ??= {}), obj)[ult] = v; };

  // ---------- toast ----------
  let tTimer;
  function toast(msg, erro = false) {
    const t = $('#toast');
    t.textContent = msg; t.classList.toggle('erro', erro); t.classList.add('ver');
    clearTimeout(tTimer); tTimer = setTimeout(() => t.classList.remove('ver'), erro ? 7000 : 2800);
  }

  // ---------- formulário <-> estado ----------
  function preencherForm() {
    $$('[data-f]').forEach((el) => {
      const v = pegar(ata, el.dataset.f);
      if (el.type === 'checkbox') el.checked = !!v; else el.value = v ?? '';
    });
    atualizarCondicionais(); atualizarPrevia();
  }

  function atualizarCondicionais() {
    $$('[data-mostrar]').forEach((el) => {
      const [cam, val] = el.dataset.mostrar.split('=');
      el.hidden = String(pegar(ata, cam)) !== val;
    });
  }

  let tSalvar;
  function aoEditar(e) {
    const el = e.target;
    if (!el.dataset.f) return;
    let v = el.type === 'checkbox' ? el.checked : el.value;
    por(ata, el.dataset.f, v);
    if (el.dataset.f === 'grau' && ata.status !== 'final') {
      const prox = (Number(cfg.contadores[v]) || 0) + 1;
      ata.numero = prox; $('[data-f="numero"]').value = prox;
    }
    if ((el.dataset.f === 'atos' || el.dataset.f === 'expedientes') && !String(v).trim() && ata.pdfResumido) delete ata.pdfResumido[el.dataset.f];
    atualizarCondicionais(); atualizarPrevia();
    clearTimeout(tSalvar); tSalvar = setTimeout(() => gravar('atas.rascunho.v1', ata), 400);
  }

  // ---------- prévia ----------
  function atualizarPrevia() {
    const est = Ata.montar(ata, cfg);
    const folha = $('#folha');
    folha.style.setProperty('--fonte-doc', `'${cfg.documento.fonte}', Cambria, 'Times New Roman', serif`);
    folha.style.setProperty('--tam-doc', `${cfg.documento.tamanho}pt`);
    const T = Exportar.timbreAtual(cfg);
    folha.style.paddingTop = T ? T.previa.topo : '';
    folha.style.paddingBottom = T ? T.previa.base : '';
    folha.style.setProperty('--tam-cab', T && T.cabTam ? `${T.cabTam}pt` : `${cfg.documento.tamanho}pt`);
    folha.style.setProperty('--depois-cab', T ? `${T.imp.depoisCab}mm` : '0');
    const [topo, marca, base] = [$('.tb-topo'), $('.tb-marca'), $('.tb-base')];
    [topo, marca, base].forEach((el) => { el.hidden = !T; });
    if (T) {
      const P = T.previa;
      topo.style.aspectRatio = `210 / ${P.faixaTopo}`;
      base.style.aspectRatio = `210 / ${P.faixaBase}`;
      if (!topo.firstChild.src.endsWith(T.img)) { topo.firstChild.src = T.img; base.firstChild.src = T.img; }
      if (!marca.firstChild.src.endsWith(P.marca)) marca.firstChild.src = P.marca;
      marca.firstChild.style.opacity = P.opacidade;
    }
    $('#folha-cab').innerHTML = est.cabecalho.map((l) => `<p>${Ata.esc(l)}</p>`).join('');
    $('#previa').innerHTML = Ata.paraHTML(est, cfg).replace(/_{3,}[^<]*?(?=<|$)/g, (m) => `<span class="vazio">${m}</span>`);
    const st = $('#status-ata');
    st.textContent = ata.status === 'final' ? 'finalizada' : 'rascunho';
    st.classList.toggle('final', ata.status === 'final');
    $('#marca-loja').textContent = `Loja Maçônica ${cfg.loja.nome} nº ${cfg.loja.numero}`;
  }

  // ---------- salvar / histórico ----------
  function salvarLocal(a = ata) {
    const i = atas.findIndex((x) => x.id === a.id);
    if (i >= 0) atas[i] = structuredClone(a); else atas.unshift(structuredClone(a));
    gravar(CH_ATAS, atas);
    if (a === ata) { gravar(CH_ATUAL, ata.id); localStorage.removeItem('atas.rascunho.v1'); }
  }

  function salvar(silencioso = false) {
    ata.atualizadoEm = new Date().toISOString();
    salvarLocal();
    if (Drive.estado().conectado) salvarNoDrive(ata, silencioso);
    else if (!silencioso) toast(Drive.estado().configurado ? 'Ata salva neste aparelho. Conecte o Google Drive para guardar na nuvem.' : 'Ata salva neste navegador.');
  }

  // ---------- Google Drive ----------
  let filaDrive = Promise.resolve();
  const horaAgora = () => new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  function statusDrive(txt, tipo = '') { const el = $('#status-drive'); el.textContent = txt; el.className = 'status-drive ' + tipo; }

  function salvarNoDrive(a, silencioso = true) {
    const copia = structuredClone(a);
    filaDrive = filaDrive.then(async () => {
      statusDrive('Salvando no Drive…');
      try {
        const r = await Drive.salvarAta(copia, Ata.montar(copia, cfg).nomeArquivo);
        const alvo = atas.find((x) => x.id === copia.id);
        if (alvo) { alvo.driveId = r.id; gravar(CH_ATAS, atas); }
        if (ata.id === copia.id) ata.driveId = r.id;
        statusDrive(`☁ Salvo no Drive às ${horaAgora()}`, 'ok');
        if (!silencioso) toast('Ata salva no Google Drive.');
      } catch (e) {
        statusDrive('⚠ Não salvou no Drive', 'erro');
        toast(e.message, true); console.error(e);
      }
    });
    return filaDrive;
  }

  function atualizarBotaoDrive(st = Drive.estado()) {
    const b = $('#btn-drive');
    b.classList.toggle('on', st.conectado);
    $('#txt-drive').textContent = st.conectado ? (st.email ? st.email.split('@')[0] : 'Drive conectado') : 'Conectar Drive';
    b.title = st.conectado ? `Conectado ao Google Drive (${st.email}). Clique para ver as atas do Drive.` : 'Entrar com a conta Google e salvar as atas no Drive';
    $('#btn-drive-sair').hidden = !st.conectado;
    if (!st.conectado && localStorage.getItem('atas.drive.lembrar')) statusDrive('Drive desconectado — clique em "Conectar Drive"');
  }

  async function conectarDrive() {
    if (!cfg.drive.clientId) { toast('Primeiro informe o ID do cliente do Google em Configurações → Google Drive.', true); return abrirConfig(); }
    const pedido = Drive.garantirToken(); // precisa sair antes de qualquer await (pop-up)
    try {
      await pedido;
      statusDrive('Conectado ao Drive. Sincronizando…');
      await sincronizarConfig();
      const soLocais = atas.filter((a) => !a.driveId);
      if (soLocais.length && confirm(`Conectado ao Google Drive.\n\nHá ${soLocais.length} ata(s) salva(s) só neste aparelho. Enviar para o Drive agora?`)) {
        for (const a of soLocais) await salvarNoDrive(a);
      }
      if (atas.some((a) => a.id === ata.id)) await salvarNoDrive(ata);
      statusDrive(`☁ Drive conectado`, 'ok');
      toast('Google Drive conectado. As atas salvas vão para a pasta da Loja no seu Drive.');
    } catch (e) { toast(e.message, true); statusDrive('⚠ Drive não conectado', 'erro'); }
  }

  async function sincronizarConfig() {
    if (!cfg.drive.salvarConfig) return;
    try {
      const remota = await Drive.lerConfig();
      const localVazia = !cfg.oficiais.vm && !cfg.oficiais.secretario && !cfg.ia.chave;
      if (remota && (localVazia || confirm('Encontrei configurações salvas no seu Drive (oficiais, numeração, chave da IA).\n\nOK = usar as do Drive\nCancelar = manter as deste aparelho e atualizar o Drive'))) {
        const clientId = cfg.drive.clientId;
        cfg = mesclar(Ata.CONFIG_PADRAO, remota); cfg.drive.clientId = clientId;
        gravar(CH_CFG, cfg); preencherForm();
      } else {
        await Drive.salvarConfig(cfg);
      }
    } catch (e) { console.warn('config Drive', e); }
  }

  function novaAta() {
    if (!confirm('Começar uma nova ata? A atual fica salva no Histórico.')) return;
    salvar(true);
    ata = Ata.novaAta(cfg);
    gravar(CH_ATUAL, ata.id);
    limparIA(); preencherForm(); window.scrollTo({ top: 0, behavior: 'smooth' });
    toast('Nova ata iniciada.');
  }

  function finalizar() {
    if (!confirm(`Finalizar a sessão de ${ata.grau.toLowerCase()} nº ${ata.numero}? A numeração do grau passa a contar a partir dela.`)) return;
    ata.status = 'final';
    const n = Number(ata.numero) || 0;
    if (n > (Number(cfg.contadores[ata.grau]) || 0)) { cfg.contadores[ata.grau] = n; gravar(CH_CFG, cfg); if (Drive.estado().conectado && cfg.drive.salvarConfig) Drive.salvarConfig(cfg).catch(() => {}); }
    salvar(true); atualizarPrevia(); toast('Ata finalizada e numeração atualizada.');
  }

  let abaHist = 'drive';
  let cacheDrive = null;

  function itemHist({ id, titulo, sub, local, drive }) {
    return `
      <li>
        <div class="info"><b>${titulo}</b><span>${sub}</span></div>
        <div class="acoes">
          ${drive ? `<button type="button" class="btn pequeno" data-abrir-drive="${drive}">Abrir</button>
                     <button type="button" class="btn fantasma pequeno" data-lixeira="${drive}" title="Mover para a lixeira do Drive">🗑</button>`
    : `<button type="button" class="btn pequeno" data-abrir="${id}">Abrir</button>
                     <button type="button" class="btn fantasma pequeno" data-duplicar="${id}" title="Usar como base para uma nova ata">Duplicar</button>
                     <button type="button" class="btn fantasma pequeno" data-excluir="${id}" title="Excluir deste aparelho">🗑</button>`}
        </div>
      </li>`;
  }

  async function desenharHistorico(recarregar = false) {
    $$('[data-hist]').forEach((b) => b.classList.toggle('ativa', b.dataset.hist === abaHist));
    const st = Drive.estado();
    $('#hist-acoes-drive').hidden = abaHist !== 'drive';
    if (abaHist === 'drive') return desenharHistoricoDrive(recarregar);
    return desenharHistoricoLocal();
  }

  async function desenharHistoricoDrive(recarregar) {
    const ul = $('#lista-hist'), st = Drive.estado();
    if (!st.configurado || !st.conectado) {
      ul.innerHTML = `<li class="vazia">${st.configurado ? 'Conecte o Google Drive para ver as atas guardadas na nuvem.' : 'O Google Drive ainda não foi configurado (Configurações → Google Drive).'}
        <button type="button" class="btn pequeno primario" data-conectar>${st.configurado ? 'Conectar Drive' : 'Abrir Configurações'}</button></li>`;
      $('#link-pasta').hidden = true; $('#btn-enviar-locais').hidden = true;
      return;
    }
    if (!cacheDrive || recarregar) {
      ul.innerHTML = '<li class="carregando">Carregando as atas do Drive…</li>';
      try { cacheDrive = await Drive.listarAtas(); } catch (e) { ul.innerHTML = `<li class="vazia">${Ata.esc(e.message)}</li>`; return; }
      Drive.linkPasta().then((u) => { $('#link-pasta').href = u; $('#link-pasta').hidden = false; }).catch(() => {});
    }
    const semDrive = atas.filter((a) => !a.driveId).length;
    $('#btn-enviar-locais').hidden = !semDrive;
    $('#btn-enviar-locais').textContent = `Enviar ${semDrive} ata(s) deste aparelho para o Drive`;
    const termo = $('#busca-hist').value.toLowerCase().trim();
    const lista = cacheDrive.filter((f) => !termo || f.name.toLowerCase().includes(termo));
    if (!lista.length) { ul.innerHTML = `<li class="vazia">${termo ? 'Nada encontrado.' : 'Nenhuma ata no Drive ainda. Salve uma ata para ela aparecer aqui.'}</li>`; return; }
    ul.innerHTML = lista.map((f) => {
      const loc = atas.find((a) => a.id === f.appProperties?.ataId);
      return itemHist({
        drive: f.id,
        titulo: Ata.esc(f.name.replace(/\.json$/i, '')) + (loc ? '<span class="tag">também neste aparelho</span>' : ''),
        sub: `Alterada em ${new Date(f.modifiedTime).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}${loc ? ' · ' + (loc.status === 'final' ? 'finalizada' : 'rascunho') : ''}`,
      });
    }).join('');
  }

  function desenharHistoricoLocal() {
    $('#btn-enviar-locais').hidden = true;
    const termo = $('#busca-hist').value.toLowerCase().trim();
    const ul = $('#lista-hist');
    const lista = atas.filter((a) => !termo || JSON.stringify(a).toLowerCase().includes(termo))
      .sort((a, b) => String(b.data).localeCompare(String(a.data)));
    if (!lista.length) { ul.innerHTML = '<li class="vazia">Nenhuma ata salva ainda.</li>'; return; }
    ul.innerHTML = lista.map((a) => itemHist({
      id: a.id,
      titulo: `Sessão ${Ata.esc(a.tipo || '').toLowerCase()} de ${Ata.esc((a.grau || '').toLowerCase())} nº ${Ata.esc(a.numero)}${a.driveId ? '<span class="tag">☁ no Drive</span>' : ''}`,
      sub: `${Extenso.dataCurta(a.data)} · ${a.status === 'final' ? 'finalizada' : 'rascunho'} · ${Ata.esc((a.ordemDoDia || '').slice(0, 70))}${(a.ordemDoDia || '').length > 70 ? '…' : ''}`,
    })).join('');
  }

  async function acaoHistorico(e) {
    const b = e.target.closest('button'); if (!b) return;
    if (b.hasAttribute('data-conectar')) {
      if (!Drive.estado().configurado) { $('#dlg-historico').close(); return abrirConfig(); }
      await conectarDrive(); return desenharHistorico(true);
    }
    if (b.dataset.abrirDrive) {
      b.disabled = true; b.textContent = 'Abrindo…';
      try {
        const remota = await Drive.abrirAta(b.dataset.abrirDrive);
        salvar(true);
        ata = mesclar(Ata.novaAta(cfg), remota);
        salvarLocal(); limparIA(); preencherForm(); $('#dlg-historico').close();
        statusDrive(`☁ Aberta do Drive às ${horaAgora()}`, 'ok'); toast('Ata aberta do Google Drive.');
      } catch (err) { toast(err.message, true); b.disabled = false; b.textContent = 'Abrir'; }
      return;
    }
    if (b.dataset.lixeira) {
      if (!confirm('Mover esta ata para a lixeira do Google Drive? (dá para recuperar pela lixeira do Drive por 30 dias)')) return;
      try {
        await Drive.lixeira(b.dataset.lixeira);
        atas.forEach((a) => { if (a.driveId === b.dataset.lixeira) delete a.driveId; });
        if (ata.driveId === b.dataset.lixeira) delete ata.driveId;
        gravar(CH_ATAS, atas); desenharHistorico(true);
      } catch (err) { toast(err.message, true); }
      return;
    }
    if (b.dataset.abrir) {
      salvar(true);
      ata = mesclar(Ata.novaAta(cfg), atas.find((a) => a.id === b.dataset.abrir));
      gravar(CH_ATUAL, ata.id); limparIA(); preencherForm(); $('#dlg-historico').close(); toast('Ata aberta.');
    } else if (b.dataset.duplicar) {
      salvar(true);
      const base = structuredClone(atas.find((a) => a.id === b.dataset.duplicar));
      const nova = Ata.novaAta(cfg);
      ata = mesclar(nova, { ...base, id: nova.id, driveId: undefined, status: 'rascunho', criadoEm: nova.criadoEm, numero: (Number(cfg.contadores[base.grau]) || 0) + 1,
        data: nova.data, dataLavratura: nova.dataLavratura, ordemDoDia: '', expedientes: '', palavra: { sul: '', norte: '', oriente: '' },
        atos: '', pdfResumido: {}, propostas: '', saudacao: '', visitantesNomes: '', visitantesQtd: '', sinteseManual: '', observacoesIA: '' });
      limparIA(); preencherForm(); $('#dlg-historico').close(); toast('Cópia criada com os mesmos oficiais e tipo de sessão.');
    } else if (b.dataset.excluir) {
      if (!confirm('Excluir esta ata definitivamente?')) return;
      atas = atas.filter((a) => a.id !== b.dataset.excluir); gravar(CH_ATAS, atas); desenharHistorico();
    }
  }

  // ---------- configurações ----------
  function abrirConfig() {
    $$('[data-c]').forEach((el) => {
      const v = pegar(cfg, el.dataset.c);
      if (el.type === 'checkbox') el.checked = !!v; else el.value = v ?? '';
    });
    $('#dlg-config').showModal();
  }

  function salvarConfig() {
    const antigos = { ...cfg.oficiais };
    $$('[data-c]').forEach((el) => {
      let v = el.type === 'checkbox' ? el.checked : el.value;
      if (el.type === 'number') v = v === '' ? '' : Number(v);
      por(cfg, el.dataset.c, typeof v === 'string' ? v.trim() : v);
    });
    gravar(CH_CFG, cfg);
    // oficiais vazios ou iguais aos antigos na ata atual acompanham a configuração
    for (const k of ['vm', 'vig1', 'vig2', 'orador', 'secretario']) {
      if (!ata.oficiais[k] || ata.oficiais[k] === antigos[k]) ata.oficiais[k] = cfg.oficiais[k];
    }
    if (ata.status !== 'final' && !atas.some((a) => a.id === ata.id)) ata.numero = (Number(cfg.contadores[ata.grau]) || 0) + 1;
    Drive.configurar(cfg.drive.clientId, nomePastaDrive());
    if (Drive.estado().conectado && cfg.drive.salvarConfig) Drive.salvarConfig(cfg).catch((e) => toast(e.message, true));
    preencherForm(); toast('Configurações salvas.');
  }

  async function buscarModelos() {
    const chave = $('[data-c="ia.chave"]').value.trim();
    if (!chave) return toast('Informe a chave da API primeiro.', true);
    const btn = $('#btn-modelos'); btn.disabled = true; btn.textContent = 'Buscando…';
    try {
      const ms = await IA.listarModelos(chave);
      $('#lista-modelos').innerHTML = ms.map((m) => `<option value="${m.id}">${Ata.esc(m.nome)}</option>`).join('');
      toast(`${ms.length} modelos disponíveis. Clique no campo Modelo para escolher (os "Flash" são rápidos e baratos).`);
    } catch (e) { toast(e.message, true); }
    finally { btn.disabled = false; btn.textContent = 'Buscar modelos'; }
  }

  function exportarTudo() {
    const semChave = structuredClone(cfg); semChave.ia.chave = '';
    const blob = new Blob([JSON.stringify({ app: 'gerador-de-atas', versao: 1, exportadoEm: new Date().toISOString(), config: semChave, atas }, null, 2)], { type: 'application/json' });
    Exportar.baixar(blob, `backup-atas-${Ata.hojeISO()}.json`);
  }

  async function importarTudo(e) {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try {
      const j = JSON.parse(await f.text());
      if (j.config) { const chave = cfg.ia.chave; cfg = mesclar(Ata.CONFIG_PADRAO, j.config); if (!cfg.ia.chave) cfg.ia.chave = chave; gravar(CH_CFG, cfg); }
      if (Array.isArray(j.atas)) {
        const ids = new Set(atas.map((a) => a.id));
        j.atas.forEach((a) => { if (!ids.has(a.id)) atas.push(a); });
        gravar(CH_ATAS, atas);
      }
      $('#dlg-config').close(); abrirConfig();
      toast(`Backup importado: ${(j.atas || []).length} ata(s) e configurações. Confira e clique em Salvar.`);
    } catch (err) { toast('Arquivo de backup inválido: ' + err.message, true); }
  }

  // ---------- IA ----------
  let audioSelecionado = null;
  let abaIA = 'arquivo';

  function limparIA() {
    $('#obs-ia').hidden = true;
    if (ata.observacoesIA) { $('#obs-ia-txt').textContent = ata.observacoesIA; $('#obs-ia').hidden = false; }
  }

  function escolherAudio(f) {
    if (!f) return;
    audioSelecionado = f;
    const mb = (f.size / 1048576).toFixed(1);
    $('#zona-soltar').classList.add('com-arquivo');
    $('#soltar-texto').innerHTML = `<b>${Ata.esc(f.name)}</b> · ${mb} MB<br><small>Clique para trocar o arquivo</small>`;
  }

  function progresso(txt, frac) {
    const p = $('#progresso'); p.hidden = false; p.classList.remove('erro'); $('#btn-copiar-erro').hidden = true;
    $('#progresso-txt').textContent = txt; $('#progresso-txt').dataset.ultima = txt;
    const indet = frac == null || frac >= 0.5;
    p.classList.toggle('indeterminado', indet);
    if (!indet) $('#barra').style.width = Math.round(frac * 100) + '%';
  }

  function aplicarResultadoIA(r) {
    const set = (cam, v) => { if (v !== undefined && v !== null && String(v).trim() !== '') por(ata, cam, typeof v === 'string' ? v.trim() : v); };
    if (/^\d{4}-\d{2}-\d{2}$/.test(r.data || '')) set('data', r.data);
    if (/^\d{1,2}:\d{2}$/.test(r.horaInicio || '')) set('horaInicio', r.horaInicio.padStart(5, '0'));
    if (/^\d{1,2}:\d{2}$/.test(r.horaFim || '')) set('horaFim', r.horaFim.padStart(5, '0'));
    if (['APRENDIZ', 'COMPANHEIRO', 'MESTRE'].includes(r.grau) && r.grau !== ata.grau) {
      ata.grau = r.grau;
      if (ata.status !== 'final') ata.numero = (Number(cfg.contadores[r.grau]) || 0) + 1;
    }
    if (r.tipo) set('tipo', r.tipo.toUpperCase());
    if (/^\d+$/.test(r.presentesQuadro || '')) set('presentesQuadro', r.presentesQuadro);
    if (/^\d+$/.test(r.visitantesQtd || '')) set('visitantesQtd', r.visitantesQtd);
    set('visitantesNomes', r.visitantesNomes);
    // oficiais: só preenche os vazios ou marca ad hoc quando a IA indicar outro nome
    for (const k of ['vm', 'vig1', 'vig2', 'orador', 'secretario']) {
      const v = (r[k] || '').trim();
      if (!v) continue;
      if (!ata.oficiais[k]) ata.oficiais[k] = v.toUpperCase();
    }
    if (r.balaustreModo) set('balaustre.modo', r.balaustreModo);
    if (/^\d{4}-\d{2}-\d{2}$/.test(r.balaustreData || '')) set('balaustre.data', r.balaustreData);
    set('balaustre.texto', r.balaustreTexto);
    ['atos', 'expedientes', 'propostas', 'ordemDoDia', 'saudacao'].forEach((k) => { if (!(ata.pdfResumido || {})[k]) set(k, r[k]); });
    if (typeof r.troncoHouve === 'boolean') ata.tronco.houve = r.troncoHouve;
    if (r.troncoValor) set('tronco.valor', String(r.troncoValor).replace(/\D/g, ''));
    set('palavra.sul', r.palavraSul); set('palavra.norte', r.palavraNorte); set('palavra.oriente', r.palavraOriente);
    ata.observacoesIA = (r.observacoes || '').trim();
    if (!ata.dataLavratura) ata.dataLavratura = Ata.hojeISO();
  }

  async function gerarComIA() {
    const transcricao = abaIA === 'texto' ? $('#txt-transcricao').value.trim() : '';
    const audio = abaIA === 'arquivo' ? audioSelecionado : abaIA === 'gravar' ? gravacaoBlob : null;
    if (!audio && !transcricao) return toast(abaIA === 'texto' ? 'Cole a transcrição primeiro.' : abaIA === 'gravar' ? 'Grave a sessão primeiro.' : 'Escolha o arquivo de áudio primeiro.', true);
    if (!cfg.ia.chave) { toast('Cadastre a chave da API do Gemini (é gratuita).', true); return abrirConfig(); }
    const temConteudo = ata.ordemDoDia || ata.expedientes || ata.palavra.sul || ata.palavra.oriente;
    if (temConteudo && !confirm('A IA vai substituir os textos já preenchidos nas seções. Continuar?')) return;

    const btn = $('#btn-gerar-ia'); btn.disabled = true;
    try {
      const r = await IA.gerarAta({
        chave: cfg.ia.chave, modelo: cfg.ia.modelo || 'gemini-flash-latest', audio, transcricao,
        contexto: { loja: cfg.loja, data: ata.data, grau: ata.grau, tipo: ata.tipo, oficiais: ata.oficiais, instrucoes: $('#txt-instrucoes').value.trim() },
        onStatus: progresso,
      });
      aplicarResultadoIA(r);
      if (ata.status !== 'final') ata.numero = ata.numero || (Number(cfg.contadores[ata.grau]) || 0) + 1;
      salvar(true); preencherForm(); limparIA();
      progresso('Pronto! Revise os campos abaixo antes de baixar.', 1);
      $('#progresso').classList.remove('indeterminado'); $('#barra').style.width = '100%';
      toast('Ata gerada. Revise e ajuste o que for preciso.');
    } catch (e) {
      mostrarErro(e);
    } finally { btn.disabled = false; }
  }

  function mostrarErro(e) {
    console.error(e);
    const p = $('#progresso'); p.hidden = false; p.classList.remove('indeterminado'); p.classList.add('erro');
    const etapa = ($('#progresso-txt').dataset.ultima || '');
    const msg = `Erro: ${e.message || e}${etapa ? `\n(etapa: ${etapa})` : ''}`;
    $('#progresso-txt').textContent = msg;
    $('#btn-copiar-erro').hidden = false;
    $('#btn-copiar-erro').onclick = () => navigator.clipboard.writeText(msg).then(() => toast('Mensagem copiada.'));
    toast('Não foi possível gerar a ata. Veja a mensagem em vermelho.', true);
  }

  async function testarIA() {
    const chave = $('[data-c="ia.chave"]').value.trim(), modelo = $('[data-c="ia.modelo"]').value.trim() || 'gemini-flash-latest';
    if (!chave) return toast('Informe a chave da API primeiro.', true);
    const btn = $('#btn-testar-ia'); btn.disabled = true; btn.textContent = 'Testando…';
    try { await IA.testar(chave, modelo); toast(`IA funcionando com o modelo ${modelo}.`); }
    catch (e) { toast('Falhou: ' + e.message, true); }
    finally { btn.disabled = false; btn.textContent = 'Testar IA'; }
  }

  async function revisarComIA() {
    if (!cfg.ia.chave) { toast('Cadastre a chave da API do Gemini.', true); return abrirConfig(); }
    const campos = {
      atos: ata.atos, expedientes: ata.expedientes, propostas: ata.propostas, ordemDoDia: ata.ordemDoDia, saudacao: ata.saudacao,
      palavraSul: ata.palavra.sul, palavraNorte: ata.palavra.norte, palavraOriente: ata.palavra.oriente,
      balaustreTexto: ata.balaustre.texto, sinteseManual: ata.sinteseManual,
    };
    if (!Object.values(campos).some((v) => (v || '').trim())) return toast('Não há texto para revisar.', true);
    const btn = $('#btn-revisar-ia'); btn.disabled = true; progresso('Revisando a redação…', null);
    try {
      const r = await IA.revisarTexto({ chave: cfg.ia.chave, modelo: cfg.ia.modelo || 'gemini-flash-latest', campos });
      const m = { palavraSul: 'palavra.sul', palavraNorte: 'palavra.norte', palavraOriente: 'palavra.oriente', balaustreTexto: 'balaustre.texto' };
      for (const k in campos) if ((campos[k] || '').trim() && typeof r[k] === 'string' && r[k].trim()) por(ata, m[k] || k, r[k].trim());
      salvar(true); preencherForm(); toast('Redação revisada.');
    } catch (e) { toast(e.message, true); }
    finally { btn.disabled = false; $('#progresso').hidden = true; }
  }

  // ---------- PDFs de Atos e Decretos / Expedientes ----------
  const pdfs = { atos: [], expedientes: [] };

  function desenharPdfs(secao) {
    const box = $(`.pdfs[data-secao="${secao}"]`);
    box.querySelector('.lista-pdfs').innerHTML = pdfs[secao].map((f, i) =>
      `<li><span title="${Ata.esc(f.name)}">📄 ${Ata.esc(f.name)}</span><button type="button" data-tirar="${i}" title="Remover">×</button></li>`).join('');
    const btn = box.querySelector('[data-resumir]');
    btn.hidden = !pdfs[secao].length;
    btn.textContent = pdfs[secao].length > 1 ? `Ler ${pdfs[secao].length} documentos e resumir com IA` : 'Ler documento e resumir com IA';
  }

  function adicionarPdfs(secao, lista) {
    const novos = [...lista].filter((f) => /pdf|image\//i.test(f.type) || /\.(pdf|jpe?g|png|webp|heic)$/i.test(f.name));
    if (!novos.length) return toast('Escolha arquivos PDF (ou fotos dos documentos).', true);
    pdfs[secao].push(...novos);
    desenharPdfs(secao);
  }

  async function resumirPdfs(secao) {
    if (!pdfs[secao].length) return;
    if (!cfg.ia.chave) { toast('Cadastre a chave da API do Gemini.', true); return abrirConfig(); }
    const box = $(`.pdfs[data-secao="${secao}"]`);
    const btn = box.querySelector('[data-resumir]'), status = box.querySelector('.pdf-status');
    const st = (t) => { status.hidden = false; status.classList.remove('erro'); status.textContent = t; };
    btn.disabled = true;
    try {
      const r = await IA.resumirDocumentos({ chave: cfg.ia.chave, modelo: cfg.ia.modelo || 'gemini-flash-latest', arquivos: pdfs[secao], secao, contexto: { loja: cfg.loja }, onStatus: st });
      let texto = (r.texto || (r.itens || []).join('; ')).trim();
      if (!texto) throw new Error('A IA não conseguiu extrair conteúdo dos documentos.');
      if (!/[.!?]$/.test(texto)) texto += '.';
      const atual = (ata[secao] || '').trim();
      if (atual && !confirm(`Já existe texto em ${secao === 'atos' ? 'Atos e Decretos' : 'Expedientes'}.\n\nOK = SUBSTITUIR pelo resumo dos PDFs\nCancelar = ACRESCENTAR ao final`)) {
        texto = atual.replace(/\.\s*$/, '') + '; ' + texto;
      }
      ata[secao] = texto;
      ata.pdfResumido = { ...(ata.pdfResumido || {}), [secao]: true };
      salvar(true); preencherForm();
      st(`Pronto: ${pdfs[secao].length} documento(s) resumido(s).` + (r.observacoes ? ` Conferir: ${r.observacoes}` : ''));
      pdfs[secao] = []; desenharPdfs(secao);
      toast('Resumo inserido na ata. Revise o texto.');
    } catch (e) {
      status.hidden = false; status.classList.add('erro'); status.textContent = 'Erro: ' + e.message; console.error(e);
    } finally { btn.disabled = false; }
  }

  // ---------- gravação ----------
  let gravador = null, partes = [], gravacaoBlob = null, inicio = 0, acumulado = 0, relogio = null, wakeLock = null;

  function tipoGravacao() {
    const opcoes = ['audio/mp4', 'audio/ogg;codecs=opus', 'audio/webm;codecs=opus', 'audio/webm'];
    return opcoes.find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || '';
  }

  function tick() {
    const s = Math.floor((acumulado + (gravador?.state === 'recording' ? Date.now() - inicio : 0)) / 1000);
    $('#cronometro').textContent = [s / 3600, (s % 3600) / 60, s % 60].map((n) => String(Math.floor(n)).padStart(2, '0')).join(':');
  }

  async function alternarGravacao() {
    if (gravador && gravador.state !== 'inactive') { gravador.stop(); return; }
    if (!navigator.mediaDevices?.getUserMedia) return toast('Este navegador não permite gravar áudio. Use Chrome, Edge ou Safari atualizados.', true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: true, autoGainControl: true } });
      const tipo = tipoGravacao();
      gravador = new MediaRecorder(stream, { ...(tipo ? { mimeType: tipo } : {}), audioBitsPerSecond: 48000 });
      partes = []; acumulado = 0; inicio = Date.now();
      gravador.ondataavailable = (e) => e.data.size && partes.push(e.data);
      gravador.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        clearInterval(relogio); wakeLock?.release?.(); wakeLock = null;
        const mime = (gravador.mimeType || tipo || 'audio/webm').split(';')[0];
        const ext = mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm';
        gravacaoBlob = new File(partes, `sessao-${ata.data || Ata.hojeISO()}.${ext}`, { type: mime });
        $('#player-gravacao').src = URL.createObjectURL(gravacaoBlob);
        $('#gravacao-pronta').hidden = false;
        $('#btn-gravar').classList.remove('gravando'); $('#txt-gravar').textContent = 'Nova gravação';
        $('#btn-pausar').disabled = true; $('#btn-pausar').textContent = 'Pausar';
        toast('Gravação concluída. Agora clique em "Gerar ata com IA".');
      };
      gravador.start(10000);
      try { wakeLock = await navigator.wakeLock?.request('screen'); } catch (_) { /* opcional */ }
      relogio = setInterval(tick, 500);
      $('#btn-gravar').classList.add('gravando'); $('#txt-gravar').textContent = 'Parar gravação';
      $('#btn-pausar').disabled = false; $('#gravacao-pronta').hidden = true;
    } catch (e) { toast('Não foi possível acessar o microfone: ' + e.message, true); }
  }

  function pausarGravacao() {
    if (!gravador) return;
    if (gravador.state === 'recording') { gravador.pause(); acumulado += Date.now() - inicio; $('#btn-pausar').textContent = 'Retomar'; }
    else if (gravador.state === 'paused') { gravador.resume(); inicio = Date.now(); $('#btn-pausar').textContent = 'Pausar'; }
  }

  window.addEventListener('beforeunload', (e) => { if (gravador?.state === 'recording' || gravador?.state === 'paused') { e.preventDefault(); e.returnValue = ''; } });

  // ---------- exportação ----------
  async function baixarDocx() {
    try {
      const est = Ata.montar(ata, cfg);
      const blob = await Exportar.gerarDocx(est, cfg);
      Exportar.baixar(blob, est.nomeArquivo + '.docx');
      salvar(true);
      if (Drive.estado().conectado && cfg.drive.salvarDocumentos) {
        filaDrive = filaDrive.then(() => Drive.salvarDocumento(blob, est.nomeArquivo + '.docx',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ata.id)
          .then(() => statusDrive(`☁ Ata e Word salvos no Drive às ${horaAgora()}`, 'ok'))
          .catch((e) => toast('Word não foi para o Drive: ' + e.message, true)));
      }
    } catch (e) { toast('Erro ao gerar o Word: ' + e.message, true); console.error(e); }
  }

  async function copiarTexto() {
    const txt = Ata.paraTexto(Ata.montar(ata, cfg));
    try { await navigator.clipboard.writeText(txt); toast('Texto copiado.'); }
    catch (_) { toast('Não foi possível copiar automaticamente.', true); }
  }

  // ---------- eventos ----------
  function ligar() {
    $('#lista-tipos').innerHTML = Ata.TIPOS.map((t) => `<option value="${t}">`).join('');
    document.addEventListener('input', aoEditar);
    document.addEventListener('change', aoEditar);

    $('#btn-nova').onclick = novaAta;
    $('#btn-historico').onclick = () => { $('#busca-hist').value = ''; abaHist = Drive.estado().configurado ? 'drive' : 'local'; desenharHistorico(true); $('#dlg-historico').showModal(); };
    $('#busca-hist').oninput = () => desenharHistorico();
    $$('[data-hist]').forEach((b) => b.onclick = () => { abaHist = b.dataset.hist; desenharHistorico(); });
    $('#btn-enviar-locais').onclick = async () => {
      const lista = atas.filter((a) => !a.driveId);
      $('#btn-enviar-locais').disabled = true;
      for (const a of lista) await salvarNoDrive(a);
      $('#btn-enviar-locais').disabled = false; desenharHistorico(true); toast(`${lista.length} ata(s) enviada(s) para o Drive.`);
    };
    $('#btn-drive').onclick = () => {
      if (Drive.estado().conectado) { abaHist = 'drive'; $('#busca-hist').value = ''; desenharHistorico(true); $('#dlg-historico').showModal(); }
      else conectarDrive();
    };
    $('#btn-drive-sair').onclick = () => { Drive.sair(); statusDrive(''); toast('Google Drive desconectado neste aparelho.'); };
    Drive.aoMudar(atualizarBotaoDrive);
    $('#lista-hist').onclick = acaoHistorico;
    $('#btn-config').onclick = abrirConfig;
    $('#dlg-config').addEventListener('close', () => { if ($('#dlg-config').returnValue === 'ok') salvarConfig(); });
    $('#btn-modelos').onclick = buscarModelos;
    $('#btn-testar-ia').onclick = testarIA;
    $('#btn-exportar').onclick = exportarTudo;
    $('#arq-importar').onchange = importarTudo;

    $('#btn-salvar').onclick = () => salvar();
    $('#btn-finalizar').onclick = finalizar;
    $('#btn-docx').onclick = baixarDocx;
    $('#btn-pdf').onclick = () => { salvar(true); Exportar.imprimir(Ata.montar(ata, cfg), cfg); };
    $('#btn-copiar').onclick = copiarTexto;

    $$('.aba').forEach((b) => b.onclick = () => {
      abaIA = b.dataset.aba;
      $$('.aba').forEach((x) => x.classList.toggle('ativa', x === b));
      $$('.painel-aba').forEach((p) => p.hidden = p.dataset.painel !== abaIA);
    });
    $('#arq-audio').onchange = (e) => escolherAudio(e.target.files[0]);
    const zona = $('#zona-soltar');
    ['dragenter', 'dragover'].forEach((ev) => zona.addEventListener(ev, (e) => { e.preventDefault(); zona.classList.add('arrastando'); }));
    ['dragleave', 'drop'].forEach((ev) => zona.addEventListener(ev, (e) => { e.preventDefault(); zona.classList.remove('arrastando'); }));
    zona.addEventListener('drop', (e) => escolherAudio(e.dataTransfer.files[0]));
    $$('.pdfs').forEach((box) => {
      const secao = box.dataset.secao, zona = box.querySelector('.soltar'), inp = box.querySelector('input[type=file]');
      inp.onchange = (e) => { adicionarPdfs(secao, e.target.files); e.target.value = ''; };
      ['dragenter', 'dragover'].forEach((ev) => zona.addEventListener(ev, (e) => { e.preventDefault(); zona.classList.add('arrastando'); }));
      ['dragleave', 'drop'].forEach((ev) => zona.addEventListener(ev, (e) => { e.preventDefault(); zona.classList.remove('arrastando'); }));
      zona.addEventListener('drop', (e) => adicionarPdfs(secao, e.dataTransfer.files));
      box.querySelector('.lista-pdfs').onclick = (e) => { const b = e.target.closest('[data-tirar]'); if (b) { pdfs[secao].splice(+b.dataset.tirar, 1); desenharPdfs(secao); } };
      box.querySelector('[data-resumir]').onclick = () => resumirPdfs(secao);
    });
    $('#btn-gerar-ia').onclick = gerarComIA;
    $('#btn-revisar-ia').onclick = revisarComIA;
    $('#btn-gravar').onclick = alternarGravacao;
    $('#btn-pausar').onclick = pausarGravacao;
    $('#btn-baixar-gravacao').onclick = () => gravacaoBlob && Exportar.baixar(gravacaoBlob, gravacaoBlob.name);

    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); salvar(); }
    });
  }

  function nomePastaDrive() { return `Atas - Loja Maçônica ${cfg.loja.nome} nº ${cfg.loja.numero}`; }

  ligar();
  Drive.configurar(cfg.drive.clientId, nomePastaDrive());
  atualizarBotaoDrive();
  preencherForm();
  limparIA();
  if (!cfg.oficiais.vm && !atas.length) setTimeout(() => { toast('Bem-vindo! Comece pelas Configurações: oficiais, numeração e chave da IA.'); }, 600);
})();
