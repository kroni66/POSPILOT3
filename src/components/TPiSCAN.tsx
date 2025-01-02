import React, { useState, useEffect } from 'react';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import { FaPlus, FaUpload, FaTrash, FaClock, FaDownload, FaUser, FaTag, FaStore, FaCopy, FaCheck } from 'react-icons/fa';
const { ipcRenderer } = window.require('electron');

interface Store {
  name: string;
  number: string;
  checked: boolean;
}

interface Deployment {
  name: string;
  activationTimeStamp: string;
  centralDownloadTimeStamp: string;
  localDownloadTimeStamp: string;
  profileName: string;
  profileVersion: string;
  stores: Store[];
}

interface Profile {
  name: string;
  versions: string[];
}

const TPiSCAN: React.FC = () => {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [storeHierarchy, setStoreHierarchy] = useState<Store[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  useEffect(() => {
    ipcRenderer.invoke('ensure-data-directory').then(() => {
      loadStoreHierarchy().then(setStoreHierarchy);
      loadProfiles().then(setProfiles);
    });
  }, []);

  const addDeployment = () => {
    setDeployments([...deployments, {
      name: '',
      activationTimeStamp: '',
      centralDownloadTimeStamp: '',
      localDownloadTimeStamp: '',
      profileName: '',
      profileVersion: '',
      stores: [],
    }]);
  };

  const handleInputChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const updatedDeployments = [...deployments];
    updatedDeployments[index] = { ...updatedDeployments[index], [name]: value };
    setDeployments(updatedDeployments);
  };

  const handleFileUpload = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const content = await readFileContent(file);
        const storeNumbers = content.split('\n').map(number => number.trim()).filter(number => number !== '');
        
        const updatedDeployments = [...deployments];
        updatedDeployments[index].stores = storeHierarchy.filter(store => 
          storeNumbers.some(number => store.number.endsWith(number.padStart(4, '0')))
        );
        setDeployments(updatedDeployments);
      } catch (error) {
        console.error('Error reading file:', error);
        // You might want to show an error message to the user here
      }
    }
  };

  const readFileContent = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          resolve(event.target.result as string);
        } else {
          reject(new Error('Failed to read file content'));
        }
      };
      reader.onerror = (error) => reject(error);
      reader.readAsText(file);
    });
  };

  const loadStoreHierarchy = async () => {
    try {
      console.log('Attempting to load StoreHierarchy.xml');
      const xmlContent = await ipcRenderer.invoke('read-xml-file', 'StoreHierarchy.xml');
      console.log('XML content received:', xmlContent.substring(0, 100) + '...'); // Log the first 100 characters
      const parser = new XMLParser({ ignoreAttributes: false });
      const parsedData = parser.parse(xmlContent);
      console.log('Parsed data:', parsedData);
      
      const stores = parsedData.storeHierarchy?.location?.store || [];
      
      return stores.map((store: any) => ({
        name: store['@_name'],
        number: store['@_name'].split('-').pop() || '',
        checked: false,
      }));
    } catch (error) {
      console.error('Error loading or parsing XML:', error);
      return [];
    }
  };

  const loadProfiles = async () => {
    try {
      const xmlContent = await ipcRenderer.invoke('read-xml-file', 'SoftwareInventory.xml');
      const parser = new XMLParser({ ignoreAttributes: false });
      const parsedData = parser.parse(xmlContent);
      
      const profilesData = parsedData.softwareInventory.profiles.profile;
      return profilesData.map((profile: any) => ({
        name: profile['@_name'],
        versions: profile.profileVersions.profileVersion.map((version: any) => version['@_version'])
      }));
    } catch (error) {
      console.error('Error loading profiles:', error);
      return [];
    }
  };

  const handleProfileNameChange = (index: number, e: React.ChangeEvent<HTMLSelectElement>) => {
    const { value } = e.target;
    const updatedDeployments = [...deployments];
    updatedDeployments[index] = { 
      ...updatedDeployments[index], 
      profileName: value,
      profileVersion: '' // Reset version when profile changes
    };
    setDeployments(updatedDeployments);
  };

  const handleProfileVersionChange = (index: number, e: React.ChangeEvent<HTMLSelectElement>) => {
    const { value } = e.target;
    const updatedDeployments = [...deployments];
    updatedDeployments[index] = { ...updatedDeployments[index], profileVersion: value };
    setDeployments(updatedDeployments);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Deployments:', deployments);
    
    try {
      // Read the existing SoftwareInventory.xml file
      const xmlContent = await ipcRenderer.invoke('read-xml-file', 'SoftwareInventory.xml');
      const parser = new XMLParser({ ignoreAttributes: false });
      const existingData = parser.parse(xmlContent);

      // Ensure deployments array exists
      if (!existingData.softwareInventory.deployments) {
        existingData.softwareInventory.deployments = { deployment: [] };
      } else if (!Array.isArray(existingData.softwareInventory.deployments.deployment)) {
        existingData.softwareInventory.deployments.deployment = [existingData.softwareInventory.deployments.deployment];
      }

      // Append new deployments to existing ones
      const updatedDeployments = [
        ...existingData.softwareInventory.deployments.deployment,
        ...deployments.map(deployment => ({
          '@_name': deployment.name,
          '@_activationTimeStamp': deployment.activationTimeStamp,
          '@_centralDownloadTimeStamp': deployment.centralDownloadTimeStamp,
          '@_localDownloadTimeStamp': deployment.localDownloadTimeStamp,
          '@_profileName': deployment.profileName,
          '@_profileVersion': deployment.profileVersion,
          destinations: {
            destination: deployment.stores.map(store => ({
              '@_name': store.name,
              '@_source': 'StoreHierarchyFile',
              stores: {
                store: {
                  '@_name': store.name
                }
              }
            }))
          }
        }))
      ];

      // Update the deployments in the existing data
      existingData.softwareInventory.deployments.deployment = updatedDeployments;

      // Convert the updated data back to XML
      const builder = new XMLBuilder({
        format: true,
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
        suppressEmptyNode: true
      });
      const updatedXmlContent = builder.build(existingData);

      // Save the updated XML content back to the file
      await ipcRenderer.invoke('write-xml-file', 'SoftwareInventory.xml', updatedXmlContent);

      console.log('Deployments appended successfully');
      setShowSuccessModal(true);
      
      // Clear the deployments state after successful save
      setDeployments([]);
    } catch (error) {
      console.error('Error appending deployments:', error);
      // You can add an error notification here
    }
  };

  const removeDeployment = (index: number) => {
    setDeployments(deployments.filter((_, i) => i !== index));
  };

  const copyFromFirstDeployment = () => {
    if (deployments.length < 2) return;

    const firstDeployment = deployments[0];
    const updatedDeployments = deployments.map((deployment, index) => {
      if (index === 0) return deployment;
      return {
        ...deployment,
        activationTimeStamp: firstDeployment.activationTimeStamp,
        centralDownloadTimeStamp: firstDeployment.centralDownloadTimeStamp,
        localDownloadTimeStamp: firstDeployment.localDownloadTimeStamp,
        profileName: firstDeployment.profileName,
        profileVersion: firstDeployment.profileVersion,
      };
    });
    setDeployments(updatedDeployments);
  };

  return (
    <div className="tpiscan">
      <h2 className="tpiscan__title">TPiSCAN Deployment Setup</h2>
      <div className="tpiscan__content">
        <form onSubmit={handleSubmit}>
          <div className="tpiscan__deployments-grid">
            {deployments.map((deployment, index) => (
              <div key={index} className="tpiscan__deployment">
                <h3>Deployment {index + 1}</h3>
                <div className="tpiscan__input-group">
                  <label htmlFor={`name-${index}`}><FaUser /> Name</label>
                  <input
                    id={`name-${index}`}
                    type="text"
                    name="name"
                    value={deployment.name}
                    onChange={(e) => handleInputChange(index, e)}
                    placeholder="Deployment Name"
                    className="tpiscan__input"
                  />
                </div>
                <div className="tpiscan__input-group">
                  <label htmlFor={`activation-${index}`}><FaClock /> Activation Time</label>
                  <input
                    id={`activation-${index}`}
                    type="datetime-local"
                    name="activationTimeStamp"
                    value={deployment.activationTimeStamp}
                    onChange={(e) => handleInputChange(index, e)}
                    className="tpiscan__input"
                  />
                </div>
                <div className="tpiscan__input-group">
                  <label htmlFor={`central-download-${index}`}><FaDownload /> Central Download Time</label>
                  <input
                    id={`central-download-${index}`}
                    type="datetime-local"
                    name="centralDownloadTimeStamp"
                    value={deployment.centralDownloadTimeStamp}
                    onChange={(e) => handleInputChange(index, e)}
                    className="tpiscan__input"
                  />
                </div>
                <div className="tpiscan__input-group">
                  <label htmlFor={`local-download-${index}`}><FaDownload /> Local Download Time</label>
                  <input
                    id={`local-download-${index}`}
                    type="datetime-local"
                    name="localDownloadTimeStamp"
                    value={deployment.localDownloadTimeStamp}
                    onChange={(e) => handleInputChange(index, e)}
                    className="tpiscan__input"
                  />
                </div>
                <div className="tpiscan__input-group">
                  <label htmlFor={`profile-name-${index}`}><FaTag /> Profile Name</label>
                  <select
                    id={`profile-name-${index}`}
                    name="profileName"
                    value={deployment.profileName}
                    onChange={(e) => handleProfileNameChange(index, e)}
                    className="tpiscan__input"
                  >
                    <option value="">Select Profile</option>
                    {profiles.map((profile, i) => (
                      <option key={i} value={profile.name}>{profile.name}</option>
                    ))}
                  </select>
                </div>
                <div className="tpiscan__input-group">
                  <label htmlFor={`profile-version-${index}`}><FaTag /> Profile Version</label>
                  <select
                    id={`profile-version-${index}`}
                    name="profileVersion"
                    value={deployment.profileVersion}
                    onChange={(e) => handleProfileVersionChange(index, e)}
                    className="tpiscan__input"
                    disabled={!deployment.profileName}
                  >
                    <option value="">Select Version</option>
                    {profiles
                      .find(p => p.name === deployment.profileName)
                      ?.versions.map((version, i) => (
                        <option key={i} value={version}>{version}</option>
                      ))
                    }
                  </select>
                </div>
                <div className="tpiscan__input-group">
                  <label htmlFor={`stores-file-${index}`}>
                    <FaStore /> Nahrát Vondrušku:
                  </label>
                  <div className="tpiscan__file-input-wrapper">
                    <input
                      id={`stores-file-${index}`}
                      type="file"
                      onChange={(e) => handleFileUpload(index, e)}
                      accept=".txt"
                      className="tpiscan__file-input"
                    />
                    <label htmlFor={`stores-file-${index}`} className="tpiscan__file-label">
                      Vybrat soubor
                    </label>
                  </div>
                </div>
                {deployment.stores.length > 0 && (
                  <div className="tpiscan__selected-stores">
                    <h4><FaStore /> Vybrané prodejny: {deployment.stores.length}</h4>
                    <ul>
                      {deployment.stores.slice(0, 5).map((store, storeIndex) => (
                        <li key={storeIndex}>{store.name} ({store.number})</li>
                      ))}
                      {deployment.stores.length > 5 && <li>... and {deployment.stores.length - 5} more</li>}
                    </ul>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => removeDeployment(index)}
                  className="tpiscan__remove-button"
                >
                  <FaTrash /> Vymazat deployment
                </button>
              </div>
            ))}
          </div>
          <div className="tpiscan__actions">
            <button type="button" onClick={addDeployment} className="tpiscan__add-button">
              <FaPlus /> Přidat deployment
            </button>
            {deployments.length > 1 && (
              <button type="button" onClick={copyFromFirstDeployment} className="tpiscan__copy-button">
                <FaCopy /> Kopírovat z prvního deploymentu
              </button>
            )}
            <button type="submit" className="tpiscan__submit-button">Zpracovat deploymenty</button>
          </div>
        </form>
      </div>
      
      {showSuccessModal && (
        <div className="tpiscan__modal-overlay">
          <div className="tpiscan__modal">
            <div className="tpiscan__modal-content">
              <div className="tpiscan__modal-icon">
                <FaCheck />
              </div>
              <h3 className="tpiscan__modal-title">Úspěch!</h3>
              <p className="tpiscan__modal-message">Deploymenty byly úspěšně přidány do SoftwareInventory.xml</p>
              <button 
                className="tpiscan__modal-close-btn"
                onClick={() => setShowSuccessModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
//asdasdsasdfsdfdsddsfssdfdsfsdsfdsasdasdasdsadsadasadsasdasddsadasassadsadasdasdsasadsadasasds
export default TPiSCAN;
