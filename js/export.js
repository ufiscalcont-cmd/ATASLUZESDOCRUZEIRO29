// Exportação: Word (.docx), PDF/impressão e texto
(function (global) {
  const cm = (v) => Math.round(v * 567); // centímetros -> twips

  let timbreCache = null;
  async function timbreBytes() {
    if (timbreCache) return timbreCache;
    const r = await fetch('assets/timbre.jpg');
    timbreCache = new Uint8Array(await r.arrayBuffer());
    return timbreCache;
  }

  async function gerarDocx(est, cfg) {
    const D = global.docx;
    const doc = cfg.documento;
    const fonte = doc.fonte || 'Cambria';
    const tam = (Number(doc.tamanho) || 12) * 2;
    const comTimbre = !!doc.timbre;

    const run = (texto, extra = {}) => new D.TextRun({ text: texto, font: fonte, size: tam, ...extra });
    const linhaCab = (t) => new D.Paragraph({ alignment: D.AlignmentType.CENTER, spacing: { after: 0, line: 240 }, children: [run(t, { bold: true })] });

    const cabFilhos = [];
    if (comTimbre) {
      cabFilhos.push(new D.Paragraph({
        children: [new D.ImageRun({
          type: 'jpg',
          data: await timbreBytes(),
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
      ...(b.rotulo ? [run(b.rotulo + ':', { bold: true }), run(' ')] : []),
      run(b.texto.replace(/\s*\n+\s*/g, ' ')),
    ];

    const corpo = [];
    est.titulo.forEach((t, i) => corpo.push(new D.Paragraph({
      alignment: D.AlignmentType.CENTER, spacing: { before: i === 0 ? 240 : 0, after: 240 },
      children: [run(t, { bold: true })],
    })));
    corpo.push(new D.Paragraph({ spacing: { after: 200 }, children: [run('Síntese', { bold: true })] }));
    est.sintese.forEach((b) => corpo.push(P(blocoRuns(b))));
    corpo.push(new D.Paragraph({ alignment: D.AlignmentType.CENTER, spacing: { before: 240, after: 240 }, children: [run('ATA', { bold: true })] }));

    if (doc.paragrafoUnico) {
      const runs = [];
      est.corpo.forEach((b, i) => { if (i) runs.push(run(' ')); runs.push(...blocoRuns(b)); });
      corpo.push(P(runs));
    } else {
      est.corpo.forEach((b) => corpo.push(P(blocoRuns(b))));
    }

    est.assinaturas.forEach((a, i) => {
      corpo.push(new D.Paragraph({ alignment: D.AlignmentType.CENTER, spacing: { before: i === 0 ? 720 : 600, after: 0 }, keepNext: true,
        children: [run('_____________________________________________')] }));
      corpo.push(new D.Paragraph({ alignment: D.AlignmentType.CENTER, spacing: { after: 0 }, keepLines: true,
        children: [run(`${a.cargo} ${a.nome}`.trim())] }));
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
              ? { top: cm(6.2), bottom: cm(3.2), left: cm(3), right: cm(2), header: cm(3.4), footer: cm(1.2) }
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
    const topo = doc.timbre ? 34 : 14, base = doc.timbre ? 30 : 18;
    area.style.setProperty('--fonte-doc', `'${doc.fonte || 'Cambria'}', Cambria, 'Times New Roman', serif`);
    area.style.setProperty('--tam-doc', `${doc.tamanho || 12}pt`);
    area.innerHTML = `
      ${doc.timbre ? '<img class="imp-timbre" src="assets/timbre.jpg" alt="">' : ''}
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

  global.Exportar = { gerarDocx, baixar, imprimir };
})(window);
