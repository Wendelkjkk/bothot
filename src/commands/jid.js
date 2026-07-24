module.exports = {
  name: 'jid',
  description: 'Mostra o JID do chat atual',
  usage: '.jid',
  category: 'util',
  ownerOnly: false,
  
  async execute(sock, { from, sender, pushname, reply, info, isGroup, logger }) {
    try {
      let mensagem = `📱 *INFORMAÇÕES DO CHAT*\n\n📌 *Tipo:* ${isGroup ? 'Grupo' : 'Privado'}\n🆔 *JID:* ${isGroup ? from : sender}`;
      
      if (isGroup) {
        try {
          const groupMetadata = await sock.groupMetadata(from);
          mensagem += `\n👥 *Nome:* ${groupMetadata.subject || 'N/D'}\n👥 *Participantes:* ${groupMetadata.participants?.length || 0}`;
        } catch (e) {}
      }
      
      mensagem += `\n\n👤 *Seu Nome:* ${pushname}\n🆔 *Seu JID:* ${sender}`;
      await reply(mensagem);
      logger.info(`JID solicitado por ${pushname}`);
      return { success: true };
    } catch (error) {
      throw error;
    }
  }
};