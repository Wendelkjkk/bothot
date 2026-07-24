const { getFileBuffer } = require('../../utils/utils');

module.exports = {
  name: 'open',
  aliases: ['revelar'],
  description: 'Revela uma mensagem de visualização única',
  usage: '.open (marcando a mensagem)',
  category: 'util',
  ownerOnly: false,
  
  async execute(sock, { from, sender, pushname, reply, info, isGroup, logger, GRUPO_REVELAR }) {
    try {
      const quotedMsg = info.message.extendedTextMessage?.contextInfo?.quotedMessage;
      const viewOnceMsg = quotedMsg?.viewOnceMessageV2 || quotedMsg?.viewOnceMessage || 
                         info.message?.viewOnceMessageV2 || info.message?.viewOnceMessage;
      
      let mediaMsg = viewOnceMsg?.message?.imageMessage || viewOnceMsg?.message?.videoMessage || 
                     quotedMsg?.imageMessage || quotedMsg?.videoMessage || 
                     info.message?.imageMessage || info.message?.videoMessage;
      
      if (!mediaMsg) {
        await reply('❌ Marque uma mensagem de visualização única!');
        return { success: false };
      }

      const isViewOnce = !!(mediaMsg.viewOnce || viewOnceMsg || info.message?.viewOnceMessageV2 || info.message?.viewOnceMessage);
      if (!isViewOnce) {
        await reply('❌ Esta mensagem não é de visualização única!');
        return { success: false };
      }

      const isVideo = !!(mediaMsg.videoMessage || mediaMsg.mimetype?.includes('video'));
      const buffer = await getFileBuffer(mediaMsg, isVideo ? 'video' : 'image');
      
      if (buffer.length === 0) {
        await reply('❌ Falha ao baixar mídia');
        return { success: false };
      }

      if (isVideo) {
        await sock.sendMessage(GRUPO_REVELAR, { 
          video: buffer, 
          caption: `🔓 Vídeo revelado!\n👤 ${pushname}\n📱 ${sender}`
        });
      } else {
        await sock.sendMessage(GRUPO_REVELAR, { 
          image: buffer, 
          caption: `🔓 Imagem revelada!\n👤 ${pushname}\n📱 ${sender}`
        });
      }
      
      await reply(`✅ Mídia enviada para o grupo! 👀`);
      logger.success(`Mídia revelada por ${sender}`);
      return { success: true };
      
    } catch (error) {
      throw error;
    }
  }
};