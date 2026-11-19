# Gerador de Atas · Loja Maçônica Luzes do Cruzeiro nº 29

Ferramenta para lavrar as atas (balaústres) da Loja direto no navegador. Você grava a sessão ou envia o áudio, a IA redige cada seção no padrão da Loja e o Secretário só revisa. Depois é baixar em Word ou PDF.

**Acesse:** https://ufiscalcont-cmd.github.io/ATASLUZESDOCRUZEIRO29/

## O que ela faz

- **Ata pelo áudio.** Aceita MP3, M4A, OGG/OPUS do WhatsApp, WAV, AAC e vídeos MP4/MOV. Antes de enviar, o próprio navegador extrai só o áudio e comprime (ffmpeg.wasm), então vídeos grandes do celular viram poucos MB. Também dá para gravar ali mesmo, no celular ou no notebook, ou colar uma transcrição pronta.
- **IA que conhece o formato.** Ela separa Balaústre, Atos e Decretos, Expedientes, Propostas, Ordem do Dia, Tronco, Saudação e Palavra a Bem da Ordem (Sul, Norte e Oriente). Usa as abreviações com ∴ e não transcreve nada ritualístico, só registra que ocorreu "na forma ritualística". O que ela não entendeu aparece num quadro de "pontos para conferir".
- **Atos, Decretos e Expedientes por PDF.** Anexe as pranchas, editais e decretos (PDF ou foto) e a IA lê cada um e escreve o resumo no estilo da ata: número, Loja de origem e assunto.
- **Revisar redação.** Um botão corrige ortografia e concordância sem mexer no conteúdo.
- **Texto montado sozinho.** Data por extenso ("ao décimo sexto dia do mês de julho"), números com extenso ("07 (sete)"), ano da E∴ V∴ e da V∴ L∴, Síntese automática, horários, presença e assinaturas.
- **Word (.docx) de verdade**, com o cabeçalho da Loja repetido em todas as páginas e numeração. Três opções de papel: sem timbre, timbre moderno ou o timbre clássico original.
- **PDF/Impressão** no mesmo layout.
- **Histórico** com busca, rascunho salvo automaticamente, opção de duplicar uma ata como base e numeração por grau que avança quando você finaliza a ata.
- **Backup** em .json para levar tudo a outro computador.

## Primeiro uso

1. Abra o site e clique em **Configurações**.
2. Preencha os oficiais e o número da última sessão de cada grau.
3. Crie uma chave gratuita do Google Gemini em <https://aistudio.google.com/app/apikey> e cole no campo **Chave da API**. Clique em **Buscar modelos** se quiser escolher outro modelo. O padrão é `gemini-flash-latest`, que é rápido e barato.
4. Salve. Pronto.

## Sigilo e privacidade

- As atas, as configurações e a chave ficam **só no navegador** de quem usa. Este repositório guarda apenas o programa, nenhuma ata.
- O áudio é enviado aos servidores do Google para a IA processar e é apagado logo depois. No **plano gratuito** da API, o Google pode usar o conteúdo para melhorar os produtos dele. Com faturamento ativo na chave, isso não acontece. Vale avaliar o que gravar. O ideal é pausar a gravação nos momentos ritualísticos.
- Como o site é público, não coloque dados da Loja nos arquivos deste repositório.

## Dicas

- Sessões longas (2 a 3 horas) funcionam. Áudio em MP3 de 32 a 64 kbps sobe mais rápido.
- Se a cota gratuita estourar (erro 429), espere alguns minutos ou ative o faturamento na chave.
- No celular, mantenha a tela ligada durante a gravação. O app tenta impedir o bloqueio automático.

## Estrutura

```
index.html        interface
css/app.css       visual e layout de impressão
js/extenso.js     números e datas por extenso
js/ata.js         modelo da ata e montagem do texto
js/ia.js          integração com o Google Gemini
js/export.js      Word (.docx) e PDF
js/app.js         lógica da tela, histórico, gravação
lib/docx.iife.js  biblioteca docx 9.16 (MIT)
lib/ffmpeg/       ffmpeg.wasm 0.12 (extração de áudio no navegador)
js/conversor.js   extrai e comprime o áudio antes de enviar à IA
assets/           timbres (moderno e clássico) e as logos das Lojas
```

É um site estático, sem servidor e sem etapa de build. Para rodar no computador: `python3 -m http.server` na pasta e abra `http://localhost:8000`.
