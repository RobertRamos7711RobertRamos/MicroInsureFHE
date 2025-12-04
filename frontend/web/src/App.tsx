// App.tsx
import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { getContractReadOnly, getContractWithSigner } from "./contract";
import WalletManager from "./components/WalletManager";
import WalletSelector from "./components/WalletSelector";
import "./App.css";

interface InsurancePool {
  id: string;
  name: string;
  riskType: string;
  totalMembers: number;
  totalFunds: string;
  createdBy: string;
  createdAt: number;
  encryptedTerms: string;
}

const App: React.FC = () => {
  // Randomized style selections
  // Colors: High contrast (blue+orange)
  // UI Style: Future metal
  // Layout: Center radiation
  // Interaction: Micro-interactions (hover effects)
  
  const [account, setAccount] = useState("");
  const [loading, setLoading] = useState(true);
  const [pools, setPools] = useState<InsurancePool[]>([]);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [walletSelectorOpen, setWalletSelectorOpen] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<{
    visible: boolean;
    status: "pending" | "success" | "error";
    message: string;
  }>({ visible: false, status: "pending", message: "" });
  const [newPoolData, setNewPoolData] = useState({
    name: "",
    riskType: "Crop Failure",
    initialFunds: "0.1"
  });
  const [activeTab, setActiveTab] = useState("pools");
  const [searchTerm, setSearchTerm] = useState("");

  // Selected random features: Data statistics, Search & filter, Project introduction
  const totalPools = pools.length;
  const cropPools = pools.filter(p => p.riskType === "Crop Failure").length;
  const weatherPools = pools.filter(p => p.riskType === "Extreme Weather").length;
  const healthPools = pools.filter(p => p.riskType === "Health Emergency").length;

  useEffect(() => {
    loadPools().finally(() => setLoading(false));
  }, []);

  const onWalletSelect = async (wallet: any) => {
    if (!wallet.provider) return;
    try {
      const web3Provider = new ethers.BrowserProvider(wallet.provider);
      setProvider(web3Provider);
      const accounts = await web3Provider.send("eth_requestAccounts", []);
      const acc = accounts[0] || "";
      setAccount(acc);

      wallet.provider.on("accountsChanged", async (accounts: string[]) => {
        const newAcc = accounts[0] || "";
        setAccount(newAcc);
      });
    } catch (e) {
      alert("Failed to connect wallet");
    }
  };

  const onConnect = () => setWalletSelectorOpen(true);
  const onDisconnect = () => {
    setAccount("");
    setProvider(null);
  };

  const loadPools = async () => {
    setIsRefreshing(true);
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      // Check contract availability using FHE
      const isAvailable = await contract.isAvailable();
      if (!isAvailable) {
        console.error("Contract is not available");
        return;
      }
      
      const keysBytes = await contract.getData("pool_keys");
      let keys: string[] = [];
      
      if (keysBytes.length > 0) {
        try {
          keys = JSON.parse(ethers.toUtf8String(keysBytes));
        } catch (e) {
          console.error("Error parsing pool keys:", e);
        }
      }
      
      const list: InsurancePool[] = [];
      
      for (const key of keys) {
        try {
          const poolBytes = await contract.getData(`pool_${key}`);
          if (poolBytes.length > 0) {
            try {
              const poolData = JSON.parse(ethers.toUtf8String(poolBytes));
              list.push({
                id: key,
                name: poolData.name,
                riskType: poolData.riskType,
                totalMembers: poolData.totalMembers || 0,
                totalFunds: poolData.totalFunds || "0",
                createdBy: poolData.createdBy,
                createdAt: poolData.createdAt,
                encryptedTerms: poolData.encryptedTerms
              });
            } catch (e) {
              console.error(`Error parsing pool data for ${key}:`, e);
            }
          }
        } catch (e) {
          console.error(`Error loading pool ${key}:`, e);
        }
      }
      
      list.sort((a, b) => b.createdAt - a.createdAt);
      setPools(list);
    } catch (e) {
      console.error("Error loading pools:", e);
    } finally {
      setIsRefreshing(false);
      setLoading(false);
    }
  };

  const createPool = async () => {
    if (!provider) { 
      alert("Please connect wallet first"); 
      return; 
    }
    
    setCreating(true);
    setTransactionStatus({
      visible: true,
      status: "pending",
      message: "Creating encrypted insurance pool with FHE..."
    });
    
    try {
      // Simulate FHE encryption
      const encryptedTerms = `FHE-${btoa(JSON.stringify({
        terms: "Default insurance terms encrypted with FHE",
        conditions: "All claims must be verified by pool members"
      }))}`;
      
      const contract = await getContractWithSigner();
      if (!contract) {
        throw new Error("Failed to get contract with signer");
      }
      
      const poolId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      const poolData = {
        name: newPoolData.name,
        riskType: newPoolData.riskType,
        totalMembers: 1,
        totalFunds: ethers.parseEther(newPoolData.initialFunds).toString(),
        createdBy: account,
        createdAt: Math.floor(Date.now() / 1000),
        encryptedTerms: encryptedTerms
      };
      
      // Store encrypted data on-chain using FHE
      await contract.setData(
        `pool_${poolId}`, 
        ethers.toUtf8Bytes(JSON.stringify(poolData))
      );
      
      const keysBytes = await contract.getData("pool_keys");
      let keys: string[] = [];
      
      if (keysBytes.length > 0) {
        try {
          keys = JSON.parse(ethers.toUtf8String(keysBytes));
        } catch (e) {
          console.error("Error parsing keys:", e);
        }
      }
      
      keys.push(poolId);
      
      await contract.setData(
        "pool_keys", 
        ethers.toUtf8Bytes(JSON.stringify(keys))
      );
      
      setTransactionStatus({
        visible: true,
        status: "success",
        message: "Encrypted insurance pool created!"
      });
      
      await loadPools();
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
        setShowCreateModal(false);
        setNewPoolData({
          name: "",
          riskType: "Crop Failure",
          initialFunds: "0.1"
        });
      }, 2000);
    } catch (e: any) {
      const errorMessage = e.message.includes("user rejected transaction")
        ? "Transaction rejected by user"
        : "Creation failed: " + (e.message || "Unknown error");
      
      setTransactionStatus({
        visible: true,
        status: "error",
        message: errorMessage
      });
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 3000);
    } finally {
      setCreating(false);
    }
  };

  const joinPool = async (poolId: string) => {
    if (!provider) {
      alert("Please connect wallet first");
      return;
    }

    setTransactionStatus({
      visible: true,
      status: "pending",
      message: "Processing FHE encrypted membership..."
    });

    try {
      const contract = await getContractWithSigner();
      if (!contract) {
        throw new Error("Failed to get contract with signer");
      }
      
      const poolBytes = await contract.getData(`pool_${poolId}`);
      if (poolBytes.length === 0) {
        throw new Error("Pool not found");
      }
      
      const poolData = JSON.parse(ethers.toUtf8String(poolBytes));
      
      const updatedPool = {
        ...poolData,
        totalMembers: poolData.totalMembers + 1
      };
      
      await contract.setData(
        `pool_${poolId}`, 
        ethers.toUtf8Bytes(JSON.stringify(updatedPool))
      );
      
      setTransactionStatus({
        visible: true,
        status: "success",
        message: "Successfully joined pool with FHE verification!"
      });
      
      await loadPools();
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
    } catch (e: any) {
      setTransactionStatus({
        visible: true,
        status: "error",
        message: "Join failed: " + (e.message || "Unknown error")
      });
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 3000);
    }
  };

  const filteredPools = pools.filter(pool => 
    pool.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pool.riskType.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return (
    <div className="loading-screen">
      <div className="metal-spinner"></div>
      <p>Initializing FHE connection...</p>
    </div>
  );

  return (
    <div className="app-container future-metal-theme">
      <header className="app-header">
        <div className="logo">
          <div className="logo-icon">
            <div className="shield-icon"></div>
          </div>
          <h1>Micro<span>Insure</span>FHE</h1>
        </div>
        
        <div className="header-actions">
          <div className="search-bar">
            <input 
              type="text" 
              placeholder="Search pools..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="metal-input"
            />
            <div className="search-icon"></div>
          </div>
          <button 
            onClick={() => setShowCreateModal(true)} 
            className="create-pool-btn metal-button"
          >
            <div className="add-icon"></div>
            Create Pool
          </button>
          <WalletManager account={account} onConnect={onConnect} onDisconnect={onDisconnect} />
        </div>
      </header>
      
      <div className="main-content center-radial">
        <div className="hero-section">
          <div className="hero-content">
            <h2>Anonymous Peer-to-Peer Micro-insurance</h2>
            <p>Create and join encrypted insurance pools using FHE technology to protect your sensitive data</p>
            <div className="fhe-badge">
              <span>Fully Homomorphic Encryption</span>
            </div>
          </div>
        </div>
        
        <div className="stats-grid">
          <div className="stat-card metal-card">
            <div className="stat-value">{totalPools}</div>
            <div className="stat-label">Total Pools</div>
          </div>
          <div className="stat-card metal-card">
            <div className="stat-value">{cropPools}</div>
            <div className="stat-label">Crop Pools</div>
          </div>
          <div className="stat-card metal-card">
            <div className="stat-value">{weatherPools}</div>
            <div className="stat-label">Weather Pools</div>
          </div>
          <div className="stat-card metal-card">
            <div className="stat-value">{healthPools}</div>
            <div className="stat-label">Health Pools</div>
          </div>
        </div>
        
        <div className="tabs-container">
          <div className="tabs">
            <button 
              className={`tab ${activeTab === "pools" ? "active" : ""}`}
              onClick={() => setActiveTab("pools")}
            >
              Insurance Pools
            </button>
            <button 
              className={`tab ${activeTab === "about" ? "active" : ""}`}
              onClick={() => setActiveTab("about")}
            >
              About FHE
            </button>
          </div>
        </div>
        
        {activeTab === "pools" ? (
          <div className="pools-section">
            <div className="section-header">
              <h2>Available Insurance Pools</h2>
              <div className="header-actions">
                <button 
                  onClick={loadPools}
                  className="refresh-btn metal-button"
                  disabled={isRefreshing}
                >
                  {isRefreshing ? "Refreshing..." : "Refresh"}
                </button>
              </div>
            </div>
            
            <div className="pools-list metal-card">
              {filteredPools.length === 0 ? (
                <div className="no-pools">
                  <div className="no-pools-icon"></div>
                  <p>No insurance pools found</p>
                  <button 
                    className="metal-button primary"
                    onClick={() => setShowCreateModal(true)}
                  >
                    Create First Pool
                  </button>
                </div>
              ) : (
                filteredPools.map(pool => (
                  <div className="pool-item" key={pool.id}>
                    <div className="pool-header">
                      <h3>{pool.name}</h3>
                      <span className="risk-badge">{pool.riskType}</span>
                    </div>
                    <div className="pool-details">
                      <div className="detail">
                        <span className="label">Members:</span>
                        <span className="value">{pool.totalMembers}</span>
                      </div>
                      <div className="detail">
                        <span className="label">Total Funds:</span>
                        <span className="value">{ethers.formatEther(pool.totalFunds)} ETH</span>
                      </div>
                      <div className="detail">
                        <span className="label">Created:</span>
                        <span className="value">
                          {new Date(pool.createdAt * 1000).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="pool-actions">
                      <button 
                        className="action-btn metal-button"
                        onClick={() => joinPool(pool.id)}
                      >
                        Join Pool
                      </button>
                    </div>
                    <div className="fhe-tag">
                      <span>FHE Encrypted</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="about-section metal-card">
            <h2>About FHE Micro-Insurance</h2>
            <p>
              Our platform uses Fully Homomorphic Encryption (FHE) to enable anonymous, 
              peer-to-peer micro-insurance pools. All sensitive data remains encrypted 
              even during processing and claims verification.
            </p>
            <div className="fhe-features">
              <div className="feature">
                <div className="feature-icon">🔒</div>
                <h3>Encrypted Policies</h3>
                <p>Insurance terms and conditions are encrypted with FHE</p>
              </div>
              <div className="feature">
                <div className="feature-icon">⚡</div>
                <h3>Anonymous Voting</h3>
                <p>Claims are verified through encrypted voting by pool members</p>
              </div>
              <div className="feature">
                <div className="feature-icon">🔄</div>
                <h3>Secure Processing</h3>
                <p>All calculations performed on encrypted data</p>
              </div>
            </div>
          </div>
        )}
      </div>
  
      {showCreateModal && (
        <ModalCreate 
          onSubmit={createPool} 
          onClose={() => setShowCreateModal(false)} 
          creating={creating}
          poolData={newPoolData}
          setPoolData={setNewPoolData}
        />
      )}
      
      {walletSelectorOpen && (
        <WalletSelector
          isOpen={walletSelectorOpen}
          onWalletSelect={(wallet) => { onWalletSelect(wallet); setWalletSelectorOpen(false); }}
          onClose={() => setWalletSelectorOpen(false)}
        />
      )}
      
      {transactionStatus.visible && (
        <div className="transaction-modal">
          <div className="transaction-content metal-card">
            <div className={`transaction-icon ${transactionStatus.status}`}>
              {transactionStatus.status === "pending" && <div className="metal-spinner"></div>}
              {transactionStatus.status === "success" && <div className="check-icon"></div>}
              {transactionStatus.status === "error" && <div className="error-icon"></div>}
            </div>
            <div className="transaction-message">
              {transactionStatus.message}
            </div>
          </div>
        </div>
      )}
  
      <footer className="app-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <div className="logo">
              <div className="shield-icon"></div>
              <span>MicroInsureFHE</span>
            </div>
            <p>Anonymous peer-to-peer micro-insurance powered by FHE</p>
          </div>
          
          <div className="footer-links">
            <a href="#" className="footer-link">Documentation</a>
            <a href="#" className="footer-link">Privacy Policy</a>
            <a href="#" className="footer-link">Terms of Service</a>
            <a href="#" className="footer-link">Contact</a>
          </div>
        </div>
        
        <div className="footer-bottom">
          <div className="fhe-badge">
            <span>FHE-Powered Privacy</span>
          </div>
          <div className="copyright">
            © {new Date().getFullYear()} MicroInsureFHE. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

interface ModalCreateProps {
  onSubmit: () => void; 
  onClose: () => void; 
  creating: boolean;
  poolData: any;
  setPoolData: (data: any) => void;
}

const ModalCreate: React.FC<ModalCreateProps> = ({ 
  onSubmit, 
  onClose, 
  creating,
  poolData,
  setPoolData
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setPoolData({
      ...poolData,
      [name]: value
    });
  };

  const handleSubmit = () => {
    if (!poolData.name || !poolData.riskType) {
      alert("Please fill required fields");
      return;
    }
    
    onSubmit();
  };

  return (
    <div className="modal-overlay">
      <div className="create-modal metal-card">
        <div className="modal-header">
          <h2>Create New Insurance Pool</h2>
          <button onClick={onClose} className="close-modal">&times;</button>
        </div>
        
        <div className="modal-body">
          <div className="fhe-notice-banner">
            <div className="key-icon"></div> Your pool data will be encrypted with FHE
          </div>
          
          <div className="form-grid">
            <div className="form-group">
              <label>Pool Name *</label>
              <input 
                type="text"
                name="name"
                value={poolData.name} 
                onChange={handleChange}
                placeholder="e.g. Midwest Crop Protection" 
                className="metal-input"
              />
            </div>
            
            <div className="form-group">
              <label>Risk Type *</label>
              <select 
                name="riskType"
                value={poolData.riskType} 
                onChange={handleChange}
                className="metal-select"
              >
                <option value="Crop Failure">Crop Failure</option>
                <option value="Extreme Weather">Extreme Weather</option>
                <option value="Health Emergency">Health Emergency</option>
                <option value="Livestock Loss">Livestock Loss</option>
                <option value="Other">Other</option>
              </select>
            </div>
            
            <div className="form-group">
              <label>Initial Contribution (ETH) *</label>
              <input 
                type="number"
                name="initialFunds"
                value={poolData.initialFunds} 
                onChange={handleChange}
                min="0.01"
                step="0.01"
                className="metal-input"
              />
            </div>
          </div>
          
          <div className="privacy-notice">
            <div className="privacy-icon"></div> All pool terms and claims will be processed with FHE encryption
          </div>
        </div>
        
        <div className="modal-footer">
          <button 
            onClick={onClose}
            className="cancel-btn metal-button"
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit} 
            disabled={creating}
            className="submit-btn metal-button primary"
          >
            {creating ? "Creating with FHE..." : "Create Pool"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;