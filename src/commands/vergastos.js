const gastos = require('../../database/gastos.js');

module.exports = {
  name: 'vergastos',
  description: 'Lista todos os gastos registrados (apenas dono)',
  usage: '.vergastos',
  category: 'financeiro',
  ownerOnly: true,
  
  async execute(sock, { from, sender, pushname, reply, logger }) {
    try {
      await gastos.verGastos(sock, from, sender, pushname, reply);
      logger.info(`Gastos visualizados por ${pushname}`);
      return { success: true };
    } catch (error) {
      throw error;
    }
  }
};