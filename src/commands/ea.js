const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');

module.exports = {
  name: 'ea',
  description: 'Envia áudio para um JID',
  usage: '.ea [jid]',
  category: 'audio',
  ownerOnly: false,
  
  async execute(sock, { from, sender, pushname, reply, args, info, logger, enviarAudio }) {
    try {
      if (args.length < 1) {
        await reply('❌ Use: .ea [jid] (ex: .ea 5511999999999@s.whatsapp.net)');
        return { success: false };
      }
      
      const targetJid = String(args[0]).trim();
      
      if (!targetJid || !targetJid.includes('@')) {
        await reply(`❌ JID inválido: ${targetJid}\nUse o formato: numero@s.whatsapp.net ou numero@lid`);
        return { success: false };
      }

      const audioDir = './database/audio';
      if (!fs.existsSync(audioDir)) {
        await reply('❌ Pasta database/audio não encontrada');
        return { success: false };
      }

      const audioFiles = fs.readdirSync(audioDir).filter(file => 
        ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(file.toLowerCase().split('.').pop())
      );

      if (audioFiles.length === 0) {
        await reply('❌ Nenhum áudio encontrado em database/audio');
        return { success: false };
      }

      let lista = `🎵 *ÁUDIOS DISPONÍVEIS*\n\n`;
      audioFiles.forEach((file, index) => {
        const stats = fs.statSync(`${audioDir}/${file}`);
        lista += `*${index + 1}.* ${file} (${(stats.size/1024).toFixed(1)} KB)\n`;
      });
      lista += `\n📌 Responda com o número (1-${audioFiles.length})`;
      lista += `\n📱 Enviando para: ${targetJid}`;

      await sock.sendMessage(from, { text: lista }, { quoted: info });

      const respostaListener = async (msg) => {
        try {
          const infoMsg = msg.messages[0];
          if (!infoMsg || !infoMsg.message) return;
          
          const fromMsg = infoMsg.key.remoteJid;
          const senderMsg = fromMsg.endsWith('@g.us') ? infoMsg.key.participant : fromMsg;
          if (fromMsg !== from || senderMsg !== sender) return;
          
          const typeMsg = Object.keys(infoMsg.message)[0];
          let bodyMsg = '';
          if (typeMsg === 'conversation') bodyMsg = infoMsg.message.conversation;
          else if (typeMsg === 'extendedTextMessage') bodyMsg = infoMsg.message.extendedTextMessage.text;
          else return;
          
          const numero = parseInt(bodyMsg.trim());
          if (isNaN(numero) || numero < 1 || numero > audioFiles.length) {
            await sock.sendMessage(from, { text: `❌ Número inválido! Digite 1-${audioFiles.length}` }, { quoted: infoMsg });
            return;
          }

          const selectedFile = audioFiles[numero - 1];
          const audioPath = `${audioDir}/${selectedFile}`;
          
          if (!fs.existsSync(audioPath)) {
            await sock.sendMessage(from, { text: `❌ Arquivo ${selectedFile} não encontrado!` }, { quoted: infoMsg });
            return;
          }
          
          try {
            const result = await enviarAudio(targetJid, audioPath, from, sender, info);
            
            if (result && result.success) {
              await sock.sendMessage(from, { 
                text: `✅ *${selectedFile}* (${result.duration}s) enviado para ${targetJid}` 
              }, { quoted: infoMsg });
            }
          } catch (error) {
            logger.error(`Erro ao enviar áudio para ${targetJid}: ${error.message}`);
            await sock.sendMessage(from, { 
              text: `❌ Erro ao enviar áudio para ${targetJid}: ${error.message}` 
            }, { quoted: infoMsg });
          }
          
          sock.ev.off('messages.upsert', respostaListener);
        } catch (e) {
          logger.error('Erro na seleção de áudio: ' + e.message);
          await sock.sendMessage(from, { text: '❌ Erro: ' + e.message });
          sock.ev.off('messages.upsert', respostaListener);
        }
      };

      sock.ev.on('messages.upsert', respostaListener);
      setTimeout(() => sock.ev.off('messages.upsert', respostaListener), 60000);

      return { success: true };
    } catch (error) {
      logger.error('Erro no comando ea: ' + error.message);
      throw error;
    }
  }
};