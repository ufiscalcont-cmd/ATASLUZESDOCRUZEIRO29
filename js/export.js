// Exportação: Word (.docx), PDF/impressão e texto
(function (global) {
  const cm = (v) => Math.round(v * 567); // centímetros -> twips

  // Papéis timbrados: imagem de página inteira + margens próprias (cm no Word, mm na impressão)
  const TIMBRES = {
    classico: { img: 'assets/timbre.jpg', cabTam: null,
      docx: { top: 6.2, bottom: 3.2, header: 3.4, footer: 1.2 }, imp: { topo: 34, base: 30, depoisCab: 4 }, previa: { topo: '16%', base: '13%' } },
    moderno: { img: 'assets/timbre-moderno.jpg', cabTam: 11,
      docx: { top: 4.9, bottom: 3.1, header: 1.05, footer: 1.9 }, imp: { topo: 10.5, base: 27, depoisCab: 9 }, previa: { topo: '5%', base: '14%' } },
  };
  function timbreAtual(cfg) {
    let t = cfg.documento.timbre;
    if (t === true) t = 'moderno';
    return TIMBRES[t] || null;
  }

  const timbreCache = {};
  async function timbreBytes(url) {
    if (timbreCache[url]) return timbreCache[url];
    const r = await fetch(url);
    timbreCache[url] = new Uint8Array(await r.arrayBuffer());
    return timbreCache[url];
  }

  async function gerarDocx(est, cfg) {
    const D = global.docx;
    const doc = cfg.documento;
    const fonte = doc.fonte || 'Cambria';
    const tam = (Number(doc.tamanho) || 12) * 2;
    const T = timbreAtual(cfg);
    const comTimbre = !!T;
    const tamCab = T && T.cabTam ? T.cabTam * 2 : tam;

    // O sinal ∴ não existe na Cambria/Times: no Word ele vira outro caractere.
    // Cada ∴ vai num trecho com fonte que tem o símbolo (Cambria Math, instalada com o Office).
    const FONTE_SIMBOLO = 'Cambria Math';
    const run = (texto, extra = {}) => String(texto).split(/(∴+)/).filter((t) => t !== '').map((t) =>
      new D.TextRun({ text: t, size: tam, ...extra,
        font: t.startsWith('∴') ? { ascii: FONTE_SIMBOLO, hAnsi: FONTE_SIMBOLO, cs: FONTE_SIMBOLO, eastAsia: FONTE_SIMBOLO } : fonte }));
    const linhaCab = (t) => new D.Paragraph({ alignment: D.AlignmentType.CENTER, spacing: { after: 0, line: 240 }, children: run(t, { bold: true, size: tamCab }) });

    const cabFilhos = [];
    if (comTimbre) {
      cabFilhos.push(new D.Paragraph({
        children: [new D.ImageRun({
          type: 'jpg',
          data: await timbreBytes(T.img),
          transformation: { width: 794, height: 1123 },
          floating: {
            horizontalPosition: { relative: D.HorizontalPositionRelativeFrom.PAGE, offset: 0 },
            verticalPosition: { relative: D.VerticalPositionRelativeFrom.PAGE, offset: 0 },
            behindDocument: true,
            allowOverlap: true,
          },
        })],
      }));
    }
    est.cabecalho.forEach((t) => cabFilhos.push(linhaCab(t)));

    const P = (filhos, opts = {}) => new D.Paragraph({
      alignment: D.AlignmentType.JUSTIFIED,
      spacing: { line: 360, after: 200 },
      children: filhos,
      ...opts,
    });
    const blocoRuns = (b) => [
      ...(b.rotulo ? [...run(b.rotulo + ':', { bold: true }), ...run(' ')] : []),
      ...run(b.texto.replace(/\s*\n+\s*/g, ' ')),
    ];

    const corpo = [];
    est.titulo.forEach((t, i) => corpo.push(new D.Paragraph({
      alignment: D.AlignmentType.CENTER, spacing: { before: i === 0 ? 240 : 0, after: 240 },
      children: run(t, { bold: true }),
    })));
    corpo.push(new D.Paragraph({ spacing: { after: 200 }, children: run('Síntese', { bold: true }) }));
    est.sintese.forEach((b) => corpo.push(P(blocoRuns(b))));
    corpo.push(new D.Paragraph({ alignment: D.AlignmentType.CENTER, spacing: { before: 240, after: 240 }, children: run('ATA', { bold: true }) }));

    if (doc.paragrafoUnico) {
      const runs = [];
      est.corpo.forEach((b, i) => { if (i) runs.push(...run(' ')); runs.push(...blocoRuns(b)); });
      corpo.push(P(runs));
    } else {
      est.corpo.forEach((b) => corpo.push(P(blocoRuns(b))));
    }

    est.assinaturas.forEach((a, i) => {
      corpo.push(new D.Paragraph({ alignment: D.AlignmentType.CENTER, spacing: { before: i === 0 ? 720 : 600, after: 0 }, keepNext: true,
        children: run('_____________________________________________') }));
      corpo.push(new D.Paragraph({ alignment: D.AlignmentType.CENTER, spacing: { after: 0 }, keepLines: true,
        children: run(`${a.cargo} ${a.nome}`.trim()) }));
    });

    const documento = new D.Document({
      creator: 'Gerador de Atas',
      title: est.nomeArquivo,
      styles: { default: { document: { run: { font: fonte, size: tam } } } },
      sections: [{
        properties: {
          page: {
            size: { width: cm(21), height: cm(29.7) },
            margin: comTimbre
              ? { top: cm(T.docx.top), bottom: cm(T.docx.bottom), left: cm(3), right: cm(2), header: cm(T.docx.header), footer: cm(T.docx.footer) }
              : { top: cm(4.6), bottom: cm(2.2), left: cm(3), right: cm(2), header: cm(1.4), footer: cm(1.2) },
          },
        },
        headers: { default: new D.Header({ children: cabFilhos }) },
        footers: { default: new D.Footer({ children: [new D.Paragraph({ alignment: D.AlignmentType.RIGHT, children: [new D.TextRun({ children: [D.PageNumber.CURRENT], font: fonte, size: 18 })] })] }) },
        children: corpo,
      }],
    });
    return D.Packer.toBlob(documento);
  }

  function baixar(blob, nome) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }

  // Impressão / PDF: tabela com thead/tfoot repete cabeçalho e margens em todas as páginas
  function imprimir(est, cfg) {
    const area = document.getElementById('area-impressao');
    const doc = cfg.documento;
    const esc = global.Ata.esc;
    const T = timbreAtual(cfg);
    const topo = T ? T.imp.topo : 14, base = T ? T.imp.base : 18;
    area.style.setProperty('--tam-cab', T && T.cabTam ? `${T.cabTam}pt` : `${doc.tamanho || 12}pt`);
    area.style.setProperty('--depois-cab', `${T ? T.imp.depoisCab : 4}mm`);
    area.style.setProperty('--fonte-doc', `'${doc.fonte || 'Cambria'}', Cambria, 'Times New Roman', serif`);
    area.style.setProperty('--tam-doc', `${doc.tamanho || 12}pt`);
    area.innerHTML = `
      ${T ? `<img class="imp-timbre" src="${T.img}" alt="">` : ''}
      <table class="imp-tabela">
        <thead><tr><td>
          <div style="height:${topo}mm"></div>
          <div class="imp-cab">${est.cabecalho.map((l) => `<p>${esc(l)}</p>`).join('')}</div>
        </td></tr></thead>
        <tfoot><tr><td><div style="height:${base}mm"></div></td></tr></tfoot>
        <tbody><tr><td><div class="folha-texto">${global.Ata.paraHTML(est, cfg)}</div></td></tr></tbody>
      </table>`;
    const tituloOriginal = document.title;
    document.title = est.nomeArquivo;
    const pronto = () => { window.print(); document.title = tituloOriginal; };
    const img = area.querySelector('img');
    if (img && !img.complete) img.onload = pronto; else setTimeout(pronto, 50);
  }

  global.Exportar = { gerarDocx, baixar, imprimir, timbreAtual };
})(window);
