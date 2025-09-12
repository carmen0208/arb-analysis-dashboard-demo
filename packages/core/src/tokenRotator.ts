export interface TokenRotator {
  getCurrentToken: () => string;
  rotateToken: () => string;
}

export interface TokenStatus {
  remainingRequests: number;
  resetTime: Date;
}

export const createTokenRotator = (tokens: string[]): TokenRotator => {
  let currentIndex = 0;

  return {
    getCurrentToken: () => tokens[currentIndex],
    rotateToken: () => {
      currentIndex = (currentIndex + 1) % tokens.length;
      return tokens[currentIndex];
    },
  };
};
