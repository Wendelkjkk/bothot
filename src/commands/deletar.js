const lembretes = require('../../database/lembretes.js');

module.exports = {
  name: 'deletar',
  description: 'Deleta um lembrete pelo ID',
  usage: '.deletar [ID]',
  category: 'util',
  ownerOnly: true,
  
  async execute(sock, { from, sender, pushname, reply, args, logger }) {
    try {
      if (args.length < 1) {
        await reply('❌ Use: .deletar [ID] (ex: .deletar 1)');
        return { success: false };
      }
      
      const id = parseInt(args[0]);
      if (isNaN(id)) {
        await reply('❌ ID inválido! Digite um número.');
        return { success: false };
      }
      
      await lembretes.deletarLembrete(sock, from, sender, pushname, reply, id);
      logger.info(`Lembrete ${id} deletado por ${pushname}`);
      return { success: true };
    } catch (error) {
      throw error;
    }
  }
};