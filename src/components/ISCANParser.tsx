import React, { useState, useEffect } from 'react';
import { FiUpload } from 'react-icons/fi';
import { FaSearch, FaCalendarAlt, FaClock, FaExchangeAlt, FaArrowUp, FaArrowDown, FaCoins, FaMoneyBillWave, FaBalanceScale, FaInfoCircle } from 'react-icons/fa';
import LoadingModal from './LoadingModal';
import '../styles/ISCANParser.css';
const { ipcRenderer } = window.require('electron');

interface TZaznam {
  datum: string;
  cas: string;
  operace: string;
  pohyb_tpnet: number;
  stav_tpnet: number;
  stav_sco: number;
  mince: number;
  bankovky: number;
  rozdil: number;
  detaily_sco: string;
}

class TSeznam {
  seznam: TZaznam[];
  pocatecni_stav_tpnet: number;

  constructor(pocatecni_stav_tpnet: number) {
    this.seznam = [];
    this.pocatecni_stav_tpnet = pocatecni_stav_tpnet;
  }

  add_zaznam(datum: string, cas: string, operace: string, pohyb_tpnet: number, stav_tpnet: number, stav_sco: number, mince: number, bankovky: number, rozdil: number, detaily_sco: string) {
    this.seznam.push({ datum, cas, operace, pohyb_tpnet, stav_tpnet, stav_sco, mince, bankovky, rozdil, detaily_sco });
  }

  sort_seznam() {
    this.seznam.sort((a, b) => (a.datum + a.cas).localeCompare(b.datum + b.cas));
  }

  dopln_stavy_tpnet() {
    let aktualni_stav_tpnet = this.pocatecni_stav_tpnet;
    let aktualni_stav_sco = 0;

    for (const zaznam of this.seznam) {
      aktualni_stav_tpnet += zaznam.pohyb_tpnet;
      zaznam.stav_tpnet = aktualni_stav_tpnet;

      if (zaznam.stav_sco === 0) {
        zaznam.stav_sco = aktualni_stav_sco;
      }
      aktualni_stav_sco = zaznam.stav_sco;

      zaznam.rozdil = zaznam.stav_sco - zaznam.stav_tpnet;
    }
  }
}

export interface ISCANParserProps {
  systemName: string;
}

const ISCANParser: React.FC<ISCANParserProps> = ({ systemName }) => {
  const [parsedData, setParsedData] = useState<TZaznam[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const parseLogFile = (content: string) => {
    console.log("Starting to parse log file");
    setIsLoading(true);
    setError(null);

    try {
      const lines = content.split('\n');
      const s = new TSeznam(0);

      let operace = "";
      let datum = "?";
      let cas = "?";
      let bankovky = 0;
      let mince = 0;
      let muzu_cist_mince = false;
      let muzu_cist_bankovky = false;
      let muzu_cist_loan = false;
      let muzu_cist_pickup = false;
      let detaily_loan = "";
      let detaily_pickup = "";
      let castka = 0;
      let last_coin_total_string = "";
      let last_note_total_string = "";

      for (const line of lines) {
        // Extract date and time from log line
        const dateMatch = line.match(/^(\d{4}-\d{2}-\d{2})/);
        const timeMatch = line.match(/(\d{2}:\d{2}:\d{2},\d{3})/);
        
        if (dateMatch && timeMatch) {
          datum = dateMatch[1];
          cas = timeMatch[1];
        }

        // Intervence
        if (line.includes("CashDispenseAbortedByDeviceRequest confirmed")) {
          s.add_zaznam(datum, cas, "INTERVENCE CashDispenseAbortedByDeviceRequest", 0, 0, 0, 0, 0, 0, "");
        }

        if (line.includes("CashDepositAbortedByDeviceRequest confirmed")) {
          s.add_zaznam(datum, cas, "INTERVENCE CashDepositAbortedByDeviceRequest", 0, 0, 0, 0, 0, 0, "");
        }

        // Vlozena hotovost
        if (line.includes("addTenderCash, CZK amount:")) {
          const kde_hledat = line.indexOf("addTenderCash, CZK amount:");
          const pohyb_tpnet = parseInt(line.slice(kde_hledat + 27)) / 100;
          s.add_zaznam(datum, cas, "VLOZENA HOTOVOST", pohyb_tpnet, 0, 0, 0, 0, 0, "");
        }

        // Vydana hotovost
        if (line.includes("doDispense(), dispenseAmount=")) {
          const kde_hledat = line.indexOf("doDispense(), dispenseAmount=");
          const pohyb_tpnet = -parseInt(line.slice(kde_hledat + 29)) / 100;
          s.add_zaznam(datum, cas, "VRACENA HOTOVOST", pohyb_tpnet, 0, 0, 0, 0, 0, "");
        }

        // LOAN
        if (line.includes("getLoanInfosForPOS")) {
          muzu_cist_loan = true;
          detaily_loan = "";
          castka = 0;
        }

        if (line.includes("IfcPickupLoanInfo") && muzu_cist_loan) {
          const amount_match = line.match(/Amount = (\d+)/);
          const denomination_match = line.match(/Denomination = (\d+)/);
          if (amount_match && denomination_match) {
            const castka_tento_nominal = parseInt(amount_match[1]) / 100;
            const tento_nominal = parseInt(denomination_match[1]) / 100;
            castka += castka_tento_nominal;
            if (castka_tento_nominal > 0) {
              detaily_loan += `${tento_nominal}:${castka_tento_nominal},`;
            }
          }
        }

        if (line.includes("enter readCashUnits") && muzu_cist_loan) {
          muzu_cist_loan = false;
          s.add_zaznam(datum, cas, "DOTACE", castka, 0, 0, 0, 0, 0, detaily_loan);
          castka = 0;
        }

        // PICKUP
        if (line.includes("getPickupInfosForPOS")) {
          muzu_cist_pickup = true;
          detaily_pickup = "";
          castka = 0;
        }

        if (line.includes("IfcPickupLoanInfo") && muzu_cist_pickup) {
          const amount_match = line.match(/Amount = (\d+)/);
          const denomination_match = line.match(/Denomination = (\d+)/);
          if (amount_match && denomination_match) {
            const castka_tento_nominal = parseInt(amount_match[1]) / 100;
            const tento_nominal = parseInt(denomination_match[1]) / 100;
            castka += castka_tento_nominal;
            if (castka_tento_nominal > 0) {
              detaily_pickup += `${tento_nominal}:${castka_tento_nominal},`;
            }
          }
        }

        if (line.includes("enter readCashUnits") && muzu_cist_pickup) {
          muzu_cist_pickup = false;
          s.add_zaznam(datum, cas, "ODVOD", -castka, 0, 0, 0, 0, 0, detaily_pickup);
          castka = 0;
        }

        // Cteni stavu hotovosti
        if (line.includes("device: coinacceptor")) {
          muzu_cist_mince = true;
          last_coin_total_string = "";
          const match = line.match(/count: (\d+), amount: (\d+)/);
          if (match) {
            const count = parseInt(match[1]);
            const amount = parseInt(match[2]);
            castka += amount;
            const nominal = amount / count;
            last_coin_total_string += `${nominal}:${count},`;
          }
        }

        if (line.includes("device: noteacceptor")) {
          muzu_cist_bankovky = true;
          last_note_total_string = "";
          const match = line.match(/count: (\d+), amount: (\d+)/);
          if (match) {
            const count = parseInt(match[1]);
            const amount = parseInt(match[2]);
            castka += amount;
            const nominal = amount / count;
            last_note_total_string += `${nominal}:${count},`;
          }
        }

        // Check for cash dispensed events
        if (line.includes("dispenseDone") && line.includes("SUCCESS")) {
          const amountMatch = line.match(/\[(\d+):CZK/);
          if (amountMatch) {
            const amount = parseInt(amountMatch[1]);
            s.add_zaznam(datum, cas, "VYDANA HOTOVOST", -amount, 0, 0, 0, 0, 0, "");
          }
        }

        // Check for cash taken events
        if (line.includes("CashDeviceDispenseTakenEvent")) {
          if (muzu_cist_mince) {
            mince = castka;
            castka = 0;
            muzu_cist_mince = false;
          }
          if (muzu_cist_bankovky) {
            bankovky = castka;
            castka = 0;
            const stav_sco = mince + bankovky;
            const detaily_sco = `Mince=${mince}, Bankovky=${bankovky}, rozpis:${last_coin_total_string},${last_note_total_string}`;
            if (mince > 0 || bankovky > 0) {
              s.add_zaznam(datum, cas, "STAV SCO", 0, 0, stav_sco, mince, bankovky, 0, detaily_sco);
            }
            muzu_cist_bankovky = false;
          }
        }
      }

      s.sort_seznam();
      s.pocatecni_stav_tpnet = s.seznam[0]?.stav_sco || 0;
      s.dopln_stavy_tpnet();

      console.log("Parsing complete. Total entries:", s.seznam.length);
      setParsedData(s.seznam);
    } catch (error) {
      console.error('Error parsing log file:', error);
      setError(`Error parsing log file: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDownloads = async () => {
    console.log("Opening downloads folder");
    try {
      setIsLoading(true);
      setLoadingProgress(0);
      const filePaths = await ipcRenderer.invoke('open-log-file-dialog', 'ISCAN', true);
      console.log("Selected file paths:", filePaths);

      if (filePaths && filePaths.length > 0) {
        const allEntries: TZaznam[] = [];

        for (let i = 0; i < filePaths.length; i++) {
          const content = await ipcRenderer.invoke('read-log-file', filePaths[i]);
          console.log(`Parsing file ${i + 1} of ${filePaths.length}`);
          parseLogFile(content);
          setLoadingProgress((i + 1) / filePaths.length * 100);
        }

        console.log("All files parsed. Total entries:", allEntries.length);
        setParsedData(allEntries);
      }
    } catch (error) {
      console.error('Error opening log files:', error);
      setError(`Error opening log files: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredData = parsedData.filter(entry =>
    Object.values(entry).some(value =>
      value.toString().toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  console.log("Rendering component. Parsed data length:", parsedData.length);

  useEffect(() => {
    if (systemName) {
      loadDownloadedLogs(systemName);
    }
  }, [systemName]);

  const loadDownloadedLogs = async (systemName: string) => {
    try {
      setIsLoading(true);
      setLoadingProgress(0);
      const logContent = await ipcRenderer.invoke('get-downloaded-iscan-logs', systemName);
      if (logContent) {
        parseLogFile(logContent);
      }
    } catch (error) {
      console.error('Error loading downloaded ISCAN logs:', error);
      setError(`Error loading downloaded ISCAN logs: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="iscan-parser">
        <h1 className="iscan-parser__title">ISCAN Parser</h1>
        <div className="iscan-parser__controls">
          <button className="iscan-parser__upload-button" onClick={handleOpenDownloads}>
            <FiUpload />
            Upload Log File
          </button>
          <div className="iscan-parser__search">
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="iscan-parser__search-input"
            />
            <FaSearch className="iscan-parser__search-icon" />
          </div>
        </div>
        {error && <div className="iscan-parser__error">{error}</div>}
        {filteredData.length > 0 ? (
          <div className="iscan-parser__table-wrapper">
            <table className="iscan-parser__table">
              <thead>
                <tr>
                  <th><FaCalendarAlt /> Date</th>
                  <th><FaClock /> Time</th>
                  <th><FaExchangeAlt /> Operation</th>
                  <th><FaArrowUp /> TPNet Movement</th>
                  <th><FaArrowDown /> TPNet State</th>
                  <th><FaBalanceScale /> SCO State</th>
                  <th><FaCoins /> Mince</th>
                  <th><FaMoneyBillWave /> Bankovky</th>
                  <th><FaBalanceScale /> Difference</th>
                  <th><FaInfoCircle /> SCO Details</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((entry, index) => (
                  <tr key={index}>
                    <td>{entry.datum}</td>
                    <td>{entry.cas}</td>
                    <td>{entry.operace}</td>
                    <td>{entry.pohyb_tpnet}</td>
                    <td>{entry.stav_tpnet}</td>
                    <td>{entry.stav_sco}</td>
                    <td>{entry.mince}</td>
                    <td>{entry.bankovky}</td>
                    <td>{entry.rozdil}</td>
                    <td>{entry.detaily_sco}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="iscan-parser__no-data">No data found</div>
        )}
      </div>
      <LoadingModal 
        isOpen={isLoading} 
        progress={loadingProgress} 
        onCancel={() => {}} 
      />
    </>
  );
};

export default ISCANParser;