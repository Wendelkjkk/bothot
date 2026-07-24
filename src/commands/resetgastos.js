const gastos = require('../../database/gastos.js');

module.exports = {
  name: 'resetgastos',
  description: 'Reseta todos os gastos (apenas dono)',
  usage: '.resetgastos',
  category: 'financeiro',
  ownerOnly: true,
  
  async execute(sock, { from, sender, pushname, reply, logger }) {
    try {
      await gastos.iniciarReset(sock, from, sender, pushname, reply);
      logger.warning(`Reset de gastos solicitado por ${pushname}`);
      return { success: true };
    } catch (error) {
      throw error;
    }
  }
};