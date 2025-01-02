self.onmessage = function(e) {
  const { contents } = e.data;
  const logEntries = [];
  let totalLines = 0;
  let processedLines = 0;
  let previousBalance = null;

  for (const [fileName, content] of Object.entries(contents)) {
    const lines = content.split('\n');
    totalLines += lines.length;

    const fileDate = extractDateFromFileName(fileName);

    // Add a divider entry
    logEntries.push({
      isDivider: true,
      fileName,
      fileDate,
    });

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const timestampMatch = line.match(/\d{2}:\d{2}:\d{2}:\d{3}/);
      if (timestampMatch) {
        const currentBalance = (line.match(/CurrentBalance is: (\d+)/) || [])[1] || '';
        const entry = {
          date: fileDate, // Use fileDate for all entries
          timestamp: timestampMatch[0],
          restartSCO: line.includes('FolderPath: C:') ? 'restart' : '',
          currentBalance,
          balanceDifference: 0,
          pickedAmount: (line.match(/dPickedAmount is: (\d+)/) || [])[1] || '',
          uzavreniSCO: line.includes('Text: Opravdu chcete zavřít pokladnu?') ? 'Yes' : '',
          SCOConfirmation: (line.match(/QuestionYesNoAttendantMenu response: (\w+)/) || [])[1] || '',
          DBBalance: (line.match(/Get current balance from DB is (\d+,\d+)/) || [])[1] || ''
        };

        if (currentBalance && previousBalance) {
          entry.balanceDifference = parseInt(currentBalance) - parseInt(previousBalance);
        }

        if (currentBalance) {
          previousBalance = currentBalance;
        }

        // Only add the entry if it has some relevant information
        if (entry.restartSCO || entry.currentBalance || entry.pickedAmount || entry.uzavreniSCO || entry.SCOConfirmation || entry.DBBalance) {
          logEntries.push(entry);
        }
      }

      processedLines++;
      if (processedLines % 1000 === 0) {
        self.postMessage({ type: 'progress', progress: (processedLines / totalLines) * 100 });
      }
    }
  }

  self.postMessage({ type: 'complete', logEntries });
};

function extractDateFromFileName(fileName) {
  // Method to extract date from file name format "Log_YYYYMMDD.txt"
  const match = fileName.match(/Log_(\d{8})\.txt/);
  if (match) {
    const dateString = match[1];
    const year = dateString.slice(0, 4);
    const month = dateString.slice(4, 6);
    const day = dateString.slice(6, 8);
    return `${year}-${month}-${day}`;
  }
  return null;
}
