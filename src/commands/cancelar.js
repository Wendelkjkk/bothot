const gastos = require('../../database/gastos.js');

module.exports = {
  name: 'cancelar',
  description: 'Cancela a operação atual (gasto, lembrete, etc)',
  usage: '.cancelar',
  category: 'util',
  ownerOnly: true,
  
  async execute(sock, { from, sender, pushname, reply, logger }) {
    try {
      let cancelou = false;
      
      // ========== VERIFICA CONVERSA DE GASTO ==========
      if (gastos.isEmConversaGasto(sender)) {
        if (gastos.isResetConversa(sender)) {
          gastos.gastosTemp.delete(`reset_${sender}`);
        } else {
          gastos.gastosTemp.delete(sender);
        }
        cancelou = true;
        await reply('✅ *Gasto cancelado!*\n\nVocê pode começar novamente quando quiser.');
        logger.info(`Gasto cancelado por ${pushname}`);
        return { success: true };
      }
      
      // ========== VERIFICA CONVERSA DE LEMBRETE ==========
      const lembretes = require('../../database/lembretes.js');
      if (lembretes.isEmConversaLembrete(sender)) {
        if (lembretes.isLimparConversa(sender)) {
          lembretes.lembretesTemp.delete(`limpar_${sender}`);
        } else {
          lembretes.lembretesTemp.delete(sender);
        }
        cancelou = true;
        await reply('✅ *Lembrete cancelado!*\n\nVocê pode começar novamente quando quiser.');
        logger.info(`Lembrete cancelado por ${pushname}`);
        return { success: true };
      }
      
      if (!cancelou) {
        await reply('📭 *Nenhuma operação ativa para cancelar!*');
        return { success: false };
      }
      
    } catch (error) {
      logger.error(`Erro ao cancelar: ${error.message}`);
      await reply('❌ Erro ao cancelar: ' + error.message);
      throw error;
    }
  }
};