const lembretes = require('../../database/lembretes.js');

module.exports = {
  name: 'lembrar',
  description: 'Cria um novo lembrete',
  usage: '.lembrar',
  category: 'util',
  ownerOnly: true,
  
  async execute(sock, { from, sender, pushname, reply, logger }) {
    try {
      await lembretes.iniciarLembrete(sock, from, sender, pushname, reply);
      logger.info(`Lembrete iniciado por ${pushname}`);
      return { success: true };
    } catch (error) {
      throw error;
    }
  }
};