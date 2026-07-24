/**
 * Middleware de autenticação
 * Verifica se o usuário tem permissão para executar o comando
 */

function isOwner(sender, owner) {
  return sender ? sender.includes(owner) : false;
}

function isAdmin(sender, admins) {
  if (!admins || !Array.isArray(admins)) return false;
  return admins.some(admin => sender.includes(admin));
}

function hasPermission(sender, command, owner, admins = []) {
  const isOwnerUser = isOwner(sender, owner);
  const isAdminUser = isAdmin(sender, admins);
  
  // 🔒 TODOS OS COMANDOS AGORA EXIGEM QUE SEJA DONO
  if (!isOwnerUser) {
    return { 
      allowed: false, 
      message: `❌ Apenas o dono pode usar comandos!`,
      showInChat: false
    };
  }
  
  return { allowed: true };
}

module.exports = {
  isOwner,
  isAdmin,
  hasPermission
};