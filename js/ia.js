// Integração com a API do Google Gemini (roda direto no navegador)
(function (global) {
  const BASE = 'https://generativelanguage.googleapis.com';
  const LIMITE_INLINE = 14 * 1024 * 1024; // acima disso usa a Files API

  const MIME_POR_EXT = {
    mp3: 'audio/mp3', mpeg: 'audio/mpeg', m4a: 'audio/mp4', mp4: 'video/mp4', aac: 'audio/aac',
    wav: 'audio/wav', ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg', flac: 'audio/flac',
    webm: 'audio/webm', amr: 'audio/amr', '3gp': 'video/3gpp', mov: 'video/quicktime', aiff: 'audio/aiff',
  };

  function mimeDe(arquivo) {
    const ext = (arquivo.name || '').split('.').pop().toLowerCase();
    let t = (arquivo.type || '').split(';')[0];
    if (!t || t === 'application/octet-stream') t = MIME_POR_EXT[ext] || 'audio/mpeg';
    if (t === 'audio/x-m4a') t = 'audio/mp4';
    return t;
  }

  async function lerErro(resp) {
    let msg = `HTTP ${resp.status}`;
    try { const j = await resp.json(); msg = j.error?.message || msg; } catch (_) { /* sem corpo */ }
    if (resp.status === 400 && /API key/i.test(msg)) msg = 'Chave de API inválida. Confira em Configurações.';
    if (resp.status === 404) msg += ' — o modelo escolhido pode não existir mais. Em Configurações, clique em "Buscar modelos".';
    if (resp.status === 429) msg = 'Limite de uso da API atingido (cota gratuita). Aguarde alguns minutos ou use uma chave com faturamento ativo. Detalhe: ' + msg;
    return new Error(msg);
  }

  async function listarModelos(chave) {
    const r = await fetch(`${BASE}/v1beta/models?pageSize=200&key=${encodeURIComponent(chave)}`);
    if (!r.ok) throw await lerErro(r);
    const j = await r.json();
    return (j.models || [])
      .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent') && /gemini/i.test(m.name) &&
        !/(tts|image|embedding|live|robotics|native-audio)/i.test(m.name))
      .map((m) => ({ id: m.name.replace('models/', ''), nome: m.displayName || m.name }));
  }

  function base64(blob) {
    return new Promise((ok, falha) => {
      const fr = new FileReader();
      fr.onload = () => ok(String(fr.result).split(',')[1]);
      fr.onerror = () => falha(fr.error);
      fr.readAsDataURL(blob);
    });
  }

  // Upload resumível para a Files API (arquivos grandes, até 2 GB)
  async function enviarArquivoGrande(chave, arquivo, mime, onProgresso) {
    const ini = await fetch(`${BASE}/upload/v1beta/files?key=${encodeURIComponent(chave)}`, {
      method: 'POST',
      headers: {
        'X-Goog-Upload-Protocol': 'resumable',
        'X-Goog-Upload-Command': 'start',
        'X-Goog-Upload-Header-Content-Length': String(arquivo.size),
        'X-Goog-Upload-Header-Content-Type': mime,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ file: { display_name: (arquivo.name || 'audio-sessao').slice(0, 100) } }),
    });
    if (!ini.ok) throw await lerErro(ini);
    const url = ini.headers.get('x-goog-upload-url');
    if (!url) throw new Error('O Google não devolveu o endereço de upload. Tente um arquivo menor que 14 MB (ex.: MP3 em 32 kbps).');

    const info = await new Promise((ok, falha) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url);
      xhr.setRequestHeader('X-Goog-Upload-Offset', '0');
      xhr.setRequestHeader('X-Goog-Upload-Command', 'upload, finalize');
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgresso && onProgresso(e.loaded / e.total);
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) { try { ok(JSON.parse(xhr.responseText).file); } catch (e) { falha(e); } }
        else falha(new Error(`Falha no envio do áudio (HTTP ${xhr.status}).`));
      };
      xhr.onerror = () => falha(new Error('Falha de rede ao enviar o áudio.'));
      xhr.send(arquivo);
    });

    // aguarda o processamento do arquivo no Google
    let f = info;
    for (let i = 0; f.state === 'PROCESSING' && i < 120; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const r = await fetch(`${BASE}/v1beta/${f.name}?key=${encodeURIComponent(chave)}`);
      if (!r.ok) throw await lerErro(r);
      f = await r.json();
    }
    if (f.state === 'FAILED') throw new Error('O Google não conseguiu processar este arquivo de áudio. Tente convertê-lo para MP3.');
    return { fileData: { mimeType: f.mimeType || mime, fileUri: f.uri }, nome: f.name };
  }

  async function apagarArquivo(chave, nome) {
    try { await fetch(`${BASE}/v1beta/${nome}?key=${encodeURIComponent(chave)}`, { method: 'DELETE' }); } catch (_) { /* ignora */ }
  }

  const S = { type: 'STRING' };
  const ESQUEMA_ATA = {
    type: 'OBJECT',
    properties: {
      data: { type: 'STRING', description: 'Data da sessão AAAA-MM-DD, se mencionada; senão vazio' },
      horaInicio: { type: 'STRING', description: 'HH:MM' },
      horaFim: { type: 'STRING', description: 'HH:MM' },
      grau: { type: 'STRING', enum: ['APRENDIZ', 'COMPANHEIRO', 'MESTRE', ''] },
      tipo: S,
      presentesQuadro: { type: 'STRING', description: 'Número de irmãos do quadro presentes, só dígitos, ou vazio' },
      visitantesQtd: { type: 'STRING', description: 'Número de visitantes, só dígitos, ou vazio' },
      visitantesNomes: { type: 'STRING', description: 'Nomes dos visitantes (e Loja de origem) separados por ponto e vírgula' },
      vm: S, vig1: S, vig2: S, orador: S, secretario: S,
      balaustreModo: { type: 'STRING', enum: ['suprimido', 'aprovado', 'texto'] },
      balaustreData: { type: 'STRING', description: 'AAAA-MM-DD da sessão cujo balaústre foi lido, se dita' },
      balaustreTexto: S,
      atos: S, expedientes: S, propostas: S, ordemDoDia: S,
      troncoHouve: { type: 'BOOLEAN' },
      troncoValor: { type: 'STRING', description: 'Só o número de quilos de medalhas cunhadas' },
      saudacao: S,
      palavraSul: S, palavraNorte: S, palavraOriente: S,
      observacoes: { type: 'STRING', description: 'Dúvidas, trechos inaudíveis ou pontos que o Secretário deve conferir' },
    },
    required: ['ordemDoDia', 'expedientes', 'palavraSul', 'palavraNorte', 'palavraOriente', 'observacoes', 'troncoHouve', 'balaustreModo'],
  };

  const EXEMPLO_ESTILO = `ORDEM DO DIA: Continuidade do Projeto Conexão de Saberes, tema "Depressão: a epidemia silenciosa do século XXI", apresentado pelo Ir∴ Eric, e o que houver. O Ir∴ Eric deu uma aula sobre sintomas depressivos e como identificá-los, explicou como a depressão é definida e disse que hoje ela é a segunda doença que mais causa afastamento do trabalho. Houve questionamentos por parte de todos os irmãos presentes.
EXPEDIENTES: Pranchas 04 e 05/2025 da Loja Maçônica Harmonia e Concórdia nº 28, sobre a nomeação do primeiro e segundo vigilantes; Prancha 08/2025, informando que no dia 30 de julho haverá Sessão Conjunta no Grau de Ap∴ M∴.
PALAVRA (Sul): o Ir∴ Marcio, como Chanc∴, parabenizou o Ir∴ Alain por sua primavera no dia 21/07. O Ir∴ Alain agradeceu e justificou sua ausência na reunião com o prefeito.
PALAVRA (Oriente): o V∴ M∴ agradeceu a todos os envolvidos nos projetos e falou sobre a visita da comitiva ao prefeito de Simão Dias.`;

  function promptAta(ctx) {
    return `Você é o Secretário da Loja Maçônica ${ctx.loja.nome} nº ${ctx.loja.numero} (Oriente de ${ctx.loja.oriente}/${ctx.loja.uf}) e vai redigir a ata (balaústre) da sessão a partir do material anexado (gravação de áudio ou transcrição).

DADOS JÁ CONHECIDOS (use se o material não disser outra coisa):
- Data prevista: ${ctx.data || 'não informada'} | Grau: ${ctx.grau} | Tipo: ${ctx.tipo}
- V∴ M∴: ${ctx.oficiais.vm || '?'} | 1º Vig∴: ${ctx.oficiais.vig1 || '?'} | 2º Vig∴: ${ctx.oficiais.vig2 || '?'} | Or∴: ${ctx.oficiais.orador || '?'} | Sec∴: ${ctx.oficiais.secretario || '?'}
${ctx.instrucoes ? '- Orientações do Secretário: ' + ctx.instrucoes : ''}

REGRAS DE REDAÇÃO:
1. Português formal, terceira pessoa, pretérito perfeito, no estilo das atas da Loja (exemplo abaixo). Frases claras, sem floreio.
2. Use as abreviações maçônicas com o sinal ∴: Ir∴ (irmão), IIr∴ (irmãos), V∴ M∴ (Venerável Mestre), 1º Vig∴, 2º Vig∴, VVig∴, Or∴ (Orador), Sec∴ (Secretário), Tes∴ (Tesoureiro), Hosp∴ (Hospitaleiro), Chanc∴ (Chanceler), M∴ de CCer∴ (Mestre de Cerimônias).
3. NÃO reproduza palavras, diálogos, juramentos, sinais ou procedimentos ritualísticos (abertura, encerramento, iniciação etc.). Eles são reservados: registre apenas que ocorreram "na forma ritualística".
4. NÃO invente fatos, nomes, números, datas ou valores. O que não foi dito ou ficou inaudível fica vazio e vai para "observacoes".
5. Resuma as falas com fidelidade, sem vícios de linguagem nem repetições. Preserve nomes próprios, números de pranchas, nomes de Lojas, datas e valores.
6. Corrija nomes de oficiais usando a lista de DADOS JÁ CONHECIDOS quando a pronúncia for parecida.

COMO PREENCHER CADA CAMPO:
- balaustreModo: "suprimido" se a leitura do balaústre anterior foi suprimida; "aprovado" se foi lido e aprovado (balaustreData se a data for dita); "texto" para qualquer outro caso, descrito em balaustreTexto.
- atos: atos e decretos lidos (pranchas da Grande Loja, decretos). Vazio se não houve.
- expedientes: correspondências recebidas, em lista corrida separada por ponto e vírgula: número da prancha/edital, Loja de origem e assunto.
- propostas: propostas e informações apresentadas. Vazio se não houve.
- ordemDoDia: comece com a pauta anunciada (terminando em "e o que houver.") e siga com o desenvolvimento: instruções, palestras, votações, discussões e decisões, com quem falou o quê.
- troncoHouve / troncoValor: se circulou a Bolsa de Beneficência e o valor anunciado em "quilos de medalhas cunhadas".
- saudacao: como o Or∴ saudou os visitantes. Vazio se não houve visitantes.
- palavraSul, palavraNorte, palavraOriente: o que foi dito em cada coluna na "Palavra a bem da Ordem". Comece direto por quem falou (ex.: "o Ir∴ Marcio parabenizou..."), sem repetir "No Sul".
- observacoes: lista curta do que o Secretário precisa conferir (nomes duvidosos, números não ditos, trechos inaudíveis).

EXEMPLO DE ESTILO (trechos de atas reais da Loja):
${EXEMPLO_ESTILO}

Responda apenas com o JSON no esquema pedido.`;
  }

  async function chamar(chave, modelo, partes, esquema, temperatura = 0.3) {
    const r = await fetch(`${BASE}/v1beta/models/${encodeURIComponent(modelo)}:generateContent?key=${encodeURIComponent(chave)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: partes }],
        generationConfig: { responseMimeType: 'application/json', responseSchema: esquema, temperature: temperatura, maxOutputTokens: 32768 },
      }),
    });
    if (!r.ok) throw await lerErro(r);
    const j = await r.json();
    const cand = j.candidates?.[0];
    if (!cand) throw new Error('A IA não retornou resposta. ' + (j.promptFeedback?.blockReason ? 'Motivo: ' + j.promptFeedback.blockReason : ''));
    const texto = (cand.content?.parts || []).map((p) => p.text || '').join('');
    try { return JSON.parse(texto); } catch (_) {
      const a = texto.indexOf('{'), b = texto.lastIndexOf('}');
      if (a >= 0 && b > a) { try { return JSON.parse(texto.slice(a, b + 1)); } catch (_) { /* segue */ } }
      throw new Error(cand.finishReason === 'MAX_TOKENS'
        ? 'A resposta da IA ficou longa demais e foi cortada. Tente um modelo "Pro" ou divida o áudio.'
        : 'Não foi possível ler a resposta da IA. Tente novamente.');
    }
  }

  // Gera a ata a partir de áudio (File/Blob) ou texto
  async function gerarAta({ chave, modelo, audio, transcricao, contexto, onStatus }) {
    if (!chave) throw new Error('Cadastre sua chave da API do Google Gemini em Configurações.');
    const st = onStatus || (() => {});
    const partes = [{ text: promptAta(contexto) }];
    let enviado = null;
    if (audio && global.Conversor) {
      try { audio = await global.Conversor.prepararAudio(audio, st); }
      catch (e) {
        if (/faixa de áudio/.test(e.message)) throw e;
        console.warn('Conversão falhou, enviando o original', e);
        st('Não consegui converter no navegador; enviando o arquivo original…', 0.05);
      }
    }
    if (audio) {
      const mime = mimeDe(audio);
      if (audio.size <= LIMITE_INLINE) {
        st('Preparando o áudio…', 0.1);
        partes.push({ inlineData: { mimeType: mime, data: await base64(audio) } });
      } else {
        st('Enviando o áudio para o Google…', 0.02);
        enviado = await enviarArquivoGrande(chave, audio, mime, (p) => st(`Enviando o áudio… ${Math.round(p * 100)}%`, p * 0.4));
        partes.push({ fileData: enviado.fileData });
      }
    }
    if (transcricao) partes.push({ text: 'TRANSCRIÇÃO / ANOTAÇÕES DA SESSÃO:\n' + transcricao });
    st('A IA está ouvindo a sessão e redigindo a ata… (pode levar alguns minutos)', 0.5);
    try {
      return await chamar(chave, modelo, partes, ESQUEMA_ATA);
    } finally {
      if (enviado) apagarArquivo(chave, enviado.nome);
    }
  }

  const CAMPOS_REVISAO = ['atos', 'expedientes', 'propostas', 'ordemDoDia', 'saudacao', 'palavraSul', 'palavraNorte', 'palavraOriente', 'balaustreTexto', 'sinteseManual'];

  async function revisarTexto({ chave, modelo, campos }) {
    if (!chave) throw new Error('Cadastre sua chave da API do Google Gemini em Configurações.');
    const props = {};
    CAMPOS_REVISAO.forEach((c) => { props[c] = { type: 'STRING' }; });
    const prompt = `Revise a ortografia, a concordância e a pontuação dos textos abaixo, que fazem parte da ata de uma Loja Maçônica.
Regras: mantenha exatamente os fatos, nomes, números, datas e a ordem das informações; não acrescente nem remova conteúdo; mantenha as abreviações maçônicas com ∴ (Ir∴, IIr∴, V∴ M∴, Vig∴, Or∴, Sec∴...); use tom formal e terceira pessoa; campos vazios continuam vazios.
Devolva o JSON com as mesmas chaves.

${JSON.stringify(campos, null, 2)}`;
    return chamar(chave, modelo, [{ text: prompt }], { type: 'OBJECT', properties: props }, 0.1);
  }

  global.IA = { listarModelos, gerarAta, revisarTexto, CAMPOS_REVISAO, mimeDe };
})(window);
