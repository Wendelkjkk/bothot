const gastos = require('../../database/gastos.js');

module.exports = {
  name: 'gasto',
  description: 'Registra um gasto (apenas dono)',
  usage: '.gasto',
  category: 'financeiro',
  ownerOnly: true,
  
  async execute(sock, { from, sender, pushname, reply, logger }) {
    try {
      await gastos.iniciarGasto(sock, from, sender, pushname, reply);
      logger.info(`Gasto iniciado por ${pushname}`);
      return { success: true };
    } catch (error) {
      throw error;
    }
  }
};