forge install --no-git foundry-rs/forge-std
forge install --no-git OpenZeppelin/openzeppelin-contracts
forge build

forge test --match-contract FuzzTest -vvv
forge test --match-contract InvariantTest -vvv