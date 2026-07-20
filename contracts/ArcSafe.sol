// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title  ArcSafe — Multi-Signature Wallet for Arc Chain
/// @notice N-of-M multi-sig. Owner-set and threshold changes are themselves
///         multi-sig transactions: no single owner can ever act alone.
/// @dev    Authorization model
///         ─────────────────────────────────────────────────────────────
///         onlyOwner  → propose / approve / revoke. Cannot move funds alone.
///         onlySelf   → mutate the safe's own configuration. Only reachable
///                      through execute(), which already enforces threshold.
///
///         This is the property that makes the wallet a multi-sig rather than
///         a shared hot wallet. An `onlyOwner` guard on changeThreshold would
///         let one owner set the threshold to 1 and drain the safe.
contract ArcSafe {
    // ─── Errors ───────────────────────────────────────────────────────
    error NotOwner();
    error OnlySafe();
    error InvalidOwner();
    error DuplicateOwner();
    error InvalidThreshold();
    error OwnerCountBelowThreshold();
    error NoOwners();
    error TxNotFound();
    error TxAlreadyExecuted();
    error TxCancelled();
    error TxExpired();
    error TxStale();
    error AlreadyApproved();
    error NotApproved();
    error BelowThreshold();
    error ZeroTarget();
    error Reentrancy();
    error ExecutionFailed(bytes reason);
    error EmptyBatch();
    error BatchTooLarge();
    error BatchCallFailed(uint256 index, bytes reason);

    // ─── Types ────────────────────────────────────────────────────────
    struct Transaction {
        address to;
        uint96 configVersion; // packs with `to` into one slot
        uint256 value;
        bytes data;
        uint64 expiresAt; // 0 = never expires
        uint32 approvals; // O(1) tally, kept in sync by approve/revoke
        bool executed;
        bool cancelled;
        bool isBatch; // when true, `to`/`value`/`data` are unused
        address proposer;
    }

    /// @notice One leg of a batch.
    struct Call {
        address to;
        uint256 value;
        bytes data;
    }

    /// @dev Returned as a struct rather than a long tuple: eleven separate
    ///      return values exhaust the EVM stack, and named fields are far
    ///      harder to mis-decode on the client than positional ones.
    struct TxView {
        address to;
        uint256 value;
        bytes data;
        uint64 expiresAt;
        uint32 approvals;
        bool executed;
        bool cancelled;
        bool stale;
        address proposer;
        bool isBatch;
        uint256 callCount;
    }

    // ─── Storage ──────────────────────────────────────────────────────
    address[] private _owners;
    mapping(address => bool) public isOwner;

    uint256 public threshold;
    uint256 public txCount;

    /// @notice Bumped on every owner-set or threshold change. Pending
    ///         transactions proposed under an older config become unexecutable,
    ///         so approvals can never outlive the committee that gave them.
    uint96 public configVersion;

    mapping(uint256 => Transaction) private _transactions;
    mapping(uint256 => Call[]) private _batchCalls;
    mapping(uint256 => mapping(address => bool)) public hasApproved;

    uint256 private _lock = 1;

    // ─── Events ───────────────────────────────────────────────────────
    event Deposited(address indexed sender, uint256 amount);
    event Submitted(uint256 indexed txId, address indexed proposer, address indexed to, uint256 value, uint64 expiresAt);
    event BatchSubmitted(uint256 indexed txId, address indexed proposer, uint256 callCount, uint256 totalValue, uint64 expiresAt);
    event Approved(uint256 indexed txId, address indexed owner, uint256 approvals);
    event Revoked(uint256 indexed txId, address indexed owner, uint256 approvals);
    event Executed(uint256 indexed txId, bytes returnData);
    event Cancelled(uint256 indexed txId);
    event OwnerAdded(address indexed owner);
    event OwnerRemoved(address indexed owner);
    event OwnerSwapped(address indexed oldOwner, address indexed newOwner);
    event ThresholdChanged(uint256 previous, uint256 current);
    event ConfigVersionBumped(uint96 version);

    // ─── Modifiers ────────────────────────────────────────────────────
    modifier onlyOwner() {
        if (!isOwner[msg.sender]) revert NotOwner();
        _;
    }

    /// @dev Only the safe itself, i.e. only via execute() past threshold.
    modifier onlySelf() {
        if (msg.sender != address(this)) revert OnlySafe();
        _;
    }

    modifier nonReentrant() {
        if (_lock != 1) revert Reentrancy();
        _lock = 2;
        _;
        _lock = 1;
    }

    // ─── Constructor ──────────────────────────────────────────────────
    constructor(address[] memory owners_, uint256 threshold_) {
        if (owners_.length == 0) revert NoOwners();
        if (threshold_ == 0 || threshold_ > owners_.length) revert InvalidThreshold();

        for (uint256 i = 0; i < owners_.length; ++i) {
            address owner = owners_[i];
            if (owner == address(0) || owner == address(this)) revert InvalidOwner();
            if (isOwner[owner]) revert DuplicateOwner();
            isOwner[owner] = true;
            _owners.push(owner);
            emit OwnerAdded(owner);
        }

        threshold = threshold_;
        emit ThresholdChanged(0, threshold_);
    }

    receive() external payable {
        emit Deposited(msg.sender, msg.value);
    }

    // ─── Proposal lifecycle ───────────────────────────────────────────

    /// @param expiresAt Unix seconds after which the tx can no longer execute.
    ///                  Pass 0 for no expiry.
    function submit(address to, uint256 value, bytes calldata data, uint64 expiresAt)
        external
        onlyOwner
        returns (uint256 txId)
    {
        if (to == address(0)) revert ZeroTarget();
        if (expiresAt != 0 && expiresAt <= block.timestamp) revert TxExpired();

        txId = txCount++;
        Transaction storage t = _transactions[txId];
        t.to = to;
        t.value = value;
        t.data = data;
        t.expiresAt = expiresAt;
        t.configVersion = configVersion;
        t.proposer = msg.sender;

        emit Submitted(txId, msg.sender, to, value, expiresAt);
    }

    /// @notice Propose several calls that execute atomically: all succeed, or
    ///         the whole transaction reverts and nothing is applied.
    /// @dev    Approving a batch approves the exact ordered list. Because the
    ///         calls are stored, not passed at execution time, an approver
    ///         cannot be shown one set of calls and have another executed.
    function submitBatch(Call[] calldata calls, uint64 expiresAt)
        external
        onlyOwner
        returns (uint256 txId)
    {
        if (calls.length == 0) revert EmptyBatch();
        // Bounded so a batch can never be proposed that cannot fit in a block,
        // which would otherwise let anyone wedge a slot in the queue forever.
        if (calls.length > 32) revert BatchTooLarge();
        if (expiresAt != 0 && expiresAt <= block.timestamp) revert TxExpired();

        txId = txCount++;
        Transaction storage t = _transactions[txId];
        t.isBatch = true;
        t.expiresAt = expiresAt;
        t.configVersion = configVersion;
        t.proposer = msg.sender;

        uint256 totalValue;
        for (uint256 i = 0; i < calls.length; ++i) {
            if (calls[i].to == address(0)) revert ZeroTarget();
            _batchCalls[txId].push(calls[i]);
            totalValue += calls[i].value;
        }

        emit BatchSubmitted(txId, msg.sender, calls.length, totalValue, expiresAt);
    }

    function approve(uint256 txId) external onlyOwner {
        Transaction storage t = _live(txId);
        if (hasApproved[txId][msg.sender]) revert AlreadyApproved();

        hasApproved[txId][msg.sender] = true;
        uint256 count = ++t.approvals;

        emit Approved(txId, msg.sender, count);
    }

    function revoke(uint256 txId) external onlyOwner {
        Transaction storage t = _live(txId);
        if (!hasApproved[txId][msg.sender]) revert NotApproved();

        hasApproved[txId][msg.sender] = false;
        uint256 count = --t.approvals;

        emit Revoked(txId, msg.sender, count);
    }

    /// @notice Execute once the threshold is met. Callable by any owner.
    /// @dev    Effects (executed = true) are written before the external call,
    ///         and the call is additionally wrapped in a reentrancy guard.
    /// @notice Execute once the threshold is met. Callable by any owner.
    /// @dev    Payable so an executor can top the safe up in the same
    ///         transaction that spends it — useful when a proposal was agreed
    ///         before the safe was funded. This grants no new authority: value
    ///         only ever flows *into* the safe, and the threshold check below
    ///         is unchanged. Anything sent in excess of what the transaction
    ///         spends simply stays in the safe.
    function execute(uint256 txId) external payable onlyOwner nonReentrant returns (bytes memory returnData) {
        Transaction storage t = _live(txId);
        if (t.approvals < threshold) revert BelowThreshold();

        if (msg.value > 0) emit Deposited(msg.sender, msg.value);

        t.executed = true;

        if (t.isBatch) {
            Call[] storage calls = _batchCalls[txId];
            for (uint256 i = 0; i < calls.length; ++i) {
                (bool okCall, bytes memory retCall) = calls[i].to.call{value: calls[i].value}(calls[i].data);
                // Reverting the whole transaction is what makes the batch
                // atomic: a partially applied batch is rarely what an approver
                // agreed to. The index tells the UI which leg failed.
                if (!okCall) revert BatchCallFailed(i, retCall);
            }
            emit Executed(txId, '');
            return '';
        }

        (bool ok, bytes memory ret) = t.to.call{value: t.value}(t.data);
        if (!ok) revert ExecutionFailed(ret);

        emit Executed(txId, ret);
        return ret;
    }

    /// @notice Cancel a pending transaction. Requires multi-sig consent.
    function cancel(uint256 txId) external onlySelf {
        Transaction storage t = _live(txId);
        t.cancelled = true;
        emit Cancelled(txId);
    }

    // ─── Configuration — multi-sig only ───────────────────────────────

    function addOwner(address owner, uint256 newThreshold) external onlySelf {
        if (owner == address(0) || owner == address(this)) revert InvalidOwner();
        if (isOwner[owner]) revert DuplicateOwner();

        isOwner[owner] = true;
        _owners.push(owner);
        emit OwnerAdded(owner);

        _setThreshold(newThreshold);
        _bumpConfig();
    }

    function removeOwner(address owner, uint256 newThreshold) external onlySelf {
        if (!isOwner[owner]) revert InvalidOwner();
        if (_owners.length - 1 == 0) revert NoOwners();
        if (newThreshold > _owners.length - 1) revert OwnerCountBelowThreshold();

        isOwner[owner] = false;
        uint256 len = _owners.length;
        for (uint256 i = 0; i < len; ++i) {
            if (_owners[i] == owner) {
                _owners[i] = _owners[len - 1];
                _owners.pop();
                break;
            }
        }
        emit OwnerRemoved(owner);

        _setThreshold(newThreshold);
        _bumpConfig();
    }

    function swapOwner(address oldOwner, address newOwner) external onlySelf {
        if (!isOwner[oldOwner]) revert InvalidOwner();
        if (newOwner == address(0) || newOwner == address(this)) revert InvalidOwner();
        if (isOwner[newOwner]) revert DuplicateOwner();

        isOwner[oldOwner] = false;
        isOwner[newOwner] = true;

        uint256 len = _owners.length;
        for (uint256 i = 0; i < len; ++i) {
            if (_owners[i] == oldOwner) {
                _owners[i] = newOwner;
                break;
            }
        }

        emit OwnerSwapped(oldOwner, newOwner);
        _bumpConfig();
    }

    function changeThreshold(uint256 newThreshold) external onlySelf {
        _setThreshold(newThreshold);
        _bumpConfig();
    }

    // ─── Views ────────────────────────────────────────────────────────

    function getOwners() external view returns (address[] memory) {
        return _owners;
    }

    /// @notice The exact ordered calls an approver is agreeing to.
    function getBatchCalls(uint256 txId) external view returns (Call[] memory) {
        if (txId >= txCount) revert TxNotFound();
        return _batchCalls[txId];
    }

    function batchLength(uint256 txId) external view returns (uint256) {
        return _batchCalls[txId].length;
    }

    function ownerCount() external view returns (uint256) {
        return _owners.length;
    }

    function getTransaction(uint256 txId) external view returns (TxView memory) {
        if (txId >= txCount) revert TxNotFound();
        Transaction storage t = _transactions[txId];
        return TxView({
            to: t.to,
            value: t.value,
            data: t.data,
            expiresAt: t.expiresAt,
            approvals: t.approvals,
            executed: t.executed,
            cancelled: t.cancelled,
            stale: t.configVersion != configVersion,
            proposer: t.proposer,
            isBatch: t.isBatch,
            callCount: _batchCalls[txId].length
        });
    }

    /// @notice True when the transaction can be executed right now.
    function isExecutable(uint256 txId) external view returns (bool) {
        if (txId >= txCount) return false;
        Transaction storage t = _transactions[txId];
        return !t.executed && !t.cancelled && t.configVersion == configVersion
            && (t.expiresAt == 0 || t.expiresAt > block.timestamp) && t.approvals >= threshold;
    }

    // ─── Internals ────────────────────────────────────────────────────

    /// @dev Loads a transaction that is still open for approval or execution.
    function _live(uint256 txId) private view returns (Transaction storage t) {
        if (txId >= txCount) revert TxNotFound();
        t = _transactions[txId];
        if (t.executed) revert TxAlreadyExecuted();
        if (t.cancelled) revert TxCancelled();
        if (t.configVersion != configVersion) revert TxStale();
        if (t.expiresAt != 0 && t.expiresAt <= block.timestamp) revert TxExpired();
    }

    function _setThreshold(uint256 newThreshold) private {
        if (newThreshold == 0 || newThreshold > _owners.length) revert InvalidThreshold();
        uint256 previous = threshold;
        threshold = newThreshold;
        if (previous != newThreshold) emit ThresholdChanged(previous, newThreshold);
    }

    function _bumpConfig() private {
        uint96 v = ++configVersion;
        emit ConfigVersionBumped(v);
    }

    // ─── Token receiver hooks ─────────────────────────────────────────
    // Allows the safe to custody ERC-721 / ERC-1155 assets.

    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }

    function onERC1155Received(address, address, uint256, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(address, address, uint256[] calldata, uint256[] calldata, bytes calldata)
        external
        pure
        returns (bytes4)
    {
        return this.onERC1155BatchReceived.selector;
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == 0x01ffc9a7 // ERC-165
            || interfaceId == 0x150b7a02 // ERC-721Receiver
            || interfaceId == 0x4e2312e0; // ERC-1155Receiver
    }
}
