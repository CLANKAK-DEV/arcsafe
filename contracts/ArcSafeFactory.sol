// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ArcSafe} from "./ArcSafe.sol";

/// @title  ArcSafeFactory
/// @notice Deploys ArcSafe instances at deterministic addresses and indexes
///         them by owner, so a frontend can list "safes I belong to" without
///         running a separate indexer.
contract ArcSafeFactory {
    error NoOwners();
    error SafeAlreadyExists();

    event SafeDeployed(
        address indexed safe, address indexed deployer, address[] owners, uint256 threshold, bytes32 salt
    );

    /// @dev owner => safes that owner was a member of at creation time.
    ///      Membership can change afterwards; the frontend should treat this
    ///      as a discovery hint and read isOwner() on-chain for truth.
    mapping(address => address[]) private _safesOf;
    address[] private _allSafes;

    function createSafe(address[] calldata owners, uint256 threshold, bytes32 salt) external returns (address safe) {
        if (owners.length == 0) revert NoOwners();

        // Namespacing the salt by msg.sender stops one account from
        // front-running another's chosen address.
        bytes32 scopedSalt = keccak256(abi.encodePacked(msg.sender, salt));

        // Fail with a named error the UI can explain when this exact
        // (deployer, salt, owners, threshold) tuple was already deployed.
        // Without this the CREATE2 collision reverts with no decodable reason.
        address predicted = _predict(scopedSalt, owners, threshold);
        if (predicted.code.length != 0) revert SafeAlreadyExists();

        safe = address(new ArcSafe{salt: scopedSalt}(owners, threshold));

        for (uint256 i = 0; i < owners.length; ++i) {
            _safesOf[owners[i]].push(safe);
        }
        _allSafes.push(safe);

        emit SafeDeployed(safe, msg.sender, owners, threshold, salt);
    }

    /// @notice Predict the address `createSafe` would produce, before paying for it.
    function predictAddress(address deployer, address[] calldata owners, uint256 threshold, bytes32 salt)
        external
        view
        returns (address)
    {
        return _predict(keccak256(abi.encodePacked(deployer, salt)), owners, threshold);
    }

    /// @dev The CREATE2 address for an ArcSafe with these constructor args under
    ///      an already-scoped salt. Shared by predictAddress and the collision
    ///      guard in createSafe so the two can never drift apart.
    function _predict(bytes32 scopedSalt, address[] calldata owners, uint256 threshold)
        private
        view
        returns (address)
    {
        bytes32 initCodeHash =
            keccak256(abi.encodePacked(type(ArcSafe).creationCode, abi.encode(owners, threshold)));

        return address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), address(this), scopedSalt, initCodeHash)))));
    }

    function safesOf(address owner) external view returns (address[] memory) {
        return _safesOf[owner];
    }

    function safeCount() external view returns (uint256) {
        return _allSafes.length;
    }

    function allSafes(uint256 offset, uint256 limit) external view returns (address[] memory page) {
        uint256 total = _allSafes.length;
        if (offset >= total) return new address[](0);

        uint256 end = offset + limit;
        if (end > total) end = total;

        page = new address[](end - offset);
        for (uint256 i = offset; i < end; ++i) {
            page[i - offset] = _allSafes[i];
        }
    }
}
