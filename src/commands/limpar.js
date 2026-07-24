const lembretes = require('../../database/lembretes.js');

module.exports = {
  name: 'limpar',
  description: 'Remove todos os lembretes pendentes',
  usage: '.limpar',
  category: 'util',
  ownerOnly: true,
  
  async execute(sock, { from, sender, pushname, reply, logger }) {
    try {
      await lembretes.limparLembretes(sock, from, sender, pushname, reply);
      logger.warning(`Limpeza de lembretes solicitada por ${pushname}`);
      return { success: true };
    } catch (error) {
      throw error;
    }
  }
};