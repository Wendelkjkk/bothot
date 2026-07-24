module.exports = {
  name: 'ping',
  description: 'Testa a resposta do bot',
  usage: '.ping',
  category: 'util',
  ownerOnly: false,
  
  async execute(sock, { from, sender, pushname, reply, args, logger }) {
    try {
      const start = Date.now();
      await reply(`calculando...`);
      const responseTime = Date.now() - start;
      logger.success(`Ping ${responseTime}ms`);
      await reply(`🏓 Pong! (${responseTime}ms)`);
      return { success: true, responseTime };
    } catch (error) {
      throw error;
    }
  }
};