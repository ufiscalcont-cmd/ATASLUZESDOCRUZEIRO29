// Números, datas e horas por extenso (pt-BR)
(function (global) {
  const UNIDADES = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove',
    'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
  const DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  const CENTENAS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos',
    'setecentos', 'oitocentos', 'novecentos'];
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto',
    'setembro', 'outubro', 'novembro', 'dezembro'];
  const ORD_UNID = ['', 'primeiro', 'segundo', 'terceiro', 'quarto', 'quinto', 'sexto', 'sétimo', 'oitavo', 'nono'];
  const ORD_DEZ = ['', 'décimo', 'vigésimo', 'trigésimo'];

  function ate999(n) {
    if (n === 0) return '';
    if (n === 100) return 'cem';
    const partes = [];
    const c = Math.floor(n / 100);
    const r = n % 100;
    if (c) partes.push(CENTENAS[c]);
    if (r) {
      if (r < 20) partes.push(UNIDADES[r]);
      else {
        const d = Math.floor(r / 10), u = r % 10;
        partes.push(u ? `${DEZENAS[d]} e ${UNIDADES[u]}` : DEZENAS[d]);
      }
    }
    return partes.join(' e ');
  }

  function extenso(n) {
    n = Math.floor(Math.abs(Number(n) || 0));
    if (n === 0) return 'zero';
    if (n < 1000) return ate999(n);
    if (n < 1000000) {
      const m = Math.floor(n / 1000), r = n % 1000;
      const mil = m === 1 ? 'mil' : `${ate999(m)} mil`;
      if (!r) return mil;
      const sep = (r < 100 || r % 100 === 0) ? ' e ' : ' ';
      return mil + sep + ate999(r);
    }
    return String(n);
  }

  function ordinalDia(d) {
    d = Number(d);
    if (d < 10) return ORD_UNID[d];
    const dz = Math.floor(d / 10), u = d % 10;
    return u ? `${ORD_DEZ[dz]} ${ORD_UNID[u]}` : ORD_DEZ[dz];
  }

  // 7 -> "07 (sete)"
  function numComExtenso(n, pad = 2) {
    const v = Math.floor(Number(n) || 0);
    return `${String(v).padStart(pad, '0')} (${extenso(v)})`;
  }

  function parseData(iso) {
    if (!iso) return null;
    const [a, m, d] = String(iso).split('-').map(Number);
    if (!a || !m || !d) return null;
    return { ano: a, mes: m, dia: d };
  }

  // "16 DE JULHO DE 2025"
  function dataTitulo(iso) {
    const p = parseData(iso);
    if (!p) return '__ DE ________ DE ____';
    return `${String(p.dia).padStart(2, '0')} DE ${MESES[p.mes - 1].toUpperCase()} DE ${p.ano}`;
  }

  // "ao décimo sexto dia do mês de julho do ano de 2025"
  function dataAbertura(iso) {
    const p = parseData(iso);
    if (!p) return 'ao ____ dia do mês de ______ do ano de ____';
    return `ao ${ordinalDia(p.dia)} dia do mês de ${MESES[p.mes - 1]} do ano de ${p.ano}`;
  }

  // "ao vigésimo terceiro dia do mês de julho do ano de dois mil e vinte e cinco da E∴ V∴ e seis mil ... da V∴ L∴"
  function dataLavratura(iso) {
    const p = parseData(iso);
    if (!p) return 'ao ____ dia do mês de ______ do ano de ______ da E∴ V∴ e ______ da V∴ L∴';
    return `ao ${ordinalDia(p.dia)} dia do mês de ${MESES[p.mes - 1]} do ano de ${extenso(p.ano)} da E∴ V∴ e ${extenso(p.ano + 4000)} da V∴ L∴`;
  }

  function dataCurta(iso) {
    const p = parseData(iso);
    if (!p) return '';
    return `${String(p.dia).padStart(2, '0')}/${String(p.mes).padStart(2, '0')}/${p.ano}`;
  }

  // "20:00" -> "20h" ; "21:45" -> "21h45min"
  function hora(h) {
    if (!h) return '__h';
    const [hh, mm] = String(h).split(':').map(Number);
    if (isNaN(hh)) return h;
    return mm ? `${hh}h${String(mm).padStart(2, '0')}min` : `${hh}h`;
  }

  global.Extenso = { extenso, ordinalDia, numComExtenso, dataTitulo, dataAbertura, dataLavratura, dataCurta, hora, MESES };
})(window);
