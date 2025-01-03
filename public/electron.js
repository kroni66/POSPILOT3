const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const fs = require('fs').promises;
const path = require('path');
const url = require('url');
const { exec } = require('child_process');
const readline = require('readline');
const archiver = require('archiver');
const extract = require('extract-zip');
const net = require('net');
const WebSocket = require('ws');
const http = require('http');

const vncConnections = new Map();
const statusConnections = new Map();
process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 768,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
    },
  });

  // Explicitly set the Content-Security-Policy to allow all sources
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': ["default-src * 'unsafe-inline' 'unsafe-eval' data: ws:"]
      }
    });
  });

  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, '../build/index.html'));
  } else {
    mainWindow.loadURL('http://localhost:3000');
  }

  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function initializeApp() {
  console.log('App is ready');
  createWindow();
}

app.on('ready', initializeApp);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Add this function to safely register IPC handlers
function safeIpcHandler(channel, handler) {
  if (ipcMain.listenerCount(channel) > 0) {
    ipcMain.removeAllListeners(channel);
  }
  ipcMain.handle(channel, handler);
}

function createVNCProxy(targetHost, targetPort) {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    const wss = new WebSocket.Server({ server });

    wss.on('connection', (ws) => {
      console.log(`WebSocket connection established for ${targetHost}:${targetPort}`);
      const client = new net.Socket();
      
      client.connect(targetPort, targetHost, () => {
        console.log(`TCP connection established to ${targetHost}:${targetPort}`);
        
        client.on('data', (data) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(data);
          }
        });

        ws.on('message', (message) => {
          client.write(message);
        });
      });

      client.on('error', (err) => {
        console.error(`VNC client error for ${targetHost}:${targetPort}:`, err);
        ws.close();
      });

      ws.on('close', () => {
        console.log(`WebSocket closed for ${targetHost}:${targetPort}`);
        client.destroy();
      });
    });

    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      console.log(`VNC proxy server listening on ws://localhost:${port}`);
      resolve(`ws://localhost:${port}`);
    });

    server.on('error', (err) => {
      console.error(`VNC proxy server error for ${targetHost}:${targetPort}:`, err);
      reject(err);
    });

    vncConnections.set(targetHost, server);
  });
}

// Replace all ipcMain.handle calls with safeIpcHandler
safeIpcHandler('run-powershell', async (event, script) => {
  return new Promise((resolve, reject) => {
    exec(`powershell -Command "${script}"`, (error, stdout, stderr) => {
      if (error) {
        console.error('PowerShell Error:', error);
        reject(error.message);
      } else if (stderr) {
        console.error('PowerShell stderr:', stderr);
        reject(stderr);
      } else {
        resolve(stdout.trim());
      }
    });
  });
});

safeIpcHandler('read-xml-file', async (event, fileName) => {
  try {
    const filePath = path.join(__dirname, '..', 'data', fileName);
    console.log('Attempting to read file:', filePath);
    const data = await fs.readFile(filePath, 'utf8');
    console.log('File read successfully');
    return data;
  } catch (error) {
    console.error('Error reading XML file:', error);
    throw error;
  }
});

safeIpcHandler('run-powershell-script', async (event, filter, selectedServer) => {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(process.resourcesPath, 'assets', 'command_get_sco_type.ps1');
    const command = `powershell.exe -ExecutionPolicy Bypass -File "${scriptPath}" -filter "${filter}" -selectedServer "${selectedServer}"`;

    console.log('Executing command:', command);

    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing PowerShell script: ${error}`);
        reject(error);
        return;
      }
      if (stderr) {
        console.error(`PowerShell script stderr: ${stderr}`);
      }
      console.log('PowerShell script stdout:', stdout);
      try {
        JSON.parse(stdout); // Test if the output is valid JSON
        resolve(stdout);
      } catch (parseError) {
        console.error('Error parsing PowerShell script output:', parseError);
        reject(new Error(`Invalid JSON output: ${stdout}`));
      }
    });
  });
});

safeIpcHandler('fetch-archives-with-size', async (event, logPath) => {
  return new Promise((resolve, reject) => {
    const command = `$files = Get-ChildItem -Path '${logPath}' -File; if ($files.Count -eq 0) { Write-Output "[]" } else { $jsonResult = $files | Select-Object Name, @{Name='Size';Expression={$_.Length}} | ConvertTo-Json -Compress; Write-Output $jsonResult }`;

    exec(`powershell.exe -Command "${command}"`, (error, stdout, stderr) => {
      if (error) {
        console.error('Error fetching archives:', error);
        reject(`Error fetching archives: ${error.message}`);
      } else if (stderr) {
        console.error('PowerShell stderr:', stderr);
        reject(`PowerShell error: ${stderr}`);
      } else {
        try {
          console.log('Raw stdout:', stdout); // Log raw output for debugging
          const trimmedOutput = stdout.trim();
          if (trimmedOutput === '[]') {
            resolve([]);
          } else {
            const archives = JSON.parse(trimmedOutput);
            console.log('Parsed archives:', archives);
            resolve(archives);
          }
        } catch (parseError) {
          console.error('Error parsing JSON:', parseError);
          console.error('Raw stdout:', stdout);
          reject(`Failed to parse archive data: ${parseError.message}\nRaw output: ${stdout}`);
        }
      }
    });
  });
});

safeIpcHandler('download-and-extract', async (event, logPath, systemName) => {
  const localPath = path.join(app.getPath('downloads'), systemName);
  await fs.mkdir(localPath, { recursive: true });

  return new Promise((resolve, reject) => {
    exec(`powershell.exe -Command "Copy-Item -Path '${logPath}' -Destination '${localPath}'"`, async (error, stdout, stderr) => {
      if (error) {
        console.error('Error downloading archive:', error);
        reject(error.message);
      } else if (stderr) {
        console.error('PowerShell stderr:', stderr);
        reject(stderr);
      } else {
        const archivePath = path.join(localPath, path.basename(logPath));
        const extractPath = path.join(localPath, 'extracted');

        try {
          await extract(archivePath, { dir: extractPath });
          const logFilePath = path.join(extractPath, 'iscan.txt'); // Adjust this based on actual log file name
          const logContent = await fs.readFile(logFilePath, 'utf8');
          resolve(logContent);
        } catch (err) {
          console.error('Error extracting archive:', err);
          reject(err);
        }
      }
    });
  });
});

safeIpcHandler('get-sql-space', async (event, server) => {
  try {
    console.log('Fetching SQL space data for server:', server);
    const scriptPath = path.join(process.resourcesPath, 'assets', 'get_sql_space.ps1');
    const command = `powershell.exe -ExecutionPolicy Bypass -File "${scriptPath}" -filter "${server}"`;
    
    console.log('Executing command:', command);
    
    const result = await new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error(`Error executing PowerShell script: ${error}`);
          reject(error);
        } else if (stderr) {
          console.error(`PowerShell script stderr: ${stderr}`);
          reject(new Error(stderr));
        } else {
          resolve(stdout);
        }
      });
    });

    console.log('Raw result from PowerShell script:', result);

    const trimmedResult = result.trim();
    if (!trimmedResult) {
      throw new Error(`No output received from PowerShell script for server: ${server}`);
    }

    let parsedOutput;
    try {
      parsedOutput = JSON.parse(trimmedResult);
    } catch (parseError) {
      console.error('Error parsing JSON:', parseError);
      throw new Error(`Failed to parse output from PowerShell script: ${parseError.message}`);
    }

    console.log('Parsed output:', parsedOutput);

    if (parsedOutput.error) {
      console.error(`Error from SQL query: ${parsedOutput.error}`);
      throw new Error(parsedOutput.error);
    }

    if (!parsedOutput.result) {
      throw new Error('Unexpected output format from PowerShell script');
    }

    const databaseDetails = parsedOutput.result;
    console.log(`Server: ${server}, Database Details:`, databaseDetails);

    return databaseDetails;
  } catch (error) {
    console.error('Error in get-sql-space handler:', error);
    throw error;
  }
});

safeIpcHandler('parse-pos-adapter-log', async (event, filePath) => {
  return new Promise((resolve, reject) => {
    const logEntries = [];
    const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    let currentEntry = null;
    let lineCount = 0;

    rl.on('line', (line) => {
      lineCount++;
      const timestampMatch = line.match(/\d{2}:\d{2}:\d{2}:\d{3}/);
      if (timestampMatch) {
        if (currentEntry) {
          logEntries.push(currentEntry);
        }
        currentEntry = {
          timestamp: timestampMatch[0],
          restartSCO: line.includes('FolderPath: C:\\TPDotnet\\\\TPiScan\\') ? 'Yes' : 'No',
          currentBalance: (line.match(/CurrentBalance is: (\d+)/) || [])[1] || '',
          pickedAmount: (line.match(/dPickedAmount is: (\d+)/) || [])[1] || '',
          uzavreniSCO: line.includes('Text: Opravdu chcete zavřít pokladnu?') ? 'Yes' : 'No',
          SCOConfirmation: (line.match(/QuestionYesNoAttendantMenu response: (\w+)/) || [])[1] || '',
          DBBalance: (line.match(/Get current balance from DB is (\d+,\d+)/) || [])[1] || ''
        };
      }

      if (lineCount % 1000 === 0) {
        event.sender.send('parse-progress', lineCount);
      }
    });

    rl.on('close', () => {
      if (currentEntry) {
        logEntries.push(currentEntry);
      }
      resolve({
        status: 'success',
        fileName: path.basename(filePath),
        total: logEntries.length,
        records: logEntries
      });
    });

    rl.on('error', (error) => {
      console.error('Error in parse-pos-adapter-log:', error);
      reject(error);
    });
  });
});

safeIpcHandler('ensure-data-directory', async () => {
  const dataPath = path.join(app.getPath('userData'), 'data');
  try {
    await fs.mkdir(dataPath, { recursive: true });
    return dataPath;
  } catch (error) {
    console.error('Error creating data directory:', error);
    throw error;
  }
});

safeIpcHandler('write-xml-file', async (event, fileName, content) => {
  try {
    const filePath = path.join(__dirname, '..', 'data', fileName);
    console.log('Attempting to write file:', filePath);
    await fs.writeFile(filePath, content, 'utf8');
    console.log('File written successfully');
    return true;
  } catch (error) {
    console.error('Error writing XML file:', error);
    throw error;
  }
});

safeIpcHandler('open-downloads-folder', async () => {
  const downloadsPath = app.getPath('downloads');
  await shell.openPath(downloadsPath);
});

safeIpcHandler('fetch-adapter-logs-with-size', async (event, logPath) => {
  try {
    const files = await fs.readdir(logPath);
    const logInfoPromises = files.map(async (file) => {
      const filePath = path.join(logPath, file);
      const stats = await fs.stat(filePath);
      return {
        Name: file,
        Size: stats.size,
        ModifiedTime: stats.mtimeMs
      };
    });
    const logInfo = await Promise.all(logInfoPromises);
    return logInfo;
  } catch (error) {
    console.error('Error fetching adapter logs:', error);
    throw error;
  }
});

safeIpcHandler('download-adapter-log', async (event, logPath, systemName) => {
  const localPath = path.join(app.getPath('downloads'), systemName);
  await fs.mkdir(localPath, { recursive: true });

  const fileName = path.basename(logPath);
  const destinationPath = path.join(localPath, fileName);

  return new Promise((resolve, reject) => {
    exec(`powershell.exe -Command "Copy-Item -Path '${logPath}' -Destination '${destinationPath}' -Force"`, (error, stdout, stderr) => {
      if (error) {
        console.error('Error downloading adapter log:', error);
        reject(error.message);
      } else if (stderr) {
        console.error('PowerShell stderr:', stderr);
        reject(stderr);
      } else {
        console.log(`Log file downloaded to: ${destinationPath}`);
        resolve(true);
      }
    });
  });
});

safeIpcHandler('open-log-file-dialog', async (event, type, multiple = false) => {
  const downloadsPath = app.getPath('downloads');
  const result = await dialog.showOpenDialog({
    defaultPath: downloadsPath,
    properties: ['openFile', ...(multiple ? ['multiSelections'] : [])],
    filters: [
      { name: 'Log Files', extensions: ['log', 'txt'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths;
  }
  return null;
});

safeIpcHandler('read-log-file', async (event, filePath) => {
  try {
    if (Array.isArray(filePath)) {
      // If filePath is an array, take the first element
      filePath = filePath[0];
    }
    const content = await fs.readFile(filePath, 'utf8');
    return content;
  } catch (error) {
    console.error('Error reading log file:', error);
    throw error;
  }
});

safeIpcHandler('check-iscan-logs-exist', async (event, systemName) => {
  const localPath = path.join(app.getPath('downloads'), systemName, 'ISCAN');
  try {
    await fs.access(localPath);
    const files = await fs.readdir(localPath);
    return files.length > 0;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return false; // Directory doesn't exist, so no logs
    }
    console.error('Error checking for ISCAN logs:', error);
    throw error;
  }
});

safeIpcHandler('check-adapter-logs-exist', async (event, systemName) => {
  const localPath = path.join(app.getPath('downloads'), systemName);
  try {
    await fs.access(localPath);
    const files = await fs.readdir(localPath);
    return files.length > 0;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return false; // Directory doesn't exist, so no logs
    }
    console.error('Error checking for Adapter logs:', error);
    throw error;
  }
});

safeIpcHandler('remove-logs', async (event, systemName) => {
  const iscanPath = path.join(app.getPath('downloads'), systemName);
  const adapterPath = path.join(app.getPath('downloads'), systemName);
  try {
    await fs.rm(iscanPath, { recursive: true, force: true });
    await fs.rm(adapterPath, { recursive: true, force: true });
    return true;
  } catch (error) {
    console.error('Error removing logs:', error);
    throw error;
  }
});

// Add this new handler
safeIpcHandler('get-downloaded-adapter-logs', async (event, systemName) => {
  const adapterLogsPath = path.join(app.getPath('downloads'), systemName);
  try {
    const files = await fs.readdir(adapterLogsPath);
    let combinedContent = '';
    for (const file of files) {
      if (file.endsWith('.log') || file.endsWith('.txt')) {
        const filePath = path.join(adapterLogsPath, file);
        const content = await fs.readFile(filePath, 'utf-8');
        combinedContent += content + '\n\n';
      }
    }
    return combinedContent;
  } catch (error) {
    console.error('Error reading downloaded Adapter logs:', error);
    throw error;
  }
});

safeIpcHandler('get-system-info', async (event, systemName) => {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(process.resourcesPath, 'assets', 'get_system_info.ps1');
    const command = `powershell.exe -ExecutionPolicy Bypass -File "${scriptPath}" -systemName "${systemName}"`;

    console.log('Executing command:', command);

    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing PowerShell script: ${error}`);
        reject(error);
        return;
      }
      if (stderr) {
        console.error(`PowerShell script stderr: ${stderr}`);
      }
      resolve(stdout);
    });
  });
});

safeIpcHandler('connect-vnc', async (event, systemName) => {
  try {
    // Create a proxy for the VNC connection
    const proxyUrl = await createVNCProxy(systemName, 5900);
    
    return {
      success: true,
      url: proxyUrl // This will be a local WebSocket URL
    };
  } catch (error) {
    console.error('VNC connection error:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

safeIpcHandler('disconnect-vnc', async (event, systemName) => {
  const server = vncConnections.get(systemName);
  if (server) {
    console.log(`Closing VNC proxy for ${systemName}`);
    server.close(() => {
      console.log(`VNC proxy closed for ${systemName}`);
    });
    vncConnections.delete(systemName);
  }
  return { success: true };
});

ipcMain.handle('get-sco-log-files', async (event, systemName) => {
  const downloadsPath = app.getPath('downloads');
  const scoFolderPath = path.join(downloadsPath, systemName);
  
  try {
    const files = await fs.readdir(scoFolderPath);
    return files
      .filter(file => file.startsWith('Log_') && file.endsWith('.txt'))
      .map(file => path.join(scoFolderPath, file));
  } catch (error) {
    console.error(`Error reading SCO log files for ${systemName}:`, error);
    return [];
  }
});

safeIpcHandler('restart-scos', async (event, scoNames) => {
  const scriptPath = path.join(process.resourcesPath, 'assets', 'shutdown.ps1');
  const results = [];

  for (const scoName of scoNames) {
    const command = `powershell.exe -ExecutionPolicy Bypass -File "${scriptPath}" -ComputerName ${scoName}`;
    
    try {
      const { stdout, stderr } = await new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
          if (error) {
            reject(error);
          } else {
            resolve({ stdout, stderr });
          }
        });
      });

      if (stderr) {
        console.error(`Stderr from shutdown command for ${scoName}:`, stderr);
        results.push({ scoName, success: false, message: stderr });
      } else {
        console.log(`Stdout from shutdown command for ${scoName}:`, stdout);
        results.push({ scoName, success: true, message: stdout });
      }
    } catch (error) {
      console.error(`Error executing shutdown command for ${scoName}:`, error);
      results.push({ scoName, success: false, message: error.message });
    }
  }

  return results;
});

safeIpcHandler('open-vnc', async (event, systemName) => {
  const vncViewerPath = 'C:\\Program Files\\uvnc bvba\\UltraVNC\\vncviewer.exe';
  const command = `"${vncViewerPath}" ${systemName}:5900 -password sco`;

  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing VNC command: ${error}`);
        reject({ error: error.message });
      } else {
        console.log(`VNC viewer opened for ${systemName}`);
        resolve({ success: true });
      }
    });
  });
});

safeIpcHandler('open-remote-registry', async (event, systemName) => {
  return new Promise((resolve, reject) => {
    const command = `regedit /m \\\\${systemName}`;
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error opening remote registry: ${error}`);
        reject({ success: false, error: error.message });
      } else {
        console.log(`Remote registry opened for ${systemName}`);
        resolve({ success: true });
      }
    });
  });
});

app.on('before-quit', () => {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.executeJavaScript(`
      localStorage.removeItem('isLoggedIn');
    `);
  }
  
  // Clean up status connections
  for (const [systemName, server] of statusConnections) {
    server.close(() => {
      console.log(`Status connection closed for ${systemName}`);
    });
  }
  statusConnections.clear();
});

safeIpcHandler('authenticate-local', async (event, credentials) => {
  const { password } = credentials;
  console.log('Attempting authentication');

  if (password === 'Faktnevim123+') {
    console.log('Authentication successful');
    return { success: true };
  } else {
    console.log('Authentication failed');
    return { 
      success: false, 
      error: 'Neplatné heslo' 
    };
  }
});

ipcMain.handle('ping-system', async (event, systemName) => {
  try {
    const { exec } = require('child_process');
    const platform = process.platform;
    
    // Construct the ping command based on the operating system
    const command = platform === 'win32' 
      ? `ping -n 1 -w 1000 ${systemName}`
      : `ping -c 1 -W 1 ${systemName}`;
    
    return new Promise((resolve) => {
      exec(command, (error, stdout, stderr) => {
        // Check if ping was successful
        const isOnline = !error && stdout.includes(
          platform === 'win32' ? 'bytes=' : 'bytes from'
        );
        resolve(isOnline);
      });
    });
  } catch (error) {
    console.error('Error executing ping:', error);
    return false;
  }
});

// Add WebSocket proxy functionality for system status
function createStatusWebSocketProxy(systemName) {
  const server = http.createServer();
  const wss = new WebSocket.Server({ server });
  let isFirstConnection = true;

  wss.on('connection', (ws) => {
    console.log(`Status WebSocket connection established for ${systemName}`);

    const pingSystem = async () => {
      try {
        const command = process.platform === 'win32'
          ? `ping -n 1 -w 1000 ${systemName}`
          : `ping -c 1 -W 1 ${systemName}`;

        exec(command, (error, stdout, stderr) => {
          const isOnline = !error && stdout.includes(
            process.platform === 'win32' ? 'bytes=' : 'bytes from'
          );
          
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ online: isOnline }));
          }
        });
      } catch (error) {
        console.error(`Error pinging ${systemName}:`, error);
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ online: false, error: error.message }));
        }
      }
    };

    // Initial ping
    if (isFirstConnection) {
      pingSystem();
      isFirstConnection = false;
    }

    // Set up interval for subsequent pings
    const pingInterval = setInterval(pingSystem, 10000);

    ws.on('close', () => {
      console.log(`Status WebSocket closed for ${systemName}`);
      clearInterval(pingInterval);
    });

    ws.on('error', (error) => {
      console.error(`Status WebSocket error for ${systemName}:`, error);
      clearInterval(pingInterval);
    });
  });

  server.listen(0, '127.0.0.1', () => {
    const { port } = server.address();
    console.log(`Status WebSocket server listening on ws://localhost:${port}`);
  });

  return server;
}

// Add new IPC handler for status connection
safeIpcHandler('connect-status', async (event, systemName) => {
  try {
    let server = statusConnections.get(systemName);
    if (!server) {
      server = createStatusWebSocketProxy(systemName);
      statusConnections.set(systemName, server);
    }
    const { port } = server.address();
    return {
      success: true,
      url: `ws://localhost:${port}`
    };
  } catch (error) {
    console.error('Status connection error:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// Clean up status connections when disconnecting
safeIpcHandler('disconnect-status', async (event, systemName) => {
  const server = statusConnections.get(systemName);
  if (server) {
    console.log(`Closing status connection for ${systemName}`);
    server.close(() => {
      console.log(`Status connection closed for ${systemName}`);
    });
    statusConnections.delete(systemName);
  }
  return { success: true };
});

// Add IPC handlers for network analyzer selection
safeIpcHandler('get-network-analyzer-info', async (event, systemName) => {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(process.resourcesPath, 'assets', 'get_network_analyzer_info.ps1');
    const command = `powershell.exe -ExecutionPolicy Bypass -File "${scriptPath}" -systemName "${systemName}"`;

    console.log('Executing command:', command);

    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing PowerShell script: ${error}`);
        reject(error);
        return;
      }
      if (stderr) {
        console.error(`PowerShell script stderr: ${stderr}`);
      }
      resolve(stdout);
    });
  });
});

safeIpcHandler('set-network-analyzer', async (event, systemName, analyzerType) => {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(process.resourcesPath, 'assets', 'set_network_analyzer.ps1');
    const command = `powershell.exe -ExecutionPolicy Bypass -File "${scriptPath}" -systemName "${systemName}" -analyzerType "${analyzerType}"`;

    console.log('Executing command:', command);

    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing PowerShell script: ${error}`);
        reject(error);
        return;
      }
      if (stderr) {
        console.error(`PowerShell script stderr: ${stderr}`);
      }
      resolve(stdout);
    });
  });
});
