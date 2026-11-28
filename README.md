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
- **Atas salvas no Google Drive.** Entre com a conta Google e cada ata salva vai para a pasta "Atas - Loja Maçônica Luzes do Cruzeiro nº 29" no seu Drive, junto com uma cópia do Word. O Histórico mostra as atas do Drive em qualquer computador ou celular.
- **Histórico** com busca, rascunho salvo automaticamente, opção de duplicar uma ata como base e numeração por grau que avança quando você finaliza a ata.
- **Backup** em .json para levar tudo a outro computador.

## Primeiro uso

1. Abra o site e clique em **Configurações**.
2. Preencha os oficiais e o número da última sessão de cada grau.
3. Crie uma chave gratuita do Google Gemini em <https://aistudio.google.com/app/apikey> e cole no campo **Chave da API**. Clique em **Buscar modelos** se quiser escolher outro modelo. O padrão é `gemini-flash-latest`, que é rápido e barato.
4. Salve. Pronto.

## Ligar o Google Drive (uma vez só, uns 10 minutos)

O Google exige que cada sistema tenha um "ID do cliente" próprio. Ele não é senha e pode ficar público.

1. Entre em <https://console.cloud.google.com> com a sua conta Google e crie um projeto (ex.: **Gerador de Atas**).
2. Vá em **APIs e serviços → Biblioteca**, procure **Google Drive API** e clique em **Ativar**.
3. Vá em **Google Auth Platform** (ou "Tela de consentimento OAuth") → **Começar**. Nome do app: *Gerador de Atas*; e-mail de suporte: o seu; público: **Externo**; aceite e conclua.
4. Ainda ali, em **Público**, clique em **Publicar app** (ou adicione o seu e-mail em *Usuários de teste*).
5. Em **Clientes → Criar cliente**: tipo **Aplicativo da Web**. Em **Origens JavaScript autorizadas**, adicione `https://ufiscalcont-cmd.github.io`. Clique em **Criar** e copie o **ID do cliente** (termina em `.apps.googleusercontent.com`).
6. No sistema: **Configurações → Google Drive**, cole o ID, salve e clique em **Conectar Drive** no topo.

Na primeira vez o Google pode mostrar "o Google não verificou este app". Como é o seu próprio app, clique em **Avançado → Acessar Gerador de Atas**. O sistema pede só a permissão `drive.file`: ele enxerga apenas os arquivos que ele mesmo criou, nada mais do seu Drive.

## Sigilo e privacidade

- Sem o Drive, as atas e as configurações ficam **só no navegador** de quem usa. Com o Drive, ficam também na sua conta Google, numa pasta só sua. Este repositório guarda apenas o programa, nenhuma ata.
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
js/drive.js       login Google e armazenamento no Drive
js/app.js         lógica da tela, histórico, gravação
lib/docx.iife.js  biblioteca docx 9.16 (MIT)
lib/ffmpeg/       ffmpeg.wasm 0.12 (extração de áudio no navegador)
js/conversor.js   extrai e comprime o áudio antes de enviar à IA
assets/           timbres (moderno e clássico) e as logos das Lojas
```

É um site estático, sem servidor e sem etapa de build. Para rodar no computador: `python3 -m http.server` na pasta e abra `http://localhost:8000`.
