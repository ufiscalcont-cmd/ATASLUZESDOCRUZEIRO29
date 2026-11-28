// Modelo de dados e montagem do texto da ata
(function (global) {
  const E = global.Extenso;

  const GRAUS = {
    APRENDIZ: { titulo: 'APRENDIZ DE MAÇOM', corpo: 'Aprendiz de Maçom' },
    COMPANHEIRO: { titulo: 'COMPANHEIRO MAÇOM', corpo: 'Companheiro Maçom' },
    MESTRE: { titulo: 'MESTRE MAÇOM', corpo: 'Mestre Maçom' },
  };

  const TIPOS = ['ECONÔMICA', 'MAGNA DE INICIAÇÃO', 'MAGNA DE ELEVAÇÃO', 'MAGNA DE EXALTAÇÃO',
    'MAGNA DE POSSE', 'MAGNA CONJUNTA', 'ECONÔMICA CONJUNTA', 'EXTRAORDINÁRIA', 'BRANCA'];

  const CONFIG_PADRAO = {
    loja: {
      nome: 'Luzes do Cruzeiro',
      numero: '29',
      fundacao: '23 de agosto de 2023',
      jurisdicao: 'Grande Loja do Estado de Sergipe',
      oriente: 'Simão Dias',
      uf: 'SE',
      estado: 'SERGIPE',
      endereco: 'Rua Arivaldo Chagas Silva nº 605, Centro',
      padroeiro: 'São João',
    },
    oficiais: { vm: '', vig1: '', vig2: '', orador: '', secretario: '' },
    contadores: { APRENDIZ: 0, COMPANHEIRO: 0, MESTRE: 0 },
    documento: { fonte: 'Cambria', tamanho: 12, timbre: 'nenhum', paragrafoUnico: true },
    ia: { chave: '', modelo: 'gemini-flash-latest' },
    drive: { clientId: '', salvarDocumentos: true, salvarConfig: true },
  };

  function hojeISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function novaAta(cfg) {
    const grau = 'APRENDIZ';
    return {
      id: 'ata_' + Date.now().toString(36),
      status: 'rascunho',
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
      tipo: 'ECONÔMICA',
      grau,
      numero: (Number(cfg.contadores[grau]) || 0) + 1,
      data: hojeISO(),
      horaInicio: '20:00',
      horaFim: '22:00',
      presentesQuadro: '',
      visitantesQtd: '',
      visitantesNomes: '',
      oficiais: { ...cfg.oficiais, vmAdHoc: false, vig1AdHoc: false, vig2AdHoc: false, oradorAdHoc: false, secAdHoc: false },
      balaustre: { modo: 'aprovado', data: '', texto: '' },
      atos: '',
      expedientes: '',
      propostas: '',
      ordemDoDia: '',
      tronco: { houve: true, valor: '' },
      saudacao: '',
      palavra: { sul: '', norte: '', oriente: '' },
      dataLavratura: hojeISO(),
      sinteseManual: '',
      observacoesIA: '',
    };
  }

  const limpo = (s) => String(s || '').trim();
  const comPonto = (s) => { s = limpo(s); return s && !/[.!?…:;]$/.test(s) ? s + '.' : s; };
  const ou = (s, alt) => limpo(s) ? comPonto(s) : alt;

  function cargo(sigla, nome, adHoc) {
    const n = limpo(nome) || '______________________';
    return `${sigla}${adHoc ? ' ad hoc' : ''} ${n}`;
  }

  function textoTronco(ata) {
    if (!ata.tronco.houve) return 'Não houve.';
    const n = parseInt(String(ata.tronco.valor || '').replace(/\D/g, ''), 10);
    const valor = isNaN(n) ? '___ (_____)' : `${n} (${E.extenso(n)})`;
    return `Depois do anúncio feito pelo V∴ M∴ e VVig∴, o Ir∴ Hosp∴ circulou com a Bolsa para o Tronco de Solidariedade. Após sua conferência pelo Ir∴ Tes∴, arrecadou ${valor} quilos de medalhas cunhadas, que serão debitados a Tes∴ e creditados a Hosp∴.`;
  }

  function listaVisitantes(ata) {
    return limpo(ata.visitantesNomes).split(/[\n;]+/).map(limpo)
      .map((n) => n.replace(/^(IIr∴|Ir∴|Ir\.|Irmão|Irmaos|Irmãos)\s*/i, '')).filter(Boolean);
  }

  function qtdVisitantes(ata) {
    const q = parseInt(ata.visitantesQtd, 10);
    return isNaN(q) ? listaVisitantes(ata).length : q;
  }

  function textoSaudacao(ata) {
    if (limpo(ata.saudacao)) return comPonto(ata.saudacao);
    const nomes = listaVisitantes(ata);
    const q = qtdVisitantes(ata);
    if (!q && !nomes.length) return 'Não houve visita.';
    if (!nomes.length) return `O Ir∴ Or∴ saudou ${q > 1 ? 'os IIr∴ visitantes' : 'o Ir∴ visitante'} na forma ritualística.`;
    const juntar = nomes.length > 1 ? nomes.slice(0, -1).join(', ') + ' e ' + nomes[nomes.length - 1] : nomes[0];
    return `O Ir∴ Or∴ saudou ${nomes.length > 1 ? 'os IIr∴ visitantes' : 'o Ir∴ visitante'} ${juntar} na forma ritualística.`;
  }

  function textoBalaustre(ata) {
    const b = ata.balaustre;
    if (b.modo === 'suprimido') return 'Foi suprimido.';
    if (b.modo === 'texto') return ou(b.texto, 'Foi suprimido.');
    const data = b.data ? ` do dia ${E.dataCurta(b.data)}` : ' da sessão anterior';
    return `Foi decifrado e submetido à apreciação da Assembleia o Balaústre${data}, sendo aprovado por unanimidade.`;
  }

  function textoPalavra(ata) {
    const p = ata.palavra;
    const partes = [];
    if (limpo(p.sul)) partes.push(`No Sul, ${comPonto(p.sul)}`);
    if (limpo(p.norte)) partes.push(`No Norte, ${comPonto(p.norte)}`);
    if (limpo(p.oriente)) partes.push(`No Oriente, ${comPonto(p.oriente)}`);
    return partes.length ? partes.join(' ') : 'Ninguém fez uso da palavra.';
  }

  // Estrutura neutra usada por todos os formatos de saída
  function montar(ata, cfg) {
    const L = cfg.loja, O = ata.oficiais;
    const grau = GRAUS[ata.grau] || GRAUS.APRENDIZ;
    const num = String(ata.numero || '').padStart(2, '0');

    const cabecalho = [
      'À G∴ D∴ G∴ A∴ D∴ U∴',
      `Loja Maçônica ${L.nome} Nº ${L.numero}`,
      `Fundada em ${L.fundacao}`,
      `Jurisdicionada à ${L.jurisdicao}`,
      `OR∴ DE ${L.oriente.toUpperCase()} - ${L.estado.toUpperCase()}`,
    ];
    const titulo = [
      `SESSÃO ${limpo(ata.tipo).toUpperCase()} DE ${grau.titulo} Nº ${num}`,
      `REALIZADA NO DIA ${E.dataTitulo(ata.data)}`,
    ];

    const ordem = ou(ata.ordemDoDia, '______________________________.');
    const sintese = [];
    if (limpo(ata.sinteseManual)) sintese.push({ rotulo: null, texto: comPonto(ata.sinteseManual) });
    else {
      sintese.push({ rotulo: 'ORDEM DO DIA', texto: ordem });
      if (ata.tronco.houve) sintese.push({ rotulo: 'BOLSA DE BENEFICÊNCIA PARA O TRONCO DE SOLIDARIEDADE', texto: textoTronco(ata) });
    }

    const qV = qtdVisitantes(ata);
    const pq = parseInt(ata.presentesQuadro, 10);
    const presenca = `contando com a presença de ${isNaN(pq) ? '__ (____)' : E.numComExtenso(pq)} ${pq === 1 ? 'Ir∴' : 'IIr∴'} do quadro` +
      (qV ? ` e ${E.numComExtenso(qV)} ${qV === 1 ? 'Ir∴ visitante' : 'IIr∴ visitantes'}` : '') +
      ' que assinaram o Livro de Presença';

    const abertura = `À Glória do G∴A∴D∴U∴ e de ${L.padroeiro}, nosso Padroeiro, ${E.dataAbertura(ata.data)}, às ${E.hora(ata.horaInicio)}, ` +
      `reuniu-se em seu Templo situado na ${L.endereco}, Oriente de ${L.oriente}–${L.uf}, a Loja Maçônica ${L.nome} nº ${L.numero}, ` +
      `no grau de ${grau.corpo}, ${presenca}. Os trabalhos foram dirigidos pelo ${cargo('V∴ M∴', O.vm, O.vmAdHoc)}, ` +
      `${cargo('1º Vig∴', O.vig1, O.vig1AdHoc)}, e ${cargo('2º Vig∴', O.vig2, O.vig2AdHoc)}. ` +
      `Tendo como ${cargo('Or∴', O.orador, O.oradorAdHoc)} e ${cargo('Sec∴', O.secretario, O.secAdHoc)}.`;

    const sec = limpo(O.secretario) || '______________________';
    const encerramento = `O encerramento ocorreu às ${E.hora(ata.horaFim)}, na sua forma ritualística, e eu, ${sec}, Sec∴${O.secAdHoc ? ' ad hoc' : ''}, ` +
      `lavrei o presente balaústre longe das vistas e indiscrições profanas, que depois de decifrado e aprovado pela Augusta Assembleia, ` +
      `será assinado por quem de direito. Or∴ de ${L.oriente}, ${E.dataLavratura(ata.dataLavratura || ata.data)}.`;

    const corpo = [
      { rotulo: null, texto: abertura },
      { rotulo: 'BALAÚSTRE', texto: textoBalaustre(ata) },
      { rotulo: 'ATOS E DECRETOS', texto: ou(ata.atos, 'Não houve.') },
      { rotulo: 'EXPEDIENTES', texto: ou(ata.expedientes, 'Não houve.') },
      { rotulo: 'PROPOSTAS E INFORMAÇÕES', texto: ou(ata.propostas, 'Não houve.') },
      { rotulo: 'ORDEM DO DIA', texto: ordem },
      { rotulo: 'BOLSA DE BENEFICÊNCIA PARA O TRONCO DE SOLIDARIEDADE', texto: textoTronco(ata) },
      { rotulo: 'SAUDAÇÃO AOS IRMÃOS VISITANTES', texto: textoSaudacao(ata) },
      { rotulo: 'PALAVRA A BEM DA ORDEM GERAL E DO QUADRO EM PARTICULAR', texto: textoPalavra(ata) },
      { rotulo: 'ENCERRAMENTO DOS TRABALHOS', texto: encerramento },
    ];

    const assinaturas = [
      { cargo: `V∴M∴${O.vmAdHoc ? ' ad hoc' : ''}`, nome: limpo(O.vm) },
      { cargo: `Or∴${O.oradorAdHoc ? ' ad hoc' : ''}`, nome: limpo(O.orador) },
      { cargo: `Sec∴${O.secAdHoc ? ' ad hoc' : ''}`, nome: limpo(O.secretario) },
    ];

    const nomeArquivo = `ATA SESSAO DE ${ata.grau} ${num} ${E.dataCurta(ata.data).replace(/\//g, ' ')}`.trim();
    return { cabecalho, titulo, sintese, corpo, assinaturas, nomeArquivo };
  }

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const bloco = (b) => (b.rotulo ? `<b>${esc(b.rotulo)}:</b> ` : '') + esc(b.texto).replace(/\n+/g, ' ');

  function paraHTML(est, cfg) {
    const unico = cfg.documento.paragrafoUnico;
    const corpo = unico
      ? `<p class="j">${est.corpo.map(bloco).join(' ')}</p>`
      : est.corpo.map((b) => `<p class="j">${bloco(b)}</p>`).join('');
    return `
      <div class="ata-titulo">${est.titulo.map((t) => `<p>${esc(t)}</p>`).join('')}</div>
      <p class="ata-sintese-rot">Síntese</p>
      ${est.sintese.map((b) => `<p class="j">${bloco(b)}</p>`).join('')}
      <p class="ata-sec">ATA</p>
      ${corpo}
      <div class="ata-assin">${est.assinaturas.map((a) => `<div><span class="linha"></span><p>${esc(a.cargo)} ${esc(a.nome)}</p></div>`).join('')}</div>`;
  }

  function paraTexto(est) {
    const b = (x) => (x.rotulo ? `${x.rotulo}: ` : '') + x.texto;
    return [
      ...est.cabecalho, '',
      ...est.titulo, '',
      'Síntese', '',
      ...est.sintese.map(b).flatMap((t) => [t, '']),
      'ATA', '',
      est.corpo.map(b).join(' '), '',
      ...est.assinaturas.flatMap((a) => ['________________________________________', `${a.cargo} ${a.nome}`, '']),
    ].join('\n');
  }

  global.Ata = { GRAUS, TIPOS, CONFIG_PADRAO, novaAta, montar, paraHTML, paraTexto, hojeISO, esc };
})(window);
