import { Account, parseUnits, WalletClient } from "viem";
import { DexPairWithPrice } from "../types";
import {
  checkTokenAndGasBalance,
  estimateSwapGas,
  fetchSwapData,
  simulateSwapTransaction,
  executeSwapTransaction,
  waitForTransactionConfirmation,
  handleApprovalIfNeeded,
  getUserTokenBalance,
  SwapParams,
} from "./swapHelpers";
import { toast } from "sonner";

// Main swap function - base to ticker
export const performSwap = async (
  amount: string,
  pair: DexPairWithPrice,
  account: Account,
  walletClient: WalletClient,
): Promise<void> => {
  try {
    // Step 2: Parse amount
    const baseAddress = pair.base.address as `0x${string}`;
    const amountInSmallestUnit = parseUnits(amount, pair.base.decimals!);

    // Step 3: Handle approval
    await handleApprovalIfNeeded(
      baseAddress,
      account.address,
      amountInSmallestUnit,
      walletClient,
      account,
    );

    // Step 4: Fetch swap data
    const swapParams: SwapParams = {
      fromTokenAddress: pair.base.address!,
      toTokenAddress: pair.ticker.address!,
      amount: amountInSmallestUnit.toString(),
      userWalletAddress: account.address as string,
      slippage: pair.config?.slippage, // Use pair's slippage configuration
    };

    const swapData = await fetchSwapData(swapParams);

    // Step 5: Estimate gas
    const gasEstimation = await estimateSwapGas(swapData.tx, account.address);

    // Step 6: Check balances
    const balanceCheck = await checkTokenAndGasBalance(
      baseAddress,
      account.address as `0x${string}`,
      amountInSmallestUnit,
      pair.base.decimals!,
      pair.base.symbol || "unknown token",
      gasEstimation.estimatedGasFee,
    );

    if (!balanceCheck.hasEnoughTokens || !balanceCheck.hasEnoughGas) {
      throw new Error(balanceCheck.errorMessage);
    }

    // Step 7: Simulate transaction
    await simulateSwapTransaction(swapData.tx, account.address);

    // Step 8: Execute transaction
    const hash = await executeSwapTransaction(
      swapData.tx,
      gasEstimation,
      account,
      walletClient,
    );

    // Step 9: Wait for confirmation
    await waitForTransactionConfirmation(hash);

    toast.success(`Swap transaction successful! Hash: ${hash}`);
  } catch (error) {
    const errorMessage = `Swap failed: ${(error as Error).message}`;
    toast.error(errorMessage);
  }
};

// Swap back function - ticker to base (all balance)
export const performSwapBack = async (
  pair: DexPairWithPrice,
  account: Account,
  walletClient: WalletClient,
): Promise<{ success: boolean; message: string }> => {
  try {
    // Step 2: Get user's full balance
    const tickerAddress = pair.ticker.address as `0x${string}`;

    const tokenBalance = await getUserTokenBalance(
      tickerAddress,
      account.address,
    );

    if (tokenBalance <= BigInt(0)) {
      const message = `No ${pair.ticker.symbol} balance to swap back`;
      return {
        success: false,
        message,
      };
    }

    // Step 3: Confirm with user
    const tokenBalanceFormatted = (
      Number(tokenBalance) /
      10 ** pair.ticker.decimals!
    ).toFixed(6);

    const confirmed = confirm(
      `Swap ALL ${tokenBalanceFormatted} ${pair.ticker.symbol} back to ${pair.base.symbol}?`,
    );

    if (!confirmed) {
      return {
        success: false,
        message: "User cancelled swap back operation",
      };
    }

    // Step 4: Handle approval
    await handleApprovalIfNeeded(
      tickerAddress,
      account.address,
      tokenBalance,
      walletClient,
      account,
    );

    // Step 5: Fetch swap data (reverse direction)
    const swapParams: SwapParams = {
      fromTokenAddress: pair.ticker.address!,
      toTokenAddress: pair.base.address!,
      amount: tokenBalance.toString(),
      userWalletAddress: account.address as string,
      slippage: pair.config?.slippage, // Use pair's slippage configuration
    };

    const swapData = await fetchSwapData(swapParams);

    // Step 6: Estimate gas
    const gasEstimation = await estimateSwapGas(swapData.tx, account.address);

    // Step 7: Check balances
    const balanceCheck = await checkTokenAndGasBalance(
      tickerAddress,
      account.address,
      tokenBalance,
      pair.ticker.decimals!,
      pair.ticker.symbol || "unknown token",
      gasEstimation.estimatedGasFee,
    );

    if (!balanceCheck.hasEnoughTokens || !balanceCheck.hasEnoughGas) {
      throw new Error(balanceCheck.errorMessage);
    }

    // Step 8: Simulate transaction
    await simulateSwapTransaction(swapData.tx, account.address);

    // Step 9: Execute transaction
    const hash = await executeSwapTransaction(
      swapData.tx,
      gasEstimation,
      account,
      walletClient,
    );

    // Step 10: Wait for confirmation
    await waitForTransactionConfirmation(hash);

    return {
      success: true,
      message: `Swap back transaction successful! Hash: ${hash}`,
    };
  } catch (error) {
    const errorMessage = `Swap failed: ${(error as Error).message}`;
    return {
      success: false,
      message: errorMessage,
    };
  }
};
