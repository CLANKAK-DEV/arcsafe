// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IArcSafe {
    function execute(uint256 txId) external returns (bytes memory);
}

/// @dev Test-only. Made an owner of the safe under test so that its re-entrant
///      execute() call passes the onlyOwner check and actually exercises the
///      reentrancy guard rather than being rejected earlier.
///      `safe` is settable because the safe's constructor needs this contract's
///      address in its owner list, so one of the two must be wired up after.
contract Reenterer {
    IArcSafe public safe;
    uint256 public targetTxId;
    bool public reentryAttempted;
    bool public reentrySucceeded;

    function configure(address safe_, uint256 txId) external {
        safe = IArcSafe(safe_);
        targetTxId = txId;
    }

    receive() external payable {
        if (reentryAttempted || address(safe) == address(0)) return;
        reentryAttempted = true;

        try safe.execute(targetTxId) {
            reentrySucceeded = true;
        } catch {
            reentrySucceeded = false;
        }
    }
}
