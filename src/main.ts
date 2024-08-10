import { getHttpEndpoint } from "@orbs-network/ton-access";
import { Address, beginCell, fromNano, toNano, TonClient } from "@ton/ton";
import { TonConnectUI } from "@tonconnect/ui";
import manifest from "/tonconnect-manifest.json?url";

const FEE_FACTOR = 100n;
const FEE_BASE = 1000n;
const FEE_ADDRESS = Address.parse("UQA705AUWErQe9Ur56CZz-v6N9J2uw298w-31ZCu475hT8U4");
const MIN_STORAGE = toNano(0.05);

const connector = new TonConnectUI({
    manifestUrl: manifest,
    buttonRootId: "tonconnect"
});

const minterInput = document.getElementById("minter") as HTMLInputElement;
const balanceLabel = document.getElementById("balance") as HTMLDivElement;
const withdrawInput = document.getElementById("withdraw") as HTMLInputElement;
const feeLabel = document.getElementById("fee") as HTMLDivElement;
const receiveLabel = document.getElementById("receive") as HTMLDivElement;
const sendButton = document.getElementById("send") as HTMLButtonElement;
let minter: Address | null = null;
let balance: bigint | null = null;
let withdraw: bigint | null = null;

withdrawInput.addEventListener("change", () => {
    if (isNaN(parseFloat(withdrawInput.value)))
        return;
    const value = toNano(withdrawInput.value);
    if (balance == null || value < MIN_STORAGE || balance - MIN_STORAGE - value <= 0n)
        clearWithdraw();
    else
        setWithdraw(value);
});
sendButton.addEventListener("click", async () => {
    if (connector.account == null) {
        alert("Connect wallet");
        return;
    }
    if (minter == null || balance == null ||
        withdraw == null || withdraw < MIN_STORAGE)
        return;
    const owner = Address.parse(connector.account.address);
    const fee = getFee(withdraw);
    const masterMsg = beginCell()
        .storeUint(0x178d4519, 32)
        .storeUint(0, 64)
        .storeCoins(0)
        .storeAddress(owner)
        .storeAddress(FEE_ADDRESS)
        .storeCoins(withdraw - fee)
        .storeMaybeRef(null)
        .endCell();
    const mint = beginCell()
        .storeUint(21, 32)
        .storeUint(0, 64)
        .storeAddress(owner)
        .storeCoins(withdraw)
        .storeRef(masterMsg)
        .endCell();


    connector.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 360,
        messages: [
            {
                address: minter.toString(),
                amount: toNano(0.05).toString(),
                payload: mint.toBoc().toString("base64")
            }
        ]
    });
});

(async () => {
    const client = new TonClient({
        endpoint: await getHttpEndpoint()
    });
    minterInput.addEventListener("change", async () => {
        if (!Address.isFriendly(minterInput.value) && 
            !Address.isRaw(minterInput.value))
            return;
        minter = Address.parse(minterInput.value);
        setBalance(await client.getBalance(minter));
        if (balance != null && balance > MIN_STORAGE)
            setWithdraw(balance - MIN_STORAGE);
    });
})();

function setBalance(number: bigint) {
    balance = number;
    balanceLabel.textContent = `BALANCE: ${fromNano(number)}`;
}

function setWithdraw(number: bigint) {
    withdraw = number;
    withdrawInput.value = fromNano(number);
    const fee = getFee(number);
    feeLabel.textContent = `FEE: ${fromNano(fee)}`;
    receiveLabel.textContent = `TO RECEIVE: ${fromNano(number - fee)}`;
}

function clearWithdraw() {
    withdrawInput.value = "";
    feeLabel.textContent = "";
    receiveLabel.textContent = "";
}

function getFee(number: bigint): bigint {
    return number * FEE_FACTOR / FEE_BASE;
}
