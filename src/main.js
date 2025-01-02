const { ipcMain } = require('electron');
const fs = require('fs').promises;
const path = require('path');

// ... (keep existing code)

ipcMain.handle('read-xml-file', async (event, filePath) => {
  try {
    const fullPath = path.join(__dirname, '..', filePath);
    const content = await fs.readFile(fullPath, 'utf-8');
    return content;
  } catch (error) {
    console.error('Error reading XML file:', error);
    throw error;
  }
});

ipcMain.handle('write-xml-file', async (event, filePath, content) => {
  try {
    const fullPath = path.join(__dirname, '..', filePath);
    await fs.writeFile(fullPath, content, 'utf-8');
  } catch (error) {
    console.error('Error writing XML file:', error);
    throw error;
  }
});

// ... (keep existing code)