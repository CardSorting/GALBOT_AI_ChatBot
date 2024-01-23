const creditslog = require('./credit');
const CreditStore = require('./creditStore');

class CreditManager {
  constructor(config = {}) {
    this.DEFAULT_START_CREDITS = config.DEFAULT_START_CREDITS || 250;
    this.ASK_COMMAND_COST = 3; // Cost for using the /ask command
    this.RENDER_COST = config.RENDER_COST || 10;
    this.creditStore = new CreditStore(); // Encapsulation of CreditStore for better testability

    creditslog.info('CreditManager instance created.');

    // Bind class methods for correct 'this' context
    this.cleanup = this.cleanup.bind(this);
    process.on('exit', this.cleanup);
  }

  async fetchUserCredits(userID) {
    try {
      creditslog.info(`Fetching credits for user: ${userID}`);
      let userCredits = await this.creditStore.retrieveUserCredits(userID);

      if (!userCredits || userCredits.credits === 0) {
        userCredits = { credits: this.DEFAULT_START_CREDITS, lastUpdated: new Date() };
        await this.updateUserCredits(userID, userCredits);
      }

      return userCredits;
    } catch (error) {
      creditslog.error(`Error fetching credits for user ${userID}: ${error}`);
      throw new Error('Error fetching user credits');
    }
  }

  async updateUserCredits(userID, userCredits) {
    try {
      await this.creditStore.updateUserCredits(userID, userCredits);
      creditslog.info(`Updated user ${userID} credits to ${userCredits.credits} and last updated date to ${userCredits.lastUpdated}`);
    } catch (error) {
      creditslog.error(`Error updating credits for user ${userID}: ${error}`);
      throw new Error('Error updating user credits');
    }
  }

  async deductUserCredits(userID, creditAmount = 1) {
    try {
      const userCredits = await this.fetchUserCredits(userID);

      if (userCredits.credits >= creditAmount) {
        userCredits.credits -= creditAmount;
        await this.updateUserCredits(userID, userCredits);
        return true;
      } else {
        creditslog.warn(`Failed to deduct credit from user ${userID}. Insufficient credits.`);
        return false;
      }
    } catch (error) {
      creditslog.error(`Error deducting credits for user ${userID}: ${error}`);
      throw new Error('Error deducting user credits');
    }
  }

  async handleRenderCostDeduction(userID) {
    return this.deductUserCredits(userID, this.RENDER_COST);
  }

  async handleAskCostDeduction(userID) {
    return this.deductUserCredits(userID, this.ASK_COMMAND_COST);
  }

  async addUserCredits(userID, creditAmount) {
    try {
      if (isNaN(creditAmount) || creditAmount <= 0) {
        creditslog.error(`Invalid credit amount: ${creditAmount} for user ${userID}`);
        throw new Error('Invalid credit amount');
      }

      const userCredits = await this.fetchUserCredits(userID);
      userCredits.credits += creditAmount;
      await this.updateUserCredits(userID, userCredits);
    } catch (error) {
      creditslog.error(`Error adding credits for user ${userID}: ${error}`);
      throw new Error('Error adding user credits');
    }
  }

  cleanup() {
    try {
      this.creditStore.close();
      creditslog.info('CreditManager instance cleaned up.');
    } catch (error) {
      creditslog.error(`Error during cleanup: ${error}`);
    }
  }
}

module.exports = CreditManager;