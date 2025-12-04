// MicroInsureFHE.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { FHE, euint32, ebool } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract MicroInsureFHE is SepoliaConfig {
    struct EncryptedPolicy {
        uint256 id;
        euint32 encryptedCoverage;
        euint32 encryptedPremium;
        euint32 encryptedRiskType;
        uint256 timestamp;
    }
    
    struct ClaimVote {
        euint32 encryptedVote;
        euint32 encryptedWeight;
    }

    struct DecryptedPolicy {
        uint32 coverage;
        uint32 premium;
        string riskType;
        bool isRevealed;
    }

    uint256 public policyCount;
    mapping(uint256 => EncryptedPolicy) public encryptedPolicies;
    mapping(uint256 => DecryptedPolicy) public decryptedPolicies;
    mapping(uint256 => ClaimVote[]) public claimVotes;
    
    mapping(uint256 => uint256) private requestToPolicyId;
    
    event PolicyCreated(uint256 indexed id, uint256 timestamp);
    event ClaimFiled(uint256 indexed policyId);
    event VoteSubmitted(uint256 indexed policyId);
    event DecryptionRequested(uint256 indexed policyId);
    event PolicyDecrypted(uint256 indexed policyId);
    
    modifier onlyMember(uint256 policyId) {
        _;
    }
    
    function createEncryptedPolicy(
        euint32 encryptedCoverage,
        euint32 encryptedPremium,
        euint32 encryptedRiskType
    ) public {
        policyCount += 1;
        uint256 newId = policyCount;
        
        encryptedPolicies[newId] = EncryptedPolicy({
            id: newId,
            encryptedCoverage: encryptedCoverage,
            encryptedPremium: encryptedPremium,
            encryptedRiskType: encryptedRiskType,
            timestamp: block.timestamp
        });
        
        decryptedPolicies[newId] = DecryptedPolicy({
            coverage: 0,
            premium: 0,
            riskType: "",
            isRevealed: false
        });
        
        emit PolicyCreated(newId, block.timestamp);
    }
    
    function requestPolicyDecryption(uint256 policyId) public onlyMember(policyId) {
        EncryptedPolicy storage policy = encryptedPolicies[policyId];
        require(!decryptedPolicies[policyId].isRevealed, "Already decrypted");
        
        bytes32[] memory ciphertexts = new bytes32[](3);
        ciphertexts[0] = FHE.toBytes32(policy.encryptedCoverage);
        ciphertexts[1] = FHE.toBytes32(policy.encryptedPremium);
        ciphertexts[2] = FHE.toBytes32(policy.encryptedRiskType);
        
        uint256 reqId = FHE.requestDecryption(ciphertexts, this.decryptPolicy.selector);
        requestToPolicyId[reqId] = policyId;
        
        emit DecryptionRequested(policyId);
    }
    
    function decryptPolicy(
        uint256 requestId,
        bytes memory cleartexts,
        bytes memory proof
    ) public {
        uint256 policyId = requestToPolicyId[requestId];
        require(policyId != 0, "Invalid request");
        
        EncryptedPolicy storage ePolicy = encryptedPolicies[policyId];
        DecryptedPolicy storage dPolicy = decryptedPolicies[policyId];
        require(!dPolicy.isRevealed, "Already decrypted");
        
        FHE.checkSignatures(requestId, cleartexts, proof);
        
        (uint32 coverage, uint32 premium, string memory riskType) = abi.decode(cleartexts, (uint32, uint32, string));
        
        dPolicy.coverage = coverage;
        dPolicy.premium = premium;
        dPolicy.riskType = riskType;
        dPolicy.isRevealed = true;
        
        emit PolicyDecrypted(policyId);
    }
    
    function fileClaim(uint256 policyId) public onlyMember(policyId) {
        require(encryptedPolicies[policyId].id != 0, "Policy not found");
        
        emit ClaimFiled(policyId);
    }
    
    function submitEncryptedVote(
        uint256 policyId,
        euint32 encryptedVote,
        euint32 encryptedWeight
    ) public onlyMember(policyId) {
        claimVotes[policyId].push(ClaimVote({
            encryptedVote: encryptedVote,
            encryptedWeight: encryptedWeight
        }));
        
        emit VoteSubmitted(policyId);
    }
    
    function requestVoteDecryption(uint256 policyId, uint256 voteIndex) public onlyMember(policyId) {
        require(voteIndex < claimVotes[policyId].length, "Invalid vote index");
        
        ClaimVote storage vote = claimVotes[policyId][voteIndex];
        bytes32[] memory ciphertexts = new bytes32[](2);
        ciphertexts[0] = FHE.toBytes32(vote.encryptedVote);
        ciphertexts[1] = FHE.toBytes32(vote.encryptedWeight);
        
        uint256 reqId = FHE.requestDecryption(ciphertexts, this.decryptVote.selector);
        requestToPolicyId[reqId] = policyId * 1000 + voteIndex;
    }
    
    function decryptVote(
        uint256 requestId,
        bytes memory cleartexts,
        bytes memory proof
    ) public {
        uint256 compositeId = requestToPolicyId[requestId];
        uint256 policyId = compositeId / 1000;
        uint256 voteIndex = compositeId % 1000;
        
        FHE.checkSignatures(requestId, cleartexts, proof);
        
        (uint32 vote, uint32 weight) = abi.decode(cleartexts, (uint32, uint32));
    }
    
    function getDecryptedPolicy(uint256 policyId) public view returns (
        uint32 coverage,
        uint32 premium,
        string memory riskType,
        bool isRevealed
    ) {
        DecryptedPolicy storage p = decryptedPolicies[policyId];
        return (p.coverage, p.premium, p.riskType, p.isRevealed);
    }
    
    function getVoteCount(uint256 policyId) public view returns (uint256) {
        return claimVotes[policyId].length;
    }
}