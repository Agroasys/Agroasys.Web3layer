# Contributing to Agroasys Settlement Protocol

First off, thank you for considering a contribution to the Agroasys Settlement Protocol. It is people like you who make the open-source community such an amazing place to learn, inspire, and create.

**Agroasys is financial infrastructure.** Code merged here controls real value and legally binding settlement logic. Therefore, we hold all contributions to a high standard of security, testing, and documentation.

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md) (if applicable) and the terms of the [Apache 2.0 License](LICENSE).

---

## Security Vulnerabilities

**DO NOT** report security vulnerabilities through public GitHub issues.

If you believe you have found a security vulnerability in the `Escrow` contract, `Oracle` logic, or `Signing` service, please email us immediately at **security@agroasys.com**.

We will work with you to verify the issue and patch it. We appreciate your responsible disclosure and will acknowledge your contribution once the vulnerability is resolved.

---

## How to Contribute

### 1. Reporting Bugs
Bugs are tracked as [GitHub Issues](https://github.com/your-org/agroasys-web3/issues).

When filing an issue, please include:

* **Severity:** (Critical / High / Medium / Low)
* **Component:** (Smart Contract, Indexer, Oracle, SDK)
* **Steps to Reproduce:** Provide a minimal code snippet or test case.
* **Expected Behavior:** What you thought would happen.
* **Actual Behavior:** What actually happened.
* **Environment:** (e.g., Node v18, Hardhat, Polkadot Westend)

### 2. Suggesting Enhancements
Feature requests are welcome. Please open an issue with the label `enhancement`.
* **Context:** Describe the problem you are trying to solve.
* **Proposal:** Describe the solution you would like to see.
* **Rationale:** Explain why this feature belongs in the core protocol rather than in an external application layer.

### 3. Your First Pull Request
Working on your first Pull Request? You can learn how from this free video series:
[How to Contribute to an Open Source Project on GitHub](https://kcd.im/pull-request)

---

## Development Workflow

1.  **Fork** the repository on GitHub.
2.  **Clone** your fork locally.
    ```bash
    git clone [https://github.com/your-username/agroasys-web3.git](https://github.com/your-username/agroasys-web3.git)
    cd agroasys-web3
    ```
3.  **Install Dependencies.**
    ```bash
    yarn install
    ```
4.  **Create a Branch** for your feature or fix.
    ```bash
    git checkout -b feat/amazing-new-feature
    ```
5.  **Develop & Test.** Ensure all local tests pass before committing.
    ```bash
    yarn test
    ```
6.  **Commit** your changes using descriptive commit messages (see *Commit Convention* below).
7.  **Push** to your fork and submit a **Pull Request (PR)** to the `main` branch.

---

## Coding Standards

### Smart Contracts (Solidity)
* **Security First:** All external inputs must be validated. Use `nonReentrant` modifiers where appropriate.
* **NatSpec:** All public functions and state variables must have full [NatSpec](https://docs.soliditylang.org/en/latest/natspec-format.html) documentation (`/// @notice`, `/// @param`).
* **Style:** Follow the official [Solidity Style Guide](https://docs.soliditylang.org/en/latest/style-guide.html).
* **Compiler:** Ensure compatibility with the PolkaVM Solidity compiler versions specified in `hardhat.config.ts`.
* **Gas Efficiency:** Optimize for the PolkaVM execution model. Avoid unbounded loops.

### TypeScript / Node.js
* **Linting:** Run `yarn lint` before committing. We use ESLint and Prettier.
* **Types:** Strict typing is enforced. Avoid `any` wherever possible. Define interfaces for all data structures.
* **Async/Await:** Prefer `async/await` over raw Promises for readability.

---

## Commit Convention

We follow the **Conventional Commits** specification. This allows us to automatically generate changelogs.

**Format:** `<type>(<scope>): <subject>`

**Types:**
* `feat`: A new feature
* `fix`: A bug fix
* `docs`: Documentation only changes
* `style`: Changes that do not affect the meaning of the code (white-space, formatting, etc)
* `refactor`: A code change that neither fixes a bug nor adds a feature
* `perf`: A code change that improves performance
* `test`: Adding missing tests or correcting existing tests
* `chore`: Changes to the build process or auxiliary tools

**Examples:**
* `feat(contract): allow oracle to update treasury address`
* `fix(oracle): resolve reentrancy risk in split logic`
* `docs(readme): update deployment steps for Westend`
* `test(sdk): add unit tests for stage 2 release`

---

## Pull Request Checklist

Before submitting your PR, ensure you have done the following:

1.  [ ] **Run Tests:** `yarn test` passes locally.
2.  [ ] **New Tests:** You have added unit tests for new features or regression tests for bug fixes.
3.  [ ] **Documentation:** You have updated the `README.md` or code comments if API changes were made.
4.  [ ] **Clean History:** Your commit history is clean and descriptive.
5.  [ ] **License:** You certify that you have the right to submit this code under the Apache 2.0 License.

---

## Legal: Developer Certificate of Origin (DCO)

By contributing to this project, you certify that you own the rights to your code and you are contributing it under the terms of the **Apache 2.0 License**.

To signal this, you must **sign off** on your commits.

```bash
git commit -s -m "feat: my commit message"
