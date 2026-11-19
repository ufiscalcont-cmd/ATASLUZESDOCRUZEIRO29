// Extrai e comprime o áudio no próprio navegador (ffmpeg.wasm) antes de enviar à IA.
// Resolve: vídeos MP4/MOV (a IA cobraria cada quadro do vídeo), arquivos grandes e formatos que o Gemini não aceita.
(function (global) {
  const LIMITE_DIRETO = 14 * 1024 * 1024;
  const ALVO_BYTES = 13 * 1024 * 1024; // cabe numa única requisição à IA
  const ACEITOS_DIRETO = /\.(mp3|m4a|aac|wav|ogg|oga|opus|flac)$/i;
  let ffmpeg = null;

  function precisaConverter(arq) {
    const nome = arq.name || '';
    const tipo = (arq.type || '').toLowerCase();
    if (tipo.startsWith('video/') || /\.(mp4|mov|3gp|mkv|avi|wmv|webm|amr|wma|m4v|mpeg|mpg)$/i.test(nome)) return true;
    if (arq.size > LIMITE_DIRETO) return true;
    if (!ACEITOS_DIRETO.test(nome) && !/^audio\/(mp3|mpeg|mp4|aac|wav|x-wav|ogg|flac)/.test(tipo)) return true;
    return false;
  }

  async function carregar(st) {
    if (ffmpeg) return ffmpeg;
    if (!global.FFmpegWASM) throw new Error('Conversor de áudio não carregou. Recarregue a página.');
    st('Carregando o conversor de áudio (só na primeira vez, ~32 MB)…', 0.03);
    const ff = new global.FFmpegWASM.FFmpeg();
    const base = new URL('lib/ffmpeg/core/', location.href).href;
    await ff.load({ coreURL: base + 'ffmpeg-core.js', wasmURL: base + 'ffmpeg-core.wasm' });
    ffmpeg = ff;
    return ff;
  }

  function lerDuracao(logs) {
    const m = logs.join('\n').match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
    return m ? (+m[1]) * 3600 + (+m[2]) * 60 + parseFloat(m[3]) : 0;
  }

  const fmt = (s) => `${Math.floor(s / 60)}min${String(Math.floor(s % 60)).padStart(2, '0')}s`;

  // Devolve um File pronto para a IA (o original, se já estiver bom)
  async function prepararAudio(arq, onStatus) {
    const st = onStatus || (() => {});
    if (!precisaConverter(arq)) return arq;

    const ff = await carregar(st);
    const logs = [];
    const aoLog = ({ message }) => { logs.push(message); if (logs.length > 400) logs.shift(); };
    ff.on('log', aoLog);
    const dir = '/entrada';
    try {
      try { await ff.createDir(dir); } catch (_) { /* já existe */ }
      await ff.mount('WORKERFS', { files: [arq] }, dir);
      const entrada = `${dir}/${arq.name}`;

      st('Lendo o arquivo…', 0.05);
      await ff.exec(['-hide_banner', '-i', entrada]); // só para descobrir a duração
      const dur = lerDuracao(logs);
      if (!/Audio:/.test(logs.join('\n'))) throw new Error('Este arquivo não tem faixa de áudio.');

      // taxa escolhida para o resultado caber numa só requisição (mínimo 10 kbps, máximo 32 kbps)
      const kbps = dur ? Math.max(10, Math.min(32, Math.floor((ALVO_BYTES * 8) / dur / 1000))) : 24;
      const aoProgresso = ({ time }) => {
        const seg = time / 1e6;
        if (dur && seg > 0) st(`Extraindo o áudio… ${fmt(Math.min(seg, dur))} de ${fmt(dur)}`, 0.05 + 0.4 * Math.min(1, seg / dur));
      };
      ff.on('progress', aoProgresso);
      st('Extraindo o áudio…', 0.06);
      const codigo = await ff.exec(['-hide_banner', '-y', '-i', entrada, '-vn', '-map', '0:a:0', '-ac', '1', '-ar', '16000',
        '-c:a', 'libopus', '-b:a', `${kbps}k`, '-vbr', 'constrained', '-application', 'voip', '/saida.ogg']);
      ff.off('progress', aoProgresso);
      if (codigo !== 0) throw new Error('Não foi possível extrair o áudio deste arquivo.');

      const dados = await ff.readFile('/saida.ogg');
      await ff.deleteFile('/saida.ogg');
      const base = (arq.name || 'sessao').replace(/\.[^.]+$/, '');
      const pronto = new File([dados], `${base}.ogg`, { type: 'audio/ogg' });
      st(`Áudio pronto: ${(pronto.size / 1048576).toFixed(1)} MB (original ${(arq.size / 1048576).toFixed(0)} MB)`, 0.45);
      return pronto;
    } finally {
      ff.off('log', aoLog);
      try { await ff.unmount(dir); } catch (_) { /* ignora */ }
    }
  }

  global.Conversor = { prepararAudio, precisaConverter };
})(window);
