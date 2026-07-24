const lembretes = require('../../database/lembretes.js');

module.exports = {
  name: 'lembretes',
  description: 'Lista todos os lembretes pendentes',
  usage: '.lembretes',
  category: 'util',
  ownerOnly: true,
  
  async execute(sock, { from, sender, pushname, reply, logger }) {
    try {
      await lembretes.verLembretes(sock, from, sender, pushname, reply);
      logger.info(`Lembretes visualizados por ${pushname}`);
      return { success: true };
    } catch (error) {
      throw error;
    }
  }
};