import { Web3Auth, WEB3AUTH_NETWORK } from "@web3auth/modal"
import { ethers } from "ethers"

class Web3AuthWrapper {
    private web3auth: Web3Auth | null = null
    private signer: ethers.Signer | null = null

    async connect(): Promise<ethers.Signer> {
        if (this.signer){
            return this.signer;
        }

        this.web3auth = new Web3Auth({
            clientId: process.env.CLIENT_ID!, 
            web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_DEVNET,
        })

        await this.web3auth.init()

        await this.web3auth.connect()

        if (!this.web3auth.provider) {
            throw new Error("Web3Auth provider not initialized")
        }

        const provider = new ethers.BrowserProvider(this.web3auth.provider)
        this.signer = await provider.getSigner()

        return this.signer
    }

    async getSigner(): Promise<ethers.Signer> {
        if (!this.signer) {
            throw new Error("Wallet not connected. Call connect() first.")
        }
        return this.signer
    }

    async getAddress(): Promise<string> {
        const signer = await this.getSigner()
        return signer.getAddress()
    }

    async disconnect() {
        await this.web3auth?.logout()
        this.signer = null
    }
}

export const web3Wallet = new Web3AuthWrapper()
