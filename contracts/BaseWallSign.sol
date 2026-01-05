// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract BaseWallSign is ERC721 {
    /// @notice Deployer address for provenance only (no powers)
    address public immutable owner;

    /// @notice Incremental token id
    uint256 public nextTokenId;

    /// @notice Emitted for every signature
    event Signed(
        address indexed signer,
        uint256 indexed tokenId,
        bytes signatureData
    );

    constructor() ERC721("Signed Base Wall #1", "BASEWALL") {
        owner = msg.sender;
    }

    /// @notice Submit a signature and mint an NFT
    /// @param signatureData compressed drawing data
    function sign(bytes calldata signatureData) external {
        // Optional: size limit to protect users from expensive tx
        require(signatureData.length <= 4096, "Signature too large");

        uint256 tokenId = ++nextTokenId;
        _safeMint(msg.sender, tokenId);

        emit Signed(msg.sender, tokenId, signatureData);
    }

    /// @notice Single shared metadata for all tokens
    function tokenURI(uint256) public pure override returns (string memory) {
        return "ipfs://SIGNED_BASE_WALL_1_METADATA";
    }
}
