// Google Drive: login com a conta Google e armazenamento das atas numa pasta do Drive.
// Usa o escopo drive.file: o sistema só enxerga os arquivos que ele mesmo criou.
(function (global) {
  const API = 'https://www.googleapis.com/drive/v3';
  const UP = 'https://www.googleapis.com/upload/drive/v3';
  const ESCOPOS = 'https://www.googleapis.com/auth/drive.file openid email profile';
  const APP = 'gerador-atas';
  const CH_SESSAO = 'atas.drive.sessao';

  let clientId = '';
  let tokenClient = null;
  let token = null; // { access_token, expira, email }
  let pastaId = null;
  let nomePasta = 'Atas da Loja';
  let pendente = null; // { ok, falha }
  const ouvintes = [];

  try { const s = JSON.parse(sessionStorage.getItem(CH_SESSAO)); if (s && s.expira > Date.now() + 60000) token = s; } catch (_) { /* sem sessão */ }

  const avisar = () => ouvintes.forEach((f) => { try { f(estado()); } catch (_) { /* ignora */ } });
  const estado = () => ({ configurado: !!clientId, conectado: !!(token && token.expira > Date.now()), email: token?.email || '' });

  function carregarGIS() {
    if (global.google?.accounts?.oauth2) return Promise.resolve();
    return new Promise((ok, falha) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.onload = () => ok();
      s.onerror = () => falha(new Error('Não foi possível carregar o login do Google. Verifique a internet.'));
      document.head.appendChild(s);
    });
  }

  async function configurar(id, pasta) {
    if (pasta) nomePasta = pasta;
    if (id === clientId && tokenClient) return;
    clientId = (id || '').trim();
    tokenClient = null; pastaId = null;
    if (!clientId) { avisar(); return; }
    try {
      await carregarGIS();
      tokenClient = global.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: ESCOPOS,
        callback: async (r) => {
          const p = pendente; pendente = null;
          if (r.error) { p?.falha(new Error(r.error === 'access_denied' ? 'Acesso ao Google Drive não autorizado.' : 'Login do Google: ' + r.error)); return; }
          token = { access_token: r.access_token, expira: Date.now() + (Number(r.expires_in) || 3600) * 1000, email: token?.email || '' };
          try {
            const u = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: 'Bearer ' + token.access_token } });
            if (u.ok) token.email = (await u.json()).email || '';
          } catch (_) { /* e-mail é só informativo */ }
          sessionStorage.setItem(CH_SESSAO, JSON.stringify(token));
          localStorage.setItem('atas.drive.lembrar', '1');
          avisar();
          p?.ok(token);
        },
        error_callback: (e) => {
          const p = pendente; pendente = null;
          p?.falha(new Error(e?.type === 'popup_closed' ? 'A janela de login do Google foi fechada.' : e?.type === 'popup_failed_to_open'
            ? 'O navegador bloqueou a janela de login do Google. Libere pop-ups para este site.' : 'Falha no login do Google.'));
        },
      });
    } catch (e) { console.error(e); }
    avisar();
  }

  // Precisa ser chamada no início de um clique (antes de qualquer await) para o pop-up não ser bloqueado
  function garantirToken(forcarConta = false) {
    if (!clientId) return Promise.reject(new Error('Configure o Google Drive em Configurações (ID do cliente).'));
    if (!forcarConta && token && token.expira > Date.now() + 60000) return Promise.resolve(token);
    if (!tokenClient) return Promise.reject(new Error('O login do Google ainda está carregando. Tente de novo em alguns segundos.'));
    return new Promise((ok, falha) => {
      pendente = { ok, falha };
      tokenClient.requestAccessToken({ prompt: forcarConta || !localStorage.getItem('atas.drive.lembrar') ? 'consent' : '', hint: token?.email || undefined });
    });
  }

  function sair() {
    if (token && global.google?.accounts?.oauth2) { try { global.google.accounts.oauth2.revoke(token.access_token, () => {}); } catch (_) { /* ignora */ } }
    token = null; pastaId = null;
    sessionStorage.removeItem(CH_SESSAO); localStorage.removeItem('atas.drive.lembrar');
    avisar();
  }

  async function api(url, opts = {}) {
    if (!estado().conectado) throw new Error('Sessão do Google Drive expirou. Clique em "Google Drive" no topo para reconectar.');
    const r = await fetch(url, { ...opts, headers: { Authorization: 'Bearer ' + token.access_token, ...(opts.headers || {}) } });
    if (r.status === 401) { token = null; sessionStorage.removeItem(CH_SESSAO); avisar(); throw new Error('Sessão do Google Drive expirou. Clique em "Google Drive" no topo para reconectar.'); }
    if (!r.ok) {
      let msg = `Google Drive: HTTP ${r.status}`;
      try { msg = 'Google Drive: ' + ((await r.json()).error?.message || msg); } catch (_) { /* sem corpo */ }
      if (/has not been used|is disabled/i.test(msg)) msg = 'A API do Google Drive não está ativada no projeto do Google Cloud. Ative "Google Drive API" e tente de novo.';
      throw new Error(msg);
    }
    return r;
  }

  const q = (s) => encodeURIComponent(s);
  const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");

  async function pasta() {
    if (pastaId) return pastaId;
    const busca = `mimeType='application/vnd.google-apps.folder' and trashed=false and appProperties has { key='app' and value='${APP}' }`;
    const r = await (await api(`${API}/files?q=${q(busca)}&fields=files(id,name)&spaces=drive`)).json();
    if (r.files?.length) { pastaId = r.files[0].id; return pastaId; }
    const c = await (await api(`${API}/files?fields=id`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: nomePasta, mimeType: 'application/vnd.google-apps.folder', appProperties: { app: APP } }),
    })).json();
    pastaId = c.id;
    return pastaId;
  }

  function multipart(meta, conteudo, mime) {
    const limite = 'atas' + Math.random().toString(36).slice(2);
    const corpo = new Blob([
      `--${limite}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n`,
      `--${limite}\r\nContent-Type: ${mime}\r\n\r\n`, conteudo, `\r\n--${limite}--`,
    ]);
    return { corpo, tipo: `multipart/related; boundary=${limite}` };
  }

  async function gravarArquivo({ id, nome, conteudo, mime, props }) {
    const pid = await pasta();
    const meta = { name: nome, mimeType: mime, appProperties: { app: APP, ...(props || {}) } };
    if (!id) meta.parents = [pid];
    const { corpo, tipo } = multipart(meta, conteudo, mime);
    const url = id ? `${UP}/files/${id}?uploadType=multipart&fields=id,name,modifiedTime` : `${UP}/files?uploadType=multipart&fields=id,name,modifiedTime`;
    try {
      return await (await api(url, { method: id ? 'PATCH' : 'POST', headers: { 'Content-Type': tipo }, body: corpo })).json();
    } catch (e) {
      if (id && /not found|404/i.test(e.message)) return gravarArquivo({ nome, conteudo, mime, props }); // arquivo apagado no Drive: cria de novo
      throw e;
    }
  }

  async function buscarPorProp(chave, valor) {
    const pid = await pasta();
    const busca = `'${pid}' in parents and trashed=false and appProperties has { key='${chave}' and value='${esc(valor)}' }`;
    const r = await (await api(`${API}/files?q=${q(busca)}&fields=files(id,name,modifiedTime)`)).json();
    return r.files || [];
  }

  // ---- atas ----
  async function salvarAta(ata, nome) {
    let id = ata.driveId;
    if (!id) { const achados = await buscarPorProp('ataId', ata.id); id = achados[0]?.id; }
    const copia = { ...ata }; delete copia.driveId;
    const r = await gravarArquivo({ id, nome: nome + '.json', conteudo: JSON.stringify(copia, null, 1), mime: 'application/json', props: { tipo: 'ata', ataId: ata.id } });
    return r;
  }

  async function listarAtas() {
    const pid = await pasta();
    const busca = `'${pid}' in parents and trashed=false and appProperties has { key='tipo' and value='ata' }`;
    const itens = [];
    let pagina = '';
    do {
      const r = await (await api(`${API}/files?q=${q(busca)}&pageSize=200&orderBy=modifiedTime desc&fields=nextPageToken,files(id,name,modifiedTime,appProperties)${pagina ? '&pageToken=' + pagina : ''}`)).json();
      itens.push(...(r.files || []));
      pagina = r.nextPageToken || '';
    } while (pagina);
    return itens;
  }

  async function abrirAta(id) {
    const a = await (await api(`${API}/files/${id}?alt=media`)).json();
    a.driveId = id;
    return a;
  }

  async function lixeira(id) {
    await api(`${API}/files/${id}?fields=id`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trashed: true }) });
  }

  // ---- documentos finais e configuração ----
  async function salvarDocumento(blob, nome, mime, ataId) {
    const achados = await buscarPorProp('doc', `${ataId}:${mime}`);
    return gravarArquivo({ id: achados[0]?.id, nome, conteudo: blob, mime, props: { tipo: 'documento', doc: `${ataId}:${mime}` } });
  }

  async function salvarConfig(cfg) {
    const achados = await buscarPorProp('tipo', 'config');
    return gravarArquivo({ id: achados[0]?.id, nome: 'configuracoes-do-sistema.json', conteudo: JSON.stringify(cfg, null, 1), mime: 'application/json', props: { tipo: 'config' } });
  }

  async function lerConfig() {
    const achados = await buscarPorProp('tipo', 'config');
    if (!achados.length) return null;
    return (await api(`${API}/files/${achados[0].id}?alt=media`)).json();
  }

  async function linkPasta() { return `https://drive.google.com/drive/folders/${await pasta()}`; }

  global.Drive = {
    configurar, garantirToken, sair, estado, aoMudar: (f) => ouvintes.push(f),
    salvarAta, listarAtas, abrirAta, lixeira, salvarDocumento, salvarConfig, lerConfig, linkPasta,
  };
})(window);
