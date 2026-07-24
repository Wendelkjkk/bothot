// utils/utils.js
const { downloadContentFromMessage } = require('baileys');

async function getFileBuffer(mediaMsg, type) {
  try {
    let mediaKey;
    let directPath;
    let url;
    
    // Verifica se é viewOnce
    if (mediaMsg.viewOnce || mediaMsg.viewOnceV2) {
      const viewOnceMsg = mediaMsg.viewOnceMessageV2?.message || 
                         mediaMsg.viewOnceMessage?.message || 
                         mediaMsg;
      mediaMsg = viewOnceMsg.imageMessage || viewOnceMsg.videoMessage || mediaMsg;
    }
    
    // Extrai os dados da mídia
    if (mediaMsg.imageMessage) {
      mediaMsg = mediaMsg.imageMessage;
    } else if (mediaMsg.videoMessage) {
      mediaMsg = mediaMsg.videoMessage;
    }
    
    const stream = await downloadContentFromMessage(
      mediaMsg,
      type === 'video' ? 'video' : 'image'
    );
    
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
      buffer = Buffer.concat([buffer, chunk]);
    }
    
    return buffer;
  } catch (error) {
    console.error('Erro ao baixar mídia:', error);
    return Buffer.from([]);
  }
}

module.exports = {
  getFileBuffer
};