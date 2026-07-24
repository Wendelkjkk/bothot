module.exports = {
  name: 'restart',
  aliases: ['reiniciar'],
  description: 'Reinicia o bot',
  usage: '.restart',
  category: 'admin',
  ownerOnly: true,
  
  async execute(sock, { from, sender, pushname, reply, logger }) {
    await reply('🔄 Reiniciando...');
    logger.system(`Reiniciando por ${sender}`);
    await logger.flushLogs();
    process.exit(0);
  }
};